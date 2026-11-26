/**
 * L66 : Présenter (fenêtre, minuteur, bilan et historique). Spec docs/ux/specs/l66-presenter.md §4.
 *  - le menu « Plus d'options » est fermé quand la fenêtre est ouverte ;
 *  - 2 cartes avec schéma et phrase ; l'aide du vidéoprojecteur seulement avec Deux fenêtres ;
 *  - Commencer à et Minuteur : même hauteur (40) et même largeur ; options en lignes ; Historique (n) ;
 *  - minuteur : « Plus que 2 min » à 13:00 sur 15:00, « +m:ss » après la fin ; sans minuteur, pas d'anneau ;
 *  - bilan : 3 chiffres, légende des couleurs, historique avec « celle-ci » ; « Voir » rouvre un bilan passé.
 * Faux Supabase, horloge simulée (page.clock). Usage : [THEME=dark] [SHOTS_DIR=…] node e2e/presenter-l66.e2e.cjs
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { fromMore } = require('./editor-rail.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};
const axe = async (page, sel) =>
  (await new AxeBuilder({ page }).include(sel).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map(
    (v) => v.id,
  );

async function openEditor(b, state) {
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install({ time: new Date('2026-11-26T10:00:00') });
  await install(page, state);
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');
  return { ctx, page, errors };
}

(async () => {
  const b = await chromium.launch();
  const state = seed();
  const ws = state.tables.workspaces[0].id;
  // Une présentation passée de cette démo (par la même personne), pour l'historique et « Voir »
  state.tables.present_reports = [
    {
      id: 'pr-old',
      workspace_id: ws,
      demo_id: DEMO,
      started_at: '2026-11-18T16:20:00.000Z',
      created_at: '2026-11-18T16:30:00.000Z',
      duration_s: 598,
      target_min: 10,
      mode: 'two',
      notes_changed: 0,
      steps: [
        { index: 0, title: 'Écran 1', seconds: 300 },
        { index: 1, title: 'Écran 2', seconds: 298 },
        { index: 2, title: 'Merci !', seconds: 0 },
      ],
    },
  ];
  const { ctx, page, errors } = await openEditor(b, state);

  // ===== §1 Fenêtre =====
  await fromMore(page, 'Présenter');
  const dlg = page.getByRole('dialog', { name: 'Présenter « Démo CRM »' });
  await dlg.waitFor();
  await page.waitForTimeout(300);
  ok(
    (await page.locator('.menu-list:visible').count()) === 0,
    'le menu « Plus d’options » est fermé quand la fenêtre est ouverte',
  );
  const cards = dlg.locator('.lx-card');
  const cardInfo = await cards.evaluateAll((l) =>
    l.map((c) => ({
      svg: !!c.querySelector('svg.lx-schema[aria-hidden="true"]'),
      art: Math.round(c.querySelector('.lx-art').getBoundingClientRect().height),
      phrase: c.querySelector('small').textContent,
    })),
  );
  ok(
    (await dlg.getByRole('radiogroup', { name: 'Affichage' }).count()) === 1 &&
      cardInfo.length === 2 &&
      cardInfo.every((c) => c.svg && c.art === 112) &&
      cardInfo[0].phrase ===
        'Vos notes et le minuteur sur votre écran ; la démo seule sur le vidéoprojecteur.' &&
      cardInfo[1].phrase === 'La démo en plein écran ; la touche N affiche ou masque vos notes.',
    `2 cartes radio : schéma de 112 px (aria-hidden) et une phrase (${JSON.stringify(cardInfo)})`,
  );
  const proj = dlg.getByText('Une seconde fenêtre s’ouvre : glissez-la sur le vidéoprojecteur, puis F11.');
  ok((await proj.count()) === 1, 'Deux fenêtres : aide du vidéoprojecteur');
  await dlg.getByRole('radio', { name: /Un seul écran/ }).check();
  ok((await proj.count()) === 0, 'Un seul écran : plus d’aide du vidéoprojecteur');
  ok((await dlg.locator('.lx-info, .fd-alert').count()) === 0, 'plus de bloc bleu d’information');
  const start = await dlg.getByRole('combobox', { name: 'Commencer à' }).boundingBox();
  const timer = dlg.getByRole('combobox', { name: 'Minuteur' });
  const tb = await timer.boundingBox();
  ok(
    Math.round(start.height) === 40 &&
      Math.round(tb.height) === 40 &&
      Math.abs(start.width - tb.width) <= 1 &&
      Math.abs(start.y - tb.y) <= 1,
    `Commencer à et Minuteur : sur une ligne, 40 px, même largeur (${Math.round(start.width)} / ${Math.round(tb.width)})`,
  );
  await timer.click();
  const opts = (await page.getByRole('option').allInnerTexts()).map((x) => x.trim());
  ok(
    opts.join('|') === 'Sans minuteur|5 min|10 min|15 min|20 min|30 min|45 min|60 min|Autre…',
    `minuteur : ${opts.join(', ')}`,
  );
  await page.keyboard.press('Escape');
  const rows = await dlg.locator('.lx-opts > li').evaluateAll((l) =>
    l.map((x) => ({
      t: x.querySelector('.lx-opt-tx > span').textContent,
      sw: !!x.querySelector('[role="switch"]'),
    })),
  );
  ok(
    rows.map((r) => r.t).join('|') ===
      'Masquer les points chauds à l’écran public|Piloter depuis mon téléphone' &&
      rows.every((r) => r.sw) &&
      (await dlg.locator('.lx-opts').evaluate((e) => getComputedStyle(e).borderRadius)) === '12px',
    'options : encadré de lignes (rayon 12), libellé, aide et interrupteur',
  );
  const hist = dlg.getByRole('button', { name: 'Historique (1)' });
  ok(
    (await hist.count()) === 1 &&
      (await dlg.locator('.fd-modal__foot button').allInnerTexts()).map((x) => x.trim()).join('|') ===
        'Historique (1)|Annuler|Lancer la présentation',
    'pied : « Historique (1) » à gauche, « Annuler » et « Lancer la présentation »',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/l66-fenetre${sfx}.png` });
  const bad = await axe(page, '.lxm');
  ok(bad.length === 0, `axe, fenêtre (${bad.join(', ')})`);

  // Historique depuis la fenêtre : « Voir » rouvre le bilan passé
  await hist.click();
  const hd = page.getByRole('dialog', { name: 'Historique des présentations' });
  await hd.waitFor();
  await hd.getByRole('button', { name: /^Voir la présentation/ }).click();
  const old = page.getByRole('dialog', { name: 'Présentation terminée' });
  await old.waitFor();
  ok(
    /9 min 58/.test(await old.locator('.rp-card').first().innerText()) &&
      /2 \/ 3/.test(await old.locator('.rp-card').nth(1).innerText()) &&
      /1 sautée/.test(await old.locator('.rp-card').nth(1).innerText()),
    'Historique › Voir : le bilan passé (9 min 58, 2 / 3, 1 sautée)',
  );
  await old.locator('.fd-modal__foot').getByRole('button', { name: 'Fermer' }).click();
  await hd.locator('.fd-modal__foot').getByRole('button', { name: 'Fermer' }).click();
  await dlg.waitFor();

  // ===== §2 Minuteur =====
  await dlg.getByRole('radio', { name: /Un seul écran/ }).check();
  await dlg.getByRole('button', { name: 'Lancer la présentation' }).click();
  await page.waitForURL(/#\/demos\/.*\/present\?/);
  await page.waitForSelector('.presenter iframe');
  const tm = page.getByRole('timer');
  await tm.waitFor();
  ok(
    (await page.locator('.pr-ring').count()) === 1 &&
      (await page.locator('.presenter .tbar').count()) === 0 &&
      (await page.locator('.pr-ring').evaluate((e) => Math.round(e.getBoundingClientRect().width))) === 36 &&
      /sur 15:00/.test(await page.locator('.pr-timer__tx small').innerText()) &&
      (await page.locator('.pr-timer__tx b').evaluate((e) => getComputedStyle(e).fontSize)) === '22px',
    'minuteur : anneau de 36 px, temps en 22 px, « sur 15:00 » ; plus de ligne de progression',
  );
  ok(
    (await page.locator('.pr-dots i').count()) === 3 &&
      (await page.locator('.pr-dots i.is-cur').count()) === 1 &&
      (await page.locator('.pr-sep').count()) === 1,
    'position : filet, une pastille par étape, l’étape en cours marquée',
  );
  await page.clock.fastForward('13:00');
  await page.waitForFunction(() => document.querySelector('.pr-timer')?.classList.contains('is-late'));
  ok(
    (await page.locator('.pr-pill').innerText()) === 'Plus que 2 min' &&
      (await page.locator('.pr-timer [aria-live="polite"]').innerText()) === 'Plus que 2 min' &&
      /^13 min 0\d écoulées sur 15 min 00$/.test(await tm.getAttribute('aria-label')),
    `à 13:00 sur 15:00 : « Plus que 2 min » (annoncé poliment), nom « ${await tm.getAttribute('aria-label')} »`,
  );
  if (SHOTS)
    await page.locator('.presenter .bar').screenshot({ path: `${SHOTS}/l66-minuteur-2min${sfx}.png` });
  await page.keyboard.press('ArrowRight');
  await page.clock.fastForward('03:20');
  await page.waitForFunction(() => document.querySelector('.pr-timer')?.classList.contains('is-over'));
  ok(
    /^\+1:2\d$/.test(await page.locator('.pr-pill.is-over').innerText()),
    `après la fin : « ${await page.locator('.pr-pill.is-over').innerText()} »`,
  );
  if (SHOTS)
    await page.locator('.presenter .bar').screenshot({ path: `${SHOTS}/l66-minuteur-depasse${sfx}.png` });

  // ===== §3 Bilan et historique =====
  await page.keyboard.press('Escape');
  const rep = page.getByRole('dialog', { name: 'Présentation terminée' });
  await rep.waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.rp-hist tbody tr').length === 2);
  const cardsTxt = (await rep.locator('.rp-card').allInnerTexts()).map((x) => x.replace(/\s+/g, ' '));
  ok(
    cardsTxt.length === 3 &&
      /Durée 16 min 2\d Prévu : 15 min Dépassée de 1 min 2\d/.test(cardsTxt[0]) &&
      /Étapes montrées 2 \/ 3 1 sautée/.test(cardsTxt[1]) &&
      /Notes modifiées 0 Aucune/.test(cardsTxt[2]),
    `3 chiffres : durée et verdict, étapes montrées, notes (${cardsTxt.join(' | ')})`,
  );
  ok(
    /Un seul écran$/.test(await rep.locator('.fd-modal__sub').innerText()) &&
      (await rep.locator('.rp-steps tbody tr').count()) === 3 &&
      /Étape la plus longue/.test(await rep.locator('.rp-legend').innerText()) &&
      /Autres étapes/.test(await rep.locator('.rp-legend').innerText()) &&
      (await rep.locator('.rp-steps tr.is-long').count()) === 1,
    'temps par étape, légende des couleurs (la plus longue, les autres), sous-titre avec l’affichage',
  );
  const cur = rep.locator('.rp-hist tr.is-current');
  ok(
    /celle-ci/.test(await cur.innerText()) &&
      (await cur.getAttribute('aria-current')) === 'true' &&
      /Gardé 90 jours, visible par vous seul\./.test(await rep.innerText()),
    'historique : la ligne en cours « celle-ci », « Gardé 90 jours, visible par vous seul. »',
  );
  const saved = state.tables.present_reports.find((r) => r.id !== 'pr-old');
  ok(
    !!saved && saved.mode === 'one' && saved.target_min === 15 && saved.steps.length === 3,
    'bilan enregistré (affichage, durée prévue, temps par étape)',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/l66-bilan${sfx}.png` });
  const bad2 = await axe(page, '.rp');
  ok(bad2.length === 0, `axe, bilan (${bad2.join(', ')})`);
  await rep.locator('.rp-hist tr:not(.is-current)').getByRole('button').click();
  await page.waitForFunction(() => /9 min 58/.test(document.querySelector('.rp-card')?.textContent ?? ''));
  ok(true, '« Voir » rouvre un bilan passé');
  await page
    .getByRole('dialog', { name: 'Présentation terminée' })
    .locator('.fd-modal__foot')
    .getByRole('button', { name: 'Fermer' })
    .click();
  await page.waitForFunction(() => /16 min/.test(document.querySelector('.rp-card')?.textContent ?? ''));
  ok(true, 'Fermer revient au bilan de cette présentation');
  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await ctx.close();

  // ===== Sans minuteur : temps écoulé seul, pas d'anneau =====
  {
    const { ctx: c2, page: p2 } = await openEditor(b, seed());
    await fromMore(p2, 'Présenter');
    const d2 = p2.getByRole('dialog', { name: /Présenter/ });
    await d2.waitFor();
    await d2.getByRole('radio', { name: /Un seul écran/ }).check();
    await d2.getByRole('combobox', { name: 'Minuteur' }).click();
    await p2.getByRole('option', { name: 'Sans minuteur' }).click();
    await d2.getByRole('button', { name: 'Lancer la présentation' }).click();
    await p2.waitForURL(/#\/demos\/.*\/present\?/);
    await p2.getByRole('timer').waitFor();
    ok(
      (await p2.locator('.pr-ring').count()) === 0 &&
        (await p2.locator('.pr-timer__tx small').count()) === 0 &&
        /^0 min 0\d écoulées$/.test(await p2.getByRole('timer').getAttribute('aria-label')),
      'sans minuteur : temps écoulé seul, sans anneau ni « sur »',
    );
    await p2.unrouteAll({ behavior: 'ignoreErrors' });
    await c2.close();
  }
  await b.close();
})();
