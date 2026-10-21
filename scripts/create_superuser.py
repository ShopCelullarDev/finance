#!/usr/bin/env python3
"""Script CLI para inicializar la tabla de usuarios y crear o restablecer el superusuario administrador.

Uso:
    python scripts/create_superuser.py --username admin --email admin@terminal.local --password SuperSecretPass123!
    O bien de forma interactiva (solicitará los datos si no se proporcionan).
"""

import argparse
import asyncio
import getpass
import sys
from datetime import datetime, timezone
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, engine
from app.core.security import get_password_hash
from app.models.user import User


CREATE_USERS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'trader',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
)
"""

INDEX_SQL_STATEMENTS = [
    "CREATE INDEX IF NOT EXISTS idx_users_username ON users (username)",
    "CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)",
]


async def init_users_table():
    """Garantiza que la tabla 'users' exista en PostgreSQL / TimescaleDB."""
    async with engine.begin() as conn:
        await conn.execute(text(CREATE_USERS_TABLE_SQL))
        for idx_sql in INDEX_SQL_STATEMENTS:
            await conn.execute(text(idx_sql))
    print("[DB] Tabla 'users' e índices verificados/creados exitosamente.")


async def create_or_update_superuser(username: str, email: str, password: str, role: str = "admin"):
    """Inserta o actualiza las credenciales de un usuario con privilegios."""
    hashed = get_password_hash(password)
    
    async with AsyncSessionLocal() as session:
        # Verificar si el usuario ya existe por username o email
        query = text("SELECT id, username, email FROM users WHERE username = :u OR email = :e")
        result = await session.execute(query, {"u": username, "e": email})
        existing = result.first()
        
        if existing:
            update_sql = text("""
                UPDATE users 
                SET hashed_password = :h, role = :r, is_active = TRUE, failed_login_attempts = 0, locked_until = NULL
                WHERE id = :uid
            """)
            await session.execute(update_sql, {"h": hashed, "r": role, "uid": existing[0]})
            await session.commit()
            print(f"[AUTH] Usuario existente '{existing[1]}' actualizado con nuevo hash y rol '{role}'.")
        else:
            insert_sql = text("""
                INSERT INTO users (username, email, hashed_password, role, is_active, failed_login_attempts)
                VALUES (:u, :e, :h, :r, TRUE, 0)
            """)
            await session.execute(insert_sql, {"u": username, "e": email, "h": hashed, "r": role})
            await session.commit()
            print(f"[AUTH] Superusuario '{username}' ({email}) creado exitosamente con rol '{role}'.")


async def main():
    parser = argparse.ArgumentParser(description="Inicializar superusuario administrador para el Terminal")
    parser.add_argument("--username", "-u", default="admin", help="Nombre de usuario (default: admin)")
    parser.add_argument("--email", "-e", default="admin@terminal.private", help="Correo electrónico")
    parser.add_argument("--password", "-p", default="AdminSecure2026!", help="Contraseña (mínimo 8 caracteres)")
    parser.add_argument("--role", "-r", default="admin", choices=["admin", "trader"], help="Rol asignado")
    args = parser.parse_args()

    username = args.username.strip()
    email = args.email.strip()
    password = args.password.strip()
    role = args.role.strip()

    if len(password) < 8:
        print("[ERROR] La contraseña debe tener al menos 8 caracteres.")
        sys.exit(1)

    print(f"=== Creando/Actualizando Superusuario: {username} ({email}) ===")
    try:
        await init_users_table()
        await create_or_update_superuser(username, email, password, role)
        print("=== Operación completada con éxito ===")
    except Exception as e:
        print(f"[ERROR CRITICO] Fallo al procesar superusuario: {e}")
        sys.exit(1)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
