/**
 * Test e2e L25-07 à L25-10 : styles en masse, graphique modifiable (étape HTML), jeu de données CSV,
 * embranchement conditionnel. Données fictives (faux Supabase).
 * Usage : SHOTS_DIR=… [THEME=dark] [ONLY=styles,graphique,donnees,conditions] node e2e/editeur-donnees.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const ONLY = (process.env.ONLY || 'styles,graphique,donnees,conditions').split(',');
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const S = ['0b5c1f0e-0000-4000-8000-0000000000e1', '0b5c1f0e-0000-4000-8000-0000000000e2'];
const page = (h1) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${h1}</title><style>
  body{margin:0;font:16px system-ui,sans-serif;color:#1c1917;background:#fafaf9}
  nav{display:flex;gap:18px;padding:14px 24px;background:#fff;border-bottom:1px solid #e7e5e4}
  main{padding:24px}.kpi{display:inline-block;margin:0 16px 16px 0;padding:16px 20px;border-radius:12px;background:#fff;border:1px solid #e7e5e4}
  .value{display:block;font-size:28px}
  .chart{background:#fff;border:1px solid #e7e5e4;border-radius:12px;padding:16px 20px;width:420px}
  .chart h2{font-size:15px;margin:0 0 12px}.bars{display:flex;align-items:flex-end;gap:18px;height:150px}
  .bar-item{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:12px}
  .bar-item i{display:block;width:36px;border-radius:4px 4px 0 0}</style></head><body>
  <nav id="menu"><b>Acme Analytics</b><a href="https://app.acme.example/">Accueil</a><a href="https://app.acme.example/rapports">Rapports</a></nav>
  <main><h1>${h1}</h1>
  <div class="kpi"><span>Rapports publiés</span><b class="value">1 248</b></div><div class="kpi"><span>Vues cette semaine</span><b class="value">86</b></div><div class="kpi"><span>Nouveaux ce mois</span><b class="value">42</b></div>
  <section class="chart"><h2>Rapports par mois</h2><div class="bars">
    <div class="bar-item"><b>18</b><i style="height:54px;background:#2897D5"></i><span>juil.</span></div>
    <div class="bar-item"><b>22</b><i style="height:66px;background:#2897D5"></i><span>août</span></div>
    <div class="bar-item"><b>31</b><i style="height:93px;background:#2897D5"></i><span>sept.</span></div>
    <div class="bar-item"><b>40</b><i style="height:120px;background:#2897D5"></i><span>oct.</span></div>
  </div></section>
  <dl><dt>Équipe</dt><dd class="team">Antenne Nord</dd></dl>
  </main></body></html>`;

(async () => {
  const b = await chromium.launch();
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => {
    if (!/lacks the 'allow-same-origin' flag/.test(e.message)) errors.push(e.message);
  });
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const shot = async (name) => {
    for (const x of await p.locator('.toast button[aria-label]').all()) await x.click().catch(() => {});
    await p.waitForTimeout(400);
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}${sfx}.png` });
  };
  const state = seed();
  const base = state.tables.steps.find((s) => s.demo_id === DEMO);
  const ws = state.tables.workspaces[0].id;
  state.htmlPages = {};
  const titles = ['Tableau de bord', 'Rapports'];
  S.forEach((id, i) => {
    const path = `${ws}/${DEMO}/${id}.html`;
    state.htmlPages[path] = page(titles[i]);
    state.tables.steps.unshift({
      ...base,
      id,
      position: -2 + i,
      kind: 'html',
      title: titles[i],
      image_path: null,
      html_path: path,
      html_ops: [],
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

  // ===== L25-07 : styles en masse =====
  if (ONLY.includes('styles')) {
    await frame.locator('b.value').first().click();
    await p.waitForTimeout(400);
    const similar = p.getByRole('button', { name: 'Sélectionner les semblables (3)' });
    ok(await similar.isVisible(), 'élément seul : « Sélectionner les semblables (3) »');
    await frame
      .locator('b.value')
      .nth(1)
      .click({ modifiers: ['Shift'] });
    await p.waitForTimeout(300);
    ok(
      (await p.locator('.st-fields .sec-title').textContent()) === '2 éléments sélectionnés',
      'Maj + clic : 2 éléments sélectionnés',
    );
    ok(
      (await p.locator('[role="status"]').filter({ hasText: '2 éléments sélectionnés' }).count()) >= 1,
      'nombre d’éléments annoncé',
    );
    await p.getByRole('button', { name: /Sélectionner les semblables/ }).click();
    await p.waitForTimeout(300);
    ok(
      (await p.locator('.html-crumbs').textContent()).includes('3 éléments b.value'),
      'semblables : le fil affiche « 3 éléments b.value »',
    );
    const outlined = await frame
      .locator('[data-fd-ui]')
      .evaluateAll(
        (els) => els.filter((e) => e.style.display === 'block' && e.style.outlineWidth === '2px').length,
      );
    ok(outlined === 3, `contour de 2 px sur chaque élément (${outlined})`);
    await p.getByLabel('Couleur du texte', { exact: true }).fill('#DDDDDD');
    ok(
      (await p.locator('.st-contrast.is-low').textContent()).includes('Contraste faible'),
      'contraste insuffisant signalé (plus faible des fonds)',
    );
    await p.getByLabel('Couleur du texte', { exact: true }).fill('#0B6B62');
    ok(
      /Contraste sur le fond : \d+,\d:1/.test(await p.locator('.st-contrast').textContent()),
      `contraste affiché (${await p.locator('.st-contrast').textContent()})`,
    );
    await p.getByLabel('Taille').selectOption('24');
    await p.getByLabel('Graisse').selectOption('700');
    await p.locator('.st-fields').getByRole('radio', { name: 'Toutes les étapes (2)' }).click();
    await shot('l25-07-masse');
    await p.locator('.st-fields').getByRole('button', { name: 'Appliquer' }).click();
    await p.waitForTimeout(600);
    const st = ops(0).find((o) => o.op === 'style');
    ok(
      !!st &&
        st.sels.length === 3 &&
        JSON.stringify(st.value) === JSON.stringify({ color: '#0B6B62', fontSize: 24, fontWeight: '700' }),
      `une opération, seules les propriétés changées (${JSON.stringify(st?.value)})`,
    );
    ok(
      !!st?.group && ops(1).some((o) => o.op === 'style' && o.group === st.group),
      'toutes les étapes : même groupe',
    );
    const fs = await frame
      .locator('b.value')
      .evaluateAll((els) => els.map((e) => getComputedStyle(e).fontSize));
    ok(fs.join('|') === '24px|24px|24px', `style appliqué dans la page (${fs.join('|')})`);
    ok(
      (await p.locator('.mods li').filter({ hasText: 'Style · 3 éléments' }).count()) === 1,
      'une seule ligne « Style · 3 éléments »',
    );
    await p.getByRole('button', { name: 'Annuler le style de b.value' }).click();
    await p.waitForTimeout(1500);

    ok(!ops(0).some((o) => o.op === 'style') && !ops(1).some((o) => o.op === 'style'), 'annulé en une fois');
    // Maj + Entrée au clavier
    await frame.locator('b.value').first().click();
    await frame.locator('body').press('Shift+Enter');
    await frame.locator('body').press('Tab');
    await frame.locator('body').press('Tab');
    await frame.locator('body').press('Shift+Enter');
    await p.waitForTimeout(300);
    ok((await p.locator('.st-fields').count()) === 1, 'Maj + Entrée ajoute l’élément focalisé');
    await p.getByRole('button', { name: 'Désélectionner' }).click();
  }

  // ===== L25-08 : graphique modifiable =====
  if (ONLY.includes('graphique')) {
    await frame.getByText('août').click();
    await p.waitForTimeout(400);
    const panel = p.locator('.ch-fields');
    ok(
      (await panel.locator('.sec-title').textContent()) === 'Graphique · Rapports par mois',
      'graphique reconnu',
    );
    const vals = await panel
      .getByRole('textbox', { name: /^Valeur, ligne/ })
      .evaluateAll((e) => e.map((x) => x.value));
    ok(vals.join('|') === '18|22|31|40', `valeurs lues (${vals.join('|')})`);
    await panel.getByRole('radio', { name: 'Courbe' }).click();
    await p.waitForTimeout(1500);
    const op = () => ops(0).find((o) => o.op === 'chart');
    ok(op()?.value.type === 'line' && op().value.rows.length === 4, 'type Courbe enregistré');
    ok(
      (await frame.locator('[data-fd-chart="line"] polyline').count()) === 1,
      'courbe redessinée dans la page',
    );
    const label = await frame.locator('[data-fd-chart]').getAttribute('aria-label');
    ok(
      (await frame.locator('[data-fd-chart]').getAttribute('role')) === 'img' && label.includes('août 22'),
      `role=img et valeurs énumérées (${label})`,
    );
    await panel.getByRole('textbox', { name: 'Valeur, ligne 2' }).fill('abc');
    await panel.getByRole('textbox', { name: 'Libellé, ligne 1' }).click();
    ok(
      (await panel.getByText('Saisissez un nombre').count()) === 1 &&
        (await panel.getByRole('textbox', { name: 'Valeur, ligne 2' }).getAttribute('aria-invalid')) ===
          'true',
      'valeur non numérique signalée sur la cellule',
    );
    await p.waitForTimeout(1500);
    ok(op().value.rows.length === 3, 'la ligne invalide n’est pas appliquée');
    await panel.getByRole('textbox', { name: 'Valeur, ligne 2' }).fill('24');
    await panel.getByRole('button', { name: 'Ajouter une ligne' }).click();
    await panel.getByRole('textbox', { name: 'Libellé, ligne 5' }).fill('nov.');
    await panel.getByRole('textbox', { name: 'Valeur, ligne 5' }).fill('52');
    await panel.getByRole('textbox', { name: 'Libellé, ligne 1' }).click();
    await p.waitForTimeout(1500);
    ok(op().value.rows.length === 5 && op().value.rows[4].value === 52, 'ligne ajoutée');
    await panel.getByRole('radio', { name: 'Barres' }).click();
    await p.waitForTimeout(500);
    ok(
      (await frame.locator('[data-fd-chart="bar"] text').allTextContents()).includes('52'),
      'barres : valeurs toujours écrites',
    );
    ok(
      (await panel.getByRole('button', { name: 'Supprimer la ligne 5' }).count()) === 1,
      'bouton nommé « Supprimer la ligne 5 »',
    );
    await shot('l25-08-graphique');
  }

  ok(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
