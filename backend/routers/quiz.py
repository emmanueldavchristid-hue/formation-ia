from fastapi import APIRouter
from pydantic import BaseModel
from pathlib import Path
from services.quiz_generator import generate_quiz
from config import settings
import json

router = APIRouter(prefix="/api", tags=["Quiz"])

class QuizRequest(BaseModel):
    topic: str
    nb_questions: int = 5
    course_id: str = "global"

@router.post("/quiz/generate")
def generate(req: QuizRequest):
    # Verifier si le quiz existe deja pour ce cours
    quiz_file = Path(settings.OUTPUTS_PATH) / req.course_id / "quiz.json"

    if quiz_file.exists():
        with open(quiz_file, encoding="utf-8") as f:
            saved = json.load(f)
        print(f"Quiz existant charge pour {req.course_id}")
        return {"topic": req.topic, "questions": saved, "total": len(saved)}

    # Generer un nouveau quiz
    questions = generate_quiz(req.topic, req.nb_questions, req.course_id)

    # Sauvegarder pour reutilisation
    quiz_file.parent.mkdir(parents=True, exist_ok=True)
    with open(quiz_file, "w", encoding="utf-8") as f:
        json.dump(questions, f, ensure_ascii=False, indent=2)

    return {"topic": req.topic, "questions": questions, "total": len(questions)}
