/**
 * L43 : composeur de message en un seul cadre (commentaires et assistant). Données fictives, aucun envoi
 * réel (faux backend).
 *  - Commentaires : pas d'avatar ni de ligne d'aide, Entrée envoie, Maj + Entrée, composition (IME),
 *    1 à 8 lignes puis défilement, compteur à 80 %, bouton « Mentionner » (liste au-dessus du cadre),
 *    « Aucun autre membre à mentionner », modification (Annuler, Enregistrer, Échap), erreur d'envoi.
 *  - Assistant : bouton « Arrêter la réponse » pendant la réponse, champ modifiable.
 * Usage : node e2e/composeur.e2e.cjs (THEME=dark et SHOTS_DIR pour les captures)
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const BASE = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const MARIE = '0b5c1f0e-0000-4000-8000-0000000000b1';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const ok = (cond, label) => {
    console.log(`${cond ? 'ok' : 'NOT OK'} - ${label}`);
    if (!cond) process.exitCode = 1;
  };
  const open = async (state, viewport = { width: 1440, height: 900 }) => {
    const ctx = await themedContext(b, { viewport });
    // L48-E : les commentaires sont un outil du rail (dernier outil ouvert gardé)
    await ctx.addInitScript(() => localStorage.setItem('fd.editor.tool', 'comments'));
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await install(page, state);
    await page.goto(`${BASE}/#/demos/${DEMO}/edit`);
    await page.waitForSelector('.cm');
    return page;
  };
  const withMarie = () => {
    const s = seed();
    s.tables.members.push({ workspace_id: 'ws-1', user_id: MARIE, role: 'editor', created_at: '2026-01-02' });
    s.memberDirectory = { [MARIE]: { full_name: 'Marie Durand', email: 'marie@example.com' } };
    return s;
  };

  // ===== Commentaires =====
  const state = withMarie();
  const page = await open(state);
  const input = page.getByRole('textbox', { name: 'Nouveau commentaire' });
  const frame = page.locator('.cm-compose .fd-composer');
  const send = page.locator('.cm-compose').getByRole('button', { name: 'Envoyer', exact: true });
  ok((await page.locator('.cm-compose .cm-avatar').count()) === 0, 'pas d’avatar à côté du champ');
  ok((await page.locator('.cm-compose .cm-hint, .cm-compose__foot').count()) === 0, 'pas de ligne d’aide');
  ok(
    (await input.getAttribute('placeholder')) === 'Écrire un commentaire, @ pour mentionner',
    'aide dans le placeholder',
  );
  ok(
    /Interne à l’équipe, jamais publié\./.test(await page.locator('.cm-head').textContent()),
    'mention de contexte sous le titre du panneau',
  );
  ok(
    (await input.getAttribute('aria-describedby'))?.split(' ').includes('cm-private'),
    'champ décrit par la mention de contexte',
  );
  ok(await send.isDisabled(), 'envoi désactivé : champ vide');
  await input.fill('   ');
  ok(await send.isDisabled(), 'envoi désactivé : espaces seulement');
  if (SHOTS) await page.locator('.cm').screenshot({ path: `${SHOTS}/l43-vide${sfx}.png` });

  // Maj + Entrée, composition, puis Entrée
  await input.fill('Première ligne');
  await input.press('Shift+Enter');
  await input.type('deuxième');
  ok((await input.inputValue()) === 'Première ligne\ndeuxième', 'Maj + Entrée : à la ligne');
  const n = (state.tables.step_comments || []).length;
  await input.evaluate((el) =>
    el.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true }),
    ),
  );
  await page.waitForTimeout(200);
  ok((state.tables.step_comments || []).length === n, 'composition en cours : Entrée n’envoie pas');
  const box = await frame.boundingBox();
  const barTop = (await page.locator('.cm-compose .fd-composer__bar').boundingBox()).y;
  ok(barTop > (await input.boundingBox()).y, 'barre d’actions sous le texte, dans le même cadre');
  if (SHOTS) await page.locator('.cm').screenshot({ path: `${SHOTS}/l43-rempli${sfx}.png` });
  await input.press('Enter');
  await page.waitForTimeout(400);
  ok((state.tables.step_comments || []).length === n + 1, 'Entrée envoie');
  ok((await input.inputValue()) === '', 'après l’envoi : champ vidé');
  ok(await input.evaluate((el) => el === document.activeElement), 'après l’envoi : focus gardé');
  ok(
    Math.abs((await frame.boundingBox()).height - box.height) > 10 &&
      (await input.boundingBox()).height <= 36,
    'après l’envoi : retour à une ligne',
  );

  // Hauteur : 1 à 8 lignes, puis défilement ; barre toujours visible
  await input.fill(Array.from({ length: 12 }, (_, i) => `Ligne ${i + 1}`).join('\n'));
  const h = await input.evaluate((el) => ({
    h: el.clientHeight,
    sh: el.scrollHeight,
    oy: el.style.overflowY,
  }));
  ok(
    h.h <= 192 + 13 && h.h >= 176 && h.sh > h.h && h.oy === 'auto',
    `8 lignes au plus, puis défilement (${h.h} px)`,
  );
  ok(await send.isVisible(), 'barre d’actions visible au-delà de 8 lignes');
  if (SHOTS) await page.locator('.cm').screenshot({ path: `${SHOTS}/l43-multiligne${sfx}.png` });

  // Compteur à partir de 80 % (400 / 500)
  await input.fill('a'.repeat(399));
  ok((await page.locator('.cm-compose .fd-composer__count').count()) === 0, 'pas de compteur sous 80 %');
  await input.fill('a'.repeat(400));
  ok(
    (await page.locator('.cm-compose .fd-composer__count').textContent()) === '400 / 500',
    'compteur « 400 / 500 » à 80 %',
  );
  ok((await input.getAttribute('maxlength')) === '500', 'saisie bloquée à 500 caractères');
  await input.fill('');

  // Bouton « Mentionner »
  const mention = page.locator('.cm-compose').getByRole('button', { name: 'Mentionner' });
  ok((await mention.getAttribute('aria-haspopup')) === 'listbox', 'Mentionner : aria-haspopup=listbox');
  await input.fill('Bonjour');
  await mention.click();
  const list = page.getByRole('listbox', { name: 'Membres à mentionner' });
  await list.waitFor();
  ok((await input.inputValue()) === 'Bonjour @', 'Mentionner : « @ » inséré au curseur');
  ok((await mention.getAttribute('aria-expanded')) === 'true', 'Mentionner : aria-expanded');
  const ac = await page.locator('.cm-compose .mi-ac').boundingBox();
  const fr = await frame.boundingBox();
  ok(ac.y + ac.height <= fr.y && Math.round(ac.width) === 280, 'liste de 280 px au-dessus du cadre');
  ok(
    (await page.locator('.cm-compose .mi-ac__title').textContent()) === 'Mentionner' &&
      /Marie Durand/.test(await list.textContent()),
    'titre « Mentionner », un membre par ligne',
  );
  if (SHOTS) await page.locator('.cm').screenshot({ path: `${SHOTS}/l43-mentions${sfx}.png` });
  await input.press('Escape');
  ok(
    (await list.count()) === 0 && (await input.inputValue()) === 'Bonjour @',
    'Échap ferme la liste sans vider le champ',
  );
  // La liste fermée par Échap reste fermée pour ce « @ » ; un nouveau « @ » la rouvre
  await input.press('Backspace');
  await input.type('@ma');
  await list.waitFor();
  await input.press('Enter');
  ok(/Bonjour @Marie Durand/.test(await input.inputValue()), 'Entrée choisit la mention (sans envoyer)');
  await input.press('Enter');
  await page.waitForTimeout(400);
  const last = state.tables.step_comments.at(-1);
  ok(last.body.includes(MARIE), 'commentaire avec mention envoyé');

  // Infobulle du bouton d'envoi (L44) : « Envoyer » et la touche Entrée
  await input.fill('x');
  await send.hover();
  await page.waitForSelector('.fd-tooltip');
  ok((await page.locator('.fd-tooltip').textContent()) === 'EnvoyerEntrée', 'infobulle « Envoyer · Entrée »');
  await page.mouse.move(5, 5);
  await input.fill('');

  // Modification : Annuler et Enregistrer dans la barre, Entrée enregistre, Échap annule
  await page.getByRole('button', { name: 'Actions sur votre commentaire' }).last().click();
  await page.getByRole('menuitem', { name: 'Modifier' }).click();
  const edit = page.getByRole('textbox', { name: 'Modifier le commentaire' });
  await edit.waitFor();
  const editBar = page.locator('.cm-edit .fd-composer__bar');
  ok(
    (await editBar.getByRole('button', { name: 'Annuler' }).count()) === 1 &&
      (await editBar.getByRole('button', { name: 'Enregistrer' }).count()) === 1,
    'modification : « Annuler » et « Enregistrer » dans la barre',
  );
  ok((await editBar.locator('.lucide-check').count()) === 1, 'modification : icône coche');
  if (SHOTS) await page.locator('.cm').screenshot({ path: `${SHOTS}/l43-modification${sfx}.png` });
  await edit.press('Escape');
  ok((await edit.count()) === 0, 'Échap annule la modification');
  await page.getByRole('button', { name: 'Actions sur votre commentaire' }).last().click();
  await page.getByRole('menuitem', { name: 'Modifier' }).click();
  await edit.fill('Texte corrigé');
  await edit.press('Enter');
  await page.waitForTimeout(400);
  ok(state.tables.step_comments.at(-1).body === 'Texte corrigé', 'Entrée enregistre la modification');
  ok(
    (await new AxeBuilder({ page }).include('.cm').withTags(TAGS).analyze()).violations.length === 0,
    'axe : panneau sans violation',
  );

  // Erreur d'envoi : bordure, alerte, texte conservé, Réessayer
  await page.route('**/rest/v1/step_comments*', (r) =>
    r.request().method() === 'POST' ? r.fulfill({ status: 500, body: '{}' }) : r.fallback(),
  );
  await input.fill('Ce message ne passera pas');
  await input.press('Enter');
  await page.locator('.cm-compose [role="alert"]').waitFor();
  ok(
    (await frame.evaluate((el) => el.classList.contains('is-error'))) &&
      (await input.inputValue()) === 'Ce message ne passera pas',
    'erreur : cadre en erreur, texte conservé',
  );
  ok(
    /Le message n’a pas pu être envoyé\.\s*Réessayer/.test(
      await page.locator('.cm-compose [role="alert"]').textContent(),
    ),
    'erreur : « Le message n’a pas pu être envoyé. Réessayer »',
  );
  await page.unroute('**/rest/v1/step_comments*');
  await page.locator('.cm-compose [role="alert"]').getByRole('button', { name: 'Réessayer' }).click();
  await page.waitForTimeout(400);
  ok(
    state.tables.step_comments.at(-1).body === 'Ce message ne passera pas',
    '« Réessayer » envoie le texte conservé',
  );
  await page.context().close();

  // Fenêtre basse : la barre d'actions reste dans le panneau
  {
    const p = await open(seed(), { width: 1440, height: 600 });
    const field = p.getByRole('textbox', { name: 'Nouveau commentaire' });
    await field.fill(Array.from({ length: 12 }, (_, i) => `Ligne ${i + 1}`).join('\n'));
    const bar = await p.locator('.cm-compose .fd-composer__bar').boundingBox();
    const card = await p.locator('.cm-card').boundingBox();
    ok(bar.y + bar.height <= card.y + card.height + 1, 'fenêtre basse : barre d’actions visible');
    await p.context().close();
  }

  // Personne d'autre à mentionner
  {
    const p = await open(seed());
    const field = p.getByRole('textbox', { name: 'Nouveau commentaire' });
    await p.locator('.cm-compose').getByRole('button', { name: 'Mentionner' }).click();
    ok(
      (await p.locator('.cm-compose .mi-ac__empty').textContent()) === 'Aucun autre membre à mentionner',
      '« Aucun autre membre à mentionner »',
    );
    await field.press('Escape');
    ok((await p.locator('.cm-compose .mi-ac').count()) === 0, 'liste vide fermée par Échap');
    await p.context().close();
  }

  // ===== Assistant =====
  {
    const s = seed();
    s.aiDelay = 1500;
    s.ai = {
      enabled: true,
      features: { assistant: true },
      used: 3,
      quota: 500,
      userToday: 0,
      userDailyRequests: 30,
      workspaceQuotaReached: false,
      userQuotaReached: false,
      renewsOn: '2026-12-01',
      canEdit: true,
      canManage: true,
    };
    s.aiReply = () => ({ text: 'Je propose une bulle plus directe.', changes: [] });
    // Réponse retardée : l'état « réponse en cours » (bouton Arrêter) doit être observable, même sous charge
    s.aiDelay = 1500;
    const p = await open(s);
    await p.getByRole('button', { name: 'Assistant' }).click();
    const panel = p.getByRole('dialog', { name: 'Assistant' });
    const field = panel.getByLabel('Message à l’assistant');
    ok(
      (await field.getAttribute('placeholder')) === 'Posez une question sur cette démo…',
      'assistant : placeholder',
    );
    await field.fill('Rends l’étape plus claire');
    await field.press('Enter');
    const stop = panel.getByRole('button', { name: 'Arrêter la réponse' });
    await stop.waitFor();
    ok(!(await field.isDisabled()), 'assistant : champ modifiable pendant la réponse');
    ok(
      (await panel.locator('.ai-as-msg button', { hasText: 'Arrêter' }).count()) === 0,
      '« Arrêter » quitte le fil',
    );
    if (SHOTS) await panel.screenshot({ path: `${SHOTS}/l43-assistant${sfx}.png` });
    await panel.getByRole('button', { name: 'Envoyer', exact: true }).waitFor({ timeout: 5000 });
    ok(true, 'assistant : « Envoyer » revient après la réponse');
    await p.context().close();
  }

  ok(errors.length === 0, `aucune erreur JavaScript (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.log(`NOT OK - ${e.message.split('\n')[0]} ${(e.stack.match(/composeur.e2e.cjs:\d+/) || [''])[0]}`);
  process.exit(1);
});
