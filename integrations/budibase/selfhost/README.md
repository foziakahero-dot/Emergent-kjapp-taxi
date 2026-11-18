# Gratis Budibase Community for SNAR

Bruker har valgt gratisutgaven. **Ingen Budibase Cloud-oppgradering eller betalt ressurs er bestilt.**

Dette er et klargjort lokalt driftsoppsett, ikke et ferdig installert panel. Docker/Podman finnes ikke i agentens tilgjengelige arbeidsmiljø. En eksisterende vert med Docker er ikke tilkoblet. Ingen container er startet eller funksjonstestet her.

## Start på eksisterende PC/server

Forutsetninger: Python 3, fungerende Docker med Linux-containere og Compose-plugin, persistent disk og nettverkstilgang til den offisielle containeren. Budibases Docker-guide anbefaler 2 kjerner og 6 GB RAM for de fleste bruksområder. Bruk eksisterende kapasitet; scriptet oppretter ingen skytjeneste og starter ingen abonnementer. Docker/vertens eventuelle egne lisens- eller driftskostnader inngår ikke i Budibases gratis programvarelisens.

Fra repository-roten, på maskinen som skal kjøre Budibase:

```bash
python integrations/budibase/selfhost/manage.py start
```

På Windows kan kommandoen være `py -3 integrations/budibase/selfhost/manage.py start` hvis Python-launcheren brukes. Kjør fra vanlig terminal, uten å lime inn passord eller databasehemmeligheter i kommandoen.

Åpne deretter `http://localhost:10000` **på samme maskin**. Opprett den første lokale administratorkontoen i Budibase-skjermen. Innloggingen i Budibase Cloud-portalen er ikke en innlogging i denne separate Community-installasjonen.

```bash
python integrations/budibase/selfhost/manage.py status
python integrations/budibase/selfhost/manage.py stop
```

## Hva oppsettet gjør

1. Kontrollerer at Docker og Compose faktisk er tilgjengelige og at motoren kjører. Stopper med `BLOCKED` hvis ikke.
2. Genererer tilfeldige interne servicehemmeligheter i lokal `.env` ved første start. Filen er Git-ignorert og skrives med eiertilgang på POSIX. Bevar privat ACL på Windows og inkluder aldri filen i deling/commits. Eksisterende hemmeligheter beholdes ved ny kjøring.
3. Starter offisiell Budibase v4.0.1, låst til verifisert Docker Hub-manifestdigest. Denne utgaven var siste ikke-prerelease fra GitHub API da den ble kontrollert 18. november 2026. Oppgradering krever ny vurdering og backup; scriptet oppdaterer ikke image automatisk.
4. Lagrer Budibases interne CouchDB/MinIO-data på named volume `snar-budibase-community_budibase_data`. PostgreSQL er fortsatt en separat ekstern datakilde. Ingen eksisterende SNAR-tabeller flyttes til CouchDB.
5. Binder bare `127.0.0.1:10000`. Ingen offentlig port for interne databaser, ingen publisering av adminpanelet og ingen portvideresending.

## Koble SNAR etter oppstart

Importer `../budibase-rest.openapi.json` som REST-spørringer og bruk bindingskontrakten i `../README.md`. Dette bygger ikke skjermene automatisk. Den faktiske PostgreSQL-databasen og individuell autentisering må fortsatt identifiseres; tilkoblet Render-arbeidsområde viste ingen PostgreSQL-instans.

Ikke legg gatewayens SQL-login direkte inn som en delt Budibase-datakilde. Gatewayen må verifisere individuell identitet før databasehandlinger; de separate SQL-rollene og API-testene ligger i overordnet mappe. Test admin samt to forskjellige sjåfører før reelle data tas i bruk.

## Drift og tilgjengelighet

Lokal oppstart gir ingen offentlig installasjonslenke. For tilgang fra mobil eller andre maskiner kreves en valgt vert og separat sikret nettverks-/HTTPS-konfigurasjon. Dette er ikke utført. Ikke eksponer førstegangsoppsettet eller åpne databaser på internett.

Named volume er vedvarende lagring, ikke en backup. Før oppgradering eller flytting må alle skrivere stoppes og hele `/data` sikkerhetskopieres konsistent. Test gjenoppretting på en annen isolert installasjon før denne brukes som betaens adminflate. Ikke bruk `docker compose down -v`, slett volumet eller roter eksisterende `.env` som feilsøkingssnarvei.

## Kilder

- Gratis selvhostet Community: https://budibase.com/pricing/
- Offisiell all-in-one Docker-/Compose-konfigurasjon: https://docs.budibase.com/docs/docker
- Kontrollert release: https://github.com/Budibase/budibase/releases/tag/v4.0.1
- Kontrollert image: https://hub.docker.com/v2/repositories/budibase/budibase/tags/v4.0.1
