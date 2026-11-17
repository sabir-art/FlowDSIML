import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { APP_NAME } from '../../packages/core/src/brand';

// GitHub Pages sert le site sous /<dépôt>/ : la base est injectée par la CI (BASE_PATH).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    // Nom du produit dans index.html (constante unique)
    { name: 'app-name', transformIndexHtml: (html: string) => html.replaceAll('%APP_NAME%', APP_NAME) },
  ],
  server: { port: 5173 },
  test: { environment: 'jsdom' },
});
