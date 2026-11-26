/**
 * Retours client, planche 3 : choix du modèle dans le champ de l'assistant.
 *  - plus de sélecteur « Modèle » en haut ; pilule « Auto » en bas à droite du champ, juste avant Envoyer
 *    (32 px, même centre, 4 px d'écart), aria-expanded, fond surface-sunken ouverte ;
 *  - menu de 288 px, rayon 16, au-dessus de la pilule, aligné sur le bord droit du panneau : Auto (coché,
 *    « Équilibre la vitesse, l'effort et le coût »), Recommandé (Claude Sonnet, Claude Opus en
 *    menuitemradio), Autres modèles › (sous-menu : Modèles OpenAI grisé « Bientôt », note du propriétaire) ;
 *  - clavier : flèches, Entrée choisit, flèche droite ouvre le sous-menu, Échap ferme ;
 *  - la demande porte le modèle choisi ; le pied dit « Généré par IA (Auto · Claude Sonnet), à vérifier ».
 * Faux Supabase, aucun appel au fournisseur. Usage : [THEME=dark] [SHOTS_DIR=…] node e2e/assistant-modele.e2e.cjs
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};

(async () => {
  const b = await chromium.launch();
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const state = seed();
  state.ai = {
    enabled: true,
    features: {
      write: true,
      translate: true,
      suggest: true,
      generate: true,
      dataset: true,
      chart: true,
      assistant: true,
    },
    used: 3,
    quota: 500,
    userToday: 0,
    userDailyRequests: 30,
    workspaceQuotaReached: false,
    userQuotaReached: false,
    renewsOn: '2026-12-01',
    canEdit: true,
    canManage: true,
  };
  state.aiReply = () => ({ text: 'La démo compte 3 étapes.', changes: [] });
  await install(page, state);
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');
  await page.getByRole('button', { name: 'Assistant' }).click();
  const panel = page.locator('[data-tool-panel="assistant"]');
  await panel.waitFor();

  ok((await panel.getByText(/^Modèle$/).count()) === 0, 'plus de sélecteur « Modèle » en haut du panneau');
  const pill = panel.getByRole('button', { name: 'Modèle : Auto' });
  const send = panel.locator('.fd-composer__send');
  // Le panneau s'ouvre avec une animation : mesure une fois les animations finies, en un seul relevé
  const measure = () =>
    panel.evaluate((p) =>
      ['.aim-pill', '.fd-composer__send'].map((sel) => {
        const r = p.querySelector(sel).getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }),
    );
  let [pb, sb] = await measure();
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(150);
    const [p2, s2] = await measure();
    const same = JSON.stringify([p2, s2]) === JSON.stringify([pb, sb]);
    [pb, sb] = [p2, s2];
    if (same) break;
  }
  ok(
    (await pill.innerText()).trim() === 'Auto' &&
      Math.round(pb.height) === 32 &&
      Math.round(sb.height) === 32 &&
      Math.abs(pb.y + pb.height / 2 - (sb.y + sb.height / 2)) < 1 &&
      Math.round(sb.x - (pb.x + pb.width)) === 4 &&
      (await pill.getAttribute('aria-haspopup')) === 'menu',
    `pilule « Auto » de 32 px juste avant Envoyer, même centre, 4 px (${Math.round(sb.x - (pb.x + pb.width))} px)`,
  );
  ok(
    (await pill.evaluate((e) => getComputedStyle(e).fontSize + ' ' + getComputedStyle(e).fontWeight)) ===
      '13px 500',
    'pilule : bouton fantôme 13 px / 500',
  );

  // Menu
  await pill.click();
  const menu = page.getByRole('menu', { name: 'Modèle de l’assistant' });
  await menu.waitFor();
  const mb = await menu.boundingBox();
  const panelBox = await panel.boundingBox();
  const geo = await menu.evaluate((m) => ({ r: getComputedStyle(m).borderRadius }));
  ok(
    (await pill.getAttribute('aria-expanded')) === 'true' &&
      (await pill.evaluate((e) => getComputedStyle(e).backgroundColor)) !== 'rgba(0, 0, 0, 0)' &&
      Math.round(mb.width) === 288 &&
      geo.r === '16px' &&
      mb.y + mb.height <= pb.y &&
      Math.round(panelBox.x + panelBox.width - (mb.x + mb.width)) === 8,
    `menu 288 px, rayon 16, au-dessus de la pilule, aligné à droite du panneau (${JSON.stringify({ ...geo, w: Math.round(mb.width), droite: Math.round(panelBox.x + panelBox.width - (mb.x + mb.width)) })})`,
  );
  const radios = menu.getByRole('menuitemradio');
  // Texte lu (la tuile du fournisseur est décorative, aria-hidden)
  const texts = await radios.evaluateAll((l) =>
    l.map((x) => x.querySelector('.aim-tx').textContent.replace(/\s+/g, ' ').trim()),
  );
  ok(
    texts.join(' | ') ===
      'AutoÉquilibre la vitesse, l’effort et le coût | Claude SonnetRapide, pour la plupart des textes | Claude OpusPlus précis, plus lent' &&
      (await radios.first().getAttribute('aria-checked')) === 'true' &&
      (await menu.getByRole('group', { name: 'Recommandé' }).count()) === 1,
    `Auto coché ; Recommandé : Sonnet, Opus (${texts.join(' | ')})`,
  );
  const lefts = await menu
    .locator('.aim-tx')
    .evaluateAll((l) => l.map((e) => Math.round(e.getBoundingClientRect().left)));
  ok(new Set(lefts).size === 1, `texte des lignes aligné, « Autres modèles » compris (${lefts.join(',')})`);
  ok(
    await radios.first().evaluate((e) => e === document.activeElement),
    'focus sur le modèle courant à l’ouverture',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/assistant-modele-menu${sfx}.png` });
  // Clavier : flèche bas jusqu'à « Autres modèles », flèche droite ouvre le sous-menu
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  ok(
    (await page.evaluate(() => document.activeElement?.textContent?.trim())) === 'Autres modèles',
    'flèches : jusqu’à « Autres modèles »',
  );
  await page.keyboard.press('ArrowRight');
  const sub = page.getByRole('menu', { name: 'Autres modèles' });
  await sub.waitFor();
  const subItem = sub.getByRole('menuitem');
  const subBox = await sub.boundingBox();
  ok(
    (await subItem.getAttribute('aria-disabled')) === 'true' &&
      /Modèles OpenAI/.test(await subItem.innerText()) &&
      /Bientôt/.test(await subItem.innerText()) &&
      /Le propriétaire choisit les modèles dans Paramètres › Assistance IA/.test(await sub.innerText()) &&
      subBox.x + subBox.width <= mb.x &&
      (await menu.locator('[data-more]').getAttribute('aria-expanded')) === 'true',
    'sous-menu sur le côté : Modèles OpenAI grisé « Bientôt », note du propriétaire',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/assistant-modele-autres${sfx}.png` });
  const bad = (
    await new AxeBuilder({ page }).include('.aim-menu').withTags(['wcag2a', 'wcag2aa']).analyze()
  ).violations.map((v) => v.id);
  ok(bad.length === 0, `axe, menus ouverts (${bad.join(', ')})`);
  await page.keyboard.press('ArrowLeft');
  await sub.waitFor({ state: 'detached' });
  // Flèche haut vers Opus, Entrée choisit
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await menu.waitFor({ state: 'detached' });
  ok(
    (await panel.getByRole('button', { name: 'Modèle : Claude Opus' }).count()) === 1 &&
      (await page.evaluate(() => document.activeElement?.classList.contains('aim-pill'))),
    'Entrée choisit Claude Opus ; le focus revient sur la pilule',
  );
  // Demande avec Opus
  await panel.getByLabel('Message à l’assistant').fill('Combien d’étapes ?');
  await page.keyboard.press('Enter');
  await panel.locator('.ai-mention').first().waitFor();
  ok(
    state.aiCalls.at(-1).model === 'opus' &&
      (await panel.locator('.ai-mention').last().innerText()) === 'Généré par IA (Claude Opus), à vérifier',
    'demande avec model=opus ; pied « Généré par IA (Claude Opus), à vérifier »',
  );
  // Retour à Auto : pas de modèle dans la demande, le pied dit le modèle réellement utilisé
  await panel.getByRole('button', { name: 'Modèle : Claude Opus' }).click();
  await menu.getByRole('menuitemradio', { name: /^Auto/ }).click();
  await panel.getByLabel('Message à l’assistant').fill('Et le titre ?');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('.ai-mention').length >= 2);
  ok(
    !('model' in state.aiCalls.at(-1)) &&
      (await panel.locator('.ai-mention').last().innerText()) ===
        'Généré par IA (Auto · Claude Sonnet), à vérifier',
    'Auto : aucun modèle imposé ; pied « Généré par IA (Auto · Claude Sonnet), à vérifier »',
  );
  // Échap ferme le menu et rend le focus
  await panel.getByRole('button', { name: 'Modèle : Auto' }).click();
  await menu.waitFor();
  await page.keyboard.press('Escape');
  await menu.waitFor({ state: 'detached' });
  ok(
    (await panel.isVisible()) &&
      (await page.evaluate(() => document.activeElement?.classList.contains('aim-pill'))),
    'Échap ferme le menu, focus sur la pilule (le panneau reste ouvert)',
  );
  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})();
