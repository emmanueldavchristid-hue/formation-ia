"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FormateurPage() {
  const router = useRouter();
  const [files, setFiles] = useState([]);
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("intermediaire");
  const [nbSlides, setNbSlides] = useState(6);
  const [step, setStep] = useState("upload"); // upload | generating | done
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [courseId] = useState(() => "cours_" + Math.random().toString(36).slice(2, 10));
  const [log, setLog] = useState([]);
  const [courseResult, setCourseResult] = useState(null);
  const [error, setError] = useState("");

  function addLog(msg) {
    setLog(prev => [...prev, msg]);
  }

  async function handleStart() {
    if (!files.length) { setError("Ajoutez au moins un fichier"); return; }
    if (!topic.trim()) { setError("Entrez le sujet du cours"); return; }
    setError("");
    setStep("generating");
    setLog([]);

    // 1. Uploader tous les fichiers
    addLog("Ingestion des documents...");
    const uploaded = [];
    for (const file of files) {
      const form = new FormData();
      form.append("file", file);
      form.append("course_id", courseId);
      try {
        const res = await fetch("http://172.31.6.180:8000/api/ingest", { method: "POST", body: form });
        const data = await res.json();
        if (data.status === "ok") {
          uploaded.push(file.name);
          addLog("  OK : " + file.name + " (" + data.chunks + " chunks)");
        } else {
          addLog("  Erreur : " + file.name + " - " + (data.reason || "echec"));
        }
      } catch {
        addLog("  Erreur reseau : " + file.name);
      }
    }

    if (!uploaded.length) {
      setError("Aucun fichier ingere avec succes");
      setStep("upload");
      return;
    }

    setUploadedFiles(uploaded);

    // 2. Generer le cours
    addLog("Generation du cours en cours (patience ~10 min sur CPU)...");
    try {
      const res = await fetch("http://172.31.6.180:8000/api/course/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          level,
          nb_slides: nbSlides,
          course_id: courseId
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Erreur generation");
        setStep("upload");
        return;
      }
      addLog("Cours genere : " + data.total_slides + " slides");
      setCourseResult(data);
      setStep("done");
    } catch {
      setError("Erreur reseau lors de la generation");
      setStep("upload");
    }
  }

  if (step === "done" && courseResult) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <div className="text-6xl mb-6">🎉</div>
        <h1 className="text-3xl font-bold text-blue-900 mb-3">{courseResult.title}</h1>
        <p className="text-gray-500 mb-8">
          {courseResult.total_slides} slides - duree estimee {courseResult.estimated_duration_min} min
        </p>
        <div className="bg-green-50 rounded-2xl p-4 mb-8 text-left">
          <p className="text-sm font-medium text-green-800 mb-2">Documents utilises :</p>
          {uploadedFiles.map((f, i) => (
            <p key={i} className="text-sm text-green-700">OK {f}</p>
          ))}
        </div>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => router.push("/cours/" + courseResult.id)}
            className="bg-blue-700 text-white px-8 py-4 rounded-2xl text-lg font-bold hover:bg-blue-800"
          >
            Lancer le cours
          </button>
          <button
            onClick={() => { setStep("upload"); setFiles([]); setLog([]); setCourseResult(null); }}
            className="bg-gray-100 text-gray-700 px-6 py-4 rounded-2xl hover:bg-gray-200"
          >
            Nouveau cours
          </button>
        </div>
      </div>
    );
  }

  if (step === "generating") {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold text-blue-900 mb-8 text-center">Generation en cours...</h1>
        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-4 h-4 rounded-full bg-blue-500 animate-pulse" />
            <p className="text-gray-600">Traitement sur votre machine locale</p>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {log.map((l, i) => (
              <p key={i} className="text-sm text-gray-700 font-mono">{l}</p>
            ))}
          </div>
          {log.length === 0 && (
            <p className="text-gray-400 text-sm animate-pulse">Demarrage...</p>
          )}
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">
          Ne fermez pas cette page. Le LLM local peut prendre 10-15 min.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold text-blue-900 mb-2">Creer un cours</h1>
      <p className="text-gray-500 mb-8">Uploadez vos documents et l IA genere un cours complet</p>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-6 text-sm">{error}</div>
      )}

      {/* Zone upload */}
      <div className="bg-white rounded-2xl shadow p-6 mb-6">
        <h2 className="font-semibold text-blue-800 mb-1">1. Vos documents</h2>
        <p className="text-xs text-gray-400 mb-4">PDF, PPTX, DOCX, TXT, MP3, MP4...</p>
        <input
          type="file"
          multiple
          onChange={e => setFiles(Array.from(e.target.files || []))}
          className="block w-full border border-gray-200 rounded-xl p-3 text-sm mb-3"
          accept=".pdf,.pptx,.ppt,.docx,.doc,.txt,.md,.mp3,.wav,.mp4,.mkv"
        />
        {files.length > 0 && (
          <div className="space-y-1">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                <span>📄</span>
                <span>{f.name}</span>
                <span className="text-gray-400 text-xs">({(f.size/1024).toFixed(0)} KB)</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sujet + parametres */}
      <div className="bg-white rounded-2xl shadow p-6 mb-6">
        <h2 className="font-semibold text-blue-800 mb-4">2. Parametres du cours</h2>
        <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="Sujet du cours (ex: Machine Learning, Credit bancaire, KYC...)"
          className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">Niveau</label>
            <select
              value={level}
              onChange={e => setLevel(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-2 text-sm"
            >
              <option value="debutant">Debutant</option>
              <option value="intermediaire">Intermediaire</option>
              <option value="expert">Expert</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">Nombre de slides</label>
            <select
              value={nbSlides}
              onChange={e => setNbSlides(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-xl p-2 text-sm"
            >
              {[3, 4, 5, 6, 8].map(n => (
                <option key={n} value={n}>{n} slides</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <button
        onClick={handleStart}
        disabled={!files.length || !topic.trim()}
        className="w-full bg-blue-700 text-white py-5 rounded-2xl text-lg font-bold hover:bg-blue-800 disabled:opacity-40 transition-all"
      >
        Generer le cours
      </button>
      <p className="text-center text-xs text-gray-400 mt-3">
        Le cours sera genere localement sur votre machine
      </p>
    </div>
  );
}
