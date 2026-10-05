# SNAR designmigrasjon – kjappapp.no

Dato: 4. oktober 2026. Leveransen er et Netlify-preview og en Draft PR. Produksjon er ikke publisert.

## Leveranse og kilde

| Felt | Verifisert verdi |
| --- | --- |
| Repo | `foziakahero-dot/Emergent-kjapp-taxi` |
| Branch | `design/snar-kjappapp-web-20261004` |
| Draft PR | [#72](https://github.com/foziakahero-dot/Emergent-kjapp-taxi/pull/72) |
| Base | `release/emergent-production`, `1ee2c4d05c7192c82926905a7ccefa8740712ef5` |
| Customer-fasit | `audit/customer-prebuild-snar-20261003`, `66bb81e1cfc72cafc4ea01b12c9ad0140c729bf2` |
| Siste kodecommit | `cf501b3e56b4d219c22956425a7aaaf4a577a467` |
| Preview | [deploy-preview-72--kjappapp-no.netlify.app](https://deploy-preview-72--kjappapp-no.netlify.app) |
| Netlify-prosjekt | Eksisterende `kjappapp-no`, site ID `f6c9ecb7-0b28-4f6e-b1ea-a375712f03fb` |
| Byggmappe | `marketing-web`, Vite/React |

Arbeidet viderefører den eksisterende webgrenen/PR #68 (`8fee33eccbb05cc570ad713c5bf269151554277e`) i den forespurte separate branchen. Samlet PR-diff mot produksjonsgrenen er kontrollert: kodeendringer er begrenset til `marketing-web` og `netlify.toml`; denne rapporten og QA-bevis ligger i `docs`. Ingen native-, Admin-, Fleet-, backend-, MongoDB-, Render-, Stripe- eller dispatch-kode er endret. Supabase er ikke brukt.

Logiske kodecommits:

1. `8d8b77a185030d95b271230f94cb8948c48bcedf`: Customer-tokens, logo, SVG-er og lokale fonter.
2. `7ba490898bdc12e8a7e765d51ef12d52082a97b4`: offentlige sider, beta-skjema og bevarte API-koblinger.
3. `cf501b3e56b4d219c22956425a7aaaf4a577a467`: kontrast på delt tur og Customer-farge for manifest/browser chrome.

Dokumentasjonscommiten kommer etter siste kodecommit og endrer ikke appens bygginput. Gjeldende branch-head vises i PR-en.

## Status

| Område | Status | Bevis / begrensning |
| --- | --- | --- |
| Faktisk Customer-design | VERIFIED SOURCE | `frontend/src/theme.ts`, `frontend/src/components/ui.tsx`, `frontend/src/components/SplashArt.tsx`, `frontend/src/components/VehicleAsset.tsx` og Customer/Figma Make-startskjermen er lest fra kildecommiten. |
| Web/API-kontrakter | VERIFIED SOURCE | Eksisterende felter, roller, partner-API, turdeling, support-mailto og kontaktadresser er bevart. |
| TypeScript/Vite | VERIFIED BUILD | `tsc --noEmit && vite build` passerer; Netlify har også bygget og publisert previewet. |
| Netlify | VERIFIED PREVIEW | PR-preview i eksisterende prosjekt. Nettleser- og API-kontroller er kjørt mot den publiserte adressen. |
| Ordinær beta-submit | VERIFIED PREVIEW | Faktisk skjema, uten mock eller honeypot, fikk HTTP 201, `{ok:true,status:"registered"}` og synlig kvittering. Se JSON-bevis. |
| Produksjon | VERIFIED LIVE | Eksisterende produksjon ble kontrollert under kartlegging; redesign er **ikke** publisert til `kjappapp.no`. Ingen produksjonsdeploy, DNS-endring eller domeneflytting. |
| Gamle Vercel-checks | BLOCKED EXTERNAL | GitHub-statusene for kjapp-home-beta, kjapp-admin-beta og kjapp-fleet-beta sier `Account is blocked.` Netlify-preview er grønt. Ingen Vercel-konfigurasjon er endret. |
| Endelige juridiske tekster | MISSING | Personvern- og vilkårs-URL-er fungerer med eksisterende beta-opplysning og kontaktpunkt. Endelig juridisk godkjent tekst finnes ikke i leveransen. |
| Full partnersøknad / aktiv turdeling | MISSING | Sider, kontrakter, valideringsrespons og ugyldig delingslenke er kontrollert. Full innsending med dokumenter og en aktiv ekte tur er ikke gjennomført. |
| Core Web Vitals i felt | MISSING | Ingen feltmåling/Lighthouse-score er oppgitt. Byggstørrelse, fontlasting, assets og redusert bevegelse er kontrollert. |
| Feil i testet webomfang | BROKEN | Ingen gjenværende feil funnet i de dokumenterte kontrollene. Dette erstatter ikke verifisering av de manglende flytene ovenfor. |

## Faktiske designtokens

Customer-koden bruker **Inter**, ikke Geist. Geist er derfor ikke innført. JetBrains Mono brukes for små tekniske/produktetiketter slik Customer-kilden gjør. Begge fonter er selvhostet, med lisenser og `font-display: swap`; Inter forhåndslastes.

| Egenskap | Customer-verdi / webbruk |
| --- | --- |
| Bakgrunn | `#F4F6FA` |
| Flate / subtil flate | `#FFFFFF` / `#EEF1F5` |
| Primær / sekundær tekst | `#001F3F` / `#4A5A6E` |
| Accent | `#FF0000`, lys `#FF3B3B`, dyp `#CC0000`, myk `#FFE6E6` |
| Linjer | `rgba(0,31,63,.10)` / `.18` |
| Radii | 8, 12, 18, 24, 999 px |
| Spacing | Customer-skala 4–64 px; webseksjoner og responsiv maksbreddetilpasning bygger videre på denne |
| Knapper | 52 px høyde, pill-radius, 14 px semibold |
| Motion | Customer-lignende korte overganger, primært 160/300 ms; redusert bevegelse slår av animasjoner og smooth scrolling |
| Logo | Faktisk BrandBadge: 28 % radius, dobbel chevron, 2.6 stroke, første chevron 55 % hvit; kildegradient |

Hvit liten tekst på `#FF0000` har for svak kontrast. Interaktive webknapper og røde småtekster bruker derfor **Customer-kildens egen `accentDim` (`#CC0000`)**. Logo og den passive produktillustrasjonen beholder kildens røde gradienter. Telefonrammen og desktop-breakpoints er webtilpasninger; de er ikke presentert som native-tokens.

Produktvisningen porter den faktiske Customer-startskjermen. Den er tydelig merket og passiv, uten falsk bestillingshandling, sjåfør, ETA, livekart eller oppdiktede prisdata. Bilillustrasjonene er SVG-er fra Customer-kilden. Gjenbrukbare merke-, header-, footer-, container-, badge-, card- og produktkomponenter deler ett tokenlag og knapp-/feltstiler.

## Bevarte funksjoner og integrasjoner

- Forside, `/loyvehaver`, `/loyvehaver/soknad`, `/help`, `/tur/:token`, navigasjonsankere og footer.
- Beta-felter `name`, `phone`, `email`, `city`, `role`, `website`; roller `passenger`, `driver`, `fleet_owner`. E-post er fortsatt valgfri, Oslo er fortsatt standard.
- POST `/api/waitlist` går via Netlify-rewrite til eksisterende `/api/marketing/waitlist`. API-kontrakten er uendret. Success vises bare ved bekreftet JSON-respons; en HTML/SPA-fallback kan ikke gi falsk kvittering.
- Eksisterende partnerutkast, dokumentopplasting, innsending og turdeling bruker samme endepunkter/payloads. Gamle Emergent-fallbackadresser fra tidligere webarbeid er erstattet med same-origin `/api` og eksisterende produksjons-API; selve backend-koden er urørt.
- Samtykke må bekreftes før beta-innsending. Det er en UI-gate; ingen ekstra payload-felt eller ny backend-kontrakt. Backendens eksisterende `consent_context: beta_interest` er beholdt.
- Loading, dobbel-submit-sperre, timeout, serverfeil, feltvalidering, bekreftelse, Escape, fokusretur og fokusfangst i modal.
- Kontaktpunkter: `hei`, `support`, `driver`, `fleet`, `partner`, `privacy` på `@kjappapp.no`, samt eksisterende Fleet Panel-lenke.
- Supportskjema åpner brukerens eget e-postprogram; det sender ikke e-post automatisk.
- Canonical, metadata/OG/Twitter, Organization JSON-LD, robots, sitemap og manifest er beholdt; merkevaren er SNAR. Juridiske routes har egne metadata. Analytics er ikke lagt til eller fjernet; eksisterende lokale cookie-valg bruker fortsatt `kjapp_marketing_consent_v1`.
- Ingen offentlige App Store/Google Play-plassholderknapper. Beta-downloads vises bare når eksisterende miljøvariabler gir ekte lenker.

## Copy-endringer

Eksisterende relevant budskap er beholdt, inkludert «Norsk taxi, uten omveier», kart først, tekst/stemme, bilvalg, estimat, live sporing, norsk support og løyvehavere. Endringene er avgrenset til:

1. Synlig KJAPP-merkenavn og supportemne er endret til SNAR; domene og e-postadresser er beholdt.
2. Oslo først / beta er tydeliggjort i etiketter og CTA «Få tilgang til beta».
3. Nedlastingsseksjonen forklarer beta-status og viser ekte lenker først når de er aktive.
4. Produktillustrasjonen bruker Customer-startskjermens faktiske tekst («SNAR», «Kom i gang»), fremfor det tidligere webutkastets oppdiktede demoopplysninger.
5. Samtykke-, feil- og bekreftelsestekster gjør eksisterende innsending forståelig. Juridiske sider bruker beta-opplysning og kontakter, uten oppdiktede juridiske vilkår.

## QA og bevis

Nettleser: faktisk Chromium/Playwright mot både lokal produksjonsbuild og Netlify-preview. Bredder: **320, 375, 390, 430, 768, 1024, 1280, 1440, 1920 og 2560 px**. Ingen horisontal overflow eller manglende bilder ved disse breddene. Modalen passer skjermen ved alle ti bredder og returnerer fokus til åpneren. Mobilmeny, Escape og ankerscrolling er kontrollert.

69 eksplisitte kontroller passerer. 14 axe-skanninger for WCAG 2 A/AA og WCAG 2.1 AA har null registrerte violations i testet omfang. Dette er automatisert evidens, ikke en full WCAG-sertifisering. Tab/Shift+Tab rundt modal, labels, fokus, samtykke, reduced motion, cookie-valg og ugyldig delt tur er kontrollert. Ingen runtime-JS-feil eller mislykkede ikke-API-assets er registrert.

Beta-UI-testene bruker kontrollerte API-responser for 503-serverfeil, HTML-fallback, forsinket innsending og 201-success. De er tydelig skilt fra ekte API-test:

- Ekte `/api/health`: HTTP 200, API/database health OK.
- Ekte tom venteliste-payload: HTTP 422 fra backend.
- Ekte honeypot-kontroll: HTTP 201, ingen lagring etter kildekodens gren.
- **Ekte ordinær innsending gjennom previewets skjema:** HTTP 201, riktig JSON og synlig «Registrert». Én testpost med navnet `SNAR WEB QA TEST 20261004 - ikke kontakt`, telefon `00000000` og reservert `snar-web-qa-20261004@example.invalid` ble opprettet gjennom uendret API. Ingen direkte databaseendring eller separat databaseoppslag. Backend-ruten har ingen kode som sender e-post/SMS.
- Ekte tom partnersøknad: HTTP 422 med forventede felt.
- Ekte ugyldig delingstoken: HTTP 404 med riktig norsk feilmelding.

Bygg: 37 moduler, HTML 2.39 kB / gzip 0.81 kB; CSS 25.75 kB / gzip 6.02 kB; JS 238.16 kB / gzip 75.42 kB. Ingen nytt effekt-/animasjonsbibliotek eller runtime-avhengighet. Lokale WOFF2-fonter er ca. 48/22 kB, bil-SVG-er er små, og produktvisningen trenger ingen tung rastermockup.

Bevisfiler: [lokal QA](qa-local-results.json), [preview QA](qa-preview-results.json), [API-kontroller](api-ingress-results.json), [ordinær submit](real-waitlist-submit.json), [kjørbar QA](verify-preview.cjs), [full filliste](changed-files.json).

QA-scriptet krever Node, Playwright med Chromium og axe-core i utviklingsmiljøet. `QA_BASE_URL` velger preview; uten variabelen brukes lokal `marketing-web/dist`. `QA_CHROME`, `QA_AXE_SCRIPT`, `QA_DIST`, `QA_OUTPUT_DIR` og eventuell eksplisitt browser-proxy kan overstyres. Scriptet mocker submit-responsene og oppretter ikke ventelisteposter. Den ekte innsendingen ovenfor er dokumentert separat.

### Visuell QA

Font, navy/rød-palett, bakgrunn, BrandBadge-glyph, radii, pill-knapper, kort, borders og startskjerm er sammenholdt med Customer-kilden. Desktop tilpasses web uten å strekke innholdet over ultrawide. Ingen påstand om pixel-perfect native-layout.

| Påkrevd bilde | Screenshot |
| --- | --- |
| Desktop hero | [desktop-hero.png](screenshots/desktop-hero.png) |
| Desktop mid-page | [desktop-mid-page.png](screenshots/desktop-mid-page.png) |
| Desktop footer | [desktop-footer.png](screenshots/desktop-footer.png) |
| Mobil hero | [mobile-hero.png](screenshots/mobile-hero.png) |
| Mobil venteliste | [mobile-waitlist.png](screenshots/mobile-waitlist.png) |
| Mobil produkt | [mobile-product.png](screenshots/mobile-product.png) |

## Endrede filer

Fullstendig samlet PR-diff før QA-dokumentasjonen er listet i `changed-files.json` (32 filer). Hovedgrupper:

| Filer | Endring |
| --- | --- |
| `src/snar-tokens.css`, `src/snar-landing.css` | Customer-tokenlag, responsive webstiler, redusert bevegelse |
| `src/SnarUI.tsx`, `src/ProductPreview.tsx`, `src/LegalPage.tsx` | Gjenbrukbare merke-/layoutkomponenter, faktisk produktstartskjerm, juridiske beta-routes |
| `src/PremiumHome.tsx`, `src/App.tsx` | Designmigrasjon av forside/partner og router |
| `src/BetaWaitlist.tsx` | Design, samtykke, tilgjengelig modal, robust uendret API-submit |
| `src/ApplyPage.tsx`, `src/HelpPage.tsx`, `src/help.css`, `src/TripSharePage.tsx`, `src/support-footer.css` | Eksisterende funksjonssider i samme palett og typografi |
| `src/main.tsx`, `src/seo.ts`, `index.html`, `public/site.webmanifest` | Global styling, route-SEO, fontlasting, SNAR-identitet |
| `public/assets/figma/logo.svg`, `public/assets/snar/*.svg`, `public/fonts/*` | Faktiske logo-/bil-assets, lokale fonter og lisenser |
| `src/api.ts`, `api/waitlist.js`, `.env.example`, `netlify.toml` | Bevarte API-kontrakter med korrekt eksisterende Netlify/Render-routing, inkludert tidligere webarbeid |
| `.gitignore`, `README.md`, `PRODUCTION_READINESS.md` | Webdokumentasjon og utelukkelse av genererte bygge-/lokalfiler |
| `docs/snar-web-20261004/*` | Denne rapporten, tester, resultatfiler og seks screenshots |

## Før eventuell produksjonspublisering

Preview og Draft PR er levert. Produksjonsstatus for redesign er ikke VERIFIED LIVE. Endelige juridiske tekster, full partnersøknad med dokumenter og en aktiv turdeling må avklares/verifiseres før de omtales som ferdig testet. De eksterne Vercel-kontoblokkeringene vises fortsatt i PR-en, selv om ønsket Netlify-preview fungerer.
