#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_URL="${EXPO_PUBLIC_BACKEND_URL:-https://github-app-builder-28.emergent.host}"

build_app() {
  local label="$1"
  local dir="$2"

  echo "=== Building KJAPP ${label} ==="
  cd "$ROOT/$dir"
  export EXPO_PUBLIC_BACKEND_URL="$API_URL"
  export CI=1

  npm ci
  npx expo prebuild --platform android --clean
  cd android
  chmod +x ./gradlew
  ./gradlew assembleDebug --no-daemon

  echo "=== ${label} APK ready ==="
}

build_app "Customer" "frontend"
build_app "Driver" "driver-app"
