# SNAR · sikkerhetsrevisjon 20. november 2026

**Beslutning: Hold ekstern beta.** Den separate sikkerhetsgrenen inneholder endringer i dagens backend. Observasjonene fra QA og produksjon gjelder versjonene under. Verken kildekode, et grønt helsesvar eller et vellykket bygg dokumenterer en sikker betalansering.

| Kilde kontrollert | Gren | Commit |
| --- | --- | --- |
| GitHub og Render QA, samsvar med offentlige health/ready | qa/snar-v10-phase5-staging-e2e | 7824f6ed45f65a556385c0706964599253881cb7 |
| GitHub, navngitt utgivelseskandidat | qa/release-candidate-20261118 | 40df1609defadddf033ec4884331e4ea7556e2a8 |
| Render, eksisterende produksjonstjeneste | release/onboarding-live-base-20261020 | 02ed5c061d34f80f5b255a2f270a4903aa3c271e |
| GitHub, standardgren | main | 044965a479905627e5fde59d6fea846dfb93cc8b |

QA svarte HTTP 200 på begge kontrollene og rapporterte isolert QA-database. Den eksisterende produksjonstjenestens helseendepunkt svarte. Det planlagte SNAR-produksjonsdomenet svarte 503 under kontrollen. Historisk bootstrap og opprinnelig QA-baseline er egne milepæler. Netlify-koblingen krevde ny autentisering. Faktisk publiserte panelartefakter og alle aliaser er uverifisert.

### Prioriterte funn

| Prioritet / alvor | Bevis og berørt område | Konsekvens | Tiltak, test og restrisiko |
| --- | --- | --- | --- |
| P0 / mulig kritisk | Offentlig repo. Redigert historikkskanning fant 33 treff i 2 610 tilgjengelige commits. Flere treff kan være offentlige klientverdier eller testdata. Et mindretall har et format som krever privat kontroll hos leverandøren. | En aktiv, privilegert nøkkel kan gi leverandørtilgang. Verken gyldighet, rettigheter eller misbruk er påvist. | Eier og sikkerhetsansvarlig må klassifisere treff med leverandørens private inventar og tilgangslogg. Utfør godkjent inneslutning dersom nødvendig. Se hendelsesplan. |
| P1 / høy | Revisjon av adminsesjoner, faktoraktivering og gjenoppretting avdekket mangelfull binding mellom gjennomført tofaktor og sesjon. | Privilegerte rettigheter kan vare lengre enn forutsatt. | Grenen knytter bevis til signert sesjon, erstatter sesjonen ved aktivering og bruker atomisk forbruk av reservekode og engangsutfordring. Mislykkede forsøk fra en kilde beholdes gjennom en vellykket innlogging. Dekket av API-tester. Eksisterende deploy må oppgraderes og panelene testes sammen. |
| P1 / høy | Verifikasjon av betalingshendelser var avhengig av fullstendig miljøkonfigurasjon. | Manglende avvisning ved konfigurasjonsfeil kan påvirke betalingsstatus. Ingen feilbelastning er observert. | Påkrevd signatur og hemmelighet, begrenset body, ekte SDK-signatur i lokal test. Kontroll av beløp, tur, valuta, mottaker og modus beholdes. Reell testmodusleveranse og avstemming gjenstår. |
| P1 / høy | Sensitive administrative skriveruter krevde ikke konsekvent nylig autentisering. | En eldre gyldig sesjon kan gi økonomiske eller administrative endringer. | 15 minutters krav på utvalgte refusjons-, Connect-, provisjons-, rolle- og konfigurasjonsoperasjoner. Egen test med fersk/utløpt sesjon. Verifiser nye skriveruter ved hver endring. Endring på leverandørens egen kontoside må beskyttes der. |
| P1 / middels til høy | Distribusjonsavhengigheter hadde kjente advisories. | Potensielt sårbare kodebaner avhenger av versjon og faktisk bruk. | Nye pins i CI-, Render- og hovedmanifest, ny installasjon og revisjon av løste versjoner. Produksjonens gamle pakker er ikke oppgradert. |
| P1 / middels | Feilbehandling, validering og mellomlagring kunne eksponere mer forespørselsdata enn nødvendig. Flere sikkerhetsheadere manglet på QA-svar. | Token, personopplysninger eller turdata kan havne i logger, cache eller referansefelt. | Generiske 422/500-svar, rutemal og korrelasjons-ID i middleware, no-store for sensitive svar, nosniff, referrer-policy og HSTS i QA/prod. Leverandørens egne tilgangslogger må kontrolleres separat. |
| P1 / åpent | Ingen attestert helhetlig test av autorisasjon, GPS, kvittering og penger på samme kandidat. Ingen bekreftet restore. | Ukjent restrisiko for passasjer, sjåfør og oppgjør. | QA-eier samler bevis per ledd og gjenoppretter en syntetisk sikkerhetskopi i isolert miljø. Se beta-gate. |
| P2 / middels | Varsling, opprinnelsesbeskyttelse og plan for oppbevaring er bare delvis verifisert. | Sen oppdagelse av misbruk eller unødvendig lagring. | Valgfri kantkontroll for HTTP/WebSocket, etablert XML-parser med eksplisitt beskyttelse, driftsplan og personvernoppgaver. Aktivering krever egen beslutning. |

