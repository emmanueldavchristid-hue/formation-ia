from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import Response
import tempfile, os, subprocess
from providers.stt_provider import transcribe
from providers.tts_provider import synthesize
from services.rag import get_context_for_course
from providers.llm_provider import chat as llm_chat

router = APIRouter(prefix="/api", tags=["Voice"])

def ascii_safe(s: str) -> str:
    return s.encode("ascii", errors="replace").decode("ascii")

def convert_to_wav(input_bytes: bytes) -> bytes:
    with tempfile.NamedTemporaryFile(suffix=".input", delete=False) as fin:
        fin.write(input_bytes)
        input_path = fin.name
    output_path = input_path + ".wav"
    try:
        subprocess.run(
            ["ffmpeg", "-i", input_path, "-ar", "16000", "-ac", "1",
             "-acodec", "pcm_s16le", output_path, "-y", "-loglevel", "error"],
            capture_output=True, timeout=30, check=True
        )
        with open(output_path, "rb") as f:
            return f.read()
    finally:
        for p in [input_path, output_path]:
            if os.path.exists(p): os.unlink(p)

@router.post("/voice")
async def voice_chat(
    audio: UploadFile = File(...),
    course_id: str = Form(default="global")
):
    audio_bytes = await audio.read()

    if not audio_bytes or len(audio_bytes) < 500:
        msg = "Pas de son recu"
        return Response(content=synthesize(msg), media_type="audio/mpeg",
                       headers={"X-Question": "", "X-Answer": ascii_safe(msg)})

    try:
        wav_bytes = convert_to_wav(audio_bytes)
    except Exception as e:
        print(f"Conversion error: {e}")
        wav_bytes = audio_bytes

    try:
        question = transcribe(wav_bytes).strip()
        print(f"Transcrit [{course_id}]: {question!r}")
    except Exception as e:
        print(f"Whisper error: {e}")
        question = ""

    if not question or len(question) < 3:
        msg = "Je n ai pas compris. Repetez svp."
        return Response(content=synthesize(msg), media_type="audio/mpeg",
                       headers={"X-Question": "", "X-Answer": ascii_safe(msg)})

    # Contexte ISOLE du cours en cours
    context = get_context_for_course(question, course_id, k=3)
    system = f"Tu es un assistant formateur. Reponds en francais en 2-3 phrases sur le sujet du cours uniquement." + (f"\n\nCONTEXTE DU COURS:\n{context[:500]}" if context else "")

    try:
        answer = llm_chat([
            {"role": "system", "content": system},
            {"role": "user", "content": question}
        ])
        sentences = [s.strip() for s in answer.split(".") if s.strip()]
        answer = ". ".join(sentences[:3]) + "."
    except Exception:
        answer = "Erreur de traitement."

    try:
        audio_resp = synthesize(answer)
    except Exception:
        audio_resp = b""

    return Response(
        content=audio_resp, media_type="audio/mpeg",
        headers={
            "X-Question": ascii_safe(question[:150]),
            "X-Answer": ascii_safe(answer[:150]),
            "X-Wake-Word": "false"
        }
    )

@router.post("/tts")
async def tts(text: str):
    return Response(content=synthesize(text[:400]), media_type="audio/mpeg")
