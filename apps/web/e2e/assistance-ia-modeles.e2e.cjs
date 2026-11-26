/**
 * L41 étape 5 (spec UX §5) : Paramètres › Assistance IA, « Modèles proposés dans l'assistant ».
 *  - seulement les modèles cochés dans la Console, dans leur ordre ; Auto en tête, coché, désactivé,
 *    « Toujours proposé » ; étiquette et aide de chaque modèle ; les deux phrases d'aide ;
 *  - propriétaire : retirer un modèle (enregistré, toast) ; décocher le dernier : refusé, « Gardez au moins
 *    un modèle coché. » ; un modèle que TutoClick propose ensuite arrive décoché ;
 *  - le menu de l'assistant de l'éditeur suit l'espace ; un modèle retiré est refusé par le serveur ;
 *  - plus aucun modèle de l'espace dans la Console : Auto seul, et il répond ;
 *  - admin : lecture seule, « Réservé aux propriétaires » ; éditeur : section absente ;
 *  - axe ; 390 px sans défilement horizontal.
 * Faux Supabase, aucun appel au fournisseur. Usage : [THEME=dark] [SHOTS_DIR=…] node e2e/assistance-ia-modeles.e2e.cjs
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed, HOST } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};

const aiOn = () => ({
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
});

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const open = async (state, width = 1440) => {
    const ctx = await themedContext(b, { viewport: { width, height: 900 }, locale: 'fr-FR' });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await install(p, state);
    return { ctx, p };
  };
  const axe = async (p, label) => {
    const bad = (
      await new AxeBuilder({ page: p }).include('.ai-models').withTags(['wcag2a', 'wcag2aa']).analyze()
    ).violations.map((v) => v.id);
    ok(bad.length === 0, `axe, ${label} (${bad.join(', ')})`);
  };
  const rows = (p) =>
    p.locator('.ai-models .stg-opt').evaluateAll((ls) =>
      ls.map((l) => {
        const i = l.querySelector('input');
        return `${l.querySelector('b').textContent.trim()}:${i.checked ? 'x' : '-'}${i.disabled ? 'd' : ''}`;
      }),
    );

  // ===== Propriétaire =====
  const s = seed();
  s.ai = aiOn();
  s.aiReply = () => ({ text: 'La démo compte 3 étapes.', changes: [] });
  const { ctx: c1, p } = await open(s);
  await p.goto(`${APP}/#/settings/ai`);
  const sec = p.locator('section.ai-models');
  await sec.getByRole('heading', { name: 'Modèles proposés dans l’assistant' }).waitFor();
  const text = (await sec.innerText()).replace(/\s+/g, ' ');
  ok(
    (await rows(p)).join(' ') === 'Auto:xd Claude Sonnet:x Claude Opus:x' &&
      text.includes('Toujours proposé') &&
      text.includes(
        'La liste est définie par TutoClick. Vous pouvez retirer des modèles pour votre espace, pas en ajouter.',
      ) &&
      text.includes(
        'Gardez au moins un modèle coché. Les nouveaux modèles ajoutés par TutoClick arrivent décochés.',
      ) &&
      text.includes('Rapide, pour la plupart des textes') &&
      !text.includes('Haiku'),
    `départ : Auto toujours proposé (désactivé), puis Sonnet et Opus cochés ; Haiku, non proposé, absent (${(await rows(p)).join(', ')})`,
  );
  ok(
    (await sec.locator('.ai-models__tag').allInnerTexts()).join('|') === 'Recommandé|Recommandé',
    'étiquette « Recommandé » de chaque modèle',
  );
  await axe(p, 'propriétaire');
  if (SHOTS) await sec.screenshot({ path: `${SHOTS}/assistance-ia-modeles${sfx}.png` });

  // Retirer Opus
  await p.locator('#ai-wm-claude-opus-5-5').uncheck();
  await p.getByText('Modèles de l’assistant enregistrés').first().waitFor();
  ok(
    JSON.stringify(s.aiWsModels) === '["claude-sonnet-5-5"]' &&
      (await rows(p)).join(' ') === 'Auto:xd Claude Sonnet:x Claude Opus:-',
    `Opus retiré : enregistré (${JSON.stringify(s.aiWsModels)}), toast`,
  );
  // Décocher le dernier : refusé
  await p.locator('#ai-wm-claude-sonnet-5-5').click();
  await p.locator('#ai-models-keep').waitFor();
  ok(
    (await p.locator('#ai-models-keep').innerText()).trim() === 'Gardez au moins un modèle coché.' &&
      (await p.locator('#ai-wm-claude-sonnet-5-5').isChecked()) &&
      (await p.locator('#ai-wm-claude-sonnet-5-5').getAttribute('aria-describedby')) === 'ai-models-keep' &&
      JSON.stringify(s.aiWsModels) === '["claude-sonnet-5-5"]',
    'décocher le dernier modèle : refusé, « Gardez au moins un modèle coché. », rattaché à la case',
  );
  const iconGap = await p.locator('#ai-models-keep').evaluate((el) => {
    const svg = el.querySelector('svg').getBoundingClientRect();
    const r = document.createRange();
    r.selectNodeContents(el);
    const text = [...r.getClientRects()].filter((x) => x.left >= svg.right - 1);
    return Math.round(Math.min(...text.map((x) => x.left)) - svg.right);
  });
  ok(iconGap === 8, `erreur : icône à 8 px du texte (${iconGap})`);
  await axe(p, 'erreur « au moins un modèle »');

  // Éditeur : le menu suit l'espace
  await p.goto(`${APP}/#/demos/${DEMO}/edit`);
  await p.waitForSelector('.canvas-frame img');
  await p.getByRole('button', { name: 'Assistant' }).click();
  await p.locator('.aim-pill').click();
  const items = (await p.locator('.aim-menu [role=menuitemradio] .aim-tx b').allInnerTexts()).map((x) =>
    x.trim(),
  );
  ok(items.join(',') === 'Auto,Claude Sonnet', `éditeur : menu Auto, Claude Sonnet (${items.join(', ')})`);
  await p.keyboard.press('Escape');
  // Même appel que l'assistant, avec un modèle que l'espace a retiré : refusé (403 MODEL)
  const refused = await p.evaluate(async (host) => {
    const r = await fetch(`${host}/functions/v1/ai`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ task: 'assistant', ws: 'x', lang: 'fr', model: 'claude-opus-5-5', input: {} }),
    });
    return { status: r.status, body: await r.json() };
  }, HOST);
  ok(
    refused.status === 403 && refused.body.error === 'MODEL',
    `modèle retiré par l’espace : refusé par le serveur (${refused.status} ${refused.body.error})`,
  );

  // TutoClick propose Haiku : il arrive décoché dans l'espace
  s.aiAssistant = [
    { model: 'claude-sonnet-5-5', position: 1, proposed: true, tag: 'recommended' },
    { model: 'claude-opus-5-5', position: 2, proposed: true, tag: 'recommended' },
    { model: 'claude-haiku-5-5', position: 3, proposed: true, tag: 'beta' },
  ];
  await p.goto(`${APP}/#/settings/ai`);
  await sec.getByRole('heading', { name: 'Modèles proposés dans l’assistant' }).waitFor();
  await p.locator('#ai-wm-claude-haiku-5-5').waitFor();
  ok(
    (await rows(p)).join(' ') === 'Auto:xd Claude Sonnet:x Claude Opus:- Claude Haiku:-' &&
      (await sec.locator('.aim-beta').innerText()).trim() === 'Bêta',
    `nouveau modèle de la Console : arrive décoché, étiquette « Bêta » (${(await rows(p)).join(', ')})`,
  );

  // La Console retire Sonnet : l'espace n'a plus aucun modèle, Auto prend le relais
  s.aiAssistant = [
    { model: 'claude-sonnet-5-5', position: 1, proposed: false, tag: 'recommended' },
    { model: 'claude-opus-5-5', position: 2, proposed: true, tag: 'recommended' },
    { model: 'claude-haiku-5-5', position: 3, proposed: true, tag: 'beta' },
  ];
  await p.goto(`${APP}/#/demos/${DEMO}/edit`);
  await p.waitForSelector('.canvas-frame img');
  await p.getByRole('button', { name: 'Assistant' }).click();
  await p.locator('.aim-pill').click();
  const only = (await p.locator('.aim-menu [role=menuitemradio] .aim-tx b').allInnerTexts()).map((x) =>
    x.trim(),
  );
  ok(
    only.join(',') === 'Auto' && (await p.locator('.aim-menu [data-more]').count()) === 0,
    `plus aucun modèle de l’espace : Auto seul (${only.join(', ')})`,
  );
  await p.keyboard.press('Escape');
  const panel = p.locator('[data-tool-panel="assistant"]');
  await panel.locator('textarea').fill('Combien d’étapes ?');
  await panel.locator('textarea').press('Enter');
  await panel.getByText('La démo compte 3 étapes.').waitFor();
  ok(true, 'Auto répond quand l’espace n’a plus de modèle');
  await c1.close();

  // ===== Espace jamais réglé : un modèle que la Console propose ensuite arrive décoché =====
  const sn = seed();
  sn.ai = aiOn();
  sn.aiReply = () => ({ text: 'La démo compte 3 étapes.', changes: [] });
  // Haiku proposé par la Console après la création de l'espace (aucune liste enregistrée)
  sn.aiAssistant = [
    { model: 'claude-sonnet-5-5', position: 1, proposed: true, tag: 'recommended' },
    { model: 'claude-opus-5-5', position: 2, proposed: true, tag: 'recommended' },
    {
      model: 'claude-haiku-5-5',
      position: 3,
      proposed: true,
      tag: 'beta',
      proposedAt: new Date().toISOString(),
    },
  ];
  const { ctx: cn, p: pn } = await open(sn);
  await pn.goto(`${APP}/#/settings/ai`);
  await pn.locator('#ai-wm-claude-haiku-5-5').waitFor();
  ok(
    sn.aiWsModels === undefined &&
      (await rows(pn)).join(' ') === 'Auto:xd Claude Sonnet:x Claude Opus:x Claude Haiku:-',
    `espace jamais réglé : le nouveau modèle de la Console arrive décoché (${(await rows(pn)).join(', ')})`,
  );
  await pn.goto(`${APP}/#/demos/${DEMO}/edit`);
  await pn.waitForSelector('.canvas-frame img');
  await pn.getByRole('button', { name: 'Assistant' }).click();
  await pn.locator('.aim-pill').click();
  const nItems = (await pn.locator('.aim-menu [role^=menuitem] .aim-tx b').allInnerTexts()).map((x) =>
    x.trim(),
  );
  ok(
    nItems.join(',') === 'Auto,Claude Sonnet,Claude Opus',
    `éditeur d’un espace jamais réglé : pas de Haiku (${nItems.join(', ')})`,
  );
  // Le propriétaire le coche : il entre dans l'espace
  await pn.keyboard.press('Escape');
  await pn.goto(`${APP}/#/settings/ai`);
  await pn.locator('#ai-wm-claude-haiku-5-5').check();
  await pn.getByText('Modèles de l’assistant enregistrés').first().waitFor();
  ok(
    JSON.stringify(sn.aiWsModels) === '["claude-sonnet-5-5","claude-opus-5-5","claude-haiku-5-5"]',
    `coché par le propriétaire : enregistré (${JSON.stringify(sn.aiWsModels)})`,
  );
  await cn.close();

  // ===== Admin : lecture seule =====
  const sa = seed();
  sa.ai = aiOn();
  sa.tables.members[0].role = 'admin';
  const { ctx: c2, p: pa } = await open(sa);
  await pa.goto(`${APP}/#/settings/ai`);
  const seca = pa.locator('section.ai-models');
  await seca.getByRole('heading', { name: 'Modèles proposés dans l’assistant' }).waitFor();
  ok(
    (await rows(pa)).join(' ') === 'Auto:xd Claude Sonnet:xd Claude Opus:xd' &&
      (await seca.locator('.stg-readonly').innerText()).trim() === 'Réservé aux propriétaires',
    `admin : cases désactivées, « Réservé aux propriétaires » (${(await rows(pa)).join(', ')})`,
  );
  await axe(pa, 'admin, lecture seule');
  await c2.close();

  // ===== Éditeur : section absente =====
  const se = seed();
  se.ai = { ...aiOn(), canManage: false };
  se.tables.members[0].role = 'editor';
  const { ctx: c3, p: pe } = await open(se);
  await pe.goto(`${APP}/#/settings/ai`);
  await pe.waitForTimeout(1500);
  ok((await pe.locator('section.ai-models').count()) === 0, 'éditeur : section absente');
  // Interrupteur activé mais désactivé (lecture seule) : piste grise, comme la case cochée désactivée
  const sw = await pe.evaluate(() => {
    const input = document.querySelector('.fd-switch input[role=switch]');
    const track = input?.nextElementSibling;
    const probe = (v) => {
      const e = document.createElement('span');
      e.style.color = `var(${v})`;
      document.body.append(e);
      const c = getComputedStyle(e).color;
      e.remove();
      return c;
    };
    return {
      checked: input?.checked,
      disabled: input?.disabled,
      track: track && getComputedStyle(track).backgroundColor,
      knob: track && getComputedStyle(track, '::after').backgroundColor,
      opacity: track && getComputedStyle(track).opacity,
      muted: probe('--fd-color-text-muted'),
      surface: probe('--fd-color-surface'),
    };
  });
  ok(
    sw.checked && sw.disabled && sw.track === sw.muted && sw.knob === sw.surface && sw.opacity === '1',
    `interrupteur activé et désactivé : piste grise, bouton couleur de surface (${JSON.stringify(sw)})`,
  );
  await c3.close();

  // ===== 390 px =====
  const sm = seed();
  sm.ai = aiOn();
  const { ctx: c4, p: pm } = await open(sm, 390);
  await pm.goto(`${APP}/#/settings/ai`);
  await pm.locator('section.ai-models h2').waitFor();
  const over = await pm.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(over <= 0, `390 px : pas de défilement horizontal (${over})`);
  if (SHOTS)
    await pm
      .locator('section.ai-models')
      .screenshot({ path: `${SHOTS}/assistance-ia-modeles-390${sfx}.png` });
  await c4.close();

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})();
