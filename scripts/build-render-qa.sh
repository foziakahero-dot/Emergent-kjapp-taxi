#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "${APP_ENV:-}" != "qa" ]]; then
  echo 'This build command is for the isolated QA service only.' >&2
  exit 1
fi
pip install -r backend/requirements-render.txt
for panel in admin-web fleet-web; do
  (cd "$panel" && npm ci --no-audit --no-fund)
  VITE_PANEL_BASE="/api/qa-${panel%-web}/" node scripts/build-qa-panel.cjs "$panel"
done
