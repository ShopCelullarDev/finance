---
name: project-credentials-environments
description: >-
  Usar SIEMPRE que se requiera conectar a bases de datos (TimescaleDB, Redis), APIs de exchanges
  (Binance, Kraken, Coinbase, Polymarket), scrapers o servicios externos, configurar variables
  de entorno (.env) o gestionar puertos y accesos entre Local, Staging y Producción.
  Evita adivinanzas de conexiones y bloquea la inclusión de credenciales en git.
---

# Gestión de Credenciales, Puertos y Entornos

Este documento define las directivas de acceso, topología de servicios y manejo seguro de credenciales para el **Motor Predictivo de Tendencias Web (Cripto & Macro)**.

---

## 1. Regla de Oro: Cero Secretos en Git
- **NUNCA** escribir contraseñas de TimescaleDB, Redis, claves de API privadas de exchanges ni JWT secrets en el código ni en commits.
- Todo valor confidencial se inyecta por variables de entorno leídas desde `.env` en local o el gestor de secretos en despliegue.
- Archivos excluidos de forma estricta en `.gitignore`:
  - `.env`, `.env.local`, `.env.*.local`
  - `*.pem`, `*.key`, `id_rsa*`
  - Tokens de API privados y volcados de bases de datos (`*.dump`, `*.sql`)

---

## 2. Matriz de Entornos y Puertos Canónicos

| Servicio | Puerto Local | Puerto Contenedor | Variable Host | Propósito |
| :--- | :--- | :--- | :--- | :--- |
| **TimescaleDB / Postgres** | `5432` | `5432` | `DB_HOST=localhost` / `timescaledb` | Almacenamiento de ticks, noticias y señales |
| **Redis** | `6379` | `6379` | `REDIS_HOST=localhost` / `redis` | Colas de ingesta y canal PubSub de streaming |
| **FastAPI Backend** | `8000` | `8000` | `API_HOST=0.0.0.0` | API REST `/api/v1` y WebSockets `/ws` |
| **Next.js Web / Terminal** | `3000` | `3000` | `APP_PORT=3000` | Terminal de trading y panel administrativo |

---

## 3. Catálogo Canónico de Variables de Entorno

Toda nueva variable debe registrarse en `.env.example` con valores de ejemplo no confidenciales:

```bash
# ==============================================================================
# INFRAESTRUCTURA DE DATOS
# ==============================================================================
POSTGRES_USER=market_admin
POSTGRES_PASSWORD=market_secure_pass
POSTGRES_DB=market_predictive_db
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
DATABASE_URL=postgresql+asyncpg://market_admin:market_secure_pass@localhost:5432/market_predictive_db

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379/0

# ==============================================================================
# BACKEND FASTAPI Y SEGURIDAD
# ==============================================================================
ENVIRONMENT=development
LOG_LEVEL=INFO
SECRET_KEY=generate_a_random_32_bytes_hex_secret_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# ==============================================================================
# VECTORES DE DATOS Y EXCHANGES (API KEYS OPCIONALES / PÚBLICAS POR DEFECTO)
# ==============================================================================
BINANCE_API_KEY=
BINANCE_API_SECRET=
KRAKEN_API_KEY=
KRAKEN_API_SECRET=
POLYMARKET_GAMMA_API_URL=https://gamma-api.polymarket.com

# ==============================================================================
# FRONTEND Y CONEXIÓN A WS
# ==============================================================================
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

---

## 4. Inicialización Local para Agentes y Desarrolladores
Al iniciar el entorno de desarrollo:
```bash
cp .env.example .env
docker compose up -d timescaledb redis
```
Cualquier intento de hardcodear `localhost:5432` con usuario/contraseña dentro de archivos `.py` o `.ts` está prohibido; usar siempre `os.getenv` o `process.env`.
