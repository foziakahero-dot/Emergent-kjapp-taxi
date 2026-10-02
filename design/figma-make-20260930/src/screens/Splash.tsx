import SnarMark from "../components/SnarMark"

export default function Splash({
  onEnter,
  variant = "customer",
}: {
  onEnter: () => void
  variant?: "customer" | "driver"
}) {
  const isDriver = variant === "driver"
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden px-8 text-center"
      style={{ background: "radial-gradient(circle at 50% 30%, #ffffff, #eef2f8 70%, #e6ebf3)" }}>

      <div className="relative flex flex-col items-center animate-rise">
        <div className="relative">
          {[0, 1].map((i) => (
            <span
              key={i}
              className="absolute inset-0"
              style={{
                borderRadius: 28,
                border: "1px solid rgba(255,0,0,0.35)",
                animation: `ring-pulse 3s ease-out ${i * 1.2}s infinite`,
              }}
            />
          ))}
          <SnarMark size={104} float />
        </div>

        <h1 className="mt-9 font-display text-6xl font-bold tracking-tight text-[var(--ink)]">
          SNAR
        </h1>
      </div>

      <button
        onClick={onEnter}
        className="group relative mt-14 overflow-hidden rounded-full px-10 py-4 font-display text-sm font-semibold text-white transition-transform active:scale-95"
        style={{
          background: "linear-gradient(120deg,#ff3b3b,#ff0000)",
          boxShadow: "0 14px 34px rgba(255,0,0,0.4)",
        }}
      >
        <span
          className="pointer-events-none absolute inset-0"
          style={{
            background: "linear-gradient(100deg, transparent, rgba(255,255,255,0.4), transparent)",
            backgroundSize: "200% 100%",
            animation: "shimmer 2.8s linear infinite",
          }}
        />
        <span className="relative">{isDriver ? "Start vakt" : "Kom i gang"}</span>
      </button>
    </div>
  )
}
