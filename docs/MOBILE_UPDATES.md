# SNAR mobile updates

Customer and Driver use separate existing Expo projects. Each has `qa` and
`production` update channels. QA builds and TestFlight QA use `preview` EAS
variables and the QA API; production profiles use `production` variables and
the existing production API. The QA channel is linked to its own QA branch.

## Install the first update-capable build

Version 1.0.1 adds the SDK 57 `expo-updates` native module to both apps. The
previous APKs do not have an updater; they must be replaced once. Build the
already verified QA source with the `qa` profile. Do not describe OTA delivery
as verified until a real release build has downloaded and applied a test update.

The apps check and download automatically on launch. They immediately use the
cached/bundled version and apply a downloaded update on a subsequent cold start.
There is no forced JS reload during a ride or cash collection.

## Publish compatible JS or asset updates

From `frontend` or `driver-app`, use the corresponding package command:

```sh
npm run update:qa -- --base-ref <commit-used-for-installed-APK> --message "Describe the tested fix" --dry-run
npm run update:qa -- --base-ref <commit-used-for-installed-APK> --message "Describe the tested fix"
```

The source must be committed and checked. The wrapper pins EAS CLI 27.1.0,
selects the matching API/EAS environment, and rejects native/config/dependency
changes relative to the explicitly identified installed build. EAS CLI must
be authenticated separately; browser sign-in does not log in the CLI.

Production uses `update:production` after the corresponding QA and release
approval. Publishing is deliberate; pushing a Git commit does not automatically
send untested code to phones.

`runtimeVersion` uses the app version. When native dependencies, permissions,
plugins or app configuration change, bump `expo.version`, create a new native
build, and use that build's source commit as the new compatibility baseline.
The publish wrapper refuses those changes as OTA even if someone forgets to
bump the version. Never bypass this guard by naming an unbuilt commit as a base.

## Device verification

Install the 1.0.1 QA APK on each test phone and record its source commit. Publish
a harmless, tested text change through `update:qa`. Open the app online, allow
the download, close it fully and reopen it. Check the new text, then verify
login, booking and cash collection. Repeat offline to confirm cached startup.
The old production channel and existing users must not receive this QA update.
