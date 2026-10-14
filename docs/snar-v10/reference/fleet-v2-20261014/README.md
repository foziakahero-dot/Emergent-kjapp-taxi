# Authoritative Fleet v2 source — 14 October 2026

The local reference was copied verbatim from the user's `SNAR Fleet v2 Design System (3)(1).zip`.
The file hashes and complete screen index are recorded in `manifest.json`.
The raw `src/` reference and render evidence are kept locally; this public repository receives the manifest and application adapters only.
Figma Make: https://www.figma.com/make/7947uNsMq8WNEq3eZSHmuz/SNAR-Fleet-v2-Design-System

Customer has 36 prototype states. Driver has 30 prototype states spanning numbers 01–31; `navPickup` combines 08–09.
The older archive and this archive have identical `kit.tsx` and identical screen lists.
`CustomerApp.tsx` changes only home/returning (02/06): ExperienceStudio and tool position.
`DriverApp.tsx` changes only offline home (04): ExperienceStudio and local shift goal.
`index.css` adds `signature.css`, which also changes shared sheet, dock, input and primary-action styling.
The two new signature files are present here in full. Customer 19–34 source layouts are unchanged.

This reference is a design prototype, with demo prices, ETA, identities, income and simulated transitions.
Production adapters use existing canonical APIs and require explicit booking/payment/shift confirmation.
Source identity is verified; native pixel parity is a separate acceptance requirement.
