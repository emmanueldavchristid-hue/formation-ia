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
    category: str = "General"  # ex: Banque, Conformite, RH, Informatique...

@router.post("/course/generate")
def generate(req: CourseRequest):
    if req.nb_slides < 2 or req.nb_slides > 15:
        raise HTTPException(400, "nb_slides doit etre entre 2 et 15")
    course = generate_course(req.topic, req.level, req.nb_slides, req.course_id, req.category)
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

@router.delete("/course/{course_id}")
def delete_course(course_id: str):
    import shutil
    course_dir = Path("../data/outputs") / course_id
    if course_dir.exists():
        shutil.rmtree(course_dir)
    return {"status": "deleted", "id": course_id}

import json as json_lib
from pathlib import Path as PathLib

ASSIGNMENTS_FILE = PathLib("../data/assignments.json")

def _load_assignments():
    if not ASSIGNMENTS_FILE.exists():
        return {}
    with open(ASSIGNMENTS_FILE) as f:
        return json_lib.load(f)

def _save_assignments(data):
    ASSIGNMENTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(ASSIGNMENTS_FILE, "w") as f:
        json_lib.dump(data, f, indent=2)

@router.post("/course/{course_id}/assign/{username}")
def assign_course(course_id: str, username: str):
    """Admin assigne un cours a un utilisateur."""
    assignments = _load_assignments()
    if username not in assignments:
        assignments[username] = []
    if course_id not in assignments[username]:
        assignments[username].append(course_id)
    _save_assignments(assignments)
    return {"status": "ok", "username": username, "course_id": course_id}

@router.delete("/course/{course_id}/assign/{username}")
def unassign_course(course_id: str, username: str):
    """Admin retire un cours d un utilisateur."""
    assignments = _load_assignments()
    if username in assignments and course_id in assignments[username]:
        assignments[username].remove(course_id)
    _save_assignments(assignments)
    return {"status": "ok"}

@router.get("/courses/user/{username}")
def get_user_courses(username: str):
    """Cours assignes a un utilisateur specifique."""
    assignments = _load_assignments()
    course_ids = assignments.get(username, [])
    from services.course_generator import load_course
    courses = []
    for cid in course_ids:
        c = load_course(cid)
        if c:
            courses.append({
                "id": c["id"], "title": c["title"],
                "category": c.get("category", "General"),
                "total_slides": c["total_slides"],
                "estimated_duration_min": c.get("estimated_duration_min", 0)
            })
    return {"courses": courses}

@router.get("/assignments")
def get_all_assignments():
    """Toutes les assignations (pour admin)."""
    return _load_assignments()


@router.get("/course/{course_id}/transition/{slide_index}")
def get_transition(course_id: str, slide_index: int):
    from fastapi.responses import FileResponse
    trans_file = Path("../data/outputs") / course_id / f"transition_{slide_index:02d}.mp3"
    if not trans_file.exists():
        raise HTTPException(404, "Transition introuvable")
    return FileResponse(str(trans_file), media_type="audio/mpeg")

@router.get("/course/{course_id}/intro")
def get_intro(course_id: str):
    from fastapi.responses import FileResponse
    intro_file = Path("../data/outputs") / course_id / "intro.mp3"
    if not intro_file.exists():
        raise HTTPException(404, "Intro introuvable")
    return FileResponse(str(intro_file), media_type="audio/mpeg")
