/**
 * SNAR store icons — App Store (1024) & Google Play (512).
 * One glyph, two role variants:
 *   Customer → red tile / white "S"
 *   Driver   → deep-navy tile / red "S"
 * The mark is a single bold ribbon "S": quick, sharp, legible down to 16px.
 */

// The SNAR "S" as one stroked ribbon, centred in a 1024 viewBox.
const S_PATH =
  "M672 392 C672 330 588 300 500 300 C392 300 336 356 336 428 C336 498 402 522 512 544 C622 566 688 590 688 660 C688 732 604 748 512 748 C424 748 348 724 344 656"

type Variant = "customer" | "driver"

function IconTile({ variant, size = 1024 }: { variant: Variant; size?: number }) {
  const driver = variant === "driver"
  const tileId = `snar-tile-${variant}`
  const glyphId = `snar-glyph-${variant}`
  const glossId = `snar-gloss-${variant}`
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" style={{ display: "block" }}>
      <defs>
        <linearGradient id={tileId} x1="0" y1="0" x2="0" y2="1">
          {driver ? (
            <>
              <stop offset="0" stopColor="#012a54" />
              <stop offset="0.55" stopColor="#001f3f" />
              <stop offset="1" stopColor="#00152b" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#ff3b3b" />
              <stop offset="0.55" stopColor="#ff0000" />
              <stop offset="1" stopColor="#b30000" />
            </>
          )}
        </linearGradient>
        <linearGradient id={glyphId} x1="0" y1="0" x2="1" y2="1">
          {driver ? (
            <>
              <stop offset="0" stopColor="#ff3b3b" />
              <stop offset="1" stopColor="#ff0000" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor="#ffe6e6" />
            </>
          )}
        </linearGradient>
        <linearGradient id={glossId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="0.4" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* tile */}
      <rect x="0" y="0" width="1024" height="1024" rx="224" ry="224" fill={`url(#${tileId})`} />
      {/* subtle top light */}
      <rect x="0" y="0" width="1024" height="1024" rx="224" ry="224" fill={`url(#${glossId})`} />

      {/* the SNAR S ribbon */}
      <path
        d={S_PATH}
        fill="none"
        stroke={`url(#${glyphId})`}
        strokeWidth="104"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CustomerAppIcon({ size = 1024 }: { size?: number }) {
  return <IconTile variant="customer" size={size} />
}

export function DriverAppIcon({ size = 1024 }: { size?: number }) {
  return <IconTile variant="driver" size={size} />
}

export default IconTile
