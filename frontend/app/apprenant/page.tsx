"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../hooks/useAuth";

interface Course {
  id: string;
  title: string;
  level: string;
  total_slides: number;
  category?: string;
}

const LEVEL_COLOR: Record<string, string> = {
  debutant: "text-green-400 bg-green-400/10",
  intermediaire: "text-blue-400 bg-blue-400/10",
  expert: "text-purple-400 bg-purple-400/10"
};

export default function ApprenantPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth("user");
  const [courses, setCourses] = useState<Course[]>([]);
  const [completed, setCompleted] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState("Tous");

  useEffect(() => {
    if (!loading) {
      fetch(`http://172.31.6.180:8000/api/courses/user/${localStorage.getItem("username") || ""}`)
        .then(r => r.json())
        .then(d => setCourses(d.courses || []));
      const done = JSON.parse(localStorage.getItem("completed_courses") || "[]");
      setCompleted(done);
    }
  }, [loading]);

  // Extraire les categories disponibles
  const categories = ["Tous", ...Array.from(new Set(courses.map(c => c.category || "General")))];

  const filtered = courses.filter(c => activeCategory === "Tous" || (c.category || "General") === activeCategory);
  const activeCourses = filtered.filter(c => !completed.includes(c.id));
  const doneCourses = filtered.filter(c => completed.includes(c.id));

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎓</span>
          <div>
            <p className="font-bold">Mes Formations</p>
            <p className="text-gray-400 text-xs">{user?.name}</p>
          </div>
        </div>
        <button onClick={logout} className="text-gray-400 hover:text-white text-sm border border-white/20 px-4 py-2 rounded-xl">
          Deconnexion
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Disponibles", value: courses.filter(c => !completed.includes(c.id)).length, color: "text-blue-400" },
            { label: "Terminees", value: completed.length, color: "text-green-400" },
            { label: "Total", value: courses.length, color: "text-white" },
          ].map((s, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-gray-400 text-sm mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filtres par rubrique */}
        {categories.length > 1 && (
          <div className="flex gap-2 flex-wrap mb-8">
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeCategory === cat
                    ? "bg-blue-600 text-white"
                    : "bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10"
                }`}>
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Cours disponibles */}
        {activeCourses.length > 0 && (
          <div className="mb-8">
            <h2 className="text-base font-semibold text-gray-300 mb-4 uppercase tracking-wide text-xs">
              Formations disponibles
            </h2>
            <div className="grid gap-3">
              {activeCourses.map(c => (
                <div key={c.id}
                  onClick={() => router.push(`/cours/${c.id}`)}
                  className="bg-white/5 border border-white/10 hover:border-blue-500/50 rounded-2xl p-5 flex items-center justify-between cursor-pointer transition-all group">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {c.category && c.category !== "General" && (
                        <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{c.category}</span>
                      )}
                    </div>
                    <h3 className="font-semibold group-hover:text-blue-300 transition-colors">{c.title}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${LEVEL_COLOR[c.level] || "text-gray-400 bg-gray-400/10"}`}>
                        {c.level}
                      </span>
                      <span className="text-gray-500 text-xs">{c.total_slides} slides</span>
                    </div>
                  </div>
                  <div className="bg-blue-600 group-hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors">
                    Commencer →
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cours termines */}
        {doneCourses.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-green-400 mb-4 uppercase tracking-wide text-xs">
              Formations validees ✅
            </h2>
            <div className="grid gap-3">
              {doneCourses.map(c => (
                <div key={c.id} className="bg-green-500/5 border border-green-500/20 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{c.title}</h3>
                    <p className="text-gray-500 text-xs mt-0.5">{c.total_slides} slides · Valide</p>
                  </div>
                  <button onClick={() => router.push(`/cours/${c.id}`)}
                    className="text-green-400 text-xs border border-green-400/30 px-3 py-1.5 rounded-lg hover:bg-green-400/10">
                    Revoir
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {courses.length === 0 && (
          <div className="text-center py-24">
            <p className="text-5xl mb-4">📚</p>
            <p className="text-gray-400">Aucune formation disponible</p>
            <p className="text-gray-600 text-sm mt-2">L administrateur n a pas encore cree de cours</p>
          </div>
        )}
      </div>
    </div>
  );
}
