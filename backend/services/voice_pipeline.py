import asyncio, base64, json, numpy as np, tempfile, os, wave
from loguru import logger
from services.rag import get_context_for_course
from providers.llm_provider import chat as llm_chat
from providers.tts_provider import synthesize
from config import settings

_whisper_local = None

def get_local_whisper():
    global _whisper_local
    if _whisper_local is None:
        from faster_whisper import WhisperModel
        _whisper_local = WhisperModel(settings.WHISPER_MODEL_SIZE, device="cpu", compute_type="int8")
    return _whisper_local

SYSTEM_FORMATEUR = """Tu es un formateur expert, chaleureux et pedagogique.
Tu reponds aux questions d un apprenant pendant un cours de formation.
Regles STRICTES :
- Reponds en francais, 2-4 phrases maximum, claires et directes
- Bases ta reponse UNIQUEMENT sur le contexte du cours fourni
- Si la question est floue ou hors sujet, demande une clarification
- Termine TOUJOURS par "As-tu d autres questions ?" ou "Veux-tu qu on continue le cours ?"
- Style oral naturel de formateur, pas de listes"""

SYSTEM_CONTINUER = """Tu es un formateur expert.
L apprenant vient de repondre apres ta question.
ANALYSE sa reponse :
- Si hors sujet, vide, ou incomprehensible : reponds "Je n ai pas bien compris, veux-tu qu on reprenne le cours ?" 
- Si il dit qu il n a pas d autres questions (non, ca va, continue, ok, c est bon, oui continue, merci, au revoir) : reponds EXACTEMENT et UNIQUEMENT "Parfait ! Reprenons le cours." 
- Si il a une vraie question : reponds en 2-3 phrases et termine par "As-tu d autres questions ?"
Reponds en francais uniquement. Sois bref."""

