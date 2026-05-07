from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pathlib import Path
from services.course_generator import generate_course, load_course, list_courses

router = APIRouter(prefix="/api", tags=["Cours"])

class CourseRequest(BaseModel):
    topic: str
    level: str = "intermediaire"
    nb_slides: int = 6
    course_id: str = None

@router.post("/course/generate")
def generate(req: CourseRequest):
    if req.nb_slides < 2 or req.nb_slides > 15:
        raise HTTPException(400, "nb_slides doit etre entre 2 et 15")
    course = generate_course(req.topic, req.level, req.nb_slides, req.course_id)
    return course

@router.get("/course/{course_id}")
def get_course(course_id: str):
    course = load_course(course_id)
    if not course:
        raise HTTPException(404, f"Cours {course_id} introuvable")
    return course

@router.get("/course/{course_id}/audio/{slide_index}")
def get_audio(course_id: str, slide_index: int):
    audio_file = Path("../data/outputs") / course_id / f"slide_{slide_index:02d}.mp3"
    if not audio_file.exists():
        raise HTTPException(404, "Audio introuvable")
    return FileResponse(str(audio_file), media_type="audio/mpeg")

@router.get("/courses")
def get_all_courses():
    return {"courses": list_courses()}
