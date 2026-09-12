# KJAPP Web + Fleet — Phase D High-Fidelity Screen Specification

Status: PHASE D LOCKED SPEC

This document translates the approved information architecture, wireframes and design system into precise production design instructions for the eight locked screens.

No new routes, integrations, portals or product concepts are introduced here.

Sources of truth, in order:

1. `docs/KJAPP_WEB_FLEET_LOCKED_PLAN.md`
2. `docs/KJAPP_WEB_WIREFRAMES.md`
3. `docs/KJAPP_WEB_DESIGN_SYSTEM.md`
4. current KJAPP theme in `frontend/src/theme.ts`
5. existing in-repo KJAPP visual language under `_legacy_web`

---

# 1. Global canvas and grids

## Desktop marketing canvas

Reference frame: `1440 × auto`.

Content container:

- max width: `1200px`
- left/right page margin: `max(48px, calc((100vw - 1200px)/2))`
- 12 columns
- gutter: `24px`
- hero min height: `820px`

Header:

- height: `80px`
- content aligned to the same 1200px container
- logo left
- navigation right
- header z-index above hero media

## Tablet marketing

Reference frame: `768 × auto`.

- page padding: `32px`
- hero switches to stacked layout at/under 900–960px if the phone visual would become cramped
- no squeezed two-column value blocks below 768px

## Mobile marketing canvas

Reference frame: `390 × auto`.

- page padding: `20px`
- header height: `68px`
- section spacing: `80px`
- internal section title-to-content gap: `24–32px`

## Fleet desktop canvas

Reference frame: `1440 × 900`.

- sidebar width: `248px`
- main content padding: `32px`
- page max content width: `1160px`
- content column begins at x ≈ `280px`
- vertical page-header area: `72–84px`

## Fleet mobile canvas

Reference frame: `390 × 844`.

- top bar height: `60–64px` plus safe area
- page side padding: `16px`
- bottom nav visual height: `64px` plus safe-area inset
- page content bottom padding: at least `96px` plus safe area

---

# 2. Brand mark treatment

Text wordmark:

`KJAPP`

- font: Fraunces, medium/semi-bold visual weight
- letter spacing: approximately `-0.01em` to `0.01em`
- default text: Ivory `#F4F4F0`
- signature `A` accent: Brass `#CBA365`

Marketing desktop wordmark size:

- header: `25–28px`

Fleet sidebar:

- `22–24px`
- secondary label `PARTNER` beneath or adjacent at `9–10px`, uppercase, tracking `0.28em`, muted brass

Do not introduce a second logo or fleet-specific symbol.

---

# 3. Screen 01 — Marketing Home `/`

## Desktop hero

Frame: `1440 × 820–900px` first viewport region.

Header at top.

Main hero grid begins around y `150–170px`.

Left text column:

- width: `560–620px`
- overline: `TAXI. ENKLERE.` at 11–12px uppercase, brass, letter spacing ~0.26em
- wordmark/brand may sit above or be integrated in H1, but there must not be two competing giant KJAPP headings
- H1 line 1/primary: `KJAPP`
- H1 line 2: `Taxi. Enklere.`
- H1 max font size: `80px`
- H1 line-height: about `0.98`
- max text block width: `580px`

Supporting copy:

`Bestill taxi på sekunder. Norske løyvehavere. Tydelig pris. Ingen unødvendig styr.`

- font size: `19px`
- line height: `1.55`
- width: `480px` max
- color: `#C8CED4`
- margin top: `28px`

CTA row:

- top margin: `34–38px`
- primary width approximately `180–210px`, height `56px`
- secondary width approximately `190–220px`, height `56px`
- gap `12px`

Right product visual:

- one phone only
- visible phone frame width `340–390px`
- phone top y approximately `128–155px`
- slight 2–4° visual tilt permitted only if it does not distort the product UI
- phone should show the actual current KJAPP customer home/map experience
- optional soft brass halo behind phone at ≤ 8% opacity
- no decorative second/third device

Hero lower fade/transition:

- very subtle dark fade into next section
- no hard diagonal separators

## Mobile hero

Reference width: `390px`.

Header:

- logo left
- compact primary CTA `Last ned` right
- links accessible from a minimal menu if needed

Hero content begins `28–36px` below header.

- overline: 10px
- H1: `48–54px`
- line-height: `1.0`
- supporting copy: `17px`, max width full content
- primary CTA: full width, 56px
- secondary CTA: full width, 54px, 10–12px gap
- product phone visual: centered, `280–315px` width, margin top `44px`

No horizontal overflow.

## Section: Slik fungerer det

