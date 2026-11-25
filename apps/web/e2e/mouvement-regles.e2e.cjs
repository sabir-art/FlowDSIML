/**
 * MOTION-01 §6, points 3 et 6 : garde statique sur les feuilles de style de l'app (apps/web/src et
 * packages/ui/src ; le lecteur a ses propres styles, hors de cette passe).
 *  - aucune transition ni animation ne cible une propriété de mise en page (width, height, top, left,
 *    right, bottom, margin, padding, flex-basis, grid-template-columns, ni « all ») : on anime
 *    `transform` et `opacity` ;
 *  - aucune durée de transition ou d'animation n'est écrite en dur (ms, s) hors du fichier de jetons :
 *    on passe par `--fd-motion-duration-*`.
 * Les exceptions sont listées ici, chacune avec sa raison.
 * Usage : node e2e/mouvement-regles.e2e.cjs (aucun serveur nécessaire)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const DIRS = ['apps/web/src', 'packages/ui/src'];
/** Fichier des jetons (généré) : seul endroit où une durée s'écrit en clair. */
const TOKENS = ['packages/ui/src/tokens.css'];
/** Exceptions : fichier, extrait de la déclaration, raison. */
const ALLOWED = [
  {
    file: 'packages/ui/src/base.css',
    has: 'background-color 600000s',
    why: 'remplissage automatique : la couleur du navigateur est retardée, rien ne bouge à l’écran',
  },
  {
    file: 'packages/ui/src/base.css',
    has: '0.01ms !important',
    why: 'mouvement réduit : remise à zéro globale des durées',
  },
];

const LAYOUT =
  /^(all|width|height|min-width|min-height|max-width|max-height|inline-size|block-size|top|left|right|bottom|inset.*|margin.*|padding.*|flex-basis|grid-template-columns|grid-template-rows)$/;
const TIMING = /^(ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end)$/;
const ANIM_WORDS =
  /^(infinite|normal|reverse|alternate|alternate-reverse|none|forwards|backwards|both|running|paused|allow-discrete)$/;
const DURATION = /^-?(\d+\.?\d*|\.\d+)(ms|s)$/;

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};

const files = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith('.css')) files.push(p);
  }
};
DIRS.forEach((d) => walk(path.join(ROOT, d)));

/** Découpe une valeur sur les virgules et les espaces de premier niveau (hors parenthèses). */
const split = (value, sep) => {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth === 0 && (sep === ',' ? ch === ',' : /\s/.test(ch))) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
};

const layout = [];
const literal = [];
const allowedSeen = new Set();
let rules = 0;
for (const file of files) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  if (TOKENS.includes(rel)) continue;
  // Commentaires remplacés par des espaces : les numéros de ligne restent justes
  const css = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const at = (i) => `${rel}:${css.slice(0, i).split('\n').length}`;
  const allowed = (decl) => {
    const k = ALLOWED.findIndex((a) => a.file === rel && decl.includes(a.has));
    if (k >= 0) allowedSeen.add(k);
    return k >= 0;
  };

  const re =
    /(^|[;{\s])(transition|transition-property|transition-duration|transition-delay|animation|animation-duration|animation-delay)\s*:\s*([^;}]+)/g;
  let m;
  while ((m = re.exec(css))) {
    rules++;
    const prop = m[2];
    const value = m[3].replace(/\s+/g, ' ').trim();
    const decl = `${prop}: ${value}`;
    if (allowed(decl)) continue;
    for (const part of split(value.replace(/!important/g, ''), ',')) {
      const words = split(part, ' ');
      // Durées en dur : tout mot « 120ms » ou « 0.2s » (une valeur nulle ne compte pas)
      if (words.some((w) => DURATION.test(w) && parseFloat(w) !== 0)) literal.push(`${at(m.index)} ${decl}`);
      if ((prop === 'transition' || prop === 'transition-property') && !words.includes('none')) {
        // La propriété animée : le mot qui n'est ni une durée, ni une courbe, ni une fonction
        const names = words.filter(
          (w) => !DURATION.test(w) && !TIMING.test(w) && !/\(/.test(w) && !ANIM_WORDS.test(w),
        );
        // Sans nom de propriété, une transition vaut pour « all »
        const target = names.length ? names : prop === 'transition' ? ['all'] : [];
        if (target.some((n) => LAYOUT.test(n) && n !== 'none')) layout.push(`${at(m.index)} ${decl}`);
      }
    }
  }

  // Animations : propriétés déclarées dans les images clés
  const kf = /@keyframes\s+([\w-]+)\s*\{/g;
  while ((m = kf.exec(css))) {
    rules++;
    let depth = 1;
    let i = kf.lastIndex;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++;
      if (css[i] === '}') depth--;
      i++;
    }
    const body = css.slice(kf.lastIndex, i - 1);
    const props = new Set();
    for (const block of body.matchAll(/\{([^}]*)\}/g))
      for (const d of block[1].split(';')) {
        const name = d.split(':')[0].trim();
        if (name && !name.startsWith('--')) props.add(name);
      }
    const bad = [...props].filter((p) => LAYOUT.test(p));
    if (bad.length) layout.push(`${at(m.index)} @keyframes ${m[1]} anime ${bad.join(', ')}`);
  }
}

ok(files.length > 20 && rules > 100, `${files.length} feuilles de style lues, ${rules} règles de mouvement`);
ok(
  layout.length === 0,
  `aucune transition ni animation sur une propriété de mise en page${layout.length ? ` :\n  ${layout.join('\n  ')}` : ''}`,
);
ok(
  literal.length === 0,
  `aucune durée en dur hors des jetons${literal.length ? ` :\n  ${literal.join('\n  ')}` : ''}`,
);
ok(
  allowedSeen.size === ALLOWED.length,
  `les ${ALLOWED.length} exceptions listées existent encore (sinon, les retirer de la liste)`,
);
