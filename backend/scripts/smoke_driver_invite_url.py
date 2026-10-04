#!/usr/bin/env python3
import os
import sys
import urllib.error
import urllib.request

base = os.environ.get("KJAPP_PUBLIC_URL", "https://fleet.kjappapp.no").rstrip("/")
url = f"{base}/driver-signup/__ci_smoke__"

req = urllib.request.Request(url, headers={"User-Agent": "KJAPP-CI/1.0"})
try:
    with urllib.request.urlopen(req, timeout=15) as response:
        status = response.getcode()
except urllib.error.HTTPError as exc:
    status = exc.code
except Exception as exc:
    print(f"Invite route smoke failed: {exc}", file=sys.stderr)
    raise SystemExit(1)

if status != 200:
    print(f"Expected HTTP 200 for SPA invite route, got {status}: {url}", file=sys.stderr)
    raise SystemExit(1)

print(f"OK {status} {url}")
