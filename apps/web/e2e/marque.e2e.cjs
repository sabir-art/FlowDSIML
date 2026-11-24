/**
 * L27-01 à L27-05 : Paramètres > Marque. Logo (formats, deux fonds), couleurs de la marque (contraste,
 * couleur proposée), styles livrés et styles de l'espace (création, contraste, défaut, suppression avec
 * Annuler, renommage en place), droits de l'éditeur. Données fictives (« Acme », .example).
 * Usage : SHOTS_DIR=… [THEME=dark] node e2e/marque.e2e.cjs
 */
const path = require('path');
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const CAMILLE = '00000000-0000-4000-8000-0000000000c1';
const sp = (s) => (s || '').replace(/[  ]/g, ' ');

(async () => {
  const b = await chromium.launch({
    // Champs date et heure au format français (locale du processus)
    args: ['--lang=fr-FR'],
    env: { ...process.env, LANG: 'fr_FR.UTF-8', LANGUAGE: 'fr_FR:fr', LC_ALL: 'fr_FR.UTF-8' },
  });
  const ctx = await themedContext(b, {
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const state = seed();
  const t = state.tables;
  t.profiles[0].full_name = 'Alice Exemple';
  t.members.push({ workspace_id: 'ws-1', user_id: CAMILLE, role: 'editor', created_at: '2026-01-02' });
  state.memberDirectory = { [CAMILLE]: { full_name: 'Camille Fictive', email: 'camille@acme.example' } };
  t.themes.push({
    id: 'th-acme',
    workspace_id: 'ws-1',
    name: 'Acme bleu',
    tokens: {
      primary: '#1D4ED8',
      onPrimary: '#FFFFFF',
      hotspot: '#2563EB',
      background: '#F1F5F9',
      surface: '#FFFFFF',
      text: '#0F172A',
      radius: 10,
      buttonRadius: 8,
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    },
    is_default: false,
    builtin_key: null,
    created_by: CAMILLE,
    created_at: '2026-01-03T00:00:00Z',
    updated_at: '2026-01-03T00:00:00Z',
  });
  await install(page, state);
  // Logo fictif « Acme » (le faux Supabase ne garde pas le corps des envois multipart)
  const acme = require('fs').readFileSync(path.join(__dirname, 'acme-logo.svg'));
  await page.route('**/storage/v1/object/public/branding/**', (r) =>
    r.fulfill({ contentType: 'image/svg+xml', body: acme, headers: { 'access-control-allow-origin': '*' } }),
  );
  const shot = async (name) => {
    if (!SHOTS) return;
    // Captures sans toast
    for (const x of await page.locator('.toast-close').all()) await x.click().catch(() => {});
    await page.mouse.move(0, 0);
    await page.waitForTimeout(200);
    const modal = (await page.locator('dialog[open]').count()) > 0;
    if (modal) return page.screenshot({ path: `${SHOTS}/${name}${sfx}.png` });
    // Page entière : fenêtre agrandie à la hauteur du contenu (barre latérale collante à sa place)
    await page.evaluate(() => document.activeElement?.blur?.());
    const vp = page.viewportSize();
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: vp.width, height: Math.max(vp.height, h) });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${SHOTS}/${name}${sfx}.png` });
    await page.setViewportSize(vp);
  };

  // ===== L27-01 : propriétaire =====
  await page.goto(`${APP}/#/settings/brand`);
  const logo = page.getByRole('region', { name: 'Logo' });
  await logo.waitFor();
  const header = page.locator('.fd-page-header');
  ok(
    (await page.locator('.stg-sec__head h2').allTextContents()).join('|') ===
      'Logo|Couleurs de la marque|Styles des démos',
    'trois sections dans l’ordre',
  );
  // MEDIA-01 §18.1 : zone de dépôt sur une rangée, une source par bouton, jamais de bouton dans une phrase
  const zone = logo.getByRole('group', { name: 'Logo' });
  ok(
    /Glissez un fichier ici/.test(sp(await zone.innerText())) &&
      (await zone.getByRole('button', { name: 'Choisir un fichier' }).count()) === 1 &&
      // §3.1 : le bouton « Médiathèque » seul (gestion sans rien appliquer) a disparu d'ici
      (await zone.getByRole('button', { name: 'Médiathèque' }).count()) === 0 &&
      (await zone.locator('.fd-dz__txt button').count()) === 0,
    'logo : zone de dépôt (état vide), « Choisir un fichier » en bouton, plus de « Médiathèque » seul',
  );
  {
    const zb = await zone.boundingBox();
    const rb = await logo.locator('.stg-row').boundingBox();
    ok(
      Math.abs(zb.x - rb.x) <= 1 && Math.abs(zb.x + zb.width - (rb.x + rb.width)) <= 1,
      'logo : la zone prend toute la largeur de la ligne, jusqu’à la fin du filet',
    );
  }
  ok(
    await header.getByRole('button', { name: 'Enregistrer' }).isDisabled(),
    '« Enregistrer » désactivé sans changement',
  );
  const file = logo.locator('input[type=file]');
  await file.setInputFiles({ name: 'logo.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') });
  ok(
    (await logo.getByRole('alert').innerText()) ===
      'Ce format n’est pas accepté. Choisissez un fichier PNG, JPEG, WebP ou SVG.',
    'logo : format refusé',
  );
  await file.setInputFiles({
    name: 'gros.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
  });
  ok(sp(await logo.getByRole('alert').innerText()) === 'Le fichier dépasse 2 Mo.', 'logo : 2 Mo au plus');
  await file.setInputFiles(path.join(__dirname, 'fixture.png'));
  await zone.locator('.fd-dz__pre--img img').waitFor();
  ok(
    (await zone.evaluate((el) => el.classList.contains('is-filled'))) &&
      /Logo de /.test(sp(await zone.innerText())),
    'logo : état rempli, aperçu et nom dans la zone',
  );
  ok(/^ws-1\/logo-.+\.png$/.test(t.workspaces[0].logo_path || ''), 'logo enregistré dans branding/<espace>/');
  ok((await logo.getByRole('button', { name: 'Remplacer…' }).count()) === 1, 'Remplacer…');
  ok(
    (await logo.getByRole('button', { name: 'Retirer le logo' }).count()) === 1,
    'Retirer le logo (bouton icône)',
  );

  // Couleurs de la marque
  const colors = page.getByRole('region', { name: 'Couleurs de la marque' });
  const primary = colors.getByRole('textbox', { name: 'Couleur principale', exact: true });
  await primary.fill('#9AD1C8');
  await primary.blur();
  const warn = colors.getByRole('status').first();
  ok(
    /Texte blanc sur cette couleur : 1,\d:1, insuffisant\. Couleur proposée : #[0-9A-F]{6}\./.test(
      sp(await warn.innerText()),
    ),
    'contraste insuffisant annoncé, couleur proposée',
  );
  await colors.getByRole('button', { name: 'Utiliser cette couleur' }).click();
  ok(/conforme/.test(sp(await colors.locator('.stg-row').first().innerText())), 'couleur proposée appliquée');
  await header.getByRole('button', { name: 'Enregistrer' }).click();
  await page.getByText('Couleurs de la marque enregistrées.').waitFor();
  ok(
    /^#[0-9A-F]{6}$/.test(t.workspaces[0].brand_primary || '') && t.workspaces[0].brand_primary !== '#9AD1C8',
    'couleurs enregistrées',
  );

  // Styles
  const styles = page.getByRole('region', { name: 'Styles des démos' });
  // Une seule grille : les 6 styles livrés puis ceux de l'espace
  const builtin = styles.getByRole('list');
  const mine = builtin;
  ok(
    (await builtin.getByRole('listitem').count()) === 7 &&
      (await builtin.getByRole('listitem').nth(6).innerText()).includes('Acme bleu'),
    '6 styles livrés puis le style de l’espace',
  );
  ok(
    (await builtin
      .getByRole('listitem')
      .nth(3)
      .locator('.br-st__band')
      .evaluate((el) => getComputedStyle(el).backgroundColor)) === 'rgb(28, 33, 40)',
    'bandeau : la bulle sombre pour « Nuit »',
  );
  const current = styles.locator('[aria-current="true"]');
  ok(
    (await current.count()) === 1 && /DSI Prune\s*Par défaut/.test(await current.innerText()),
    'style par défaut : badge et aria-current',
  );
  ok(/Créé par Camille Fictive/.test(await mine.innerText()), 'auteur du style');
  await shot('l27-01-marque');

  // ===== L27-02 : nouveau style =====
  await styles.getByRole('button', { name: 'Nouveau style' }).click();
  const dlg = page.getByRole('dialog', { name: 'Nouveau style' });
  await dlg.waitFor();
  await dlg.getByLabel('Nom', { exact: true }).fill('Acme pâle');
  await dlg.getByRole('textbox', { name: 'Texte de la bulle', exact: true }).fill('#C8CCD2');
  await dlg.getByRole('textbox', { name: 'Texte de la bulle', exact: true }).blur();
  const bubble = dlg.getByRole('status').filter({ hasText: 'Bulle' });
  ok(
    /Bulle : contraste 1,\d:1, insuffisant/.test(sp(await bubble.innerText())),
    'bulle : contraste insuffisant',
  );
  ok(
    (await dlg.locator('.br-sd-preview').getAttribute('aria-hidden')) === 'true',
    'aperçu masqué aux lecteurs d’écran',
  );
  await shot('l27-02-modifier-style');
  await dlg.getByLabel('Nom', { exact: true }).fill('acme BLEU');
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  ok((await dlg.getByRole('alert').innerText()) === 'Un style porte déjà ce nom.', 'nom déjà pris');
  await dlg.getByLabel('Nom', { exact: true }).fill('Acme pâle');
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  await dlg.waitFor({ state: 'detached' });
  await page.getByText('Style « Acme pâle » enregistré.').waitFor();
  ok(true, 'toast « Style « Acme pâle » enregistré. »');
  const pale = mine.getByRole('listitem').filter({ hasText: 'Acme pâle' });
  ok(/Contraste insuffisant/.test(await pale.innerText()), 'grille : badge « Contraste insuffisant »');
  ok(t.themes.find((x) => x.name === 'Acme pâle')?.created_by === state.user.id, 'auteur = membre connecté');

  // Dupliquer un style livré
  await builtin.getByRole('button', { name: 'Actions pour Nuit' }).click();
  await page.getByRole('menuitem', { name: 'Dupliquer' }).click();
  const dup = page.getByRole('dialog', { name: 'Dupliquer « Nuit »' });
  await dup.waitFor();
  ok(
    (await dup.getByLabel('Nom', { exact: true }).inputValue()) === 'Nuit (copie)',
    'duplication : nom proposé',
  );
  await page.keyboard.press('Escape');
  await dup.waitFor({ state: 'detached' });

  // ===== L27-03 : style par défaut =====
  t.demos[0].settings = { ...(t.demos[0].settings || {}), theme: undefined };
  await mine.getByRole('button', { name: 'Actions pour Acme bleu' }).click();
  await page.getByRole('menuitem', { name: 'Définir par défaut' }).click();
  const conf = page.getByRole('dialog', { name: 'Utiliser « Acme bleu » par défaut ?' });
  await conf.waitFor();
  await conf.getByText(/démos? (est|sont) concernées?\./).waitFor();
  ok(
    /prochaine publication/.test(await conf.innerText()),
    'texte : les démos publiées changent à leur prochaine publication (comportement réel)',
  );
  await shot('l27-03-style-par-defaut');
  await conf.getByRole('button', { name: 'Utiliser par défaut' }).click();
  await page.getByText('« Acme bleu » est le style par défaut.').waitFor();
  // La liste est rechargée après le toast : on attend le style marqué par défaut, pas un délai
  await styles.locator('[aria-current="true"]', { hasText: 'Acme bleu' }).waitFor();
  ok(
    /Acme bleu/.test(await styles.locator('[aria-current="true"]').innerText()) &&
      t.themes.find((x) => x.id === 'th-acme').is_default,
    'nouveau style par défaut',
  );

  // ===== L27-04 : suppression =====
  await mine.getByRole('button', { name: 'Actions pour Acme bleu' }).click();
  const delDefault = page.getByRole('menuitem', { name: 'Supprimer' });
  ok(
    (await delDefault.getAttribute('aria-disabled')) === 'true' &&
      (await delDefault.getAttribute('title')) === 'Choisissez d’abord un autre style par défaut.',
    'style par défaut : « Supprimer » désactivé et expliqué',
  );
  await page.keyboard.press('Escape');
  await pale.getByRole('button', { name: 'Actions pour Acme pâle' }).click();
  await page.getByRole('menuitem', { name: 'Supprimer' }).click();
  const del = page.getByRole('dialog', { name: 'Supprimer « Acme pâle » ?' });
  await del.waitFor();
  await shot('l27-04-supprimer-style');
  await del.getByRole('button', { name: 'Supprimer' }).click();
  await page.getByText('Style supprimé.').waitFor();
  ok(!t.themes.some((x) => x.name === 'Acme pâle'), 'style supprimé');
  await page.getByRole('status').getByRole('button', { name: 'Annuler' }).click();
  await mine.getByText('Acme pâle').waitFor();
  ok(
    t.themes.some((x) => x.name === 'Acme pâle'),
    'Annuler : style rétabli',
  );

  // Renommer en place : Entrée valide, Échap annule
  await pale.getByRole('button', { name: 'Actions pour Acme pâle' }).click();
  await page.getByRole('menuitem', { name: 'Renommer' }).click();
  const rn = page.getByRole('textbox', { name: 'Nouveau nom de « Acme pâle »' });
  await rn.fill('Acme bleu');
  await rn.press('Enter');
  ok((await mine.getByRole('alert').innerText()) === 'Un style porte déjà ce nom.', 'renommer : nom pris');
  await rn.press('Escape');
  ok((await rn.count()) === 0 && (await mine.getByText('Acme pâle').count()) === 1, 'Échap annule');
  await pale.getByRole('button', { name: 'Actions pour Acme pâle' }).click();
  await page.getByRole('menuitem', { name: 'Renommer' }).click();
  await page.getByRole('textbox', { name: 'Nouveau nom de « Acme pâle »' }).fill('Acme clair');
  await page.keyboard.press('Enter');
  await mine.getByText('Acme clair').waitFor();
  ok(
    t.themes.some((x) => x.name === 'Acme clair'),
    'Entrée valide le nouveau nom',
  );

  // ===== L27-05 : éditeur =====
  t.members[0].role = 'editor';
  await page.reload();
  await styles.waitFor();
  ok(
    (await page.getByRole('note').innerText()) ===
      'Seuls les propriétaires et administrateurs modifient la marque et le style par défaut.',
    'éditeur : bandeau d’information',
  );
  ok(
    (await logo.getByRole('button', { name: /Remplacer|Retirer/ }).count()) === 0,
    'éditeur : logo en lecture',
  );
  ok(
    (await header.getByRole('button', { name: 'Enregistrer' }).count()) === 0 &&
      (await colors.getByRole('textbox').count()) === 0 &&
      /#5C7D78/.test(await colors.innerText()),
    'éditeur : couleurs en lecture seule',
  );
  ok(
    (await styles.getByRole('button', { name: 'Nouveau style' }).count()) === 1,
    'éditeur : « Nouveau style »',
  );
  await mine.getByRole('button', { name: 'Actions pour Acme bleu' }).click();
  ok(
    (await page.getByRole('menuitem').allTextContents()).join('|') === 'Dupliquer',
    'style d’un autre membre : « Dupliquer » seulement',
  );
  await page.keyboard.press('Escape');
  await mine.getByRole('button', { name: 'Actions pour Acme clair' }).click();
  ok(
    (await page.getByRole('menuitem').allTextContents()).join('|') === 'Modifier|Renommer|Dupliquer',
    'son propre style : Modifier, Renommer, Dupliquer (ni défaut ni suppression)',
  );
  await page.keyboard.press('Escape');
  await builtin.getByRole('button', { name: 'Actions pour Vert DSI' }).click();
  ok(
    (await page.getByRole('menuitem').allTextContents()).join('|') === 'Dupliquer',
    'style livré : Dupliquer',
  );
  await page.keyboard.press('Escape');
  await shot('l27-05-marque-editeur');

  // Grille : 3 colonnes à 1 440 px, 2 à 390 px (maquette lot1-parametres/theme), sans défilement horizontal
  const colsAt = async (width) => {
    await page.setViewportSize({ width, height: 844 });
    return page
      .locator('.br-styles')
      .evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(' ').length);
  };
  const c390 = await colsAt(390);
  ok(c390 === 2, `390 px : deux colonnes (${c390})`);
  const sw = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  ok(sw <= 1, `390 px : pas de défilement horizontal (${sw})`);
  const c1440 = await colsAt(1440);
  ok(c1440 === 3, `1 440 px : trois colonnes (${c1440})`);

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
