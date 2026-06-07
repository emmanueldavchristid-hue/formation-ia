from pydantic_settings import BaseSettings
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent

class Settings(BaseSettings):
    # LLM
    LLM_PROVIDER: str = "ollama"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "mistral"
    OPENAI_API_KEY: str = ""
    GROQ_API_KEY: str = ""          # vide pour l'instant

    # STT
    STT_PROVIDER: str = "faster_whisper"
    WHISPER_MODEL_SIZE: str = "small"
    WHISPER_LANGUAGE: str = "fr"
    DEEPGRAM_API_KEY: str = ""        # vide pour l'instant

    # TTS
    TTS_PROVIDER: str = "gtts"
    TTS_LANGUAGE: str = "fr"
    ELEVENLABS_API_KEY: str = ""      # vide pour l'instant

    # Wake word
    WAKE_WORDS: str = "j'ai une question,question,attends,stop"

    # Chemins
    CHROMA_PATH: str = str(BASE_DIR / "data/vectordb")
    UPLOADS_PATH: str = str(BASE_DIR / "data/uploads")
    OUTPUTS_PATH: str = str(BASE_DIR / "data/outputs")

    # Embedding
    EMBEDDING_MODEL: str = "paraphrase-multilingual-MiniLM-L12-v2"

    @property
    def wake_words_list(self) -> list[str]:
        return [w.strip().lower() for w in self.WAKE_WORDS.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
