"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

interface Question {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

export default function QuizPage() {
  const { id } = useParams();
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [status, setStatus] = useState<"loading"|"ready"|"done">("loading");
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string|null>(null);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [topic, setTopic] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`http://172.31.6.180:8000/api/course/${id}`)
      .then(r => r.json())
      .then(course => {
        setTopic(course.topic || course.title || "ce cours");
        return fetch("http://172.31.6.180:8000/api/quiz/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: course.topic || course.title,
            nb_questions: 5,
            course_id: id
          })
        });
      })
      .then(r => r.json())
      .then(data => {
        if (!data.questions || !data.questions.length) {
          setError("Impossible de generer le quiz");
          return;
        }
        // Melanger l ordre des questions (meme quiz, ordre different)
        const shuffled = [...data.questions].sort(() => Math.random() - 0.5);
        setQuestions(shuffled);
        setStatus("ready");
      })
      .catch(() => setError("Erreur de connexion au backend"));
  }, [id]);

  const q = questions[current];
  const score = answers.filter(Boolean).length;
  const percent = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
  const passed = percent >= 80;
  // Envoyer le score au backend
  if (typeof window !== "undefined") {
    const username = localStorage.getItem("username") || "";
    if (username) {
      fetch(`http://${window.location.hostname}:8000/api/progress/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          course_id: id,
          slide_index: questions.length,
          total_slides: questions.length,
          completed: passed,
          quiz_score: percent
        })
      }).catch(() => {});
    }
  }
  // Marquer le cours comme termine si reussi
  if (passed && typeof window !== "undefined") {
    const done = JSON.parse(localStorage.getItem("completed_courses") || "[]");
    if (!done.includes(id)) {
      done.push(id);
      localStorage.setItem("completed_courses", JSON.stringify(done));
    }
  }

  function selectAnswer(opt: string) {
    if (selected !== null) return;
    setSelected(opt);
    setAnswers(prev => [...prev, opt === q.answer]);
  }

  function next() {
    if (current < questions.length - 1) {
      setCurrent(c => c + 1);
      setSelected(null);
    } else {
      setStatus("done");
    }
  }

  // LOADING
  if (status === "loading" && !error) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"/>
        <p className="text-white text-lg font-semibold mb-2">Preparation du quiz...</p>
        <p className="text-gray-400 text-sm">Le LLM genere vos questions</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-400 text-xl mb-6">{error}</p>
        <button onClick={() => router.push(localStorage.getItem("role") === "admin" ? "/admin" : "/apprenant")}
          className="bg-blue-600 text-white px-8 py-3 rounded-2xl">
          Retour au cours
        </button>
      </div>
    </div>
  );

  // RESULTATS
  if (status === "done") {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="max-w-lg w-full text-center">
          <div className="text-7xl mb-6">{passed ? "🏆" : "📚"}</div>
          <h1 className="text-4xl font-bold mb-3">
            {passed ? "Formation terminee !" : "Pas encore..."}
          </h1>
          <p className="text-gray-400 mb-8 text-lg">
            {passed
              ? "Vous avez valide cette formation avec succes"
              : "Il vous faut 80% pour valider. Repassez le cours."}
          </p>

          {/* Score */}
          <div className="bg-white/10 rounded-3xl p-8 mb-8">
            <div className={`text-6xl font-bold mb-2 ${passed ? "text-green-400" : "text-orange-400"}`}>
              {percent}%
            </div>
            <p className="text-gray-400 mb-4">{score} / {questions.length} bonnes reponses</p>
            <div className="w-full bg-white/20 rounded-full h-3">
              <div className={`h-3 rounded-full transition-all duration-1000 ${passed ? "bg-green-500" : "bg-orange-500"}`}
                style={{ width: `${percent}%` }}/>
            </div>
            <p className="text-sm text-gray-500 mt-2">Seuil de validation : 80%</p>
          </div>

          {/* Detail */}
          <div className="space-y-2 mb-8 text-left">
            {answers.map((ok, i) => (
              <div key={i} className="flex items-start gap-3 bg-white/5 rounded-xl px-4 py-3">
                <span className="text-lg flex-shrink-0">{ok ? "✅" : "❌"}</span>
                <span className="text-sm text-gray-300">{questions[i]?.question.slice(0, 80)}...</span>
              </div>
            ))}
          </div>

          {passed ? (
            <button onClick={() => router.push(localStorage.getItem("role") === "admin" ? "/admin" : "/apprenant")}
              className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700">
              Voir mes formations
            </button>
          ) : (
            <div className="flex gap-3">
              <button onClick={() => router.push(localStorage.getItem("role") === "admin" ? "/admin" : "/apprenant")}
                className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700">
                Revoir le cours
              </button>
              <button onClick={() => {
                setCurrent(0);
                setSelected(null);
                setAnswers([]);
                setQuestions(prev => [...prev].sort(() => Math.random() - 0.5));
                setStatus("ready");
              }}
                className="flex-1 py-4 bg-white/10 text-white rounded-2xl hover:bg-white/20">
                Retenter le quiz
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // QUIZ EN COURS
  const progress = (current / questions.length) * 100;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <button onClick={() => router.push(localStorage.getItem("role") === "admin" ? "/admin" : "/apprenant")}
          className="text-gray-400 hover:text-white text-sm">
          ← Cours
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold">Evaluation</p>
          <p className="text-xs text-gray-400">{topic}</p>
        </div>
        <span className="text-sm text-gray-400">{current + 1}/{questions.length}</span>
      </div>

      {/* Progress */}
      <div className="h-1 bg-white/10">
        <div className="h-1 bg-green-500 transition-all" style={{ width: `${progress}%` }}/>
      </div>

      <div className="flex-1 flex flex-col justify-center p-6 max-w-2xl mx-auto w-full">
        {/* Question */}
        <div className="mb-8">
          <p className="text-xs text-green-400 font-mono uppercase tracking-widest mb-4">
            Question {current + 1} sur {questions.length}
          </p>
          <h2 className="text-2xl font-bold leading-relaxed">{q?.question}</h2>
        </div>

        {/* Options */}
        <div className="space-y-3 mb-6">
          {q?.options.map((opt, i) => {
            let cls = "bg-white/10 border border-white/20 hover:bg-white/20 cursor-pointer";
            if (selected !== null) {
              if (opt === q.answer) cls = "bg-green-500/30 border border-green-400 cursor-default";
              else if (opt === selected) cls = "bg-red-500/30 border border-red-400 cursor-default";
              else cls = "bg-white/5 border border-white/10 opacity-40 cursor-default";
            }
            return (
              <button key={i} onClick={() => selectAnswer(opt)}
                className={`w-full text-left px-5 py-4 rounded-2xl transition-all ${cls}`}>
                <span className="text-gray-400 text-sm mr-3">{String.fromCharCode(65+i)}.</span>
                {opt.replace(/^[A-D]\)\s*/, "")}
              </button>
            );
          })}
        </div>

        {/* Explication */}
        {selected && q?.explanation && (
          <div className={`rounded-2xl p-4 mb-6 text-sm border ${
            selected === q.answer
              ? "bg-green-500/10 border-green-500/30 text-green-200"
              : "bg-red-500/10 border-red-500/30 text-red-200"
          }`}>
            <p className="font-bold mb-1">{selected === q.answer ? "Correct !" : `Incorrect — Bonne reponse : ${q.answer.replace(/^[A-D]\)\s*/, "")}`}</p>
            <p className="opacity-80">{q.explanation}</p>
          </div>
        )}

        {/* Suivant */}
        {selected && (
          <button onClick={next}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700">
            {current < questions.length - 1 ? "Question suivante →" : "Voir mes resultats"}
          </button>
        )}
      </div>
    </div>
  );
}
