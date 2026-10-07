"""Authentication: verify Supabase access tokens and resolve the current user.

Supabase projects sign tokens either with asymmetric keys (ES256/RS256, published at
<SUPABASE_URL>/auth/v1/.well-known/jwks.json) or, on older projects, a shared HS256 secret.
Both are supported. AUTH_MODE=dev accepts `Bearer dev:<email>` for local development and tests.
"""

import hashlib
from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_db
from app.models import User


@dataclass
class CurrentUser:
    id: str
    email: str


@lru_cache
def _jwks_client(jwks_url: str) -> jwt.PyJWKClient:
    # PyJWKClient caches keys; lifespan kept short so rotated keys are picked up.
    return jwt.PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=600)


def _unauthorized(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, detail=detail, headers={"WWW-Authenticate": "Bearer"})


def decode_token(token: str, settings: Settings) -> CurrentUser:
    if settings.AUTH_MODE == "dev":
        if not token.startswith("dev:") or "@" not in token:
            raise _unauthorized("Dev mode expects a token like 'dev:you@example.com'")
        email = token[4:].strip().lower()
        uid = "dev-" + hashlib.sha256(email.encode()).hexdigest()[:24]
        return CurrentUser(id=uid, email=email)

    if not settings.SUPABASE_URL:
        raise HTTPException(500, detail="SUPABASE_URL is not configured on the server")
    issuer = settings.SUPABASE_URL.rstrip("/") + "/auth/v1"
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "")
        if alg == "HS256":
            if not settings.SUPABASE_JWT_SECRET:
                raise _unauthorized("Token uses HS256 but SUPABASE_JWT_SECRET is not set")
            key = settings.SUPABASE_JWT_SECRET
        else:
            key = _jwks_client(issuer + "/.well-known/jwks.json").get_signing_key_from_jwt(token).key
        claims = jwt.decode(
            token,
            key,
            algorithms=["HS256", "ES256", "RS256"],
            audience=settings.SUPABASE_JWT_AUDIENCE,
            issuer=issuer,
        )
    except HTTPException:
        raise
    except jwt.ExpiredSignatureError:
        raise _unauthorized("Session expired — please sign in again")
    except Exception:  # invalid signature, malformed token, JWKS fetch failure
        raise _unauthorized("Invalid session token")
    return CurrentUser(id=claims["sub"], email=claims.get("email", ""))


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    header = request.headers.get("Authorization", "")
    if not header.lower().startswith("bearer "):
        raise _unauthorized()
    user = decode_token(header[7:].strip(), settings)
    # Mirror the auth user in our users table (first request creates it).
    row = db.get(User, user.id)
    if row is None:
        db.add(User(id=user.id, email=user.email))
        db.commit()
    elif user.email and row.email != user.email:
        row.email = user.email
        db.commit()
    return user