Desktop:

- top/bottom section padding: about `112px`
- section H2: `48px`
- three steps laid out horizontally
- each step width about `32%`
- step number: 11px brass mono/overline
- title: `24–26px` Fraunces
- short supporting line only if required; no paragraph bloat
- each step gets one real product crop or one restrained product representation

Mobile:

- vertical list
- 32–40px between steps
- UI crop under each title or aligned as a compact visual block

Exact titles:

1. `Velg hvor du skal`
2. `Se pris og bil`
3. `Følg sjåføren frem til deg`

## Section: Hvorfor KJAPP

Desktop:

- asymmetric two-column section, not generic four-card grid
- left: heading and short positioning sentence
- right: 2×2 list with subtle dividers, not four large glowing cards

Exact points:

- Lokale taxiselskaper og løyvehavere
- Tydelige priser
- Verifiserte sjåfører
- Norsk kundestøtte

Each point:

- icon 20px max
- title 17–19px
- body only if one short clarifying sentence is necessary

## Section: KJAPP Assist

Only live if corresponding product feature is production-ready.
Otherwise show visible pill `Kommer snart`.

Desktop visual:

- large premium panel approximately `1200 × 460–520px`
- left: headline/copy
- right: compact conversational product mock
- example user line:
  `Bestill taxi fra Majorstua til Gardermoen kl. 06:00 i morgen.`

Do not claim voice booking is live unless it is live.

## Section: Har du løyve?

Desktop:

- dark elevated surface / split panel around `1200 × 420px`
- left 55–60%: copy + CTAs
- right: restrained fleet portal preview

Exact heading:

`Har du løyve? Kjør med KJAPP.`

Exact supporting copy:

`Behold kontrollen over virksomheten din. Få turer gjennom KJAPP og administrer sjåfører, aktivitet og oppgjør fra ett sted.`

Primary CTA:

`Bli KJAPP-partner`

Secondary CTA:

`Logg inn som løyvehaver`

## Footer

Desktop:

- top border 1px line
- vertical padding `48–64px`
- no oversized sitemap
- left wordmark
- compact essential links
- store badges only when live

---

# 4. Screen 02 — Licence-holder page `/loyvehaver`

## Desktop hero

Reference first section height: `680–760px`.

Grid:

- left: 6–7 columns
- right: 5–6 columns fleet preview

Overline:

`LØYVEHAVERE`

H1:

`Ditt løyve. Din virksomhet. KJAPP gir deg flere muligheter.`

- width: `620px` max
- font: Fraunces
- size: `62–72px`
- line-height: `1.02`

Supporting copy:

`Koble løyvet ditt til KJAPP, legg til sjåfører og få tilgang til turer gjennom vår kundeplattform.`

- 18–20px
- 520px max width

CTA row identical size language to home hero.

Fleet preview:

- show an actual own-fleet dashboard composition
- no customer/admin data
- sample values only in design comp if visually labelled placeholder; production must bind to real/empty state

## Four-value section

Use a 2×2 editorial grid with separators.
No large icon cards.

Exact values:

- Lav og tydelig provisjon
- Du beholder kontrollen
- Eget kontrollpanel
- Norsk support

## Application section

Desktop container:

- overall 1200px width
- left explanation: 35–40%
- right form: 55–60%
- form panel max width about `640px`
- form panel padding `32px`
- 24px radius

Form layout:

- two-column only for short compatible fields at desktop
- one-column for long identity fields where clarity wins
- field height 54–56px
- labels always shown above
- submit button height 56px

Exact public fields:

- Navn
- Bedriftsnavn
- Organisasjonsnummer
- Telefon
- E-post
- Antall løyver
- Antall biler
- Område/by

Success state replaces the form content in the same panel:

- restrained check icon
- title `Takk. Vi kontakter deg.`
- one short sentence about next contact step, no invented SLA unless KJAPP explicitly commits to one

No document uploader on this screen.

## Mobile

- headline 42–48px
- fleet preview below both CTAs
- four values as four vertically separated rows
- application form full width
- all fields one column

---

# 5. Screen 03 — Fleet Login

## Desktop

Background:

- `#070B0E`
- subtle top-left brass ambient glow ≤5%
- optional light grain

Top-left brand:

- x 40px, y 32px
- KJAPP PARTNER

Login panel:

- width `420–460px`
- centered horizontally and approximately vertically
- padding `34–40px`
- background `#0E151A` / 94% equivalent
- border 1px line
- radius 24px

Title:

`Flåte-eier innlogging`

- 32px Fraunces

Subcopy:

`Administrer virksomheten, sjåførene og oppgjøret ditt.`

