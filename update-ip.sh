#!/bin/bash
WSL_IP=$(hostname -I | awk '{print $1}')
echo "NEXT_PUBLIC_API_URL=http://$WSL_IP:8000" > /home/ell/formation-ia/frontend/.env.local
echo "NEXT_PUBLIC_WS_URL=ws://$WSL_IP:8000" >> /home/ell/formation-ia/frontend/.env.local
echo "IP WSL mise a jour : $WSL_IP"
