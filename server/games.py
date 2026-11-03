"""Game endpoints: server-authoritative settlement for all six games.

The five luck/reflex games reuse the validation service, which derives
outcomes from the player's committed seeds — the server, not the client,
decides the result. Blackjack runs its own state machine (server/blackjack.py).

Every endpoint requires an idempotency key so a retried request settles
exactly once. Stakes are enforced at 10–5,000 SC.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

import skate_backend_server as service
from server import blackjack
from server.auth import get_current_user
from server.db import apply_xp, get_db

router = APIRouter(prefix="/api/v1/games", tags=["games"])


def _xp_for(net: int) -> int:
    return 35 if net > 0 else (15 if net < 0 else 20)


def _apply_game_xp(user_id: str, net: int) -> dict:
    with get_db() as conn:
        return apply_xp(conn, user_id, _xp_for(net))


class BasePlay(BaseModel):
    stake: int = Field(ge=10, le=5000)
    idempotency_key: str = Field(min_length=6, max_length=128)


class PlinkoPlay(BasePlay):
    risk: str = Field(pattern=r"^(low|high)$")


class MinesPlay(BasePlay):
    bombs: int = Field(ge=1, le=24)
    gems_picked: int = Field(ge=0, le=24)


class DicePlay(BasePlay):
    mode: str = Field(pattern=r"^(over|under)$")
    target: int = Field(ge=1, le=99)


class CrashPlay(BasePlay):
    bailout_mult: float = Field(ge=1.01, le=1000.0)


class ReflexPlay(BasePlay):
    stop_pos_pct: float = Field(ge=0.0, le=100.0)
    turbo: bool = False


class BlackjackDeal(BasePlay):
    pass


class BlackjackAction(BaseModel):
    action: str = Field(pattern=r"^(hit|stand|double|surrender|split|insurance|decline_insurance)$")


def _service_error(exc: ValueError) -> HTTPException:
    msg = str(exc)
    if msg.startswith("Duplicate request blocked"):
        return HTTPException(status_code=409, detail={"code": "DUPLICATE", "message": msg})
    if "Insufficient virtual credits" in msg:
        return HTTPException(status_code=400, detail={"code": "INSUFFICIENT_FUNDS", "message": msg})
    return HTTPException(status_code=400, detail={"code": "GAME_ERROR", "message": msg})


@router.post("/plinko")
def plinko(body: PlinkoPlay, user: dict = Depends(get_current_user)):
    try:
        result = service.SkateBackendService.validate_plinko_drop(user["user_id"], body.stake, body.risk, body.idempotency_key)
    except ValueError as exc:
        raise _service_error(exc)
    result["xp"] = _apply_game_xp(user["user_id"], result["payout"] - body.stake)
    return result


@router.post("/mines/bomb")
def mines_bomb(body: BasePlay, user: dict = Depends(get_current_user)):
    """Settle a mines round ended by a bomb: the stake is debited, payout 0.

    Without this, a bomb hit would end the round with the wallet untouched
    (the cashout endpoint is the only place the stake was debited) — a
    freeroll. Minefield placement itself is still client-side (see the
    README's known limitations); this endpoint closes the loss-settlement
    gap for honest clients.
    """
    with get_db() as conn:
        row = conn.execute("SELECT nonce FROM users WHERE user_id = ?", (user["user_id"],)).fetchone()
        nonce = int(row["nonce"]) + 1
        conn.execute("UPDATE users SET nonce = ? WHERE user_id = ?", (nonce, user["user_id"]))
        try:
            balance = service.SkateBackendService.apply_credit_tx(
                conn, user["user_id"], "bet", "mines", f"Mines bomb loss #{nonce}", -body.stake, body.idempotency_key
            )
        except ValueError as exc:
            raise _service_error(exc)
        xp = apply_xp(conn, user["user_id"], 15)
    return {"game": "mines", "nonce": nonce, "hit_bomb": True, "payout": 0, "balance": balance, "xp": xp}


@router.post("/mines")
def mines(body: MinesPlay, user: dict = Depends(get_current_user)):
    if body.gems_picked > 25 - body.bombs:
        raise HTTPException(status_code=422, detail={"code": "VALIDATION", "message": "gems_picked cannot exceed safe tiles"})
    try:
        result = service.SkateBackendService.validate_mines_cashout(user["user_id"], body.stake, body.bombs, body.gems_picked, body.idempotency_key)
    except ValueError as exc:
        raise _service_error(exc)
    result["xp"] = _apply_game_xp(user["user_id"], result["payout"] - body.stake)
    return result


@router.post("/dice")
def dice(body: DicePlay, user: dict = Depends(get_current_user)):
    try:
        result = service.SkateBackendService.validate_neon_dice(user["user_id"], body.stake, body.mode, body.target, body.idempotency_key)
    except ValueError as exc:
        raise _service_error(exc)
    result["xp"] = _apply_game_xp(user["user_id"], result["payout"] - body.stake)
    return result


@router.post("/crash")
def crash(body: CrashPlay, user: dict = Depends(get_current_user)):
    try:
        result = service.SkateBackendService.validate_ollie_crash(user["user_id"], body.stake, body.bailout_mult, body.idempotency_key)
    except ValueError as exc:
        raise _service_error(exc)
    result["xp"] = _apply_game_xp(user["user_id"], result["payout"] - body.stake)
    return result


@router.post("/reflex")
def reflex(body: ReflexPlay, user: dict = Depends(get_current_user)):
    try:
        result = service.SkateBackendService.validate_precision_grind(user["user_id"], body.stake, body.stop_pos_pct, body.turbo, body.idempotency_key)
    except ValueError as exc:
        raise _service_error(exc)
    result["xp"] = _apply_game_xp(user["user_id"], result["payout"] - body.stake)
    return result


@router.post("/blackjack/deal")
def blackjack_deal(body: BlackjackDeal, user: dict = Depends(get_current_user)):
    try:
        return blackjack.deal(user["user_id"], body.stake, body.idempotency_key)
    except ValueError as exc:
        raise _service_error(exc)


@router.post("/blackjack/{hand_id}/action")
def blackjack_action(hand_id: str, body: BlackjackAction, user: dict = Depends(get_current_user)):
    try:
        return blackjack.act(user["user_id"], hand_id, body.action)
    except KeyError:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Hand not found"})
    except ValueError as exc:
        raise _service_error(exc)


@router.get("/blackjack/{hand_id}")
def blackjack_get(hand_id: str, user: dict = Depends(get_current_user)):
    try:
        return blackjack.get_hand(user["user_id"], hand_id)
    except KeyError:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Hand not found"})
