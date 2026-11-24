// Copie statique des pages légales (public/legal/*.html), sans JavaScript ni « # » dans l'adresse :
// c'est l'URL donnée à Google (écran de consentement OAuth) et aux robots.
// Source unique : apps/web/src/legal/legal.fr.json. `node scripts/build-legal.mjs` régénère ;
// `node scripts/build-legal.mjs --check` échoue si les fichiers ne sont plus à jour (CI).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const legal = JSON.parse(readFileSync(join(root, 'apps/web/src/legal/legal.fr.json'), 'utf8'));
const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const FILES = {
  privacy: 'confidentialite.html',
  terms: 'conditions.html',
  accessibility: 'accessibilite.html',
};

/**
 * Valeurs de configuration d'un document (`fields`) : `{{cle}}` devient la valeur fournie par le client,
 * ou sa mention entre crochets tant qu'elle manque. Aucune valeur n'est inventée ici.
 */
export const fill = (d, text) =>
  text.replace(/\{\{(\w+)\}\}/g, (_, k) => d.fields?.[k]?.value || `[${d.fields?.[k]?.label ?? k}]`);
/** Encart « En attente de validation » : toujours pour un document sans champs, sinon tant qu'il en manque un. */
export const pending = (d) => !d.fields || Object.values(d.fields).some((f) => !f.value);

export function render(key) {
  const d = legal[key];
  const others = Object.keys(FILES).filter((k) => k !== key);
  const f = (x) => esc(fill(d, x));
  const body = d.sections
    .map((s) => {
      const para = (list) => (list ?? []).map((x) => `      <p>${f(x)}</p>`).join('\n');
      const ul = s.ul
        ? `      <ul>\n${s.ul.map((x) => `        <li>${f(x)}</li>`).join('\n')}\n      </ul>`
        : '';
      const tag = s.level === 3 ? 'h3' : 'h2';
      return [`      <${tag}>${esc(s.h)}</${tag}>`, para(s.p), ul, para(s.after)].filter(Boolean).join('\n');
    })
    .join('\n');
  const note = pending(d) ? `\n      <p class="note">${esc(d.draft ?? legal.draft)}</p>` : '';
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(d.title)} · TutoClick</title>
    <meta name="description" content="${f(d.intro)}" />
    <link rel="icon" href="../favicon.svg" type="image/svg+xml" />
    <style>
      :root { --bg: #ffffff; --text: #14171c; --muted: #556070; --border: #dde2e8; --link: #a3195b; --note: #fdf0dc; }
      @media (prefers-color-scheme: dark) {
        :root { --bg: #0f1216; --text: #eef1f5; --muted: #a7b0bc; --border: #2a313a; --link: #f08ab0; --note: #3a2a12; }
      }
      body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.6 system-ui, -apple-system, 'Segoe UI', sans-serif; }
      main { max-width: 760px; margin: 0 auto; padding: 40px 20px 64px; }
      h1 { font-size: 32px; line-height: 1.2; margin: 0 0 8px; }
      h2 { font-size: 20px; line-height: 1.3; margin: 32px 0 8px; }
      h3 { font-size: 17px; line-height: 1.3; margin: 20px 0 8px; }
      p, ul { margin: 0 0 12px; }
      ul { padding-left: 20px; }
      li { margin-bottom: 6px; }
      a { color: var(--link); }
      .meta { color: var(--muted); }
      .note { background: var(--note); border-radius: 10px; padding: 12px 16px; }
      nav { margin-top: 40px; padding-top: 16px; border-top: 1px solid var(--border); display: flex; gap: 16px; flex-wrap: wrap; }
    </style>
  </head>
  <body>
    <main>
      <h1>${esc(d.title)}</h1>
      <p class="meta">TutoClick, porté par la DSIML · Mise à jour : ${esc(legal.updated)}</p>${note}
      <p>${f(d.intro)}</p>
${body}
      <nav aria-label="Autres documents">
${others.map((k) => `        <a href="${FILES[k]}">${esc(legal[k].title)}</a>`).join('\n')}
        <a href="../">Ouvrir TutoClick</a>
      </nav>
    </main>
  </body>
</html>
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const check = process.argv.includes('--check');
  const dir = join(root, 'apps/web/public/legal');
  mkdirSync(dir, { recursive: true });
  let stale = 0;
  for (const [key, file] of Object.entries(FILES)) {
    const path = join(dir, file);
    const html = render(key);
    let current = '';
    try {
      current = readFileSync(path, 'utf8');
    } catch {}
    if (current === html) continue;
    if (check) {
      console.error(`Pages légales : ${file} n'est plus à jour. Lancez node scripts/build-legal.mjs`);
      stale++;
    } else writeFileSync(path, html);
  }
  if (stale) process.exit(1);
}
