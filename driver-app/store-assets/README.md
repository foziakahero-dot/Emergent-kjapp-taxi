# KJAPP Driver — butikk-grafikk

## Viktig status

Filene som ligger i denne mappen i dag matcher Customer-bildene byte-for-byte og skal derfor behandles som **midlertidige placeholders**, ikke som godkjente Driver-skjermbilder.

De må **ikke** brukes i en offentlig App Store / Google Play-oppføring for KJAPP Driver.

Dette blokkerer ikke:
- intern Android APK
- signert iOS build
- intern/TestFlight beta

## Før offentlig Driver-release

Ta nye skjermbilder fra den faktiske nåværende KJAPP Driver-appen uten redesign:

1. Online-kart / skiftstatus
2. Ny turforespørsel med ekte pickup-data
3. Aktiv tur / navigasjon
4. Inntekt / historikk

Krav:
- ingen fiktive kundeopplysninger presentert som ekte
- ingen hemmeligheter, testpassord eller personlige data
- vis samme produksjonsnære design som app-builden som sendes inn
- kontroller Apple/Google-størrelser før opplasting

Se `docs/STORE_RELEASE_PACK.md` for release metadata og gates.
