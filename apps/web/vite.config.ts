import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { APP_NAME } from '../../packages/core/src/brand';
import { offlineRuntime } from './vite.offline';

// GitHub Pages sert le site sous /<dépôt>/ : la base est injectée par la CI (BASE_PATH).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    // L16 : lecteur hors ligne des paquets SCORM (module virtuel)
    offlineRuntime(),
    // Nom du produit dans index.html (constante unique)
    { name: 'app-name', transformIndexHtml: (html: string) => html.replaceAll('%APP_NAME%', APP_NAME) },
  ],
  server: { port: 5173 },
  // L27 : bibliothèques de base dans des morceaux à part (cache gardé d'un déploiement à l'autre) ;
  // les pages, l'éditeur, les analytics et les exports PDF / MP4 sont chargés à la demande.
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
          if (/[\\/]react-router/.test(id)) return 'vendor-router';
          if (/[\\/]@supabase[\\/]/.test(id)) return 'vendor-supabase';
          if (/[\\/](i18next|react-i18next)[\\/]/.test(id)) return 'vendor-i18n';
          return undefined;
        },
      },
    },
  },
  test: { environment: 'jsdom' },
});