### Øvrige observasjoner

- Atlas QA-prosjekt og database var avgrenset. Listen over tillatte nett hadde to oppføringer. Ingen av disse åpnet for hele IPv4- eller IPv6-internett. Atlas oppga én databaseidentitet med cluster-scope og rollen readWrite kun i snar_qa. Hvilken identitet prosessen faktisk bruker, produksjonsroller, krypteringsvalg, oppbevaring av kopier og gjenoppretting er uverifisert.
- Kundeinnlogging har egne flyter for Google og Apple. Engangskoder har utløp, forsøksgrense og konsumeringsvilkår. Driver bruker invitasjon og kontrolleres mot rolle og flåte. Rolleavhengigheter alene beviser ikke objektisolasjon. Skjemaer, objekttilgang og dokumentutlevering er dekket på utvalgte testbaner.
- Realtime har egne autentiserte Socket.IO-grensesnitt i tillegg til FastAPI. Sesjon, rolle og snapshot kontrolleres under abonnementet. Fysisk GPS, skifte mellom nett og utlogging fra to enheter gjenstår.
- Reservasjonstjenesten verifiserer tur, kunde, beløp, valuta, betalingsmiddel ved streng binding og miljø. Reservasjon og capture benytter idempotens. Kontanttur skal ikke kortreserveres. Den kontrollerte standardflyten har abonnementstermin med null provisjon. Ønsket 12 % må verifiseres på faktisk lanseringsgren, også med refusjon og mottakeravstemming.
- Founding 500: ventelisteregistrering og kredittkode finnes, men en sammenhengende innløsning med atomisk tak, budsjett og oppgjør er ikke påvist i denne QA-kandidaten. Hold kredittkampanjen av frem til separat godkjent test.
- DNS-kontroll fant SPF for hoveddomenet og undersøkte returpostdomener, DKIM-poster for hoved-/QA-avsender og DMARC med reject på hoveddomenet. Faktisk signatur og SPF-/DKIM-alignment må bevises fra meldingsheadere til en kontrollert mottaker.
- Historikkskanningen gjelder Git-objektene som var tilgjengelige lokalt. Den dekker ikke fullstendig bilder, LFS, alle byggeartefakter, leverandørlogger, slettede referanser eller personopplysninger i fritekst.

En avgrenset kontroll av sporede tekstfiler fant et e-postmønster fra vanlig privat e-posttjeneste i én fil og seks historiske commits med endringer som passet søket. Eier må avklare om dette er reelle personopplysninger og om publiseringen har et grunnlag. Ingen adresser gjengis.

