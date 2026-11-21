/** L22-07 : mention @ dans un commentaire (liste de membres, pastille, retour arrière, format stocké). */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { openComments } = require('./editor-rail.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const BASE = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const MARIE = '0b5c1f0e-0000-4000-8000-0000000000b1';
const MATHIS = '0b5c1f0e-0000-4000-8000-0000000000b3';

(async () => {
  const b = await chromium.launch();
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ok = (cond, label) => {
    console.log(`${cond ? 'ok' : 'NOT OK'} - ${label}`);
    if (!cond) process.exitCode = 1;
  };
  const state = seed();
  state.tables.members.push(
    { workspace_id: 'ws-1', user_id: MARIE, role: 'editor', created_at: '2026-01-02' },
    { workspace_id: 'ws-1', user_id: MATHIS, role: 'viewer', created_at: '2026-01-02' },
  );
  state.memberDirectory = {
    [MARIE]: { full_name: 'Marie Durand', email: 'marie@example.com' },
    [MATHIS]: { full_name: 'Mathis Martin', email: 'mathis@example.com' },
  };
  await install(page, state);

  await page.goto(`${BASE}/#/demos/${DEMO}/edit`);
  await openComments(page);
  await page.waitForSelector('.cm');
  const input = page.getByRole('textbox', { name: 'Nouveau commentaire' });
  await input.click();
  await input.type('Bonjour @ma');
  const list = page.getByRole('listbox', { name: 'Membres à mentionner' });
  await list.waitFor();
  ok((await list.getByRole('option').count()) === 2, 'L22-07 : « @ma » filtre deux membres (soi-même exclu)');
  ok((await input.getAttribute('aria-autocomplete')) === 'list', 'L22-07 : aria-autocomplete=list');
  const activeId = await input.getAttribute('aria-activedescendant');
  ok(
    !!activeId && (await page.locator(`[id="${activeId}"]`).getAttribute('aria-selected')) === 'true',
    'L22-07 : aria-activedescendant sur l’option active',
  );
  ok(
    /Éditeur|Éditrice/.test(await list.getByRole('option').first().textContent()),
    'L22-07 : rôle sous le nom',
  );
  if (SHOTS) await page.locator('.cm').screenshot({ path: `${SHOTS}/l22-07-mention${sfx}.png` });

  await input.press('ArrowDown');
  ok(
    /Mathis/.test(await page.locator('[role="option"][aria-selected="true"]').textContent()),
    'L22-07 : flèche bas',
  );
  await input.press('ArrowUp');
  await input.press('Enter');
  ok((await input.inputValue()) === 'Bonjour @Marie Durand ', 'L22-07 : Entrée insère « @Marie Durand »');
  ok((await list.count()) === 0, 'L22-07 : liste fermée après le choix');
  ok(
    (await page.locator('.mi-mirror .mi-tag').textContent()) === '@Marie Durand',
    'L22-07 : pastille dans le champ',
  );

  // Un seul retour arrière supprime la pastille (après l'espace)
  await input.press('Backspace');
  await input.press('Backspace');
  ok((await input.inputValue()) === 'Bonjour ', 'L22-07 : un retour arrière supprime toute la mention');

  // Échap ferme la liste sans fermer le panneau
  await input.type('@mat');
  await list.waitFor();
  await input.press('Escape');
  ok(
    (await list.count()) === 0 && (await page.locator('.cm-compose').count()) === 1,
    'L22-07 : Échap ferme la liste',
  );
  await input.type('h');
  ok((await list.count()) === 0, 'L22-07 : la liste reste fermée pour ce « @ » après Échap');
  for (let i = 0; i < 5; i++) await input.press('Backspace');
  await input.type('@mat');
  await list.waitFor();
  await input.press('Tab');
  await input.type('merci');
  await input.press('Enter');
  await page.waitForSelector('.cm-item .cm-mtag');
  const stored = state.tables.step_comments.at(-1).body;
  ok(stored === `Bonjour @[Mathis Martin](${MATHIS}) merci`, 'L22-07 : format stocké @[Nom](uuid)');
  ok(
    (await page.locator('.cm-item .cm-mtag').textContent()) === '@Mathis Martin',
    'L22-07 : pastille dans le fil',
  );
  ok((await input.inputValue()) === '', 'champ vidé après envoi');

  // Texte « @Inconnu » tapé à la main : pas une mention
  await input.type('Voir @Inconnu ');
  await input.press('Escape');
  await input.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('.cm-item').length === 2);
  ok(state.tables.step_comments.at(-1).body === 'Voir @Inconnu', 'L22-07 : @texte libre non converti');

  // Modifier un commentaire garde la mention
  const item = page.locator('.cm-item').first();
  await item.hover();
  await item.getByRole('button', { name: /Actions|Plus/ }).click();
  await page.getByRole('menuitem', { name: 'Modifier' }).click();
  const edit = page.getByRole('textbox', { name: /Modifier/ });
  ok((await edit.inputValue()) === 'Bonjour @Mathis Martin merci', 'L22-07 : modification en texte lisible');
  await edit.press('End');
  await edit.type(' !');
  await edit.press('Enter');
  await page.waitForTimeout(400);
  ok(
    state.tables.step_comments.find((c) => c.body.startsWith('Bonjour')).body ===
      `Bonjour @[Mathis Martin](${MATHIS}) merci !`,
    'L22-07 : mention conservée après modification',
  );

  ok(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
