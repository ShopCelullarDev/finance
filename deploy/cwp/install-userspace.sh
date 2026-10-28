#!/usr/bin/env bash
# Instala TimescaleDB, Redis y Python 3.12 en el home del usuario CWP.
# No usa root, no usa MariaDB y no borra un clúster ya creado.
# Ejecutar desde el servidor, con el código ya copiado:
#   bash deploy/cwp/install-userspace.sh
set -euo pipefail

if [[ "${EUID}" -eq 0 ]]; then
  echo "Ejecutar como el usuario de CWP, no como root."
  exit 1
fi

for bin in gcc make cmake curl tar; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "Falta el comando ${bin}."
    exit 1
  fi
done
if [[ ! -f /usr/include/openssl/ssl.h ]]; then
  echo "Falta el encabezado de OpenSSL. Root debe instalar openssl-devel antes de compilar TimescaleDB."
  exit 1
fi

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
SRC=$(cd "$SCRIPT_DIR/../.." && pwd)
BASE="${HOME}/market"
PG="${BASE}/pgsql"
DATA="${BASE}/pgdata"
BUILD="${BASE}/build"
TS_VER="2.17.2"
REDIS_VER="7.4.2"

mkdir -p "$BASE" "$BUILD" "${BASE}/redis-data" "${HOME}/.config/systemd/user"
if [[ "$SRC" != "${BASE}/src" ]]; then
  ln -sfn "$SRC" "${BASE}/src"
fi

if [[ ! -f "${BASE}/.env" ]]; then
  PG_PASS=$(openssl rand -hex 24)
  APP_SECRET=$(openssl rand -hex 32)
  umask 077
  cat > "${BASE}/.env" << EOF
ENVIRONMENT=production
LOG_LEVEL=INFO
DOCS_ENABLED=false
SECRET_KEY=${APP_SECRET}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
POSTGRES_USER=market_admin
POSTGRES_PASSWORD=${PG_PASS}
POSTGRES_DB=market_predictive_db
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
DATABASE_URL=postgresql+asyncpg://market_admin:${PG_PASS}@127.0.0.1:5432/market_predictive_db
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_URL=redis://127.0.0.1:6379/0
CORS_ORIGINS=["https://finance.cex-ve.xyz","https://vps.alphagus.com"]
POLYMARKET_GAMMA_API_URL=https://gamma-api.polymarket.com
EOF
  echo "Credenciales nuevas en ${BASE}/.env"
fi

read_env() {
  sed -n "s/^${1}=//p" "${BASE}/.env" | head -1 | tr -d '\r'
}
POSTGRES_USER=$(read_env POSTGRES_USER)
POSTGRES_PASSWORD=$(read_env POSTGRES_PASSWORD)
POSTGRES_DB=$(read_env POSTGRES_DB)
export PGPASSWORD="${POSTGRES_PASSWORD}"

if ! "${PG}/bin/pg_config" --version >/dev/null 2>&1; then
  echo "Compilando PostgreSQL 16.4 con la glibc de este sistema..."
  rm -rf "$PG" "${BUILD}/postgresql-16.4"
  curl -fL --retry 3 -o "${BUILD}/postgresql.tar.bz2" "https://ftp.postgresql.org/pub/source/v16.4/postgresql-16.4.tar.bz2"
  tar -xjf "${BUILD}/postgresql.tar.bz2" -C "$BUILD"
  (
    cd "${BUILD}/postgresql-16.4"
    ./configure --prefix="$PG" --with-openssl --with-readline --with-zlib --without-icu
    make -j1
    make install
  )
fi
export PATH="${PG}/bin:${PATH}"

if [[ ! -x "${BASE}/redis/bin/redis-server" ]]; then
  echo "Compilando Redis ${REDIS_VER}..."
  curl -fL --retry 3 -o "${BUILD}/redis.tar.gz" "https://github.com/redis/redis/archive/refs/tags/${REDIS_VER}.tar.gz"
  rm -rf "${BUILD}/redis-${REDIS_VER}"
  tar -xzf "${BUILD}/redis.tar.gz" -C "$BUILD"
  make -C "${BUILD}/redis-${REDIS_VER}" -j1
  make -C "${BUILD}/redis-${REDIS_VER}" PREFIX="${BASE}/redis" install
