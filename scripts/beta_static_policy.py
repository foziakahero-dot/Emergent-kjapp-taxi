#!/usr/bin/env python3
"""Static KJAPP beta release policy checks.

No network, database, credentials or production data are used.
This intentionally validates the existing product identity/configuration without redesigning it.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
failures: list[str] = []
warnings: list[str] = []


def fail(message: str):
    failures.append(message)


def warn(message: str):
    warnings.append(message)


def read(path: str) -> str:
    p = ROOT / path
    if not p.exists():
        fail(f"Missing required file: {path}")
        return ""
    return p.read_text(encoding="utf-8")


def read_json(path: str):
    try:
        return json.loads(read(path))
    except Exception as exc:
        fail(f"Invalid JSON in {path}: {exc}")
        return {}


def require_text(path: str, needle: str, label: str | None = None):
    if needle not in read(path):
        fail(label or f"{path} must contain {needle!r}")


def forbid_text(path: str, needle: str, label: str | None = None):
    if needle in read(path):
        fail(label or f"{path} must not contain {needle!r}")


# --- Mobile app identity ----------------------------------------------------
customer = read_json("frontend/app.json").get("expo", {})
driver = read_json("driver-app/app.json").get("expo", {})

if customer.get("scheme") != "kjapp":
    fail("Customer scheme must remain 'kjapp'")
if customer.get("ios", {}).get("bundleIdentifier") != "no.nexorahub.kjapp.customer":
    fail("Customer iOS bundleIdentifier must be no.nexorahub.kjapp.customer")
if customer.get("android", {}).get("package") != "no.kjapp.app":
    fail("Customer Android package must be no.kjapp.app")
if customer.get("extra", {}).get("eas", {}).get("projectId") != "3631002e-5b25-4847-b5d8-05ec2ef304b5":
    fail("Customer EAS projectId changed unexpectedly")

if driver.get("scheme") != "kjapp-driver":
    fail("Driver scheme must remain 'kjapp-driver'")
if driver.get("ios", {}).get("bundleIdentifier") != "no.nexorahub.kjapp.driver":
    fail("Driver iOS bundleIdentifier must be no.nexorahub.kjapp.driver")
if driver.get("android", {}).get("package") != "no.kjapp.driver":
    fail("Driver Android package must be no.kjapp.driver")
if driver.get("extra", {}).get("eas", {}).get("projectId") != "1dec8949-0423-4fbf-a080-0703f93519d7":
    fail("Driver EAS projectId changed unexpectedly")

# --- EAS API targets -------------------------------------------------------
for path in ("frontend/eas.json", "driver-app/eas.json"):
    cfg = read_json(path)
    beta_url = cfg.get("build", {}).get("testflight-beta", {}).get("env", {}).get("EXPO_PUBLIC_BACKEND_URL")
    prod_url = cfg.get("build", {}).get("production", {}).get("env", {}).get("EXPO_PUBLIC_BACKEND_URL")
    if beta_url != "https://github-app-builder-28.emergent.host":
        fail(f"{path}: TestFlight beta must target the currently controlled beta backend")
    if prod_url != "https://api.kjappapp.no":
        fail(f"{path}: production profile must target the KJAPP-owned API hostname")

# --- Canonical support/legal URLs in live mobile code ---------------------
live_mobile_files = [
    "frontend/app/settings.tsx",
    "frontend/app/(app)/profile.tsx",
    "frontend/app/register.tsx",
    "frontend/app/legal-consent.tsx",
    "driver-app/app/driver-settings.tsx",
    "driver-app/app/driver-legal-consent.tsx",
]
for path in live_mobile_files:
    text = read(path)
    if "support@kjapp.no" in text:
        fail(f"{path}: stale support@kjapp.no address remains")
    if "https://kjapp.no/" in text:
        fail(f"{path}: stale kjapp.no URL remains")

require_text("marketing-web/src/App.tsx", 'path="/help"', "Marketing must expose /help")
require_text("marketing-web/src/App.tsx", 'path="/personvern"', "Marketing must expose /personvern")
require_text("marketing-web/src/App.tsx", 'path="/vilkar"', "Marketing must expose /vilkar")
require_text("marketing-web/src/App.tsx", 'path="/reset-password/:token"', "Marketing must expose reset-password fallback")

# --- Beta safety invariants ------------------------------------------------
require_text("backend/server.py", 'KJAPP_AUTO_CHARGE_ENABLED", "false"', "Auto-charge must default OFF")
require_text("backend/server.py", 'demo_data_enabled', "Production demo-data safety helper missing")
require_text("backend/server.py", '@api.post("/client-errors"', "Client error telemetry endpoint missing")
require_text("backend/server.py", '@api.get("/admin/beta-health")', "Admin beta-health endpoint missing")
require_text("backend/server.py", '@api.get("/ready")', "Deployment readiness endpoint missing")
require_text("backend/server.py", '_enforce_rate_limit', "Backend rate limiting helper missing")
require_text("backend/server.py", 'CURRENT_LEGAL_VERSION', "Server-controlled legal version gate missing")
require_text("backend/server.py", '@api.get("/auth/legal-config")', "Public legal configuration endpoint missing")

require_text("frontend/app/_layout.tsx", "installClientErrorMonitor", "Customer error monitor not installed")
require_text("driver-app/app/_layout.tsx", "installClientErrorMonitor", "Driver error monitor not installed")
require_text("frontend/app/_layout.tsx", 'name="forgot-password"', "Customer forgot-password route missing")
require_text("driver-app/app/_layout.tsx", 'name="forgot-password"', "Driver forgot-password route missing")
require_text("frontend/app/_layout.tsx", 'name="legal-consent"', "Customer legal consent route missing")
require_text("driver-app/app/_layout.tsx", 'name="driver-legal-consent"', "Driver legal consent route missing")

for path in (
    "docs/INCIDENT_RUNBOOK.md",
    "docs/PHYSICAL_BETA_QA.md",
    "docs/BETA_ENVIRONMENT_CHECKLIST.md",
    "docs/STORE_RELEASE_PACK.md",
    "BACKEND_MIGRATION_PLAN.md",
    "BETA_READINESS_REPORT.md",
):
    read(path)

# Final legal text is intentionally a public-launch blocker, not silently fabricated here.
legal = read("marketing-web/src/LegalPage.tsx")
if "Endelig juridisk godkjent" in legal:
    warn("Privacy/terms routes still contain beta placeholder text; OK for controlled beta, BLOCKER for public commercial release.")

print("KJAPP static beta policy")
for item in warnings:
    print(f"WARN: {item}")
for item in failures:
    print(f"FAIL: {item}")
if failures:
    print(f"RESULT: FAILED ({len(failures)} issue(s))")
    sys.exit(1)
print("RESULT: PASSED")
