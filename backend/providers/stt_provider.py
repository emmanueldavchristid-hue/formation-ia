"""
Couche d'abstraction STT (Speech-to-Text).
Gratuit maintenant  → faster_whisper (local)
Premium plus tard   → deepgram, openai_whisper_api
Changer STT_PROVIDER dans .env suffit.
"""
import tempfile, os
from config import settings

# Chargement lazy du modèle Whisper (seulement si STT_PROVIDER=faster_whisper)
_whisper_model = None

def _get_whisper():
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel
        print(f"⏳ Chargement Whisper '{settings.WHISPER_MODEL_SIZE}'...")
        _whisper_model = WhisperModel(
            settings.WHISPER_MODEL_SIZE,
            device="cpu",
            compute_type="int8"
        )
        print("✅ Whisper prêt")
    return _whisper_model


def _transcribe_faster_whisper(audio_bytes: bytes) -> str:
    model = _get_whisper()
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(audio_bytes)
        tmp = f.name
    try:
        segments, _ = model.transcribe(
            tmp,
            language=settings.WHISPER_LANGUAGE,
            beam_size=5
        )
        return " ".join(s.text for s in segments).strip()
    finally:
        os.unlink(tmp)


def _transcribe_openai(audio_bytes: bytes) -> str:
    from openai import OpenAI
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(audio_bytes)
        tmp = f.name
    try:
        with open(tmp, "rb") as af:
            result = client.audio.transcriptions.create(
                model="whisper-1", file=af, language=settings.WHISPER_LANGUAGE
            )
        return result.text.strip()
    finally:
        os.unlink(tmp)


def transcribe(audio_bytes: bytes) -> str:
    """Point d'entrée unique."""
    if settings.STT_PROVIDER == "openai_whisper":
        return _transcribe_openai(audio_bytes)
    return _transcribe_faster_whisper(audio_bytes)


def contains_wake_word(text: str) -> bool:
    """Détecte si la transcription contient un déclencheur oral."""
    text_lower = text.lower()
    return any(w in text_lower for w in settings.wake_words_list)
