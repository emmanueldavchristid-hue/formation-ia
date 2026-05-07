from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from routers import ingest, chat, voice, course, quiz

app = FastAPI(
    title="🎓 IA Formation Bancaire",
    description="Assistant IA 100% local pour la formation bancaire",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Question", "X-Answer", "X-Wake-Word"]
)

# Servir les fichiers audio générés
outputs_path = Path(__file__).parent.parent / "data/outputs"
outputs_path.mkdir(parents=True, exist_ok=True)
app.mount("/outputs", StaticFiles(directory=str(outputs_path)), name="outputs")

# Tous les routers
app.include_router(ingest.router)
app.include_router(chat.router)
app.include_router(voice.router)
app.include_router(course.router)
app.include_router(quiz.router)

@app.get("/", tags=["🔍 Health"])
def root():
    return {
        "status": "🟢 opérationnel",
        "version": "1.0.0",
        "stack": {
            "llm": "phi3:mini (Ollama local)",
            "stt": "faster-whisper (local)",
            "tts": "gTTS (gratuit)",
            "vectordb": "ChromaDB (local)",
            "embedding": "paraphrase-multilingual-MiniLM (local)"
        },
        "endpoints": {
            "docs": "/docs",
            "ingest": "POST /api/ingest",
            "chat": "POST /api/chat",
            "voice": "POST /api/voice",
            "course": "POST /api/course/generate",
            "quiz": "POST /api/quiz/generate"
        }
    }
