"""Server-authoritative blackjack.

A full 6-deck shoe game: dealer hits soft 17, 3:2 naturals, double,
surrender, split (including split-aces stand after one card) and insurance.
Hands live in the ``blackjack_hands`` table so a hand survives disconnects;
every credit movement goes through the service's idempotent ledger, so a
retried request can never pay twice.

This is play money (SC = Skate Credits). Nothing here touches real money.
"""

from __future__ import annotations

import json
import secrets
import sqlite3
from typing import Any

import skate_backend_server as service
from server.db import get_db

RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
SUITS = ["♠", "♥", "♦", "♣"]
NUM_DECKS = 6


def new_shoe() -> list[dict]:
    rng = secrets.SystemRandom()
    shoe = [{"rank": r, "suit": s} for _ in range(NUM_DECKS) for s in SUITS for r in RANKS]
    rng.shuffle(shoe)
    return shoe


def hand_value(cards: list[dict]) -> tuple[int, bool]:
    total = 0
    aces = 0
    for c in cards:
        r = c["rank"]
        if r == "A":
            aces += 1
            total += 11
        elif r in ("J", "Q", "K"):
            total += 10
        else:
            total += int(r)
    soft = False
    while total > 21 and aces:
        total -= 10
        aces -= 1
    if aces:
        soft = True
    return total, soft


def is_blackjack(cards: list[dict]) -> bool:
    total, _ = hand_value(cards)
    return len(cards) == 2 and total == 21


def _new_hand(cards: list[dict], stake: int) -> dict:
    return {"cards": cards, "stake": stake, "status": "active", "actions": 0, "doubled": False}


def _current_hand(player: list[dict]) -> dict | None:
    for h in player:
        if h["status"] == "active":
            return h
    return None


def _all_hands_done(player: list[dict]) -> bool:
    return all(h["status"] != "active" for h in player)


def _save(conn: sqlite3.Connection, row_id: str, shoe, player, dealer, hidden, insurance, status, result) -> None:
    conn.execute(
        """UPDATE blackjack_hands SET shoe_json=?, player_json=?, dealer_json=?,
           dealer_hole_hidden=?, insurance_json=?, status=?, result_json=?, updated_at=?
           WHERE hand_id=?""",
        (
            json.dumps(shoe),
            json.dumps(player),
            json.dumps(dealer),
            int(hidden),
            json.dumps(insurance) if insurance is not None else None,
            status,
            json.dumps(result) if result is not None else None,
            service.now_iso(),
            row_id,
        ),
    )


def public_view(row: sqlite3.Row) -> dict:
    player = json.loads(row["player_json"])
    dealer = json.loads(row["dealer_json"])
    hidden = bool(row["dealer_hole_hidden"])
    if hidden and len(dealer) >= 2:
        dealer_view = [dealer[0], {"rank": "?", "suit": "?"}]
    else:
        dealer_view = dealer
    return {
        "hand_id": row["hand_id"],
        "status": row["status"],
        "player_hands": [
            {"cards": h["cards"], "stake": h["stake"], "status": h["status"], "total": hand_value(h["cards"])[0]}
            for h in player
        ],
        "dealer": {"cards": dealer_view, "total": None if hidden else hand_value(dealer)[0]},
        "insurance": json.loads(row["insurance_json"]) if row["insurance_json"] else None,
        "insurance_offered": row["status"] == "awaiting_insurance",
        "result": json.loads(row["result_json"]) if row["result_json"] else None,
    }


