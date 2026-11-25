/** Test e2e de l'éditeur (faux Supabase). Usage : app web lancée sur :5173 avec VITE_SUPABASE_ANON_KEY défini. */
const { chromium } = require('playwright');
const { install } = require('./fake-supabase.cjs');
const { pick, picked } = require('./_select.cjs');
const BASE = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  // L48-E : outils du rail (bouton bascule : n'ouvrir que s'il n'est pas déjà ouvert)
  const tool = async (name) => {
    const btn = page.locator(`.ed-rail button[aria-label="${name}"]`);
    if ((await btn.getAttribute('aria-pressed')) !== 'true') await btn.click();
  };
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const state = await install(page);
  const ok = (cond, label) => {
    console.log(`${cond ? 'ok' : 'NOT OK'} - ${label}`);
    if (!cond) process.exitCode = 1;
  };

  await page.goto(`${BASE}/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit`);
  await page.waitForSelector('.canvas-frame img');
  ok((await page.locator('.rail-li').count()) === 3, 'liste des 3 étapes');
  ok((await page.locator('.canvas-hotspot').count()) === 1, 'hotspot affiché sur l’étape 1');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/editor.png` });

  // Sélection du hotspot → panneau
  await page.locator('.canvas-hotspot').first().click();
  await page.waitForSelector('#hs-title');
  await page.fill('#hs-title', 'Créez votre opportunité');
  await page.waitForTimeout(900);
  ok(
    state.calls.some(
      (c) =>
        c.method === 'PATCH' && c.path.endsWith('/hotspots') && c.body?.title === 'Créez votre opportunité',
    ),
    'modification du hotspot enregistrée',
  );
  // Panneau « Hotspot et bulle » (maquette EDT-01) : type de guidage et position en grille
  await page.getByRole('radio', { name: 'Zone' }).click();
  await page.getByRole('button', { name: 'Au-dessus' }).click();
  await page.waitForTimeout(900);
  ok(
    state.calls.some(
      (c) => c.method === 'PATCH' && c.path.endsWith('/hotspots') && c.body?.style === 'spotlight',
    ),
    'type de guidage « Zone » enregistré (style spotlight)',
  );
  ok(
    state.calls.some(
      (c) => c.method === 'PATCH' && c.path.endsWith('/hotspots') && c.body?.placement === 'top',
    ),
    'position « Au-dessus » enregistrée depuis la grille',
  );
  ok(
    (await page.getByRole('button', { name: /En haut à gauche/ }).isDisabled()) === true,
    'coins de la grille inactifs (Bientôt)',
  );
  await page.getByRole('radio', { name: 'Hotspot' }).click();

  // Déplacement du hotspot
  const box = await page.locator('.canvas-hotspot').first().boundingBox();
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 110, box.y - 60, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(900);
  ok(
    state.calls.some(
      (c) => c.method === 'PATCH' && c.path.endsWith('/hotspots') && typeof c.body?.x === 'number',
    ),
    'déplacement du hotspot enregistré',
  );

  // Clavier (ED1) : focus, flèche droite ×5 avec Maj, Suppr
  await tool('Étape');
  const hs = page.locator('.canvas-hotspot').first();
  await hs.focus();
  await page.keyboard.press('Enter');
  const before = Number((await hs.getAttribute('style')).match(/left: ([\d.]+)%/)[1]);
  await page.keyboard.press('Shift+ArrowRight');
  const after = Number((await hs.getAttribute('style')).match(/left: ([\d.]+)%/)[1]);
  ok(Math.abs(after - before - 5) < 0.6, 'hotspot déplacé au clavier (Maj+→ = 5 %)');
  ok(
    (await page.textContent('.sr-only[aria-live="polite"]')).includes('%'),
    'annonce aria-live du déplacement',
  );

  // L48-E : ajout d'un hotspot depuis l'outil « Points d'intérêt » du rail
  await page.keyboard.press('Escape');
  await tool("Points d'intérêt");
  await page.getByRole('button', { name: 'Ajouter un hotspot' }).click();
  const frame = await page.locator('.stage .canvas-frame').boundingBox();
  await page.mouse.click(frame.x + frame.width * 0.8, frame.y + frame.height * 0.2);
  await page.waitForTimeout(300);
  ok((await page.locator('.stage .canvas-hotspot').count()) === 2, 'nouveau hotspot ajouté');

  // L48-E : flou dans sa fenêtre (outil « Flou » du rail), puis « Appliquer le flou »
  await tool('Flou');
  const bm = page.locator('dialog[open], [role="dialog"]').filter({ has: page.locator('#blurm-title') });
  await bm.waitFor();
  const bf = await bm.locator('.canvas-frame').boundingBox();
  await page.mouse.move(bf.x + 50, bf.y + 50);
  await page.mouse.down();
  await page.mouse.move(bf.x + 250, bf.y + 100, { steps: 4 });
  await page.mouse.up();
  await bm.getByRole('button', { name: 'Appliquer le flou' }).click();
  await page.waitForTimeout(900);
  ok(
    state.calls.some(
      (c) =>
        c.method === 'PATCH' &&
        c.path.endsWith('/steps') &&
        Array.isArray(c.body?.blurs) &&
        c.body.blurs.length === 1,
    ),
    'zone floutée ajoutée',
  );

  // Réordonnancement
  // P1-1 : « Monter » est dans le menu « … » de l'étape
  await page.locator('.rail-li').nth(2).hover();
  await page.locator('.rail-li').nth(2).getByRole('button', { name: 'Actions de l’étape 3' }).click();
  await page.getByRole('menuitem', { name: 'Monter' }).click();
  await page.waitForFunction(
    () => document.querySelectorAll('.rail-list .step .meta b')[1]?.textContent === 'Merci !',
  );
  ok(
    (await page.locator('.rail-list .step .meta b').nth(1).textContent()) === 'Merci !',
    'étape déplacée vers le haut',
  );

  // Onglets thème, formulaire, variables
  await tool('Design');
  await page.getByRole('radio', { name: 'Doux' }).click();
  // EDT-10 : fond dégradé (nouvelle option du thème) et alerte de contraste
  await page.getByLabel('Fond dégradé').check();
  await page.locator('#th-primary-hex').fill('#9AD1C8');
  await page.locator('#th-primary-hex').blur();
  await page.waitForTimeout(300);
  ok((await page.locator('.th-warn').count()) === 1, 'alerte de contraste sur une couleur principale claire');
  await page.locator('.th-warn button').click();
  await page.waitForTimeout(300);
  ok((await page.locator('.th-warn').count()) === 0, 'couleur proposée appliquée (contraste ≥ 4,5:1)');
  await tool('Réglages de la démo');
  await page.getByRole('button', { name: 'Créer le formulaire' }).click();
  await page.waitForSelector('#f-title');
  ok(state.tables.forms.length === 1, 'formulaire de lead créé');
  await page.getByLabel('Formulaire obligatoire').uncheck();
  await page.waitForTimeout(900);
  ok(
    state.calls.some((c) => c.method === 'PATCH' && c.path.endsWith('/forms') && c.body?.skippable === true),
    'EDT-08 : « Formulaire obligatoire » désactivé = formulaire passable',
  );
  // EDT-08 : panneau du formulaire dans l'onglet Étape, aperçu en carte sur le canevas
  ok(
    (await page.locator('.canvas-form-preview .cfp-card').count()) === 1,
    'EDT-08 : aperçu du formulaire sur le canevas',
  );
  ok(
    (await page.locator('.rail-list .step--form[aria-current="step"]').count()) === 1,
    'EDT-08 : formulaire sélectionné dans le rail',
  );
  // Retour client du 23/11 : la carte du formulaire a le même menu ⋯ que les étapes
  await page.locator('.rail-li--form').hover();
  await page.getByRole('button', { name: 'Actions du formulaire' }).click();
  ok(
    (await page.getByRole('menuitem').allInnerTexts()).map((x) => x.trim()).join(' | ') ===
      'Modifier | Monter | Descendre | Supprimer',
    'formulaire : menu ⋯ (Modifier, Monter, Descendre, Supprimer)',
  );
  await page.getByRole('menuitem', { name: 'Descendre' }).click();
  // Attente sur l'état réel : la valeur choisie de « Avant l'étape » (10 s au plus)
  for (const end = Date.now() + 10000; Date.now() < end && (await picked(page.locator('#f-gate'))) !== '2';)
    await new Promise((r) => setTimeout(r, 100));
  ok(
    (await picked(page.locator('#f-gate'))) === '2',
    'EDT-08 : déplacer le formulaire dans le rail change l’étape déclencheuse',
  );
  // « Supprimer ce formulaire ? » : le corps dit ce qui est retiré ; « Annuler » ne supprime rien
  await page.locator('.rail-li--form').hover();
  await page.getByRole('button', { name: 'Actions du formulaire' }).click();
  await page.getByRole('menuitem', { name: 'Supprimer' }).click();
  const delForm = page.getByRole('dialog', { name: 'Supprimer ce formulaire ?' });
  await delForm.waitFor();
  ok(
    /Le formulaire et (son champ|ses \d+\schamps) sont retirés de la démo\. Les réponses déjà reçues restent dans Leads\. Vous pourrez annuler juste après, depuis la notification\./.test(
      await delForm.innerText(),
    ) &&
      (await delForm.getByRole('button', { name: 'Supprimer le formulaire' }).count()) === 1 &&
      (await page.evaluate(() => document.activeElement?.textContent?.trim())) === 'Annuler',
    'formulaire : la fenêtre dit ce qui est retiré, « Supprimer le formulaire », focus sur « Annuler »',
  );
  await delForm.getByRole('button', { name: 'Annuler' }).click();
  ok(state.tables.forms.length === 1, 'formulaire : « Annuler » ne supprime rien');
  // Suppression, puis « Annuler » dans la notification : le formulaire revient à sa place
  await page.locator('.rail-li--form').hover();
  await page.getByRole('button', { name: 'Actions du formulaire' }).click();
  await page.getByRole('menuitem', { name: 'Supprimer' }).click();
  await delForm.getByRole('button', { name: 'Supprimer le formulaire' }).click();
  await page.locator('.rail-li--form').waitFor({ state: 'detached' });
  // (La base réelle détache l'étape par sa clé étrangère ; la fausse base ne rejoue pas cette règle.)
  ok(
    state.tables.forms.length === 0 && (await page.locator('.canvas-form-preview').count()) === 0,
    'formulaire supprimé : plus de carte dans la liste ni d’aperçu sur le canevas',
  );
  await page.locator('.toasts .toast').getByRole('button', { name: 'Annuler' }).click();
  await page.locator('.rail-li--form').waitFor();
  ok(
    state.tables.forms.length === 1 && state.tables.steps[1].gate_form_id === state.tables.forms[0].id,
    'formulaire : « Annuler » le rétablit avant la même étape',
  );
  await page.locator('.rail-li--form .step--form').click();
  await page.locator('#f-gate').waitFor();
  await tool('Réglages de la démo');
  ok((await page.locator('text={{company}}').count()) > 0, 'variables du workspace listées');
  await tool('Étape');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/editor-after.png` });
  await page.waitForTimeout(900);
  ok(
    state.calls.some(
      (c) => c.method === 'PATCH' && c.path.endsWith('/demos') && c.body?.settings?.theme?.radius === 10,
    ),
    'thème enregistré dans la démo',
  );
  ok(
    state.calls.some(
      (x) =>
        x.method === 'PATCH' &&
        x.path.endsWith('/demos') &&
        x.body?.settings?.theme?.backgroundGradient === true,
    ),
    'EDT-10 : fond dégradé enregistré',
  );
  // F1 : mode de lecture Spotlight (onglet Design)
  await tool('Design');
  await page.getByRole('button', { name: /Spotlight/ }).click();
  await page.waitForTimeout(900);
  ok(
    state.calls.some(
      (c) => c.method === 'PATCH' && c.path.endsWith('/demos') && c.body?.settings?.mode === 'spotlight',
    ),
    'F1 : mode Spotlight enregistré pour la démo',
  );
  await tool('Étape');
  await page.locator('.rail-list .step').first().click();
  ok((await page.locator('.canvas-spotlight').count()) >= 1, 'F1 : canevas en mode Spotlight (WYSIWYG)');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/f1-editor-spotlight.png` });

  // F1 : checklist (onglet Réglages)
  await tool('Réglages de la démo');
  await page.getByLabel('Afficher la checklist dans le player').check();
  await page.waitForTimeout(900);
  ok(
    state.calls.some(
      (c) =>
        c.method === 'PATCH' && c.path.endsWith('/demos') && c.body?.settings?.checklist?.enabled === true,
    ),
    'F1 : checklist activée',
  );

  // Barre de progression du lecteur : interrupteur actif (plus de « Bientôt »), aide selon l'état
  {
    const sw = page.getByLabel('Barre de progression');
    ok(
      (await sw.isEnabled()) &&
        (await sw.isChecked()) &&
        (await page.getByText('La barre de progression est affichée dans le lecteur.').count()) === 1,
      'barre de progression : interrupteur actif, coché par défaut, sans « Bientôt »',
    );
    await sw.uncheck();
    await page.getByText(/Le lecteur n’affiche que le compteur d’étapes \(«\s2\s\/\s8\s»\)\./).waitFor();
    await page.waitForFunction(() => true);
    const saved = async () =>
      state.calls.some(
        (c) =>
          c.method === 'PATCH' && c.path.endsWith('/demos') && c.body?.settings?.theme?.progress === false,
      );
    for (let i = 0; i < 40 && !(await saved()); i++) await page.waitForTimeout(100);
    ok(await saved(), 'barre de progression décochée : réglage enregistré dans le thème de la démo');
    await sw.check();
  }

  // F1 : menu de choix ajouté depuis le rail
  await tool('Étape');
  await page.locator('.rail-foot').getByRole('button', { name: 'Ajouter une étape' }).click();
  await page.getByRole('menuitem', { name: 'Menu de choix' }).click();
  await page.waitForSelector('.canvas-popup');
  ok((await page.locator('.canvas-choices li').count()) === 2, 'F1 : étape menu de choix (2 choix) créée');
  // L22-09 : réponses une par ligne, règles de suite (index 0 = « Étape suivante », 1 = première étape)
  await pick(page.getByLabel('Destination de la règle 1'), { index: 1 });
  const answers = page.getByLabel('Réponses (une par ligne, 6 au plus)');
  const lines = (await answers.inputValue()).split('\n');
  await answers.fill(['Je suis conseiller', ...lines.slice(1)].join('\n'));
  await page.waitForTimeout(900);
  ok(
    state.calls.some(
      (c) =>
        c.method === 'PATCH' &&
        c.path.endsWith('/steps') &&
        c.body?.options?.choices?.[0]?.label === 'Je suis conseiller' &&
        c.body.options.choices[0].action.type === 'goto',
    ),
    'F1 : choix et destination enregistrés',
  );
  ok(
    (await page.locator('.rail-list .icons [aria-label="2 règles"]').count()) === 1,
    'L22-09 : badge « 2 règles » dans le rail',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/f1-editor-choix.png` });

  // Aperçu intégré (ED12)
  await page.getByRole('radio', { name: 'Aperçu' }).click();
  const pf = page.frameLocator('iframe.preview-frame');
  await pf.locator('.p-tip, .p-text-step').first().waitFor({ timeout: 10000 });
  ok(true, 'aperçu intégré : le player affiche la démo brouillon');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/editor-preview.png` });
  await page.locator('dialog.preview-dialog').getByRole('button', { name: 'Fermer' }).click();

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
