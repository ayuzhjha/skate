"""Seed a demo account for local review.

Usage (from the repo root):

    SKATE_SERVER_SECRET=dev-secret SKATE_JWT_SECRET=dev-jwt \
        python server/seed_demo.py

Creates demo@skate.app / Demo1234 (10,000 SC) if it does not exist yet.
Play money only; never use these credentials anywhere real.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import skate_backend_server as service
from server.db import get_db, init_all


def main() -> None:
    init_all()
    with get_db() as conn:
        existing = conn.execute("SELECT user_id FROM users WHERE email = ?", ("demo@skate.app",)).fetchone()
    if existing:
        print("Demo account already exists: demo@skate.app")
        return
    created = service.SkateBackendService.create_or_register_user("DemoSkater", "demo@skate.app", "Demo1234", is_guest=False)
    with get_db() as conn:
        balance = service.SkateBackendService.apply_credit_tx(conn, created["user_id"], "reward", "system", "Demo top-up", 7000, "demo_topup_1")
    print(f"Demo account ready: demo@skate.app / Demo1234, balance {balance} SC")


if __name__ == "__main__":
    main()
