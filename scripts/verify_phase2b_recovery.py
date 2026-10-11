#!/usr/bin/env python3
from __future__ import annotations

import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

TARGETS = {
    "backend/server.py": "b62557eef59b9b4e6f7a52a5ab7b528626bf350c",
    "backend/requirements-ci.txt": "eb918f65d558960ed985be3df518fe31c5cf7115",
    "backend/tests/test_beta_trip_integrity_contract.py": "8db6c09d38efbb71a88130f8705aa82db0a352b1",
    "backend/tests/test_beta_trip_lifecycle_contract.py": "f07442072f81f25604fea0b3a14814d0604c65c1",
    "backend/tests/test_fleet_live_identity_contract.py": "2eb6aeb0ca135f794606eb3cd29b5d0b3c7ff456",
    "backend/tests/test_mobile_server_truth_contract.py": "e06ea51470fb9fd61c08a4ca0412594bc8af3948",
    "backend/tests/test_navigation_settings_unit.py": "4590c7f3584c27abe03ed1f639d3f8fe9d4e5079",
    "backend/tests/test_receipt_identity_recheck_contract.py": "8fea06ab47ad87d99d94ea460ea18ee5267849ad",
    "backend/tests/test_security_regressions_unit.py": "dbb6e916eb8938e4e0721646b4175943630a52f6",
    "frontend/app.config.js": "ba6eabbba9f54be5595cd87a21308adf5f8784c9",
    "frontend/customer-build-gate.json": "4195272b88d974e43477822aac53e0588fc290ce",
    "driver-app/src/lib/nativeRuntime.ts": "0568079056c8930b0f98cdfce9e24ea91262ec2c",
    "driver-app/app.config.js": "1bc214eccf81ffb61e974aa7f3af5ad0c288058b",
    ".github/workflows/ios-build.yml": "06fff6900ac711d757e73e955802dc4cf395a4a8",
}

MUST_BE_ABSENT = [
    "backend/scripts/migrate_mongo_copy.py",
    "frontend/src/components/RuntimeGuard.tsx",
    "driver-app/src/components/RuntimeGuard.tsx",
    "scripts/run_eas_beta_builds.ps1",
    "scripts/beta_local_gate.ps1",
    ".github/workflows/beta-live-e2e.yml",
    ".github/workflows/customer-eas-crashfix.yml",
    ".github/workflows/customer-reservation-navigation-apk.yml",
    ".github/workflows/driver-snar-apk.yml",
    ".github/workflows/eas-android-beta.yml",
    ".github/workflows/eas-ios-release.yml",
    ".github/workflows/figma-mobile-audit.yml",
    ".github/workflows/kjapp-eas-update.yml",
    ".github/workflows/snar-customer-apk-once.yml",
    ".github/workflows/snar-customer-eas-apk.yml",
    "driver-app/.eas/workflows/ios-internal-20261004.yml",
    "driver-app/.eas/workflows/release-native-20261004.yml",
    "frontend/.eas/workflows/driver-local-apk.yml",
    "frontend/.eas/workflows/unified-internal-apks.yml",
]


def git_blob_sha(data: bytes) -> str:
    return hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()


bad = 0
for rel, expected in TARGETS.items():
    path = ROOT / rel
    if not path.is_file():
        print(f"MISSING  {rel} expected={expected}")
        bad += 1
        continue
    actual = git_blob_sha(path.read_bytes())
    state = "PASS" if actual == expected else "MISMATCH"
    print(f"{state:8} {rel} actual={actual} expected={expected}")
    bad += actual != expected

for rel in MUST_BE_ABSENT:
    exists = (ROOT / rel).exists()
    print(f"{'FAIL' if exists else 'PASS':8} absent {rel}")
    bad += exists

if bad:
    raise SystemExit(f"Phase 2B recovery NOT certified: {bad} invariant(s) unresolved")
print("PHASE 2B HASH RECOVERY PASS")
