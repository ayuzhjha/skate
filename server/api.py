"""Auth, wallet, fairness and grant endpoints."""

from __future__ import annotations

import hashlib
import re
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

import skate_backend_server as service
from server.auth import create_token, get_current_user, get_user_by_email, verify_password
from server.db import apply_xp, get_db, public_user

router = APIRouter(prefix="/api/v1", tags=["account"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
STREAK_REWARDS = [250, 400, 600, 850, 1200, 1800, 3000]


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=24)
    email: str = Field(pattern=EMAIL_RE.pattern)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(pattern=EMAIL_RE.pattern)
    password: str = Field(min_length=1, max_length=128)


class ClientSeedRequest(BaseModel):
    client_seed: str = Field(min_length=1, max_length=64)


class GrantRequest(BaseModel):
    kind: str = Field(pattern=r"^(mission|achievement)$")
    ref: str = Field(min_length=1, max_length=64)
    amount: int = Field(ge=1, le=5000)
    idempotency_key: str = Field(min_length=6, max_length=128)


def _token_response(user_row: dict) -> dict:
    return {"access_token": create_token(user_row["user_id"]), "token_type": "bearer", "user": public_user(user_row)}


@router.post("/auth/register", status_code=201)
def register(body: RegisterRequest):
    if get_user_by_email(body.email) is not None:
        raise HTTPException(status_code=409, detail={"code": "EMAIL_TAKEN", "message": "Email already registered"})
    created = service.SkateBackendService.create_or_register_user(body.username, body.email, body.password, is_guest=False)
    row = get_user_by_email(body.email)
    assert row is not None
    return _token_response(dict(row))


@router.post("/auth/login")
def login(body: LoginRequest):
    row = get_user_by_email(body.email)
    if row is None or not verify_password(body.password, row["password_hash"], row["salt"]):
        raise HTTPException(status_code=401, detail={"code": "UNAUTHORIZED", "message": "Invalid email or password"})
    return _token_response(dict(row))


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    with get_db() as conn:
        sub = conn.execute(
            "SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
            (user["user_id"],),
        ).fetchone()
        row = conn.execute("SELECT * FROM users WHERE user_id = ?", (user["user_id"],)).fetchone()
    out = public_user(row)
    out["subscription"] = (
        {"plan_id": sub["plan_id"], "status": sub["status"], "current_period_end": sub["current_period_end"]} if sub else None
    )
    return out


@router.get("/ledger")
def ledger(limit: int = 50, offset: int = 0, user: dict = Depends(get_current_user)):
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    with get_db() as conn:
        total = conn.execute("SELECT COUNT(*) FROM transactions WHERE user_id = ?", (user["user_id"],)).fetchone()[0]
        rows = conn.execute(
            """SELECT tx_id, tx_type, game_mode, label, delta, balance_before, balance_after, created_at
               FROM transactions WHERE user_id = ? ORDER BY created_at DESC, tx_id DESC LIMIT ? OFFSET ?""",
            (user["user_id"], limit, offset),
        ).fetchall()
    return {"total": total, "limit": limit, "offset": offset, "transactions": [dict(r) for r in rows]}


@router.get("/fairness")
def fairness(user: dict = Depends(get_current_user)):
    seed_hash = hashlib.sha256(user["server_seed"].encode("utf-8")).hexdigest()
    return {"server_seed_hash": seed_hash, "client_seed": user["client_seed"], "nonce": int(user["nonce"])}


@router.post("/fairness/client-seed")
def set_client_seed(body: ClientSeedRequest, user: dict = Depends(get_current_user)):
    with get_db() as conn:
        conn.execute("UPDATE users SET client_seed = ? WHERE user_id = ?", (body.client_seed, user["user_id"]))
    return {"client_seed": body.client_seed}


@router.post("/fairness/rotate")
def rotate_server_seed(user: dict = Depends(get_current_user)):
    """Reveal the old seed (so past rounds stay verifiable) and commit a new one."""
    old_seed = user["server_seed"]
    new_seed = "srv_" + secrets.token_hex(16)
    with get_db() as conn:
        conn.execute("UPDATE users SET server_seed = ?, nonce = 1 WHERE user_id = ?", (new_seed, user["user_id"]))
    return {
        "revealed_server_seed": old_seed,
        "server_seed_hash": hashlib.sha256(new_seed.encode("utf-8")).hexdigest(),
        "nonce": 1,
    }


@router.post("/wallet/faucet")
def faucet(user: dict = Depends(get_current_user)):
    """Free 150 SC top-up, at most once per hour. Play money only."""
    with get_db() as conn:
        row = conn.execute(
            """SELECT created_at FROM wallet_grants WHERE user_id = ? AND kind = 'faucet'
               ORDER BY created_at DESC LIMIT 1""",
            (user["user_id"],),
        ).fetchone()
        if row:
            last = datetime.fromisoformat(row["created_at"])
            if (datetime.now(timezone.utc) - last).total_seconds() < 3600:
                raise HTTPException(status_code=429, detail={"code": "RATE_LIMITED", "message": "Faucet already claimed this hour"})
        balance = service.SkateBackendService.apply_credit_tx(conn, user["user_id"], "reward", "system", "Complimentary Faucet", 150, f"faucet_{user['user_id']}_{secrets.token_hex(4)}")
        conn.execute(
            "INSERT INTO wallet_grants (grant_id, user_id, kind, ref, amount, idempotency_key, created_at) VALUES (?, ?, 'faucet', 'hourly', 150, ?, ?)",
            ("gr_" + secrets.token_hex(6), user["user_id"], f"faucet_{secrets.token_hex(6)}", service.now_iso()),
        )
    return {"credits": balance, "granted": 150}


@router.post("/wallet/bailout")
def bailout(user: dict = Depends(get_current_user)):
    """500 SC rescue, only when the balance is under 200 SC."""
    if int(user["credits"]) >= 200:
        raise HTTPException(status_code=400, detail={"code": "NOT_ELIGIBLE", "message": "Bailout is for balances under 200 SC"})
    with get_db() as conn:
        balance = service.SkateBackendService.apply_credit_tx(conn, user["user_id"], "reward", "system", "Zero-Balance Bailout", 500, f"bailout_{user['user_id']}_{secrets.token_hex(4)}")
    return {"credits": balance, "granted": 500}


@router.post("/wallet/daily-reward")
def daily_reward(user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).date().isoformat()
    if user["last_streak_claim"] == today:
        raise HTTPException(status_code=400, detail={"code": "ALREADY_CLAIMED", "message": "Today's bonus already claimed"})
    amount = STREAK_REWARDS[(int(user["streak_day"]) - 1) % 7]
    with get_db() as conn:
        balance = service.SkateBackendService.apply_credit_tx(conn, user["user_id"], "reward", "system", f"Day {user['streak_day']} Streak", amount, f"streak_{user['user_id']}_{today}")
        new_day = (int(user["streak_day"]) % 7) + 1
        conn.execute("UPDATE users SET streak_day = ?, last_streak_claim = ? WHERE user_id = ?", (new_day, today, user["user_id"]))
        xp = apply_xp(conn, user["user_id"], 50)
    return {"credits": balance, "granted": amount, "streak_day": new_day, "xp": xp["xp"], "level": xp["level"]}


@router.post("/wallet/grant")
def grant(body: GrantRequest, user: dict = Depends(get_current_user)):
    """Client-attested mission/achievement reward.

    NOTE: mission progress itself is still tracked client-side, so this
    endpoint trusts the client's claim (logged + idempotent). Server-side
    mission validation is tracked follow-up work; amounts are capped and
    every grant is auditable in the ledger.
    """
    with get_db() as conn:
        balance = service.SkateBackendService.apply_credit_tx(
            conn, user["user_id"], "reward", "system", f"{body.kind.title()}: {body.ref}", body.amount, body.idempotency_key
        )
        conn.execute(
            "INSERT OR IGNORE INTO wallet_grants (grant_id, user_id, kind, ref, amount, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            ("gr_" + secrets.token_hex(6), user["user_id"], body.kind, body.ref, body.amount, body.idempotency_key, service.now_iso()),
        )
    return {"credits": balance, "granted": body.amount}
