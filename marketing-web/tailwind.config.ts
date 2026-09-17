import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'kjapp-bg': '#050a0f',
        'kjapp-surface': '#091119',
        'kjapp-card': '#0d1721',
        'kjapp-line': '#22313d',
        'kjapp-copy': '#b5c0c9',
        'kjapp-cyan': '#00e5f5',
        'kjapp-green': '#39e58c',
      },
      boxShadow: {
        glow: '0 12px 38px rgba(0,229,245,.14)',
        card: '0 28px 90px rgba(0,0,0,.28)',
      },
    },
  },
  plugins: [],
};

export default config;
