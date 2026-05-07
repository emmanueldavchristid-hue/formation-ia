#!/bin/bash
echo "🚀 Démarrage IA Formation Bancaire..."

# Démarrer Ollama si pas déjà actif
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "⏳ Démarrage Ollama..."
    ollama serve > /tmp/ollama.log 2>&1 &
    sleep 4
    echo "✅ Ollama démarré"
else
    echo "✅ Ollama déjà actif"
fi

# Activer le venv et lancer FastAPI
cd ~/formation-ia/backend
source ../venv/bin/activate
echo "✅ Backend sur http://localhost:8000"
echo "📖 Docs sur  http://localhost:8000/docs"
uvicorn main:app --reload --host 0.0.0.0 --port 8000
