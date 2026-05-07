#!/bin/bash
echo "=== Demarrage complet Formation IA ==="

# 1. Ollama
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "Demarrage Ollama..."
    ollama serve > /tmp/ollama.log 2>&1 &
    sleep 3
fi
echo "OK Ollama"

# 2. Backend FastAPI
cd ~/formation-ia/backend
source ../venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 > /tmp/backend.log 2>&1 &
sleep 2
echo "OK Backend http://localhost:8000"

# 3. Frontend Next.js
cd ~/formation-ia/frontend
npm run dev > /tmp/frontend.log 2>&1 &
sleep 3
echo "OK Frontend http://localhost:3000"

echo ""
echo "=== APPLI PRETE ==="
echo "Ouvrez : http://localhost:3000"
echo ""
echo "Logs backend : tail -f /tmp/backend.log"
echo "Logs frontend: tail -f /tmp/frontend.log"
echo "Logs ollama  : tail -f /tmp/ollama.log"
echo ""
echo "Pour arreter tout : pkill -f uvicorn; pkill -f 'next dev'; pkill ollama"
