#!/usr/bin/env bash
# Script para iniciar el servidor de desarrollo FastAPI
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

if [ ! -d ".venv" ]; then
    echo "[!] Virtualenv no encontrado. Creando..."
    python3 -m venv .venv
    ./.venv/bin/pip install -r requirements.txt
fi

echo "[*] Iniciando FastAPI en http://localhost:8000 (Docs: http://localhost:8000/docs)..."
PYTHONPATH=. ./.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
