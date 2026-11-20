/**
 * L46 : variables lisibles. Données fictives (faux backend).
 *  - Champ riche : pastilles avec libellé (jamais la clé), gras mis en forme (jamais **), repli visible.
 *  - « + Variable » : catalogue groupé, recherche, Entrée insère ; « { » ouvre le catalogue, Échap le
 *    ferme en laissant le « { ».
 *  - Retour arrière : pastille sélectionnée puis supprimée (deux appuis).
 *  - Réglage d'une pastille : repli modifié, stocké {{clé|repli}}.
 *  - Canevas : exemples (« Camille ») ou valeurs de repli, jamais de {{…}}.
 *  - Paramètres > Variables : création (clé tirée du libellé), tableau sans clé technique.
 * Usage : node e2e/variables.e2e.cjs (THEME=dark et SHOTS_DIR pour les captures)
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const state = seed();
  const h1 = state.tables.hotspots.find((h) => h.id === 'h1');
  h1.body = 'Bienvenue {{first_name|vous}} dans **Pipeline** !';
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => localStorage.removeItem('fd.vars.help.seen'));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await install(p, state);
  await p.goto(`${APP}/#/demos/${DEMO}/edit`);
  await p
    .getByRole('button', { name: /^Hotspot 1/ })
    .first()
    .click();
  const body = p.locator('#hs-body');
  await body.waitFor();
  await p.waitForTimeout(400);

  // Champ riche
  const txt = await body.innerText();
  ok(!/\{\{|\}\}|\*\*/.test(txt), `champ : ni {{ }} ni ** visibles (« ${txt.trim()} »)`);
  const chip = body.locator('.var-chip').first();
  ok(
    (await chip.innerText()).trim() === 'Prénom du visiteur',
    'pastille : le nom seul, sans accolades ni repli (L46-01)',
  );
  ok((await chip.getAttribute('data-tip')) === 'Si inconnu : vous', 'repli dans l’infobulle');
  ok(
    (await chip.getAttribute('aria-label')) === 'Variable : Prénom du visiteur, si inconnu : vous',
    'pastille lue « Variable : Prénom du visiteur, si inconnu : vous »',
  );
  ok((await body.locator('strong').innerText()) === 'Pipeline', 'gras mis en forme');

  // Canevas : exemples, puis valeurs de repli
  const tip = p.locator('.canvas-tip .p-rich');
  ok(/Bienvenue Camille dans/.test(await tip.innerText()), 'canevas : « Bienvenue Camille » (exemple)');
  ok(!/\{\{/.test(await p.locator('.canvas-frame').innerText()), 'canevas : jamais de {{…}}');
  await p.getByRole('radio', { name: 'Valeurs de repli' }).click();
  ok(/Bienvenue vous dans/.test(await tip.innerText()), 'canevas : « Valeurs de repli » → « vous »');
  await p.getByRole('radio', { name: 'Exemples' }).click();
  if (SHOTS) await p.locator('.panel').screenshot({ path: `${SHOTS}/l46-champ${sfx}.png` });

  // « + Variable » : catalogue, aide au premier usage, recherche, insertion
  await body.focus();
  await p.keyboard.press('Control+End');
  await p
    .locator('.var-rte')
    .filter({ has: body })
    .getByRole('button', { name: 'Insérer une variable' })
    .click();
  const cat = p.getByRole('dialog', { name: 'Variables' });
  await cat.waitFor();
  ok((await cat.getByRole('note').count()) === 1, 'aide au premier usage');
  ok(
    (await cat.locator('.var-cat__group').allInnerTexts())
      .join('|')
      .startsWith('Visiteur|Entreprise|Démo|Date'),
    'groupes dans l’ordre : Visiteur, Entreprise, Démo, Date',
  );
  ok(!(await cat.innerText()).includes('first_name'), 'catalogue : aucune clé technique');
  ok(
    (await cat.getByRole('option', { name: /E-mail du visiteur/ }).count()) === 0,
    'e-mail du visiteur absent d’une bulle',
  );
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/l46-catalogue${sfx}.png` });
  await p.keyboard.type('entrepr');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(1200);
  ok(/\{\{company\|votre structure\}\}/.test(h1.body), `insertion : ${h1.body}`);
  ok((await body.locator('.var-chip').count()) === 2, 'deux pastilles dans le champ');

  // « { » : ouvre le catalogue ; Échap le ferme en laissant le «  {  »
  await body.focus();
  await p.keyboard.press('Control+End');
  await p.keyboard.type(' {');
  await cat.waitFor();
  await p.keyboard.press('Escape');
  await p.waitForTimeout(1200);
  ok((await cat.count()) === 0 && h1.body.endsWith('{'), '« { » ouvre le catalogue ; Échap laisse le {');
  await p.keyboard.press('Backspace');
  await p.keyboard.press('Backspace');
  await p.waitForTimeout(200);

  // Retour arrière en deux appuis
  const before = await body.locator('.var-chip').count();
  await body.focus();
  await p.keyboard.press('Control+End');
  // Fin du texte : « … ! {{company}} » ; on retire l'espace d'insertion, puis la pastille
  await p.keyboard.press('Backspace');
  await p.keyboard.press('Backspace');
  ok(
    (await body.locator('.var-chip.is-selected').count()) === 1 &&
      (await body.locator('.var-chip').count()) === before,
    'premier appui : pastille sélectionnée',
  );
  await p.keyboard.press('Backspace');
  ok((await body.locator('.var-chip').count()) === before - 1, 'second appui : pastille supprimée');

  // Réglage du repli
  await body.locator('.var-chip').first().click();
  const set = p.getByRole('dialog', { name: 'Réglage de la variable' });
  await set.waitFor();
  await set.getByLabel('Si inconnu, afficher').fill('à vous');
  await set.getByRole('button', { name: 'Appliquer' }).click();
  await p.waitForTimeout(1200);
  ok(/\{\{first_name\|à vous\}\}/.test(h1.body), 'repli réglé sur la pastille : {{first_name|à vous}}');
  ok(
    (await body.locator('.var-chip').first().getAttribute('data-tip')) === 'Si inconnu : à vous',
    'repli dans l’infobulle de la pastille',
  );
  ok(
    (await new AxeBuilder({ page: p }).include('.panel').withTags(TAGS).analyze()).violations.length === 0,
    'axe : panneau sans violation',
  );

  // Paramètres > Variables : création
  await p.goto(`${APP}/#/settings/variables`);
  await p.getByRole('button', { name: 'Nouvelle variable' }).click();
  const dr = p.getByRole('dialog', { name: 'Nouvelle variable' });
  await dr.getByLabel(/^Nom/).fill('Nom du logiciel');
  await dr.getByLabel(/^Description/).fill('Le logiciel métier présenté.');
  await dr.getByLabel(/^Exemple/).fill('GestPro');
  await dr.getByLabel(/^Si inconnu/).fill('le logiciel');
  await dr.getByRole('button', { name: 'Créer la variable' }).click();
  await dr.waitFor({ state: 'detached' });
  const row = state.tables.variables.find((v) => v.label === 'Nom du logiciel');
  ok(row?.key === 'nom_du_logiciel' && row.example === 'GestPro', `clé tirée du libellé (${row?.key})`);
  await p.waitForTimeout(500);
  const table = await p.locator('.st-vars-table').innerText();
  if (process.env.DBG) console.log(table);
  ok(
    /Nom du logiciel/.test(table) &&
      /Le logiciel métier présenté/.test(table) &&
      !/nom_du_logiciel/.test(table),
    'tableau : nom et description, sans clé technique',
  );
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/l46-parametres${sfx}.png` });
  ok(
    (await new AxeBuilder({ page: p }).include('.st-vars').withTags(TAGS).analyze()).violations.length === 0,
    'axe : Paramètres > Variables',
  );

  ok(errors.length === 0, `aucune erreur JavaScript (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.log(`NOT OK - ${e.message.split('\n')[0]}`);
  process.exit(1);
});
