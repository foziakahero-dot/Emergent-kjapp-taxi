# KJAPP Web + Fleet — Phase B Wireframes

Status: PHASE B COMPLETE SPEC

This file implements the wireframe phase defined in `KJAPP_WEB_FLEET_LOCKED_PLAN.md`.
It does not add routes, products, integrations or portals outside the locked scope.

## 0. Source of truth

Use only the existing KJAPP repository as product reference:

- current KJAPP mobile brand/theme
- `_legacy_web` for existing KJAPP marketing/fleet visual DNA and proven fleet interactions
- existing FastAPI/MongoDB backend
- existing fleet-owner role and `/fleet/*` APIs
- existing `admin-web` remains untouched

The website is not a second taxi product. The native apps remain the ride product.

---

# 1. Global information architecture

## Public marketing domain

`kjappapp.no`

Routes:

- `/`
- `/loyvehaver`
- `/hjelp`
- `/personvern`
- `/vilkar`

Global header links:

- KJAPP logo → `/`
- `For løyvehavere` → `/loyvehaver`
- `Hjelp` → `/hjelp`
- primary CTA `Last ned KJAPP`

Global footer links:

- Kunder → `/`
- Løyvehavere → `/loyvehaver`
- Hjelp → `/hjelp`
- Personvern → `/personvern`
- Vilkår → `/vilkar`
- Kontakt → help/contact section
- App Store / Google Play only when the real store URLs exist

No mega-menu.
No web booking.
No customer account/login.

## Fleet portal domain

`fleet.kjappapp.no`

Routes/screens in this phase:

- `/login`
- `/fleet` → Oversikt
- `/fleet/drivers` → Sjåfører
- `/fleet/trips` → Turer
- `/fleet/finance` → Økonomi
- `/fleet/company` → Bedrift

Fleet navigation is locked to exactly:

1. Oversikt
2. Sjåfører
3. Turer
4. Økonomi
5. Bedrift

---

# 2. Shared layout rules

## Marketing desktop

- viewport reference: 1440 px
- content max width: 1200–1240 px
- 12-column grid
- horizontal page padding: 40–64 px
- section vertical spacing: 104–144 px
- text remains left aligned
- hero uses an asymmetric 7/5 or 6.5/5.5 split, never a generic centered SaaS hero
- use one real KJAPP phone/app visual as the dominant hero visual

## Marketing mobile

- reference width: 390 px
- page padding: 20 px
- section spacing: 72–88 px
- no tiny multi-column layouts
- CTAs become full-width or near-full-width where appropriate
- product visual appears directly after hero copy/CTA

## Fleet desktop

- reference width: 1440 px
- fixed left sidebar: 240–256 px
- application content max width: ~1360 px including sidebar shell
- main content padding: 28–36 px
- dense but calm operational layout
- no decorative marketing sections inside the portal

## Fleet mobile

- reference width: 390 px
- no desktop sidebar
- compact top bar for company/page identity
- five-item bottom navigation using the exact locked fleet sections
- all tables collapse to structured cards/list rows
- map/cards use full available width

---

# 3. Screen 01 — Main website `/`

## Purpose

Explain KJAPP in seconds, move customers toward the app, and route licence holders to the partner page.

## Desktop wireframe

```text
┌─────────────────────────────────────────────────────────────────────┐
│ KJAPP                     For løyvehavere   Hjelp   [Last ned KJAPP]│
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  TAXI. ENKLERE.                         ┌──────────────────────┐     │
│                                                                     │
│  KJAPP                              actual KJAPP customer app        │
│  Taxi. Enklere.                     phone / map / booking UI         │
│                                                                     │
│  Bestill taxi på sekunder.          one device only                 │
│  Norske løyvehavere.                                               │
│  Tydelig pris.                                                     │
│  Ingen unødvendig styr.                                            │
│                                                                     │
│  [Last ned KJAPP] [Er du løyvehaver?]                               │
│                                └──────────────────────┘              │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ SLIK FUNGERER DET                                                   │
│                                                                     │
│  01 Velg hvor du skal  →  02 Se pris og bil  →  03 Følg sjåføren   │
│     small real UI crop      small real UI crop      small UI crop   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ HVORFOR KJAPP                                                       │
│                                                                     │
│  Lokale taxiselskaper   Tydelige priser                             │
│  Verifiserte sjåfører   Norsk kundestøtte                           │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ KJAPP ASSIST  [Kommer snart if not production-ready]                │
│                                                                     │
│  “Bestill taxi fra Majorstua til Gardermoen kl. 06 i morgen.”       │
│  compact product conversation visual                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ HAR DU LØYVE?                                                       │
│                                                                     │
│  Har du løyve? Kjør med KJAPP.              fleet portal crop       │
│  Behold kontrollen over virksomheten din.                           │
│  [Bli KJAPP-partner] [Logg inn som løyvehaver]                      │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ KJAPP   Kunder · Løyvehavere · Hjelp · Personvern · Vilkår · Kontakt│
└─────────────────────────────────────────────────────────────────────┘
```

