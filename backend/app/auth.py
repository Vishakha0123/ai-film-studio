"""Authentication: verify Supabase access tokens and resolve the current user.

Supabase projects sign tokens either with asymmetric keys (ES256/RS256, published at
<SUPABASE_URL>/auth/v1/.well-known/jwks.json) or, on older projects, a shared HS256 secret.
Both are supported. AUTH_MODE=dev accepts `Bearer dev:<email>` for local development and tests.
"""

import hashlib
import logging
from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_db
from app.models import User

log = logging.getLogger("cineai.auth")


@dataclass
class CurrentUser:
    id: str
    email: str


@lru_cache
def _jwks_client(jwks_url: str) -> jwt.PyJWKClient:
    # PyJWKClient caches keys; lifespan kept short so rotated keys are picked up.
    return jwt.PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=600)


def _unauthorized(detail: str = "Not authenticated") -> HTTPException:
    if detail != "Not authenticated":
        log.warning("Sign-in rejected: %s", detail)  # shows the reason in the backend terminal
    return HTTPException(status.HTTP_401_UNAUTHORIZED, detail=detail, headers={"WWW-Authenticate": "Bearer"})


def decode_token(token: str, settings: Settings) -> CurrentUser:
    if settings.AUTH_MODE == "dev":
        if not token.startswith("dev:") or "@" not in token:
            raise _unauthorized(
                "The backend has AUTH_MODE=dev but the app signed in with Supabase (Google). "
                "Set AUTH_MODE=supabase in backend .env and restart the backend"
            )
        email = token[4:].strip().lower()
        uid = "dev-" + hashlib.sha256(email.encode()).hexdigest()[:24]
        return CurrentUser(id=uid, email=email)

    if not settings.SUPABASE_URL:
        raise HTTPException(500, detail="SUPABASE_URL is not configured on the server")
    issuer = settings.SUPABASE_URL.rstrip("/") + "/auth/v1"
    try:
        token_issuer = jwt.decode(token, options={"verify_signature": False}).get("iss", "")
    except Exception:
        raise _unauthorized("Invalid session token (not a Supabase token)")
    if token_issuer and token_issuer.rstrip("/") != issuer:
        raise _unauthorized(
            f"Signed in with Supabase project {token_issuer.removesuffix('/auth/v1')} but the backend's "
            f"SUPABASE_URL is {settings.SUPABASE_URL}. Use the same project in backend and frontend .env"
        )
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "")
        if alg == "HS256":
            if not settings.SUPABASE_JWT_SECRET:
                raise _unauthorized("Token uses HS256 but SUPABASE_JWT_SECRET is not set")
            key = settings.SUPABASE_JWT_SECRET
        else:
            try:
                key = _jwks_client(issuer + "/.well-known/jwks.json").get_signing_key_from_jwt(token).key
            except Exception as e:
                raise _unauthorized(f"Could not download Supabase signing keys from {issuer}/.well-known/jwks.json ({e})")
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
    except jwt.InvalidSignatureError:
        raise _unauthorized(
            "Session token signature doesn't match — check SUPABASE_JWT_SECRET (Supabase → Settings → API → JWT secret)"
        )
    except Exception as e:  # malformed token, wrong audience …
        raise _unauthorized(f"Invalid session token ({e})")
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
        try:
            db.commit()
        except IntegrityError:
            db.rollback()  # another request for the same new user created the row first — that's fine
    elif user.email and row.email != user.email:
        row.email = user.email
        db.commit()
    return user
