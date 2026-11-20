/**
 * Test e2e L30-03 : Traduire la démo (menu ⋯, langue cible, aperçu modifiable, terme du glossaire
 * non gardé, Créer la copie en brouillon « titre (langue) », langue de la copie ; arabe en rtl).
 * Données fictives (faux Supabase, aucun appel au fournisseur). Usage : SHOTS_DIR=… [THEME=dark] node e2e/traduire.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

(async () => {
  const b = await chromium.launch();
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const shot = async (name) => {
    for (const x of await page.locator('.toast button[aria-label]').all()) await x.click().catch(() => {});
    await page.waitForTimeout(250);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}${sfx}.png` });
  };
  const state = seed();
  state.ai = undefined;
  state.tables.glossary_terms = [
    {
      id: 'g1',
      workspace_id: state.tables.demos[0].workspace_id,
      term: 'opportunité',
      definition: 'Affaire en cours',
      forms: [],
    },
  ];
  // Traduction fictive : préfixe [EN] ; le terme du glossaire est traduit (non gardé) sur une ligne
  state.aiReply = (task, input) =>
    task === 'translate'
      ? {
          items: input.items.map((i) => ({
            id: i.id,
            text: `[${input.target}] ${i.text.replace(/opportunité/g, 'opportunity')}`,
          })),
        }
      : { text: '' };
  await install(page, state);
  // Assistance activée
  await page.goto(`${APP}/#/settings/ai`);
  await page.getByRole('switch').click();
  await page.getByLabel('J’ai lu ces informations.').check();
  await page.getByRole('dialog').getByRole('button', { name: 'Activer' }).click();
  await page.getByText('Assistance IA activée pour l’espace.').waitFor();

  const before = state.tables.demos.length;
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');
  await page.getByRole('button', { name: 'Plus d’options' }).click();
  await page.getByRole('menuitem', { name: 'Traduire la démo…' }).click();
  const dlg = page.getByRole('dialog', { name: 'Traduire la démo' });
  await dlg.waitFor();
  const opts = await dlg.getByLabel('Langue cible').locator('option').allTextContents();
  ok(
    opts.join(',') === 'Anglais,Espagnol,Allemand,Italien,Portugais,Arabe',
    `6 langues cibles (hors langue de la démo) : ${opts}`,
  );
  await shot('l30-03-choix');
  await dlg.getByRole('button', { name: 'Préparer la traduction' }).click();
  await dlg.getByRole('button', { name: 'Créer la copie' }).waitFor();
  const call = state.aiCalls.at(-1);
  ok(
    call.task === 'translate' && call.input.target === 'en' && call.lang === 'fr',
    'Demande : langue cible et langue de la démo',
  );
  ok(
    call.input.glossary.some((g) => g.term === 'opportunité'),
    'Glossaire envoyé comme consigne',
  );
  ok(!/image_path|png|data:/.test(JSON.stringify(call)), 'Aucune image envoyée');
  const n = await dlg.locator('tbody tr').count();
  ok(n === call.input.items.length && n > 3, `Tableau : une ligne par texte (${n})`);
  ok((await dlg.locator('.ai-tr-flag').count()) >= 1, 'Terme du glossaire non gardé : surligné');
  ok(
    (await dlg.getByText(/Terme du glossaire\s?: opportunité/).count()) >= 1,
    'Infobulle « Terme du glossaire »',
  );
  ok((await dlg.getByText('Généré par IA, à vérifier').count()) === 1, 'Mention de la règle 2');
  ok(state.tables.demos.length === before, 'Rien n’est créé avant « Créer la copie »');
  const first = dlg.locator('tbody textarea').first();
  await first.fill('Demo CRM, edited');
  await shot('l30-03-apercu');
  await dlg.getByRole('button', { name: 'Créer la copie' }).click();
  await page.getByText('Copie traduite créée.').waitFor();
  await page.waitForTimeout(500);
  const copy = state.tables.demos.at(-1);
  ok(state.tables.demos.length === before + 1 && copy.status === 'draft', 'Copie créée en brouillon');
  ok(copy.title === 'Demo CRM, edited (Anglais)', `Titre « titre (langue) » : ${copy.title}`);
  ok(copy.settings.locale === 'en', 'Langue de la copie : en');
  const hs = state.tables.hotspots.find((h) => h.demo_id === copy.id);
  ok(/^\[en\] /.test(hs.body), 'Bulle traduite sur la copie');
  ok(!/^\[en\]/.test(state.tables.hotspots.find((h) => h.id === 'h1').body), 'Démo d’origine inchangée');
  await page.locator('.toast').getByRole('button', { name: 'Ouvrir' }).click();
  await page.waitForURL(new RegExp(`/demos/${copy.id}/edit`));
  ok(true, 'Toast « Ouvrir » : copie ouverte');

  // Arabe : lecteur en rtl
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');
  await page.getByRole('button', { name: 'Plus d’options' }).click();
  await page.getByRole('menuitem', { name: 'Traduire la démo…' }).click();
  await dlg.getByLabel('Langue cible').selectOption('ar');
  await dlg.getByRole('button', { name: 'Préparer la traduction' }).click();
  await dlg.getByRole('button', { name: 'Créer la copie' }).waitFor();
  ok((await dlg.locator('tbody textarea').first().getAttribute('dir')) === 'rtl', 'Arabe : champs en rtl');
  await dlg.getByRole('button', { name: 'Créer la copie' }).click();
  await page.getByText('Copie traduite créée.').waitFor();
  ok(state.tables.demos.at(-1).settings.locale === 'ar', 'Copie arabe : locale ar');

  ok(errors.length === 0, `aucune erreur de page (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
