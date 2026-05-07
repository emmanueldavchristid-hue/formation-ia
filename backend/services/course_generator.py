import json, re, os, uuid
from pathlib import Path
from services.rag import get_context_for_course, ingest_file_for_course, list_sources
from providers.llm_provider import generate
from providers.tts_provider import synthesize
from config import settings

_SYSTEM_PLAN = "Tu es un expert en pedagogie. Reponds UNIQUEMENT en JSON valide, sans markdown."
_SYSTEM_NARRATION = "Tu es un formateur expert. Tu parles naturellement en francais. Sois concis (3-5 phrases)."

def _clean_json(raw: str) -> str:
    raw = re.sub(r"```json\s*", "", raw)
    raw = re.sub(r"```\s*", "", raw)
    start = raw.find("{")
    if start == -1: start = raw.find("[")
    return raw[start:].strip() if start != -1 else raw.strip()

def _generate_plan(topic: str, context: str, nb_slides: int) -> dict:
    prompt = f'Cours sur "{topic}". {nb_slides} slides. Contexte: {context[:600]}\nJSON: {{"title":"...","slides":[{{"index":1,"title":"...","bullets":["...","..."]}}]}}'
    raw = generate(prompt, system=_SYSTEM_PLAN)
    try:
        return json.loads(_clean_json(raw))
    except Exception:
        return {
            "title": topic,
            "slides": [
                {"index": i+1, "title": f"Partie {i+1}", "bullets": ["Point cle 1", "Point cle 2", "Point cle 3"]}
                for i in range(nb_slides)
            ]
        }

def _generate_narration(title: str, bullets: list, context: str) -> str:
    bullets_str = ", ".join(bullets)
    prompt = f'Presente en 3 phrases: "{title}". Points: {bullets_str}. Contexte: {context[:400]}'
    return generate(prompt, system=_SYSTEM_NARRATION)

def generate_course(topic: str, level: str = "intermediaire", nb_slides: int = 6,
                    course_id: str = None, files_to_ingest: list = None) -> dict:
    if course_id is None:
        course_id = f"cours_{uuid.uuid4().hex[:8]}"

    output_dir = Path(settings.OUTPUTS_PATH) / course_id
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\nCours : '{topic}' | ID: {course_id}")

    # Contexte isole de ce cours uniquement
    context = get_context_for_course(topic, course_id, k=6)
    if not context:
        context = f"Formation sur le sujet : {topic}"

    print("  Generation du plan...")
    plan = _generate_plan(topic, context, nb_slides)

    slides = []
    for slide_plan in plan.get("slides", []):
        i = slide_plan.get("index", len(slides)+1)
        title = slide_plan.get("title", f"Slide {i}")
        bullets = slide_plan.get("bullets", [])
        print(f"  Slide {i}: {title}")

        slide_ctx = get_context_for_course(title, course_id, k=3)
        narration = _generate_narration(title, bullets, slide_ctx)

        audio_path = None
        try:
            audio_bytes = synthesize(narration)
            audio_file = output_dir / f"slide_{i:02d}.mp3"
            with open(audio_file, "wb") as f:
                f.write(audio_bytes)
            audio_path = str(audio_file)
        except Exception as e:
            print(f"  Audio echoue: {e}")

        slides.append({
            "index": i, "title": title, "bullets": bullets,
            "narration": narration, "audio_path": audio_path,
            "audio_url": f"/api/course/{course_id}/audio/{i}"
        })

    course = {
        "id": course_id, "title": plan.get("title", topic),
        "topic": topic, "level": level,
        "total_slides": len(slides),
        "estimated_duration_min": len(slides) * 3,
        "slides": slides,
        "sources": list_sources(course_id)
    }

    with open(output_dir / "course.json", "w", encoding="utf-8") as f:
        json.dump(course, f, ensure_ascii=False, indent=2)

    print(f"  Cours sauvegarde: {output_dir}")
    return course

def load_course(course_id: str) -> dict | None:
    p = Path(settings.OUTPUTS_PATH) / course_id / "course.json"
    if not p.exists(): return None
    with open(p, encoding="utf-8") as f:
        return json.load(f)

def list_courses() -> list[dict]:
    out = Path(settings.OUTPUTS_PATH)
    courses = []
    if not out.exists(): return courses
    for d in out.iterdir():
        if d.is_dir():
            j = d / "course.json"
            if j.exists():
                with open(j, encoding="utf-8") as f:
                    data = json.load(f)
                courses.append({
                    "id": data.get("id"), "title": data.get("title"),
                    "level": data.get("level"), "total_slides": data.get("total_slides"),
                    "sources": data.get("sources", [])
                })
    return courses
