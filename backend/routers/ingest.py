import shutil, uuid
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form
from services.rag import ingest_file_for_course, list_sources, collection_count
from config import settings

router = APIRouter(prefix="/api", tags=["Ingestion"])

ALLOWED = {
    ".pdf",".pptx",".ppt",".docx",".doc",
    ".txt",".md",".csv",
    ".mp3",".wav",".ogg",".m4a",
    ".mp4",".mkv",".avi",".mov",".webm"
}

@router.post("/ingest")
async def ingest(
    file: UploadFile = File(...),
    course_id: str = Form(default="pending")
):
    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED:
        from fastapi import HTTPException
        raise HTTPException(400, f"Format {suffix} non supporte")

    dest_dir = Path(settings.UPLOADS_PATH) / course_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / file.filename

    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    result = ingest_file_for_course(str(dest), course_id)
    return result

@router.get("/sources/{course_id}")
def get_sources(course_id: str):
    return {
        "course_id": course_id,
        "sources": list_sources(course_id),
        "total_chunks": collection_count(course_id)
    }
