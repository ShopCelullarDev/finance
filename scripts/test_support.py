"""Sesión sintética para los scripts que golpean routers protegidos."""

from datetime import datetime, timezone
from uuid import UUID

from app.api.deps import get_current_user
from app.main import app
from app.models.user import User


def install_test_session() -> None:
    user = User(
        id=UUID("00000000-0000-0000-0000-0000000000aa"),
        username="test_session",
        email="test_session@local",
        hashed_password="not-used",
        role="admin",
        is_active=True,
        failed_login_attempts=0,
        locked_until=None,
        created_at=datetime.now(timezone.utc),
        last_login_at=None,
    )

    async def _user() -> User:
        return user

    app.dependency_overrides[get_current_user] = _user