## Hero behaviour

- header begins transparent/dark and gains an opaque granite surface after scrolling
- hero min-height approximately 760–860 px on desktop
- primary headline width capped to avoid stretching
- phone visual may overlap the next section slightly, but must not obscure content
- no fake ride counts, user counts, ratings or “#1” claims

## Mobile wireframe

```text
┌──────────────────────────────┐
│ KJAPP              [Last ned]│
│               menu: Løyve/Hjelp
├──────────────────────────────┤
│ TAXI. ENKLERE.               │
│                              │
│ KJAPP                        │
│ Taxi. Enklere.               │
│                              │
│ Bestill taxi på sekunder...  │
│                              │
│ [ Last ned KJAPP           ] │
│ [ Er du løyvehaver?        ] │
│                              │
│      actual KJAPP phone      │
│                              │
├──────────────────────────────┤
│ SLIK FUNGERER DET            │
│ 01 Velg hvor du skal         │
│ 02 Se pris og bil            │
│ 03 Følg sjåføren             │
├──────────────────────────────┤
│ HVORFOR KJAPP                │
│ four stacked value rows      │
├──────────────────────────────┤
│ KJAPP ASSIST                 │
│ optional / “Kommer snart”    │
├──────────────────────────────┤
│ Har du løyve?                │
│ Kjør med KJAPP.              │
│ [ Bli KJAPP-partner        ] │
│ [ Logg inn                 ] │
├──────────────────────────────┤
│ minimal footer               │
└──────────────────────────────┘
```

## Main-page acceptance

- customer understands “taxi app” without scrolling
- download CTA visible above fold
- licence-holder CTA visible above fold but visually secondary
- no feature is advertised as live unless it is genuinely production-ready
- no stock taxi hero image

---

# 4. Screen 02 — Licence-holder acquisition `/loyvehaver`

## Purpose

Convert a real Norwegian licence holder into a short initial application without creating unnecessary onboarding friction.

## Desktop wireframe

```text
┌─────────────────────────────────────────────────────────────────────┐
│ KJAPP                     For løyvehavere   Hjelp   [Last ned KJAPP]│
├─────────────────────────────────────────────────────────────────────┤
│ LØYVEHAVERE                                                         │
│                                                                     │
│ Ditt løyve. Din virksomhet.             real fleet overview preview │
│ KJAPP gir deg flere muligheter.         ┌─────────────────────────┐  │
│                                         │ KPI / own cars / map    │  │
│ Koble løyvet ditt til KJAPP...          └─────────────────────────┘  │
│                                                                     │
│ [Søk om å bli løyvehaver] [Jeg er allerede partner → Logg inn]      │
├─────────────────────────────────────────────────────────────────────┤
│ FIRE GRUNNER                                                        │
│                                                                     │
│ Lav og tydelig provisjon       Du beholder kontrollen               │
│ Eget kontrollpanel             Norsk support                        │
├─────────────────────────────────────────────────────────────────────┤
│ BLI KJAPP-PARTNER                                                   │
│                                                                     │
│  left: short explanation      right: application form               │
│                               Navn                                  │
│  “Første steg tar kort tid.”  Bedriftsnavn                          │
│                               Organisasjonsnummer                   │
│                               Telefon                               │
│                               E-post                                │
│                               Antall løyver                          │
│                               Antall biler                           │
│                               Område/by                              │
│                               [Send søknad]                         │
│                                                                     │
│                               success: “Takk. Vi kontakter deg.”     │
├─────────────────────────────────────────────────────────────────────┤
│ minimal footer                                                        │
└─────────────────────────────────────────────────────────────────────┘
```

## Rules

- no pricing table
- no “book a demo” funnel
- no required document upload in this first marketing form
- no legal/compliance wall before initial contact
- link to `fleet.kjappapp.no/login` for existing partners

## Mobile wireframe

