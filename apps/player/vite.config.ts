import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { assertBuildEnv } from '../../packages/core/src/buildEnv';

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    // Adresse et clé publique Supabase : obligatoires au build, sans valeur par défaut dans le code
    {
      name: 'require-env',
      apply: 'build',
      configResolved: (c) => assertBuildEnv(c.env, ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']),
    },
    preact(),
  ],
  build: { target: 'es2020' },
  test: { environment: 'jsdom' },
});
