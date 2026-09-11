#!/usr/bin/env bash
# KJAPP — build the mobile app (web bundle + Capacitor sync + optional native build)
#
#   ./scripts/build-mobile.sh https://api.kjappapp.no            # web + sync only
#   ./scripts/build-mobile.sh https://api.kjappapp.no apk        # + signed/unsigned release APK
#   ./scripts/build-mobile.sh https://api.kjappapp.no aab        # + Play Store bundle
#   ./scripts/build-mobile.sh https://api.kjappapp.no ios        # + open Xcode (macOS only)
#
# Requires Node >= 22 (Capacitor 8 CLI), and for native builds: JDK 17 + Android SDK, or Xcode.
set -euo pipefail

API_URL="${1:-}"
TARGET="${2:-sync}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND="$ROOT/frontend"

if [ -z "$API_URL" ]; then
  echo "Bruk: ./scripts/build-mobile.sh <API_URL> [apk|aab|ios|sync]"
  echo "Eksempel: ./scripts/build-mobile.sh https://api.kjappapp.no apk"
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "FEIL: Capacitor 8 krever Node >= 22 (du har $(node -v)). Bruk nvm: nvm install 22 && nvm use 22"
  exit 1
fi

echo "==> 1/3 Bygger web-laget mot $API_URL"
cd "$FRONTEND"
yarn install --frozen-lockfile
REACT_APP_BACKEND_URL="$API_URL" GENERATE_SOURCEMAP=false yarn build

echo "==> 2/3 Synker til native prosjekter"
npx cap sync

case "$TARGET" in
  apk)
    echo "==> 3/3 Bygger release-APK"
    cd "$FRONTEND/android"
    ./gradlew assembleRelease
    echo "APK: $FRONTEND/android/app/build/outputs/apk/release/"
    ;;
  aab)
    echo "==> 3/3 Bygger Play Store-bundle"
    cd "$FRONTEND/android"
    ./gradlew bundleRelease
    echo "AAB: $FRONTEND/android/app/build/outputs/bundle/release/"
    ;;
  ios)
    echo "==> 3/3 Åpner Xcode (arkivér med Product > Archive)"
    npx cap open ios
    ;;
  *)
    echo "==> Ferdig. Åpne prosjektet: npx cap open android  |  npx cap open ios"
    ;;
esac
