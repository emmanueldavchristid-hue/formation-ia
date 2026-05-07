from fastapi import APIRouter
from pydantic import BaseModel
from services.rag import get_context_text
from providers.llm_provider import chat as llm_chat

router = APIRouter(prefix="/api", tags=["💬 Chat"])

class ChatRequest(BaseModel):
    question: str
    history: list = []

@router.post("/chat")
def chat(req: ChatRequest):
    context = get_context_text(req.question, k=5)

    system = """Tu es un assistant formateur bancaire.
RÈGLES STRICTES :
- Réponds UNIQUEMENT à la question posée
- Maximum 4 phrases
- Uniquement en français
- Si hors sujet bancaire, réponds : "Je réponds uniquement aux questions bancaires."
- Ne génère JAMAIS de nouvelles questions"""

    messages = [
        {"role": "system", "content": system + (f"\n\nCONTEXTE:\n{context[:800]}" if context else "")},
    ]
    messages += req.history[-4:]
    messages.append({"role": "user", "content": req.question})
    answer = llm_chat(messages)

    # Couper si trop long (hallucination détectée)
    lines = answer.strip().split("\n")
    clean_lines = [l for l in lines if l.strip() and not l.strip().startswith("QUESTION")]
    answer = "\n".join(clean_lines[:8])

    return {"answer": answer, "context_found": bool(context)}
