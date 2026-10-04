# SNAR Driver QA Matrix

Branch baseline: `audit/driver-snar-p0-20261005`.

Legend:
- ✅ VERIFIED_SOURCE — implementation/contract confirmed in source.
- 🟡 PARTIAL — implementation exists but acceptance is incomplete.
- ⏳ UNVERIFIED_RUNTIME — requires native/device/backend environment evidence.
- ❌ BROKEN/MISSING — known blocker.

| Area | Scenario | Source status | Android physical | iOS physical | Release priority |
|---|---|---:|---:|---:|---:|
| Startup | Cold start without crash | ⏳ | ⏳ | ⏳ | P0 |
| Branding | App label/login/visible Driver strings show SNAR | 🟡 | ⏳ | ⏳ | P0 |
| Auth | Approved Driver email login | ✅ | ⏳ | ⏳ | P0 |
| Auth | Approved Driver phone login | ✅ | ⏳ | ⏳ | P0 |
| Auth | Passenger/admin/fleet account rejected from Driver client | ✅ | ⏳ | ⏳ | P0 |
| Auth | Unapproved Driver rejected | ✅ | ⏳ | ⏳ | P0 |
| Auth | Session restored after restart | ✅ | ⏳ | ⏳ | P0 |
| Auth | Invalid/expired session fails closed | ✅ | ⏳ | ⏳ | P0 |
| Auth | Forgot/reset password | 🟡 | ⏳ | ⏳ | P1 |
| Auth | Native Google sign-in when configured | 🟡 | ⏳ | ⏳ | P1 |
| Auth | Native Apple sign-in when configured | 🟡 | N/A | ⏳ | P1 |
| Fleet | Assigned vehicles load | ✅ | ⏳ | ⏳ | P0 |
| Fleet | Unassigned vehicle cannot be selected | ✅ | ⏳ | ⏳ | P0 |
| Fleet | Driver cannot go online without valid active vehicle | ✅ | ⏳ | ⏳ | P0 |
| GPS | Foreground permission requested | ✅ | ⏳ | ⏳ | P0 |
| GPS | Denied permission leaves/forces Driver offline | ✅ | ⏳ | ⏳ | P0 |
| GPS | Fresh real position sent to backend | ✅ | ⏳ | ⏳ | P0 |
| GPS | Stale position removes supply | ✅ | ⏳ | ⏳ | P0 |
| GPS | Background shift location | ✅ | ⏳ | ⏳ | P0 |
| GPS | Active-trip higher-frequency updates | ✅ | ⏳ | ⏳ | P1 |
| Online | Offline → online only after operational gates | 🟡 | ⏳ | ⏳ | P0 |
| Online | Online → offline updates backend and stops location | ✅ | ⏳ | ⏳ | P0 |
| Offers | Pending offer appears | ✅ | ⏳ | ⏳ | P0 |
| Offers | Offer expiry refresh | ✅ | ⏳ | ⏳ | P1 |
| Offers | Duplicate foreground offer alerts suppressed | ✅ | ⏳ | ⏳ | P1 |
| Push | Locked/background new-trip push | ⏳ | ⏳ | ⏳ | P0 |
| Push | Notification opens Driver home | ✅ | ⏳ | ⏳ | P1 |
| Push | Sound/vibration preferences | ✅ | ⏳ | ⏳ | P1 |
| Trip | Accept offer | ✅ | ⏳ | ⏳ | P0 |
| Trip | Lost accept response reconciles via `/driver/current` | ✅ | ⏳ | ⏳ | P0 |
| Trip | Only one Driver wins concurrent accept | ✅ | ⏳ | ⏳ | P0 |
| Trip | Drive to pickup | ✅ | ⏳ | ⏳ | P0 |
| Trip | Mark at pickup | ✅ | ⏳ | ⏳ | P0 |
| Trip | Start trip | ✅ | ⏳ | ⏳ | P0 |
| Trip | Arrive/complete | ✅ | ⏳ | ⏳ | P0 |
| Trip | Finished trip removed from active state | ✅ | ⏳ | ⏳ | P0 |
| Trip | Driver available for next trip | ✅ | ⏳ | ⏳ | P0 |
| Trip | Active trip minimize/restore | ❌ | ⏳ | ⏳ | P1 |
| Trip | Active trip survives app background | ✅ | ⏳ | ⏳ | P0 |
| Trip | Active trip restored after restart | ✅ | ⏳ | ⏳ | P0 |
| Offline | Network loss during pickup/start/arrive does not fake success | ✅ | ⏳ | ⏳ | P0 |
| Navigation | Google Maps external navigation | ✅ | ⏳ | ⏳ | P1 |
| Navigation | Waze external navigation | ✅ | ⏳ | ⏳ | P1 |
| Navigation | Apple Maps on iOS | ✅ | N/A | ⏳ | P1 |
| Communication | Call assigned Customer | ✅ | ⏳ | ⏳ | P1 |
| Communication | Driver↔Customer chat | ✅ | ⏳ | ⏳ | P1 |
| Identity | Profile photo | ✅ | ⏳ | ⏳ | P1 |
| Identity | Selfie identity flow | ✅ | ⏳ | ⏳ | P1 |
| Earnings | Today/weekly/settlement data from backend | ✅ | ⏳ | ⏳ | P1 |
| Errors | Friendly 401/403/409/422/offline messages | 🟡 | ⏳ | ⏳ | P0 |
| Errors | Friendly 500/503 message, no raw server text | 🟡 | ⏳ | ⏳ | P0 |
| Security | Cross-driver/trip authorization | ✅ | ⏳ | ⏳ | P0 |
| Build | TypeScript | ⏳ | — | — | P0 |
| Build | Expo Doctor | ⏳ | — | — | P0 |
| Build | Android EAS APK | ⏳ | ⏳ | — | P0 |
| Build | iOS EAS/TestFlight/internal | ⏳ | — | ⏳ | P1 |

## Mandatory physical Android ride test
1. Install fresh APK.
2. Cold launch.
3. Driver login.
4. Select/confirm fleet vehicle.
5. Go online with real GPS.
6. Confirm Customer can see real available Driver supply.
7. Create real beta/test-mode Customer request.
8. Receive Driver offer/push.
9. Accept once and verify no duplicate assignment.
10. Navigate to pickup.
11. Mark at pickup.
12. Call/message Customer.
13. Start trip.
14. Background/foreground app during active trip.
15. Complete/arrive.
16. Verify trip disappears from active state.
17. Verify earnings/history state is canonical.
18. Verify Driver can receive next trip.
19. Go offline.
20. Restart app and verify session/state.

No row may be promoted to runtime VERIFIED without evidence from the stated test method.