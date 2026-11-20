/**
 * Recette L48-E (spec docs/ux/specs/l48e-editeur.md §8). Données fictives, faux Supabase.
 *  - rail d'outils (groupes, flèches, Alt + 3, Échap), un seul panneau, fermeture par l'outil actif ;
 *  - point d'intérêt du canevas → « Points d'intérêt » ; flou en modale (Annuler confirmé, Appliquer) ;
 *  - commentaires en panneau de 400 px (canevas pleine hauteur) ; en-tête (un seul primaire, menu Plus) ;
 *  - étape HTML : Zoom et Recadrage désactivés avec la raison ; outil gardé (fd.editor.tool) ; axe.
 * Usage : node e2e/l48e-editeur.e2e.cjs
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const state = seed();
  // Une étape HTML en 4e position (Zoom et Recadrage sans objet)
  const ws = state.tables.workspaces[0].id;
  const base = state.tables.steps.find((s) => s.demo_id === DEMO);
  const path = `${ws}/${DEMO}/st-html.html`;
  state.htmlPages = { [path]: '<!doctype html><html><body><h1>Page HTML</h1></body></html>' };
  state.tables.steps.push({
    ...base,
    id: 'st-html',
    position: 3,
    kind: 'html',
    title: 'Page HTML',
    image_path: null,
    html_path: path,
    html_ops: [],
    html_meta: {
      title: 'Page HTML',
      url: 'https://app.acme.example/',
      viewport: { w: 1280, h: 720 },
      links: [],
    },
  });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' })).newPage();
  p.on('pageerror', (e) => {
    if (!/lacks the 'allow-same-origin' flag/.test(e.message)) errors.push(e.message);
  });
  await install(p, state);
  await p.goto(`${APP}/#/demos/${DEMO}/edit`);
  const rail = p
    .getByRole('toolbar', { name: 'Outils de l’étape' })
    .or(p.getByRole('toolbar', { name: "Outils de l'étape" }));
  await rail.waitFor();

  // ===== Rail =====
  ok((await rail.getAttribute('aria-orientation')) === 'vertical', 'rail vertical');
  ok((await rail.getByRole('group').count()) === 5, 'groupes : Contenu, Écran, Apparence, Collaborer, Démo');
  ok((await rail.locator('button[data-tool]').count()) === 13, '13 outils');
  ok((await p.locator('.ed-tool').count()) === 1, 'un panneau ouvert (Étape par défaut)');
  ok((await p.locator('#ed-tool-title').innerText()) === 'Étape', 'panneau « Étape »');
  ok((await p.locator('.stage-head + * .floatbar, .floatbar').count()) === 0, 'plus de barre flottante');
  // Fermer par l'outil actif : le canevas s'élargit
  const w0 = (await p.locator('.stage').boundingBox()).width;
  await rail.locator('[data-tool="step"]').click();
  ok((await p.locator('.ed-tool').count()) === 0, 'clic sur l’outil actif : panneau fermé');
  const w1 = (await p.locator('.stage').boundingBox()).width;
  ok(w1 > w0 + 300, `canevas élargi (${Math.round(w0)} → ${Math.round(w1)} px)`);
  // Clavier : flèches, Alt + 3, Échap
  await rail.locator('[data-tool="step"]').focus();
  await p.keyboard.press('ArrowDown');
  ok(
    await rail.locator('[data-tool="cta"]').evaluate((el) => el === document.activeElement),
    'flèche bas : outil suivant',
  );
  await p.locator('.stage').click({ position: { x: 10, y: 10 } });
  await p.keyboard.press('Alt+Digit3');
  await p.locator('[data-tool-panel="hotspots"]').waitFor();
  ok(true, 'Alt + 3 : Points d’intérêt');
  ok(
    await p.evaluate(() => document.activeElement?.id === 'ed-tool-title'),
    'le titre du panneau prend le focus',
  );
  await p.keyboard.press('Escape');
  ok((await p.locator('.ed-tool').count()) === 0, 'Échap ferme le panneau');
  await p.waitForTimeout(100);
  ok(
    await rail.locator('[data-tool="hotspots"]').evaluate((el) => el === document.activeElement),
    'Échap rend le focus à l’outil',
  );
  // Point d'intérêt du canevas → panneau avec ce point
  await p.locator('[data-canvas-item]').first().click();
  await p.locator('[data-tool-panel="hotspots"] #hs-rect-x').waitFor();
  ok(true, 'clic sur un point : « Points d’intérêt » avec ce point');
  ok(
    JSON.parse(await p.evaluate(() => JSON.stringify(localStorage.getItem('fd.editor.tool')))) === 'hotspots',
    'outil gardé (fd.editor.tool)',
  );

  // ===== Flou en modale =====
  await rail.locator('[data-tool="blur"]').click();
  const dlg = p.getByRole('dialog', { name: 'Flouter des zones' });
  await dlg.waitFor();
  const before = JSON.stringify(state.tables.steps.find((s) => s.id === 's1').blurs ?? null);
  const draw = async (x, y) => {
    const box = await dlg.locator('.canvas-frame').boundingBox();
    await p.mouse.move(box.x + box.width * x, box.y + box.height * y);
    await p.mouse.down();
    await p.mouse.move(box.x + box.width * (x + 0.15), box.y + box.height * (y + 0.1), { steps: 5 });
    await p.mouse.up();
  };
  await draw(0.1, 0.1);
  await draw(0.78, 0.04);
  ok((await dlg.locator('.blurm-zones > li').count()) === 2, '2 zones dessinées');
  await dlg.getByRole('button', { name: 'Annuler' }).first().click();
  const confirm = p.getByRole('dialog', { name: 'Abandonner les zones modifiées ?' });
  await confirm.waitFor();
  await confirm.getByRole('button', { name: 'Abandonner' }).click();
  await dlg.waitFor({ state: 'detached' }).catch(() => {});
  await p.waitForTimeout(1200);
  ok(
    JSON.stringify(state.tables.steps.find((s) => s.id === 's1').blurs ?? null) === before,
    'Annuler : zones rétablies',
  );
  await rail.locator('[data-tool="blur"]').click();
  await dlg.waitFor();
  await draw(0.2, 0.2);
  await dlg.getByRole('button', { name: 'Appliquer le flou' }).click();
  await p.waitForTimeout(1200);
  ok(
    (state.tables.steps.find((s) => s.id === 's1').blurs ?? []).length === 1,
    'Appliquer : zone enregistrée',
  );

  // ===== Commentaires =====
  const h0 = (await p.locator('.stage').boundingBox()).height;
  await rail.locator('[data-tool="comments"]').click();
  await p.locator('.ed-tool .cm').waitFor();
  ok(Math.round((await p.locator('.ed-tool').boundingBox()).width) === 400, 'panneau Commentaires de 400 px');
  ok(Math.abs((await p.locator('.stage').boundingBox()).height - h0) < 2, 'le canevas garde sa hauteur');
  ok((await p.locator('.ed-tool .fd-composer').count()) === 1, 'composeur dans le panneau');

  // ===== En-tête =====
  ok(
    (await p
      .locator('.ed-bar .btn-primary, .ed-bar .fd-btn--primary')
      .evaluateAll((els) => els.filter((e) => e.getClientRects().length > 0).length)) === 1,
    'un seul bouton principal visible (Publier)',
  );
  ok(
    (await p.locator('.ed-bar').getByRole('button', { name: 'Présenter' }).count()) === 0,
    'Présenter quitte l’en-tête',
  );
  await p.getByRole('button', { name: 'Plus d’options' }).click();
  const items = await p.getByRole('menuitem').allInnerTexts();
  ok(
    ['Présenter', 'Exporter', 'Traduire'].every((x) => items.some((i) => i.includes(x))),
    'Plus : Présenter, Exporter, Traduire',
  );
  await p.keyboard.press('Escape');
  ok(/Enregistré/.test(await p.locator('.ed-state').innerText()), 'état en texte « Enregistré »');

  // ===== Étape HTML =====
  await p.locator('.rail-list li').nth(3).locator('button, .step').first().click();
  await p.waitForTimeout(400);
  const zoom = rail.locator('[data-tool="zoom"]');
  ok(
    (await zoom.getAttribute('aria-disabled')) === 'true' &&
      (await zoom.getAttribute('data-tip')).includes('Pas de zoom sur une page HTML'),
    'étape HTML : Zoom désactivé, raison dans l’infobulle',
  );
  ok(
    (await rail.locator('[data-tool="crop"]').getAttribute('aria-disabled')) === 'true',
    'étape HTML : Recadrage désactivé',
  );

  // ===== axe =====
  for (const tool of ['step', 'comments', 'settings']) {
    if ((await p.locator(`[data-tool-panel="${tool}"]`).count()) === 0)
      await rail.locator(`[data-tool="${tool}"]`).click();
    await p.waitForTimeout(300);
    const r = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    ok(bad.length === 0, `axe ${tool} : ${bad.map((v) => v.id).join(', ') || '0 violation grave'}`);
  }

  // ===== Lien d'une notification : ?outil=commentaires =====
  await p.goto(`${APP}/#/demos/${DEMO}/edit?outil=commentaires`);
  await p.reload();
  await p.locator('[data-tool-panel="comments"]').waitFor();
  ok(true, '?outil=commentaires ouvre le panneau Commentaires');

  ok(errors.length === 0, `aucune erreur de page${errors.length ? ` : ${errors.join(' / ')}` : ''}`);
  await b.close();
})();
