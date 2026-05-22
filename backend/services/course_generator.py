import json, re, os, uuid
from pathlib import Path
from services.rag import get_context_for_course, list_sources
from providers.llm_provider import generate, chat
from providers.tts_provider import synthesize
from config import settings

_SYSTEM_PLAN = """Tu es un expert en ingenierie pedagogique de haut niveau.
Tu crees des plans de cours exhaustifs, structures et pedagogiquement solides.
Reponds UNIQUEMENT en JSON valide, sans markdown."""

_SYSTEM_NARRATION = """Tu es un formateur expert, dynamique et engageant.
Style : professionnel, naturel, comme si tu parlais directement a l apprenant.
Tu varies les phrases, utilises des exemples concrets, des analogies.
Tu ponctues avec des transitions naturelles entre les idees.
Chaque narration dure environ 2-3 minutes a l oral (250-350 mots).
IMPORTANT: Pas de "slide", pas de "point", parle directement du contenu."""

_SYSTEM_INTRO = """Tu es un formateur expert et chaleureux.
Tu ecris une introduction orale de bienvenue pour un cours.
Style naturel, engageant, qui donne envie d apprendre."""

def _clean_json(raw):
    raw = re.sub(r"```[a-z]*", "", raw).strip()
    start = raw.find("{")
    if start == -1: start = raw.find("[")
    end = raw.rfind("}")
    if end == -1: end = raw.rfind("]")
    if start == -1: return raw
    return raw[start:end+1].strip()

def _generate_plan(topic, context):
    prompt = f"""Cree un plan de cours COMPLET et EXHAUSTIF sur : "{topic}".

Contexte documentaire (base ta structure dessus) :
{context[:2000]}

Instructions :
- Entre 8 et 12 slides selon la complexite du sujet
- Chaque slide doit avoir 3-5 points cles SUBSTANTIELS et INFORMATIFS (pas vagues)
- Les points doivent etre des phrases completes avec du contenu reel
- Progression logique : introduction → fondamentaux → approfondissement → applications → synthese
- Titre du cours : precis et professionnel

JSON uniquement :
{{"title": "Titre precis du cours", "description": "Description en 1 phrase", "slides": [{{"index": 1, "title": "Titre slide", "bullets": ["Point detaille 1 avec contenu reel", "Point detaille 2", "Point detaille 3"]}}]}}"""

    raw = generate(prompt, system=_SYSTEM_PLAN)
    cleaned = _clean_json(raw)
    try:
        data = json.loads(cleaned)
        if "slides" in data and len(data["slides"]) >= 4:
            return data
    except Exception:
        pass
    return None

def _generate_narration(title, bullets, context, slide_index, total_slides):
    bullets_str = "\n".join(f"- {b}" for b in bullets)
    position = "introduction" if slide_index == 1 else ("conclusion" if slide_index == total_slides else "developpement")

    prompt = f"""Tu presentes oralement la partie "{title}" d un cours.
Position dans le cours : {position} (slide {slide_index}/{total_slides})

Points a couvrir en profondeur :
{bullets_str}

Contexte documentaire disponible :
{context[:800]}

Ecris la narration orale complete (250-350 mots).
- Commence par une phrase d accroche liee au titre
- Couvre chaque point avec des exemples concrets
- {"Commence par accueillir l apprenant et presenter le cours" if slide_index == 1 else ""}
- {"Termine par une synthese et encourage l apprenant" if slide_index == total_slides else "Termine par une transition vers la suite"}
- Style naturel de formateur oral, pas de liste
"""
    return generate(prompt, system=_SYSTEM_NARRATION)

def _generate_course_intro(title, description, nb_slides):
    prompt = f"""Tu introduces oralement le cours "{title}".
Description : {description}
Le cours comporte {nb_slides} parties.

Ecris une introduction de bienvenue (80-100 mots) :
- Accueille chaleureusement l apprenant
- Presente rapidement ce qu il va apprendre
- Donne-lui envie de suivre le cours
- Termine par "Commençons !"
Style naturel et motivant."""
    return generate(prompt, system=_SYSTEM_INTRO)


def _generate_transition(current_title, next_title, current_index, total):
    """Genere une phrase de transition entre deux slides."""
    prompt = (
        f'Tu termines la partie "{current_title}" et tu introduis "{next_title}".\n'
        f'Ecris UNE SEULE phrase de transition naturelle et fluide (20-30 mots max).\n'
        f'Style oral de formateur. Pas de "slide", pas de "partie".\n'
        f'Exemple : "Maintenant que nous avons vu X, explorons ensemble Y."'
    )
    return generate(prompt, system="Tu es un formateur expert. Reponds en une seule phrase.")

