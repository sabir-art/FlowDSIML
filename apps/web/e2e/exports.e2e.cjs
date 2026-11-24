/** L15 : exports PDF et GIF d'une démo publiée (modale, aperçu, en cours, terminé, erreur). */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { seedExport } = require('./export-data.cjs');
const { pick } = require('./_select.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  async function open(opts = {}, route = '/#/') {
    const p = await b.newPage({
      viewport: { width: 1440, height: 900 },
      locale: 'fr-FR',
      acceptDownloads: true,
    });
    p.on('pageerror', (e) => errors.push(e.message));
    const s = seed();
    seedExport(s, opts);
    const state = await install(p, s);
    if (opts.failStep)
      await p.route(`**/storage/v1/object/sign/**/st-${opts.failStep}.webp*`, (r) =>
        r.fulfill({ status: 404, body: 'x' }),
      );
    await p.goto(`${APP}${route}`);
    await p.waitForTimeout(900);
    return { p, state };
  }
  const openFromMenu = async (p) => {
    await p
      .getByRole('button', { name: /Actions.*Créer une fiche usager/ })
      .first()
      .click();
    await p.getByRole('menuitem', { name: 'Exporter (PDF, GIF)' }).click();
    await p.waitForSelector('dialog.x15-dialog[open]');
    await p.waitForFunction(() =>
      /Créer une fiche usager/.test(document.querySelector('dialog.x15-dialog h2')?.textContent || ''),
    );
  };
  const help = (p) => p.locator('.x15-foot .fd-help').textContent();

  // L15-01 : modale, PDF par défaut, aperçu de la vraie page
  {
    const { p } = await open();
    await openFromMenu(p);
    const d = p.locator('dialog.x15-dialog');
    ok(
      (await d.locator('h2').textContent()).includes('Exporter «\u202fCréer une fiche usager\u202f»'),
      'L15-01 : titre de la modale',
    );
    await p.waitForFunction(() =>
      /\d+ pages/.test(document.querySelector('.x15-foot .fd-help')?.textContent || ''),
    );
    ok(/^8 pages/.test(await help(p)), 'L15-01 : 7 étapes + couverture = 8 pages');
    ok(!/balisé/.test(await help(p)), 'L15-01 : aucune promesse de PDF balisé');
    ok(await p.getByRole('radio', { name: /PDF/ }).first().isChecked(), 'L15-01 : PDF choisi par défaut');
    // L25-11 : la carte MP4 est active ; «\u202fHors ligne\u202f» reste «\u202fBientôt\u202f»
    const zip = p.getByRole('radio', { name: /Hors ligne/ });
    ok(
      (await zip.isDisabled()) &&
        /Bientôt/.test(await p.locator('label.exp-format', { has: zip }).textContent()),
      'L15-01 : hors ligne «\u202fBientôt\u202f»',
    );
    ok(!(await p.getByRole('radio', { name: /Vidéo MP4/ }).isDisabled()), 'L25-11 : MP4 sélectionnable');
    ok((await p.locator('.x15-svg').count()) === 1, 'L15-01 : aperçu rendu');
    ok((await p.locator('.x15-side .pager span').textContent()) === 'Page 1 sur\u00a08', 'L15-01 : pager');
    await p.getByRole('button', { name: 'Page suivante' }).click();
    ok(
      (await p.locator('.x15-svg text').allTextContents()).join(' ').includes('Ouvrir le menu Usagers'),
      'L15-01 : page 2 = étape 1',
    );
    ok((await p.locator('.x15-svg image').count()) === 1, 'L15-01 : capture dans l’aperçu');
    // Bulles sur les captures (activées par défaut) : l'aperçu montre la bulle, comme le fichier
    const titleCount = async () =>
      (await p.locator('.x15-svg text').allTextContents()).filter((x) => x.includes('Ouvrir le menu Usagers'))
        .length;
    const bubbles = p.getByRole('switch', { name: /Bulles sur les captures/ });
    ok(
      (await bubbles.isChecked()) && (await titleCount()) === 2,
      'bulle de l’étape dessinée sur la capture (aperçu)',
    );
    await bubbles.click();
    ok((await titleCount()) === 1, 'bulles coupées : capture sans bulle');
    await bubbles.click();
    await p.getByRole('radio', { name: 'Deux étapes par page' }).click();
    ok(/^5 pages/.test(await help(p)), 'L15-01 : deux étapes par page = 5 pages');
    await p.getByRole('radio', { name: 'Une étape par page' }).click();
    // Captures coupées : le texte ne peut plus être coupé
    await p.getByRole('switch', { name: /Captures d'écran/ }).click();
    const txt = p.getByRole('switch', { name: /Texte des bulles/ });
    ok(
      (await txt.isDisabled()) &&
        /au moins les captures ou le texte/.test(await p.locator('.x15-main').textContent()),
      'L15-01 : «\u202fIl faut au moins les captures ou le texte\u202f»',
    );
    ok(/^2 pages/.test(await help(p)), 'L15-01 : sans captures, couverture + liste');
    await p.getByRole('switch', { name: /Captures d'écran/ }).click();
    await p.getByRole('switch', { name: /Couverture et sommaire/ }).click();
    ok(/^7 pages/.test(await help(p)), 'L15-01 : sans couverture, 7 pages');
    await p.getByRole('switch', { name: /Couverture et sommaire/ }).click();

    // L15-03 / L15-04 : export PDF, téléchargement réel
    const [dl] = await Promise.all([
      p.waitForEvent('download'),
      p.getByRole('button', { name: 'Exporter en PDF' }).click(),
    ]);
    ok(dl.suggestedFilename() === 'creer-une-fiche-usager.pdf', 'L15-04 : nom tiré du titre');
    const buf = require('fs').readFileSync(await dl.path());
    const pdf = buf.toString('latin1');
    ok(pdf.startsWith('%PDF-') && /\/Count 8/.test(pdf), 'L15-04 : PDF de 8 pages');
    ok(
      pdf.includes('/Lang (fr-FR)') && /\/DisplayDocTitle true/.test(pdf),
      'L15-04 : langue et titre du document',
    );
    // L35 : PDF balisé (structure, titres, figures avec texte alternatif, marqué PDF/UA)
    ok(
      /\/StructTreeRoot/.test(pdf) && /\/Marked true/.test(pdf) && /\/S \/H1/.test(pdf),
      'L35 : PDF balisé (arbre de structure, titre de niveau 1)',
    );
    ok(
      (pdf.match(/\/S \/Figure/g) ?? []).length >= 7 && (pdf.match(/\/Alt [<(]/g) ?? []).length >= 7,
      'L35 : captures en figures avec texte alternatif',
    );
    ok(/pdfuaid:part/.test(pdf), 'L35 : identifiant PDF/UA dans les métadonnées');
    await p.waitForSelector('text=PDF prêt');
    ok(
      /8 pages · [\d,]+\s(Ko|Mo) · A4 portrait/.test(await p.locator('.exp-file small').textContent()),
      'L15-04 : pages, poids réel, format',
    );
    await p.getByRole('button', { name: 'Exporter dans un autre format' }).click();
    await p.getByRole('radio', { name: /GIF animé/ }).click();

    // L15-02 : GIF
    ok(
      /^17,5 secondes en boucle/.test(await help(p)) && /Au-delà de 15 étapes/.test(await help(p)),
      'L15-02 : durée = 7 × 2,5 s',
    );
    await p.getByRole('radio', { name: /Rapide/ }).click();
    ok(/^10,5 secondes/.test(await help(p)), 'L15-02 : vitesse rapide');
    await pick(p.getByLabel('Étapes', { exact: true }), 'range');
    await pick(p.getByLabel(/^À l.étape/), '2');
    ok(/^4,5 secondes/.test(await help(p)), 'L15-02 : plage de 3 étapes');
    await p.getByRole('switch', { name: 'Lecture en boucle' }).click();
    ok(/lecture unique/.test(await help(p)), 'L15-02 : lecture unique');
    await pick(p.getByLabel('Taille'), '640');
    ok(
      (await p.locator('.gif-meta span').textContent()).startsWith('Étape'),
      'L15-02 : barre «\u202fÉtape n sur N\u202f»',
    );
    const [g] = await Promise.all([
      p.waitForEvent('download', { timeout: 60000 }),
      p.getByRole('button', { name: 'Exporter en GIF' }).click(),
    ]);
    const gif = require('fs').readFileSync(await g.path());
    ok(
      g.suggestedFilename() === 'creer-une-fiche-usager.gif' && gif.toString('latin1', 0, 6) === 'GIF89a',
      'L15-04 : GIF valide',
    );
    ok(
      !gif.toString('latin1').includes('NETSCAPE2.0'),
      'L15-02 : sans boucle, pas d’extension de répétition',
    );
    ok(gif.readUInt16LE(6) === 640 && gif.readUInt16LE(8) === 436, 'L15-02 : 640 px de large');
    await p.waitForSelector('text=GIF prêt');
    ok(
      /4,5\ss · .* · 640 × 436\spx/.test(await p.locator('.exp-file small').textContent()),
      'L15-04 : durée et taille du GIF',
    );
    await p.close();
  }

  // L15-05 : capture introuvable → erreur, repli sans les captures
  {
    const { p } = await open({ failStep: 5 });
    await openFromMenu(p);
    await p.waitForFunction(() =>
      /\d+ pages/.test(document.querySelector('.x15-foot .fd-help')?.textContent || ''),
    );
    await p.getByRole('button', { name: 'Exporter en PDF' }).click();
    await p.waitForSelector('dialog[role="alertdialog"]');
    ok(
      (await p.locator('dialog.x15-dialog h2').textContent()) === 'L’export n’a pas abouti' ||
        /L.export n.a pas abouti/.test(await p.locator('dialog.x15-dialog h2').textContent()),
      'L15-05 : titre de l’erreur',
    );
    ok(
      /capture de l'étape 5/.test(await p.locator('dialog.x15-dialog').textContent()),
      'L15-05 : étape en cause',
    );
    ok(
      /Choisir la structure de rattachement/.test(await p.locator('.err-box').textContent()),
      'L15-05 : détail',
    );
    const [dl] = await Promise.all([
      p.waitForEvent('download'),
      p.getByRole('button', { name: 'Exporter sans les captures' }).click(),
    ]);
    ok(
      /\/Count 2/.test(
        require('fs')
          .readFileSync(await dl.path())
          .toString('latin1'),
      ),
      'L15-05 : repli sans captures (2 pages)',
    );
    await p.close();
  }

  // Annulation pendant l'export
  {
    const { p } = await open();
    await openFromMenu(p);
    await p.getByRole('radio', { name: /GIF animé/ }).click();
    await pick(p.getByLabel('Taille'), '1280');
    await p.getByRole('button', { name: 'Exporter en GIF' }).click();
    await p.waitForSelector('[role="progressbar"]');
    ok(
      (await p.locator('.x15-dialog h2').textContent()) === 'Export GIF en cours',
      'L15-03 : export en cours',
    );
    ok(/onglet ouvert/.test(await p.locator('.x15-dialog').textContent()), 'L15-03 : garder l’onglet ouvert');
    await p
      .getByRole('button', { name: 'Annuler l’export' })
      .or(p.getByRole('button', { name: "Annuler l'export" }))
      .click();
    await p.waitForSelector('.x15-dlg[open]');
    ok(true, 'L15-03 : annulation, retour aux options');
    await p.close();
  }

  // Brouillon : l'export n'est pas proposé, un message explique pourquoi
  {
    const { p } = await open({ published: false }, `/#/demos/${DEMO}/share`);
    // §1 : l'export est un mode de la fenêtre Partager
    await p.locator('.shd-nav').getByRole('button', { name: 'Exporter', exact: true }).click();
    await p.locator('#sh-panel-export').getByRole('button', { name: 'Exporter (PDF, GIF)' }).click();
    await p.waitForSelector('dialog.x15-dialog[open]');
    ok(
      /jamais été publiée/.test(await p.locator('dialog.x15-dialog').textContent()),
      'Brouillon : message explicatif',
    );
    ok(
      (await p.getByRole('button', { name: 'Exporter en PDF' }).count()) === 0,
      'Brouillon : aucun bouton d’export',
    );
    await p.close();
  }

  // Point d'entrée : éditeur
  {
    const { p } = await open({}, `/#/demos/${DEMO}/edit`);
    await p.getByRole('button', { name: 'Plus d’options' }).first().click();
    await p.getByRole('menuitem', { name: 'Exporter (PDF, GIF)' }).click();
    await p.waitForSelector('dialog.x15-dialog[open]');
    await p.waitForTimeout(800);
    const eh = await p.locator('dialog.x15-dialog h2').textContent();
    ok(eh.includes('Créer une fiche usager'), `Éditeur : modale d’export (${eh})`);
    await p.close();
  }

  ok(errors.length === 0, `aucune erreur de page${errors.length ? ` : ${errors.join(' | ')}` : ''}`);
  await b.close();
})();
