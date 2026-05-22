#!/bin/bash
export HF_HUB_OFFLINE=1
export TRANSFORMERS_OFFLINE=1

# Fix DNS
echo "nameserver 8.8.8.8" | sudo tee /etc/resolv.conf > /dev/null 2>&1

# Mettre a jour l IP WSL dans le frontend
WSL_IP=$(hostname -I | awk '{print $1}')
echo "NEXT_PUBLIC_API_URL=http://$WSL_IP:8000" > /home/ell/formation-ia/frontend/.env.local
echo "NEXT_PUBLIC_WS_URL=ws://$WSL_IP:8000" >> /home/ell/formation-ia/frontend/.env.local

# Remplacer l IP dans tous les fichiers frontend
find /home/ell/formation-ia/frontend/app -name "*.tsx" -o -name "*.ts" | \
  xargs grep -l "172\." 2>/dev/null | while read f; do
    sed -i "s|http://172\.[0-9.]*:8000|http://$WSL_IP:8000|g" "$f"
    sed -i "s|ws://172\.[0-9.]*:8000|ws://$WSL_IP:8000|g" "$f"
done
echo "IP frontend mise a jour : $WSL_IP"

# Tuer les anciens processus
pkill -f uvicorn 2>/dev/null
pkill -f ollama 2>/dev/null
sleep 2

# Demarrer Ollama
ollama serve > /tmp/ollama.log 2>&1 &
sleep 3

# Demarrer le backend
cd /home/ell/formation-ia/backend
source ../venv/bin/activate
echo "Backend sur http://$WSL_IP:8000"
uvicorn main:app --host 0.0.0.0 --port 8000
