# SNAR Release Checklist

This checklist is mandatory for Driver beta release. Check marks require evidence; compilation alone is not runtime acceptance.

## A. Source / branch integrity
- [ ] Release branch and exact commit SHA recorded.
- [ ] No unrelated Customer/Admin/Fleet redesign included.
- [ ] Diff reviewed for secrets and generated junk.
- [ ] User-facing Driver branding is SNAR.
- [ ] Internal legacy IDs changed only when migration/signing impact is understood.

## B. P0 authentication
- [ ] Driver login accepts only Driver role.
- [ ] Unapproved/disabled/inactive-fleet Driver is rejected.
- [ ] Session restore validates `/auth/me`.
- [ ] Invalid/expired token fails closed.
- [ ] Logout stops background location, unregisters push and removes local token.

## C. P0 vehicle / fleet gate
- [ ] Assigned vehicles load from backend.
- [ ] Unassigned vehicle cannot be selected.
- [ ] Driver cannot go online without valid selected vehicle.
- [ ] Vehicle conflict rules are server-enforced.

## D. P0 GPS / online
- [ ] Foreground GPS permission is granted before ONLINE is presented as successful.
- [ ] Fresh real GPS is recorded immediately at shift start.
- [ ] Denied/unavailable GPS keeps/forces Driver offline.
- [ ] Background location starts for online shift where permission is granted.
- [ ] Stale GPS removes Driver from supply.
- [ ] Offline/logout stops background location.

## E. P0 trip lifecycle
- [ ] Real pending offer received.
- [ ] Push/offer not duplicated.
- [ ] Only one Driver can win accept under concurrency.
- [ ] Accept timeout/lost response reconciles through canonical current-trip state.
- [ ] `driver_on_way` works.
- [ ] `at_pickup` works.
- [ ] `start` works.
- [ ] `arrive/complete` works.
- [ ] Finished trip no longer appears active.
- [ ] Driver can receive another trip after completion.
- [ ] App restart recovers an active trip.
- [ ] Network loss during a critical action never shows false success.

## F. P1 active-trip UX
- [ ] Active command surface can be minimized.
- [ ] Minimized trip can be restored.
- [ ] `trip_id` is preserved.
- [ ] GPS continues while minimized.
- [ ] Minimized state survives supported navigation/restart behavior.

## G. Communication / navigation
- [ ] Assigned Customer call action tested.
- [ ] Driver↔Customer chat authorization tested.
- [ ] Google Maps navigation tested on Android.
- [ ] Apple Maps tested on iOS where selected.
- [ ] Waze fallback tested where supported.

## H. Push
- [ ] Expo/native push token registration succeeds.
- [ ] New-trip push arrives while app is backgrounded.
- [ ] Locked-screen notification arrives.
- [ ] Notification tap returns to Driver flow.
- [ ] Sound preference respected.
- [ ] Vibration preference respected subject to OS policy.
- [ ] Logout removes device subscription best-effort.

## I. Identity / profile / earnings
- [ ] Active fleet + vehicle shown correctly.
- [ ] Profile photo upload tested.
- [ ] Identity verification status shown correctly.
- [ ] Selfie upload tested if enabled for beta.
- [ ] Today/weekly earnings match backend values.
- [ ] Payout/Stripe Connect status matches backend/fleet ledger.

## J. Error handling
- [ ] Offline error is Norwegian and actionable.
- [ ] Timeout error is Norwegian and actionable.
- [ ] 401 handling tested.
- [ ] 403 handling tested.
- [ ] 409 handling tested.
- [ ] 422 handling tested.
- [ ] 429 handling tested.
- [ ] 500 handling does not expose raw `Internal Server Error`.
- [ ] 503 handling is understandable and retry-safe.

## K. Static/native validation
- [ ] `npm ci` passes in `driver-app`.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npx expo-doctor@latest` passes or every exception is documented.
- [ ] `npx expo config --type public` resolves expected package/bundle/project IDs.
- [ ] No secret values printed to logs.

## L. Android build — P0
- [ ] EAS account/project confirmed.
- [ ] Build profile: `apk`.
- [ ] Backend: `https://api.kjappapp.no`.
- [ ] Android package remains the registered package unless an approved migration is performed.
- [ ] EAS build ID recorded.
- [ ] EAS build URL recorded.
- [ ] Installer APK downloaded.
- [ ] APK installs on a physical Android device.
- [ ] Cold launch succeeds.

## M. Android physical ride — P0
- [ ] Login.
- [ ] Vehicle.
- [ ] Online + GPS.
- [ ] Customer sees real supply.
- [ ] Offer/push.
- [ ] Accept.
- [ ] Pickup.
- [ ] Start.
- [ ] Message/call.
- [ ] Background/foreground recovery.
- [ ] Arrive/complete.
- [ ] Active trip disappears.
- [ ] Driver returns to next-work state.
- [ ] Offline.

## N. iOS / TestFlight
- [ ] Bundle/team/capabilities resolve.
- [ ] iOS build profile chosen (`ios-internal` for internal install or `testflight-beta` for store/TestFlight).
- [ ] Build ID/URL recorded.
- [ ] Physical launch succeeds.
- [ ] Location/background/push behavior tested.
- [ ] Apple Sign-In tested only if exposed/configured.

## Hard release blockers
Do not call the Driver release ready if any of the following is true:
- app crashes on launch,
- login broken,
- Driver can bypass role/approval,
- cannot go online with real GPS,
- stale GPS appears as available supply,
- cannot receive/accept/start/complete a real test trip,
- finished trip remains active,
- duplicate assignment is possible,
- cross-driver/trip authorization is broken,
- production/server secret is exposed,
- no installable Android APK has been produced and installed.

## Release record
Branch:

Commit:

Backend:

Android EAS build ID:

Android URL:

iOS EAS build ID:

iOS/TestFlight URL:

P0 open:

P1 open:

Physical test device/OS:

Tester/date:
