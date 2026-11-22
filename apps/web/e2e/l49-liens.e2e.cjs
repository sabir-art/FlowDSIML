/**
 * Recette L49 P3 (docs/ux/specs/l49-securite-html.md §4, §5, §7). Données fictives (example).
 *  - éditeur : « Liens externes · n » (texte, adresse en chasse fixe, interrupteur nommé), autoriser un lien
 *    https (opération extlink), adresse http non autorisable (« Adresse non sécurisée ») ;
 *  - lecteur : lien désactivé sans effet (« Ce lien mène hors de la démo. »), lien autorisé → dialogue
 *    « Vous quittez la démo » avec le domaine réel (pas le texte du lien), focus sur « Rester dans la
 *    démo », « Ouvrir » sans opener ; formulaire capturé jamais envoyé ; axe.
 * Usage : node e2e/l49-liens.e2e.cjs
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const STEP = '0b5c1f0e-0000-4000-8000-0000000004b1';
// Page telle que html-ingest la stocke : liens vers un autre domaine sans href
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Aide</title></head><body><main>
  <h1>Centre d’aide</h1>
  <a id="int" href="https://app.acme.example/aide">Aide interne</a>
  <a id="doc" data-tc-href="https://docs.globex.example/guide" data-tc-ext="off">Votre banque en ligne</a>
  <a id="old" data-tc-href="http://ancien.globex.example/" data-tc-ext="off">Ancien site</a>
  <a id="other" data-tc-href="https://autre.initech.example/" data-tc-ext="off">Autre site</a>
  <form id="f"><input name="q"><button type="submit" id="send">Envoyer</button></form>
</main></body></html>`;

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const watch = (p) =>
    p.on('pageerror', (e) => {
      if (!/lacks the 'allow-same-origin' flag/.test(e.message)) errors.push(e.message);
    });

  // ===== Éditeur =====
  const state = seed();
  const base = state.tables.steps.find((s) => s.demo_id === DEMO);
  const ws = state.tables.workspaces[0].id;
  const path = `${ws}/${DEMO}/${STEP}.html`;
  state.htmlPages = { [path]: PAGE };
  state.tables.steps.unshift({
    ...base,
    id: STEP,
    position: -1,
    kind: 'html',
    title: 'Aide',
    image_path: null,
    html_path: path,
    html_ops: [],
    html_meta: {
      title: 'Aide',
      url: 'https://app.acme.example/aide',
      viewport: { w: 1280, h: 720 },
      links: [
        { sel: '#int', href: 'https://app.acme.example/aide', label: 'Aide interne' },
        { sel: '#doc', href: 'https://docs.globex.example/guide', label: 'Votre banque en ligne' },
        { sel: '#old', href: 'http://ancien.globex.example/', label: 'Ancien site' },
      ],
    },
  });
  const ed = await (
    await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' })
  ).newPage();
  watch(ed);
  await install(ed, state);
  await ed.goto(`${APP}/#/demos/${DEMO}/edit`);
  await ed.frameLocator('.html-stage iframe').locator('h1').waitFor();
  const sec = ed.locator('.xlinks');
  await sec.waitFor();
  ok(
    // Titre en capitales à l'écran (text-transform) : on compare le texte du document
    (await sec.locator('.sec-title').textContent()).trim() === 'Liens externes · 2',
    'titre « Liens externes · 2 » (interne exclu)',
  );
  const items = sec.locator('li');
  ok(
    (await items.nth(0).locator('b').innerText()) === 'Votre banque en ligne' &&
      (await items.nth(0).locator('code').innerText()) === 'https://docs.globex.example/guide',
    'texte du lien et adresse complète en chasse fixe',
  );
  const sw = ed.getByRole('switch', { name: 'Autoriser le lien Votre banque en ligne' });
  ok((await sw.count()) === 1 && !(await sw.isChecked()), 'interrupteur nommé, désactivé par défaut');
  ok((await items.nth(0).innerText()).includes('Désactivé'), 'libellé « Désactivé »');
  const st = await items
    .nth(0)
    .locator('.fd-switch__text')
    .evaluate((el) => [getComputedStyle(el).fontSize, getComputedStyle(el).color]);
  const nameColor = await items
    .nth(0)
    .locator('b')
    .evaluate((el) => getComputedStyle(el).color);
  ok(
    st[0] === '13px' && st[1] !== nameColor,
    `R2 : état en 13 px text-muted, sous le nom du lien (${st.join()})`,
  );
  ok(
    (await items.nth(1).innerText()).includes('Adresse non sécurisée') &&
      (await items.nth(1).getByRole('switch').count()) === 0,
    'http : « Adresse non sécurisée », pas d’interrupteur',
  );
  await sw.check();
  await ed.waitForTimeout(1300);
  const ops = state.tables.steps.find((s) => s.id === STEP).html_ops;
  ok(
    ops.length === 1 &&
      ops[0].op === 'extlink' &&
      ops[0].sel === '#doc' &&
      ops[0].value === 'https://docs.globex.example/guide' &&
      ops[0].scope === 'step',
    'autoriser : opération extlink sur l’étape',
  );
  ok((await items.nth(0).innerText()).includes('Autorisé'), 'libellé « Autorisé »');
  ok(
    (await ed.getByText('Lien externe autorisé : docs.globex.example').count()) === 1,
    'liste des modifications : « Lien externe autorisé : docs.globex.example »',
  );
  const axe = await new AxeBuilder({ page: ed })
    .include('.xlinks')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  ok(
    axe.violations.length === 0,
    `axe liens externes : ${axe.violations.map((v) => v.id).join(', ') || '0'}`,
  );

  // ===== Lecteur =====
  const D = '0b5c1f0e-0000-4000-8000-0000000004d1';
  const manifest = {
    schemaVersion: 1,
    demoId: D,
    versionId: '0b5c1f0e-0000-4000-8000-0000000004cf',
    workspaceId: 'w',
    title: 'Aide',
    locale: 'fr',
    publishedAt: '2026-11-21T10:00:00Z',
    theme: {},
    variables: [],
    steps: [
      {
        id: STEP,
        kind: 'html',
        title: 'Aide',
        html: {
          url: 'assets/aide.html',
          title: 'Aide',
          viewport: { w: 1280, h: 720 },
          links: [],
          ops: [
            {
              id: 'e1',
              sel: '#doc',
              op: 'extlink',
              value: 'https://docs.globex.example/guide',
              scope: 'step',
            },
            // Adresse non https : ignorée par le lecteur
            { id: 'e2', sel: '#old', op: 'extlink', value: 'http://ancien.globex.example/', scope: 'step' },
          ],
        },
      },
    ],
  };
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, locale: 'fr-FR' });
  const p = await ctx.newPage();
  watch(p);
  const posted = [];
  await ctx.route('https://docs.globex.example/**', (r) =>
    r.fulfill({ contentType: 'text/html', body: '<title>Guide</title>' }),
  );
  await p.route('**/functions/v1/open-demo', (r) =>
    r.fulfill({
      contentType: 'application/json',
      headers: cors,
      body: JSON.stringify({ status: 'ok', manifest }),
    }),
  );
  await p.route('**/assets/aide.html', (r) =>
    r.fulfill({ contentType: 'text/html', headers: cors, body: PAGE }),
  );
  await p.route('**/functions/v1/track', (r) => r.fulfill({ status: 200, headers: cors, body: '{}' }));
  // Mesure d'audience du lecteur exclue : seul un envoi du formulaire capturé compterait
  p.on(
    'request',
    (r) => r.method() === 'POST' && !r.url().includes('/functions/v1/track') && posted.push(r.url()),
  );
  await p.goto(`${PLAYER}/#/d/${D}`);
  const frame = p.frameLocator('.p-html-frame iframe');
  await frame.locator('h1').waitFor();
  await p.waitForTimeout(400);

  // Lien désactivé : rien ne s'ouvre, message
  await frame.locator('#other').click();
  await p.waitForTimeout(200);
  ok(
    (await p.locator('.p-html-toast').innerText()) === 'Ce lien mène hors de la démo.' &&
      (await p.locator('dialog.p-leave').count()) === 0,
    'lien désactivé : « Ce lien mène hors de la démo. », aucune ouverture',
  );
  // Adresse http autorisée par erreur : ignorée
  await frame.locator('#old').click();
  await p.waitForTimeout(200);
  ok((await p.locator('dialog.p-leave').count()) === 0, 'adresse http : jamais ouverte');

  // Lien autorisé : dialogue avec le domaine réel
  await frame.locator('#doc').click();
  const dlg = p.getByRole('dialog', { name: 'Vous quittez la démo' });
  await dlg.waitFor();
  const body = (await dlg.innerText()).replace(/\s+/g, ' ');
  ok(
    body.includes('Ce lien ouvre un site extérieur dans un nouvel onglet') &&
      (await dlg.locator('strong').innerText()) === 'docs.globex.example',
    `domaine réel en gras, pas le texte du lien (${body})`,
  );
  ok(!body.includes('banque'), 'le texte du lien n’est pas repris');
  ok(
    (await p.evaluate(() => document.activeElement?.textContent)) === 'Rester dans la démo',
    'focus sur « Rester dans la démo »',
  );
  const axe2 = await new AxeBuilder({ page: p })
    .include('dialog.p-leave')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  ok(axe2.violations.length === 0, `axe dialogue : ${axe2.violations.map((v) => v.id).join(', ') || '0'}`);
  await dlg.getByRole('button', { name: 'Rester dans la démo' }).click();
  await p
    .locator('dialog.p-leave')
    .waitFor({ state: 'detached', timeout: 3000 })
    .catch(() => undefined);
  ok((await p.locator('dialog.p-leave').count()) === 0, '« Rester dans la démo » ferme le dialogue');

  await frame.locator('#doc').click();
  await dlg.waitFor();
  const [tab] = await Promise.all([
    ctx.waitForEvent('page'),
    dlg.getByRole('button', { name: 'Ouvrir' }).click(),
  ]);
  await tab.waitForLoadState().catch(() => undefined);
  ok(
    tab.url() === 'https://docs.globex.example/guide',
    `« Ouvrir » : nouvel onglet sur l’adresse autorisée (${tab.url()})`,
  );
  ok((await tab.evaluate(() => window.opener)) === null, 'nouvel onglet sans opener');
  ok(
    (await p.frameLocator('.p-html-frame iframe').locator('h1').count()) === 1 &&
      (await p.locator('.p-html-frame iframe').getAttribute('sandbox')) === 'allow-scripts',
    'la page reste dans son cadre sandbox, sans popups',
  );

  // §5 : formulaire capturé jamais envoyé
  const before = posted.length;
  await frame.locator('#send').click();
  await p.waitForTimeout(300);
  ok(posted.length === before && p.url().includes(`/d/${D}`), 'formulaire capturé : aucun envoi');

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})();
