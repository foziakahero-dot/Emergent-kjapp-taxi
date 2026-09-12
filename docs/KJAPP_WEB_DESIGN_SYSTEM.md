# KJAPP Web + Fleet — Phase C Visual System

Status: PHASE C COMPLETE SPEC

This visual system applies only to the screens locked in `KJAPP_WEB_FLEET_LOCKED_PLAN.md` and `KJAPP_WEB_WIREFRAMES.md`.
It reuses the KJAPP design language already present in this repository. It is not a new brand direction.

---

# 1. Design principle

KJAPP web should feel like the same product family as the mobile app:

**Nordic Precision + Understated Luxury**

Customer marketing:

- calm
- cinematic
- editorial
- premium
- generous whitespace

Fleet portal:

- calm
- precise
- operational
- glanceable
- denser than marketing, but not visually noisy

Avoid:

- purple/blue SaaS gradients
- neon cyber styling
- generic centered startup hero patterns
- excessive glass effects
- large icon grids
- stock photography as the visual identity
- fake activity dashboards

---

# 2. Core color tokens

Reuse the current KJAPP theme tokens.

```css
--bg-base: #070B0E;
--bg-surface: #0C1216;
--bg-card: #0E151A;
--bg-elevated: #121A20;

--text: #F4F4F0;
--text-secondary: #C8CED4;
--text-muted: #8A96A0;

--line: rgba(244,244,240,0.08);
--line-strong: rgba(244,244,240,0.16);

--accent: #CBA365;
--accent-hover: #DDB77A;
--accent-dim: #8F6E3E;
--accent-soft: rgba(203,163,101,0.14);
--accent-glow: rgba(203,163,101,0.35);
--accent-on: #070B0E;

--success: #34D399;
--online: #2FE08C;
--warning: #FBBF24;
--danger: #EF4444;

--map-canvas: #06090A;
--map-water: #080E12;
--map-road: #12181D;
--map-road-major: #1B232A;
--map-building: #161D24;
```

## Accent discipline

Brass (`#CBA365`) is the KJAPP signature and is reserved for:

- primary actions
- active navigation
- selected options
- important brand marks
- route/highlight treatment

Mint (`#2FE08C`) is not a second brand color. It is reserved for operational live/online/success status:

- driver online
- active vehicle
- successful operational state

Do not turn the fleet portal into a mint-themed dashboard.

---

# 3. Typography

## Display

Primary display font:

`Fraunces`

Use for:

- marketing H1/H2
- KJAPP brand wordmark where text-rendered
- large KPI values where editorial emphasis is appropriate
- key portal headings sparingly

## Body/UI

Use the current compact sans family direction:

`Inter Tight / Inter / system-ui`

Use for:

- paragraphs
- labels
- buttons
- navigation
- table text
- forms

## Numeric/operational

`JetBrains Mono`

Use for:

- currency where alignment matters
- licence plates
- IDs when exposed
- tabular operational figures

## Web type scale

Marketing desktop:

- Hero H1: 72–88 px / 0.96–1.02 line height
- Section H2: 44–56 px
- H3: 24–30 px
- lead: 18–21 px / 1.5
- body: 16–18 px / 1.6
- caption/overline: 11–12 px, uppercase, tracking 0.20–0.30em

Marketing mobile:

- Hero H1: 46–56 px
- Section H2: 32–38 px
- H3: 21–24 px
- lead: 17–18 px
- body: 15–16 px

Fleet desktop:

- Page title: 30–36 px Fraunces
- KPI value: 26–34 px, Fraunces or mono depending on card
- card title: 14–16 px body semibold
- table header: 11–12 px uppercase/tracked or compact semibold
- table body: 13–14 px

Fleet mobile:

- page title: 24–28 px
- KPI value: 24–30 px
- body/list rows: 14–15 px

Never use Fraunces for dense table labels or small utility controls.

---

# 4. Spacing system

Base rhythm: 4 px.

```text
4   micro
8   tight
12  compact
16  standard
20  mobile page gap
24  component breathing room
32  section/card gap
40  large card padding
48  section subdivision
64  major content gap
80  mobile section gap
112 desktop section gap
144 hero/major desktop spacing
```

