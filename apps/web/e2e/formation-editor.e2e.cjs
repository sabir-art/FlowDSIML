/**
 * Test e2e L17-02 (éditeur) : étape Avant / Après (ajout depuis le rail, outils masqués, publication
 * bloquée sans les deux captures, copie d'une étape avec ses flous, image importée, disposition,
 * libellés, notes) et réglage « Glossaire » d'une démo.
 * Données fictives (faux Supabase). Usage : SHOTS_DIR=… [THEME=dark] node e2e/formation-editor.e2e.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const N = ' ';

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
    await page.waitForFunction(() =>
      document
        .getAnimations()
        .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
    );
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}${sfx}.png` });
  };
  const state = seed();
  // Une zone floutée sur l'écran 1 : elle doit suivre la copie
  // Flou sur l'adresse e-mail (en haut à droite) : le titre de la capture reste lisible
  state.tables.steps[0].blurs = [{ x: 0.8, y: 0.0, w: 0.19, h: 0.07, style: 'blur' }];
  await install(page, state);
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');

  // Ajout depuis le rail
  await page.locator('.rail-foot').getByRole('button', { name: 'Ajouter une étape' }).click();
  await page.getByRole('menuitem', { name: 'Avant / Après' }).click();
  await page.waitForSelector('.ba-canvas');
  const ba = state.tables.steps.find((s) => s.kind === 'before_after');
  ok(!!ba && ba.options.beforeAfter.layout === 'side', 'Étape before_after créée (côte à côte par défaut)');
  ok(
    (await page
      .locator(
        '.ed-rail [data-tool="hotspots"][aria-disabled="true"], .ed-rail [data-tool="blur"][aria-disabled="true"], .ed-rail [data-tool="zoom"][aria-disabled="true"]',
      )
      .count()) === 3,
    'L48-E : points, flou et zoom désactivés dans le rail',
  );
  // MEDIA-01 §18.3 : deux zones larges côte à côte, titrées « Avant » et « Après », même hauteur
  const zones = page.locator('.ba-canvas .ba-zone');
  ok((await zones.count()) === 2, 'Deux zones d’envoi sur le canevas');
  const zr = await zones.evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.left),
        y: Math.round(r.top),
        h: Math.round(r.height),
        t: el.querySelector('b').textContent,
        n: el.getAttribute('aria-label'),
      };
    }),
  );
  // COMP-01 §18.3 : la pastille porte le libellé de l'étape ; le titre de la zone ne le répète pas
  ok(
    zr[0].t === 'Ajouter la capture' &&
      zr[1].t === 'Ajouter la capture' &&
      zr[0].n === `Capture «${N}Avant${N}»` &&
      zr[1].n === `Capture «${N}Maintenant${N}»`,
    `zones titrées « Ajouter la capture », nommées par leur côté (${zr.map((z) => z.n).join(', ')})`,
  );
  ok(
    (await page.locator('.ba-canvas .ba-pill').allTextContents()).join('|') === 'Avant|Maintenant',
    'pastilles : libellés de l’étape, une seule fois par côté',
  );
  // Panneau de 320 px : une capture vide tient sur une ligne, sans phrase d'aide
  const slots = await page.locator('.ba-slot.is-empty').evaluateAll((els) =>
    els.map((el) => {
      const r = (q) => el.querySelector(q).getBoundingClientRect();
      const mid = (b) => b.top + b.height / 2;
      return {
        text: el.querySelector('.ba-slot-text').textContent,
        thumb: Math.round(r('.ba-thumb').width),
        line: r('.ba-slot-text b').height < 24,
        aligned: Math.abs(mid(r('.ba-thumb')) - mid(r('button'))) <= 1,
        h: Math.round(el.getBoundingClientRect().height),
      };
    }),
  );
  ok(
    slots.length === 2 &&
      slots.every((x) => x.text === 'Aucune capture' && x.thumb === 40 && x.line && x.aligned && x.h <= 64),
    `panneau : capture vide sur une ligne, vignette 40 px (${JSON.stringify(slots[0])})`,
  );
  ok(zr[0].y === zr[1].y && zr[0].h === zr[1].h && zr[0].x < zr[1].x, 'zones côte à côte, même hauteur');
  ok(
    /PNG, JPEG ou WebP, 10 Mo au plus\./.test(await zones.first().innerText()) &&
      (await zones.first().getByRole('button', { name: 'Importer…' }).count()) === 1,
    'zone : formats et poids dans l’aide, « Importer… »',
  );
  // Les deux boutons d'une zone restent dans leur colonne (8 px au moins entre les deux zones)
  const zb = await zones.evaluateAll((els) =>
    els.map((el) => {
      const z = el.getBoundingClientRect();
      const inside = [...el.querySelectorAll('button')].every((b) => {
        const r = b.getBoundingClientRect();
        return r.left >= z.left + 8 && r.right <= z.right - 8;
      });
      return { l: z.left, r: z.right, inside };
    }),
  );
  ok(
    zb.every((z) => z.inside) && zb[1].l - zb[0].r >= 8,
    `zones : boutons dans la zone, zones séparées (${Math.round(zb[1].l - zb[0].r)} px)`,
  );
  await shot('l17-02-zones-vides');
  // « Choisir une étape… » dans la zone : même choix que le panneau
  await zones.nth(1).getByRole('button', { name: 'Choisir une étape…' }).click();
  const zp = page.getByRole('dialog', { name: `Capture «${N}Maintenant${N}»${N}: choisir une étape` });
  await zp.waitFor();
  ok(
    (await zp.getByRole('button', { name: /Étape 1/ }).count()) === 1,
    'zone : « Choisir une étape… » ouvre le choix',
  );
  await page.keyboard.press('Escape');
  await zp.waitFor({ state: 'detached' });
  await page
    .locator('#ba-zone-before')
    .setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
  await zones.first().getByRole('alert').waitFor();
  ok(
    /^Format non accepté\s: PNG, JPEG ou WebP\.$/.test(
      await zones.first().getByRole('alert').textContent(),
    ) && (await zones.nth(1).getByRole('alert').count()) === 0,
    'fichier refusé : erreur dans la zone concernée seulement',
  );

  // Publication bloquée
  await page
    .locator('.ed-bar')
    .getByRole('button', { name: /^Publier/ })
    .first()
    .click();
  const alert = page.locator('.publish-error');
  await alert.waitFor();
  const n =
    state.tables.steps
      .filter((s) => s.demo_id === DEMO)
      .sort((x, y) => x.position - y.position)
      .findIndex((s) => s.kind === 'before_after') + 1;
  ok(
    (await alert.textContent()).includes(`L’étape ${n} Avant / Après n’a pas ses deux captures.`),
    'Publication bloquée sans les deux captures',
  );

  // Message de publication effacé pour la suite (rechargement de l'éditeur)
  await page.reload();
  await page.waitForSelector('.canvas-frame img');
  await page.locator(`[data-step-index="${n - 1}"]`).click();
  await page.waitForSelector('.ba-canvas');

  // Capture « Avant » : copie de l'étape 1 (avec ses flous)
  const before = page.locator('.ba-slot').first();
  await before.getByRole('button', { name: 'Choisir', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Choisir une étape de la démo' }).click();
  const picker = page.getByRole('dialog', { name: `Capture «${N}Avant${N}»${N}: choisir une étape` });
  await picker.waitFor();
  await picker.getByRole('button', { name: /Étape 1/ }).click();
  await page.waitForFunction(() => !document.querySelector('.ba-pic.is-old .ba-zone'));
  ok(
    state.copies?.length === 1 && state.copies[0].from === state.tables.steps[0].image_path,
    'Capture copiée dans le stockage (indépendante de l’étape source)',
  );
  ok(
    ba.before_image_path && ba.before_image_path !== state.tables.steps[0].image_path,
    'Nouveau chemin pour « Avant »',
  );
  ok(ba.before_blurs.length === 1, 'Flous de l’étape source copiés');
  ok((await before.locator('.ba-slot-text b').textContent()) === 'Étape 1', 'Source « Étape 1 »');

  // Capture « Maintenant » : image importée
  const after = page.locator('.ba-slot').nth(1);
  await after.getByRole('button', { name: 'Choisir', exact: true }).click();
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('menuitem', { name: 'Importer une image' }).click(),
  ]);
  await chooser.setFiles({
    name: 'nouvel-outil.png',
    mimeType: 'image/png',
    buffer: fs.readFileSync(path.join(__dirname, 'fixture.png')),
  });
  await page.waitForFunction(() => document.querySelectorAll('.ba-canvas .ba-zone').length === 0);
  ok(
    ba.image_path && ba.options.beforeAfter.sources.after.kind === 'upload',
    'Image importée pour « Maintenant »',
  );
  ok(
    (await after.locator('.ba-slot-text small').textContent()) === 'nouvel-outil.png',
    'Nom de l’image importée',
  );
  ok(
    /n’est pas vérifiée automatiquement/.test(await page.locator('.ba-warn').textContent()),
    'Avertissement à l’import d’une image',
  );
  ok((await page.locator('#ba-l-before').inputValue()) === 'Avant', 'Libellé « Avant » prérempli');

  // Disposition, libellés, notes
  await page.getByRole('radio', { name: 'Curseur' }).click();
  await page.getByLabel('Après', { exact: true }).fill('Nouvel outil');
  await page.locator('#ba-n-before').fill('Rapports, puis Exporter, puis tableur.');
  await page.locator('#ba-n-after').fill('Bouton « Nouveau rapport » en haut à droite.');
  await page.waitForTimeout(900);
  ok(ba.options.beforeAfter.layout === 'slider', 'Disposition « Curseur » enregistrée');
  ok(ba.options.beforeAfter.labels.after === 'Nouvel outil', 'Libellé enregistré');
  ok(
    (await page.locator('.ba-note').textContent()).includes('Rapports, puis Exporter'),
    'Note sur le canevas',
  );
  await page.getByRole('radio', { name: 'Côte à côte' }).click();
  await page.waitForTimeout(600);
  // Panneau en haut (titre « ÉTAPE n » visible)
  await page.evaluate(() =>
    document.querySelectorAll('.ed-panel, .panel-body, aside').forEach((el) => (el.scrollTop = 0)),
  );
  await shot('l17-02-editeur');

  // Publication : capture « Avant » copiée et ses flous incrustés, manifeste sans flous ni sources
  state.tables.workspaces[0].public_links_enabled = true;
  await page
    .locator('.ed-bar')
    .getByRole('button', { name: /^Publier/ })
    .first()
    .click();
  const gdpr = page.locator('dialog.gdpr-dialog[open]');
  await gdpr.waitFor();
  ok(
    /1 image importée non vérifiée/.test(await gdpr.locator('.gdpr-summary').textContent()),
    'Bilan RGPD : « 1 image importée non vérifiée »',
  );
  await shot('l17-02-rgpd');
  for (const c of await gdpr.getByRole('checkbox').all()) await c.check();
  await gdpr
    .getByRole('button', { name: /Publier/ })
    .last()
    .click();
  await page.waitForFunction(
    () => location.hash.includes('share=') || !!document.querySelector('.publish-error'),
  );
  const v = state.tables.demo_versions.at(-1);
  const pubBa = v?.manifest.steps.find((s) => s.kind === 'before_after')?.beforeAfter;
  ok(
    !!pubBa && pubBa.layout === 'side' && !('sources' in pubBa),
    'Publication : beforeAfter publié, sans les sources',
  );
  ok(
    !!state.storage[`published/${DEMO}/assets/${ba.id}-b.webp`],
    'Publication : capture « Avant » déposée dans les fichiers publiés',
  );
  const latest = JSON.parse(state.storage[`published/${DEMO}/latest.json`].data.toString());
  ok(
    latest.steps.find((s) => s.kind === 'before_after').beforeAfter.beforeBlurs.length === 0,
    'Publication : flous « Avant » incrustés (absents du manifeste publié)',
  );
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.ed-bar');

  // Réglage « Glossaire » de la démo (Réglages > Lecture)
  await page.locator('.ed-rail [data-tool="settings"][aria-pressed="false"]').click();
  const gl = page.getByLabel('Glossaire', { exact: true });
  await gl.scrollIntoViewIfNeeded();
  ok(await gl.isChecked(), 'Glossaire activé par défaut pour la démo');
  await gl.uncheck();
  await page.waitForTimeout(900);
  ok(
    state.tables.demos.find((d) => d.id === DEMO).settings.glossary === false,
    'Glossaire désactivé pour la démo',
  );

  ok(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
