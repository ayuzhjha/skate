"""Dummy payments and subscriptions — play money only.

No real payment gateway is integrated and no card data is ever collected
or stored: checkout takes only a pack/plan id and instantly records a
FAKE successful payment. Subscriptions grant a monthly SC bonus and can
be cancelled any time. If real billing is ever added, this whole module
must be replaced by a real provider integration (Stripe/Razorpay) with
webhook signature verification — never by bolting card fields onto it.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

import skate_backend_server as service
from server.auth import get_current_user
from server.db import get_db

router = APIRouter(prefix="/api/v1/billing", tags=["billing"])

PLANS = {
    "free": {"plan_id": "free", "name": "Free", "price_display": "₹0", "monthly_sc": 0},
    "pro": {"plan_id": "pro", "name": "Pro", "price_display": "₹199/mo", "monthly_sc": 5000},
    "vip": {"plan_id": "vip", "name": "VIP", "price_display": "₹499/mo", "monthly_sc": 15000},
}

PACKS = {
    "pack_1000": {"pack_id": "pack_1000", "sc": 1000, "price_display": "₹49"},
    "pack_10000": {"pack_id": "pack_10000", "sc": 10000, "price_display": "₹299"},
    "pack_50000": {"pack_id": "pack_50000", "sc": 50000, "price_display": "₹999"},
}


class CheckoutRequest(BaseModel):
    kind: str = Field(pattern=r"^(credits_pack|subscription)$")
    ref: str = Field(min_length=1, max_length=64)
    idempotency_key: str = Field(min_length=6, max_length=128)


def _period_end() -> str:
    return (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()


@router.get("/plans")
def plans():
    return {
        "plans": list(PLANS.values()),
        "packs": list(PACKS.values()),
        "notice": "Dummy checkout: no real money moves and no card data is collected.",
    }


@router.get("/payments")
def payments(limit: int = 50, user: dict = Depends(get_current_user)):
    limit = max(1, min(limit, 200))
    with get_db() as conn:
        rows = conn.execute(
            """SELECT payment_id, kind, ref, amount_sc, amount_display, status, fake_receipt, created_at
               FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT ?""",
            (user["user_id"], limit),
        ).fetchall()
    return {"payments": [dict(r) for r in rows]}


@router.get("/subscriptions")
def subscription(user: dict = Depends(get_current_user)):
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
            (user["user_id"],),
        ).fetchone()
    if row is None:
        return {"subscription": None}
    return {"subscription": dict(row)}


@router.post("/checkout")
def checkout(body: CheckoutRequest, user: dict = Depends(get_current_user)):
    """Instant FAKE success: records the payment and applies its effect."""
    with get_db() as conn:
        existing = conn.execute("SELECT * FROM payments WHERE idempotency_key = ?", (body.idempotency_key,)).fetchone()
        if existing:
            return {"payment": dict(existing), "duplicate": True}
        if body.kind == "credits_pack":
            pack = PACKS.get(body.ref)
            if pack is None:
                raise HTTPException(status_code=422, detail={"code": "VALIDATION", "message": "Unknown credits pack"})
            balance = service.SkateBackendService.apply_credit_tx(conn, user["user_id"], "purchase", "system", f"Credits pack: {pack['pack_id']}", pack["sc"], f"pay_{body.idempotency_key}")
            payment = {
                "payment_id": "pay_" + secrets.token_hex(8),
                "kind": body.kind, "ref": body.ref, "amount_sc": pack["sc"],
                "amount_display": pack["price_display"], "status": "succeeded",
                "fake_receipt": "FAKE-" + secrets.token_hex(6).upper(),
            }
        else:
            plan = PLANS.get(body.ref)
            if plan is None:
                raise HTTPException(status_code=422, detail={"code": "VALIDATION", "message": "Unknown plan"})
            conn.execute("UPDATE subscriptions SET status = 'canceled' WHERE user_id = ? AND status = 'active'", (user["user_id"],))
            conn.execute(
                "INSERT INTO subscriptions (sub_id, user_id, plan_id, status, current_period_end, created_at) VALUES (?, ?, ?, 'active', ?, ?)",
                ("sub_" + secrets.token_hex(8), user["user_id"], plan["plan_id"], _period_end(), service.now_iso()),
            )
            balance = None
            if plan["monthly_sc"]:
                balance = service.SkateBackendService.apply_credit_tx(conn, user["user_id"], "reward", "system", f"Subscription bonus: {plan['plan_id']}", plan["monthly_sc"], f"pay_{body.idempotency_key}")
            payment = {
                "payment_id": "pay_" + secrets.token_hex(8),
                "kind": body.kind, "ref": body.ref, "amount_sc": plan["monthly_sc"],
                "amount_display": plan["price_display"], "status": "succeeded",
                "fake_receipt": "FAKE-" + secrets.token_hex(6).upper(),
            }
        conn.execute(
            """INSERT INTO payments (payment_id, user_id, kind, ref, amount_sc, amount_display, status, fake_receipt, idempotency_key, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (payment["payment_id"], user["user_id"], payment["kind"], payment["ref"], payment["amount_sc"],
             payment["amount_display"], payment["status"], payment["fake_receipt"], body.idempotency_key, service.now_iso()),
        )
    return {"payment": payment, "balance": balance, "duplicate": False}


@router.post("/subscriptions/cancel")
def cancel_subscription(user: dict = Depends(get_current_user)):
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
            (user["user_id"],),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "No active subscription"})
        conn.execute("UPDATE subscriptions SET status = 'canceled' WHERE sub_id = ?", (row["sub_id"],))
    return {"subscription": {"plan_id": row["plan_id"], "status": "canceled", "current_period_end": row["current_period_end"]}}
