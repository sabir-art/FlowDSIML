/**
 * L33 : textes français découpés en deux modules virtuels pour alléger le premier rendu.
 * - « virtual:locale-fr-core » : les clés utilisées par le parcours de démarrage (graphe d'imports depuis
 *   src/main.tsx et la page d'arrivée, voir startupFiles et splitLocale).
 * - « virtual:locale-fr-rest » : toutes les autres, chargées avec les autres pages (src/i18n.ts).
 * Le découpage est recalculé à chaque build : aucune liste de clés à tenir à jour. En dev, une clé affichée
 * avant l'arrivée de la suite lève une erreur (src/i18n.ts), que les tests e2e détectent.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin, ViteDevServer } from 'vite';

const WEB = fileURLToPath(new URL('./', import.meta.url));
const SRC = path.join(WEB, 'src');
const FR = path.join(SRC, 'locales/fr.json');
const PACKAGES = path.join(WEB, '../../packages');
/** Point d'entrée et page d'arrivée (chargée à la demande, mais sans attendre la suite des textes). */
const ROOTS = ['main.tsx', 'pages/demos/DemosPage.tsx'].map((f) => path.join(SRC, f));
type Tree = { [k: string]: string | Tree };

function resolve(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else if (spec.startsWith('@flowdsiml/'))
    base = path.join(PACKAGES, spec.slice('@flowdsiml/'.length), 'src/index');
  else return null;
  for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const f = base + ext;
    if (/\.tsx?$/.test(f) && fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  }
  return null;
}

/**
 * Modules du parcours de démarrage : imports statiques et dynamiques depuis ROOTS, sauf les imports
 * dynamiques qui attendent la suite des textes (withRestLocale, lazyRest).
 */
export function startupFiles(roots = ROOTS): string[] {
  const seen = new Set<string>();
  const stack = [...roots];
  while (stack.length) {
    const f = stack.pop() as string;
    if (seen.has(f)) continue;
    seen.add(f);
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(
      /^\s*(?:import|export)\s+(?!type\b)[^'"]*?from\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/gm,
    )) {
      const r = resolve(f, m[1] ?? m[2] ?? '');
      if (r) stack.push(r);
    }
    for (const m of src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const before = src.slice(Math.max(0, (m.index ?? 0) - 40), m.index);
      if (/withRestLocale\(|lazyRest\(/.test(before)) continue;
      const r = resolve(f, m[1] ?? '');
      if (r) stack.push(r);
    }
  }
  return [...seen];
}

function get(tree: Tree, key: string): string | Tree | undefined {
  let cur: string | Tree | undefined = tree;
  for (const part of key.split('.')) cur = typeof cur === 'object' ? cur[part] : undefined;
  return cur;
}

function set(tree: Tree, key: string, value: string | Tree) {
  const parts = key.split('.');
  const last = parts.pop() ?? key;
  let cur = tree;
  for (const part of parts) cur = (cur[part] ??= {}) as Tree;
  cur[last] = value;
}

/** Copie dans `out` la valeur (feuille ou sous-arbre) de `key` et ses variantes de pluriel (x_one, x_other…). */
function take(fr: Tree, out: Tree, key: string) {
  const value = get(fr, key);
  if (value !== undefined) set(out, key, value);
  const parts = key.split('.');
  const last = parts.pop() ?? key;
  const siblings = get(fr, parts.join('.'));
  if (typeof siblings === 'object')
    for (const [k, v] of Object.entries(siblings))
      if (k.startsWith(`${last}_`)) set(out, [...parts, k].join('.'), v);
}

/** Toutes les clés (chemins pointés) de l'arbre, feuilles seulement. */
function leaves(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'object' ? leaves(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

/**
 * Socle = clés citées en toutes lettres dans le parcours de démarrage, plus toutes les clés qui commencent
 * par un préfixe construit (`demos.filter_${k}`, 'nav.' + x), plus les clés imbriquées ($t(...)).
 * Suite = tout le reste.
 */
export function splitLocale(fr: Tree, files = startupFiles()) {
  const sections = Object.keys(fr).join('|');
  const literal = new RegExp(`['"\`]((?:${sections})(?:\\.[A-Za-z0-9_]+)+)['"\`]`, 'g');
  const built = new RegExp(
    `['"\`]((?:${sections})\\.(?:[A-Za-z0-9_]+\\.)*[A-Za-z0-9_]*)(?:\\$\\{|['"]\\s*\\+)`,
    'g',
  );
  const all = leaves(fr);
  const core: Tree = {};
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(literal)) take(fr, core, m[1] ?? '');
    for (const m of src.matchAll(built)) {
      const prefix = m[1] ?? '';
      for (const k of all) if (k.startsWith(prefix)) take(fr, core, k);
    }
  }
  // Références imbriquées dans les textes du socle, jusqu'à stabilité
  for (let added = true; added;) {
    added = false;
    for (const k of leaves(core))
      for (const m of String(get(core, k)).matchAll(/\$t\(([A-Za-z0-9_.]+)/g))
        if (get(core, m[1] ?? '') === undefined) {
          take(fr, core, m[1] ?? '');
          added = true;
        }
  }
  const rest: Tree = {};
  for (const k of all) if (get(core, k) === undefined) set(rest, k, get(fr, k) as string);
  return { core, rest };
}

const CORE = 'virtual:locale-fr-core';
const REST = 'virtual:locale-fr-rest';

export function localeSplit(): Plugin {
  let cache: { core: Tree; rest: Tree } | null = null;
  let server: ViteDevServer | null = null;
  return {
    name: 'locale-split',
    configureServer(s) {
      server = s;
    },
    resolveId: (id) => (id === CORE || id === REST ? `\0${id}` : undefined),
    load(id) {
      if (id !== `\0${CORE}` && id !== `\0${REST}`) return undefined;
      this.addWatchFile(FR);
      cache ??= splitLocale(JSON.parse(fs.readFileSync(FR, 'utf8')) as Tree);
      return `export default JSON.parse(${JSON.stringify(JSON.stringify(id === `\0${CORE}` ? cache.core : cache.rest))});`;
    },
    // En dev, un texte ou un fichier source modifié peut changer le découpage : modules recalculés
    watchChange(file) {
      if (!/\.(tsx?|json)$/.test(file)) return;
      cache = null;
      for (const id of [CORE, REST]) {
        const mod = server?.moduleGraph.getModuleById(`\0${id}`);
        if (mod) server?.moduleGraph.invalidateModule(mod);
      }
    },
  };
}
