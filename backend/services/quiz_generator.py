import json, re
from providers.llm_provider import generate
from services.rag import get_context_for_course

def _parse(raw):
    raw = raw.strip()
    # Enlever les backticks
    raw = re.sub(r"```[a-z]*", "", raw).strip()
    # Trouver le tableau JSON
    start = raw.find("[")
    end = raw.rfind("]")
    if start == -1 or end == -1:
        return None
    try:
        return json.loads(raw[start:end+1])
    except Exception:
        return None

def _find_answer(answer_raw, options):
    answer_raw = answer_raw.strip()
    for opt in options:
        if answer_raw == opt:
            return opt
    letter = answer_raw.upper().replace(")", "").replace(".", "").strip()[0:1]
    letter_map = {"A": 0, "B": 1, "C": 2, "D": 3}
    if letter in letter_map:
        idx = letter_map[letter]
        if idx < len(options):
            return options[idx]
    return options[0] if options else answer_raw

def generate_quiz(topic, nb_questions=5, course_id="global"):
    # Prompt minimal pour eviter la troncature
    prompt = (
        "Reponds en JSON pur (pas de markdown).\n"
        f"2 questions QCM en francais sur: {topic}\n"
        "[{\"q\":\"question?\",\"o\":[\"A) opt\",\"B) opt\",\"C) opt\",\"D) opt\"],\"a\":\"A) opt\",\"e\":\"explication\"}]"
    )
    system = "JSON uniquement. Pas de markdown. Pas de backticks. En francais."

    raw = generate(prompt, system=system)
    data = _parse(raw)

    questions = []
    if data:
        for item in data:
            q_text = item.get("q") or item.get("question", "")
            opts = item.get("o") or item.get("options", [])
            ans = item.get("a") or item.get("answer", "")
            exp = item.get("e") or item.get("explanation", "")
            if q_text and opts:
                opts = opts[:4]
                questions.append({
                    "question": q_text,
                    "options": opts,
                    "answer": _find_answer(ans, opts),
                    "explanation": exp
                })

    # Si on a des questions mais pas assez, completer avec une 2e generation
    if len(questions) < nb_questions and len(questions) > 0:
        return questions  # On prend ce qu on a

    if not questions:
        return _fallback(topic, min(nb_questions, 3))

    return questions[:nb_questions]

def _fallback(topic, nb):
    return [{"question": f"Qu est-ce que {topic} ?",
             "options": ["A) Une methode d apprentissage automatique",
                         "B) Un langage de programmation",
                         "C) Un systeme de base de donnees",
                         "D) Un protocole reseau"],
             "answer": "A) Une methode d apprentissage automatique",
             "explanation": "Le machine learning est une branche de l IA."}
            for _ in range(nb)]
