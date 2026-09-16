import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Extensionless on purpose: Vite bundles this config with esbuild, which resolves
// "./vite-plugin-seo" to the .ts file but would not strip a ".js" suffix.
import { seoPlugin } from './vite-plugin-seo';

export default defineConfig({
  plugins: [react(), seoPlugin()],
  server: {
    port: 5173,
    proxy: {
      // Dev convenience: talk to the API without CORS juggling.
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
});
