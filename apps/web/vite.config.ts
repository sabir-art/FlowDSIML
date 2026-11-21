import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { APP_NAME } from '../../packages/core/src/brand';
import { assertBuildEnv } from '../../packages/core/src/buildEnv';
import { offlineRuntime } from './vite.offline';
import { localeSplit } from './vite.locales';
import { routePreload } from './vite.preload';

// GitHub Pages sert le site sous /<dépôt>/ : la base est injectée par la CI (BASE_PATH).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    // Adresse et clé publique Supabase : obligatoires au build, sans valeur par défaut dans le code
    {
      name: 'require-env',
      apply: 'build',
      configResolved: (c) => assertBuildEnv(c.env, ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']),
    },
    react(),
    // L16 : lecteur hors ligne des paquets SCORM (module virtuel)
    offlineRuntime(),
    // L33 : textes français en deux morceaux (socle au démarrage, suite avec les autres pages)
    localeSplit(),
    // Nom du produit dans index.html (constante unique)
    { name: 'app-name', transformIndexHtml: (html: string) => html.replaceAll('%APP_NAME%', APP_NAME) },
    // L33 : code de la page d'arrivée préchargé dès le HTML (sinon découvert après l'exécution de l'entrée)
    routePreload(),
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
          // L31 : icônes Lucide regroupées (sinon un petit fichier par icône, autant d'allers-retours réseau)
          if (/[\\/]lucide-react[\\/]/.test(id)) return 'vendor-icons';
          return undefined;
        },
      },
    },
  },
  // Tests unitaires : adresse et clé fictives (les vraies valeurs ne servent qu'au build)
  test: {
    environment: 'jsdom',
    env: { VITE_SUPABASE_URL: 'https://api.tutoclick.example', VITE_SUPABASE_ANON_KEY: 'test' },
  },
});
