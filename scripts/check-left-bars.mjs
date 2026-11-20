#!/usr/bin/env node
/**
 * Contrôle CI (demande client répétée) : aucune barre de couleur sur le bord gauche d'un bloc, dans
 * l'application, le lecteur, l'extension, les exports et packages/ui. Échoue sur un border-left,
 * border-inline-start (ou leur -width) de 2 px ou plus, et sur un box-shadow inset décalé vers la droite
 * de 2 px ou plus sans flou (barre dessinée par l'ombre). Les séparateurs de 1 px restent permis.
 * Usage : node scripts/check-left-bars.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const ROOTS = ['apps/web/src', 'apps/player/src', 'apps/extension/entrypoints', 'packages'];
const SKIP = new Set(['node_modules', 'dist', '.output', '.turbo', 'coverage']);
const EXT = /\.(css|ts|tsx|html)$/;
const KEYWORD = { thin: 1, medium: 3, thick: 5 };

/** Épaisseur en px d'une valeur de bordure (« 3px solid … », « medium », « 0 »), sinon 0. */
function width(value) {
  const px = /(^|[\s(])(\d*\.?\d+)px\b/.exec(value);
  if (px) return Number(px[2]);
  const kw = /\b(thin|medium|thick)\b/.exec(value);
  return kw ? KEYWORD[kw[1]] : 0;
}

/** Lignes fautives d'un texte (CSS, ou CSS dans une chaîne TS), avec leur numéro (base 1). */
export function findLeftBars(text) {
  const out = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const re =
      /(border-left|border-inline-start)(-width)?\s*:\s*([^;}"'`]+)|box-shadow\s*:\s*([^;}"'`]+)|border(Left|InlineStart)(Width)?\s*:\s*['"`]([^'"`]+)/g;
    for (const m of line.matchAll(re)) {
      if (m[3] !== undefined || m[7] !== undefined) {
        if (width(m[3] ?? m[7]) >= 2) out.push({ line: i + 1, text: line.trim() });
      } else {
        // Chaque ombre de la liste : « inset x y [flou] [étalement] couleur »
        for (const shadow of m[4].split(/,(?![^(]*\))/)) {
          if (!/\binset\b/.test(shadow)) continue;
          const n = [...shadow.matchAll(/(-?\d*\.?\d+)(px)?(?=[\s,]|$)/g)].map((x) => Number(x[1]));
          const [x = 0, y = 0, blur = 0] = n;
          if (x >= 2 && y === 0 && blur === 0) out.push({ line: i + 1, text: line.trim() });
        }
      }
    }
  });
  return out;
}

function* files(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (EXT.test(name)) yield p;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  let bad = 0;
  for (const r of ROOTS)
    for (const f of files(join(ROOT, r)))
      for (const hit of findLeftBars(readFileSync(f, 'utf8'))) {
        console.log(`${relative(ROOT, f)}:${hit.line}  ${hit.text}`);
        bad++;
      }
  if (bad) {
    console.error(
      `\n${bad} barre(s) de couleur à gauche : remplacez-les par l'icône, un fond doux ou rien (1 px permis pour un séparateur).`,
    );
    process.exit(1);
  }
  console.log('Aucune barre de couleur à gauche.');
}
