#!/usr/bin/env bash
# Arranca Postgres, Redis, la API y la terminal como servicios del usuario.
set -euo pipefail
systemctl --user daemon-reload
systemctl --user enable --now market-postgres.service market-redis.service market-api.service market-web.service
if ! loginctl enable-linger "$USER" >/dev/null 2>&1; then
  echo "Los servicios quedan activos en esta sesión. Para que sobrevivan al cierre de SSH, root debe permitir linger para ${USER}."
fi
systemctl --user --no-pager --full status market-postgres market-redis market-api market-web || true
curl -fsS http://127.0.0.1:8000/health || echo "La API todavía no responde en /health."
