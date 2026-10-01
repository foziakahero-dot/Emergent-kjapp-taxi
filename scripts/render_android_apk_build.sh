#!/usr/bin/env bash
set -euo pipefail

# This hook only runs on the temporary Render artifact builder.
if [ "${RENDER_SERVICE_ID:-}" != "srv-davbp0mgekts73dejo6g" ]; then
  echo "KJAPP APK hook skipped outside artifact builder"
  exit 0
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CACHE="/tmp/kjapp-android-toolchain"
JAVA_HOME="$CACHE/jdk"
ANDROID_HOME="$CACHE/android-sdk"
ANDROID_SDK_ROOT="$ANDROID_HOME"
export JAVA_HOME ANDROID_HOME ANDROID_SDK_ROOT
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
export EXPO_PUBLIC_BACKEND_URL="https://api.kjappapp.no"
export CI=1

mkdir -p "$CACHE" "$ROOT/lock-export"

if [ ! -x "$JAVA_HOME/bin/java" ]; then
  echo "Installing Temurin JDK 17..."
  rm -rf "$JAVA_HOME"
  mkdir -p "$JAVA_HOME"
  curl -fL --retry 3 --retry-delay 2     "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse"     -o "$CACHE/jdk17.tar.gz"
  tar -xzf "$CACHE/jdk17.tar.gz" -C "$JAVA_HOME" --strip-components=1
fi

if [ ! -x "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]; then
  echo "Installing Android command-line tools..."
  rm -rf "$ANDROID_HOME"
  mkdir -p "$ANDROID_HOME/cmdline-tools"
  curl -fL --retry 3 --retry-delay 2     "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"     -o "$CACHE/cmdline-tools.zip"
  rm -rf "$CACHE/cmdline-tools"
  unzip -q "$CACHE/cmdline-tools.zip" -d "$CACHE/cmdline-tools"
  mv "$CACHE/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
fi

echo "Accepting Android SDK licenses..."
yes | sdkmanager --licenses >/dev/null || true

echo "Installing Android SDK packages..."
sdkmanager   "platform-tools"   "platforms;android-36"   "build-tools;36.0.0"   "cmake;3.22.1"   "ndk;27.1.12297006"

build_app() {
  local app_dir="$1"
  local out_name="$2"
  echo "=== Building $out_name from $app_dir ==="
  cd "$ROOT/$app_dir"
  npx expo prebuild --platform android --clean
  cd android
  chmod +x ./gradlew
  ./gradlew assembleRelease --no-daemon --stacktrace
  local apk="app/build/outputs/apk/release/app-release.apk"
  test -s "$apk"
  cp "$apk" "$ROOT/lock-export/$out_name"
  sha256sum "$ROOT/lock-export/$out_name" | tee "$ROOT/lock-export/$out_name.sha256"
}

build_app "frontend" "KJAPP-Customer-beta.apk"
build_app "driver-app" "KJAPP-Driver-beta.apk"

echo "KJAPP_APK_BUILD_OK"
