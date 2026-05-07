import Link from "next/link";

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <div className="text-center mb-16">
        <h1 className="text-5xl font-bold text-blue-900 mb-4">
          🎓 Formation Bancaire IA
        </h1>
        <p className="text-xl text-gray-600">
          Votre formateur IA intelligent — 100% local, 100% gratuit
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/formateur" className="block p-8 bg-white rounded-2xl shadow-md hover:shadow-xl transition-shadow border border-gray-100">
          <div className="text-4xl mb-4">📁</div>
          <h2 className="text-2xl font-bold text-blue-900 mb-2">Espace Formateur</h2>
          <p className="text-gray-600">Uploadez vos documents et générez des cours automatiquement</p>
        </Link>

        <Link href="/cours" className="block p-8 bg-white rounded-2xl shadow-md hover:shadow-xl transition-shadow border border-gray-100">
          <div className="text-4xl mb-4">📚</div>
          <h2 className="text-2xl font-bold text-blue-900 mb-2">Mes Cours</h2>
          <p className="text-gray-600">Suivez vos cours avec narration vocale interactive</p>
        </Link>

        <Link href="/chat" className="block p-8 bg-white rounded-2xl shadow-md hover:shadow-xl transition-shadow border border-gray-100">
          <div className="text-4xl mb-4">💬</div>
          <h2 className="text-2xl font-bold text-blue-900 mb-2">Assistant IA</h2>
          <p className="text-gray-600">Posez vos questions par écrit ou à voix haute</p>
        </Link>

        <div className="block p-8 bg-blue-50 rounded-2xl border border-blue-100">
          <div className="text-4xl mb-4">⚡</div>
          <h2 className="text-2xl font-bold text-blue-900 mb-2">Stack 100% local</h2>
          <div className="text-sm text-gray-600 space-y-1">
            <div>🤖 LLM : phi3:mini (Ollama)</div>
            <div>🎙️ STT : Whisper (local)</div>
            <div>🔊 TTS : gTTS (gratuit)</div>
            <div>📦 RAG : ChromaDB (local)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
