import type { Config } from 'tailwindcss';
export default { content: ['./src/**/*.{ts,tsx}'], theme: { extend: { colors: { night:'#050a0f', ice:'#00e5f5' }, fontFamily: { display:['Georgia','serif'], sans:['Geist','Arial','sans-serif'] } } }, plugins: [] } satisfies Config;
