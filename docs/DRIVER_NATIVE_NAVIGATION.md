# Driver in-app navigation (Android)

Implementation branch based on QA c80afd7. Driver runtime/app version 1.0.2.

## Behavior

- Naviger starts the local SnarNavigation Expo module on Android. Other platforms,
  or binaries without the module, retain the existing external navigation path.
- Before pickup, route only to the booked pickup coordinates. During the trip,
  preserve the ordered passenger stops and booked destination. Invalid points
  block navigation rather than silently omitting stops. Arrival never completes
  a trip or confirms payment automatically.
- Mapbox Navigation SDK 3.31.1 (NDK 27 artifacts) supplies real location matching,
  route progress, voice-instruction events and automatic off-route rerouting.
  The existing Maps SDK remains 11.31.1. The map follows at street-level zoom;
  panning temporarily suspends camera following, with the existing recenter control.
- Native instructions are spoken using Android text-to-speech, requesting nb-NO.
  Actual Norwegian voice availability must be tested on the phone. No Mapbox Voice
  API credential or MP3-generation service is added.
- The instruction panel shows remaining distance/time, mute, return-to-trip and
  Google Maps/Waze fallback. The navigation settings select the external fallback.
- A changed trip, phase, destination or stops invalidates the native session.
  Old request callbacks cannot install routes into the replacement session.
  Unmount cleans up native observers, trip session and speech resources.
- Exact foreground and background location permission and a fresh GPS fix are
  required before starting. This addresses the previously silent permission
  failure for navigation; it does not prove the reported background GPS stall is
  solved. Existing Expo on-shift background reporting remains responsible for
  backend supply GPS while native SDK navigation runs.

## Configuration and distribution

Use the existing EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN (public pk token). No token is
stored in source. SDK dependencies are pinned in the local module's Gradle file.
Expo autolinking discovers modules/snar-navigation automatically.

Native code requires a new Driver Android APK. Do not distribute this native
change to runtime 1.0.1 with EAS Update. Customer is unchanged. No QA/production
backend, database, fee, account, Google/Apple or Twilio configuration is changed.
Mapbox navigation usage is subject to the account's existing billing agreement;
no plan upgrade or purchase has been performed by this implementation.

## Verification and release gates

Run `node --test scripts/driver-navigation.test.cjs`, Driver TypeScript, Android
Expo prebuild, and `npx expo-modules-autolinking resolve --platform android`.

The implementation is a draft until native Gradle compilation succeeds. Local
Gradle bootstrap currently fails fetching gradle-9.3.1-bin.zip with Network is
unreachable; an Android SDK is also absent in this workspace. Prebuild and JS
tests are not a native compilation result.

Before merge/release: compile the actual Driver APK, inspect the merged manifest
and SDK dependency resolution; verify pickup and multi-stop destination on a
physical phone; reroute, audio/mute, phone lock/background, process lifecycle,
network interruption and external fallback. Confirm fresh GPS still reaches QA
and the customer's live car remains visible while navigating. Test memory,
battery and responsiveness on the target low-end Android phone. Do not claim
Uber-equivalent performance, offline navigation or physical ride approval.

iOS continues using Google Maps/Apple Maps/Waze. A native iOS Navigation SDK
integration is not included in this Android change and requires separate work
and an iOS build.
