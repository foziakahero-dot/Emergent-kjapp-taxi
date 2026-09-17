# KJAPP P0 beta hardening

Scope: only P0 tasks from the beta-preparation document. No P1/P2 product work, UI redesign, auth redesign or business-rule changes are included.

## 1. Android runtime stability

Changed:
- `frontend/app.json`: `newArchEnabled` disabled for beta builds.
- `driver-app/app.json`: `newArchEnabled` disabled for beta builds.
- Both Babel configs remain Expo-only; no manually duplicated Worklets Babel plugin is added.
- Repository search contains no `react-native-worklets-core` dependency.
- `@sentry/react-native` added to Customer and Driver.
- `frontend/src/lib/monitoring.ts` and `driver-app/src/lib/monitoring.ts` initialize native crash monitoring before app runtime.
- Crash telemetry is disabled until `EXPO_PUBLIC_SENTRY_DSN` is configured. No DSN or secret is committed.

Why:
- Reduce Android JSI/Reanimated risk for the beta while preserving the existing React Native/Expo architecture.
- Capture native/runtime crashes during physical-device testing without collecting default PII.

## 2. Android background location and push

Changed:
- Driver permission flow requests foreground location first.
- On the first online shift that needs background location, the driver sees a Norwegian explanation before Android's background-location prompt.
- Background location remains tied to the existing Expo Location foreground service.
- Driver Settings now contains a battery/background-running guide with Samsung/Xiaomi guidance and a shortcut to app settings.
- Existing FCM sender was verified to use Android high priority and the `kjapp_trips` notification channel; no duplicate push implementation was introduced.

Android service note:
- Expo Location already generates the Android foreground location service and `FOREGROUND_SERVICE_LOCATION` permission for the configured background-location plugin. The service remains a `location` foreground service. We did not add an unrelated `dataSync` service type because KJAPP Driver's foreground service performs location tracking, not a separate data-sync foreground service.

## 3. SSE realtime with polling fallback

Backend:
- Existing backend implementation is preserved unchanged in `backend/server_core.py`.
- `backend/server.py` is a thin compatibility entrypoint that installs P0 SSE routes and re-exports the established backend.
- `backend/sse_runtime.py` adds authenticated `StreamingResponse` endpoints:
  - `GET /api/sse/customer/cars?lat=...&lng=...`
  - `GET /api/sse/customer/trips/{trip_id}`
  - `GET /api/sse/driver/events`
- Streams emit changed snapshots, send keepalive comments, stop on disconnect and do not expose server exception details.

Mobile:
- `frontend/src/lib/realtime.ts` and `driver-app/src/lib/realtime.ts` implement a Bearer-authenticated SSE transport using the React Native XHR runtime; no extra EventSource library is introduced.
- Customer nearby cars and active trip status prefer SSE.
- Driver pending offers and active trip status prefer SSE.
- Existing REST calls remain the automatic fallback whenever SSE is disconnected, unavailable or has not delivered initial data.
- Existing screen timers are retained as fallback/read cadence; when SSE is healthy they read the cached stream snapshot instead of creating a new HTTP request for the realtime resource.

Important:
- The target of lower request overhead and faster updates is implemented architecturally, but a specific percentage reduction is not claimed until load-tested.

## Required configuration before physical beta testing

- Set `EXPO_PUBLIC_SENTRY_DSN` for Customer and Driver if crash telemetry is required for the test build.
- Ensure existing Firebase/FCM production credentials are valid for `no.kjapp.app` and `no.kjapp.driver`.

## Physical Android P0 checklist

1. Install fresh Customer and Driver APKs on physical Android devices and cold-launch both.
2. Verify neither app crashes before/after login; specifically exercise map screens and transitions that use Reanimated/Worklets.
3. Customer: login, location permission, nearby cars, destination search and price estimate.
4. Driver: login and go ONLINE. Verify foreground permission appears first, then KJAPP explanation, then background permission.
5. Lock the Driver phone for several minutes while online and confirm backend location continues to update.
6. On Samsung/Xiaomi-class battery management, follow the in-app battery guide, lock screen and repeat background GPS test.
7. Create a real test trip: Customer request -> Driver receives offer -> accept -> at pickup -> start -> arrive/complete -> Customer receipt.
8. With Driver app backgrounded/locked, verify high-priority trip notification arrives. Repeat with app process closed if device/OS permits.
9. During an active trip, confirm Customer sees driver/status updates from SSE without manual refresh.
10. Interrupt SSE/network temporarily and confirm the apps continue updating through REST polling fallback after reconnection/failure.
11. Restart both apps during an active trip and confirm the active-trip state is restored.
12. If Sentry DSN is configured, verify a controlled test exception/crash appears in the correct Customer/Driver project before relying on telemetry.

The Android runtime-crash fix must not be declared confirmed solely from a green compilation/build. Physical launch and end-to-end testing are still required.
