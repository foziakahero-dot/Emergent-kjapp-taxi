/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0B1013",
          card: "rgba(255,255,255,0.028)",
          soft: "rgba(255,255,255,0.02)",
        },
        mint: {  /* Nå: online/status-farge for sjåfør. Kunde-tema mapper til gull-accent via CSS. */
          DEFAULT: "#CBA365",
          bright: "#DDB77A",
          dim: "#8F6E3E",
        },
        accent: {
          DEFAULT: "#CBA365",
          soft: "rgba(203,163,101,0.14)",
        },
        pearl: {
          DEFAULT: "#F4F4F0",
          muted: "#8A9198",
        },
        line: "rgba(244,244,240,0.08)",
        muted: "#8A9198",
      },
      fontFamily: {
        display: ["'Fraunces'", "'Instrument Serif'", "Georgia", "serif"],
        body: ["'Inter Tight'", "'Inter'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 40px rgba(203, 163, 101, 0.35)",
        card: "0 1px 0 rgba(255,255,255,0.03) inset, 0 20px 60px rgba(0,0,0,0.4)",
      },
      keyframes: {
        pulseGlow: {
          "0%,100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.06)", opacity: "0.85" },
        },
        ripple: {
          "0%": { transform: "scale(0.8)", opacity: "0.9" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
        floatUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "pulse-glow": "pulseGlow 3s ease-in-out infinite",
        ripple: "ripple 2.4s ease-out infinite",
        "float-up": "floatUp 0.6s ease-out both",
        shimmer: "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
