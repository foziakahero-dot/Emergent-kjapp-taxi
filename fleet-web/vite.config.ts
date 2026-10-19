import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: { 'import.meta.env.VITE_SNAR_QA_PANEL': JSON.stringify(process.env.VERCEL_GIT_COMMIT_REF === 'qa/snar-v10-phase5-staging-e2e' ? 'true' : 'false') },
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
