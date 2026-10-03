type MarkProps = {
  size?: number
  float?: boolean
  className?: string
}

/**
 * SNAR logomark — a flat red squircle with a fast forward-motion glyph.
 * Sharp, minimal, Norwegian.
 */
export default function SnarMark({ size = 96, float = false, className = "" }: MarkProps) {
  const radius = size * 0.28
  return (
    <div
      className={`relative ${className}`}
      style={{ width: size, height: size }}
      aria-label="SNAR"
    >
      <div
        className="flex h-full w-full items-center justify-center"
        style={{
          borderRadius: radius,
          background: "linear-gradient(145deg, #ff3b3b, #ff0000 55%, #b30000)",
          boxShadow:
            "0 12px 30px rgba(255,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.35)",
          animation: float ? "mark-float 4s ease-in-out infinite" : undefined,
        }}
      >
        {/* double motion chevron = speed */}
        <svg width={size * 0.52} height={size * 0.52} viewBox="0 0 24 24" fill="none">
          <path
            d="M4 5l7 7-7 7"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 5l7 7-7 7"
            stroke="#ffffff"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  )
}