Marketing cards should generally use 28–40 px internal padding on desktop and 20–24 px on mobile.

Fleet cards should generally use 16–24 px internal padding.

---

# 5. Radius system

```text
8 px    small controls / dense chips
12 px   operational controls
14 px   inputs
16 px   compact cards
20 px   standard fleet cards
24 px   premium marketing cards / panels
999 px  pills / primary rounded CTA
```

Marketing may use 24 px premium panels.
Fleet portal should mostly use 12–20 px to stay operational.

---

# 6. Page backgrounds

## Marketing

Base:

`#070B0E`

May use very restrained ambient light:

- brass radial glow at <6% opacity
- muted sea-green glow at <6% opacity
- never a full-screen multicolor gradient mesh

A subtle grain overlay may be used on hero/premium surfaces only.

## Fleet

Use flat granite surfaces:

- page: `#070B0E`
- sidebar: `#090E12` or `#0C1216`
- cards: `#0E151A`

Avoid decorative background effects behind tables.

---

# 7. Header — public site

Desktop height: 76–84 px.

Structure:

- left: KJAPP wordmark
- right: `For løyvehavere`, `Hjelp`, primary `Last ned KJAPP`

Rules:

- no mega-menu
- no search
- no language dropdown in phase 1
- default state can be transparent over hero
- scrolled state uses `rgba(7,11,14,0.90)` + blur 18–24 px + 1 px hairline bottom border

Mobile:

- logo left
- compact `Last ned` CTA right
- a minimal menu trigger only for `For løyvehavere` and `Hjelp`

---

# 8. Buttons

## Primary brass

Use for the single dominant action in a context.

Desktop minimum height: 52 px.
Mobile minimum height: 54–56 px.

Style:

- brass fill
- dark text
- pill radius
- subtle shadow/glow
- no constant aggressive animation

States:

- hover: `#DDB77A`, translate Y -1 px
- active: no translate / slight scale 0.99
- disabled: 50% opacity, no glow
- focus-visible: 3 px accent-soft ring

## Secondary

- transparent/soft granite
- 1 px `--line`
- ivory text
- hover border becomes accent

## Destructive

Only where truly needed. Fleet phase 1 has no destructive business action in the locked portal navigation.

---

# 9. Forms

Inputs:

- 52–56 px minimum desktop/mobile height
- `#0E151A` or subtle translucent card background
- 1 px line border
- 14 px radius
- 15–16 px text
- persistent label above field preferred for business/application forms
- placeholder never substitutes for the field label

Focus:

- accent border
- 3 px accent-soft ring

Validation:

- field-level message immediately below
- never rely on red border alone

Licence-holder application on mobile is one field per row.
Desktop may use two columns only for naturally paired short fields; do not compress the form into a dense grid.

---

# 10. Marketing surfaces

## Premium product card

```css
background: rgba(12,18,22,0.90);
backdrop-filter: blur(24px) saturate(140%);
border: 1px solid rgba(244,244,240,0.10);
border-radius: 24px;
box-shadow: 0 20px 48px rgba(0,0,0,0.50);
```

Use sparingly for:

- app UI crops
- KJAPP Assist example
- fleet UI preview

Do not put every paragraph in a glass card.

---

# 11. Fleet shell

## Desktop sidebar

Width: 248 px target.

Sections:

- KJAPP PARTNER brand
- exact five navigation items
- company identity at bottom
- logout

Selected nav:

- subtle accent-soft background
- brass text/icon
- 1 px accent-soft border optional

Unselected nav:

- transparent
- text-secondary
- hover surface only

## Top area

Fleet content pages use a lightweight header area, not a second large navigation bar.

Contains:

- page title
- optional contextual primary action, e.g. `+ Legg til sjåfør`
- compact company/account trigger where useful

## Mobile fleet nav

Five fixed destinations:

- Oversikt
- Sjåfører
- Turer
- Økonomi
- Bedrift

Use icon + very short label.
Do not add a “More” tab in phase 1.

---

# 12. KPI cards

Fleet KPI cards must prioritize data clarity.

Structure:

```text
OVERLINE / LABEL
large value
optional compact secondary line
```

Rules:

