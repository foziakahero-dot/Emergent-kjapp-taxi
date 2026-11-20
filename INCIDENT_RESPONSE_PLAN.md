# SNAR · hendelsesplan

| Rolle | Ansvar |
| --- | --- |
| Hendelsesleder hos NexoraHub | Oppretter privat sak, registrerer når virksomheten fikk kjennskap til hendelsen, eier beslutninger og varsling. |
| Drift/sikkerhet | Bevarer tilgangsbegrensede leverandørlogger, avgrenser tidsrom og miljø og foreslår reversibel isolering. |
| Betalingsansvarlig | Avstemmer hendelser, mottaker og oppgjør med betalingsleverandøren. |
| Personvernansvarlig | Kartlegger berørte personer, sannsynlige følger, plikter og frister. Informerer ledelsen og gir råd om varsling. |
| Kundestøtte | Formidler godkjent, handlingsrettet informasjon til berørte via kjent kanal. |

**Første time.** Opprett tidslinje med UTC-tider, miljø, signert kandidat og hvem som tar beslutninger. Bruk leverandørens etablerte administrasjonskanal. Bevar redigerte observasjoner og tilgangsspor i et privat saksrom. Begrens tilgang til eventuelt originalmateriale. Legg aldri nøkler, posisjoner, dokumenter eller kundedata i GitHub-saker.

**Offentlig nøkkeltreff.** Klassifiser privat som publiserbar klientverdi, dokumentert eksempel, allerede tilbakekalt, aktivt sensitiv eller uavklart. Kontroller nøkkelmetadata, omfang og historiske hendelser hos riktig leverandør. Et skannertreff alene avgjør ikke om en nøkkel kan brukes. Ved aktiv eller uavklart alvorlig eksponering skal eier raskt beslutte begrensning eller rotasjon, identifisere avhengige tjenester og overvåke uvanlig bruk. Et slettet Git-objekt kan allerede finnes i en klone. Omskriving av historikk krever koordinert og separat godkjenning.

**Kontoovertakelse eller posisjonsinnsyn.** Drift avklarer hvilke roller, turer og tidsrom som er berørt. Etter godkjenning kan eier sperre berørt sesjon eller snevre inn funksjonen med minst mulig driftsavbrudd. Verifiser status på aktiv tur og tilgang til sikkerhets-/kontaktfunksjoner. Skill QA fra produksjon.

**Betalingsavvik.** Bevar redigerte leveringshendelser, sammenlign beløp, modus og bokført mottaker. Avklar med betalingsansvarlig før ny capture, refusjon eller utbetaling. Opprett privat avstemmingssak for usikre transaksjoner.

**Varsling.** Registrer alle personopplysningsbrudd og begrunnelsen for meldebeslutningen. Ved meldeplikt skal behandlingsansvarlig varsle Datatilsynet uten ugrunnet opphold og om mulig innen 72 timer fra kjennskap. Unntaket gjelder der bruddet sannsynligvis ikke medfører risiko. Ved sannsynlig høy risiko for de berørte skal de normalt informeres uten ugrunnet opphold. Oppgi art, antatt omfang, kontaktpunkt, mulige følger og tiltak. Trinnvis melding kan være nødvendig. Databehandlere varsler behandlingsansvarlig uten ugrunnet opphold. [Datatilsynet om avvik](https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/avvik/meld-avvik-til-datatilsynet/)

**Gjenoppretting og lukking.** Verifiser kandidat, nøklenes virkeområde og stoppet uautorisert tilgang før gjenåpning. Test fysisk innlogging, bestilling, posisjon og kvittering i QA. Avstem betalingskø. Dokumenter gjenopprettingstid, beslutning om berørte, årsak, eier og frist for etterarbeid. Øv med en syntetisk sak før ekstern beta.
