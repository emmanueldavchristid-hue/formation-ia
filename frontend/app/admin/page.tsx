"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../hooks/useAuth";

interface Course { id: string; title: string; category: string; total_slides: number; estimated_duration_min: number; }
interface ApprenantProgress {
  username: string;
  full_name: string;
  courses: {
    course_id: string;
    course_title: string;
    progress_pct: number;
    completed: boolean;
    quiz_score: number;
    last_seen: string | null;
  }[];
}
interface User { username: string; role: string; full_name: string; }



export default function AdminPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth("admin");
  const [tab, setTab] = useState<Tab>("cours");
  const [courses, setCourses] = useState<Course[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [progressData, setProgressData] = useState<ApprenantProgress[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState("General");
  const [step, setStep] = useState<"idle"|"generating"|"done">("idle");
  const [log, setLog] = useState<string[]>([]);
  const [courseId] = useState(() => "cours_" + Math.random().toString(36).slice(2, 10));
  const [newUser, setNewUser] = useState({ username: "", password: "", full_name: "" });

  useEffect(() => { if (!loading) { loadAll(); } }, [loading]);

  async function loadAll() {
    const [c, u, a, p] = await Promise.all([
      fetch("http://172.31.6.180:8000/api/courses").then(r => r.json()),
      fetch("http://172.31.6.180:8000/api/admin/users").then(r => r.json()),
      fetch("http://172.31.6.180:8000/api/assignments").then(r => r.json()),
      fetch("http://172.31.6.180:8000/api/progress/admin/all").then(r => r.json()),
    ]);
    setCourses(c.courses || []);
    setUsers((u.users || []).filter((u: User) => u.role === "user"));
    setAssignments(a || {});
    setProgressData(p?.apprenants || []);
  }

  function addLog(msg: string) { setLog(p => [...p, msg]); }

  async function handleGenerate() {
    if (!files.length || !topic.trim()) return;
    setStep("generating"); setLog([]);
    for (const file of files) {
      const form = new FormData();
      form.append("file", file);
      form.append("course_id", courseId);
      const res = await fetch("http://172.31.6.180:8000/api/ingest", { method: "POST", body: form });
      const d = await res.json();
      addLog(d.status === "ok" ? `OK ${file.name} (${d.chunks} chunks)` : `Erreur ${file.name}`);
    }
    addLog("Generation du cours...");
    const res = await fetch("http://172.31.6.180:8000/api/course/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, category, course_id: courseId, nb_slides: 10 })
    });
    const data = await res.json();
    addLog(`Cours cree : ${data.title} (${data.total_slides} slides)`);
    setStep("done");
    loadAll();
  }

  async function toggleAssign(username: string, courseId: string) {
    const userCourses = assignments[username] || [];
    const isAssigned = userCourses.includes(courseId);
    const url = `http://172.31.6.180:8000/api/course/${courseId}/assign/${username}`;
    await fetch(url, { method: isAssigned ? "DELETE" : "POST" });
    loadAll();
  }

  async function createUser() {
    if (!newUser.username || !newUser.password) return;
    await fetch("http://172.31.6.180:8000/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newUser, role: "user" })
    });
    setNewUser({ username: "", password: "", full_name: "" });
    loadAll();
  }

  async function deleteUser(username: string) {
    if (!confirm(`Supprimer ${username} ?`)) return;
    await fetch(`http://172.31.6.180:8000/api/admin/users/${username}`, { method: "DELETE" });
    loadAll();
  }

  async function deleteCourse(id: string) {
    if (!confirm("Supprimer ce cours ?")) return;
    await fetch(`http://172.31.6.180:8000/api/course/${id}`, { method: "DELETE" });
    loadAll();
  }

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin"/></div>;

  type Tab = "cours" | "users" | "creer" | "progression";
  const TABS: { key: Tab; label: string }[] = [
    { key: "cours", label: `Cours (${courses.length})` },
    { key: "users", label: `Apprenants (${users.length})` },
    { key: "creer", label: "Creer un cours" },
    { key: "progression", label: "Progression" },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header SGCI */}
      <div className="bg-black border-b-2 border-red-600 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center font-bold text-white text-lg">S</div>
          <div>
            <p className="font-bold text-white tracking-wide">SGCI — Formation IA</p>
            <p className="text-gray-400 text-xs">Administration · {user?.name}</p>
          </div>
        </div>
        <button onClick={logout} className="text-gray-400 hover:text-white text-sm border border-gray-700 px-4 py-2 rounded-lg hover:border-red-600 transition-all">
          Deconnexion
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800 px-8">
        <div className="flex gap-0">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-6 py-4 text-sm font-medium transition-all border-b-2 ${
                tab === t.key
                  ? "border-red-600 text-white"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8">

        {/* TAB COURS */}
        {tab === "cours" && (
          <div>
            <div className="grid gap-3">
              {courses.length === 0 && (
                <div className="text-center py-20 text-gray-600">
                  <p className="text-4xl mb-3">📚</p>
                  <p>Aucun cours cree</p>
                </div>
              )}
              {courses.map(c => (
                <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex items-center justify-between hover:border-gray-700 transition-all">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">{c.category}</span>
                      <span className="text-xs text-gray-500">{c.total_slides} slides · {c.estimated_duration_min} min</span>
                    </div>
                    <h3 className="font-semibold text-white">{c.title}</h3>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => router.push(`/cours/${c.id}`)}
                      className="bg-white text-black px-4 py-2 rounded-lg text-xs font-bold hover:bg-gray-200 transition-all">
                      Previsualiser
                    </button>
                    <button onClick={() => deleteCourse(c.id)}
                      className="border border-red-600/50 text-red-500 px-4 py-2 rounded-lg text-xs hover:bg-red-600/10 transition-all">
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB USERS */}
        {tab === "users" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Creer user */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h2 className="font-bold text-white mb-5">Ajouter un apprenant</h2>
              <div className="space-y-3">
                <input value={newUser.full_name} onChange={e => setNewUser(p => ({...p, full_name: e.target.value}))}
                  placeholder="Nom complet"
                  className="w-full bg-black border border-gray-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-600"/>
                <input value={newUser.username} onChange={e => setNewUser(p => ({...p, username: e.target.value}))}
                  placeholder="Identifiant de connexion"
                  className="w-full bg-black border border-gray-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-600"/>
                <input type="password" value={newUser.password} onChange={e => setNewUser(p => ({...p, password: e.target.value}))}
                  placeholder="Mot de passe"
                  className="w-full bg-black border border-gray-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-600"/>
                <button onClick={createUser} disabled={!newUser.username || !newUser.password}
                  className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 disabled:opacity-40 transition-all">
                  Creer le compte
                </button>
              </div>
            </div>

            {/* Liste users + assignations */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h2 className="font-bold text-white mb-5">Apprenants et acces</h2>
              {users.length === 0 ? (
                <p className="text-gray-600 text-sm">Aucun apprenant cree</p>
              ) : (
                <div className="space-y-4">
                  {users.map(u => (
                    <div key={u.username} className="border border-gray-800 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-medium text-white text-sm">{u.full_name || u.username}</p>
                          <p className="text-gray-500 text-xs">{u.username}</p>
                        </div>
                        <button onClick={() => deleteUser(u.username)}
                          className="text-red-500 text-xs hover:text-red-400">
                          Supprimer
                        </button>
                      </div>
                      <p className="text-gray-500 text-xs mb-2">Cours assignes :</p>
                      <div className="flex flex-wrap gap-2">
                        {courses.map(c => {
                          const assigned = (assignments[u.username] || []).includes(c.id);
                          return (
                            <button key={c.id} onClick={() => toggleAssign(u.username, c.id)}
                              className={`text-xs px-3 py-1 rounded-full transition-all ${
                                assigned
                                  ? "bg-red-600 text-white"
                                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                              }`}>
                              {assigned ? "✓ " : "+ "}{c.title.slice(0, 25)}
                            </button>
                          );
                        })}
                        {courses.length === 0 && <p className="text-gray-600 text-xs">Aucun cours disponible</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB PROGRESSION */}
      {tab === "progression" && (
        <div>
          <h2 className="text-lg font-bold text-white mb-6">Suivi des apprenants</h2>
          {progressData.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-16">Aucun apprenant enregistré</p>
          ) : (
            <div className="space-y-6">
              {progressData.map(apprenant => (
                <div key={apprenant.username} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-bold text-white">{apprenant.full_name}</p>
                      <p className="text-gray-500 text-xs">{apprenant.username}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 text-sm font-bold">
                        {apprenant.courses.filter(c => c.completed).length} / {apprenant.courses.length} terminés
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {apprenant.courses.map(c => (
                      <div key={c.course_id} className="bg-black/40 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm text-gray-300 truncate flex-1">{c.course_title}</p>
                          <div className="flex items-center gap-3 ml-4">
                            {c.completed && <span className="text-green-400 text-xs font-bold">✓ Validé</span>}
                            {c.quiz_score >= 0 && (
                              <span className={`text-xs font-bold ${c.quiz_score >= 80 ? "text-green-400" : "text-orange-400"}`}>
                                Quiz: {c.quiz_score}%
                              </span>
                            )}
                            {c.last_seen && (
                              <span className="text-gray-600 text-xs">
                                {new Date(c.last_seen).toLocaleDateString("fr-FR")}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${c.completed ? "bg-green-500" : "bg-red-600"}`}
                            style={{ width: `${c.progress_pct}%` }}
                          />
                        </div>
                        <p className="text-gray-600 text-xs mt-1">{c.progress_pct}% parcouru</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CREER */}
        {tab === "creer" && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
              <h2 className="font-bold text-white text-xl mb-6">Nouveau cours</h2>

              {step === "generating" ? (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse"/>
                    <span className="text-sm text-gray-300">Generation en cours...</span>
                  </div>
                  <div className="bg-black rounded-xl p-4 max-h-48 overflow-y-auto space-y-1">
                    {log.map((l, i) => <p key={i} className="text-xs font-mono text-gray-400">{l}</p>)}
                  </div>
                  <p className="text-xs text-gray-600 mt-3 text-center">Ne fermez pas cette page</p>
                </div>
              ) : step === "done" ? (
                <div className="text-center py-8">
                  <div className="text-5xl mb-4">✅</div>
                  <p className="text-white font-bold text-lg mb-2">Cours cree avec succes</p>
                  <p className="text-gray-500 text-sm mb-6">Assignez-le aux apprenants dans l onglet Apprenants</p>
                  <div className="flex gap-3 justify-center">
                    <button onClick={() => { setStep("idle"); setFiles([]); setLog([]); setTopic(""); setTab("cours"); }}
                      className="bg-red-600 text-white px-6 py-2 rounded-xl hover:bg-red-700">
                      Voir les cours
                    </button>
                    <button onClick={() => { setStep("idle"); setFiles([]); setLog([]); setTopic(""); }}
                      className="border border-gray-700 text-gray-300 px-6 py-2 rounded-xl hover:border-gray-500">
                      Nouveau cours
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-gray-400 text-xs block mb-2 uppercase tracking-wide">Documents source</label>
                    <input type="file" multiple
                      onChange={e => setFiles(Array.from(e.target.files || []))}
                      className="block w-full bg-black border border-gray-700 rounded-xl p-3 text-sm text-gray-300 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-red-600 file:text-white file:text-xs cursor-pointer"
                      accept=".pdf,.pptx,.docx,.txt,.mp3,.wav,.mp4,.mkv,.png,.jpg"/>
                    {files.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {files.map((f, i) => <p key={i} className="text-xs text-gray-500">📄 {f.name}</p>)}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-2 uppercase tracking-wide">Sujet du cours</label>
                    <input value={topic} onChange={e => setTopic(e.target.value)}
                      placeholder="Ex: Introduction au credit bancaire, KYC et conformite..."
                      className="w-full bg-black border border-gray-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-600"/>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-2 uppercase tracking-wide">Rubrique</label>
                    <select value={category} onChange={e => setCategory(e.target.value)}
                      className="w-full bg-black border border-gray-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-red-600">
                      {["General","Banque","Conformite","Risque","RH","Informatique","Finance","Juridique","Operations"].map(c => (
                        <option key={c} value={c} className="bg-black">{c}</option>
                      ))}
                    </select>
                  </div>
                  <button onClick={handleGenerate} disabled={!files.length || !topic.trim()}
                    className="w-full bg-red-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-red-700 disabled:opacity-30 transition-all mt-4">
                    Generer le cours
                  </button>
                  <p className="text-xs text-gray-600 text-center">
                    Le LLM va generer un cours complet de 20-30 min
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
