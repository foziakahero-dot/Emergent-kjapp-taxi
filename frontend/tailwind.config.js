/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0c1216",
          card: "rgba(255,255,255,0.028)",
          soft: "rgba(255,255,255,0.02)",
        },
        mint: {  /* keep 'mint' as alias for accent so old classes still work */
          DEFAULT: "#c9a15b",
          bright: "#d9b170",
          dim: "#8a6f3f",
        },
        accent: {
          DEFAULT: "#c9a15b",
          soft: "rgba(201,161,91,0.14)",
        },
        pearl: {
          DEFAULT: "#e8e0d0",
          muted: "#7a827a",
        },
        line: "rgba(232,224,208,0.08)",
        muted: "#7a827a",
      },
      fontFamily: {
        display: ["'Instrument Serif'", "Georgia", "serif"],
        body: ["'Inter'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      fontFamily: {
        display: ["'Instrument Sans'", "'DM Sans'", "system-ui", "sans-serif"],
        body: ["'DM Sans'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        glow: "0 0 40px rgba(47, 224, 140, 0.35)",
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
