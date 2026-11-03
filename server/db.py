"""Database layer for the SKATE API server.

Reuses the existing validation service's SQLite database (users,
transactions, telemetry) and adds the tables the API needs: blackjack hands,
dummy payments, subscriptions and wallet grants.

The server database defaults to ``server/skate.db`` (play-money data only).
Override with ``SKATE_DB_PATH``. This must be set before importing
``skate_backend_server``, which reads it at import time.
"""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path

os.environ.setdefault("SKATE_DB_PATH", str(Path(__file__).resolve().parent / "skate.db"))

# noqa: E402 — service import must come after the env default above.
import skate_backend_server as service

DB_PATH = os.environ["SKATE_DB_PATH"]

EXTRA_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS blackjack_hands (
    hand_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    shoe_json TEXT NOT NULL,
    player_json TEXT NOT NULL,
    dealer_json TEXT NOT NULL,
    dealer_hole_hidden INTEGER NOT NULL DEFAULT 1,
    insurance_json TEXT,
    status TEXT NOT NULL DEFAULT 'playing',
    result_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
    payment_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    ref TEXT NOT NULL,
    amount_sc INTEGER NOT NULL DEFAULT 0,
    amount_display TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'succeeded',
    fake_receipt TEXT NOT NULL,
    idempotency_key TEXT UNIQUE,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subscriptions (
    sub_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    current_period_end TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wallet_grants (
    grant_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    ref TEXT NOT NULL,
    amount INTEGER NOT NULL,
    idempotency_key TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
"""


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_all() -> None:
    """Create base tables (from the validation service) plus API tables."""
    service.init_db()
    with get_db() as conn:
        conn.executescript(EXTRA_SCHEMA_SQL)


def public_user(row: sqlite3.Row) -> dict:
    return {
        "user_id": row["user_id"],
        "username": row["username"],
        "email": row["email"],
        "avatar": row["avatar"],
        "credits": int(row["credits"]),
        "xp": int(row["xp"]),
        "level": int(row["level"]),
        "streak_day": int(row["streak_day"]),
        "is_guest": bool(row["is_guest"]),
    }


def apply_xp(conn: sqlite3.Connection, user_id: str, xp_gain: int) -> dict:
    """Replicate the frontend's XP/level curve server-side.

    Every 200 * level XP levels the player up and pays a level * 150 SC
    bonus. Runs inside the caller's transaction.
    """
    row = conn.execute("SELECT xp, level FROM users WHERE user_id = ?", (user_id,)).fetchone()
    xp = int(row["xp"]) + xp_gain
    level = int(row["level"])
    while xp >= level * 200:
        xp -= level * 200
        level += 1
        bonus = level * 150
        service.SkateBackendService.apply_credit_tx(
            conn, user_id, "reward", "system", f"Level {level} Rank-Up", bonus, f"levelup_{user_id}_{level}"
        )
    conn.execute("UPDATE users SET xp = ?, level = ? WHERE user_id = ?", (xp, level, user_id))
    return {"xp": xp, "level": level}
