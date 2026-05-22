from fastapi import APIRouter
from pydantic import BaseModel
from pathlib import Path
import json

router = APIRouter(prefix="/api/progress", tags=["Progress"])

PROGRESS_FILE = Path("../data/progress.json")

def load_progress():
    if not PROGRESS_FILE.exists():
        return {}
    with open(PROGRESS_FILE) as f:
        return json.load(f)

def save_progress(data):
    PROGRESS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(PROGRESS_FILE, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

class ProgressUpdate(BaseModel):
    username: str
    course_id: str
    slide_index: int
    total_slides: int
    completed: bool = False
    quiz_score: int = -1  # -1 = pas encore fait

@router.post("/update")
def update_progress(req: ProgressUpdate):
    data = load_progress()
    key = f"{req.username}:{req.course_id}"
    if key not in data:
        data[key] = {
            "username": req.username,
            "course_id": req.course_id,
            "slide_index": req.slide_index,
            "total_slides": req.total_slides,
            "completed": req.completed,
            "quiz_score": req.quiz_score,
            "last_seen": __import__("datetime").datetime.now().isoformat()
        }
    else:
        data[key]["slide_index"] = max(data[key]["slide_index"], req.slide_index)
        data[key]["last_seen"] = __import__("datetime").datetime.now().isoformat()
        if req.completed:
            data[key]["completed"] = True
        if req.quiz_score >= 0:
            data[key]["quiz_score"] = req.quiz_score
    save_progress(data)
    return {"status": "ok"}

@router.get("/user/{username}")
def get_user_progress(username: str):
    data = load_progress()
    user_data = {k: v for k, v in data.items() if v["username"] == username}
    return {"progress": list(user_data.values())}

@router.get("/admin/all")
def get_all_progress():
    """Vue admin — toutes les progressions."""
    data = load_progress()
    from services.auth import _load_users
    users = _load_users()
    apprenants = [u for u, d in users.items() if d["role"] == "user"]
    
    from services.course_generator import list_courses
    courses = {c["id"]: c["title"] for c in list_courses()}
    
    result = []
    for username in apprenants:
        user_courses = []
        for course_id, title in courses.items():
            key = f"{username}:{course_id}"
            if key in data:
                p = data[key]
                pct = round((p["slide_index"] / max(p["total_slides"], 1)) * 100)
                user_courses.append({
                    "course_id": course_id,
                    "course_title": title,
                    "progress_pct": pct,
                    "completed": p["completed"],
                    "quiz_score": p["quiz_score"],
                    "last_seen": p["last_seen"]
                })
            else:
                user_courses.append({
                    "course_id": course_id,
                    "course_title": title,
                    "progress_pct": 0,
                    "completed": False,
                    "quiz_score": -1,
                    "last_seen": None
                })
        full_name = users.get(username, {}).get("full_name", username)
        result.append({
            "username": username,
            "full_name": full_name,
            "courses": user_courses
        })
    return {"apprenants": result}
