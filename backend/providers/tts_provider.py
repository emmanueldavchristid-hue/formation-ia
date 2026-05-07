"""
Couche d'abstraction TTS (Text-to-Speech).
Gratuit maintenant  → gTTS (Google, nécessite internet) ou pyttsx3 (offline)
Premium plus tard   → ElevenLabs, OpenAI TTS
Changer TTS_PROVIDER dans .env suffit.
"""
import tempfile, os
from config import settings


def _synthesize_gtts(text: str) -> bytes:
    from gtts import gTTS
    tts = gTTS(text=text, lang=settings.TTS_LANGUAGE, slow=False)
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
        tts.save(f.name)
        tmp = f.name
    try:
        with open(tmp, "rb") as f:
            return f.read()
    finally:
        os.unlink(tmp)


def _synthesize_pyttsx3(text: str) -> bytes:
    """100% offline, voix robotique mais sans internet."""
    import pyttsx3, wave, io
    engine = pyttsx3.init()
    engine.setProperty("rate", 160)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        tmp = f.name
    engine.save_to_file(text, tmp)
    engine.runAndWait()
    with open(tmp, "rb") as f:
        data = f.read()
    os.unlink(tmp)
    return data


def _synthesize_openai(text: str) -> bytes:
    from openai import OpenAI
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    response = client.audio.speech.create(
        model="tts-1", voice="nova", input=text
    )
    return response.content


def _synthesize_elevenlabs(text: str) -> bytes:
    from elevenlabs.client import ElevenLabs
    client = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY)
    audio = client.generate(text=text, voice="Rachel", model="eleven_multilingual_v2")
    return b"".join(audio)


def synthesize(text: str) -> bytes:
    """Point d'entrée unique → retourne des bytes audio (MP3 ou WAV)."""
    provider = settings.TTS_PROVIDER
    if provider == "openai_tts":
        return _synthesize_openai(text)
    if provider == "elevenlabs":
        return _synthesize_elevenlabs(text)
    if provider == "pyttsx3":
        return _synthesize_pyttsx3(text)
    return _synthesize_gtts(text)
