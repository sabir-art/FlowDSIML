/**
 * Test e2e L25-07 à L25-10 : styles en masse, graphique modifiable (étape HTML), jeu de données CSV,
 * embranchement conditionnel. Données fictives (faux Supabase).
 * Usage : SHOTS_DIR=… [THEME=dark] [ONLY=styles,graphique,donnees,conditions] node e2e/editeur-donnees.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { openTool } = require('./editor-rail.cjs');
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

  // ===== L25-09 : jeu de données CSV =====
  if (ONLY.includes('donnees')) {
    const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
    await p.locator('[data-step-index="0"]').click();
    await frame.locator('b.value').first().click();
    await p.waitForTimeout(300);
    await openTool(p, 'settings');
    await p.getByRole('button', { name: 'Importer un fichier CSV' }).click();
    const dlg = p.locator('.ds-dialog');
    await dlg.waitFor();
    const input = dlg.locator('input[type="file"]');
    await input.setInputFiles({
      name: 'contacts.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('equipe;contact\nAntenne Nord;nord@acme.example\n'),
    });
    await p.waitForTimeout(300);
    ok(
      (await dlg.getByRole('alert').textContent()) ===
        'La colonne « contact » contient des données personnelles : retirez-la du fichier.',
      'colonne personnelle refusée à l’import',
    );
    ok((await dlg.getByRole('button', { name: 'Fermer' }).count()) === 1, 'bouton × dans l’en-tête');
    await shot('l25-09-refus');
    await input.setInputFiles({
      name: 'equipes-acme.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        '\uFEFFequipe;rapports;vues;responsable\nAntenne Nord;1 248;86;Équipe Nord\nAntenne Sud;932;64;Équipe Sud\nAntenne Est;611;40;Équipe Est\nAntenne Ouest;402;31;Équipe Ouest\n',
      ),
    });
    await p.waitForTimeout(300);
    ok(
      (await dlg.locator('.ds-file').textContent()).includes(
        '4 lignes · 4 colonnes · séparateur point-virgule, UTF-8',
      ),
      'fichier : lignes, colonnes, séparateur et encodage détectés',
    );
    ok(
      (await dlg.locator('.ds-table').first().locator('tbody tr').count()) === 3,
      'aperçu des 3 premières lignes',
    );
    await dlg.getByRole('combobox', { name: 'Relier la colonne « rapports »' }).selectOption({ index: 1 });
    const chosen = await dlg
      .getByRole('combobox', { name: 'Relier la colonne « rapports »' })
      .locator('option:checked')
      .textContent();
    ok(chosen.startsWith('Élément b.value'), `colonne reliée à un élément (${chosen})`);
    await dlg
      .getByRole('combobox', { name: 'Relier la colonne « equipe »' })
      .selectOption({ label: 'Variable {{company}}' });
    const link = dlg.getByRole('radio', {
      name: 'Selon le lien personnalisé (colonne equipe = {{company}})',
    });
    await link.check();
    await shot('l25-09-donnees');
    await dlg.getByRole('button', { name: 'Relier' }).click();
    await p.waitForTimeout(800);
    const row = (state.tables.demo_datasets || [])[0];
    ok(
      !!row && row.row_mode === 'link' && row.link_column === 'equipe' && row.bindings.length === 2,
      `jeu enregistré (${JSON.stringify(row && { mode: row.row_mode, link: row.link_column, b: row.bindings.length })})`,
    );
    ok(
      (await p.locator('.sec').filter({ hasText: 'equipes-acme.csv' }).textContent()).includes('2 publiées'),
      'Réglages : 2 colonnes publiées sur 4',
    );
    await p.getByRole('button', { name: 'Publier', exact: true }).click();
    const gd = p.locator('.gdpr-dialog');
    await gd.waitFor();
    ok(
      (await gd.textContent()).includes('Jeu de données publié : 4 lignes, 2 colonnes reliées'),
      'bilan RGPD : jeu de données compté',
    );
    await gd.getByRole('button', { name: 'Annuler' }).click();
    await openTool(p, 'step');

    // Lecteur : la ligne du lien personnalisé remplace les valeurs de la capture
    const sel = row.bindings.find((b) => b.kind === 'element').sel;
    const manifest = {
      schemaVersion: 1,
      demoId: DEMO,
      versionId: '0b5c1f0e-0000-4000-8000-0000000025e2',
      workspaceId: 'w',
      workspaceName: 'Acme',
      title: 'Tableau de bord',
      locale: 'fr',
      publishedAt: '2026-11-19T10:00:00Z',
      theme: {},
      variables: [{ key: 'company', label: 'Entreprise', default: '' }],
      dataset: {
        columns: ['equipe', 'rapports'],
        rows: [
          ['Antenne Nord', '1 248'],
          ['Antenne Sud', '932'],
        ],
        bindings: [
          { column: 'equipe', kind: 'variable', key: 'company' },
          { column: 'rapports', kind: 'element', stepId: 'h1', sel },
        ],
        rowMode: 'link',
        linkColumn: 'equipe',
      },
      steps: [
        {
          id: 'h1',
          kind: 'html',
          title: 'Tableau de bord',
          html: {
            url: 'assets/h1.html',
            title: 'Tableau de bord',
            viewport: { w: 1280, h: 720 },
            ops: [],
            links: [],
          },
        },
      ],
    };
    for (const [q, want] of [
      ['?company=Antenne%20Sud', '932'],
      ['?company=Ouest', '1 248'],
    ]) {
      const pp = await (await themedContext(b, { viewport: { width: 1280, height: 860 } })).newPage();
      pp.on('pageerror', (e) => {
        if (!/lacks the 'allow-same-origin' flag/.test(e.message)) errors.push(e.message);
      });
      await pp.route('**/functions/v1/open-demo', (r) =>
        r.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ok', manifest }),
          headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
        }),
      );
      await pp.route('**/assets/*.html', (r) =>
        r.fulfill({
          contentType: 'text/html',
          body: page('Tableau de bord'),
          headers: { 'access-control-allow-origin': '*' },
        }),
      );
      await pp.route('**/functions/v1/track', (r) => r.fulfill({ status: 200, body: '{}' }));
      await pp.goto(`${PLAYER}/${q}#/d/${DEMO}`);
      const f = pp.frameLocator('iframe');
      await f.locator('h1').waitFor();
      await pp.waitForTimeout(500);
      const v = await f.locator('b.value').first().textContent();
      ok(v === want, `lecteur ${q} → « ${v} »`);
      await pp.context().close();
    }
  }

  // ===== L25-10 : embranchement conditionnel =====
  if (ONLY.includes('conditions')) {
    const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
    const st = (i) =>
      state.tables.steps.find(
        (s) =>
          s.demo_id === DEMO &&
          s.position ===
            state.tables.steps.filter((x) => x.demo_id === DEMO).sort((a, b) => a.position - b.position)[i]
              .position,
      );
    await p.locator('[data-step-index="2"]').click();
    // L48-E : « Suite de l'étape » est l'outil « Suite du parcours » du rail
    await openTool(p, 'next');
    const sec = p.locator('.rules-sec');
    await sec.scrollIntoViewIfNeeded();
    ok(
      (await sec.getByRole('heading').textContent()) === 'Suite de l’étape' ||
        (await sec.getByRole('heading').textContent()) === "Suite de l'étape",
      'section « Suite de l’étape »',
    );
    const elseSel = sec.getByRole('combobox', { name: 'Destination par défaut' });
    ok(
      (await elseSel.locator('option:checked').textContent()) === 'Étape suivante (4)',
      '« Sinon » : étape suivante par défaut',
    );
    await sec.getByRole('button', { name: 'Ajouter une règle' }).click();
    await p.waitForTimeout(300);
    const r1 = sec.getByRole('group', { name: 'Règle 1' });
    ok(
      (await r1.getByRole('combobox', { name: 'Destination, règle 1' }).getAttribute('aria-invalid')) ===
        'true' && (await r1.getByText('Choisissez une destination pour cette règle.').count()) === 1,
      'règle sans destination signalée en erreur',
    );
    await p.getByRole('button', { name: 'Publier', exact: true }).click();
    await p.waitForTimeout(300);
    ok(
      (await p.getByText('L’étape 3 a une règle sans destination').count()) +
        (await p.getByText("L'étape 3 a une règle sans destination").count()) >=
        1,
      'publication bloquée',
    );
    const ops = await r1
      .getByRole('combobox', { name: 'Opérateur, règle 1' })
      .locator('option')
      .allTextContents();
    ok(
      ops.join('|') === "est|n'est pas|contient|moins de|plus de",
      `opérateurs en liste fermée (${ops.join('|')})`,
    );
    await r1
      .getByRole('combobox', { name: 'Critère, règle 1' })
      .selectOption({ label: 'Variable {{company}}' });
    await r1.getByRole('textbox', { name: 'Valeur, règle 1' }).fill('Acme');
    await r1.getByRole('combobox', { name: 'Destination, règle 1' }).selectOption({ label: '5 · Merci !' });
    await sec.getByRole('button', { name: 'Ajouter une règle' }).click();
    const r2 = sec.getByRole('group', { name: 'Règle 2' });
    await r2.getByRole('combobox', { name: 'Critère, règle 2' }).selectOption({ label: 'Score du quiz (%)' });
    await r2.getByRole('combobox', { name: 'Opérateur, règle 2' }).selectOption({ label: 'moins de' });
    await r2.getByRole('textbox', { name: 'Valeur, règle 2' }).fill('50');
    await r2
      .getByRole('combobox', { name: 'Destination, règle 2' })
      .selectOption({ label: 'Fin de la démo' });
    await p.waitForTimeout(1500);
    const rules = st(2).options.rules;
    ok(
      rules.length === 2 &&
        JSON.stringify(rules[0].when.cond) ===
          JSON.stringify({ source: 'var', key: 'company', op: 'is', value: 'Acme' }) &&
        rules[1].goto.type === 'end',
      `règles déclaratives enregistrées (${JSON.stringify(rules.map((r) => r.when))})`,
    );
    ok(
      (await p
        .locator('[data-step-index="2"]')
        .getByLabel(/Règles vers 5, fin/)
        .count()) +
        (await p.locator('[data-step-index="2"] [title="Règles vers 5, fin"]').count()) >=
        1,
      'rail : flèche secondaire vers chaque destination',
    );
    // Panneau défilé : « Sinon » en entier, « Ajouter une règle » et l'aide de lecture visibles
    await sec
      .locator('p.fd-help')
      .last()
      .evaluate((el) => el.scrollIntoView({ block: 'end' }));
    await shot('l25-10-conditions');
    // Boucle sans sortie : 3 → 4 → 3
    await r1.getByRole('combobox', { name: 'Destination, règle 1' }).selectOption({ label: '4 · Écran 2' });
    await r2.getByRole('combobox', { name: 'Destination, règle 2' }).selectOption({ label: '4 · Écran 2' });
    await p.locator('[data-step-index="3"]').click();
    const sec4 = p.locator('.rules-sec');
    await sec4.getByRole('button', { name: 'Ajouter une règle' }).click();
    await sec4
      .getByRole('group', { name: 'Règle 1' })
      .getByRole('combobox', { name: 'Destination, règle 1' })
      .selectOption({ label: '3 · Écran 1' });
    await sec4
      .getByRole('combobox', { name: 'Destination par défaut' })
      .selectOption({ label: '3 · Écran 1' });
    await p.waitForTimeout(400);
    ok(
      (await sec4.getByText('Ce parcours peut tourner en rond').count()) === 1,
      'boucle sans sortie : alerte (non bloquante)',
    );
    await sec4.getByRole('button', { name: 'Supprimer la règle 1' }).click();
    await sec4.getByRole('combobox', { name: 'Destination par défaut' }).selectOption({ index: 0 });

    // Lecteur : la première règle vraie s'applique ; sinon « Sinon »
    const manifest = {
      schemaVersion: 1,
      demoId: DEMO,
      versionId: '0b5c1f0e-0000-4000-8000-0000000025e1',
      workspaceId: 'w',
      workspaceName: 'Acme',
      title: 'Parcours',
      locale: 'fr',
      publishedAt: '2026-11-19T10:00:00Z',
      theme: {},
      variables: [{ key: 'company', label: 'Entreprise', default: '' }],
      steps: [
        {
          id: 's1',
          kind: 'text',
          title: 'Bienvenue',
          body: 'Départ',
          options: {
            rules: [
              {
                when: { cond: { source: 'var', key: 'company', op: 'is', value: 'Acme' } },
                goto: { type: 'goto', stepId: 's3' },
              },
            ],
            rulesElse: { type: 'goto', stepId: 's2' },
          },
        },
        { id: 's2', kind: 'text', title: 'Parcours général', body: '' },
        { id: 's3', kind: 'text', title: 'Parcours Acme', body: '' },
      ],
    };
    for (const [q, want] of [
      ['?company=acme', 'Parcours Acme'],
      ['', 'Parcours général'],
    ]) {
      const pp = await (await themedContext(b, { viewport: { width: 1280, height: 800 } })).newPage();
      pp.on('pageerror', (e) => errors.push(e.message));
      await pp.route('**/functions/v1/open-demo', (r) =>
        r.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ok', manifest }),
          headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
        }),
      );
      await pp.route('**/functions/v1/track', (r) => r.fulfill({ status: 200, body: '{}' }));
      await pp.goto(`${PLAYER}/${q}#/d/${DEMO}`);
      await pp.getByText('Bienvenue').first().waitFor();
      await pp.getByRole('button', { name: 'Commencer' }).click();
      await pp.waitForTimeout(500);
      ok((await pp.getByText(want).count()) >= 1, `lecteur ${q || '(sans variable)'} → « ${want} »`);
      await pp.context().close();
    }
  }

  ok(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
