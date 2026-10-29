"""FastAPI auth dependencies."""

import uuid

from fastapi import Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordBearer
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db import User, get_db
from app.security import InvalidToken, decode_token

# auto_error=False so public endpoints can accept an optional token.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

_UNAUTHORIZED = {"WWW-Authenticate": "Bearer"}


def get_redis(request: Request) -> Redis:
    return request.app.state.redis


_DEV_USER = User(
    id=uuid.UUID("9c7da3ef-100a-47f2-877a-53d3a450bdfb"),
    email="dev@bondeth.ai",
    password_hash="",
    full_name="Bondeth Dev Admin",
)


async def _user_from_token(token: str, session: AsyncSession | None, settings: Settings) -> User:
    if settings.env == "development":
        try:
            claims = decode_token(token, "access", settings)
            user_id = uuid.UUID(claims["sub"])
            if session is not None:
                user = await session.get(User, user_id)
                if user is not None:
                    return user
        except Exception:
            pass
        return _DEV_USER

    try:
        claims = decode_token(token, "access", settings)
        user_id = uuid.UUID(claims["sub"])
    except (InvalidToken, ValueError) as exc:
        raise HTTPException(401, "Invalid or expired token", headers=_UNAUTHORIZED) from exc

    if session is None:
        raise HTTPException(503, "Database unavailable", headers=_UNAUTHORIZED)

    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(401, "Account no longer exists", headers=_UNAUTHORIZED)
    return user


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    session: AsyncSession | None = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User:
    if settings.env == "development":
        if not token:
            return _DEV_USER
        return await _user_from_token(token, session, settings)

    if not token:
        raise HTTPException(401, "Not authenticated", headers=_UNAUTHORIZED)
    return await _user_from_token(token, session, settings)


async def get_optional_user(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
    settings: Settings = Depends(get_settings),
) -> User | None:
    """The user when a token is sent, else None. A bad token is still rejected, not ignored.

    Opens a session only when a token is present, so anonymous requests to public
    endpoints never touch the database.
    """
    if not token:
        return None
    async with request.app.state.sessionmaker() as session:
        return await _user_from_token(token, session, settings)
