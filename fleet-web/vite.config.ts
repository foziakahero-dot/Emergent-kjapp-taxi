import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.VITE_PANEL_BASE || '/',
  plugins: [react()],
  define: { 'import.meta.env.VITE_SNAR_QA_PANEL': JSON.stringify(process.env.VITE_APP_ENV === 'qa' || process.env.VERCEL_GIT_COMMIT_REF === 'qa/snar-v10-phase5-staging-e2e' ? 'true' : 'false') },
  server: {
    port: 5180,
    proxy: {
      '/api': {
        target: 'https://api-qa.snarapp.no',
        changeOrigin: true,
      },
    },
  },
});