def _settle(conn: sqlite3.Connection, user_id: str, row: sqlite3.Row) -> dict:
    """Play the dealer out and settle every hand. Caller owns the transaction."""
    shoe = json.loads(row["shoe_json"])
    player = json.loads(row["player_json"])
    dealer = json.loads(row["dealer_json"])
    insurance = json.loads(row["insurance_json"]) if row["insurance_json"] else None
    hand_id = row["hand_id"]

    dealer_bj = is_blackjack(dealer)
    player_natural = len(player) == 1 and is_blackjack(player[0]["cards"])
    if not dealer_bj and not player_natural:
        while True:
            total, soft = hand_value(dealer)
            if total < 17 or (total == 17 and soft):
                dealer.append(shoe.pop())
            else:
                break
    dealer_total, _ = hand_value(dealer)

    results = []
    net_total = 0
    for i, h in enumerate(player):
        stake = int(h["stake"])
        if h["status"] == "surrendered":
            payout = stake // 2  # already refunded at surrender time
            outcome = "surrendered"
            net = payout - stake
        elif h["status"] == "bust":
            payout, outcome, net = 0, "lose", -stake
        elif is_blackjack(h["cards"]) and len(player) == 1:
            if dealer_bj:
                payout, outcome, net = stake, "push", 0
            else:
                payout, outcome, net = round(stake * 2.5), "blackjack", round(stake * 2.5) - stake
        elif dealer_bj:
            payout, outcome, net = 0, "lose", -stake
        else:
            total, _ = hand_value(h["cards"])
            if total > dealer_total:
                payout, outcome, net = 2 * stake, "win", stake
            elif total == dealer_total:
                payout, outcome, net = stake, "push", 0
            else:
                payout, outcome, net = 0, "lose", -stake
        if h["status"] != "surrendered":
            if payout > 0:
                service.SkateBackendService.apply_credit_tx(conn, user_id, "bet", "blackjack", f"Blackjack {outcome}", payout, f"{hand_id}_pay_{i}")
            h["status"] = "settled"
        results.append({"hand": i, "outcome": outcome, "payout": payout, "net": net})
        net_total += net

    insurance_payout = 0
    if insurance and insurance.get("taken") and dealer_bj:
        # Insurance pays 2:1 profit plus the stake back.
        insurance_payout = 3 * int(insurance["stake"])
        service.SkateBackendService.apply_credit_tx(conn, user_id, "bet", "blackjack", "Insurance payout", insurance_payout, f"{hand_id}_ins_pay")
        net_total += 2 * int(insurance["stake"])

    balance = conn.execute("SELECT credits FROM users WHERE user_id = ?", (user_id,)).fetchone()["credits"]
    result = {"hands": results, "dealer_total": dealer_total, "dealer_blackjack": dealer_bj,
              "insurance_payout": insurance_payout, "net": net_total, "balance": int(balance)}
    _save(conn, hand_id, shoe, player, dealer, False, insurance, "settled", result)
    return result


def deal(user_id: str, stake: int, idempotency_key: str) -> dict:
    with get_db() as conn:
        balance = service.SkateBackendService.apply_credit_tx(conn, user_id, "bet", "blackjack", "Blackjack wager", -stake, idempotency_key)
        shoe = new_shoe()
        player_cards = [shoe.pop(), shoe.pop()]
        dealer_cards = [shoe.pop(), shoe.pop()]
        player = [_new_hand(player_cards, stake)]
        dealer_bj = is_blackjack(dealer_cards)
        player_bj = is_blackjack(player_cards)
        hand_id = "bj_" + secrets.token_hex(8)
        ts = service.now_iso()
        if dealer_bj and dealer_cards[0]["rank"] == "A":
            # Dealer ace up: offer insurance before revealing.
            status, result, hidden = "awaiting_insurance", None, True
        elif dealer_bj or player_bj:
            status, result, hidden = "settled", None, False
        else:
            status, result, hidden = "playing", None, True
        conn.execute(
            """INSERT INTO blackjack_hands (hand_id, user_id, shoe_json, player_json, dealer_json,
               dealer_hole_hidden, insurance_json, status, result_json, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?)""",
            (hand_id, user_id, json.dumps(shoe), json.dumps(player), json.dumps(dealer_cards),
             int(hidden), status, ts, ts),
        )
        row = conn.execute("SELECT * FROM blackjack_hands WHERE hand_id = ?", (hand_id,)).fetchone()
        if status == "settled":
            result = _settle(conn, user_id, row)
            row = conn.execute("SELECT * FROM blackjack_hands WHERE hand_id = ?", (hand_id,)).fetchone()
        view = public_view(row)
        # For immediately-settled hands the settled result holds the true
        # post-payout balance; the pre-settle balance would be stale.
        view["balance"] = int(result["balance"]) if status == "settled" else int(balance)
        return view


