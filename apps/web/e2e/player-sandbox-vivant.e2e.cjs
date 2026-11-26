/**
 * Sandbox v2, étape 3c : lecteur publié en mode vivant. Manifeste avec step.html.live (enregistrement
 * publié, scripts gardés) ; le lecteur rejoue les scripts dans la boîte sans sortie (buildLiveSrcdoc).
 * Contrôles :
 *  - CSP de la page vivante (connect-src 'none', script-src par empreintes) ;
 *  - application à page unique : liste chargée par fetch (réponse relevée sur l'AUTRE page de la démo :
 *    réponses de toute la démo), fiche par route interne ;
 *  - script bloqué par l'auteur : non exécuté ;
 *  - lien vers une page capturée : le lecteur change d'étape ; formulaire : validation, envoi (succès
 *    fictif), retour : formulaire vide (page rechargée, stockage neuf) ;
 *  - enregistrement illisible : page inerte (repli) ;
 *  - aucune requête du lecteur vers l'extérieur pendant la visite.
 * Données fictives. Usage : [THEME=dark] [SHOTS_DIR=…] node e2e/player-sandbox-vivant.e2e.cjs
 */
const { chromium } = require('playwright');
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const SHOTS = process.env.SHOTS_DIR;
const { sfx, themedContext } = require('./_theme.cjs');
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
const S1 = '0b5c1f0e-0000-4000-8000-0000000003c1';
const S2 = '0b5c1f0e-0000-4000-8000-0000000003c2';
const S3 = '0b5c1f0e-0000-4000-8000-0000000003c3';
const DEMO = '0b5c1f0e-0000-4000-8000-0000000003d1';
const SITE = 'https://crm.exemple.test';

