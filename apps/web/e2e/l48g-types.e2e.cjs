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
const { pick, picked } = require('./_select.cjs');
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
  // EXT-02 §4.1 : démo vidéo (une étape vidéo)
  const video = {
    ...base,
    id: '0b5c1f0e-0000-4000-8000-0000000000f3',
    title: 'Visite filmée',
    kind: 'guided',
  };
  s.tables.demos.push(html, sb, video);
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
    st('st-v1', video.id, 0, 'video'),
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
    // Menu refermé et animations terminées avant de mesurer : le contraste est faussé pendant un fondu (CI chargée)
    await page.waitForFunction(() => document.getAnimations().every((x) => x.playState !== 'running'));
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    ok(bad.length === 0, `axe ${label} : ${bad.map((v) => v.id).join(', ') || '0 violation grave'}`);
  };

  // ===== Dialogue en deux étapes =====
  const s = data();
  const p = await open(s);
  await p.locator('.demo-card').first().waitFor();
  await p.getByRole('button', { name: 'Nouvelle démo' }).first().click();
  const nd = p.locator('dialog.new-demo-dialog[open]');
  await nd.waitFor();
  ok(
    await nd.evaluate((d) => {
      const ids = (d.getAttribute('aria-labelledby') || '').split(' ');
      const name = ids.map((i) => document.getElementById(i)?.textContent ?? '').join(' ');
      return ids.length === 2 && name.includes('Nouvelle démo') && name.includes('Étape 1 sur\u00a02');
    }),
    'titre annoncé avec « Étape 1 sur 2 »',
  );
  ok((await nd.locator('.fd-modal__sub').innerText()).includes('Étape 1 sur\u00a02'), 'Étape 1 sur 2');
  const radios = nd.getByRole('radio');
  ok(
    (await radios.count()) === 4 &&
      (await nd.locator('.nd-type b').allInnerTexts()).join('|') ===
        'Démo par captures|Démo HTML|Sandbox|Démo vidéo',
    '4 types, « Démo vidéo » en dernier (EXT-02 §4.1)',
  );
  ok(
    (await nd.locator('.nd-type .nd-type__tile[aria-hidden="true"] svg').count()) === 4,
    'tuiles d’icône aria-hidden (lot 2 : un choix par ligne, MODAL-01)',
  );
  ok((await nd.locator('.nd-type li').count()) === 0, 'écart 1 : aucun point fort');
  {
    // Lot 2 (MODAL-01) : choix sélectionné en trait prune de 2 px (bordure et trait intérieur), fond teinté
    const sel = await nd.locator('.nd-type.is-selected').evaluate((el) => {
      const c = getComputedStyle(el);
      const probe = document.createElement('i');
      probe.style.color = 'var(--fd-color-primary)';
      el.append(probe);
      const primary = getComputedStyle(probe).color;
      probe.remove();
      return { bc: c.borderTopColor, bs: c.boxShadow, primary, ow: c.outlineStyle };
    });
    ok(
      sel.bc === sel.primary && sel.bs.includes('inset') && sel.bs.includes(sel.primary) && sel.ow === 'none',
      `écart 1 : sélection en trait prune de 2 px, sans contour (${sel.bc} ; ${sel.bs})`,
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
    (await nd.locator('.fd-modal__head h2').innerText()).includes('Nouveau Sandbox'),
    'étape 2 : « Nouveau Sandbox »',
  );
  ok(
    (await nd.getByRole('button', { name: /Importer des images/ }).count()) === 0 &&
      (await nd.getByRole('button', { name: /Générer avec/ }).count()) === 0 &&
      (await nd.getByRole('button', { name: /démo vide/ }).count()) === 0,
    'Sandbox : ni images, ni IA, ni démo vide',
  );
  ok(
    (await nd.locator('.nd-src.is-soon[aria-disabled="true"]', { hasText: 'Partir d’un modèle' }).count()) ===
      1 && (await nd.locator('.nd-src.is-soon .fd-badge').count()) === 0,
    'Sandbox : modèle « Bientôt »',
  );
  await p.waitForTimeout(200);
  ok(s.user.user_metadata.content_type === 'sandbox', 'type gardé dans le compte (extension)');
  await axe(p, 'nouvelle démo · étape 2');
  // Retour sans perte
  await pick(nd.getByLabel('Dossier'), { index: 1 }).catch(() => nd.page().keyboard.press('Escape'));
  const folderVal = await picked(nd.getByLabel('Dossier'));
  await nd.getByRole('button', { name: 'Retour' }).click();
  ok(await nd.getByRole('radio', { name: /Sandbox/ }).isChecked(), 'Retour : type conservé');
  await nd.getByRole('radio', { name: /captures/ }).check();
  await nd.getByRole('button', { name: 'Continuer', exact: true }).click();
  ok((await picked(nd.getByLabel('Dossier'))) === folderVal, 'Retour : dossier conservé');
  ok(
    (await nd.getByRole('button', { name: /Importer des images/ }).count()) === 1 &&
      (await nd.getByRole('button', { name: /Partir d’un modèle/ }).count()) === 1,
    'Captures : images et modèle',
  );
  ok(
    // Images et modèle ont un chevron ; la ligne de l'IA aussi, sauf désactivée (comme une ligne « Bientôt »)
    (await nd.locator('.nd-sources .nd-src__go').count()) +
      (await nd.locator('.nd-sources .nd-ai .nd-src[aria-disabled="true"]').count()) ===
      3 && (await nd.getByRole('button', { name: 'Annuler' }).count()) === 1,
    'écart 2 : sources en liste avec chevron, Retour et Annuler',
  );
  // §18.4 : extension non publiée (pas de VITE_EXTENSION_URL en test) : source visible, désactivée, « Bientôt »
  const ext = nd.locator('.nd-src.is-soon[aria-disabled="true"]', { hasText: 'Capturer avec l’extension' });
  ok(
    (await ext.innerText()).includes('Bientôt'),
    '§18.4 : « Capturer avec l’extension » désactivée, « Bientôt »',
  );
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
  ok(
    (await card('Visite filmée').locator('.ct-badge').innerText()).includes('Vidéo') &&
      (await card('Visite filmée').locator('.ct-badge svg.lucide-video').count()) === 1,
    'badge « Vidéo » avec l’icône Video (EXT-02 §4.1)',
  );
  await p.getByRole('button', { name: /^Type\s*:/ }).click();
  ok(
    (await p.getByRole('menuitem').allInnerTexts()).map((x) => x.trim()).join('|') ===
      'Tous|Captures|HTML|Vidéo',
    'filtre Type : Tous, Captures, HTML, Vidéo',
  );
  await p.getByRole('menuitem', { name: 'Vidéo' }).click();
  ok(JSON.stringify(await titles()) === JSON.stringify(['Visite filmée']), 'filtre Type : Vidéo');
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
  // La liste de la page Démos peut rester affichée un instant : on attend celle de la page Sandbox
  await card('Portail à explorer').waitFor();
  await p.waitForFunction(() => document.querySelectorAll('.demo-card').length === 1);
  ok(
    JSON.stringify(await titles()) === JSON.stringify(['Portail à explorer']),
    'Sandbox : seulement les Sandbox',
  );
  ok((await card('Portail à explorer').innerText()).includes('3 pages'), 'carte : « 3 pages »');
  ok((await p.getByRole('button', { name: /^Type\s*:/ }).count()) === 0, 'Sandbox : pas de filtre Type');
  {
    const head = await p.locator('.fd-page-header').boundingBox();
    ok(head.height < 70, `écart 4 : en-tête Sandbox sur une ligne (${Math.round(head.height)} px)`);
  }
  ok((await p.locator('.demo-new').count()) === 0, 'écart 5 : pas de carte « Nouvelle démo » fantôme');
  ok(
    (await p.getByRole('heading', { level: 2, name: 'Tous les Sandbox' }).count()) === 1 &&
      (await p.getByPlaceholder('Rechercher un Sandbox').count()) === 1,
    'écart 6 : « Tous les Sandbox », « Rechercher un Sandbox »',
  );
  await p.locator('.fd-page-header__actions').getByRole('button', { name: 'Nouveau Sandbox' }).click();
  await nd.waitFor();
  ok(
    (await nd.locator('.fd-modal__sub').innerText()).includes('Étape 2 sur\u00a02') &&
      (await nd.locator('.fd-modal__head h2').innerText()).includes('Nouveau Sandbox'),
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
  // Fin de l'animation d'ouverture avant de mesurer
  await m.waitForFunction(() => document.getAnimations().every((x) => x.playState !== 'running'));
  const box = await m.locator('.nd-type__tile').first().boundingBox();
  ok(box && Math.round(box.width) === 40, `390 px : tuile de 40 px (${box && box.width})`);
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