def _load_for_user(conn: sqlite3.Connection, user_id: str, hand_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM blackjack_hands WHERE hand_id = ? AND user_id = ?", (hand_id, user_id)).fetchone()
    if row is None:
        raise KeyError("hand not found")
    return row


def act(user_id: str, hand_id: str, action: str) -> dict:
    with get_db() as conn:
        row = _load_for_user(conn, user_id, hand_id)
        if row["status"] == "settled":
            raise ValueError("Hand already settled")
        shoe = json.loads(row["shoe_json"])
        player = json.loads(row["player_json"])
        dealer = json.loads(row["dealer_json"])
        insurance = json.loads(row["insurance_json"]) if row["insurance_json"] else None

        if row["status"] == "awaiting_insurance":
            if action == "insurance":
                main_stake = int(player[0]["stake"])
                ins_stake = main_stake // 2
                service.SkateBackendService.apply_credit_tx(conn, user_id, "bet", "blackjack", "Insurance bet", -ins_stake, f"{hand_id}_ins")
                insurance = {"taken": True, "stake": ins_stake}
            elif action == "decline_insurance":
                insurance = {"taken": False, "stake": 0}
            else:
                raise ValueError("Dealer ace up: choose insurance or decline_insurance first")
            if is_blackjack(dealer):
                _save(conn, hand_id, shoe, player, dealer, True, insurance, "settled", None)
                row = conn.execute("SELECT * FROM blackjack_hands WHERE hand_id = ?", (hand_id,)).fetchone()
                _settle(conn, user_id, row)
            else:
                _save(conn, hand_id, shoe, player, dealer, True, insurance, "playing", None)
            row = conn.execute("SELECT * FROM blackjack_hands WHERE hand_id = ?", (hand_id,)).fetchone()
            view = public_view(row)
            view["balance"] = int(conn.execute("SELECT credits FROM users WHERE user_id = ?", (user_id,)).fetchone()["credits"])
            return view

        hand = _current_hand(player)
        if hand is None:
            raise ValueError("No active hand")
        hand_idx = next(i for i, h in enumerate(player) if h is hand)
        first_action = hand["actions"] == 0 and len(hand["cards"]) == 2

        if action == "hit":
            hand["cards"].append(shoe.pop())
            hand["actions"] += 1
            total, _ = hand_value(hand["cards"])
            if total > 21:
                hand["status"] = "bust"
        elif action == "stand":
            hand["status"] = "stood"
            hand["actions"] += 1
        elif action == "double":
            if not first_action:
                raise ValueError("Double is only available as the first action")
            service.SkateBackendService.apply_credit_tx(conn, user_id, "bet", "blackjack", "Double down", -int(hand["stake"]), f"{hand_id}_dbl_{hand_idx}")
            hand["stake"] = int(hand["stake"]) * 2
            hand["doubled"] = True
            hand["cards"].append(shoe.pop())
            hand["actions"] += 1
            total, _ = hand_value(hand["cards"])
            hand["status"] = "bust" if total > 21 else "stood"
        elif action == "surrender":
            if not first_action:
                raise ValueError("Surrender is only available as the first action")
            refund = int(hand["stake"]) // 2
            service.SkateBackendService.apply_credit_tx(conn, user_id, "bet", "blackjack", "Surrender refund", refund, f"{hand_id}_sur_{hand_idx}")
            hand["status"] = "surrendered"
            hand["actions"] += 1
        elif action == "split":
            if not first_action or hand["cards"][0]["rank"] != hand["cards"][1]["rank"]:
                raise ValueError("Split requires a pair as the first action")
            service.SkateBackendService.apply_credit_tx(conn, user_id, "bet", "blackjack", "Split wager", -int(hand["stake"]), f"{hand_id}_spl_{hand_idx}")
            is_aces = hand["cards"][0]["rank"] == "A"
            idx = hand_idx
            h1 = _new_hand([hand["cards"][0], shoe.pop()], int(hand["stake"]))
            h2 = _new_hand([hand["cards"][1], shoe.pop()], int(hand["stake"]))
            if is_aces:
                # Split aces: one card each, then stand automatically.
                h1["status"] = "stood"
                h2["status"] = "stood"
            player[idx:idx + 1] = [h1, h2]
        else:
            raise ValueError(f"Unknown action: {action}")

        if _all_hands_done(player):
            _save(conn, hand_id, shoe, player, dealer, True, insurance, "settled", None)
            row = conn.execute("SELECT * FROM blackjack_hands WHERE hand_id = ?", (hand_id,)).fetchone()
            _settle(conn, user_id, row)
        else:
            _save(conn, hand_id, shoe, player, dealer, True, insurance, "playing", None)
        row = conn.execute("SELECT * FROM blackjack_hands WHERE hand_id = ?", (hand_id,)).fetchone()
        view = public_view(row)
        view["balance"] = int(conn.execute("SELECT credits FROM users WHERE user_id = ?", (user_id,)).fetchone()["credits"])
        return view


def get_hand(user_id: str, hand_id: str) -> dict:
    with get_db() as conn:
        row = _load_for_user(conn, user_id, hand_id)
        view = public_view(row)
        view["balance"] = int(conn.execute("SELECT credits FROM users WHERE user_id = ?", (user_id,)).fetchone()["credits"])
        return view
