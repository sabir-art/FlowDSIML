#!/usr/bin/env node
// Génère tokens.css à partir de tokens.ts (source unique).
// Usage : node packages/ui/src/tokens.build.mjs          (Node ≥ 22.18, types TS retirés nativement)
//         node --experimental-strip-types packages/ui/src/tokens.build.mjs   (Node 22.6–22.17)
//         node packages/ui/src/tokens.build.mjs --check  (échoue si tokens.css n'est pas à jour — CI)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const t = (await import(join(here, 'tokens.ts'))).default;

const block = (sel, entries, indent = '  ') =>
  `${sel} {\n${entries.map(([k, v]) => `${indent}${k}: ${v};`).join('\n')}\n}`;
const pfx = (group, obj) => Object.entries(obj).map(([k, v]) => [`--fd-${group}-${k}`, v]);

const themed = (mode) => [
  ...pfx('color', t.colors[mode]),
  ...pfx('type', t.type[mode]),
  ...pfx('shadow', t.shadow[mode]),
];

const paletteVars = Object.entries(t.palette)
  .filter(([, scale]) => !('fg' in scale))
  .flatMap(([name, scale]) => Object.entries(scale).map(([step, v]) => [`--fd-${name}-${step}`, v]));

const textVars = Object.entries(t.textStyles).flatMap(([k, s]) => [
  [`--fd-text-${k}-size`, s.size],
  [`--fd-text-${k}-line`, s.line],
  [`--fd-text-${k}-family`, `var(--fd-font-${s.family})`],
  [`--fd-text-${k}-weight`, s.weight],
  [`--fd-text-${k}-tracking`, s.tracking],
]);

const root = [
  ...paletteVars,
  ...pfx('font', t.fontFamily),
  ...pfx('weight', t.fontWeight),
  ...textVars,
  ...pfx('space', t.space),
  ...pfx('gap', t.gap),
  ...pfx('radius', t.radius),
  ...pfx('border', t.borderWidth),
  ...pfx('motion', t.motion),
  ...pfx('z', t.zIndex),
  ...pfx('layout', t.layout),
  ...pfx('player', t.player),
];

const css = `/*
 * FlowDSIML — design tokens. FICHIER GÉNÉRÉ : ne pas éditer à la main.
 * Source : packages/ui/src/tokens.ts — régénérer : node packages/ui/src/tokens.build.mjs
 * Polices (à charger dans index.html) : ${t.googleFontsUrl}
 * Mode sombre : <html data-theme="dark">. Sans data-theme (ou data-theme="system"),
 * le mode suit prefers-color-scheme.
 */

/* Tokens invariants */
${block(':root', root)}

/* Couleurs et ombres — clair (défaut) */
${block(':root,\n[data-theme="light"]', [...themed('light'), ['color-scheme', 'light']])}

/* Couleurs et ombres — sombre */
${block('[data-theme="dark"]', [...themed('dark'), ['color-scheme', 'dark']])}

@media (prefers-color-scheme: dark) {
${block(':root:not([data-theme="light"]):not([data-theme="dark"])', [...themed('dark'), ['color-scheme', 'dark']], '    ').replace(/^/gm, '  ')}
}

/* Alias de compatibilité shadcn/ui + Tailwind */
${block(':root', Object.entries(t.aliases))}

/* Alias de compatibilité avec les tokens provisoires du MVP */
${block(':root', Object.entries(t.legacyAliases))}

/* L45 : écarts compacts (panneau de l'éditeur, tiroirs) */
${block('.fd-dense', pfx('gap', t.gapDense))}

/* Le player et ses aperçus n'héritent jamais du mode sombre de l'app */
${block('.fd-player-scope', [...themed('light'), ['color-scheme', 'light']])}

/* Mouvement réduit */
@media (prefers-reduced-motion: reduce) {
  :root {
    --fd-motion-duration-fast: 0ms;
    --fd-motion-duration-base: 0ms;
    --fd-motion-duration-exit: 0ms;
    --fd-motion-duration-slow: 0ms;
  }
}
`;

const out = join(here, 'tokens.css');
// Sortie formatée comme le reste du dépôt (.prettierrc.json) : --check et format:check s'accordent
const { format, resolveConfig } = await import('prettier');
const formatted = await format(css, { ...(await resolveConfig(out)), filepath: out });
if (process.argv.includes('--check')) {
  const current = readFileSync(out, 'utf8');
  if (current !== formatted) {
    console.error('tokens.css est désynchronisé de tokens.ts : lancer node packages/ui/src/tokens.build.mjs');
    process.exit(1);
  }
  console.log('tokens.css à jour.');
} else {
  writeFileSync(out, formatted);
  console.log(`tokens.css généré (${formatted.split('\n').length} lignes).`);
}
