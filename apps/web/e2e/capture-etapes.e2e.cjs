/**
 * EXT-02 §8 : « Capturer de nouvelles étapes » depuis l'éditeur (extension 0.3.0).
 *  - menu « Ajouter une étape » : l'entrée n'est plus « Bientôt » ; menu ⋯ d'une étape : « Capturer après
 *    cette étape » préremplit l'étape d'insertion ;
 *  - fenêtre (MODAL-01) : « Insérer après » (« Au début » en premier), type de capture (HTML en « Bientôt »),
 *    page de départ reprise de l'étape, état de l'extension (détectée, requise, « Vérifier à nouveau »),
 *    « Importer des images à cet endroit », erreurs de l'extension en role=alert ;
 *  - message à l'extension : schéma strict, aucun jeton ;
 *  - pendant la capture : bandeau role=status, « Revenir à la capture », « Annuler l'ajout », repère
 *    dans la liste ; l'insertion suit l'étape par son identifiant ;
 *  - après l'envoi : étapes insérées après l'étape choisie, toast avec « Annuler », pastille « Nouveau ».
 * Extension simulée (chrome.runtime), faux Supabase, données fictives.
 * Usage : node e2e/capture-etapes.e2e.cjs (THEME=dark, WIDTH=390)
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const THEME = process.env.THEME === 'dark' ? 'dark' : 'light';
const WIDTH = Number(process.env.WIDTH) || 1440;
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const EXT = 'abcdefghijklmnopabcdefghijklmnop';

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};

/** Extension simulée : répond selon window.__ext (version, état de l'ajout, erreur au démarrage). */
function fakeExtension(version) {
  window.__sent = [];
  window.__ext = {
    version,
    add: { ok: true, started: true },
    status: { state: 'none', steps: 0, stepIds: [] },
  };
  window.chrome = {
    runtime: {
      sendMessage: (id, msg, cb) => {
        window.__sent.push({ id, msg });
        const e = window.__ext;
        let r = { ok: false, error: 'schema' };
        if (msg.type === 'fd:ping') r = e.version ? { ok: true, version: e.version } : null;
        if (msg.type === 'fd:add-steps') {
          r = e.add;
          if (r.ok) e.status = { state: 'recording', steps: 0, stepIds: [] };
        }
        if (msg.type === 'fd:add-status') r = { ok: true, ...e.status };
        if (msg.type === 'fd:add-focus') r = { ok: true };
        if (msg.type === 'fd:add-clear') {
          e.status = { state: 'none', steps: 0, stepIds: [] };
          r = { ok: true };
        }
        setTimeout(() => cb(r), 0);
      },
    },
  };
}

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const sfx = `${THEME === 'dark' ? '-sombre' : '-clair'}-${WIDTH}`;
  const open = async (data, version) => {
    const ctx = await b.newContext({
      viewport: { width: WIDTH, height: 900 },
      locale: 'fr-FR',
      colorScheme: THEME,
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript((t) => localStorage.setItem('fd.theme', t), THEME);
    await page.addInitScript(fakeExtension, version);
    await install(page, data);
    await page.goto(`${APP}/#/demos/${DEMO}/edit`);
    await page.locator('.rail-list .step').first().waitFor();
    return { page, ctx };
  };
  const sent = (page, type) => page.evaluate((t) => window.__sent.filter((s) => s.msg.type === t), type);
  /** À 390 px la liste des étapes est repliée derrière son bouton : on l'ouvre au besoin. */
  const addMenu = async (page) => {
    const btn = page.getByRole('button', { name: 'Ajouter une étape' }).first();
    await btn.click();
    return page.getByRole('menuitem', { name: 'Capturer de nouvelles étapes' });
  };

  // ===== Extension absente =====
  {
    const { page, ctx } = await open(seed(), null);
    const item = await addMenu(page);
    ok(
      (await item.getAttribute('aria-disabled')) !== 'true' && !/Bientôt/.test(await item.innerText()),
      'menu « Ajouter une étape » : « Capturer de nouvelles étapes » disponible, sans « Bientôt »',
    );
    await item.click();
    const dlg = page.getByRole('dialog', { name: /Capturer de nouvelles étapes/ });
    await dlg.waitFor();
    await dlg.getByText('Extension TutoClick 0.3.0 requise').waitFor();
    const start = dlg.getByRole('button', { name: 'Ouvrir et capturer' });
    ok(
      (await start.getAttribute('aria-disabled')) === 'true' &&
        (await dlg.getByText('Elle n’est pas installée dans ce navigateur.').count()) === 1 &&
        (await dlg.getByRole('link', { name: /Installer l’extension/ }).count()) === 1,
      'extension absente : encart « Extension TutoClick 0.3.0 requise », « Installer l’extension », bouton principal désactivé',
    );
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/ajout-absente${sfx}.png` });
    // Trop ancienne, puis « Vérifier à nouveau » après la mise à jour
    await page.evaluate(() => (window.__ext.version = '0.2.0'));
    await dlg.getByRole('button', { name: 'Vérifier à nouveau' }).click();
    await dlg.getByText('La version 0.2.0 est installée : mettez-la à jour.').waitFor();
    ok(
      (await start.getAttribute('aria-disabled')) === 'true',
      'extension 0.2.0 : dite trop ancienne, bouton désactivé',
    );
    await page.evaluate(() => (window.__ext.version = '0.3.0'));
    await dlg.getByRole('button', { name: 'Vérifier à nouveau' }).click();
    await dlg.getByText('Extension TutoClick 0.3.0 détectée.').waitFor();
    ok(
      (await start.getAttribute('aria-disabled')) === null,
      '« Vérifier à nouveau » : extension détectée, bouton actif',
    );
    await ctx.close();
  }

  // ===== Fenêtre, envoi, bandeau, insertion =====
  const data = seed();
  const { page, ctx } = await open(data, '0.3.0');
  // Menu ⋯ de l'étape 1 : « Capturer après cette étape »
  await page.getByRole('button', { name: 'Actions de l’étape 1' }).click();
  await page.getByRole('menuitem', { name: 'Capturer après cette étape' }).click();
  const dlg = page.getByRole('dialog', { name: /Capturer de nouvelles étapes/ });
  await dlg.waitFor();
  await dlg.getByText('Extension TutoClick 0.3.0 détectée.').waitFor();
  const after = dlg.getByRole('combobox', { name: 'Insérer après' });
  ok(
    /^1 · Écran 1/.test((await after.innerText()).trim()),
    `« Insérer après » prérempli (${(await after.innerText()).trim()})`,
  );
  await after.click();
  const opts = await page.getByRole('option').allInnerTexts();
  ok(
    opts[0].trim() === 'Au début' && opts.length === 4 && /^1 · Écran 1/.test(opts[1].trim()),
    `liste des étapes, « Au début » en premier (${opts.map((o) => o.trim()).join(' | ')})`,
  );
  await page.keyboard.press('Escape');
  const url = dlg.getByRole('textbox', { name: 'Page de départ' });
  ok(
    (await url.inputValue()) === 'https://app.example.com/' &&
      /Reprise de l’étape 1\./.test(await dlg.locator('.cm-help').last().innerText()),
    'page de départ reprise de l’étape d’insertion',
  );
  const types = dlg.getByRole('radiogroup', { name: 'Type de capture' });
  ok(
    (await types.getByRole('radio', { name: 'Captures d’écran' }).getAttribute('aria-checked')) === 'true' &&
      (await types.getByRole('radio', { name: /HTML/ }).getAttribute('aria-disabled')) === 'true' &&
      /Bientôt/.test(await types.getByRole('radio', { name: /HTML/ }).innerText()),
    'type : « Captures d’écran » choisi ; « HTML » grisé, visible, « Bientôt »',
  );
  ok(
    (await dlg.getByRole('button', { name: 'Importer des images à cet endroit' }).count()) === 1 &&
      (await dlg.locator('.fd-btn--primary').count()) === 1 &&
      (await dlg.locator('select, input[type=checkbox], input[type=radio]').count()) === 0,
    '« Importer des images à cet endroit », un seul bouton primaire, aucun contrôle natif',
  );
  {
    const r = await new AxeBuilder({ page })
      .include('dialog[open]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    ok(bad.length === 0, `axe fenêtre : ${bad.map((v) => v.id).join(', ') || '0 violation grave'}`);
  }
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/ajout-fenetre${sfx}.png` });
  // Page de départ obligatoire et valide
  const start = dlg.getByRole('button', { name: 'Ouvrir et capturer' });
  await url.fill('');
  await start.click();
  ok(
    (await dlg.getByText('Indiquez la page de départ.').count()) === 1 &&
      (await url.getAttribute('aria-invalid')) === 'true' &&
      (await url.evaluate((el) => el === document.activeElement)) &&
      (await sent(page, 'fd:add-steps')).length === 0,
    'page de départ vide : erreur sous le champ, focus rendu, rien n’est envoyé',
  );
  await url.fill('ftp://exemple');
  await start.click();
  ok((await dlg.getByText(/^Adresse invalide\./).count()) === 1, 'adresse invalide refusée');
  // Erreur renvoyée par l'extension
  await url.fill('https://crm.acme.example/opportunites/nouvelle');
  await page.evaluate(() => (window.__ext.add = { ok: false, error: 'busy' }));
  await start.click();
  const alert = dlg.getByRole('alert');
  await alert.waitFor();
  ok(
    /Une capture est déjà en cours dans l’extension\. Terminez-la d’abord\./.test(await alert.innerText()),
    'erreur de l’extension (capture déjà en cours) en role=alert, dans la fenêtre',
  );
  await page.evaluate(() => (window.__ext.add = { ok: false, error: 'signed-out' }));
  await start.click();
  await dlg.getByText('Connectez-vous à TutoClick dans l’extension.').waitFor();
  ok(true, 'erreur de l’extension (non connectée)');
  // Envoi : message au schéma strict, sans jeton
  await page.evaluate(() => {
    window.__ext.add = { ok: true, started: true };
    window.__sent = [];
  });
  await start.click();
  await dlg.waitFor({ state: 'hidden' });
  const add = (await sent(page, 'fd:add-steps'))[0];
  ok(
    add &&
      add.id === EXT &&
      Object.keys(add.msg).sort().join() === 'afterStepId,demoId,type,url,v,workspaceId' &&
      add.msg.v === 1 &&
      add.msg.demoId === DEMO &&
      add.msg.afterStepId === 's1' &&
      add.msg.url === 'https://crm.acme.example/opportunites/nouvelle',
    `message à l’extension : cible et page de départ seulement (${add && Object.keys(add.msg).sort().join()})`,
  );

  // ===== Pendant la capture =====
  const banner = page.locator('.cm-banner');
  await banner.waitFor();
  ok(
    (await banner.getAttribute('role')) === 'status' &&
      /Capture en cours dans un autre onglet\. Les étapes arriveront après l’étape 1 · Écran 1\./.test(
        (await banner.innerText()).replace(/\s+/g, ' '),
      ),
    'bandeau role=status : « Capture en cours dans un autre onglet. Les étapes arriveront après l’étape 1 · Écran 1. »',
  );
  const marker = page.locator('.cm-marker');
  ok(
    (await marker.count()) === 1 &&
      /Les nouvelles étapes arriveront après l’étape 1/.test(await marker.locator('.sr-only').innerText()) &&
      (await marker.evaluate((el) => el.previousElementSibling?.querySelector('.n')?.textContent)) === '1',
    'repère pointillé après l’étape d’insertion, annoncé',
  );
  // La fenêtre finit sa sortie (160 ms) avant la capture d'écran
  await page.waitForFunction(() => !document.querySelector('.cm-dialog .fd-modal__box'));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/ajout-en-cours${sfx}.png` });
  await banner.getByRole('button', { name: 'Revenir à la capture' }).click();
  ok(
    (await sent(page, 'fd:add-focus')).length === 1,
    '« Revenir à la capture » active l’onglet de la capture',
  );
  // L'éditeur reste utilisable ; l'insertion suit l'étape par son identifiant, pas par son numéro
  await page.locator('.rail-list .step').nth(1).focus();
  await page.keyboard.press('Alt+ArrowUp');
  await page.waitForFunction(() =>
    /Les étapes arriveront après l’étape 2 · Écran 1\./.test(
      document.querySelector('.cm-banner')?.textContent ?? '',
    ),
  );
  ok(true, 'étape d’insertion déplacée : le bandeau suit (« après l’étape 2 · Écran 1 »)');

  // ===== Après l'envoi : l'extension a créé deux étapes en fin de démo =====
  const base = data.tables.steps.find((s) => s.id === 's1');
  for (const [i, id] of ['n1', 'n2'].entries())
    data.tables.steps.push({
      ...base,
      id,
      position: 10 + i,
      title: `Nouvelle capture ${i + 1}`,
      page_url: 'https://crm.acme.example/opportunites/nouvelle',
      options: i === 0 ? { crop: { x: 0.2, y: 0.2, w: 0.5, h: 0.5 } } : {},
    });
  await page.evaluate(() => (window.__ext.status = { state: 'sent', steps: 2, stepIds: ['n1', 'n2'] }));
  const toast = page.getByText('2 étapes ajoutées après l’étape 2');
  await toast.waitFor({ timeout: 10000 });
  const titles = await page.locator('.rail-list .step .meta b').allInnerTexts();
  ok(
    titles.join(' | ') === 'Écran 2 | Écran 1 | Nouvelle capture 1 | Nouvelle capture 2 | Merci !',
    `étapes insérées après l’étape choisie (${titles.join(' | ')})`,
  );
  ok(
    (await page.locator('.rail-new').count()) === 2 &&
      (await page.locator('.rail-list .step[aria-current]').locator('.meta b').innerText()) ===
        'Nouvelle capture 1',
    'pastille « Nouveau » sur les deux étapes, la première est sélectionnée',
  );
  ok(
    (await banner.count()) === 0 &&
      (await marker.count()) === 0 &&
      (await sent(page, 'fd:add-clear')).length === 1,
    'bandeau et repère retirés, la cible est effacée dans l’extension',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/ajout-fini${sfx}.png` });
  // Première ouverture d'une étape ajoutée : sa pastille disparaît
  await page.locator('.rail-list .step').nth(3).click();
  await page.waitForFunction(() => document.querySelectorAll('.rail-new').length === 1);
  ok(true, 'pastille « Nouveau » retirée à la première ouverture');
  // « Annuler » du toast retire les étapes insérées
  await page.getByRole('button', { name: 'Annuler', exact: true }).last().click();
  await page.waitForFunction(() => document.querySelectorAll('.rail-list .step').length === 3);
  ok(
    !data.tables.steps.some((s) => s.id === 'n1' || s.id === 'n2'),
    '« Annuler » du toast : les étapes insérées sont retirées',
  );

  // ===== « Annuler l'ajout » =====
  await (await addMenu(page)).click();
  await dlg.waitFor();
  await dlg.getByText('Extension TutoClick 0.3.0 détectée.').waitFor();
  await dlg.getByRole('combobox', { name: 'Insérer après' }).click();
  await page.getByRole('option', { name: 'Au début' }).click();
  await url.fill('https://crm.acme.example/');
  await start.click();
  await banner.waitFor();
  ok(
    /Les étapes arriveront au début de la démo\./.test(await banner.innerText()) &&
      (await page.locator('.rail-list > :first-child').getAttribute('class')).includes('cm-marker'),
    '« Au début » : bandeau et repère en tête de liste',
  );
  await page.evaluate(() => (window.__sent = []));
  await banner.getByRole('button', { name: 'Annuler l’ajout' }).click();
  await banner.waitFor({ state: 'detached' });
  ok((await sent(page, 'fd:add-clear')).length === 1, '« Annuler l’ajout » : bandeau retiré, cible effacée');
  ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    'pas de défilement horizontal',
  );
  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await ctx.close();
  await b.close();
})();
