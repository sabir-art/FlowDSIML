/**
 * Test e2e L25-11 / L25-12 : export vidéo MP4 (options, durée calculée, en cours, prêt, .vtt),
 * navigateur sans WebCodecs, limite de 10 minutes. Données fictives.
 * Usage : SHOTS_DIR=… [THEME=dark] node e2e/export-mp4.e2e.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const { install, seed } = require('./fake-supabase.cjs');
const { seedExport } = require('./export-data.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const shot = async (p, name) => {
    await p.waitForTimeout(300);
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}${sfx}.png` });
  };
  async function open(opts = {}, init) {
    const ctx = await themedContext(b, {
      viewport: { width: 1440, height: 900 },
      locale: 'fr-FR',
      acceptDownloads: true,
    });
    const p = await ctx.newPage();
    if (init) await p.addInitScript(init);
    p.on('pageerror', (e) => errors.push(e.message));
    const s = seed();
    seedExport(s, opts);
    await install(p, s);
    await p.goto(`${APP}/#/`);
    await p.waitForTimeout(900);
    await p
      .getByRole('button', { name: /Actions.*Créer une fiche usager/ })
      .first()
      .click();
    await p.getByRole('menuitem', { name: /Exporter/ }).click();
    await p.waitForSelector('dialog.x15-dialog[open]');
    await p.waitForFunction(() =>
      /\d+ pages/.test(document.querySelector('.x15-foot .fd-help')?.textContent || ''),
    );
    return p;
  }
  // Espaces insécables (milliers, unités) ramenées à des espaces simples pour les comparaisons
  const sp = (x) => (x || '').replace(/[\u00a0\u202f]/g, ' ');
  const help = async (p) => sp(await p.locator('.x15-foot .fd-help').textContent());

  // ===== L25-11 : options =====
  {
    const p = await open();
    await p.getByRole('radio', { name: /Vidéo MP4/ }).click();
    ok(
      (await p.getByRole('radio', { name: /Vidéo MP4/ }).getAttribute('aria-checked')) === 'true',
      'carte MP4 active',
    );
    const formats = await p
      .getByLabel('Format de l’image')
      .or(p.getByLabel("Format de l'image"))
      .locator('option')
      .allTextContents()
      .then((a) => a.map(sp));
    ok(
      formats.length === 4 &&
        formats[0].includes('1 920 × 1 080 (recommandé)') &&
        formats[3].startsWith('9:16'),
      `formats proposés (${formats.join(' | ')})`,
    );
    ok(
      /^Durée : 20,5 s/.test(await help(p)) && /Son des étapes vidéo seulement/.test(await help(p)),
      `durée calculée : 7 × 2,5 + 3 (${await help(p)})`,
    );
    await p.getByRole('switch', { name: 'Écran de titre' }).click();
    ok(/^Durée : 17,5 s/.test(await help(p)), 'sans écran de titre : 17,5 s');
    await p.getByRole('switch', { name: 'Écran de titre' }).click();
    ok(
      (await p
        .getByRole('radio', { name: 'Fichier .vtt à part (recommandé)' })
        .getAttribute('aria-checked')) === 'true',
      'sous-titres : fichier .vtt par défaut',
    );
    ok(
      /n'est pas accessible|n’est pas accessible/.test(await p.locator('.x15-dialog').textContent()),
      'aide : accessibilité des sous-titres',
    );
    await p.getByLabel('Étapes', { exact: true }).selectOption('range');
    await p.getByLabel(/^À l.étape/).selectOption('2');
    await p.getByLabel("Format de l'image").selectOption('1280x720');
    await shot(p, 'l25-11-mp4');

    // ===== L25-12 : en cours puis prêt =====
    const downloads = [];
    p.on('download', (d) => downloads.push(d));
    await p.getByRole('button', { name: 'Créer la vidéo' }).click();
    await p.waitForSelector('.exp-progress [role="progressbar"]');
    const steps = await p.locator('.exp-steps li').allTextContents();
    ok(
      steps.length === 4 &&
        steps[1].startsWith('Rendu des images (étape') &&
        steps[3] === 'Sous-titres (.vtt)',
      `étapes de l'export (${steps.join(' | ')})`,
    );
    ok(
      (await p.getByRole('button', { name: "Annuler l'export" }).count()) +
        (await p.getByRole('button', { name: 'Annuler l’export' }).count()) ===
        1,
      '« Annuler l’export »',
    );
    await shot(p, 'l25-12-mp4-en-cours');
    await p.waitForSelector('text=Vidéo prête', { timeout: 120000 });
    await p.waitForTimeout(500);
    const files = (await p.locator('.exp-file').allTextContents()).map(sp);
    ok(files.length === 2, 'deux fichiers : .mp4 et .fr.vtt');
    ok(
      /creer-une-fiche-usager\.mp4/.test(files[0]) &&
        /10,5\ss · 1 280 × 720 · [\d,]+\s(Ko|Mo)/.test(files[0]),
      `vidéo : durée, taille, poids réel (${files[0]})`,
    );
    ok(
      /creer-une-fiche-usager\.fr\.vtt/.test(files[1]) && /3 répliques/.test(files[1]),
      `sous-titres : nombre de répliques (${files[1]})`,
    );
    ok(
      /Joignez toujours le fichier \.vtt/.test(await p.locator('.x15-dialog').textContent()),
      'aide : joindre le .vtt',
    );
    await shot(p, 'l25-12-mp4-termine');
    const mp4 = downloads.find((d) => d.suggestedFilename().endsWith('.mp4'));
    const vtt = downloads.find((d) => d.suggestedFilename().endsWith('.vtt'));
    const bytes = mp4 ? fs.readFileSync(await mp4.path()) : Buffer.alloc(0);
    if (process.env.KEEP_MP4 && mp4) fs.copyFileSync(await mp4.path(), process.env.KEEP_MP4);
    ok(
      bytes.toString('latin1', 4, 8) === 'ftyp' && bytes.includes(Buffer.from('avc1')),
      'MP4 valide (ftyp, H.264)',
    );
    const text = vtt ? fs.readFileSync(await vtt.path(), 'utf8') : '';
    ok(
      text.startsWith('WEBVTT') && text.includes('00:00:03.000 --> 00:00:05.500'),
      'fichier .vtt (répliques après l’écran de titre)',
    );
    await p.context().close();
  }

  // ===== Sans WebCodecs : carte visible, désactivée =====
  {
    const p = await open({}, () => {
      delete window.VideoEncoder;
    });
    const card = p.getByRole('radio', { name: /Vidéo MP4/ });
    ok(
      (await card.getAttribute('aria-disabled')) === 'true' &&
        /Votre navigateur ne permet pas de créer une vidéo/.test(await card.textContent()),
      'sans WebCodecs : carte désactivée avec l’aide',
    );
    await p.context().close();
  }

  ok(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
