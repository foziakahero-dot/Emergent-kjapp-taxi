#!/usr/bin/env python3
"""Non-destructive KJAPP release smoke test.

Usage:
  KJAPP_SMOKE_API=https://github-app-builder-28.emergent.host python backend/scripts/release_smoke.py
  KJAPP_SMOKE_API=https://api.kjappapp.no KJAPP_SMOKE_STRICT=true python backend/scripts/release_smoke.py

No users, trips, payments or documents are created.
"""

import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


BASE = os.environ.get("KJAPP_SMOKE_API", "https://github-app-builder-28.emergent.host").rstrip("/")
STRICT = os.environ.get("KJAPP_SMOKE_STRICT", "false").strip().lower() in {"1", "true", "yes", "on"}
TIMEOUT = float(os.environ.get("KJAPP_SMOKE_TIMEOUT", "12"))


def get(path: str):
    req = Request(f"{BASE}{path}", headers={"User-Agent": "KJAPP-release-smoke/1.0", "Accept": "application/json"})
    try:
        with urlopen(req, timeout=TIMEOUT) as response:
            body = response.read().decode("utf-8")
            return response.status, json.loads(body)
    except HTTPError as exc:
        try:
            body = json.loads(exc.read().decode("utf-8"))
        except Exception:
            body = {"detail": str(exc)}
        return exc.code, body
    except (URLError, TimeoutError) as exc:
        return 0, {"detail": str(exc)}


def check(name: str, condition: bool, detail, required: bool = True):
    marker = "PASS" if condition else ("FAIL" if required else "WARN")
    print(f"[{marker}] {name}: {detail}")
    return condition or not required


def main() -> int:
    ok = True

    status, health = get("/api/health")
    ok &= check("health endpoint", status == 200 and health.get("db") is True, health)

    status, ready = get("/api/ready")
    ok &= check("deployment readiness", status == 200 and ready.get("ready") is True, ready)
    if STRICT:
        ok &= check(
            "new bookings are open",
            ready.get("checks", {}).get("booking_enabled") is True,
            ready.get("checks", {}),
        )

    status, area = get("/api/service-area")
    ok &= check(
        "Oslo service area",
        status == 200 and area.get("launch_city") == "Oslo",
        area,
    )
    if STRICT:
        ok &= check("Oslo service-area enforcement", area.get("enforced") is True, area)

    status, apple = get("/api/auth/apple/config")
    ok &= check("Apple auth endpoint", status == 200, apple)
    ok &= check(
        "native Apple auth configured",
        apple.get("enabled") is True and apple.get("bundle_id") == "no.kjapp.app",
        apple,
        required=STRICT,
    )

    status, push = get("/api/push/native-config")
    ok &= check(
        "native push sender",
        status == 200 and push.get("enabled") is True and push.get("provider") == "expo",
        push,
        required=STRICT,
    )

    print(f"\nTarget: {BASE}")
    print("Release smoke:", "PASSED" if ok else "FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
