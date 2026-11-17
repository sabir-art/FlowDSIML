import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// GitHub Pages sert le site sous /<dépôt>/ : la base est injectée par la CI (BASE_PATH).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  server: { port: 5173 },
  test: { environment: 'jsdom' },
});
