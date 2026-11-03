"""SKATE API server — FastAPI wiring, CORS, rate limiting, error envelope.

Run from the repo root:

    SKATE_SERVER_SECRET=... SKATE_JWT_SECRET=... SKATE_DB_PATH=server/skate.db \
        uvicorn server.app:app --host 0.0.0.0 --port 8000

Interactive docs: http://localhost:8000/docs

Scalability notes (honest, for the README too):
- The API is stateless apart from SQLite: auth is a signed JWT, game
  state lives in the database, so the app tier can scale horizontally
  behind a load balancer — but SQLite itself is single-writer. The
  migration path is Postgres: the data layer is plain SQL through one
  connection helper, and the idempotency-key design already assumes a
  database with real transactions.
- The in-memory rate limiter below is per-process. Behind multiple
  workers it must move to Redis; the middleware interface is isolated
  so that swap is one file.
"""

from __future__ import annotations

import logging
import os
import threading
import time

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from server import api, billing, games
from server.db import init_all

log = logging.getLogger("skate.api")

app = FastAPI(title="SKATE API", version="1.0.0", description="Play-money casino backend: auth, wallet, provably-fair games, dummy billing.")

origins_env = os.environ.get("SKATE_CORS_ORIGINS", "http://localhost:5173,http://localhost:4173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins_env.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RateLimiter:
    """Fixed-window in-memory limiter (single-process; see module docstring)."""

    def __init__(self) -> None:
        self._hits: dict[str, tuple[float, int]] = {}
        self._lock = threading.Lock()

    def allowed(self, key: str, limit: int, window: float = 60.0) -> bool:
        now = time.time()
        with self._lock:
            if len(self._hits) > 20000:
                self._hits.clear()
            start, count = self._hits.get(key, (now, 0))
            if now - start >= window:
                start, count = now, 0
            count += 1
            self._hits[key] = (start, count)
            return count <= limit


_limiter = RateLimiter()


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    path = request.url.path
    client = request.client.host if request.client else "unknown"
    if path.startswith("/api/v1/auth"):
        key, limit = f"auth:{client}", 30
    elif path.startswith("/api/v1/games"):
        auth = request.headers.get("authorization", "")
        key, limit = f"games:{auth[-16:] if auth else client}", 240
    else:
        key, limit = f"api:{client}", 600
    if not _limiter.allowed(key, limit):
        return JSONResponse(status_code=429, content={"detail": {"code": "RATE_LIMITED", "message": "Too many requests, slow down"}})
    return await call_next(request)


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"detail": {"code": "VALIDATION", "message": str(exc)[:500]}})


@app.exception_handler(Exception)
async def unhandled_handler(request: Request, exc: Exception):
    log.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": {"code": "INTERNAL", "message": "Internal server error"}})


@app.on_event("startup")
def startup():
    init_all()


@app.get("/health")
def health():
    return {"status": "ok", "service": "skate-api"}


@app.get("/")
def root():
    return {"service": "skate-api", "version": "1.0.0", "docs": "/docs", "health": "/health"}


app.include_router(api.router)
app.include_router(games.router)
app.include_router(billing.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server.app:app", host="0.0.0.0", port=int(os.environ.get("SKATE_PORT", "8000")))
