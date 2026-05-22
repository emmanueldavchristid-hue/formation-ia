"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useVoiceStream, VoiceStatus } from "../../hooks/useVoiceStream";

interface Slide {
  index: number;
  title: string;
  bullets: string[];
  narration: string;
  audio_url: string;
  transition_url?: string;
  transition_text?: string;
}
interface Course {
  id: string;
  title: string;
  topic: string;
  category: string;
  total_slides: number;
  estimated_duration_min: number;
  has_intro: boolean;
  slides: Slide[];
}

const GRADIENTS = [
  "from-red-950 via-black to-black",
  "from-gray-950 via-black to-red-950",
  "from-black via-red-950 to-black",
  "from-zinc-950 via-black to-black",
  "from-black via-black to-red-950",
  "from-red-900 via-black to-black",
  "from-black via-red-900 to-zinc-950",
  "from-stone-950 via-black to-red-950",
];

export default function CoursePlayer() {
  const { id } = useParams();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [pageError, setPageError] = useState("");
  const [showNarration, setShowNarration] = useState(false);
  const [waitingFollowup, setWaitingFollowup] = useState(false);
  const [introPlayed, setIntroPlayed] = useState(false);
  const courseAudioRef = useRef<HTMLAudioElement>(null);

  // Envoyer la progression au backend
  async function sendProgress(slideIdx: number, completed = false, quizScore = -1) {
    const username = localStorage.getItem("username") || "";
    if (!username) return;
    fetch(`http://${window.location.hostname}:8000/api/progress/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        course_id: id,
        slide_index: slideIdx + 1,
        total_slides: course?.total_slides || 1,
        completed,
        quiz_score: quizScore
      })
    }).catch(() => {});
  }
  const answerAudioRef = useRef<HTMLAudioElement>(null);
  const resumePositionRef = useRef<number>(0);

  const { status: voiceStatus, isRecording, connect, toggleRecording: _toggleRecording } = useVoiceStream({
    courseId: id as string,
    onTranscript: (text) => {
      setTranscript(text);
    },
    onAnswer: (text) => setAiAnswer(text),
    onAudio: (blob) => {
      const url = URL.createObjectURL(blob);
      if (answerAudioRef.current) {
        answerAudioRef.current.src = url;
        answerAudioRef.current.play().catch(() => {});
        answerAudioRef.current.onended = () => URL.revokeObjectURL(url);
      }
    },
    onWaitingFollowup: () => setWaitingFollowup(true),
    onResumeCourse: () => {
      setTranscript("");
      setAiAnswer("");
      setWaitingFollowup(false);
      // Reprendre le cours a la position exacte ou il etait
      setTimeout(() => {
        if (courseAudioRef.current) {
          if (resumePositionRef.current > 0) {
            courseAudioRef.current.currentTime = resumePositionRef.current;
            resumePositionRef.current = 0;
          }
          courseAudioRef.current.play()
            .then(() => setPlaying(true))
            .catch(() => {});
        }
      }, 500);
    },
  });

  useEffect(() => {
    fetch(`http://172.31.6.180:8000/api/course/${id}`)
      .then(r => r.json())
      .then(d => { if (d.slides) setCourse(d); else setPageError("Cours introuvable"); })
      .catch(() => setPageError("Backend non accessible"));
    connect();
  }, [id]);

  // Jouer intro puis slide 1
  useEffect(() => {
    if (!course || introPlayed) return;
    setIntroPlayed(true);
    if (course.has_intro) {
      if (courseAudioRef.current) {
        courseAudioRef.current.src = `http://172.31.6.180:8000/api/course/${id}/intro`;
        courseAudioRef.current.load();
        courseAudioRef.current.play().then(() => setPlaying(true)).catch(() => {
          setTimeout(() => playSlide(0), 500);
        });
        courseAudioRef.current.onended = () => {
          setPlaying(false);
          setTimeout(() => playSlide(0), 300);
        };
      }
    } else {
      setTimeout(() => playSlide(0), 800);
    }
  }, [course]);

  const slide = course?.slides[idx];
  const progress = course ? ((idx + 1) / course.total_slides) * 100 : 0;
  const gradient = GRADIENTS[idx % GRADIENTS.length];
  const isLast = idx === (course?.total_slides ?? 1) - 1;

  function playSlide(slideIdx: number) {
    const s = course?.slides[slideIdx];
    if (!s || !courseAudioRef.current) return;
    courseAudioRef.current.onended = null;
    courseAudioRef.current.src = `http://172.31.6.180:8000${s.audio_url}`;
    courseAudioRef.current.load();
    courseAudioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    // Apres la slide, jouer la transition si elle existe
    courseAudioRef.current.onended = () => {
      setPlaying(false);
      if (!isLast && s.transition_url) {
        playTransitionThenNext(slideIdx, s.transition_url);
      }
    };
  }

  function playTransitionThenNext(currentIdx: number, transitionUrl: string) {
    if (!courseAudioRef.current) return;
    courseAudioRef.current.onended = null;
    courseAudioRef.current.src = `http://172.31.6.180:8000${transitionUrl}`;
    courseAudioRef.current.load();
    courseAudioRef.current.play().then(() => setPlaying(true)).catch(() => {});
    courseAudioRef.current.onended = () => {
      setPlaying(false);
      const nextIdx = currentIdx + 1;
      if (nextIdx < (course?.total_slides ?? 0)) {
        setIdx(nextIdx);
        setShowNarration(false);
        setTimeout(() => playSlide(nextIdx), 300);
      }
    };
  }

  function togglePlay() {
    if (!courseAudioRef.current) return;
    if (playing) {
      courseAudioRef.current.pause();
      setPlaying(false);
    } else {
      courseAudioRef.current.play().then(() => setPlaying(true)).catch(() => {});
    }
  }

  function goTo(newIdx: number) {
    sendProgress(newIdx);
    if (!course) return;
    courseAudioRef.current?.pause();
    courseAudioRef.current && (courseAudioRef.current.onended = null);
    setIdx(newIdx);
    setPlaying(false);
    setTranscript("");
    setAiAnswer("");
    setWaitingFollowup(false);
    setShowNarration(false);
    resumePositionRef.current = 0;
    setTimeout(() => playSlide(newIdx), 400);
  }

  const micLabel = () => {
    if (voiceStatus === "processing") return "⏳ Traitement en cours...";
    if (voiceStatus === "speaking") return "🔊 Formateur IA répond...";
    if (isRecording) return "🔴 Cliquer pour envoyer la question";
    if (waitingFollowup) return "🎙 Cliquer pour répondre ou poser une autre question";
    return "🎙 Cliquer pour poser une question";
  };

  if (pageError) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-400 text-xl mb-6">{pageError}</p>
        <button onClick={() => router.push(localStorage.getItem("role") === "admin" ? "/admin" : "/apprenant")}
          className="bg-red-600 text-white px-8 py-3 rounded-2xl">Retour</button>
      </div>
    </div>
  );

  if (!course) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">

      {/* Header */}
      <div className="bg-black border-b border-red-900/40 px-6 py-3 flex items-center justify-between">
        <button onClick={() => {
          courseAudioRef.current?.pause();
          router.push(localStorage.getItem("role") === "admin" ? "/admin" : "/apprenant");
        }} className="text-gray-600 hover:text-white text-sm transition-colors">← Retour</button>
        <div className="text-center">
          <p className="text-sm font-bold text-white">{course.title}</p>
          <p className="text-xs text-gray-600">{course.category} · {course.estimated_duration_min} min</p>
        </div>
        <span className="text-sm text-gray-600 font-mono">{idx + 1}/{course.total_slides}</span>
      </div>

      {/* Progress */}
      <div className="h-px bg-gray-900">
        <div className="h-px bg-red-600 transition-all duration-700" style={{ width: `${progress}%` }}/>
      </div>

      {/* Slide */}
      <div className={`flex-1 bg-gradient-to-br ${gradient} flex flex-col p-8 md:p-14`}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-red-600 rounded-full"/>
            <span className="text-gray-600 text-xs font-mono uppercase tracking-widest">{slide?.index}/{course.total_slides}</span>
          </div>
          <div className="flex items-center gap-2">
            {playing && voiceStatus === "idle" && !isRecording && (
              <div className="flex items-center gap-1">
                {[0,1,2,3].map(i => (
                  <div key={i} className="w-0.5 bg-white/30 rounded-full animate-pulse"
                    style={{ height: `${6+i*3}px`, animationDelay: `${i*120}ms` }}/>
                ))}
                <span className="text-white/30 text-xs ml-1">Lecture</span>
              </div>
            )}
            {isRecording && <span className="text-red-400 text-xs font-medium animate-pulse">🔴 Enregistrement</span>}
            {voiceStatus === "processing" && <span className="text-yellow-400 text-xs animate-pulse">⏳ Traitement...</span>}
            {voiceStatus === "speaking" && <span className="text-green-400 text-xs animate-pulse">🔊 IA répond</span>}
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-10 leading-tight">{slide?.title}</h1>
          <ul className="space-y-5">
            {slide?.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-4">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-3 flex-shrink-0"/>
                <span className="text-white/80 text-lg md:text-xl leading-relaxed">{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {(transcript || aiAnswer) && (
          <div className="mt-8 bg-black/60 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
            {transcript && (
              <div className="mb-4">
                <p className="text-gray-600 text-xs uppercase tracking-wide mb-1">Votre question</p>
                <p className="text-white/70 italic">"{transcript}"</p>
              </div>
            )}
            {aiAnswer && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-3 bg-red-600 rounded-full"/>
                  <p className="text-red-400 text-xs uppercase tracking-wide">Formateur IA</p>
                </div>
                <p className="text-white leading-relaxed">{aiAnswer}</p>
              </div>
            )}
            {waitingFollowup && (
              <p className="text-gray-500 text-xs mt-3 italic animate-pulse">
                Cliquez sur le bouton micro pour répondre...
              </p>
            )}
          </div>
        )}
      </div>

      {/* Navigation slides */}
      <div className="bg-black border-t border-gray-900 px-4 py-2 overflow-x-auto">
        <div className="flex gap-1.5 min-w-max">
          {course.slides.map((s, i) => (
            <button key={i} onClick={() => goTo(i)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs transition-all ${
                i === idx ? "bg-red-600 text-white font-bold" : "bg-gray-900 text-gray-600 hover:bg-gray-800"
              }`}>
              {i+1}. {s.title.length > 15 ? s.title.slice(0, 15)+"..." : s.title}
            </button>
          ))}
        </div>
      </div>

      {/* Controles */}
      <div className="bg-black border-t border-gray-900 px-6 py-5">
        <div className="max-w-2xl mx-auto space-y-3">
          <div className="flex gap-2">
            <button onClick={() => goTo(idx-1)} disabled={idx===0}
              className="flex-1 py-3 bg-gray-900 text-gray-500 rounded-xl hover:bg-gray-800 disabled:opacity-20 text-sm">← Prev</button>
            <button onClick={togglePlay}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                playing ? "bg-white text-black" : "bg-gray-900 text-white hover:bg-gray-800"}`}>
              {playing ? "⏸ Pause" : "▶ Lecture"}
            </button>
            {isLast ? (
              <button onClick={() => router.push(`/cours/${id}/quiz`)}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700">Quiz →</button>
            ) : (
              <button onClick={() => goTo(idx+1)}
                className="flex-1 py-3 bg-gray-900 text-gray-500 rounded-xl hover:bg-gray-800 text-sm">Suiv →</button>
            )}
          </div>

          {/* Bouton micro - UN CLIC pour activer, UN CLIC pour envoyer */}
          <button
            onClick={() => {
              if (!isRecording) {
                // PAUSE IMMEDIATE du cours
                if (courseAudioRef.current) {
                  resumePositionRef.current = courseAudioRef.current.currentTime;
                  courseAudioRef.current.pause();
                  courseAudioRef.current.onended = null;
                }
                setPlaying(false);
              }
              _toggleRecording();
            }}
            disabled={voiceStatus === "processing" || voiceStatus === "speaking"}
            className={`w-full py-5 rounded-2xl font-bold text-sm transition-all ${
              isRecording
                ? "bg-white text-black shadow-2xl shadow-red-900/30 scale-98"
                : voiceStatus === "processing" || voiceStatus === "speaking"
                ? "bg-gray-900 text-gray-600 cursor-not-allowed"
                : waitingFollowup
                ? "bg-red-900/60 text-white border-2 border-red-500 hover:bg-red-900"
                : "bg-red-600 text-white hover:bg-red-700 shadow-lg"
            }`}>
            {micLabel()}
          </button>

          <button onClick={() => setShowNarration(v => !v)}
            className="w-full text-xs text-gray-700 hover:text-gray-500 py-1">
            {showNarration ? "▲ Masquer narration" : "▼ Voir narration complète"}
          </button>
          {showNarration && (
            <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 text-gray-400 text-sm leading-relaxed">
              {slide?.narration}
            </div>
          )}
        </div>
      </div>

      <audio ref={courseAudioRef} preload="none"/>
      <audio ref={answerAudioRef}/>
    </div>
  );
}
