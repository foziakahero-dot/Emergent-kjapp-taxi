#!/usr/bin/env python3
"""Deterministically restore the approved Phase 2B backend/server.py guard hunks.

This is a one-time recovery helper. It starts from the locked Backend source already
present on the recovery branch, extracts only explicitly approved hunks from the
three historical guard commits, applies them, and verifies the final Git blob SHA.
It intentionally excludes old CORS and offer_trip_to_next_driver hunks.
"""
from __future__ import annotations

import hashlib
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / "backend/server.py"
TARGET = "b62557eef59b9b4e6f7a52a5ab7b528626bf350c"

COMMITS = [
    (
        "e3d1f0650a41d889f4f09efdd32e944de186478c",
        ["_twofa_required_role", "twofa_disable", "require_admin", "require_superadmin"],
    ),
    (
        "eb8ccdd64910864507076bcf18e6ef182409b831",
        ["storage_delete", "lifespan", "health", "readiness", "reset_password", "customer_public", "driver_accept", "driver_current", "require_superadmin"],
    ),
    (
        "f66c5e85351d08304f28576f12ceb730a3ed659e",
        ["_load_trip_or_403", "download_file"],
    ),
]


def run(*args: str, input_text: str | None = None, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=ROOT,
        input=input_text,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=check,
    )


def git_blob_sha(data: bytes) -> str:
    header = f"blob {len(data)}\0".encode()
    return hashlib.sha1(header + data).hexdigest()


def filtered_patch(commit: str, accepted_headers: list[str]) -> str:
    raw = run("git", "show", "--format=", "--no-ext-diff", "--unified=3", commit, "--", "backend/server.py").stdout
    lines = raw.splitlines(keepends=True)
    prefix: list[str] = []
    hunks: list[list[str]] = []
    current: list[str] | None = None
    for line in lines:
        if line.startswith("@@ "):
            if current is not None:
                hunks.append(current)
            current = [line]
        elif current is None:
            prefix.append(line)
        else:
            current.append(line)
    if current is not None:
        hunks.append(current)

    selected: list[list[str]] = []
    for hunk in hunks:
        header = hunk[0]
        if any(name in header for name in accepted_headers):
            selected.append(hunk)

    if not selected:
        raise RuntimeError(f"No approved hunks found in {commit}")

    # Keep the normal diff headers/index lines so git apply can perform 3-way fallback.
    return "".join(prefix + [line for hunk in selected for line in hunk])


def apply_one(commit: str, headers: list[str]) -> None:
    patch = filtered_patch(commit, headers)
    proc = run("git", "apply", "--3way", "--whitespace=nowarn", "-", input_text=patch, check=False)
    if proc.returncode != 0:
        # Some guards can already exist in the later Backend source. Retry as a normal
        # context apply before deciding this recovery is unsafe.
        proc2 = run("git", "apply", "--whitespace=nowarn", "--reject", "-", input_text=patch, check=False)
        if proc2.returncode != 0:
            print(f"FAILED applying approved hunks from {commit}", file=sys.stderr)
            print(proc.stderr, file=sys.stderr)
            print(proc2.stderr, file=sys.stderr)
            raise SystemExit(20)


# Confirm the working file starts from the locked Backend blob.
start = git_blob_sha(SERVER.read_bytes())
expected_source = "92c0a76e2cea2c46f096ea4478c0c1b89a3c4fea"
if start != expected_source:
    raise SystemExit(f"Unexpected backend/server.py source blob: {start} != {expected_source}")

for commit, headers in COMMITS:
    apply_one(commit, headers)

# Phase 2B explicitly retained the newest Backend offer_trip_to_next_driver implementation.
# Any reject file means a patch was not cleanly and deterministically applied.
rejects = list(ROOT.glob("**/*.rej"))
if rejects:
    raise SystemExit("Recovery produced reject files: " + ", ".join(str(p.relative_to(ROOT)) for p in rejects))

final = git_blob_sha(SERVER.read_bytes())
print(f"backend/server.py recovered blob: {final}")
if final != TARGET:
    raise SystemExit(f"Recovered server hash mismatch: {final} != {TARGET}")
print("PASS: backend/server.py is byte-identical to the recorded Phase 2B final blob")
