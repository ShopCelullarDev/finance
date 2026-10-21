from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Entorno y Seguridad Privada
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    DOCS_ENABLED: bool = True  # En producción se apaga para ocultar la API
    SECRET_KEY: str = "default_secret_key_change_in_production_environment"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    RATE_LIMIT_LOGIN_ATTEMPTS: int = 5
    RATE_LIMIT_WINDOW_SECONDS: int = 300

    # PostgreSQL / TimescaleDB
    POSTGRES_USER: str = "market_admin"
    POSTGRES_PASSWORD: str = "market_secure_pass"
    POSTGRES_DB: str = "market_predictive_db"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    DATABASE_URL: str = (
        "postgresql+asyncpg://market_admin:market_secure_pass@localhost:5432/market_predictive_db"
    )

    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_URL: str = "redis://localhost:6379/0"

    # Vectores de Datos / APIs
    BINANCE_API_KEY: Optional[str] = None
    BINANCE_API_SECRET: Optional[str] = None
    KRAKEN_API_KEY: Optional[str] = None
    KRAKEN_API_SECRET: Optional[str] = None
    POLYMARKET_GAMMA_API_URL: str = "https://gamma-api.polymarket.com"

    # CORS para Frontend / Terminal
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000"
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
