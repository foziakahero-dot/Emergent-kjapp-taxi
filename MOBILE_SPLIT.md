# KJAPP mobile split

KJAPP now has two independent Expo app workspaces that share the same FastAPI/MongoDB backend.

## Customer app

Path: `frontend/`

- App name: `KJAPP`
- Expo slug: `kjapp`
- Android package: `no.kjapp.app`
- iOS bundle identifier: `no.nexorahub.kjapp.customer`
- Expo project ID: `3631002e-5b25-4847-b5d8-05ec2ef304b5`
- EAS build profile: `apk`
- EAS workflow: `frontend/.eas/workflows/build-apk.yml`
- Accepts customer roles only (`user` / `customer` / no explicit role)
- Driver/admin/fleet roles are rejected from the customer app

## Driver app

Path: `driver-app/`

- App name: `KJAPP Driver`
- Expo slug: `kjapp-driver`
- Android package: `no.kjapp.driver`
- iOS bundle identifier: `no.nexorahub.kjapp.driver`
- Expo project ID: `1dec8949-0423-4fbf-a080-0703f93519d7`
- EAS build profile: `apk`
- EAS workflow: `driver-app/.eas/workflows/build-apk.yml`
- Accepts `driver` role only
- Customer/admin/fleet roles are rejected from the driver app

## Shared production backend

Both mobile apps use:

`https://github-app-builder-28.emergent.host/api`

The backend, MongoDB data model and admin control center remain shared. This split only separates the mobile application identities, navigation and release pipelines.

## Release model

Customer and Driver are built and released independently. Both can be installed on the same phone because they use different Android application IDs and iOS bundle identifiers. A Driver update does not require a Customer release, and vice versa.
