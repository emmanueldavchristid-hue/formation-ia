"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

interface Slide {
  index: number;
  title: string;
  bullets: string[];
  narration: string;
  audio_url: string;
}
interface Course {
  id: string;
  title: string;
  topic: string;
  level: string;
  total_slides: number;
  estimated_duration_min: number;
  slides: Slide[];
}
type State = "idle" | "playing" | "paused" | "listening" | "answering";

const LEVEL_COLORS: Record<string, string> = {
  debutant: "#22c55e",
  intermediaire: "#3b82f6",
  expert: "#8b5cf6",
};

const SLIDE_GRADIENTS = [
  "from-blue-900 to-blue-700",
  "from-indigo-900 to-indigo-700",
  "from-violet-900 to-violet-700",
  "from-slate-900 to-slate-700",
  "from-cyan-900 to-cyan-700",
  "from-teal-900 to-teal-700",
  "from-emerald-900 to-emerald-700",
  "from-sky-900 to-sky-700",
];

export default function CoursePlayer() {
  const { id } = useParams();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [idx, setIdx] = useState(0);
  const [state, setState] = useState<State>("idle");
  const [transcript, setTranscript] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [showNarration, setShowNarration] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    fetch(`http://localhost:8000/api/course/${id}`)
      .then(r => r.json())
      .then(d => { if (d.slides) setCourse(d); else setError("Cours introuvable"); })
      .catch(() => setError("Backend non accessible. Lancez start.sh"));
  }, [id]);

  const slide = course?.slides[idx];
  const progress = course ? ((idx + 1) / course.total_slides) * 100 : 0;
  const gradient = SLIDE_GRADIENTS[idx % SLIDE_GRADIENTS.length];

  function playAudio() {
    if (!slide || !audioRef.current) return;
    audioRef.current.src = `http://localhost:8000${slide.audio_url}`;
    audioRef.current.load();
    audioRef.current.play()
      .then(() => setState("playing"))
      .catch(() => setState("paused"));
  }

  function togglePlay() {
    if (!audioRef.current) return;
    if (state === "playing") {
      audioRef.current.pause();
      setState("paused");
    } else {
      audioRef.current.play()
        .then(() => setState("playing"))
        .catch(() => setState("paused"));
    }
  }

  function goTo(newIdx: number) {
    if (!course) return;
    audioRef.current?.pause();
    setIdx(newIdx);
    setState("idle");
    setAnswer("");
    setTranscript("");
    setShowNarration(false);
  }

  useEffect(() => {
    if (state === "idle" && course) {
      const t = setTimeout(() => playAudio(), 600);
      return () => clearTimeout(t);
    }
  }, [idx, course]);

  async function startListening() {
    if (state === "answering") return;
    audioRef.current?.pause();
    setState("listening");
    setTranscript("");
    setAnswer("");
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recorderRef.current = mr;
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        await processQuestion();
      };
      mr.start();
    } catch { setState("paused"); }
  }

  function stopListening() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  async function processQuestion() {
    setState("answering");
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    if (blob.size < 100) { setState("paused"); return; }
    const form = new FormData();
    form.append("audio", blob, "q.webm");
    form.append("course_id", id as string);
    try {
      const res = await fetch("http://localhost:8000/api/voice", { method: "POST", body: form });
      setTranscript(res.headers.get("X-Question") || "");
      setAnswer(res.headers.get("X-Answer") || "");
      const ab = await res.blob();
      if (ab.size > 100 && audioRef.current) {
        audioRef.current.src = URL.createObjectURL(ab);
        audioRef.current.play().catch(() => {});
        audioRef.current.onended = () => setState("paused");
        setState("playing");
      } else {
        setState("paused");
      }
    } catch { setState("paused"); }
  }

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="text-center">
        <p className="text-red-400 text-xl mb-6">{error}</p>
        <button onClick={() => router.push("/cours")}
          className="bg-blue-600 text-white px-8 py-3 rounded-2xl hover:bg-blue-700">
          Retour
        </button>
      </div>
    </div>
  );

  if (!course) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Chargement du cours...</p>
      </div>
    </div>
  );

  const isLast = idx === course.total_slides - 1;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <button onClick={() => router.push("/cours")}
          className="text-gray-400 hover:text-white text-sm flex items-center gap-2">
          <span>←</span> Cours
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold">{course.title}</p>
          <p className="text-xs text-gray-400">{course.level} · {course.estimated_duration_min} min</p>
        </div>
        <div className="text-sm text-gray-400">{idx + 1} / {course.total_slides}</div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/10">
        <div className="h-1 bg-blue-500 transition-all duration-700"
          style={{ width: `${progress}%` }} />
      </div>

      {/* Slide principale */}
      <div className={`flex-1 bg-gradient-to-br ${gradient} flex flex-col justify-between p-8 md:p-16 min-h-96`}>

        {/* Numero de slide */}
        <div className="flex items-center justify-between mb-8">
          <span className="text-white/40 text-xs font-mono uppercase tracking-widest">
            Slide {slide?.index}
          </span>
          <div className="flex items-center gap-2">
            {state === "playing" && (
              <div className="flex items-center gap-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1 bg-white/60 rounded-full animate-pulse"
                    style={{ height: `${8 + i * 4}px`, animationDelay: `${i * 150}ms` }} />
                ))}
                <span className="text-white/60 text-xs ml-2">Lecture</span>
              </div>
            )}
            {state === "listening" && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400 animate-ping" />
                <span className="text-red-300 text-xs">Ecoute...</span>
              </div>
            )}
            {state === "answering" && (
              <span className="text-yellow-300 text-xs animate-pulse">Traitement...</span>
            )}
          </div>
        </div>

        {/* Titre */}
        <div className="flex-1 flex flex-col justify-center">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-10 leading-tight">
            {slide?.title}
          </h1>

          {/* Bullets */}
          <ul className="space-y-4">
            {slide?.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-4">
                <div className="w-2 h-2 rounded-full bg-white/50 mt-3 flex-shrink-0" />
                <span className="text-white/85 text-lg md:text-xl leading-relaxed">{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Q&R inline sur la slide */}
        {(transcript || answer) && (
          <div className="mt-8 bg-white/10 backdrop-blur rounded-2xl p-5 border border-white/20">
            {transcript && (
              <p className="text-white/60 text-sm mb-2 italic">"{transcript}"</p>
            )}
            {answer && (
              <p className="text-white text-sm leading-relaxed">{answer}</p>
            )}
          </div>
        )}
      </div>

      {/* Miniatures slides (navigation) */}
      <div className="flex gap-2 px-6 py-3 overflow-x-auto bg-gray-900 border-t border-white/10">
        {course.slides.map((s, i) => (
          <button key={i} onClick={() => goTo(i)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs transition-all ${
              i === idx
                ? "bg-blue-600 text-white font-bold"
                : "bg-white/10 text-gray-400 hover:bg-white/20"
            }`}>
            {i + 1}. {s.title.length > 20 ? s.title.slice(0, 20) + "..." : s.title}
          </button>
        ))}
      </div>

      {/* Controles */}
      <div className="bg-gray-900 px-6 py-5 border-t border-white/10">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* Boutons nav + lecture */}
          <div className="flex gap-3">
            <button onClick={() => goTo(idx - 1)} disabled={idx === 0}
              className="flex-1 py-3 rounded-2xl bg-white/10 text-white text-sm hover:bg-white/20 disabled:opacity-20 transition-all">
              ← Prev
            </button>
            <button onClick={togglePlay}
              className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all ${
                state === "playing"
                  ? "bg-orange-500 hover:bg-orange-600 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}>
              {state === "playing" ? "⏸ Pause" : "▶ Lecture"}
            </button>
            {isLast ? (
              <button onClick={() => router.push(`/cours/${id}/quiz`)}
                className="flex-1 py-3 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm transition-all">
                Quiz →
              </button>
            ) : (
              <button onClick={() => goTo(idx + 1)}
                className="flex-1 py-3 rounded-2xl bg-white/10 text-white text-sm hover:bg-white/20 transition-all">
                Suiv →
              </button>
            )}
          </div>

          {/* Bouton micro */}
          <button
            onMouseDown={startListening}
            onMouseUp={stopListening}
            onTouchStart={e => { e.preventDefault(); startListening(); }}
            onTouchEnd={e => { e.preventDefault(); stopListening(); }}
            disabled={state === "answering"}
            className={`w-full py-5 rounded-2xl font-bold text-base transition-all select-none ${
              state === "listening"
                ? "bg-red-500 text-white scale-95"
                : state === "answering"
                ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg"
            }`}>
            {state === "listening"
              ? "🔴 Relacher pour envoyer"
              : state === "answering"
              ? "⏳ Traitement..."
              : "🎙 Maintenir pour poser une question"}
          </button>

          {/* Narration toggle */}
          <button onClick={() => setShowNarration(!showNarration)}
            className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors">
            {showNarration ? "▲ Masquer" : "▼ Voir"} la narration complete
          </button>
          {showNarration && (
            <div className="bg-gray-800 rounded-xl p-4 text-gray-300 text-sm leading-relaxed">
              {slide?.narration}
            </div>
          )}
        </div>
      </div>

      <audio ref={audioRef} onEnded={() => setState("paused")} />
    </div>
  );
}