fi

if [[ ! -f "${PG}/lib/timescaledb.so" && ! -f "${PG}/lib/postgresql/timescaledb.so" ]]; then
  found=$(find "$PG" -name 'timescaledb.so' | head -1 || true)
else
  found="yes"
fi
if [[ -z "${found}" ]]; then
  echo "Compilando TimescaleDB ${TS_VER}..."
  curl -fL --retry 3 -o "${BUILD}/timescaledb.tar.gz" "https://github.com/timescale/timescaledb/archive/refs/tags/${TS_VER}.tar.gz"
  rm -rf "${BUILD}/timescaledb-${TS_VER}"
  tar -xzf "${BUILD}/timescaledb.tar.gz" -C "$BUILD"
  (
    cd "${BUILD}/timescaledb-${TS_VER}"
    ./bootstrap -DREGRESS_CHECKS=OFF
    make -C build -j1
    make -C build install
  )
fi

if [[ ! -f "${BASE}/redis.conf" ]]; then
  cat > "${BASE}/redis.conf" << EOF
bind 127.0.0.1
port 6379
daemonize no
protected-mode yes
dir ${BASE}/redis-data
stop-writes-on-bgsave-error no
EOF
fi

if [[ ! -d "${DATA}/base" ]]; then
  echo "Inicializando el clúster de Postgres..."
  umask 077
  printf '%s\n' "$POSTGRES_PASSWORD" > "${BUILD}/pg.pass"
  "${PG}/bin/initdb" -D "$DATA" --username="$POSTGRES_USER" --pwfile="${BUILD}/pg.pass" \
    --auth-local=trust --auth-host=scram-sha-256 --locale=C --encoding=UTF8
  rm -f "${BUILD}/pg.pass"
  printf "\nlisten_addresses = '127.0.0.1'\nport = 5432\nshared_preload_libraries = 'timescaledb'\n" >> "${DATA}/postgresql.conf"
fi

if ! "${PG}/bin/pg_isready" -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
  "${PG}/bin/pg_ctl" -D "$DATA" -l "${BASE}/postgres.log" start
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    "${PG}/bin/pg_isready" -h 127.0.0.1 -p 5432 && break
    sleep 1
  done
fi

"${PG}/bin/psql" -h 127.0.0.1 -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 \
  -c "SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB}'" | grep -q 1 \
  || "${PG}/bin/psql" -h 127.0.0.1 -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 \
       -c "CREATE DATABASE ${POSTGRES_DB}"

for sql in "$SRC"/database/init/*.sql; do
  echo "Aplicando $(basename "$sql")"
  "${PG}/bin/psql" -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f "$sql"
done

if [[ ! -x "${HOME}/.local/bin/uv" ]]; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
fi
export PATH="${HOME}/.local/bin:${PATH}"
export UV_CONCURRENT_DOWNLOADS=2
export UV_CONCURRENT_BUILDS=1
if [[ ! -x "${BASE}/venv/bin/python" ]]; then
  uv python install 3.12
  uv venv --python 3.12 "${BASE}/venv"
fi
uv pip install --python "${BASE}/venv/bin/python" -r "${SRC}/requirements.txt"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm no está en el PATH. CWP ya trae Node en /usr/local/bin."
  exit 1
fi
(
  cd "${SRC}/frontend"
  ulimit -n 8192 2>/dev/null || ulimit -n 4096 2>/dev/null || true
  if [[ ! -d node_modules ]]; then
    npm ci --maxsockets=1
  fi
  NEXT_PUBLIC_API_ORIGIN=same npm run build
)

mkdir -p "${HOME}/.config/systemd/user"
cp "${SCRIPT_DIR}/systemd/"*.service "${HOME}/.config/systemd/user/"
if "${PG}/bin/pg_isready" -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
  "${PG}/bin/pg_ctl" -D "$DATA" -m fast stop
fi
echo "Listo. Arranque con: bash ${SCRIPT_DIR}/start-user.sh"
echo "El proxy HTTPS está en deploy/cwp/apache-proxy.conf y lo aplica el administrador de CWP."
