"""Authentication for the SKATE API: JWT access tokens + password checks.

Passwords reuse the validation service's PBKDF2-HMAC-SHA256 scheme
(120,000 iterations, per-user salt) so there is exactly one password
scheme in the codebase. Tokens are HS256 JWTs, 24h expiry.
"""

from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

import skate_backend_server as service
from server.db import get_db

JWT_SECRET = os.environ.get("SKATE_JWT_SECRET", "")
if not JWT_SECRET:
    raise RuntimeError("SKATE_JWT_SECRET is not set. Refusing to issue tokens without a signing secret.")

JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24

_bearer = HTTPBearer(auto_error=False)


def create_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": user_id, "iat": int(now.timestamp()), "exp": int((now + timedelta(hours=JWT_EXPIRY_HOURS)).timestamp())}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_password(password: str, stored_hash: str, salt: str) -> bool:
    if not stored_hash or not salt:
        return False
    candidate, _ = service.hash_password(password, salt)
    return secrets.compare_digest(candidate, stored_hash)


def get_user_by_email(email: str):
    with get_db() as conn:
        return conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()


def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> dict:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail={"code": "UNAUTHORIZED", "message": "Missing bearer token"})
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload["sub"]
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail={"code": "UNAUTHORIZED", "message": "Invalid or expired token"})
    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE user_id = ?", (user_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=401, detail={"code": "UNAUTHORIZED", "message": "Unknown user"})
    return dict(row)