Fields:

- E-post
- Passord
- 56px height

Forgot password link aligned right below password.

Primary CTA full width 56px.

Bottom contextual link:

`Ikke partner? Søk om å bli løyvehaver`

## 2FA state

Same panel, no modal.

- title changes to `To-trinns verifisering`
- six-digit field centered/mono
- full-width verify CTA
- secondary cancel/back action

## Error state

- 1 inline error panel above CTA
- no toast-only auth errors

## Mobile

Panel becomes the page surface:

- no floating centered card necessary under 520px
- side padding 24px
- content vertically starts around y 120–145px

---

# 6. Fleet shell high-fidelity

## Desktop sidebar

Width: `248px` fixed.

Background: `#090E12` or `#0C1216`.

Right border: 1px `--line`.

Top brand area:

- height about 88px
- padding left/right 22px

Navigation begins around y 116px.

Nav item:

- height 44–46px
- horizontal margin 12px
- inner padding 12px
- radius 12px
- icon 18px
- label 14px

Selected:

- background accent-soft
- text brass
- optional 1px border rgba(203,163,101,0.20)

Bottom identity:

- company name 13px
- role/secondary line 11px muted
- logout compact text button

## Desktop main header

Main content top:

- title area min height 76px
- title left
- contextual CTA right
- no global search in fleet phase 1

## Mobile top bar

- sticky top
- high-opacity granite backing + 1px bottom border
- brand left, company/account trigger right

## Mobile bottom nav

Exactly five equally sized cells:

- Oversikt
- Sjåfører
- Turer
- Økonomi
- Bedrift

Icon 19–20px.
Label 10–11px.
Active = brass.
Offline/online status is not represented in nav.

---

# 7. Screen 04 — Fleet Oversikt

## Desktop header

Title:

`Oversikt`

Secondary line:

`{fleet name} · Org.nr {org_number}` where available.

## KPI row

Four equal cards.

Card height: `128–144px`.

Labels:

1. `Turer i dag`
2. `Omsetning i dag`
3. `Aktive sjåfører`
4. `Påloggede biler`

Notes:

- current backend has `drivers_online` but not a separate vehicle entity count. Until a separate truthful distinction exists, “Påloggede biler” may display the same number only if one approved driver maps to one current vehicle; otherwise label the fourth card `Totale sjåfører` or omit it in implementation rather than inventing data. The final UI must not fabricate a separate vehicle metric.

This is a data-integrity exception: the four-card visual slot exists, but the label/value must remain truthful.

## Main operational row

Grid:

- map: 8 columns
- latest trips: 4 columns
- gap 20–24px
- height around `380px`

Map:

- rounded 20px
- own online cars only
- dark KJAPP map
- top-left small status chip: `{n} pålogget`

Latest trips:

- card height matches map
- heading `Siste turer`
- max 5–6 rows
- each row: time, driver, status/fare
- no customer phone/email
- `Se alle turer` link bottom

## Weekly section

Heading `Denne uken`.

Four summary blocks/cards:

- Omsetning
- Turer
- KJAPP provisjon
- Netto

KJAPP commission amount = backend period gross - backend period net. Do not hardcode rate.

## Mobile

Order:

1. page/company header
2. 2×2 KPI cards
3. map `358 × 250–280px`
4. weekly summary as one larger card with 2×2 values
5. latest trips cards

---

# 8. Screen 05 — Fleet Sjåfører

## Desktop header

Title left: `Sjåfører`.
CTA right: `+ Legg til sjåfør`.

## Tool row

- search field max width `420px`
- tabs `Aktive` and `Invitasjoner`
- tabs use compact pill treatment

## Drivers table

Full available width.

Header height: `42px`.
Row height: `60px`.

Columns:

- Sjåfør 26%
- Bil 24%
- Status 16%
- Turer i dag 16%
- Omsetning 18%

Status:

- `Pålogget` mint chip/dot
- `Avlogget` neutral muted

Currency right aligned.

## Invite modal

Desktop:

- width `480px`
- radius 24px
- padding 28px

Fields, exactly current invite payload:

- Bilmodell
- Skiltnummer
- Bilkategori
- E-post (valgfri)
- Notat (valgfri)

CTA:

`Send invitasjon`

After creation:

- invitation appears in Invitasjoner tab
- copy invitation link action
- statuses based on real `used` / `email_sent` / expiry data

## Mobile

Header CTA can shorten visually but text remains understandable.

Driver card row min height 76px.

Left:

- online dot
- name
- car + plate

Right:

- income
- trips

No horizontal table scrolling.

