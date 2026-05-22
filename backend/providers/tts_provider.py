import tempfile, os, subprocess
from config import settings

def synthesize(text: str) -> bytes:
    provider = getattr(settings, "TTS_PROVIDER", "gtts")
    if provider == "openai_tts":
        return _openai_tts(text)
    try:
        return _gtts(text)
    except Exception:
        return _espeak(text)

def _openai_tts(text: str) -> bytes:
    from openai import OpenAI
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    response = client.audio.speech.create(
        model="tts-1-hd",
        voice="nova",
        input=text[:4096],
        response_format="mp3"
    )
    return response.content

def _gtts(text: str) -> bytes:
    from gtts import gTTS
    tts = gTTS(text=text[:500], lang="fr", slow=False)
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
        tts.save(f.name); tmp = f.name
    try:
        with open(tmp, "rb") as f: return f.read()
    finally:
        os.unlink(tmp)

def _espeak(text: str) -> bytes:
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        tmp_wav = f.name
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
        tmp_mp3 = f.name
    try:
        subprocess.run(
            ["espeak-ng", "-v", "fr", "-s", "145", "-w", tmp_wav, text[:400]],
            capture_output=True, timeout=30, check=True
        )
        subprocess.run(
            ["ffmpeg", "-i", tmp_wav, tmp_mp3, "-y", "-loglevel", "error"],
            capture_output=True, timeout=30, check=True
        )
        with open(tmp_mp3, "rb") as f: return f.read()
    finally:
        for p in [tmp_wav, tmp_mp3]:
            if os.path.exists(p): os.unlink(p)
