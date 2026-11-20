/**
 * Recette L48-G (spec docs/ux/specs/l48g-types.md §6), parties création et navigation. Données fictives.
 *  - « Nouvelle démo » en deux étapes : 3 types illustrés, flèches, sources filtrées, Retour sans perte,
 *    « Bientôt » pour les modèles absents ; type gardé dans le compte (préremplissage de l'extension) ;
 *  - barre latérale : Démos et Sandbox séparés ; filtre Type et badges ; page Sandbox ;
 *  - 390 px : cartes en liste ; axe (clair et sombre).
 * Usage : node e2e/l48g-types.e2e.cjs
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';

/** Trois démos : captures (seed), HTML (2 étapes html), Sandbox. */
function data() {
  const s = seed();
  const base = s.tables.demos[1];
  const ws = s.tables.workspaces[0].id;
  const html = {
    ...base,
    id: '0b5c1f0e-0000-4000-8000-0000000000f1',
    title: 'Fiche usager HTML',
    kind: 'guided',
  };
  const sb = {
    ...base,
    id: '0b5c1f0e-0000-4000-8000-0000000000f2',
    title: 'Portail à explorer',
    kind: 'sandbox',
  };
  s.tables.demos.push(html, sb);
  const st = (id, demo, i, kind) => ({
    id,
    demo_id: demo,
    workspace_id: ws,
    position: i,
    kind,
    title: `Page ${i + 1}`,
    image_path: null,
  });
  s.tables.steps.push(
    st('st-h1', html.id, 0, 'html'),
    st('st-h2', html.id, 1, 'html'),
    st('st-s1', sb.id, 0, 'html'),
    st('st-s2', sb.id, 1, 'html'),
    st('st-s3', sb.id, 2, 'html'),
  );
  return s;
}

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const open = async (s, path = '/', width = 1440, scheme = 'light') => {
    const page = await (
      await b.newContext({ viewport: { width, height: 900 }, locale: 'fr-FR', colorScheme: scheme })
    ).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await install(page, s);
    await page.goto(`${APP}/#${path}`);
    return page;
  };
  const axe = async (page, label) => {
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    ok(bad.length === 0, `axe ${label} : ${bad.map((v) => v.id).join(', ') || '0 violation grave'}`);
  };

  // ===== Dialogue en deux étapes =====
  const s = data();
  const p = await open(s);
  await p.locator('.demo-card').first().waitFor();
  await p.locator('.page-head__actions').getByRole('button', { name: 'Nouvelle démo' }).click();
  const nd = p.locator('dialog.new-demo-dialog[open]');
  await nd.waitFor();
  ok(
    (await nd.getAttribute('aria-labelledby')) === 'nd-title nd-step',
    'titre annoncé avec « Étape 1 sur 2 »',
  );
  ok((await nd.locator('#nd-step').innerText()).includes('Étape 1 sur 2'), 'Étape 1 sur 2');
  const radios = nd.getByRole('radio');
  ok((await radios.count()) === 3, '3 types');
  ok(
    (await nd.locator('.nd-type svg.nd-art[aria-hidden="true"]').count()) === 3,
    'illustrations aria-hidden',
  );
  ok((await nd.locator('.nd-type li').count()) === 0, 'écart 1 : aucun point fort');
  {
    const sel = await nd.locator('.nd-type.is-selected').evaluate((el) => {
      const c = getComputedStyle(el);
      return {
        ow: c.outlineWidth,
        oc: c.outlineColor,
        bg: c.backgroundColor,
        tx: getComputedStyle(document.body).color,
      };
    });
    ok(
      sel.ow === '2px' && sel.oc === sel.tx,
      `écart 1 : sélection en contour 2 px couleur texte (${sel.ow} ${sel.oc})`,
    );
  }
  ok(await radios.first().isChecked(), 'par défaut : Démo par captures');
  await axe(p, 'nouvelle démo · étape 1');
  await radios.first().focus();
  await p.keyboard.press('ArrowRight');
  ok(await nd.getByRole('radio', { name: /Démo HTML/ }).isChecked(), 'flèche droite : Démo HTML');
  await p.keyboard.press('ArrowRight');
  ok(await nd.getByRole('radio', { name: /Sandbox/ }).isChecked(), 'flèche droite : Sandbox');
  await nd.getByRole('button', { name: 'Continuer', exact: true }).click();
  ok(
    (await nd.locator('#nd-title').innerText()).includes('Nouveau Sandbox'),
    'étape 2 : « Nouveau Sandbox »',
  );
  ok(
    (await nd.getByRole('button', { name: /Importer des images/ }).count()) === 0 &&
      (await nd.getByRole('button', { name: /Générer avec/ }).count()) === 0 &&
      (await nd.getByRole('button', { name: /démo vide/ }).count()) === 0,
    'Sandbox : ni images, ni IA, ni démo vide',
  );
  ok(
    (await nd.locator('.nd-src.is-soon[aria-disabled="true"]', { hasText: 'Bientôt' }).count()) === 1 &&
      (await nd.locator('.nd-src.is-soon .fd-badge').count()) === 0,
    'Sandbox : modèle « Bientôt »',
  );
  await p.waitForTimeout(200);
  ok(s.user.user_metadata.content_type === 'sandbox', 'type gardé dans le compte (extension)');
  await axe(p, 'nouvelle démo · étape 2');
  // Retour sans perte
  await nd
    .getByLabel('Dossier')
    .selectOption({ index: 1 })
    .catch(() => {});
  const folderVal = await nd.getByLabel('Dossier').inputValue();
  await nd.getByRole('button', { name: 'Retour' }).click();
  ok(await nd.getByRole('radio', { name: /Sandbox/ }).isChecked(), 'Retour : type conservé');
  await nd.getByRole('radio', { name: /captures/ }).check();
  await nd.getByRole('button', { name: 'Continuer', exact: true }).click();
  ok((await nd.getByLabel('Dossier').inputValue()) === folderVal, 'Retour : dossier conservé');
  ok(
    (await nd.getByRole('button', { name: /Importer des images/ }).count()) === 1 &&
      (await nd.getByRole('button', { name: /Partir d’un modèle/ }).count()) === 1,
    'Captures : images et modèle',
  );
  ok(
    (await nd.locator('.nd-sources .nd-src__go').count()) === 4 &&
      (await nd.getByRole('button', { name: 'Annuler' }).count()) === 1,
    'écart 2 : sources en liste avec chevron, Retour et Annuler',
  );
  await nd.getByRole('button', { name: /Capturer avec l’extension/ }).click();
  await p
    .locator('dialog[open]')
    .filter({ hasText: /extension/i })
    .first()
    .waitFor();
  ok(!(await nd.isVisible()), 'écart 2 : la ligne Extension ouvre la fenêtre de l’extension');
  await p.keyboard.press('Escape');

  // ===== Navigation, filtre Type et badges =====
  const nav = p.getByRole('navigation', { name: 'Navigation principale' });
  ok(
    (await nav.getByRole('link', { name: 'Démos' }).count()) === 1 &&
      (await nav.getByRole('link', { name: 'Sandbox' }).count()) === 1,
    'barre latérale : Démos et Sandbox',
  );
  const titles = async () => p.locator('.demo-card h3').allInnerTexts();
  ok(!(await titles()).includes('Portail à explorer'), 'Démos : pas de Sandbox');
  const card = (title) => p.locator('.demo-card', { hasText: title });
  ok((await card('Fiche usager HTML').locator('.ct-badge').innerText()).includes('HTML'), 'badge « HTML »');
  ok((await card('Onboarding').locator('.ct-badge').innerText()).includes('Captures'), 'badge « Captures »');
  await p.getByRole('button', { name: /^Type\s*:/ }).click();
  await p.getByRole('menuitem', { name: 'HTML' }).click();
  ok(JSON.stringify(await titles()) === JSON.stringify(['Fiche usager HTML']), 'filtre Type : HTML');
  await p.getByRole('button', { name: /^Type\s*:/ }).click();
  await p.getByRole('menuitem', { name: 'Captures' }).click();
  ok(!(await titles()).includes('Fiche usager HTML'), 'filtre Type : Captures');
  await axe(p, 'Démos (filtre Type)');

  // ===== Page Sandbox =====
  await nav.getByRole('link', { name: 'Sandbox' }).click();
  await p.getByRole('heading', { level: 1, name: 'Sandbox' }).waitFor();
  await p.locator('.demo-card').first().waitFor();
  ok(
    JSON.stringify(await titles()) === JSON.stringify(['Portail à explorer']),
    'Sandbox : seulement les Sandbox',
  );
  ok((await card('Portail à explorer').innerText()).includes('3 pages'), 'carte : « 3 pages »');
  ok((await p.getByRole('button', { name: /^Type\s*:/ }).count()) === 0, 'Sandbox : pas de filtre Type');
  {
    const head = await p.locator('.page-head').boundingBox();
    ok(head.height < 70, `écart 4 : en-tête Sandbox sur une ligne (${Math.round(head.height)} px)`);
  }
  ok((await p.locator('.demo-new').count()) === 0, 'écart 5 : pas de carte « Nouvelle démo » fantôme');
  ok(
    (await p.getByRole('heading', { level: 2, name: 'Tous les Sandbox' }).count()) === 1 &&
      (await p.getByPlaceholder('Rechercher un Sandbox').count()) === 1,
    'écart 6 : « Tous les Sandbox », « Rechercher un Sandbox »',
  );
  await p.locator('.page-head__actions').getByRole('button', { name: 'Nouveau Sandbox' }).click();
  await nd.waitFor();
  ok(
    (await nd.locator('#nd-step').innerText()).includes('Étape 2 sur 2') &&
      (await nd.locator('#nd-title').innerText()).includes('Nouveau Sandbox'),
    '« Nouveau Sandbox » : directement l’étape 2',
  );
  await p.keyboard.press('Escape');
  await axe(p, 'page Sandbox');
  await p.context().close();

  // ===== Sombre et 390 px =====
  const m = await open(data(), '/', 390, 'dark');
  await m.locator('.demo-card').first().waitFor();
  await m.getByRole('button', { name: 'Nouvelle démo' }).first().click();
  await m.locator('dialog.new-demo-dialog[open] .nd-type').first().waitFor();
  const box = await m.locator('.nd-art').first().boundingBox();
  ok(box && Math.round(box.width) === 96, `390 px : illustration de 96 px (${box && box.width})`);
  ok(
    await m.evaluate(() => {
      const d = document.querySelector('dialog[open]');
      return d.scrollWidth <= d.clientWidth;
    }),
    '390 px : pas de défilement horizontal dans la modale',
  );
  await axe(m, 'nouvelle démo · sombre 390 px');
  await m.context().close();

  ok(errors.length === 0, `aucune erreur de page${errors.length ? ` : ${errors.join(' / ')}` : ''}`);
  await b.close();
})();