Invite modal becomes bottom sheet/full-height sheet with safe area.

---

# 9. Screen 06 — Fleet Turer

## Desktop

Page title: `Turer`.

Filter row:

- period segmented control: `I dag`, `7 dager`, `30 dager`
- status select
- search field

Height of controls: 44px.

Table columns:

- Tid/dato 15%
- Sjåfør 17%
- Hentested 22%
- Destinasjon 22%
- Status 12%
- Pris 12%

Rows:

- 58–62px
- address columns single-line with ellipsis
- full address may be available by title/accessible expansion, but do not make a complex details drawer in phase 1

Statuses map from the existing ride status model.

No admin actions in row.

## Empty state

`Ingen turer i valgt periode.`

One optional action: reset filters.

## Mobile

Filter control order:

- compact period selector
- `Filtrer` control for status/search if width demands it

Trip card:

```text
13:42 · I dag                     289 kr
Ahmed Khan                    [Fullført]
Majorstuen
↓
Oslo S
```

No customer PII.

---

# 10. Screen 07 — Fleet Økonomi

## Desktop header

Title `Økonomi`.
Secondary period label `Denne uken` for summary cards.

## Summary row

Three cards:

- Omsetning
- KJAPP provisjon
- Netto

Card height `136px`.

Gross/net figures use mono/tabular or large display numbers consistently.

## Monthly report panel

- margin top `28px`
- horizontal desktop layout
- left: title + one-line explanation
- right: month select, year select, download CTA

Exact primary action:

`Last ned månedsrapport`

If implementation exposes file type in helper text:

`Excel (.xlsx)`

Do not display PDF/CSV options in phase 1.

## Payout table

Heading `Utbetalinger`.

Columns:

- Periode
- Turer
- Brutto
- Netto
- Status

No “Run payout” button.

## Mobile

- three summary cards stacked or 1 + 2 grid depending readability
- report selector becomes stacked full-width
- payout history becomes cards

---

# 11. Screen 08 — Fleet Bedrift

## Desktop

Title `Bedrift`.

Use two-column content at desktop:

Left 7 columns:

### Bedriftsinformasjon

Card rows:

- Firmanavn
- Organisasjonsnummer
- Kontaktperson
- E-post
- Telefon

Right 5 columns:

### KJAPP-avtale

- status
- provisjon
- antall tilknyttede sjåfører

### Onboarding / compliance

- show only statuses available from backend/application data
- if no structured compliance state is available to fleet owner, show a truthful neutral message rather than a fake checklist

Phase 1 is read-first.

No commission editing.
No user-role controls.
No API settings.
No billing integration.

## Mobile

Stack order:

1. Bedriftsinformasjon
2. KJAPP-avtale
3. Onboarding/compliance

Each card uses label/value rows separated by 1px lines.

---

# 12. Public Help `/hjelp`

This route is already in locked scope but is not one of the eight main design screens.
It should therefore remain deliberately simple, built from the same marketing components.

Content only:

- heading `Hvordan kan vi hjelpe?`
- short customer support contact option(s) that KJAPP actually operates
- partner/løyvehaver link
- common short guidance only if real information is available

Do not build a help-center CMS or ticketing system.

---

# 13. Privacy and terms

`/personvern` and `/vilkar` are text/legal pages.

Layout:

- marketing header
- max-width reading column `760px`
- H1 44–52px desktop / 34–38px mobile
- body 16px, line-height 1.7
- table-of-contents only if document length genuinely benefits
- marketing footer

Do not redesign legal content into cards.

---

# 14. Production states required for every dynamic fleet screen

Every dynamic screen requires design for:

- loading
- loaded
- empty
- error
- auth expired
- wrong role

No mock data fallback.

## Skeletons

- neutral granite blocks
- no shimmering high-contrast animation if prefers-reduced-motion

## Error panel

- inline, near affected area
- one `Prøv igjen` action where safe

## Authentication expiry

- clear session message
- return to fleet login

---

# 15. High-fidelity review checklist

Before implementation is called visually complete:

- all eight main screens exist at desktop and mobile
- public header/footer match all marketing pages
- fleet shell is shared consistently
- exact locked copy is used for home and løyvehaver hero/value sections
- no extra nav item exists
- no unverified integration logo exists
- product visuals come from actual KJAPP design
- brass/mint discipline is followed
- forms have labels, focus, error, loading and success states
- tables have a dedicated mobile representation
- no fake numbers, users, trips or vehicles are required to make the screen look complete
- admin UI is not copied into fleet portal

Phase D is complete when the implementation follows these measurements and visual hierarchy without inventing new scope.