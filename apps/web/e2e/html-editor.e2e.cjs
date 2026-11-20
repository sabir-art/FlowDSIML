/**
 * Test e2e A8 (L20-01) : étape HTML dans l'éditeur (page en iframe sandbox, sélection à la souris
 * et au clavier, fil du sélecteur, barre d'actions, texte sur une étape puis sur toutes, masquage,
 * flou, lien vers une étape, annulation, élément introuvable, graphique non modifiable).
 * Données fictives (faux Supabase). Usage : SHOTS_DIR=… [THEME=dark] node e2e/html-editor.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const S = [
  '0b5c1f0e-0000-4000-8000-0000000000e1',
  '0b5c1f0e-0000-4000-8000-0000000000e2',
  '0b5c1f0e-0000-4000-8000-0000000000e3',
];
const page = (h1) => `<!doctype html><html><head><meta charset="utf-8"><title>${h1}</title><style>
  body{margin:0;font:16px system-ui,sans-serif;color:#1c1917;background:#fafaf9}
  nav{display:flex;gap:18px;padding:14px 24px;background:#fff;border-bottom:1px solid #e7e5e4}
  main{padding:24px}.kpi{display:inline-block;margin:0 16px 16px 0;padding:16px 20px;border-radius:12px;background:#fff;border:1px solid #e7e5e4}
  .value{display:block;font-size:28px}</style></head><body>
  <nav id="menu"><b>Acme Analytics</b><a href="https://app.acme.example/">Accueil</a><a href="https://app.acme.example/rapports">Rapports</a><a href="https://app.acme.example/facturation">Facturation</a></nav>
  <main><h1>${h1}</h1>
  <div class="kpi"><span>Rapports publiés</span><b class="value">312</b></div><div class="kpi"><span>Vues cette semaine</span><b class="value">86</b></div>
  <dl><dt>Responsable</dt><dd class="resp">Camille Fictive</dd></dl>
  <img data-fd-canvas alt="Graphique" width="300" height="120" src="data:image/webp;base64,UklGRhYAAABXRUJQVlA4TAoAAAAvAAAAAAfQ//73v/+BiOh/AAA=">
  </main></body></html>`;

(async () => {
  const b = await chromium.launch();
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => {
    // Script de thème du harnais (addInitScript) injecté aussi dans la page sandbox : sans objet
    if (!/lacks the 'allow-same-origin' flag/.test(e.message)) errors.push(e.message);
    if (process.env.DEBUG) console.log('# stack', e.stack);
  });
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const state = seed();
  const base = state.tables.steps.find((s) => s.demo_id === DEMO);
  const ws = state.tables.workspaces[0].id;
  state.htmlPages = {};
  const titles = ['Tableau de bord', 'Rapports', 'Équipe'];
  S.forEach((id, i) => {
    const path = `${ws}/${DEMO}/${id}.html`;
    state.htmlPages[path] = page(titles[i]);
    state.tables.steps.unshift({
      ...base,
      id,
      position: -3 + i,
      kind: 'html',
      title: titles[i],
      image_path: null,
      html_path: path,
      html_ops:
        i === 0
          ? [{ id: 'nf1', sel: 'a.export-disparu', op: 'hide', before: 'Exporter', scope: 'step' }]
          : [],
      html_meta: { title: titles[i], url: `https://app.acme.example/${i}`, viewport: { w: 1280, h: 720 } },
    });
  });
  state.tables.steps.sort((a, b) => a.position - b.position);
  await install(p, state);
  await p.goto(`${APP}/#/demos/${DEMO}/edit`);
  const frame = p.frameLocator('.html-stage iframe');
  await frame.locator('h1').waitFor();
  await p.waitForTimeout(500);
  const ops = (i = 0) => state.tables.steps.find((s) => s.id === S[i]).html_ops;

  ok(
    (await p.locator('.html-stage iframe').getAttribute('sandbox')) === 'allow-scripts',
    'iframe sandbox="allow-scripts"',
  );
  ok(
    (await p
      .locator(
        '.ed-rail [data-tool="hotspots"][aria-disabled="true"], .ed-rail [data-tool="blur"][aria-disabled="true"], .ed-rail [data-tool="zoom"][aria-disabled="true"]',
      )
      .count()) === 3,
    'L48-E : points, flou et zoom désactivés dans le rail',
  );
  ok(
    (await p.getByText('Élément introuvable dans la nouvelle capture').count()) === 1,
    'élément introuvable signalé',
  );
  ok(
    (await p.getByRole('button', { name: 'Supprimer la modification de a.export-disparu' }).count()) === 1,
    'élément introuvable : bouton « Supprimer » nommé',
  );

  // Sélection à la souris
  await frame.locator('div.kpi').first().locator('b.value').click();
  const bar = p.getByRole('toolbar', { name: 'Actions sur l’élément sélectionné' });
  await bar.waitFor();
  const crumbs = await p.getByRole('group', { name: 'Fil du sélecteur' }).innerText();
  ok(
    /Étape HTML/.test(crumbs) &&
      /body › main › div\.kpi › b\.value/.test(crumbs.replace(/\s+/g, ' ').replace(/ › /g, ' › ')),
    `fil du sélecteur (${crumbs.replace(/\s+/g, ' ')})`,
  );
  ok((await p.getByText('Élément · b.value').count()) === 1, 'panneau « Élément · b.value »');
  // La barre ne couvre pas l'élément
  const elBox = await frame.locator('div.kpi').first().locator('b.value').boundingBox();
  const barBox = await bar.boundingBox();
  ok(
    barBox && elBox && (barBox.y >= elBox.y + elBox.height - 1 || barBox.y + barBox.height <= elBox.y + 1),
    'barre d’actions sous ou au-dessus de l’élément, sans le couvrir',
  );
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/l20-01-editeur-html${sfx}.png` });

  // Texte : cette étape
  await p.getByLabel('Texte', { exact: true }).fill('1 248');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(1300);
  ok(
    ops(0).some((o) => o.op === 'text' && o.value === '1 248' && o.before === '312' && o.scope === 'step'),
    'texte modifié sur l’étape',
  );
  ok((await frame.locator('div.kpi').first().locator('b.value').innerText()) === '1 248', 'page mise à jour');
  ok((await p.getByText('« 312 » → « 1 248 »').count()) === 1, 'modification listée « avant → après »');

  // Toutes les étapes
  await p.getByRole('radio', { name: 'Toutes les étapes (3)' }).click();
  await p.getByLabel('Texte', { exact: true }).fill('2 000');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(1300);
  const g = ops(0).find((o) => o.op === 'text')?.group;
  ok(
    !!g && ops(1).some((o) => o.group === g && o.value === '2 000') && ops(2).some((o) => o.group === g),
    'texte appliqué sur toutes les étapes (même groupe)',
  );
  await p.getByRole('button', { name: 'Annuler la modification du texte de div.kpi › b.value' }).click();
  await p.waitForTimeout(1300);
  ok(
    ![0, 1, 2].some((i) => ops(i).some((o) => o.op === 'text')),
    'une seule annulation retire le groupe partout',
  );
  await p.getByRole('radio', { name: 'Cette étape' }).click();

  // Masquer au clavier (Suppr) puis flou et lien
  await frame.locator('#menu a').nth(2).click();
  await bar.waitFor();
  await frame.locator('body').press('Delete');
  await p.waitForTimeout(1300);
  ok(
    ops(0).some((o) => o.op === 'hide' && /Facturation/.test(o.before ?? '')),
    'Suppr : élément masqué',
  );
  ok(
    (await frame.locator('#menu a').nth(2).getAttribute('data-fd-hidden')) === '',
    'masqué : barré et estompé dans l’éditeur',
  );
  await frame.locator('dd.resp').click();
  await bar.getByRole('button', { name: 'Flouter' }).click();
  await p.waitForTimeout(1300);
  ok(
    ops(0).some((o) => o.op === 'blur'),
    'élément flouté',
  );
  ok((await frame.locator('dd.resp').innerText()) === 'Xxxxxxx Xxxxxxx', 'flou : texte remplacé');
  await frame.locator('#menu a').nth(1).click();
  await bar.getByRole('button', { name: 'Lier à une étape' }).click();
  await p.getByRole('menuitemradio', { name: /Lier à l’étape 2/ }).click();
  await p.waitForTimeout(1300);
  ok(
    ops(0).some((o) => o.op === 'link' && o.value === S[1]),
    'lien vers l’étape 2',
  );

  // Clavier : Tab (élément suivant), Échap (parent)
  await frame.locator('h1').click();
  await frame.locator('body').press('Escape');
  await p.waitForTimeout(200);
  ok((await p.getByText('Élément · main').count()) === 1, 'Échap : élément parent');
  await frame.locator('body').press('Tab');
  await p.waitForTimeout(200);
  ok((await p.getByText(/^Élément · /).innerText()) !== 'Élément · main', 'Tab : élément suivant');
  // Fil : retour au parent par bouton (depuis la sélection courante)
  const trail = p.getByRole('group', { name: 'Fil du sélecteur' });
  const parentBtn = trail.getByRole('button').nth(-2);
  const parentLabel = ((await parentBtn.getAttribute('aria-label')) ?? '').replace('Sélectionner ', '');
  await parentBtn.click();
  await p.waitForTimeout(300);
  ok(
    (await p.getByText(`Élément · ${parentLabel}`).count()) === 1,
    `fil du sélecteur : parent sélectionné (${parentLabel})`,
  );

  // Graphique en canvas : texte non modifiable
  await frame.locator('h1').click();
  await p.waitForTimeout(200);
  await frame.locator('img[data-fd-canvas]').click();
  await p.getByText('Élément · img').waitFor();
  // Graphique capturé en image : il se remplace (L28-05), il ne se réécrit pas
  ok(
    (await bar.getByRole('button', { name: 'Modifier le texte', exact: true }).count()) === 0 &&
      (await bar.getByRole('button', { name: 'Remplacer l’image', exact: true }).count()) === 1 &&
      (await p.getByRole('group', { name: 'Image' }).count()) === 1,
    'graphique (image) : « Remplacer l’image » dans la barre et section « Image »',
  );
  // Introuvable : suppression
  await p.getByRole('button', { name: 'Supprimer la modification de a.export-disparu' }).click();
  await p.waitForTimeout(1300);
  ok(!ops(0).some((o) => o.id === 'nf1'), 'modification introuvable supprimée');
  // L20-01 : capture avec de vraies modifications (texte avant → après, élément masqué, flou, lien)
  await frame.locator('div.kpi').first().locator('b.value').click();
  await p.getByLabel('Texte', { exact: true }).fill('1 248');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(1300);
  ok(
    (await p.getByRole('button', { name: /Annuler la modification du texte/ }).count()) >= 1,
    'modification de texte annulable (bouton nommé)',
  );
  if (SHOTS) {
    await p
      .locator('.panel')
      .getByText(/Modifications de l’étape/)
      .evaluate((el) => {
        let q = el.parentElement;
        while (q && q.scrollHeight <= q.clientHeight) q = q.parentElement;
        if (q) q.scrollTop += el.getBoundingClientRect().top - q.getBoundingClientRect().top - 120;
      });
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${SHOTS}/l20-01-modifications${sfx}.png` });
  }
  ok(errors.length === 0, `aucune erreur (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
