/**
 * L16 : module virtuel « virtual:tutoclick-offline » = lecteur hors ligne des paquets SCORM
 * (apps/player/src/offline.tsx) compilé par Vite (Rollup) en un seul script IIFE et une feuille de style, sous forme de
 * chaînes. L'app le charge à la demande (import dynamique) au moment de l'export : aucun fichier à
 * publier en plus, même code en dev et en build.
 */
import { fileURLToPath } from 'node:url';
import { build, type Plugin, type Rollup } from 'vite';

const ID = 'virtual:tutoclick-offline';
const RESOLVED = `\0${ID}`;
const ROOT = fileURLToPath(new URL('../player/', import.meta.url));
const ENTRY = fileURLToPath(new URL('../player/src/offline.tsx', import.meta.url));

/** Compilation Rollup (élimine le code mort de zod, contrairement à esbuild seul). */
async function bundle(): Promise<{ js: string; css: string; ids: string[] }> {
  const out = (await build({
    configFile: false,
    root: ROOT,
    logLevel: 'error',
    // Aucune variable d'environnement dans le paquet (préfixe introuvable)
    envPrefix: 'TUTOCLICK_OFFLINE_NONE_',
    define: { 'import.meta.env': '{}' },
    esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
    build: {
      write: false,
      minify: true,
      cssCodeSplit: false,
      target: 'es2020',
      lib: { entry: ENTRY, formats: ['iife'], name: 'TutoClickOffline', fileName: () => 'offline.js' },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  })) as Rollup.RollupOutput | Rollup.RollupOutput[];
  const files = (Array.isArray(out) ? out[0]! : out).output;
  const pick = (ext: string) => {
    const f = files.find((x) => x.fileName.endsWith(ext));
    return !f ? '' : f.type === 'chunk' ? f.code : String(f.source);
  };
  const ids = files.flatMap((f) => (f.type === 'chunk' ? f.moduleIds : []));
  return { js: pick('.js'), css: pick('.css'), ids: ids.filter((id) => !id.includes('node_modules')) };
}

export function offlineRuntime(): Plugin {
  let cached: ReturnType<typeof bundle> | null = null;
  let dev = false;
  return {
    name: 'tutoclick-offline',
    configResolved(c) {
      dev = c.command === 'serve';
    },
    resolveId: (id) => (id === ID ? RESOLVED : undefined),
    async load(id) {
      if (id !== RESOLVED) return;
      // En dev, recompilé à chaque chargement (modifs du lecteur prises en compte)
      if (dev || !cached) cached = bundle();
      const { js, css, ids } = await cached;
      // Le module est invalidé quand une source du lecteur change (dev)
      for (const f of ids) this.addWatchFile(f);
      return `export const js = ${JSON.stringify(js)};\nexport const css = ${JSON.stringify(css)};\n`;
    },
  };
}