- maximum four primary KPI cards on Overview
- no decorative charts inside KPI cards
- zero is a valid real value and should be displayed as 0
- currency uses Norwegian format where possible
- values must be backend-derived

---

# 13. Tables and mobile list conversion

Desktop tables:

- row height 52–60 px
- sticky header only when table height warrants it
- subtle row separator, no heavy gridlines
- no zebra stripes unless readability proves necessary
- numerical values right aligned
- status chips compact

Mobile:

Do not horizontally scroll the core business tables.
Convert rows into cards/list cells with preserved hierarchy.

Example:

```text
● Ahmed Khan                       2 840 kr
  Tesla Model Y · EL12345          7 turer
```

---

# 14. Status chips

Operational statuses:

- online / active / success → mint/success
- pending / waiting → amber/warning
- cancelled / error → danger
- inactive/offline → muted neutral

Shape: pill.
Font: 11–12 px semibold.
Do not color entire rows based on status.

---

# 15. Map treatment

Reuse the KJAPP dark map direction.

Base:

- dark canvas
- readable street/place labels
- restrained road contrast
- own active fleet vehicles only

Fleet map requirements:

- no simulated/fake vehicles
- online vehicles can use mint status halo, while the actual car/brand marker remains in KJAPP graphite/brass language
- map attribution remains available according to provider requirements
- map controls must have clear contrast

Marketing product imagery can show the actual product map UI, not a separate invented decorative map.

---

# 16. Motion

Marketing:

Allowed:

- 300–600 ms fade/translate reveal
- very subtle phone/product parallax
- button hover
- restrained ambient glow

Fleet portal:

- 120–220 ms control transitions
- no scroll-triggered reveal animations on operational data
- no pulsing except meaningful live/online state

Respect `prefers-reduced-motion`.

Never use universal `transition: all`.

---

# 17. Icons

Use Lucide or existing KJAPP custom SVG icon language.

Do not use emoji as product UI icons.

Marketing icon size:

- 18–24 px standard
- 28–32 px only for feature emphasis

Fleet:

- 16–20 px standard

---

# 18. Product screenshots / mockups

Rules:

- use current real KJAPP customer interface for customer hero
- use actual fleet interface design/data structure for løyvehaver preview
- empty state is preferable to fake production activity
- do not invent customer names, revenue, ride counts or map cars for a production screenshot
- staged design comps may use clearly labelled placeholders during design review only; they must be removed/replaced before production

---

# 19. Accessibility baseline

- body text contrast target WCAG AA
- all keyboard-focusable elements have visible focus state
- minimum interactive target: 44×44 px
- form labels programmatically associated with inputs
- status is not communicated by color alone
- headings keep semantic order
- buttons use action language
- links use destination language

---

# 20. Responsive breakpoints

Use behaviour-based breakpoints rather than designing separate products.

Suggested implementation values:

```text
sm: 640
md: 768
lg: 1024
xl: 1280
2xl: 1440
```

Core review widths remain:

- 390
- 430
- 768
- 1280
- 1440

---

# 21. Component inventory

Marketing components required:

- `MarketingHeader`
- `MarketingFooter`
- `PrimaryButton`
- `SecondaryButton`
- `Overline`
- `ProductPhoneFrame`
- `ProductPreviewCard`
- `ValuePoint`
- `StepItem`
- `LicenceApplicationForm`

Fleet components required:

- `FleetShell`
- `FleetSidebar`
- `FleetMobileNav`
- `FleetPageHeader`
- `KpiCard`
- `StatusChip`
- `FleetMap`
- `DataTable`
- `MobileDataCard`
- `EmptyState`
- `ErrorState`
- `LoadingSkeleton`
- `DriverInviteModal`
- `PeriodSelector`

This is a component inventory, not additional page scope.

---

# 22. Design QA checklist

A screen is not visually approved until:

- typography follows the locked families/scale
- brass is used with restraint
- mint is limited to live/success status
- margins follow the grid
- text remains naturally left aligned
- no fake data has been introduced
- mobile structure follows the wireframe rather than shrinking desktop
- map/tables remain usable
- all empty/loading/error states are designed
- no new route or product idea has appeared

This document completes Phase C specification. High-fidelity designs must now use this system without expanding scope.