class VoiceSession:
    def __init__(self, course_id, websocket):
        self.course_id = course_id
        self.ws = websocket
        self.audio_buffer = bytearray()
        self.chunk_count = 0
        self.is_recording = False
        self.silence_count = 0
        # Seuils ajustes - plus strict pour eviter les bruits de fond
        self.SILENCE_LIMIT = 25      # ~800ms de silence avant envoi
        self.ENERGY_THRESHOLD = 800  # Plus haut pour ignorer les bruits de fond et l audio du cours
        self.MIN_SPEECH_CHUNKS = 15  # Minimum de chunks de voix avant de traiter
        self.speech_chunks = 0
        self.waiting_for_followup = False
        self.conversation_history = []
        self.is_active = False  # Controle si on ecoute activement

    async def send_json(self, data):
        try:
            await self.ws.send_text(json.dumps(data))
        except Exception:
            pass

    async def send_audio(self, audio_bytes):
        encoded = base64.b64encode(audio_bytes).decode()
        await self.send_json({"type": "audio", "data": encoded})

    def activate(self):
        """Active l ecoute - appele quand l apprenant clique sur le bouton."""
        self.is_active = True
        self.audio_buffer = bytearray()
        self.is_recording = True
        self.silence_count = 0
        self.speech_chunks = 0
        logger.info("Microphone active - en ecoute")

    def deactivate(self):
        """Desactive l ecoute - appele quand l apprenant relache le bouton."""
        self.is_active = False
        self.is_recording = False
        logger.info("Microphone desactive")

    async def process_chunk(self, pcm_bytes: bytes):
        """Traite un chunk audio. N analyse que si actif."""
        if not self.is_active:
            return

        self.chunk_count += 1
        audio_int16 = np.frombuffer(pcm_bytes, dtype=np.int16)
        if len(audio_int16) == 0:
            return

        rms = np.sqrt(np.mean(audio_int16.astype(np.float32) ** 2))
        self.audio_buffer.extend(pcm_bytes)

        if rms > self.ENERGY_THRESHOLD:
            self.speech_chunks += 1
            self.silence_count = 0
        else:
            self.silence_count += 1

        if self.chunk_count % 50 == 0:
            logger.debug(f"Chunk {self.chunk_count} | RMS: {rms:.0f} | Speech: {self.speech_chunks}")

    async def process_and_send(self):
        """Appele quand l apprenant relache le bouton - traite tout l audio enregistre."""
        audio_data = bytes(self.audio_buffer)
        self.audio_buffer = bytearray()
        self.chunk_count = 0
        self.speech_chunks = 0

        if len(audio_data) < 16000:  # Moins de 0.5s - trop court
            logger.warning(f"Audio trop court ({len(audio_data)} bytes), ignore")
            await self.send_json({"type": "status", "value": "idle"})
            return

        await self.send_json({"type": "status", "value": "processing"})
        wav_path = await self._pcm_to_wav(audio_data)
        try:
            text = await self._transcribe(wav_path)
            logger.info(f"Transcrit: {text!r}")

            # Filtrer les transcriptions parasites courantes
            parasites = ["amara", "sous-titres", "abonnez", "abonner", "merci d avoir",
                        "au revoir", "bonne journee", "a bientot", "!", "...", ""]
            text_lower = text.lower().strip()
            if len(text_lower) < 3 or any(p in text_lower for p in parasites[:6]):
                logger.warning(f"Transcription parasite ignoree: {text!r}")
                await self.send_json({"type": "status", "value": "idle"})
                return

            await self.send_json({"type": "transcript", "text": text})

            if self.waiting_for_followup:
                await self._handle_followup(text)
            else:
                await self._handle_question(text)

        finally:
            if os.path.exists(wav_path):
                os.unlink(wav_path)

    async def _handle_question(self, question: str):
        context = get_context_for_course(question, self.course_id, k=4)
        system = SYSTEM_FORMATEUR
        if context:
            system += f"\n\nCONTEXTE DU COURS:\n{context[:600]}"

        self.conversation_history.append({"role": "user", "content": question})
        messages = [{"role": "system", "content": system}]
        messages += self.conversation_history[-6:]

        answer = llm_chat(messages)
        self.conversation_history.append({"role": "assistant", "content": answer})

        logger.info(f"Reponse: {answer[:100]}")
        await self.send_json({"type": "answer", "text": answer})

        audio = synthesize(answer)
        await self.send_audio(audio)

        self.waiting_for_followup = True
        await self.send_json({"type": "waiting_followup"})

    async def _handle_followup(self, response: str):
        self.waiting_for_followup = False

        messages = [
            {"role": "system", "content": SYSTEM_CONTINUER},
            {"role": "user", "content": response}
        ]
        answer = llm_chat(messages)
        logger.info(f"Suivi: {answer!r}")

        await self.send_json({"type": "answer", "text": answer})
        audio = synthesize(answer)
        await self.send_audio(audio)

        if "reprenons le cours" in answer.lower():
            await asyncio.sleep(0.3)
            await self.send_json({"type": "resume_course"})

        await self.send_json({"type": "status", "value": "idle"})

    async def _transcribe(self, wav_path: str) -> str:
        if settings.STT_PROVIDER == "openai_whisper":
            try:
                from openai import OpenAI
                client = OpenAI(api_key=settings.OPENAI_API_KEY)
                with open(wav_path, "rb") as f:
                    result = client.audio.transcriptions.create(
                        model="whisper-1", file=f, language="fr"
                    )
                return result.text.strip()
            except Exception as e:
                logger.warning(f"OpenAI Whisper echec ({e}), fallback local...")
                # Fallback vers Whisper local
                model = get_local_whisper()
                segments, _ = model.transcribe(
                    wav_path, language=settings.WHISPER_LANGUAGE,
                    beam_size=3, vad_filter=True
                )
                return " ".join(s.text for s in segments).strip()
        else:
            model = get_local_whisper()
            segments, _ = model.transcribe(
                wav_path, language=settings.WHISPER_LANGUAGE,
                beam_size=3, vad_filter=True
            )
            return " ".join(s.text for s in segments).strip()

    async def _pcm_to_wav(self, pcm_bytes: bytes) -> str:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            wav_path = f.name
        with wave.open(wav_path, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(16000)
            wav.writeframes(pcm_bytes)
        return wav_path