const shell = (title, body) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
  body{margin:0;font:16px system-ui,sans-serif;background:#f6f3ee;color:#1c2430}
  header{display:flex;gap:16px;padding:12px 24px;background:#17324d}header a{color:#fff}
  main{padding:24px}.carte{padding:12px;background:#fff;border-radius:10px;margin:0 0 8px}</style></head><body>
  <header><a href="/app" data-route>Accueil</a><a href="/app/clients" data-route>Clients</a><a href="/formulaire">Contact</a></header>
  ${body}</body></html>`;

const records = {
  'app.json': {
    url: `${SITE}/app`,
    html: shell(
      'CRM',
      '<main id="vue"></main><script data-fd-script="s1"></script><script data-fd-script="s2"></script>',
    ),
    scripts: [
      {
        id: 's1',
        keep: true,
        category: 'page',
        source: 'page',
        code: `const vue = document.getElementById('vue');
          async function rendre() {
            const p = location.pathname;
            if (p === '/app') vue.innerHTML = '<h1>Accueil</h1>';
            else if (p === '/app/clients') {
              const l = await (await fetch('/api/clients')).json();
              vue.innerHTML = '<h1>Clients</h1>' + l.map(c => '<p class="carte"><a href="/app/clients/' + c.id + '" data-route>' + c.nom + '</a></p>').join('');
            } else {
              const l = await (await fetch('/api/clients')).json();
              const c = l.find(x => String(x.id) === p.split('/').pop());
              vue.innerHTML = '<h1>' + c.nom + '</h1><p class="carte">Ville : ' + c.ville + '</p>';
            }
          }
          document.addEventListener('click', e => { const a = e.target.closest('a[data-route]'); if (!a) return; e.preventDefault(); history.pushState({}, '', a.getAttribute('href')); rendre(); });
          rendre();`,
      },
      {
        id: 's2',
        keep: true,
        category: 'third',
        source: 'https://chat.tiers.test/w.js',
        code: `const b = document.createElement('button'); b.textContent = 'Discuter avec nous'; document.body.append(b);`,
      },
    ],
    responses: [],
  },
  'form.json': {
    url: `${SITE}/formulaire`,
    html: shell(
      'Contact',
      `<main><h1>Demande de contact</h1><form id="f" class="carte" novalidate><label>Nom <input id="nom"></label>
       <p id="err" hidden>Indiquez votre nom.</p><button>Envoyer la demande</button></form></main><script data-fd-script="s1"></script>`,
    ),
    scripts: [
      {
        id: 's1',
        keep: true,
        category: 'page',
        source: 'page',
        code: `document.getElementById('f').addEventListener('submit', async e => { e.preventDefault();
          if (!document.getElementById('nom').value.trim()) { document.getElementById('err').hidden = false; return; }
          await fetch('/api/contact', { method: 'POST', body: '{}' });
          document.querySelector('main').innerHTML = '<h1>Demande envoyée</h1><a href="/formulaire">Nouvelle demande</a>'; });`,
      },
    ],
    // Liste relevée sur cette page-ci : rejouée aussi dans l'application (réponses de toute la démo)
    responses: [
      {
        method: 'GET',
        url: `${SITE}/api/clients`,
        status: 200,
        type: 'application/json',
        body: JSON.stringify([{ id: 1, nom: 'Atelier Durand', ville: 'Lyon' }]),
      },
    ],
  },
};
const inert = {
  'p3.html': '<!doctype html><html><body><h1>Page inerte de secours</h1></body></html>',
  'app.html': '<!doctype html><html><body><h1>Copie fixe CRM</h1></body></html>',
  'form.html': '<!doctype html><html><body><h1>Copie fixe Contact</h1></body></html>',
};
const step = (id, title, file, live) => ({
  id,
  kind: 'html',
  title,
  html: { url: `assets/${file}`, title, viewport: { w: 1280, h: 720 }, ops: [], links: [], live },
});
const manifest = {
  schemaVersion: 1,
  demoId: DEMO,
  versionId: '0b5c1f0e-0000-4000-8000-0000000003cf',
  workspaceId: 'w',
  title: 'CRM vivant',
  locale: 'fr',
  publishedAt: '2026-11-26T10:00:00Z',
  theme: {},
  variables: [],
  kind: 'sandbox',
  sandbox: { start: S1, autoLink: true, unlinked: 'toast', guide: false, keyPages: [] },
  steps: [
    step(S1, 'Accueil', 'app.html', { url: 'assets/app.json', keep: ['s1'] }),
    step(S2, 'Contact', 'form.html', { url: 'assets/form.json', keep: ['s1'] }),
    step(S3, 'Secours', 'p3.html', { url: 'assets/absent.json', keep: [] }),
  ],
};

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};

(async () => {
  const b = await chromium.launch();
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  // Toute requête hors du lecteur et de ses routes simulées est une sortie
  const sorties = [];
  const csp = new Set();
  // Seules comptent les requêtes de la PAGE rejouée (le cadre), pas celles du lecteur (polices, suivi)
  ctx.on('request', (r) => {
    if (/^(data|about|blob):/.test(r.url())) return;
    if (r.frame() !== r.frame().page().mainFrame()) sorties.push(r);
  });
  ctx.on('requestfailed', (r) => /csp/i.test(r.failure()?.errorText ?? '') && csp.add(r));
  await p.route('**/functions/v1/open-demo', (r) =>
    r.fulfill({
      contentType: 'application/json',
      headers: cors,
      body: JSON.stringify({ status: 'ok', manifest }),
    }),
  );
  await p.route('**/functions/v1/track', (r) => r.fulfill({ status: 200, headers: cors, body: '{}' }));
  await p.route('**/assets/*', (r) => {
    const f = r.request().url().split('/').pop();
    if (records[f])
      return r.fulfill({ contentType: 'application/json', headers: cors, body: JSON.stringify(records[f]) });
    if (inert[f]) return r.fulfill({ contentType: 'text/html', headers: cors, body: inert[f] });
    return r.fulfill({ status: 404, headers: cors, body: '' });
  });
  await p.goto(`${PLAYER}/#/d/${DEMO}`);
  const iframe = p.locator('.p-html-frame iframe');
  await iframe.waitFor();
  const f = p.frameLocator('.p-html-frame iframe');
  await f.getByRole('heading', { name: 'Accueil' }).waitFor({ timeout: 8000 });
  const srcdoc = (await iframe.getAttribute('srcdoc')) ?? '';
  ok(
    (await iframe.getAttribute('sandbox')) === 'allow-scripts' &&
      /connect-src 'none'/.test(srcdoc) &&
      /script-src 'sha256-[^;]+;/.test(srcdoc) &&
      !/unsafe-eval|script-src[^;]*https?:/.test(srcdoc),
    'page vivante : iframe allow-scripts, CSP sans sortie, scripts par empreintes',
  );
  ok((await f.getByText('Discuter avec nous').count()) === 0, 'script bloqué par l’auteur : non exécuté');

  await f.getByRole('link', { name: 'Clients' }).click();
  await f
    .getByRole('link', { name: 'Atelier Durand' })
    .waitFor({ timeout: 4000 })
    .catch(() => null);
  ok(
    (await f.getByRole('link', { name: 'Atelier Durand' }).count()) === 1,
    'application à page unique : liste chargée (réponse relevée sur l’autre page de la démo)',
  );
  await f.getByRole('link', { name: 'Atelier Durand' }).click();
  await f
    .getByText('Ville : Lyon')
    .waitFor({ timeout: 4000 })
    .catch(() => null);
  ok((await f.getByText('Ville : Lyon').count()) === 1, 'fiche par route interne');
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/sandbox-vivant-fiche${sfx}.png` });

  // Lien vers une autre page capturée : le lecteur change d'étape
  await f.getByRole('link', { name: 'Contact' }).click();
  await f
    .getByRole('heading', { name: 'Demande de contact' })
    .waitFor({ timeout: 6000 })
    .catch(() => null);
  ok(
    (await f.getByRole('heading', { name: 'Demande de contact' }).count()) === 1,
    'lien vers une page capturée : étape suivante',
  );
  await f.getByRole('button', { name: 'Envoyer la demande' }).click();
  await f
    .getByText('Indiquez votre nom.')
    .waitFor({ timeout: 3000 })
    .catch(() => null);
  ok(
    await f
      .getByText('Indiquez votre nom.')
      .isVisible()
      .catch(() => false),
    'formulaire : validation de la page',
  );
  await f.locator('#nom').fill('Camille');
  await f.getByRole('button', { name: 'Envoyer la demande' }).click();
  await f
    .getByRole('heading', { name: 'Demande envoyée' })
    .waitFor({ timeout: 3000 })
    .catch(() => null);
  ok(
    (await f.getByRole('heading', { name: 'Demande envoyée' }).count()) === 1,
    'envoi : succès fictif, la page avance',
  );
  await f.getByRole('link', { name: 'Nouvelle demande' }).click();
  await f
    .locator('#nom')
    .waitFor({ timeout: 4000 })
    .catch(() => null);
  ok(
    (await f.locator('#nom').count()) === 1 && (await f.locator('#nom').inputValue()) === '',
    'retour : formulaire vide (page rechargée)',
  );
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/sandbox-vivant-formulaire${sfx}.png` });

  // Enregistrement illisible (404) : la page est la copie inerte (contexte neuf, sans reprise de visite)
  const ctx2 = await themedContext(b, { viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const p2 = await ctx2.newPage();
  const m2 = {
    ...manifest,
    sandbox: { ...manifest.sandbox, start: S3 },
    steps: [manifest.steps[2], ...manifest.steps.slice(0, 2)],
  };
  await p2.route('**/functions/v1/open-demo', (r) =>
    r.fulfill({
      contentType: 'application/json',
      headers: cors,
      body: JSON.stringify({ status: 'ok', manifest: m2 }),
    }),
  );
  await p2.route('**/functions/v1/track', (r) => r.fulfill({ status: 200, headers: cors, body: '{}' }));
  await p2.route('**/assets/*', (r) => {
    const name = r.request().url().split('/').pop();
    if (records[name])
      return r.fulfill({
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify(records[name]),
      });
    if (inert[name]) return r.fulfill({ contentType: 'text/html', headers: cors, body: inert[name] });
    return r.fulfill({ status: 404, headers: cors, body: '' });
  });
  await p2.goto(`${PLAYER}/#/d/${DEMO}`);
  const s3 = await p2
    .frameLocator('.p-html-frame iframe')
    .getByRole('heading', { name: 'Page inerte de secours' })
    .waitFor({ timeout: 6000 })
    .then(() => true)
    .catch(() => false);
  ok(s3, 'enregistrement illisible : repli sur la copie inerte');
  await ctx2.close();

  const vraies = sorties.filter((r) => !csp.has(r)).map((r) => r.url());
  ok(vraies.length === 0, `aucune requête vers l’extérieur pendant la visite (${vraies.join(', ')})`);
  ok(errors.length === 0, `aucune erreur du lecteur (${errors.join(' | ')})`);
  await b.close();
})();
