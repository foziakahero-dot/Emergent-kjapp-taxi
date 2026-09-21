#!/usr/bin/env bash
set -euo pipefail

echo "== KJAPP beta release gate =="

echo "[1/6] Customer Expo config + TypeScript"
(cd frontend && npm install --no-audit --no-fund && npx expo config --type public >/dev/null && npx tsc --noEmit)

echo "[2/6] Driver Expo config + TypeScript"
(cd driver-app && npm install --no-audit --no-fund && npx expo config --type public >/dev/null && npx tsc --noEmit)

echo "[3/6] Admin build"
(cd admin-web && npm install --no-audit --no-fund && npm run build)

echo "[4/6] Fleet build"
(cd fleet-web && npm install --no-audit --no-fund && npm run build)

echo "[5/6] Backend tests"
python -m pytest backend/tests -q

if [[ "${RUN_STAGING_E2E:-0}" == "1" ]]; then
  echo "[6/6] Full staging ride flow"
  python backend/scripts/e2e_driver_flow.py
else
  echo "[6/6] Staging ride flow skipped (set RUN_STAGING_E2E=1)"
fi

cat <<'EOF'
Physical-device gate still required:
Customer cold launch → login → GPS → estimate → booking
Driver cold launch → login → online → offer → accept → pickup → start → arrive
Customer payment/receipt → rating
Background/foreground both apps
Locked-screen push
No FATAL EXCEPTION in adb logcat / iOS Device Logs
EOF