Metoden bruker OWASP ASVS 5.0 og API Security Top 10 2023 som ramme for prioritering. Se [trusselmodellen](THREAT_MODEL.md), [testresultatene](SECURITY_TEST_RESULTS.md) og [lanseringskriteriene](BETA_SECURITY_GATE.md). [OWASP ASVS](https://asvs.owasp.org/) · [OWASP API Security](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)

### Ruteinventar på sikkerhetsgrenen

259 registrerte FastAPI-metode/rute-par. Tabellen viser direkte deklarert avhengighet eller innloggings-/valideringsmåte der ruten selv håndterer innpass. For hver objektrute kommer objektsjekken i handleren i tillegg. En inventarrad er ikke en individuell bestått rettighetstest. Dokumentasjon, statiske panelmounts og Socket.IO er separate ASGI-flater.

<details><summary>Åpne fullstendig rutetabell</summary>

| Metode | Rutemal | Direkte inngangskontroll |
| --- | --- | --- |
| GET | `/api/` | Offentlig lesing/konfigurasjon |
| GET | `/api/admin/analytics` | require_admin |
| GET | `/api/admin/audit-log` | require_admin |
| GET | `/api/admin/beta-health` | require_admin |
| GET | `/api/admin/beta-readiness` | require_admin |
| GET | `/api/admin/beta-waitlist` | require_admin |
| PATCH | `/api/admin/beta-waitlist/{identity}` | require_admin |
| GET | `/api/admin/bonus-campaigns` | require_admin |
| POST | `/api/admin/bonus-campaigns` | require_admin |
| DELETE | `/api/admin/bonus-campaigns/{campaign_id}` | require_admin |
| PATCH | `/api/admin/bonus-campaigns/{campaign_id}` | require_admin |
| GET | `/api/admin/bonus-payouts` | require_admin |
| GET | `/api/admin/client-errors` | require_admin |
| GET | `/api/admin/control/action-center` | require_admin |
| GET | `/api/admin/control/admin-users` | require_superadmin |
| POST | `/api/admin/control/admin-users` | require_superadmin |
| PATCH | `/api/admin/control/admin-users/{user_id}` | require_superadmin |
| GET | `/api/admin/control/communication-fleets` | require_admin |
| GET | `/api/admin/control/communications` | require_admin |
| POST | `/api/admin/control/communications` | require_admin |
| POST | `/api/admin/control/fleets/{fleet_id}/driver-invites` | require_admin |
| POST | `/api/admin/control/fleets/{fleet_id}/stripe-connect` | require_superadmin |
| GET | `/api/admin/control/fleets/{fleet_id}/stripe-status` | require_admin |
| POST | `/api/admin/control/fleets/{fleet_id}/vehicle` | require_admin |
| GET | `/api/admin/control/fleets/{fleet_id}/vehicles` | require_admin |
| GET | `/api/admin/control/integration-settings` | require_superadmin |
| PUT | `/api/admin/control/integration-settings/{group}` | require_superadmin |
| GET | `/api/admin/control/integrations` | require_admin |
| GET | `/api/admin/control/payouts` | require_admin |
| GET | `/api/admin/control/stripe-fleets` | require_admin |
| GET | `/api/admin/documents` | require_admin |
| POST | `/api/admin/documents/{file_id}/review` | require_admin |
| GET | `/api/admin/driver-invites` | require_admin |
| POST | `/api/admin/driver-invites` | require_admin |
| GET | `/api/admin/drivers` | require_admin |
| GET | `/api/admin/drivers-full` | require_admin |
| POST | `/api/admin/drivers/{driver_id}/identity-recheck` | require_admin |
| POST | `/api/admin/drivers/{user_id}/approve` | require_admin |
| PATCH | `/api/admin/drivers/{user_id}/capabilities` | require_admin |
| POST | `/api/admin/drivers/{user_id}/set-status` | require_admin |
| GET | `/api/admin/finance` | require_admin |
| GET | `/api/admin/finance/export` | require_admin |
| GET | `/api/admin/fleets` | require_admin |
| POST | `/api/admin/fleets` | require_admin |
| GET | `/api/admin/fleets-full` | require_admin |
| POST | `/api/admin/fleets/attach-driver` | require_admin |
| GET | `/api/admin/fleets/{fleet_id}` | require_admin |
| POST | `/api/admin/fleets/{fleet_id}/commission` | require_admin |
| POST | `/api/admin/fleets/{fleet_id}/reactivate` | require_admin |
| POST | `/api/admin/fleets/{fleet_id}/suspend` | require_admin |
| GET | `/api/admin/identity-verifications` | require_admin |
| POST | `/api/admin/identity-verifications/purge-expired` | require_superadmin |
| GET | `/api/admin/identity-verifications/retention` | require_superadmin |
| POST | `/api/admin/identity-verifications/{verification_id}/review` | require_admin |
| GET | `/api/admin/live` | require_admin |
| GET | `/api/admin/overview` | require_admin |
| GET | `/api/admin/pending-drivers` | require_admin |
| GET | `/api/admin/pricing/history` | require_admin |
| POST | `/api/admin/pricing/rollback` | require_superadmin |
| POST | `/api/admin/pricing/test` | require_admin |
| POST | `/api/admin/pricing/test-route` | require_admin |
| GET | `/api/admin/receipts` | require_admin |
| POST | `/api/admin/receipts/backfill` | require_superadmin |
| GET | `/api/admin/receipts/{receipt_or_trip}` | require_admin |
| POST | `/api/admin/receipts/{trip_id}/retry-delivery` | require_admin |
| GET | `/api/admin/refunds` | require_admin |
| POST | `/api/admin/refunds` | require_admin |
| GET | `/api/admin/search` | require_admin |
| GET | `/api/admin/settings` | require_admin |
| PATCH | `/api/admin/settings` | require_superadmin |
| GET | `/api/admin/student-verifications` | require_admin |
| GET | `/api/admin/student-verifications/{uid}/proof` | require_admin |
| POST | `/api/admin/student-verifications/{uid}/review` | require_admin |
| GET | `/api/admin/support/tickets` | require_admin |
| POST | `/api/admin/support/tickets` | require_admin |
| PATCH | `/api/admin/support/tickets/{ticket_id}` | require_admin |
| GET | `/api/admin/transactions` | require_admin |
| GET | `/api/admin/trips` | require_admin |
| GET | `/api/admin/trips-full` | require_admin |
| POST | `/api/admin/trips/{trip_id}/intervene` | require_admin |
| GET | `/api/admin/trips/{trip_id}/timeline` | require_admin |
| GET | `/api/admin/users` | require_admin |
| POST | `/api/admin/users/{user_id}/set-status` | require_admin |
| GET | `/api/admin/vehicles` | require_admin |
| POST | `/api/ai/chat` | get_current_user |
| GET | `/api/ai/history` | get_current_user |
| POST | `/api/ai/transcribe` | get_current_user |
| POST | `/api/ai/translate` | get_current_user |
| POST | `/api/auth/2fa/disable` | get_current_user |
| POST | `/api/auth/2fa/enable` | get_current_user |
| POST | `/api/auth/2fa/setup` | get_current_user |
| GET | `/api/auth/2fa/status` | get_current_user |
| POST | `/api/auth/2fa/verify-login` | Autentiseringsflyt eller avviklet inngang. Kontroll i handler |
| POST | `/api/auth/accept-legal` | get_current_user |
| POST | `/api/auth/apple` | Autentiseringsflyt eller avviklet inngang. Kontroll i handler |
| GET | `/api/auth/apple/config` | Offentlig lesing/konfigurasjon |
| POST | `/api/auth/apple/link` | require_customer |
| POST | `/api/auth/apple/native` | Autentiseringsflyt eller avviklet inngang. Kontroll i handler |
| POST | `/api/auth/change-password` | get_current_user |
| GET | `/api/auth/customer/otp/config` | Offentlig lesing/konfigurasjon |
| POST | `/api/auth/customer/otp/start` | Offentlig innsending med validering i handler |
| POST | `/api/auth/customer/otp/verify` | Autentiseringsflyt eller avviklet inngang. Kontroll i handler |
| POST | `/api/auth/forgot-password` | Offentlig innsending med validering i handler |
| POST | `/api/auth/google/code` | Autentiseringsflyt eller avviklet inngang. Kontroll i handler |
| GET | `/api/auth/google/config` | Offentlig lesing/konfigurasjon |
| POST | `/api/auth/google/link` | require_customer |
| POST | `/api/auth/google/native` | Autentiseringsflyt eller avviklet inngang. Kontroll i handler |
| POST | `/api/auth/google/session` | Autentiseringsflyt eller avviklet inngang. Kontroll i handler |
| POST | `/api/auth/google/web/code` | Autentiseringsflyt eller avviklet inngang. Kontroll i handler |
| GET | `/api/auth/google/web/config` | Offentlig lesing/konfigurasjon |
| POST | `/api/auth/google/web/link` | get_current_user |
| GET | `/api/auth/legal-config` | Offentlig lesing/konfigurasjon |
| POST | `/api/auth/login` | Autentiseringsflyt eller avviklet inngang. Kontroll i handler |
| POST | `/api/auth/logout` | Sesjon ved utlogging |
| GET | `/api/auth/me` | get_current_user |
| GET | `/api/auth/native/config` | Offentlig lesing/konfigurasjon |
| POST | `/api/auth/register` | Offentlig innsending med validering i handler |
| POST | `/api/auth/reset-password` | Begrenset delings-, søknads-, invitasjons- eller resetbevis |
| GET | `/api/auth/reset-password/{token}` | Begrenset delings-, søknads-, invitasjons- eller resetbevis |
| POST | `/api/cars/nearby` | require_customer |
| POST | `/api/cars/pickup-options` | require_customer |
| GET | `/api/cars/{driver_id}/media/{kind}` | require_customer |
| POST | `/api/client-errors` | Offentlig innsending med validering i handler |
| POST | `/api/driver-invites/accept` | Begrenset delings-, søknads-, invitasjons- eller resetbevis |
| GET | `/api/driver-invites/{token}` | Begrenset delings-, søknads-, invitasjons- eller resetbevis |
| POST | `/api/driver/accept` | require_driver |
| GET | `/api/driver/bonus` | require_driver |
| POST | `/api/driver/car-icon` | require_driver |
| GET | `/api/driver/compliance` | require_driver |
| GET | `/api/driver/current` | require_driver |
| POST | `/api/driver/decline` | require_driver |
| GET | `/api/driver/demand` | require_driver |
| GET | `/api/driver/history` | require_driver |
| GET | `/api/driver/history/weekly` | require_driver |
| GET | `/api/driver/identity-verification` | _require_driver_identity_user |
| POST | `/api/driver/identity-verification/selfie` | _require_driver_identity_user |
| POST | `/api/driver/location` | require_driver |
| POST | `/api/driver/online` | require_driver |
| GET | `/api/driver/payouts` | require_driver |
| GET | `/api/driver/pending` | require_driver |
| POST | `/api/driver/profile-photo` | require_driver |
| GET | `/api/driver/ratings` | require_driver |
| GET | `/api/driver/summary/today` | require_driver |
| POST | `/api/driver/trip/{trip_id}/arrive` | require_driver |
| POST | `/api/driver/trip/{trip_id}/at-pickup` | require_driver |
| POST | `/api/driver/trip/{trip_id}/cancel` | require_driver |
| POST | `/api/driver/trip/{trip_id}/cash/confirm` | require_driver |
| POST | `/api/driver/trip/{trip_id}/no-show` | require_driver |
| POST | `/api/driver/trip/{trip_id}/rate-passenger` | require_driver |
| POST | `/api/driver/trip/{trip_id}/start` | require_driver |
| GET | `/api/driver/vehicles` | require_driver |
| POST | `/api/driver/vehicles/{vehicle_id}/select` | require_driver |
| GET | `/api/files/{path:path}` | get_current_user |
| POST | `/api/fleet-applications/draft` | Offentlig innsending med validering i handler |
| POST | `/api/fleet-applications/submit` | Begrenset delings-, søknads-, invitasjons- eller resetbevis |
| GET | `/api/fleet/documents` | require_fleet_owner |
| GET | `/api/fleet/driver-invites` | require_fleet_owner |
| POST | `/api/fleet/driver-invites` | require_fleet_owner |
| POST | `/api/fleet/driver-invites/{token}/resend` | require_fleet_owner |
| GET | `/api/fleet/drivers` | require_fleet_owner |
| GET | `/api/fleet/drivers/{driver_id}` | require_fleet_owner |
| POST | `/api/fleet/drivers/{driver_id}/set-active` | require_fleet_owner |
| PUT | `/api/fleet/drivers/{driver_id}/vehicle-access` | require_fleet_owner |
| GET | `/api/fleet/export/monthly` | require_fleet_owner |
| GET | `/api/fleet/live` | require_fleet_owner |
| GET | `/api/fleet/me` | require_fleet_owner |
| GET | `/api/fleet/overview` | require_fleet_owner |
| GET | `/api/fleet/payouts` | require_fleet_owner |
| POST | `/api/fleet/stripe/onboarding` | require_fleet_owner |
| GET | `/api/fleet/stripe/status` | require_fleet_owner |
| GET | `/api/fleet/trips` | require_fleet_owner |
| GET | `/api/fleet/vehicles` | require_fleet_owner |
| POST | `/api/fleet/vehicles` | require_fleet_owner |
| PATCH | `/api/fleet/vehicles/{vehicle_id}` | require_fleet_owner |
| POST | `/api/fleet/vehicles/{vehicle_id}/assign-driver` | require_fleet_owner |
| POST | `/api/fleet/vehicles/{vehicle_id}/documents` | require_fleet_owner |
| DELETE | `/api/gdpr/delete` | get_current_user |
| GET | `/api/gdpr/export` | get_current_user |
| GET | `/api/health` | Offentlig lesing/konfigurasjon |
| GET | `/api/marketing/platform-config` | Offentlig lesing/konfigurasjon |
| POST | `/api/marketing/waitlist` | Offentlig innsending med validering i handler |
| GET | `/api/me/business-payment` | require_customer |
| PUT | `/api/me/business-payment` | require_customer |
| GET | `/api/me/places` | get_current_user |
| POST | `/api/me/places` | get_current_user |
| DELETE | `/api/me/places/{place_id}` | get_current_user |
| PUT | `/api/me/places/{place_id}` | get_current_user |
| DELETE | `/api/me/profile-photo` | require_customer |
| GET | `/api/me/profile-photo` | require_customer |
| POST | `/api/me/profile-photo` | require_customer |
| DELETE | `/api/me/student-verification` | require_customer |
| GET | `/api/me/student-verification` | require_customer |
| POST | `/api/me/student-verification` | require_customer |
| POST | `/api/messages/mark-seen/{trip_id}` | get_current_user |
| GET | `/api/messages/unread-count` | get_current_user |
| GET | `/api/payment-methods` | require_customer |
| POST | `/api/payment-methods` | require_customer |
| DELETE | `/api/payment-methods/{pm_id}` | require_customer |
| POST | `/api/payment-methods/{pm_id}/default` | require_customer |
| POST | `/api/payments/card/setup` | require_customer |
| GET | `/api/payments/card/setup/{session_id}` | require_customer |
| POST | `/api/payments/checkout` | require_customer |
| GET | `/api/payments/native/config` | Offentlig lesing/konfigurasjon |
| POST | `/api/payments/native/intent` | require_customer |
| GET | `/api/payments/native/intent/{intent_id}` | require_customer |
| POST | `/api/payments/native/setup-intent` | require_customer |
| GET | `/api/payments/native/setup-intent/{setup_intent_id}` | require_customer |
| GET | `/api/payments/status/{session_id}` | require_customer |
| GET | `/api/payments/vipps/config` | Offentlig lesing/konfigurasjon |
| GET | `/api/payments/vipps/return` | Returlenke fra betalingsleverandør |
| POST | `/api/payments/vipps/webhook` | Signert leverandørhendelse |
| GET | `/api/places` | Offentlig lesing/konfigurasjon |
| GET | `/api/places/reverse` | Offentlig lesing/konfigurasjon |
| GET | `/api/places/search` | Offentlig lesing/konfigurasjon |
| GET | `/api/pricing/surge` | Offentlig lesing/konfigurasjon |
| GET | `/api/push/native-config` | Offentlig lesing/konfigurasjon |
| POST | `/api/push/native-subscribe` | get_current_user |
| POST | `/api/push/native-unsubscribe` | get_current_user |
| POST | `/api/push/subscribe` | get_current_user |
| POST | `/api/push/test` | get_current_user |
| GET | `/api/push/vapid-public-key` | Offentlig lesing/konfigurasjon |
| GET | `/api/ready` | Offentlig lesing/konfigurasjon |
| GET | `/api/service-area` | Offentlig lesing/konfigurasjon |
| GET | `/api/settings` | get_current_user |
| PATCH | `/api/settings` | get_current_user |
| POST | `/api/stripe/webhook` | Signert leverandørhendelse |
| GET | `/api/summary/today` | require_customer |
| GET | `/api/superadmin/fleet-applications` | require_superadmin |
| GET | `/api/superadmin/fleet-applications/{app_id}` | require_superadmin |
| POST | `/api/superadmin/fleet-applications/{app_id}/approve` | require_superadmin |
| POST | `/api/superadmin/fleet-applications/{app_id}/reject` | require_superadmin |
| POST | `/api/support/public` | Offentlig innsending med validering i handler |
| GET | `/api/travel/flight` | require_customer |
| POST | `/api/travel/transit` | require_customer |
| GET | `/api/travel/weather` | require_customer |
| GET | `/api/trips` | require_customer |
| GET | `/api/trips/active` | require_customer |
| POST | `/api/trips/estimate` | Offentlig lesing/konfigurasjon |
| POST | `/api/trips/request` | require_customer |
| GET | `/api/trips/share/{token}` | Begrenset delings-, søknads-, invitasjons- eller resetbevis |
| GET | `/api/trips/{trip_id}` | require_customer |
| POST | `/api/trips/{trip_id}/authorization/confirm` | require_customer |
| POST | `/api/trips/{trip_id}/authorization/retry` | require_customer |
| POST | `/api/trips/{trip_id}/cancel` | require_customer |
| GET | `/api/trips/{trip_id}/cancel-preview` | require_customer |
| POST | `/api/trips/{trip_id}/complete` | require_customer |
| PATCH | `/api/trips/{trip_id}/destination` | require_customer |
| GET | `/api/trips/{trip_id}/driver-photo` | require_customer |
| GET | `/api/trips/{trip_id}/messages` | get_current_user |
| POST | `/api/trips/{trip_id}/messages` | get_current_user |
| POST | `/api/trips/{trip_id}/payment/retry` | require_customer |
| PATCH | `/api/trips/{trip_id}/pickup-preference` | require_customer |
| POST | `/api/trips/{trip_id}/rate` | require_customer |
| POST | `/api/trips/{trip_id}/safety` | get_current_user |
| POST | `/api/trips/{trip_id}/search/cancel` | require_customer |
| POST | `/api/trips/{trip_id}/share-link` | get_current_user |
| POST | `/api/upload` | get_current_user |
| POST | `/api/upload/driver-doc` | Begrenset delings-, søknads-, invitasjons- eller resetbevis |
| POST | `/api/upload/public` | Begrenset delings-, søknads-, invitasjons- eller resetbevis |

</details>
