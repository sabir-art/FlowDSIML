/**
 * Recette A8 (spec a8-guide-sandbox, recette 7 et 8) : guide optionnel du Sandbox dans l'éditeur.
 * Activer le guide, liste vide et ligne de la liste de contrôle, « Ajouter une étape », bulles posées
 * sur des éléments de la page (« Bulle du guide »), panneau de la bulle, repères « Guide : 1, 2 »,
 * Monter au clavier, avance « Bouton Suivant », bulle supprimée → étape orpheline. Faux Supabase,
 * données fictives (acme.example). Usage : node e2e/guide-sandbox-editeur.e2e.cjs
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { openTool } = require('./editor-rail.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const ID = (n) => `0b5c1f0e-0000-4000-8000-0000000000f${n}`;
const U = 'https://logiciel.acme.example';

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' })).newPage();
  const errors = [];
  p.on('pageerror', (e) => {
    if (!/lacks the 'allow-same-origin' flag/.test(e.message)) errors.push(e.message);
  });
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const state = seed();
  const base = state.tables.steps.find((s) => s.demo_id === DEMO);
  const ws = state.tables.workspaces[0].id;
  const demo = state.tables.demos.find((d) => d.id === DEMO);
  demo.title = 'Logiciel métier';
  demo.kind = 'sandbox';
  demo.sandbox = { start: ID(1), autoLink: true, unlinked: 'toast', guide: false, keyPages: [] };
  state.htmlPages = {};
  state.tables.steps = state.tables.steps.filter((s) => s.demo_id !== DEMO);
  state.tables.hotspots = state.tables.hotspots.filter((h) => h.demo_id !== DEMO);
  const pages = [
    [1, 'Tableau de bord', `${U}/`],
    [2, 'Agenda', `${U}/agenda`],
  ];
  for (const [n, title, url] of pages) {
    const path = `${ws}/${DEMO}/${ID(n)}.html`;
    state.htmlPages[path] =
      `<!doctype html><html lang="fr"><body><nav id="menu"><a href="${U}/">Accueil</a><a href="${U}/agenda">Agenda</a></nav>` +
      `<h1>${title}</h1><p class="kpi">Rendez-vous : 48</p></body></html>`;
    state.tables.steps.push({
      ...base,
      id: ID(n),
      position: n - 1,
      kind: 'html',
      title,
      image_path: null,
      html_path: path,
      html_ops: [],
      html_meta: { title, url, viewport: { w: 1280, h: 720 }, links: [] },
    });
  }
  // Bulle de la page Agenda dont l'élément n'existe plus (page recapturée) : à replacer
  const LOST = '0b5c1f0e-0000-4000-8000-0000000000a9';
  state.tables.hotspots.push({
    ...(state.tables.hotspots[0] ?? {}),
    id: LOST,
    step_id: ID(2),
    demo_id: DEMO,
    workspace_id: ws,
    x: 0.1,
    y: 0.2,
    w: 0.2,
    h: 0.1,
    title: 'Ancienne bulle',
    body: '',
    placement: 'auto',
    action: { type: 'next' },
    cta: null,
    pulse: true,
    style: 'beacon',
    position: 0,
    sel: '#absent',
  });
  await install(p, state);
  await p.goto(`${APP}/#/demos/${DEMO}/edit`);
  const frame = p.frameLocator('.html-stage iframe');
  await frame.locator('h1').waitFor();
  const view = (name) =>
    p.getByRole('radiogroup', { name: 'Affichage du canevas' }).getByRole('radio', { name }).click();
  const saved = () => state.tables.demos.find((d) => d.id === DEMO).sandbox;
  const settle = () => p.waitForTimeout(1400); // enregistrement différé de la démo

  // ===== Activer le guide : liste vide =====
  await view('Plan');
  await p.getByRole('img', { name: /^Plan du sandbox/ }).waitFor();
  const sw = p.getByLabel('Guide optionnel', { exact: true });
  ok(
    (await p.locator('#sb-guide-help').innerText()).includes('Des bulles qui montrent une tâche pas à pas'),
    'interrupteur « Guide optionnel » avec son aide',
  );
  await sw.check();
  const list = p.locator('.sb-guide');
  await list.waitFor();
  ok((await list.locator('h3').innerText()) === 'Étapes du guide · 0', '« Étapes du guide · 0 »');
  ok(
    (await list.innerText()).includes('Aucune étape. Ouvrez une page, puis « Ajouter une étape »'),
    'liste vide : texte d’aide',
  );
  await settle();
  ok(saved().guide === true, 'guide activé enregistré');

  // Liste de contrôle : guide activé sans étape (non bloquant)
  await view('Page');
  await p
    .getByRole('button', { name: /^Publier/ })
    .first()
    .click();
  const todo = p.locator('.publish-todo');
  await todo.waitFor();
  ok(
    (await todo.innerText()).includes('Guide activé sans étape.'),
    'recette 8 : liste de contrôle, guide vide',
  );
  await todo.getByRole('button', { name: 'Ajouter une étape' }).click();
  await list.waitFor();
  ok(true, 'liste de contrôle : « Ajouter une étape » ouvre le plan');

  // ===== Ajouter une étape depuis la vue Page =====
  await list.getByRole('button', { name: 'Ajouter une étape' }).click();
  await frame.locator('h1').waitFor();
  await p
    .getByText('Sélectionnez un élément de la page, puis « Bulle du guide »', { exact: false })
    .waitFor();
  ok(true, '« Ajouter une étape » : la page s’ouvre, avec la consigne');
  const addOn = async (sel) => {
    await frame.locator(sel).click();
    const btn = p.locator('.eltb').getByRole('button', { name: 'Bulle du guide' });
    await btn.waitFor();
    await btn.click();
    await p
      .getByText(/Bulle ajoutée au guide, étape \d/)
      .last()
      .waitFor();
  };
  await addOn('p.kpi');
  const panel = p.locator('.sp-panel', { hasText: 'Bulle du guide · étape 1' });
  await panel.waitFor();
  ok(true, 'recette 7 : bulle 1 posée sur un élément, son panneau s’ouvre');
  await panel.getByLabel('Titre (facultatif)').fill('Vos rendez-vous');
  ok((await panel.innerText()).includes('p.kpi'), 'panneau : élément visé (sélecteur)');
  await addOn('#menu > a:nth-of-type(2)');
  await p.locator('.sp-panel', { hasText: 'Bulle du guide · étape 2' }).waitFor();
  await p.getByLabel('Titre (facultatif)').fill('Ouvrez l’agenda');
  await settle();
  const hs = state.tables.hotspots.filter((h) => h.demo_id === DEMO && h.id !== LOST);
  ok(
    hs.length === 2 && hs.some((h) => /p\.kpi$/.test(h.sel ?? '')) && hs.every((h) => h.w > 0 && h.h > 0),
    `bulles enregistrées avec sélecteur et rect de secours (${JSON.stringify(hs.map((h) => [h.sel, h.w, h.h]))})`,
  );
  ok(
    JSON.stringify(saved().guideSteps.map((g) => g.advance)) === '["click","click"]' &&
      saved().guideSteps.every((g) => g.page === ID(1)),
    'guideSteps : 2 étapes sur la page, avance « click »',
  );

  // ===== Plan : repères, ordre au clavier, avance =====
  await view('Plan');
  await list.waitFor();
  const rows = list.locator('.sb-guide__row');
  ok((await rows.count()) === 2, 'liste : 2 étapes');
  ok(
    (await rows.nth(0).innerText()).includes('Vos rendez-vous') &&
      (await rows.nth(0).innerText()).includes('Tableau de bord · Au clic'),
    'ligne : titre, page, « Au clic »',
  );
  ok(
    (await p.locator('.sbnode', { hasText: 'Tableau de bord' }).locator('.sb-guide-on').innerText()) ===
      'Guide : 1, 2',
    'recette 8 : « Guide : 1, 2 » sur la carte',
  );
  ok(
    (await p.locator('.sbnode', { hasText: 'Agenda' }).locator('.sb-guide-on').count()) === 0,
    'carte sans étape : pas de repère',
  );
  // Monter au clavier
  await list.getByRole('button', { name: 'Plus d’actions pour l’étape 2' }).focus();
  await p.keyboard.press('Enter');
  await p.getByRole('menuitem', { name: 'Monter' }).waitFor();
  await p.getByRole('menuitem', { name: 'Monter' }).press('Enter');
  await p.waitForFunction(() =>
    (document.querySelector('.sb-guide__row')?.textContent ?? '').includes('Ouvrez l’agenda'),
  );
  ok(
    (await p.locator('.sb-guide p[aria-live="polite"]').innerText()) === 'Étape 2 déplacée en position 1.',
    'recette 7 : étapes inversées au clavier (Monter), annoncé',
  );
  // Avancer avec Suivant
  await list.getByRole('button', { name: 'Plus d’actions pour l’étape 1' }).click();
  await p.getByRole('menuitem', { name: 'Avancer avec Suivant' }).click();
  await p.waitForFunction(() =>
    (document.querySelector('.sb-guide__row')?.textContent ?? '').includes('Bouton Suivant'),
  );
  await settle();
  ok(
    saved().guideSteps[0].advance === 'next' && saved().guideSteps[1].advance === 'click',
    'avance « Bouton Suivant » enregistrée sur la bonne étape',
  );
  await new AxeBuilder({ page: p })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
    .then((r) => {
      const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      ok(
        bad.length === 0,
        `axe plan avec le guide : ${bad.map((v) => v.id).join(', ') || '0 violation grave'}`,
      );
    });

  // ===== Bulle supprimée sur sa page : étape orpheline =====
  await list.getByRole('button', { name: 'Plus d’actions pour l’étape 2' }).click();
  await p.getByRole('menuitem', { name: 'Modifier la bulle' }).click();
  const bubble = p.locator('.sp-panel', { hasText: 'Bulle du guide · étape 2' });
  await bubble.waitFor();
  ok(
    (await bubble.getByLabel('Titre (facultatif)').innerText()).trim() === 'Vos rendez-vous',
    '« Modifier la bulle » ouvre la bonne bulle',
  );
  await bubble.getByRole('button', { name: 'Supprimer le hotspot' }).click();
  await view('Plan');
  await list.waitFor();
  const orphan = list.locator('.sb-guide__row.is-orphan');
  await orphan.waitFor();
  ok(
    (await orphan.innerText()).includes('Bulle introuvable : retirez-la ou replacez-la.'),
    'recette 7 : bulle supprimée, étape orpheline avec le message',
  );
  ok(
    (await p.locator('.sbnode', { hasText: 'Tableau de bord' }).locator('.sb-guide-on').innerText()) ===
      'Guide : 1',
    'repère de la carte sans l’étape orpheline',
  );
  await list.getByRole('button', { name: 'Plus d’actions pour l’étape 2' }).click();
  await p.getByRole('menuitem', { name: 'Retirer du guide' }).click();
  await p.waitForFunction(() => document.querySelectorAll('.sb-guide__row').length === 1);
  await settle();
  ok(saved().guideSteps.length === 1, 'Retirer du guide : étape retirée');

  // ===== Élément introuvable : « Replacer la bulle » =====
  await view('Page');
  await p
    .locator('.step-list, [role="listbox"]')
    .first()
    .waitFor()
    .catch(() => {});
  await p.getByText('Agenda', { exact: true }).first().click();
  await frame.locator('h1', { hasText: 'Agenda' }).waitFor();
  const tool = await openTool(p, 'hotspots');
  await tool.getByRole('button', { name: /Ancienne bulle/ }).click();
  const lost = p.locator('.sp-panel .alert', { hasText: 'Élément introuvable sur la page' });
  await lost.waitFor();
  ok(
    (await lost.innerText()).includes('la bulle s’affiche à sa position d’origine. Replacez-la.'),
    'élément introuvable : message de la spec',
  );
  await frame.locator('h1').click();
  await p.locator('.eltb').waitFor();
  await lost.getByRole('button', { name: 'Replacer la bulle' }).click();
  await lost.waitFor({ state: 'detached' });
  await settle();
  const moved = state.tables.hotspots.find((h) => h.id === LOST);
  ok(/h1$/.test(moved.sel) && moved.y < 0.2, `« Replacer la bulle » : nouvel élément et rect (${moved.sel})`);

  ok(errors.length === 0, `aucune erreur de page (${errors.join(' | ')})`);
  await b.close();
})();
