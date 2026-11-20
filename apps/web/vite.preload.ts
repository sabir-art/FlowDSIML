/**
 * L33 : préchargement du code de la page d'arrivée. Le HTML reçoit un court script qui, selon l'adresse
 * (#/ : tableau de bord ; #/demos/<id>/edit sur écran étroit : vue mobile de l'éditeur), ajoute des
 * <link rel="modulepreload"> pour le morceau de la page et ses dépendances statiques. Ils partent avec
 * l'entrée au lieu d'attendre son exécution (un aller-retour réseau de moins avant le premier affichage).
 */
import type { Plugin } from 'vite';

type Chunk = { type: 'chunk'; fileName: string; moduleIds: string[]; imports: string[] };
type Bundle = Record<string, Chunk | { type: 'asset'; fileName: string }>;

const ROUTES: Array<{ test: string; module: RegExp }> = [
  { test: "h===''||h==='#/'", module: /\/pages\/demos\/DemosPage\.tsx$/ },
  {
    test: "/^#\\/demos\\/[^/]+\\/edit$/.test(h)&&matchMedia('(max-width: 1023px)').matches",
    module: /\/pages\/editor\/EditorNarrow\.tsx$/,
  },
];

function deps(bundle: Bundle, file: string, out: Set<string>, entry: Set<string>) {
  if (out.has(file) || entry.has(file)) return;
  out.add(file);
  const c = bundle[file];
  if (c?.type === 'chunk') for (const i of c.imports) deps(bundle, i, out, entry);
}

export function routePreload(): Plugin {
  return {
    name: 'route-preload',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const bundle = ctx.bundle as unknown as Bundle | undefined;
        if (!bundle) return [];
        // Déjà préchargés par l'entrée (vendor-*, entrée elle-même)
        const entry = new Set<string>();
        for (const c of Object.values(bundle))
          if (c.type === 'chunk' && ctx.chunk && c.fileName === ctx.chunk.fileName) {
            entry.add(c.fileName);
            c.imports.forEach((i) => entry.add(i));
          }
        const base = process.env.BASE_PATH ?? '/';
        const lines: string[] = [];
        for (const r of ROUTES) {
          const chunk = Object.values(bundle).find(
            (c): c is Chunk => c.type === 'chunk' && c.moduleIds.some((m) => r.module.test(m)),
          );
          if (!chunk) continue;
          const files = new Set<string>();
          deps(bundle, chunk.fileName, files, entry);
          lines.push(`if(${r.test})f(${JSON.stringify([...files].map((f) => base + f))})`);
        }
        if (!lines.length) return [];
        const code =
          'try{var h=location.hash,f=function(l){l.forEach(function(u){var e=document.createElement("link");' +
          'e.rel="modulepreload";e.crossOrigin="";e.href=u;document.head.appendChild(e)})};' +
          lines.join(';') +
          '}catch(e){}';
        return [{ tag: 'script', children: code, injectTo: 'head' }];
      },
    },
  };
}