```text
KJAPP
LØYVEHAVERE

Ditt løyve.
Din virksomhet.
KJAPP gir deg flere muligheter.

[ Søk om å bli løyvehaver ]
[ Allerede partner? Logg inn ]

fleet UI preview

4 value rows

BLI KJAPP-PARTNER
short intro

[Navn]
[Bedriftsnavn]
[Org.nr]
[Telefon]
[E-post]
[Antall løyver]
[Antall biler]
[Område/by]

[ Send søknad ]
```

---

# 5. Screen 03 — Fleet login `fleet.kjappapp.no/login`

## Purpose

Fast, trustworthy login for approved licence holders. It must never look like KJAPP internal admin.

## Desktop wireframe

```text
┌───────────────────────────────────────────────────────────────┐
│ KJAPP PARTNER                                                 │
│                                                               │
│                 ┌────────────────────────────┐                │
│                 │ Flåte-eier innlogging      │                │
│                 │ Administrer virksomheten   │                │
│                 │                            │                │
│                 │ [E-post]                   │                │
│                 │ [Passord              👁] │                │
│                 │ Glemt passord?             │                │
│                 │                            │                │
│                 │ [ Logg inn ]               │                │
│                 │                            │                │
│                 │ Ikke partner?              │                │
│                 │ Søk om å bli løyvehaver    │                │
│                 └────────────────────────────┘                │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Login states

- default
- loading
- invalid credentials
- 2FA challenge if account requires it
- wrong role: “Denne kontoen har ikke tilgang til løyvehaverportalen.”
- forgot password

No demo buttons in production.

Mobile uses the same form full-width with 20–24 px side padding.

---

# 6. Shared Fleet portal shell

## Desktop shell

```text
┌──────────────────────┬──────────────────────────────────────────────┐
│ KJAPP                 │ page title                    company/user │
│ PARTNER               ├──────────────────────────────────────────────┤
│                      │                                              │
│ ● Oversikt            │ main content                                 │
│   Sjåfører            │                                              │
│   Turer               │                                              │
│   Økonomi             │                                              │
│   Bedrift             │                                              │
│                      │                                              │
│ ───────────────────  │                                              │
│ company name         │                                              │
│ Logg ut              │                                              │
└──────────────────────┴──────────────────────────────────────────────┘
```

## Mobile shell

Top bar:

- KJAPP PARTNER
- short company name
- optional compact account/logout menu

Bottom nav:

`Oversikt | Sjåfører | Turer | Økonomi | Bedrift`

No additional navigation categories.

---

# 7. Screen 04 — Fleet Oversikt

## Purpose

Answer within five seconds:

- How is the fleet doing today?
- Who is online?
- Where are my active cars?
- What is the money picture?

## Desktop wireframe

```text
Oversikt
Oslo Taxi AS · Org.nr XXXXXXXX

┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│ Turer i dag│ │ Omsetning  │ │ Aktive     │ │ Påloggede  │
│     12      │ │ 4 820 kr   │ │ sjåfører   │ │ biler       │
└────────────┘ └────────────┘ └────────────┘ └────────────┘

┌───────────────────────────────────────┬─────────────────────────┐
│ LIVE KART                             │ SISTE TURER              │
│ only own cars with real coordinates   │ time / driver / fare     │
│                                       │ short list, max 5–6      │
└───────────────────────────────────────┴─────────────────────────┘

DENNE UKEN
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│ Omsetning  │ │ Turer       │ │ KJAPP      │ │ Netto       │
│            │ │             │ │ provisjon  │ │             │
└────────────┘ └────────────┘ └────────────┘ └────────────┘
```

## Mobile order

1. company/page header
2. 2×2 KPI grid
3. live map
4. weekly summary card
5. latest trips list

## Empty states

- no drivers: “Ingen sjåfører er tilknyttet ennå.” + action to Sjåfører
- drivers exist but nobody online: map remains real, no fake vehicle markers
- no trips today: show 0 and simple text, not demo activity

---

# 8. Screen 05 — Fleet Sjåfører

## Desktop wireframe

```text
Sjåfører                                           [+ Legg til sjåfør]

[ Søk navn, skilt eller bil ]

[Aktive] [Invitasjoner]

┌─────────────────────────────────────────────────────────────────────┐
│ SJÅFØR        BIL             STATUS       TURER I DAG   OMSETNING │
├─────────────────────────────────────────────────────────────────────┤
│ Ahmed Khan    Tesla Model Y   ● Pålogget      7          2 840 kr │
│ ...                                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

`Invitasjoner` remains a tab inside this page, not a new navigation page.

