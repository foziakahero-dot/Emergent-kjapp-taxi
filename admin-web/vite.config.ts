import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' → relative asset paths so the built SPA can be served from any
// subpath (e.g. /api/ops in the Emergent preview) or from the domain root
// (admin.kjappapp.no) without rebuilding paths. Routing uses HashRouter so no
// server-side SPA fallback is required.
export default defineConfig({
  base: './',
  plugins: [react()],
  define: { 'import.meta.env.VITE_SNAR_QA_PANEL': JSON.stringify(process.env.VERCEL_GIT_COMMIT_REF === 'qa/snar-v10-phase5-staging-e2e' ? 'true' : 'false') },
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'https://api.kjappapp.no', changeOrigin: true } },
  },
});

