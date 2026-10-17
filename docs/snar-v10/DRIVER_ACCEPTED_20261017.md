# Sjåføren har akseptert – kode og gjenstående oppsett

Kundeappen viser et stort sjåførkort øverst ved bekreftet `driver_on_way` eller `at_pickup`. Kortet bruker maksimalt halve skjermhøyden og kan rulles på små skjermer. Kartet under følger den tildelte bilen med eksisterende GPS- og animasjonslogikk. Det viser fullt navn, bilmerke/modell/farge, registreringsnummer, faktisk gjennomsnittsrating, Google-beregnet kjøretid til det avtalte hentestedet og knapper for telefon og appens turmeldinger. Manglende felt eller kjøretid vises som utilgjengelige; de fylles ikke med demodata.

Render lagrer telefon, navn, rating og bilopplysninger i den atomiske aksepten. Tilbudet må fortsatt tilhøre denne sjåføren og være innenfor både tilbudsfristen og den samlede søkefristen ved selve databaseskrivingen. Google Distance Matrix/valgt Google Routes gir ETA; OSRM beholdes for eksisterende kartlinje. Ingen rettlinje-ETA vises i akseptvarselet.

`/trip-status` bruker samme Socket.IO-server som bilkartet. Klienten må sende gyldig innlogging og abonnere på en tur den eier eller er tildelt. Token, tilbakekalling og turtilknytning sjekkes igjen før hver utsending. Hendelsen inneholder bare `trip_id`; appene henter autoriserte turdata via REST. Endringer vekker strømmen direkte, med 0,5 sekunders avstemming og ett sekunds polling som reserve i begge apper. Ekstern push kan derfor ikke forsinke kundeoppdateringen. Dette er en nettverksoppdatering, ikke en garanti om null forsinkelse uten nett.

Mobilappen har et lokalt lydsignal og vibrasjon når sjåførkortet vises. Den eksisterende pushleveransen brukes når appen er i bakgrunnen. Forgrunnslyd fra samme push dempes mens bestillingsskjermen håndterer signalet. Kortet husker at det er lukket for denne turen/sjåføren. Web viser samme kort. Operativsystemets varsel-, lyd- og vibrasjonsinnstillinger gjelder fortsatt.

## Full kildekode

- `frontend/src/components/DriverAcceptedNotice.tsx`
- `frontend/src/lib/useDriverAcceptedAlert.native.ts`, `useDriverAcceptedAlert.ts`, `acceptanceAlertState.ts`, `nativeRuntime.ts`
- `frontend/assets/driver-accepted.wav`: kort, originalt generert lydsignal
- `frontend/app/booking/[tripId].tsx`
- `frontend/src/lib/useTripUpdates.ts` og tilsvarende i `driver-app/`
- `driver-app/app/(driver)/home.tsx`
- `backend/trip_status_stream.py`
- `backend/server.py`: `driver_accept`, `get_trip`, `_trip_stream_snapshot`, flåtens kjøretøyendepunkter og oppstart/nedstenging

## Manuelt / faktisk enhetstest

1. Flåten må ha ekte `brand`, `model`, `color`, `plate` og sjåførens telefon registrert. Flåteeier kan sende feltene til eksisterende `POST /api/fleet/vehicles` eller `PATCH /api/fleet/vehicles/{vehicle_id}`. Sjåføren må gå offline før bilopplysninger endres. Eldre turer beholder sin historiske sjåførkopi.
2. Google servernøkkel/API-aktivering må fullføres som beskrevet i `LIVE_MAP_20261017.md` for at kjøretid skal kunne vises. Avtalt hentested brukes etter bestilling; det flyttes ikke uten kundens godkjenning.
3. Ny kunde- og sjåførversjon må bygges og installeres/publiseres. Et nytt JS-bundle er ikke en signert APK.
4. Kontroller ekte aksept mellom to enheter: tilbud → aksept → kundevarsel → telefon/melding → fremme → startet → avsluttet, samt nettbrudd og sen aksept etter 30 sekunder.
5. APNs/FCM/Expo push må være riktig registrert, varseltillatelse må være gitt, og lyd/vibrasjon må prøves på en fysisk telefon. QA har med vilje ekstern push deaktivert; lokalt signal og socket/polling kan prøves der. Ingen push-legitimasjon eller produksjonsbryter er endret her.

## Kontrollert

TypeScript i begge appene; web- og Android-eksport av begge appene; komponenttester for felt, kontakter og høyde; strømtester for eierkontroll, avslåtte abonnementer, tildelt sjåfør, token-tilbakekalling og fravær av persondata i socketmeldingen. Dette erstatter ikke de manuelle enhetstestene over.
