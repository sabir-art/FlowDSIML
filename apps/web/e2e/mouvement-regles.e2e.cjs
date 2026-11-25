/**
 * MOTION-01 §6, points 3 et 6 : garde statique sur les feuilles de style de l'app (apps/web/src,
 * packages/ui/src) et du lecteur (apps/player/src, packages/player-core/src).
 *  - aucune transition ni animation ne cible une propriété de mise en page (width, height, top, left,
 *    right, bottom, margin, padding, flex-basis, grid-template-columns, ni « all ») : on anime
 *    `transform` et `opacity` ;
 *  - aucune durée de transition ou d'animation n'est écrite en dur (ms, s) hors du fichier de jetons :
 *    on passe par `--fd-motion-duration-*` (app) ou `--p-motion-duration-*` (lecteur, définis en tête
 *    de player-core.css).
 * Les exceptions sont listées ici, chacune avec sa raison.
 * Usage : node e2e/mouvement-regles.e2e.cjs (aucun serveur nécessaire)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const DIRS = ['apps/web/src', 'packages/ui/src', 'apps/player/src', 'packages/player-core/src'];
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
  {
    file: 'apps/player/src/player.css',
    has: '0.01ms !important',
    why: 'mouvement réduit : remise à zéro globale des durées du lecteur',
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

const layout = new Set();
const literal = new Set();
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
      if (words.some((w) => DURATION.test(w) && parseFloat(w) !== 0)) literal.add(`${at(m.index)} ${decl}`);
      if ((prop === 'transition' || prop === 'transition-property') && !words.includes('none')) {
        // La propriété animée : le mot qui n'est ni une durée, ni une courbe, ni une fonction
        const names = words.filter(
          (w) => !DURATION.test(w) && !TIMING.test(w) && !/\(/.test(w) && !ANIM_WORDS.test(w),
        );
        // Sans nom de propriété, une transition vaut pour « all »
        const target = names.length ? names : prop === 'transition' ? ['all'] : [];
        if (target.some((n) => LAYOUT.test(n) && n !== 'none')) layout.add(`${at(m.index)} ${decl}`);
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
    if (bad.length) layout.add(`${at(m.index)} @keyframes ${m[1]} anime ${bad.join(', ')}`);
  }
}

ok(files.length > 20 && rules > 100, `${files.length} feuilles de style lues, ${rules} règles de mouvement`);
ok(
  layout.size === 0,
  `aucune transition ni animation sur une propriété de mise en page${layout.size ? ` :\n  ${[...layout].join('\n  ')}` : ''}`,
);
ok(
  literal.size === 0,
  `aucune durée en dur hors des jetons${literal.size ? ` :\n  ${[...literal].join('\n  ')}` : ''}`,
);
// Mouvement réduit : un indicateur de chargement (rotation, barre indéterminée) n'est jamais figé ; il bat
// en opacité seule, sans déplacement
{
  const base = fs
    .readFileSync(path.join(ROOT, 'packages/ui/src/base.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const reduced = base.slice(base.indexOf('@media (prefers-reduced-motion: reduce)'));
  const rule = reduced.match(
    /([^{}]*)\{\s*animation: fd-wait var\(--fd-motion-duration-pulse\) ease-in-out infinite !important;/,
  );
  const sels = rule ? rule[1].split(',').map((x) => x.trim()) : [];
  const WAIT = [
    '.spin',
    '.spinner',
    '.fd-dz__bar > span',
    '.ai-progress::after',
    '.vo-indet::after',
    '.st-mydata-bar',
  ];
  ok(
    WAIT.every((x) => sels.includes(x)),
    `mouvement réduit : rotations et barres indéterminées battent au lieu de se figer (${sels.join(', ')})`,
  );
  const kf = base.match(/@keyframes fd-wait\s*\{([\s\S]*?)\n\}/);
  const props = kf ? [...kf[1].matchAll(/([\w-]+)\s*:/g)].map((x) => x[1]) : [];
  ok(
    props.length > 0 && props.every((x) => x === 'opacity'),
    `mouvement réduit : battement en opacité seule (${[...new Set(props)].join(', ')})`,
  );
  // Chaque sélecteur de la liste existe encore dans l'app
  const all = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const gone = WAIT.filter((x) => !all.includes(`${x.replace(' > span', '')}`.replace(/::after$/, '')));
  ok(
    gone.length === 0,
    `mouvement réduit : les indicateurs listés existent encore${gone.length ? ` (${gone.join(', ')})` : ''}`,
  );
}
ok(
  allowedSeen.size === ALLOWED.length,
  `les ${ALLOWED.length} exceptions listées existent encore (sinon, les retirer de la liste)`,
);
