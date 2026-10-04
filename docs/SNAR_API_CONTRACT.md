# SNAR API Contract — Driver surfaces

This document records endpoints called by the current Driver app. It does not invent endpoints. Public beta base URL is currently `https://api.kjappapp.no`; the Axios client prefixes `/api`.

## Authentication

### POST `/api/auth/login`
Auth: none.
Caller: Driver login.
Request fields used by Driver: `email` (e-mail or phone identifier), `password`, `client: "driver"`, `device_id`.
Response used by Driver: session `token`, `user`, or `twofa_required` challenge.
Important server rule: Driver client lookup is role-restricted to `driver`; approved state is also enforced by app/session gates.

### GET `/api/auth/me`
Auth: Bearer.
Caller: Driver `AuthContext.refresh()`.
Response: canonical current user including Driver role/approval/fleet/vehicle/identity fields.
Client rule: token is removed if response is not role `driver` with `approved=true`.

### POST `/api/auth/logout`
Auth: Bearer.
Caller: Driver logout.
Response: logout acknowledgement.
Client also stops background location, unregisters push and removes local token.

### POST `/api/auth/forgot-password`
Auth: none.
Request: `{ email, client: "driver" }`.
Caller: forgot-password screen.

### GET `/api/auth/reset-password/{token}`
Auth: reset token in path.
Caller: reset flow token validation.

### POST `/api/auth/reset-password`
Request: `{ token, new_password }`.
Caller: reset flow.

### POST `/api/auth/accept-legal`
Auth: Bearer.
Request: `{ accepted_terms: true, legal_version }`.
Caller: Driver legal consent.

### GET `/api/auth/native/config?client=driver`
Auth: none.
Caller: native identity configuration.
Response includes enabled Google/native client configuration when server environment is configured.

### POST `/api/auth/google/native`
Auth: native identity token.
Request includes `identity_token`, `client: "driver"`, optional `device_id`.
Server must not create an unapproved Driver account.

### POST `/api/auth/apple/native`
Auth: Apple identity token.
Request includes `identity_token`, `client: "driver"`, optional `device_id`.
Server validates Driver Apple audience/bundle configuration.

## Driver availability and GPS

### POST `/api/driver/online`
Auth: approved Driver.
Request: `{ online: boolean }`.
Server gate: valid Driver role/approval, active fleet, assigned active vehicle and operational compliance. Client must not present ONLINE until the request succeeds and GPS requirements are satisfied.

### POST `/api/driver/location`
Auth: approved Driver.
Request used by current client: `{ lat, lng, heading, speed, recorded_at }`.
Purpose: real Driver GPS heartbeat for dispatch/Customer visibility.
No fabricated coordinate fallback is permitted.

### GET `/api/driver/summary/today`
Auth: approved Driver.
Caller: Driver home summary/online reconciliation.

## Trip offers and lifecycle

### GET `/api/driver/pending`
Auth: approved Driver.
Caller: Driver home polling/background fallback.
Response may include pending offer collection and GPS-stale state.

### POST `/api/driver/accept`
Auth: approved online Driver.
Request: `{ trip_id }`.
Server is authoritative for assignment/concurrency. Client reconciles an ambiguous transport result through `/api/driver/current`.

### POST `/api/driver/decline`
Auth: approved Driver.
Request: `{ trip_id }`.

### GET `/api/driver/current`
Auth: approved Driver.
Purpose: canonical active Driver trip and ambiguous-action recovery.

### POST `/api/driver/trip/{id}/at-pickup`
Auth: assigned Driver.
Purpose: transition from `driver_on_way` to pickup state subject to server rules/GPS.

### POST `/api/driver/trip/{id}/start`
Auth: assigned Driver.
Purpose: start the passenger trip subject to canonical state.

### POST `/api/driver/trip/{id}/arrive`
Auth: assigned Driver.
Purpose: complete Driver-side active movement/arrival subject to state/GPS rules.

### POST `/api/driver/trip/{id}/no-show`
Auth: assigned Driver.
Purpose: server-gated no-show flow.

### GET `/api/trips/{id}`
Auth: trip participant/authorized user.
Caller: shared trip lookup surfaces where applicable.

### GET `/api/trips/active`
Auth: authenticated user.
Caller: shared active trip client surface.

## Driver history / earnings

### GET `/api/driver/history`
Auth: approved Driver.
Purpose: Driver trip history.

### GET `/api/driver/history/weekly`
Auth: approved Driver.
Purpose: weekly history/summary.

### GET `/api/driver/ratings`
Auth: approved Driver.
Purpose: Driver rating data.

### GET `/api/driver/payouts`
Auth: approved Driver.
Purpose: server-authoritative settlement/earnings state. Client normalizes missing legacy fields but must not invent successful payout state.

## Fleet vehicle identity

### GET `/api/driver/vehicles`
Auth: approved Driver.
Purpose: vehicles assigned to current Driver/fleet.

### POST `/api/driver/vehicles/{vehicle_id}/select`
Auth: approved Driver.
Purpose: select from authorized fleet-assigned vehicles. Server remains authoritative and may reject online/active-trip/conflict selection.

## Driver profile / identity

### POST `/api/driver/profile-photo`
Auth: approved Driver.
Body: multipart image file.
Purpose: update Driver profile photo.

### GET `/api/driver/identity-verification`
Auth: approved Driver.
Purpose: canonical identity/selfie status.

### POST `/api/driver/identity-verification/selfie`
Auth: approved Driver.
Body: multipart image file.
Purpose: submit identity selfie for backend review/verification workflow.

## Driver↔Customer messaging

### GET `/api/trips/{tripId}/messages`
Auth: authorized trip participant.
Purpose: list scoped trip messages.

### POST `/api/trips/{tripId}/messages`
Auth: authorized trip participant.
Request: `{ text }`.
Purpose: send scoped trip message.

## Safety

### POST `/api/trips/{tripId}/safety`
Auth: authorized trip participant.
Request used by Driver: `{ kind, note?, lat?, lng? }`, including emergency events.

### POST `/api/trips/{tripId}/share-link`
Auth: authorized trip participant.
Purpose: create trip share link where exposed.

## Push

### POST `/api/push/native-subscribe`
Auth: authenticated Driver.
Request used by Driver: `{ platform, provider: "expo", token }`.
Purpose: register native Expo/FCM/APNs delivery token.

### POST `/api/push/native-unsubscribe`
Auth: authenticated Driver.
Purpose: remove device push registration on logout.

## Settings / GDPR

### GET `/api/settings`
Auth: authenticated user.
Purpose: Driver settings including navigation preference/notification settings where supported.

### PATCH `/api/settings`
Auth: authenticated user.
Purpose: update supported settings.

### GET `/api/gdpr/export`
Auth: authenticated user.
Purpose: export user data.

### DELETE `/api/gdpr/delete`
Auth: authenticated user.
Purpose: account deletion flow subject to backend rules.

## Contract rules
1. Mobile UI never overrides canonical backend trip/payment/authorization state.
2. A transport timeout is not proof that a mutation failed; idempotent/canonical reads must reconcile critical actions.
3. Raw server 500 text must not be shown directly to Driver.
4. Driver app must never receive server secrets.
5. Any endpoint added later must be documented here before being treated as a release contract.