def generate_course(topic, level="intermediaire", nb_slides=8, course_id=None, category="General"):
    if course_id is None:
        course_id = f"cours_{uuid.uuid4().hex[:8]}"

    output_dir = Path(settings.OUTPUTS_PATH) / course_id
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n🎓 Cours : {topic!r} | ID: {course_id}")

    # Contexte RAG
    context = get_context_for_course(topic, course_id, k=10)
    if not context:
        context = f"Formation sur : {topic}"
        print("  ⚠️  Aucun document source — cours genere sans RAG")
    else:
        print(f"  ✅ {len(context)} chars de contexte RAG")

    # Plan
    print("  📋 Generation du plan avec GPT-4o...")
    plan = _generate_plan(topic, context)

    if not plan:
        print("  ⚠️  Plan fallback")
        plan = {
            "title": topic,
            "description": f"Formation complete sur {topic}",
            "slides": [
                {"index": i+1, "title": f"Partie {i+1} : {topic}", "bullets": ["Concepts fondamentaux", "Applications pratiques", "Points cles a retenir"]}
                for i in range(6)
            ]
        }

    slides_plan = plan.get("slides", [])
    total = len(slides_plan)
    print(f"  ✅ Plan : {total} slides")

    # Introduction vocale du cours
    print("  🎙️  Generation intro vocale...")
    intro_text = _generate_course_intro(
        plan.get("title", topic),
        plan.get("description", ""),
        total
    )
    try:
        intro_audio = synthesize(intro_text)
        intro_file = output_dir / "intro.mp3"
        with open(intro_file, "wb") as f:
            f.write(intro_audio)
        print(f"  ✅ Intro audio ({len(intro_audio)} bytes)")
    except Exception as e:
        print(f"  ⚠️  Intro audio echec: {e}")
        intro_file = None

    # Slides
    slides = []
    for slide_plan in slides_plan:
        i = slide_plan.get("index", len(slides)+1)
        title = slide_plan.get("title", f"Partie {i}")
        bullets = slide_plan.get("bullets", [])
        print(f"  📝 Slide {i}/{total}: {title}")

        # Contexte specifique
        slide_ctx = get_context_for_course(
            title + " " + " ".join(bullets[:2]),
            course_id, k=5
        )

        # Narration
        narration = _generate_narration(title, bullets, slide_ctx or context[:800], i, total)

        # Audio TTS
        audio_path = None
        try:
            audio_bytes = synthesize(narration)
            audio_file = output_dir / f"slide_{i:02d}.mp3"
            with open(audio_file, "wb") as f:
                f.write(audio_bytes)
            audio_path = str(audio_file)
            print(f"    🔊 Audio OK ({len(audio_bytes)} bytes)")
        except Exception as e:
            print(f"    ⚠️  Audio echec: {e}")

        # Transition vers la slide suivante
        transition_text = ""
        transition_audio_path = None
        slides_plan_list = slides_plan if isinstance(slides_plan, list) else plan.get("slides", [])
        if i < len(slides_plan_list):
            next_slide = next((s for s in slides_plan_list if s.get("index", 0) == i + 1), None)
            if next_slide:
                print(f"    🔄 Transition vers slide {i+1}...")
                transition_text = _generate_transition(title, next_slide.get("title", ""), i, total)
                try:
                    trans_audio = synthesize(transition_text)
                    trans_file = output_dir / f"transition_{i:02d}.mp3"
                    with open(trans_file, "wb") as f:
                        f.write(trans_audio)
                    transition_audio_path = str(trans_file)
                    print(f"    ✅ Transition OK")
                except Exception as e:
                    print(f"    ⚠️  Transition audio echec: {e}")

        slides.append({
            "index": i,
            "title": title,
            "bullets": bullets,
            "narration": narration,
            "audio_path": audio_path,
            "audio_url": f"/api/course/{course_id}/audio/{i}",
            "transition_text": transition_text,
            "transition_url": f"/api/course/{course_id}/transition/{i}" if transition_audio_path else None
        })

    estimated_min = total * 3
    course = {
        "id": course_id,
        "title": plan.get("title", topic),
        "description": plan.get("description", ""),
        "topic": topic,
        "category": category,
        "total_slides": len(slides),
        "estimated_duration_min": estimated_min,
        "has_intro": intro_file is not None,
        "slides": slides,
        "sources": list_sources(course_id)
    }

    with open(output_dir / "course.json", "w", encoding="utf-8") as f:
        json.dump(course, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Cours termine : {len(slides)} slides, ~{estimated_min} min")
    return course

def load_course(course_id):
    p = Path(settings.OUTPUTS_PATH) / course_id / "course.json"
    if not p.exists(): return None
    with open(p, encoding="utf-8") as f:
        return json.load(f)

def list_courses():
    out = Path(settings.OUTPUTS_PATH)
    if not out.exists(): return []
    courses = []
    for d in out.iterdir():
        if d.is_dir():
            j = d / "course.json"
            if j.exists():
                with open(j, encoding="utf-8") as f:
                    data = json.load(f)
                courses.append({
                    "id": data.get("id"),
                    "title": data.get("title"),
                    "description": data.get("description", ""),
                    "category": data.get("category", "General"),
                    "total_slides": data.get("total_slides"),
                    "estimated_duration_min": data.get("estimated_duration_min", 0),
                })
    return courses
