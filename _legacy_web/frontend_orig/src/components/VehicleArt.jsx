/** Premium KJAPP vehicle photography — one cohesive studio set per class.
 *  Rendered as a full-bleed banner that fades into the card surface. */
const ART = {
  "ai-first": "/vehicles/standard.jpg",
  enkelt: "/vehicles/sparsom.jpg",
  trygg: "/vehicles/komfort.jpg",
  premium: "/vehicles/premium.jpg",
};

export function VehicleArt({ id, active = false, height = 58, className = "" }) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ height }}
      data-testid={`vehicle-art-${id}`}
    >
      <img
        src={ART[id] || ART["ai-first"]}
        alt=""
        aria-hidden
        loading="lazy"
        className="absolute inset-0 w-full h-full"
        style={{
          objectFit: "cover",
          objectPosition: "center 48%",
          transform: active ? "scale(1.06)" : "scale(1)",
          filter: active
            ? "saturate(1.08) brightness(1.1) contrast(1.04)"
            : "saturate(0.7) brightness(0.78)",
          transition: "transform 260ms ease, filter 220ms ease",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(7,11,14,0.30) 0%, rgba(7,11,14,0) 38%, rgba(10,16,20,0.72) 88%, rgba(10,16,20,0.95) 100%)",
        }}
      />
      {active && (
        <div
          className="absolute inset-x-0 bottom-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(203,163,101,0.75), transparent)" }}
        />
      )}
    </div>
  );
}

export default VehicleArt;
