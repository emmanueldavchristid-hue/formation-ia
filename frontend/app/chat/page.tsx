"use client";
import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Bonjour ! Je suis votre assistant formateur bancaire. Posez-moi vos questions." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: question }]);
    setLoading(true);
    try {
      const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Erreur de connexion." }]);
    }
    setLoading(false);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col" style={{ height: "calc(100vh - 80px)" }}>
      <h1 className="text-2xl font-bold text-blue-900 mb-6">Assistant Formation</h1>
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 bg-white rounded-2xl shadow p-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl text-sm ${
              m.role === "user" ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-800"
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-3 rounded-2xl text-sm text-gray-500 animate-pulse">
              Reflexion en cours...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-3">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Posez votre question bancaire..."
          className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading} />
        <button onClick={send} disabled={loading || !input.trim()}
          className="bg-blue-700 text-white px-6 py-3 rounded-xl hover:bg-blue-800 disabled:opacity-50 text-sm font-medium">
          Envoyer
        </button>
      </div>
    </div>
  );
}
