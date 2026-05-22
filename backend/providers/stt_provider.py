import tempfile, os
from config import settings

_whisper_model = None

def get_local_whisper():
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel
        _whisper_model = WhisperModel(
            settings.WHISPER_MODEL_SIZE, device="cpu", compute_type="int8"
        )
    return _whisper_model

def transcribe(audio_bytes: bytes) -> str:
    if settings.STT_PROVIDER == "openai_whisper":
        return _transcribe_openai(audio_bytes)
    return _transcribe_local(audio_bytes)

def _transcribe_openai(audio_bytes: bytes) -> str:
    from openai import OpenAI
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(audio_bytes)
        tmp = f.name
    try:
        with open(tmp, "rb") as f:
            result = client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                language="fr"
            )
        return result.text.strip()
    finally:
        os.unlink(tmp)

def _transcribe_local(audio_bytes: bytes) -> str:
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(audio_bytes)
        tmp = f.name
    try:
        model = get_local_whisper()
        segments, _ = model.transcribe(
            tmp, language=settings.WHISPER_LANGUAGE, beam_size=3, vad_filter=True
        )
        return " ".join(s.text for s in segments).strip()
    finally:
        os.unlink(tmp)

def contains_wake_word(text: str) -> bool:
    text_lower = text.lower()
    return any(w in text_lower for w in settings.wake_words_list)
