/**
 * L29-01 / L29-02 : snippets d'intégration (Partager > Intégrer, Diffuser > Intranet). « Où intégrer ? »
 * (HTML, WordPress, SharePoint, Moodle, Notion, Confluence), consignes numérotées, limite, pop-up désactivé pour les
 * outils sans script, adresse personnalisée reprise, choix mémorisé. Données fictives.
 * Usage : SHOTS_DIR=… [THEME=dark] node e2e/snippets.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { seedExport } = require('./export-data.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const sp = (s) => (s || '').replace(/[  ]/g, ' ');

(async () => {
  const b = await chromium.launch({
    args: ['--lang=fr-FR'],
    env: { ...process.env, LANG: 'fr_FR.UTF-8', LANGUAGE: 'fr_FR:fr', LC_ALL: 'fr_FR.UTF-8' },
  });
  const ctx = await themedContext(b, {
    viewport: { width: 1440, height: 1000 },
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const state = seed();
  seedExport(state, { steps: 3, published: true });
  const t = state.tables;
  t.diffusions = [];
  const d = t.demos.find((x) => x.id === DEMO);
  const v = t.demo_versions.find((x) => x.id === d.current_version_id);
  d.updated_at = v.published_at;
  const body = Buffer.from(JSON.stringify(v.manifest));
  state.storage[`published/${DEMO}/latest.json`] = { data: body, type: 'application/json' };
  t.demo_addresses.push({
    address: 'prise-en-main-Ab3dE9',
    demo_id: DEMO,
    workspace_id: d.workspace_id,
    created_at: '2026-11-19T10:00:00Z',
    retired_at: null,
  });
  await install(page, state);
  await page.goto(`${APP}/#/demos/${DEMO}/share`);
  await page.locator('.shd-nav').getByRole('button', { name: 'Intégrer', exact: true }).click();
  const panel = page.locator('#sh-panel-embed');
  const where = panel.getByRole('radiogroup', { name: 'Où intégrer ?' });
  // §1.3 : l'outil cible est un réglage rare, en ligne repliable (repliée tant que l'outil est HTML)
  const tool = panel.getByRole('button', { name: 'Adapter à un outil', exact: true });
  ok((await tool.getAttribute('aria-expanded')) === 'false', '« Adapter à un outil » repliée par défaut');
  await tool.click();
  await where.waitFor();
  const names = await where.getByRole('radio').allInnerTexts();
  ok(
    names.join() === 'HTML,WordPress,SharePoint,Moodle,Notion,Confluence',
    `six outils dans l’ordre (${names.join()})`,
  );
  ok(
    (await where.getByRole('radio', { name: 'HTML' }).getAttribute('aria-checked')) === 'true',
    'HTML par défaut',
  );
  ok((await panel.getByText(/Guides/).count()) === 0, 'le lien « Guides » (Bientôt) est remplacé');
  ok(
    /#\/l\/prise-en-main-Ab3dE9/.test(await panel.locator('pre').innerText()),
    'code : adresse personnalisée (L28)',
  );
  ok(
    sp(await panel.locator('ol').innerText()).trim() === 'Collez le code à l’endroit voulu de la page.',
    'HTML : une consigne',
  );

  // Pop-up : code bouton + script
  await panel.getByRole('radio', { name: 'Bouton qui ouvre la démo' }).click();
  ok(/popup\.js/.test(await panel.locator('pre').innerText()), 'mode pop-up : bouton + script');

  // WordPress : 3 consignes, limite
  await where.getByRole('radio', { name: 'WordPress' }).click();
  ok((await panel.locator('ol > li').count()) === 3, 'WordPress : 3 consignes');
  ok(/thème qui autorise les scripts/.test(await panel.innerText()), 'WordPress : limite affichée');
  if (SHOTS) {
    await page.mouse.move(0, 0);
    await panel.screenshot({ path: `${SHOTS}/l29-02-popup${sfx}.png` });
  }

  // SharePoint : adresse seule, pop-up visible mais désactivé, limite en aide
  await where.getByRole('radio', { name: 'SharePoint' }).click();
  const pop = panel.getByRole('radio', { name: 'Bouton qui ouvre la démo' });
  ok((await pop.getAttribute('aria-disabled')) === 'true', 'SharePoint : pop-up visible et désactivé');
  const desc = await pop.getAttribute('aria-describedby');
  ok(
    !!desc && /administrateur SharePoint/.test(await page.locator(`[id="${desc}"]`).innerText()),
    'pop-up désactivé : la limite sert d’aide',
  );
  const pre = (await panel.locator('pre').innerText()).trim();
  ok(/^https:\/\/\S+#\/l\/prise-en-main-Ab3dE9$/.test(pre), `SharePoint : adresse seule (${pre})`);
  await panel.getByRole('button', { name: 'Copier l’adresse' }).click();
  // Confirmation sur place : le bouton passe à « Copié », aucun toast
  await panel.getByRole('button', { name: 'Copié', exact: true }).waitFor();
  ok((await page.locator('.toast').count()) === 0, 'copie : confirmation sur place, pas de toast');
  ok((await page.evaluate(() => navigator.clipboard.readText())).trim() === pre, 'adresse copiée');
  if (SHOTS) {
    await page.mouse.move(0, 0);
    await page.waitForTimeout(3500);
    await panel.screenshot({ path: `${SHOTS}/l29-01-sharepoint${sfx}.png` });
  }

  // Moodle : iframe et renvoi vers le SCORM ; Notion : adresse seule
  await where.getByRole('radio', { name: 'Moodle' }).click();
  await panel.getByRole('radio', { name: 'Encadré dans la page' }).click();
  ok(
    /<iframe/.test(await panel.locator('pre').innerText()) && /paquet SCORM/.test(await panel.innerText()),
    'Moodle : iframe, limite SCORM',
  );
  await where.getByRole('radio', { name: 'Confluence' }).focus();
  await page.keyboard.press('ArrowRight');
  ok(
    (await where.getByRole('radio', { name: 'HTML' }).getAttribute('aria-checked')) === 'true',
    'flèches : Confluence → HTML (boucle)',
  );
  // L35 (142) : Confluence, adresse seule pour la macro Iframe, consignes et limite
  await where.getByRole('radio', { name: 'Confluence' }).click();
  const conf = await panel.innerText();
  ok(
    /\/iframe/.test(conf) && /macro Iframe/.test(conf) && /Data Center/.test(conf),
    'Confluence : consignes (macro Iframe) et limite (Data Center, hauteur)',
  );
  ok(
    /^https:\/\/\S+#\/l\/prise-en-main-Ab3dE9$/.test(await panel.locator('pre').innerText()),
    'Confluence : adresse seule',
  );
  await where.getByRole('radio', { name: 'Notion' }).click();
  await panel.getByRole('button', { name: 'Copier l’adresse' }).waitFor();
  ok(true, 'Notion : « Copier l’adresse »');

  // Choix mémorisé
  await page.reload();
  await page.locator('.shd-nav').getByRole('button', { name: 'Intégrer', exact: true }).click();
  await panel.getByRole('radiogroup', { name: 'Où intégrer ?' }).waitFor();
  ok(
    (await panel.getByRole('radio', { name: 'Notion' }).getAttribute('aria-checked')) === 'true',
    'choix mémorisé (Notion)',
  );

  // Diffuser > Intranet : même sélecteur, pop-up désactivé pour Notion
  await page.goto(`${APP}/#/demos/${DEMO}/distribute`);
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('tab', { name: /Intranet/ }).click();
  const w2 = dlg.getByRole('radiogroup', { name: 'Où intégrer ?' });
  await w2.waitFor();
  ok(
    (await dlg
      .getByRole('radio', { name: /Bouton \+ pop-up|Pop-up/ })
      .first()
      .getAttribute('aria-disabled')) === 'true',
    'Diffuser > Intranet : pop-up désactivé pour Notion',
  );
  await w2.getByRole('radio', { name: 'HTML' }).click();
  ok(
    /#\/l\/prise-en-main-Ab3dE9/.test(await dlg.locator('pre').innerText()),
    'Intranet : adresse personnalisée',
  );

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
