"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!username || !password) {
      setError("Remplissez tous les champs");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("http://172.31.6.180:8000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password: password.trim() })
      });
      const data = await res.json();
      console.log("Reponse login:", res.status, data);
      if (!res.ok) {
        setError(data.detail || "Identifiants incorrects");
        setLoading(false);
        return;
      }
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("full_name", data.full_name);
      localStorage.setItem("username", username.trim());
      if (data.role === "admin") router.push("/admin");
      else router.push("/apprenant");
    } catch (err) {
      console.error("Erreur login:", err);
      setError("Impossible de contacter le serveur. Verifiez que le backend tourne.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
            S
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">SGCI Formation</h1>
          <p className="text-gray-500 text-sm">Plateforme de formation intelligente</p>
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-3xl p-8">
          {error && (
            <div className="bg-red-900/20 border border-red-600/30 text-red-400 rounded-xl p-3 mb-6 text-sm">
              {error}
            </div>
          )}
          <div className="space-y-4 mb-6">
            <div>
              <label className="text-gray-500 text-xs block mb-2 uppercase tracking-wide">
                Identifiant
              </label>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="admin"
                autoComplete="username"
                className="w-full bg-black border border-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-red-600 transition-colors"
              />
            </div>
            <div>
              <label className="text-gray-500 text-xs block mb-2 uppercase tracking-wide">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-black border border-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-red-600 transition-colors"
              />
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50 text-lg"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </div>

        <p className="text-center text-gray-700 text-xs mt-6">
          admin / admin123
        </p>
      </div>
    </div>
  );
}
