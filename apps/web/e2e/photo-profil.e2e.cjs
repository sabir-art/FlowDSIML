/**
 * Retours client 21/11 §4 : photo de profil (spec docs/ux/specs/retours-client-21-11.md §4).
 * Faux Supabase, images générées dans le test (aucune donnée réelle).
 *  - ligne « Photo » en tête du Profil (MEDIA-01) : vignette ronde de 72 px, qui est le bouton « Changer la
 *    photo de profil » ; bouton ⋯ avec « Remplacer… » et « Retirer » quand une photo est en place ; aide ;
 *  - erreurs : type refusé, plus de 2 Mo (role=alert) ;
 *  - « Recadrer la photo » : zone carrée, aperçu rond de 96 px, zoom de 100 à 300 %, flèches de 8 px ;
 *  - envoi : 256 × 256 WebP réencodé dans le navigateur, chemin <uid>/<uuid>.webp, avatar_path ;
 *  - la photo remplace l'initiale (Profil, barre latérale, commentaires) ; « Retirer » supprime le fichier ;
 *  - image qui ne se charge pas : l'initiale reste, sans image cassée.
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};

/** Image PNG générée dans la page (canvas), de la taille voulue. */
async function png(page, w, h) {
  const b64 = await page.evaluate(
    ([w, h]) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const x = c.getContext('2d');
      x.fillStyle = '#3366cc';
      x.fillRect(0, 0, w, h);
      x.fillStyle = '#ffcc00';
      x.fillRect(w / 4, h / 4, w / 2, h / 2);
      return c.toDataURL('image/png').split(',')[1];
    },
    [w, h],
  );
  return Buffer.from(b64, 'base64');
}

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const state = seed();
  state.extraMembers = [
    { user_id: 'u-bob', email: 'bob@example.test', full_name: 'Bob Martin', role: 'editor' },
  ];
  state.tables.profiles.push({ id: 'u-bob', full_name: 'Bob Martin', avatar_path: 'u-bob/photo-bob.webp' });
  await install(page, state);
  // Encodage du recadrage : taille et format de l'image produite
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (cb, type, q) {
      window.__encoded = { w: this.width, h: this.height, type };
      return orig.call(this, cb, type, q);
    };
  });
  await page.goto(`${APP}/#/settings/profile`);
  const row = page.locator('.pf-photo');
  await row.waitFor();

  // ===== Ligne « Photo » =====
  const thumb = row.getByRole('button', { name: 'Changer la photo de profil' });
  const av = await thumb.boundingBox();
  ok(Math.round(av.width) === 72 && Math.round(av.height) === 72, 'MEDIA-01 : vignette ronde de 72 px');
  ok((await row.locator('.fd-mt__ini').getAttribute('data-ini')) === 'A', 'sans photo : l’initiale');
  {
    const rb = await row.boundingBox();
    ok(
      Math.abs(av.x + av.width - (rb.x + rb.width)) <= 1,
      'ALIGN-01 : la vignette est calée sur la fin du filet',
    );
  }
  ok(
    (await thumb.count()) === 1 &&
      (await row.getByRole('button', { name: 'Options pour la photo de profil' }).count()) === 0 &&
      (await row.getByRole('button', { name: 'Choisir une photo' }).count()) === 0,
    'l’image est le bouton ; pas de bouton ⋯ sans photo, plus de « Choisir une photo » à côté',
  );
  ok(
    (await row.locator('.stg-help').innerText()) ===
      'JPG, PNG ou WebP, 2\u00a0Mo au plus. Cliquez sur l’image ou déposez un fichier.',
    'aide sous le libellé « Photo »',
  );
  ok(
    (await thumb.locator('.fd-mt__ini').evaluate((e) => getComputedStyle(e).backgroundColor)) ===
      'rgb(251, 240, 245)',
    'initiales : fond du jeton primary-soft',
  );
  ok(
    await page
      .locator('.stg-sec')
      .first()
      .locator('.stg-row')
      .first()
      .evaluate((el) => el.classList.contains('pf-photo')),
    'la ligne « Photo » est avant « Nom »',
  );
  const input = row.locator('input[type=file]');
  ok(
    (await input.getAttribute('accept')) === 'image/jpeg,image/png,image/webp',
    'sélecteur : JPG, PNG, WebP',
  );

  // ===== Erreurs =====
  await input.setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('bonjour') });
  ok(
    (await page.getByRole('alert').innerText()) === 'Ce fichier n’est pas une image JPG, PNG ou WebP.',
    'type refusé : message en alerte',
  );
  await input.setInputFiles({
    name: 'grande.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
  });
  ok(
    (await page.getByRole('alert').innerText()) === 'Cette image dépasse 2\u00a0Mo.',
    'plus de 2 Mo : message en alerte',
  );

  // ===== Recadrage =====
  await input.setInputFiles({
    name: 'portrait.png',
    mimeType: 'image/png',
    buffer: await png(page, 800, 600),
  });
  const dlg = page.getByRole('dialog', { name: 'Recadrer la photo' });
  await dlg.waitFor();
  // Les mesures attendent la fin de l'animation d'ouverture (échelle) de la modale
  await dlg.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
  ok((await page.getByRole('alert').count()) === 0, 'image valide : plus d’erreur');
  const box = await dlg.locator('.pf-crop__box').boundingBox();
  const prev = await dlg.locator('.pf-crop__preview').evaluate((el) => ({
    w: el.getBoundingClientRect().width,
    r: getComputedStyle(el).borderRadius,
  }));
  ok(Math.round(box.width) === Math.round(box.height), `zone carrée (${Math.round(box.width)} px)`);
  ok(Math.round(prev.w) === 96 && prev.r === '50%', 'aperçu rond de 96 px');
  const ratio = await dlg
    .locator('.pf-crop__box .pf-crop__img')
    .evaluate((el) => el.getBoundingClientRect().width / el.getBoundingClientRect().height);
  ok(Math.abs(ratio - 800 / 600) < 0.01, `image non déformée, couvre la zone (rapport ${ratio.toFixed(3)})`);
  const zoom = dlg.getByRole('slider', { name: /Zoom/ });
  ok(
    (await zoom.getAttribute('aria-valuemin')) === '100' &&
      (await zoom.getAttribute('aria-valuemax')) === '300' &&
      (await zoom.getAttribute('aria-valuetext')) === '100\u00a0%',
    'zoom de 100 à 300 %',
  );
  const tx = () => dlg.locator('.pf-crop__box .pf-crop__img').evaluate((el) => el.style.transform);
  const t0 = await tx();
  await dlg.locator('.pf-crop__box').focus();
  await page.keyboard.press('ArrowRight');
  const t1 = await tx();
  const dx = (s) => Number(/translate\((-?[\d.]+)px/.exec(s)[1]);
  ok(Math.abs(dx(t0) - dx(t1) - 8) < 0.01, `flèche : 8 px (${t0} → ${t1})`);
  // COMP-01 §6 : curseur maison au clavier (Page haut = 10 pas, Fin et Début = bornes)
  await zoom.focus();
  await page.keyboard.press('End');
  ok((await zoom.getAttribute('aria-valuenow')) === '300', 'curseur : Fin va à la borne haute');
  await page.keyboard.press('Home');
  for (let i = 0; i < 10; i++) await page.keyboard.press('PageUp');
  ok(
    (await dlg.locator('.pf-crop__zoom .muted').innerText()) === '200\u00a0%' &&
      (await zoom.getAttribute('aria-valuetext')) === '200\u00a0%',
    'zoom à 200 % (Début puis 10 × Page haut)',
  );
  ok((await dlg.locator('input[type=range]').count()) === 0, 'aucun curseur natif');
  await dlg.getByRole('button', { name: 'Enregistrer la photo' }).click();
  await dlg.waitFor({ state: 'hidden' });
  await page.waitForTimeout(500);
  const enc = await page.evaluate(() => window.__encoded);
  ok(
    enc && enc.w === 256 && enc.h === 256 && enc.type === 'image/webp',
    `réencodée en 256 × 256 WebP (${JSON.stringify(enc)})`,
  );
  const me = state.tables.profiles.find((p) => p.id === 'u-alice');
  ok(
    /^u-alice\/[0-9a-f-]{36}\.webp$/.test(me.avatar_path || ''),
    `chemin <uid>/<uuid>.webp (${me.avatar_path})`,
  );
  ok(
    Object.keys(state.storage).includes(`avatars/${me.avatar_path}`),
    'fichier déposé dans le bucket avatars',
  );

  // ===== La photo remplace l'initiale =====
  await row.locator('.fd-mt .av-photo').waitFor();
  const photo = await row.locator('.fd-mt .av-photo').evaluate((el) => ({
    fit: getComputedStyle(el).objectFit,
    alt: el.getAttribute('alt'),
    src: el.getAttribute('src'),
  }));
  ok(
    photo.fit === 'cover' && photo.alt === '' && /sign\/avatars\//.test(photo.src),
    'Profil : photo (cover, décorative, URL signée)',
  );
  ok((await page.locator('.user-block .avatar .av-photo').count()) === 1, 'barre latérale : photo');
  const more = row.getByRole('button', { name: 'Options pour la photo de profil' });
  ok(
    (await more.count()) === 1 && (await more.getAttribute('aria-haspopup')) === 'menu',
    'avec une photo : bouton ⋯ « Options pour la photo de profil »',
  );
  await more.click();
  ok(
    (await page.getByRole('menuitem').allInnerTexts()).map((x) => x.trim()).join('|') ===
      'Remplacer…|Retirer',
    'menu ⋯ : « Remplacer… » et « Retirer »',
  );
  await page.keyboard.press('Escape');

  // ===== Retirer =====
  const old = me.avatar_path;
  await more.click();
  await page.getByRole('menuitem', { name: 'Retirer' }).click();
  await page.waitForTimeout(500);
  ok(
    me.avatar_path === null && !(`avatars/${old}` in state.storage),
    'Retirer : fichier supprimé, chemin effacé',
  );
  ok(
    (await row.locator('.fd-mt .av-photo').count()) === 0 &&
      (await page.locator('.user-block .avatar .av-photo').count()) === 0,
    'Retirer : l’initiale revient partout',
  );

  // ===== Co-membre : photo dans les commentaires ; image qui ne se charge pas =====
  state.tables.step_comments = [
    {
      id: 'c1',
      step_id: 's1',
      demo_id: DEMO,
      workspace_id: 'ws-1',
      author_id: 'u-bob',
      body: 'Remarque de Bob',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      resolved_at: null,
      resolved_by: null,
    },
  ];
  await page.evaluate(() =>
    localStorage.setItem('fd.comments.dock', JSON.stringify({ open: true, height: 320 })),
  );
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.locator('[data-comment="c1"] .cm-avatar .av-photo').waitFor();
  ok(true, 'commentaire d’un co-membre : sa photo');
  await page.route(/sign\/avatars\//, (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto(`${APP}/#/settings/members`);
  await page.reload();
  await page.waitForTimeout(1500);
  const bob = page.locator('tr, li, .st-member', { hasText: 'Bob Martin' }).locator('.avatar').first();
  ok(
    (await bob.locator('.av-photo').count()) === 0 && (await bob.innerText()).trim() === 'BM',
    'photo qui ne se charge pas : l’initiale, sans image cassée',
  );

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
