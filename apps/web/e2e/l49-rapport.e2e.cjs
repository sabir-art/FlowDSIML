/**
 * Recette L49 P2 (docs/ux/specs/l49-securite-html.md §3). Données fictives (example).
 *  - éditeur, outil Étape d'une page HTML : section « Sécurité de la page » (groupe nommé), statut écrit
 *    avec un point de 8 px (pas de badge), phrase, « Détail » qui déplie les compteurs (chiffres à droite) ;
 *  - « Page sûre », « Éléments retirés », page plus ancienne sans rapport ;
 *  - modale Publier : ligne « n pages analysées : x sûres, y avec éléments retirés » ; axe.
 * Usage : node e2e/l49-rapport.e2e.cjs
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const S = [1, 2, 3, 4].map((i) => `0b5c1f0e-0000-4000-8000-0000000004${i}0`);
const SAFE = { scripts: 0, handlers: 0, frames: 0, forms: 0, externalLinks: 2, piiReplaced: 1, other: 0 };
const REMOVED = { scripts: 2, handlers: 3, frames: 1, forms: 1, externalLinks: 0, piiReplaced: 0, other: 4 };
const SECURITY = [SAFE, REMOVED, { ...SAFE, externalLinks: 0 }, null];
const page = (h1) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${h1}</title></head><body><main><h1>${h1}</h1><p>Acme</p></main></body></html>`;

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' })).newPage();
  const errors = [];
  p.on('pageerror', (e) => {
    if (!/lacks the 'allow-same-origin' flag/.test(e.message)) errors.push(e.message);
  });
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const state = seed();
  const base = state.tables.steps.find((s) => s.demo_id === DEMO);
  const ws = state.tables.workspaces[0].id;
  state.htmlPages = {};
  const titles = ['Tableau de bord', 'Formulaire', 'Rapports', 'Ancienne page'];
  S.forEach((id, i) => {
    const path = `${ws}/${DEMO}/${id}.html`;
    state.htmlPages[path] = page(titles[i]);
    const meta = { title: titles[i], url: `https://app.acme.example/${i}`, viewport: { w: 1280, h: 720 } };
    if (SECURITY[i]) meta.security = { ...SECURITY[i], analyzedAt: '2026-11-21T02:00:00Z' };
    state.tables.steps.unshift({
      ...base,
      id,
      position: -4 + i,
      kind: 'html',
      title: titles[i],
      image_path: null,
      html_path: path,
      html_ops: [],
      html_meta: meta,
    });
  });
  state.tables.steps.sort((a, b) => a.position - b.position);
  await install(p, state);
  await p.goto(`${APP}/#/demos/${DEMO}/edit`);
  await p.frameLocator('.html-stage iframe').locator('h1').waitFor();
  const sec = p.getByRole('group', { name: 'Sécurité de la page' });
  const goStep = async (i) => {
    await p.locator('.rail-list .step').nth(i).click();
    await p.frameLocator('.html-stage iframe').locator('h1', { hasText: titles[i] }).waitFor();
    await p.waitForTimeout(150);
  };

  // ===== Page sûre =====
  await sec.waitFor();
  ok((await sec.locator('.hsec-status strong').innerText()) === 'Page sûre', 'page 1 : « Page sûre »');
  const dot = await sec
    .locator('.hsec-dot')
    .evaluate((el) => [
      getComputedStyle(el).width,
      getComputedStyle(el).height,
      el.getAttribute('aria-hidden'),
    ]);
  ok(dot.join() === '8px,8px,true', `statut : point de 8 px masqué aux lecteurs d’écran (${dot.join()})`);
  ok((await sec.locator('.badge, .fd-badge').count()) === 0, 'statut : ni badge ni fond');
  ok(
    (await sec.locator('.help').innerText()) === 'Rien d’actif à retirer sur cette page.',
    'phrase : « Rien d’actif à retirer sur cette page. »',
  );
  const detail = sec.getByRole('button', { name: 'Détail' });
  ok((await detail.getAttribute('aria-expanded')) === 'false', '« Détail » replié');
  ok(await sec.getByRole('list').isHidden(), 'compteurs masqués');
  await detail.click();
  ok((await detail.getAttribute('aria-expanded')) === 'true', '« Détail » déplié');
  const rows = await sec
    .locator('.hsec-list li')
    .evaluateAll((li) => li.map((x) => [x.children[0].textContent, x.children[1].textContent]));
  ok(rows.length === 6, `6 compteurs (« autres » masqué à 0) : ${rows.length}`);
  ok(
    rows.some(([l, n]) => l === 'Liens externes désactivés' && n === '2') &&
      rows.some(([l, n]) => l === 'Donnée personnelle remplacée' && n === '1') &&
      rows.some(([l, n]) => l === 'Script retiré' && n === '0'),
    'libellés accordés au nombre, chiffre à part',
  );
  const num = await sec
    .locator('.hsec-n')
    .first()
    .evaluate((el) => [getComputedStyle(el).fontVariantNumeric, el.getBoundingClientRect().right]);
  const listRight = await sec.locator('.hsec-list').evaluate((el) => el.getBoundingClientRect().right);
  ok(num[0].includes('tabular-nums') && Math.abs(num[1] - listRight) < 1, 'chiffres à droite, tabular-nums');
  const axe = await new AxeBuilder({ page: p })
    .include('.hsec')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  ok(axe.violations.length === 0, `axe section : ${axe.violations.map((v) => v.id).join(', ') || '0'}`);

  // ===== Éléments retirés =====
  await goStep(1);
  ok(
    (await sec.locator('.hsec-status strong').innerText()) === 'Éléments retirés',
    'page 2 : « Éléments retirés »',
  );
  ok(
    (await sec.locator('.help').innerText()) ===
      'Tout ce qui pouvait s’exécuter ou envoyer des données a été retiré. La page est publiable.',
    'phrase : publiable',
  );
  ok((await sec.locator('.hsec-dot.is-removed').count()) === 1, 'point « warning »');
  ok(
    (await sec.getByRole('button', { name: 'Détail' }).getAttribute('aria-expanded')) === 'false',
    'autre étape : « Détail » replié de nouveau',
  );
  await sec.getByRole('button', { name: 'Détail' }).click();
  ok(
    (await sec.locator('.hsec-list li').count()) === 7 &&
      (await sec.locator('.hsec-list li').last().innerText()).replace(/\s+/g, ' ') ===
        'Autres éléments retirés 4',
    '« autres éléments retirés » affiché quand il est différent de 0',
  );

  // ===== Page plus ancienne : pas de rapport =====
  await goStep(3);
  ok(
    (await sec.innerText()).includes('Page capturée avant l’analyse de sécurité : pas de rapport.'),
    'page sans rapport : expliquée, sans statut',
  );

  // ===== Modale Publier =====
  await p.getByRole('button', { name: 'Publier' }).click();
  const dlg = p.locator('dialog.gdpr-dialog[open]');
  await dlg.waitFor();
  const line = (await dlg.locator('.gdpr-summary li').allInnerTexts()).find((x) => /pages analysées/.test(x));
  ok(
    line === '3 pages analysées : 2 sûres, 1 avec éléments retirés',
    `liste avant publication : ${line ?? 'absente'}`,
  );
  ok(
    (await dlg
      .getByRole('button', { name: /Publier/ })
      .last()
      .isDisabled()) || (await dlg.locator('input[type=checkbox]').count()) > 0,
    'ligne d’information : la publication suit son cours habituel (pas de blocage ajouté)',
  );

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})();
