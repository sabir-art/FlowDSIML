/** L22-09 : règles de suite du menu de choix (une seule source, destinations recalculées, contrôles). */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const BASE = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ok = (cond, label) => {
    console.log(`${cond ? 'ok' : 'NOT OK'} - ${label}`);
    if (!cond) process.exitCode = 1;
  };
  const state = seed();
  // Étape 3 : menu F1 sans règles enregistrées ; « A » revient à l'étape 1, « B » vise une étape supprimée
  const s3 = state.tables.steps.find((s) => s.id === 's3');
  s3.options = {
    display: 'popup',
    choices: [
      { label: 'A', action: { type: 'goto', stepId: 's1' } },
      { label: 'B', action: { type: 'goto', stepId: 'etape-supprimee' } },
    ],
  };
  await install(page, state);
  const opts = () => state.tables.steps.find((s) => s.id === 's3').options;

  await page.goto(`${BASE}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');
  ok(
    (await page.locator('.rail-list .icons [aria-label="2 règles"]').count()) === 1,
    'L22-09 : badge « 2 règles » sur le rail',
  );

  // Rappel dans la modale de publication (non bloquant)
  await page.getByRole('button', { name: 'Publier', exact: true }).click();
  const dlg = page.getByRole('dialog');
  await dlg.first().waitFor();
  const text = await dlg.first().textContent();
  ok(
    /Branchements à vérifier/.test(text) && /étape supprimée/.test(text) && /boucle sans sortie/.test(text),
    'L22-09 : la modale de publication rappelle les avertissements',
  );
  await page.keyboard.press('Escape');

  await page.locator('.rail-li').nth(2).locator('button.step').click();
  await page.getByRole('tab', { name: 'Étape' }).click();
  const answers = page.getByLabel('Réponses (une par ligne, 6 au plus)');
  await answers.waitFor();
  ok((await answers.inputValue()) === 'A\nB', 'L22-09 : réponses une par ligne');
  const dest2 = page.getByLabel('Destination de la règle 2');
  ok(
    (await dest2.getAttribute('aria-invalid')) === 'true' &&
      (await dest2.locator('option:checked').textContent()) === 'Étape supprimée',
    'L22-09 : règle vers une étape supprimée en erreur',
  );
  ok(
    /Boucle sans sortie/.test(
      await page
        .locator('.panel [role="status"]')
        .allTextContents()
        .then((x) => x.join(' ')),
    ),
    'L22-09 : boucle sans sortie signalée',
  );
  const elseSel = page.getByLabel('Destination par défaut');
  ok(
    (await elseSel.locator('option:checked').textContent()) === 'Étape suivante (fin de la démo)',
    'L22-09 : « Sinon » sur « Étape suivante » par défaut',
  );
  if (SHOTS) {
    // Fait défiler le panneau seul (pas la fenêtre) jusqu'aux règles
    await page.evaluate(() => {
      const sec = document.getElementById('gc-answers-s3')?.closest('section');
      let el = sec?.parentElement;
      while (el && el.scrollHeight <= el.clientHeight) el = el.parentElement;
      if (sec && el) el.scrollTop += sec.getBoundingClientRect().top - el.getBoundingClientRect().top - 8;
      window.scrollTo(0, 0);
    });
    await page.screenshot({ path: `${SHOTS}/l22-09-regles.png` });
  }

  // Une 3e réponse sans règle suit « Sinon » ; les règles suivent leur réponse
  await answers.fill('A\nB\nC');
  await page.waitForTimeout(900);
  ok(
    JSON.stringify(opts().choices.map((c) => c.action.type)) === JSON.stringify(['goto', 'goto', 'next']) &&
      JSON.stringify(opts().branch) === JSON.stringify({ rules: [0, 1], else: { type: 'next' } }),
    'L22-09 : destinations recalculées pour le lecteur (règles enregistrées à part)',
  );
  ok((await page.getByText(/Boucle sans sortie/).count()) === 0, 'L22-09 : la boucle a maintenant une issue');

  // Corriger la règle 2 ; une règle par réponse
  await dest2.selectOption({ label: '2 · Écran 2' });
  await page.waitForTimeout(900);
  ok(
    opts().choices[1].action.stepId === 's2' && (await dest2.getAttribute('aria-invalid')) === null,
    'L22-09 : destination corrigée',
  );
  await page.getByRole('button', { name: 'Ajouter une règle' }).click();
  await page.waitForTimeout(900);
  ok(
    (await page.getByLabel('Réponse de la règle 3').inputValue()) === '2' &&
      opts().choices[2].action.type === 'end',
    'L22-09 : nouvelle règle sur la première réponse libre',
  );
  ok(
    (await page.getByRole('button', { name: 'Ajouter une règle' }).count()) === 0,
    'L22-09 : une règle par réponse au plus',
  );
  ok(
    await page.getByLabel('Réponse de la règle 3').locator('option[value="0"]').isDisabled(),
    'L22-09 : réponse déjà prise grisée',
  );
  await page.getByRole('button', { name: 'Supprimer la règle 3' }).click();
  await elseSel.selectOption({ label: 'Fin de la démo' });
  await page.waitForTimeout(900);
  ok(
    opts().choices[2].action.type === 'end' && opts().branch.else.type === 'end',
    'L22-09 : « Sinon » modifié',
  );

  ok(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
