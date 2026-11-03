"""End-to-end API smoke tests (no pytest needed).

Usage (from the repo root):

    python server/test_api.py

Uses a throwaway temp database and test secrets. Exits non-zero on the
first failed check.
"""

import os
import sys
import tempfile

TMP_DB = tempfile.NamedTemporaryFile(suffix=".db", delete=False).name
os.environ["SKATE_DB_PATH"] = TMP_DB
os.environ["SKATE_SERVER_SECRET"] = "test-server-secret"
os.environ["SKATE_JWT_SECRET"] = "test-jwt-secret"

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient  # noqa: E402

from server.app import app  # noqa: E402
from server.db import init_all  # noqa: E402

init_all()  # TestClient without a context manager skips startup events.

client = TestClient(app)
passed = []


def check(name: str, cond: bool, extra: str = "") -> None:
    assert cond, f"FAILED: {name} {extra}"
    passed.append(name)
    print(f"  ok: {name}")


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def main() -> None:
    print("== auth ==")
    r = client.post("/api/v1/auth/register", json={"username": "Tester", "email": "t@skate.test", "password": "Password123"})
    check("register 201", r.status_code == 201, r.text)
    token = r.json()["access_token"]
    check("registered credits 3000", r.json()["user"]["credits"] == 3000, r.text)
    r = client.post("/api/v1/auth/register", json={"username": "Tester", "email": "t@skate.test", "password": "Password123"})
    check("duplicate email 409", r.status_code == 409, r.text)
    r = client.post("/api/v1/auth/login", json={"email": "t@skate.test", "password": "wrongpass"})
    check("wrong password 401", r.status_code == 401, r.text)
    r = client.post("/api/v1/auth/login", json={"email": "t@skate.test", "password": "Password123"})
    check("login 200", r.status_code == 200, r.text)
    token = r.json()["access_token"]
    h = auth_header(token)
    r = client.get("/api/v1/me", headers=h)
    check("me 200 + username", r.status_code == 200 and r.json()["username"] == "Tester", r.text)
    r = client.get("/api/v1/me")
    check("no token 401", r.status_code == 401, r.text)

    print("== games ==")
    r = client.post("/api/v1/games/dice", json={"stake": 100, "mode": "over", "target": 50, "idempotency_key": "test-dice-1"}, headers=h)
    check("dice 200 + balance", r.status_code == 200 and "balance" in r.json(), r.text)
    r = client.post("/api/v1/games/dice", json={"stake": 100, "mode": "over", "target": 50, "idempotency_key": "test-dice-1"}, headers=h)
    check("duplicate dice 409", r.status_code == 409, r.text)
    r = client.post("/api/v1/games/dice", json={"stake": 5000, "mode": "over", "target": 50, "idempotency_key": "test-dice-2"}, headers=h)
    check("insufficient funds 400", r.status_code == 400 and r.json()["detail"]["code"] == "INSUFFICIENT_FUNDS", r.text)
    r = client.post("/api/v1/games/dice", json={"stake": 5, "mode": "over", "target": 50, "idempotency_key": "test-dice-3"}, headers=h)
    check("stake below min 422", r.status_code == 422, r.text)
    r = client.post("/api/v1/games/plinko", json={"stake": 100, "risk": "high", "idempotency_key": "test-plinko-1"}, headers=h)
    check("plinko 200", r.status_code == 200 and r.json()["multiplier"] in (15.0, 4.5, 1.8, 0.6, 0.3), r.text)
    r = client.post("/api/v1/games/mines", json={"stake": 100, "bombs": 5, "gems_picked": 3, "idempotency_key": "test-mines-1"}, headers=h)
    check("mines 200", r.status_code == 200 and r.json()["payout"] > 0, r.text)
    bal_before = client.get("/api/v1/me", headers=h).json()["credits"]
    r = client.post("/api/v1/games/mines/bomb", json={"stake": 100, "idempotency_key": "test-mines-bomb-1"}, headers=h)
    check("mines bomb debits stake", r.status_code == 200 and r.json()["payout"] == 0 and r.json()["balance"] == bal_before - 100, r.text)
    r = client.post("/api/v1/games/mines/bomb", json={"stake": 100, "idempotency_key": "test-mines-bomb-1"}, headers=h)
    check("duplicate bomb 409", r.status_code == 409, r.text)
    r = client.post("/api/v1/games/crash", json={"stake": 100, "bailout_mult": 1.5, "idempotency_key": "test-crash-1"}, headers=h)
    check("crash 200", r.status_code == 200 and "crash_point" in r.json(), r.text)
    r = client.post("/api/v1/games/reflex", json={"stake": 100, "stop_pos_pct": 50.0, "turbo": True, "idempotency_key": "test-reflex-1"}, headers=h)
    check("reflex 200 + 10x turbo bullseye", r.status_code == 200 and r.json()["multiplier"] == 10.0, r.text)

    print("== blackjack ==")
    r = client.post("/api/v1/games/blackjack/deal", json={"stake": 100, "idempotency_key": "test-bj-1"}, headers=h)
    check("blackjack deal 200", r.status_code == 200 and "hand_id" in r.json(), r.text)
    hand = r.json()
    if hand["status"] == "playing":
        r = client.post(f"/api/v1/games/blackjack/{hand['hand_id']}/action", json={"action": "stand"}, headers=h)
        check("blackjack stand settles", r.status_code == 200 and r.json()["status"] == "settled", r.text)
        r = client.post(f"/api/v1/games/blackjack/{hand['hand_id']}/action", json={"action": "hit"}, headers=h)
        check("settled hand rejects action", r.status_code == 400, r.text)
    else:
        check("blackjack instant settle (natural)", hand["status"] == "settled", str(hand))

    print("== wallet ==")
    r = client.post("/api/v1/wallet/faucet", headers=h)
    check("faucet +150", r.status_code == 200 and r.json()["granted"] == 150, r.text)
    r = client.post("/api/v1/wallet/faucet", headers=h)
    check("faucet hourly limit 429", r.status_code == 429, r.text)
    r = client.post("/api/v1/wallet/bailout", headers=h)
    check("bailout blocked when rich 400", r.status_code == 400, r.text)
    r = client.post("/api/v1/wallet/daily-reward", headers=h)
    check("daily reward 200", r.status_code == 200 and r.json()["granted"] in (250, 400, 600, 850, 1200, 1800, 3000), r.text)
    r = client.post("/api/v1/wallet/daily-reward", headers=h)
    check("daily reward twice 400", r.status_code == 400, r.text)
    r = client.get("/api/v1/ledger?limit=5", headers=h)
    check("ledger lists entries", r.status_code == 200 and r.json()["total"] >= 5, r.text)

    print("== fairness ==")
    r = client.get("/api/v1/fairness", headers=h)
    check("fairness hash", r.status_code == 200 and len(r.json()["server_seed_hash"]) == 64, r.text)
    old_hash = r.json()["server_seed_hash"]
    r = client.post("/api/v1/fairness/rotate", headers=h)
    check("rotate reveals old seed + new hash", r.status_code == 200 and r.json()["revealed_server_seed"] and r.json()["server_seed_hash"] != old_hash, r.text)

    print("== billing (dummy) ==")
    r = client.get("/api/v1/billing/plans")
    check("plans list", r.status_code == 200 and len(r.json()["plans"]) == 3, r.text)
    r = client.post("/api/v1/billing/checkout", json={"kind": "credits_pack", "ref": "pack_1000", "idempotency_key": "test-pay-1"}, headers=h)
    check("pack checkout succeeds", r.status_code == 200 and r.json()["payment"]["fake_receipt"].startswith("FAKE-"), r.text)
    bal_after = r.json()["balance"]
    r = client.post("/api/v1/billing/checkout", json={"kind": "credits_pack", "ref": "pack_1000", "idempotency_key": "test-pay-1"}, headers=h)
    check("duplicate checkout returns existing", r.status_code == 200 and r.json()["duplicate"] is True, r.text)
    r = client.post("/api/v1/billing/checkout", json={"kind": "subscription", "ref": "pro", "idempotency_key": "test-sub-1"}, headers=h)
    check("pro subscribe + bonus", r.status_code == 200 and r.json()["payment"]["ref"] == "pro", r.text)
    r = client.get("/api/v1/billing/subscriptions", headers=h)
    check("subscription active", r.status_code == 200 and r.json()["subscription"]["plan_id"] == "pro", r.text)
    r = client.post("/api/v1/billing/subscriptions/cancel", headers=h)
    check("subscription cancel", r.status_code == 200 and r.json()["subscription"]["status"] == "canceled", r.text)

    print(f"\nALL {len(passed)} CHECKS PASSED")


if __name__ == "__main__":
    main()