Invite modal uses the existing invite flow:

- bilmodell
- skiltnummer
- bilkategori
- e-post optional
- short note optional
- submit
- resulting invite can be copied

Do not create a second driver onboarding system.

## Mobile

Each driver becomes a card row:

```text
● Ahmed Khan                 2 840 kr
  Tesla Model Y · EL12345     7 turer
```

Search and `+ Legg til sjåfør` remain at top.

---

# 9. Screen 06 — Fleet Turer

## Purpose

Operational review of this fleet’s trips only.

## Desktop wireframe

```text
Turer

[ I dag | 7 dager | 30 dager ]   [Status: Alle ▾]   [Søk tur/adresse]

┌────────────────────────────────────────────────────────────────────────────┐
│ TID       SJÅFØR       HENTESTED       DESTINASJON      STATUS     PRIS  │
├────────────────────────────────────────────────────────────────────────────┤
│ 13:42     Ahmed Khan    Majorstuen      Oslo S           Fullført   289 kr│
│ ...                                                                        │
└────────────────────────────────────────────────────────────────────────────┘
```

No refund controls.
No customer management.
No manual admin intervention.
No global fleet visibility.

## Mobile

Trip cards show:

- date/time
- driver
- status chip
- pickup → destination
- fare

Filters collapse to one compact row/sheet.

---

# 10. Screen 07 — Fleet Økonomi

## Purpose

Show enough financial information to understand KJAPP activity without becoming accounting software.

## Desktop wireframe

```text
Økonomi

┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Omsetning    │ │ KJAPP        │ │ Netto         │
│              │ │ provisjon    │ │               │
└──────────────┘ └──────────────┘ └──────────────┘

MÅNEDSRAPPORT
[Måned ▾] [År ▾]                  [Last ned rapport]

UTBETALINGER
┌────────────────────────────────────────────────────────────┐
│ PERIODE             TURER       BRUTTO       NETTO STATUS │
├────────────────────────────────────────────────────────────┤
│ ...                                                        │
└────────────────────────────────────────────────────────────┘
```

Use the existing monthly export format that backend really supports. Do not advertise CSV/PDF if only XLSX is live.

## Mobile

- three financial cards stacked or horizontal-scroll-free
- month/year selectors
- one download CTA
- payouts shown as compact cards

---

# 11. Screen 08 — Fleet Bedrift

## Purpose

Give the licence holder a clear view of the business relationship and company identity without building a broad settings suite.

## Desktop wireframe

```text
Bedrift

┌────────────────────────────────────┐
│ BEDRIFTSINFORMASJON                │
│ Firmanavn                          │
│ Organisasjonsnummer                │
│ Kontaktperson / owner              │
│ Kontakt-e-post                     │
│ Kontakttelefon                     │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ KJAPP-AVTALE                       │
│ Status: Aktiv                      │
│ Provisjon: xx %                    │
│ Tilknyttede sjåfører: x           │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ ONBOARDING / COMPLIANCE            │
│ only real status available         │
│ no invented checklist              │
└────────────────────────────────────┘
```

Phase 1 is read-first. Do not expose self-service commission changes or KJAPP internal controls.
If a value is not editable through a safe fleet endpoint, display it and direct changes through KJAPP support instead of building an unbacked form.

## Mobile

Three stacked sections/cards in the same order.

---

# 12. Loading, empty and error rules

Every portal screen must explicitly support:

## Loading

- skeleton/card placeholders for tables/KPIs
- map loading surface with no fake markers

## Empty

- explain what is empty
- give at most one relevant next action
- never populate with sample values

## Error

- concise Norwegian message
- retry when safe
- authentication errors redirect to fleet login
- 403 shows wrong-account/access message

## Freshness

- live fleet vehicle state may refresh periodically
- show data freshness only if backend provides a meaningful timestamp
- do not label polling as websocket/realtime if it is not

---

# 13. Responsive acceptance matrix

Must be reviewed at minimum at:

- 390×844 mobile
- 430×932 large mobile
- 768×1024 tablet
- 1280×800 laptop
- 1440×900 desktop

No horizontal page scrolling.
No table text hidden without an alternate mobile card representation.
No CTA below device safe areas.

---

# 14. Phase B lock

These eight screens are now structurally specified:

1. Main page
2. Licence-holder page
3. Fleet login
4. Fleet overview
5. Fleet drivers
6. Fleet trips
7. Fleet finance
8. Fleet company

Phase C may style these structures but must not add new routes or product scope.