/** L22-05/06 : cloche, centre de notifications, lien vers le fil, préférences, état vide. */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const BASE = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const MARIE = '0b5c1f0e-0000-4000-8000-0000000000b1';
const SACHA = '0b5c1f0e-0000-4000-8000-0000000000b2';
// Identifiant au format UUID pour la mention stockée (l'utilisateur du faux Supabase est « u-alice »)
const ALICE_UUID = '0b5c1f0e-0000-4000-8000-0000000000a1';

const ago = (min) => new Date(Date.now() - min * 60_000).toISOString();

function withNotifications() {
  const state = seed();
  const me = state.user.id;
  state.tables.members.push(
    { workspace_id: 'ws-1', user_id: MARIE, role: 'editor', created_at: ago(9000) },
    { workspace_id: 'ws-1', user_id: SACHA, role: 'editor', created_at: ago(9000) },
  );
  state.memberDirectory = {
    [MARIE]: { full_name: 'Marie Durand', email: 'marie@example.com' },
    [SACHA]: { full_name: 'Sacha Durand', email: 'sacha@example.com' },
  };
  const comment = (id, step, author, body, min, extra = {}) => ({
    id,
    step_id: step,
    demo_id: DEMO,
    workspace_id: 'ws-1',
    author_id: author,
    body,
    created_at: ago(min),
    updated_at: ago(min),
    resolved_at: null,
    resolved_by: null,
    ...extra,
  });
  state.tables.step_comments = [
    comment('c1', 's2', MARIE, `@[Alice](${ALICE_UUID}) peux-tu vérifier le libellé du bouton ?`, 5),
    comment('c2', 's1', SACHA, 'C’est corrigé, j’ai remplacé la capture.', 40),
    comment('c3', 's1', MARIE, 'Le texte de la bulle est un peu long.', 3 * 1440),
    comment('c4', 's1', me, 'Capture à refaire.', 12 * 1440, {
      resolved_at: ago(11 * 1440),
      resolved_by: SACHA,
    }),
  ];
  const notif = (id, kind, comment_id, step_id, actor, min, read) => ({
    id,
    workspace_id: 'ws-1',
    user_id: me,
    kind,
    demo_id: DEMO,
    step_id,
    comment_id,
    actor_id: actor,
    created_at: ago(min),
    read_at: read ? ago(min - 1) : null,
  });
  state.tables.notifications = [
    notif('n1', 'mention', 'c1', 's2', MARIE, 5, false),
    notif('n2', 'reply', 'c2', 's1', SACHA, 40, false),
    notif('n3', 'comment', 'c3', 's1', MARIE, 3 * 1440, true),
    notif('n4', 'resolved', 'c4', 's1', SACHA, 11 * 1440, true),
    // Fil supprimé (ou devenu illisible) : la notification ne s'affiche pas
    notif('n5', 'comment', 'c-gone', 's1', MARIE, 60, false),
  ];
  return state;
}

(async () => {
  const b = await chromium.launch();
  const page = await (await themedContext(b, { viewport: { width: 1440, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ok = (cond, label) => {
    console.log(`${cond ? 'ok' : 'NOT OK'} - ${label}`);
    if (!cond) process.exitCode = 1;
  };
  const state = withNotifications();
  await install(page, state);

  await page.goto(`${BASE}/#/`);
  const bell = page.getByRole('button', { name: /^Notifications,/ });
  await page.waitForFunction(() =>
    /2 non lues/.test(document.querySelector('.nb-bell')?.getAttribute('aria-label') ?? ''),
  );
  ok(
    (await bell.getAttribute('aria-label')) === 'Notifications, 2 non lues',
    'L22-05 : cloche « Notifications, 2 non lues »',
  );
  ok((await page.textContent('.nb-cnt')) === '2', 'L22-05 : pastille 2 (fil supprimé ignoré)');
  ok((await bell.getAttribute('aria-haspopup')) === 'dialog', 'L22-05 : aria-haspopup=dialog');

  await bell.click();
  const dlg = page.getByRole('dialog', { name: 'Notifications' });
  await dlg.waitFor();
  ok((await bell.getAttribute('aria-expanded')) === 'true', 'L22-05 : aria-expanded à l’ouverture');
  const groups = await dlg.locator('.nb-group').allTextContents();
  ok(groups.join('|') === 'Aujourd’hui|Cette semaine|Plus ancien', 'L22-05 : groupes par date');
  ok(
    (await dlg.locator('.nb-list li').count()) === 4,
    'L22-05 : 4 notifications (30 jours, fil illisible exclu)',
  );
  const first = dlg.locator('.nb-list li').first();
  ok(
    /Marie Durand vous a mentionné·e dans «\s?Démo CRM\s?» · étape 2/.test(await first.textContent()),
    'L22-05 : phrase de mention avec démo et étape',
  );
  ok(
    (await first.locator('.nb-mtag').textContent()) === '@Alice',
    'L22-05 : mention en pastille dans l’extrait',
  );
  ok(
    (await first.locator('.sr-only').textContent()) === 'Non lue',
    'L22-05 : « Non lue » pour les lecteurs d’écran',
  );
  ok(
    (await dlg.getByRole('tab', { name: 'Mentions · 1' }).count()) === 1 &&
      (await dlg.getByRole('tab', { name: 'Non lues · 2' }).count()) === 1,
    'L22-05 : filtres avec compteurs',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/l22-05-notifications${sfx}.png` });

  await dlg.getByRole('tab', { name: 'Toutes' }).focus();
  await page.keyboard.press('ArrowRight');
  ok(
    (await dlg.getByRole('tab', { name: /Mentions/ }).getAttribute('aria-selected')) === 'true' &&
      (await dlg.locator('.nb-list li').count()) === 1,
    'L22-05 : flèches entre les filtres, liste filtrée',
  );
  await page.keyboard.press('Escape');
  ok(
    (await dlg.count()) === 0 &&
      (await page.evaluate(() => document.activeElement?.classList.contains('nb-bell'))),
    'Échap ferme, focus rendu à la cloche',
  );

  // Préférences : un interrupteur par type, e-mail « Bientôt »
  await bell.click();
  await dlg.getByRole('button', { name: 'Préférences' }).click();
  const prefs = page.getByRole('dialog', { name: 'Préférences de notification' });
  await prefs.waitFor();
  ok((await prefs.getByRole('switch').count()) === 6, 'L22-05 : 4 types + alertes (L19) + e-mail');
  ok(
    await prefs.getByRole('switch', { name: /e-mail/ }).isDisabled(),
    'L22-05 : e-mail désactivé, « Bientôt »',
  );
  await prefs.getByRole('switch', { name: /répond à un fil/ }).uncheck();
  await page.waitForTimeout(400);
  ok(
    (state.tables.notification_settings || []).find((x) => x.user_id === state.user.id)?.prefs?.reply ===
      false,
    'L22-05 : préférence enregistrée (table propre à l’utilisateur)',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/l22-05-preferences${sfx}.png` });
  await prefs.getByRole('button', { name: 'Retour aux notifications' }).click();

  // Ouvrir une notification : éditeur sur l'étape, fil ouvert, notification lue
  await dlg.getByRole('link', { name: 'Ouvrir la mention de Marie Durand, étape 2' }).click();
  await page.waitForFunction(() => location.hash.includes('/edit?step=s2&comment=c1'));
  await page.waitForSelector('.cm-item--focus[data-comment="c1"]', { timeout: 10000 });
  ok(true, 'L22-05 : éditeur ouvert sur le fil, commentaire mis en évidence');
  ok(/Étape 2/.test(await page.textContent('.stage-head')), 'L22-05 : étape de la notification sélectionnée');
  ok(!!state.tables.notifications.find((x) => x.id === 'n1').read_at, 'L22-05 : ouvrir la marque comme lue');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/l22-05-fil${sfx}.png` });

  await page.goto(`${BASE}/#/analytics`);
  await page.waitForFunction(() =>
    /1 non lue$/.test(document.querySelector('.nb-bell')?.getAttribute('aria-label') ?? ''),
  );
  ok(true, 'L22-05 : cloche aussi sur Analytics, « 1 non lue »');
  await page.locator('.nb-bell').click();
  await page.getByRole('button', { name: 'Tout marquer comme lu' }).click();
  ok((await page.locator('.nb-cnt').count()) === 0, 'L22-05 : tout marquer comme lu vide la pastille');
  ok(
    state.tables.notifications.filter((x) => x.id !== 'n5').every((x) => x.read_at),
    'L22-05 : lues en base',
  );

  // L22-06 : état vide
  const p2 = await (await themedContext(b, { viewport: { width: 1440, height: 900 } })).newPage();
  p2.on('pageerror', (e) => errors.push(e.message));
  await install(p2, seed());
  await p2.goto(`${BASE}/#/`);
  const bell2 = p2.locator('.nb-bell');
  await bell2.waitFor();
  ok(
    (await bell2.getAttribute('aria-label')) === 'Notifications, aucune non lue',
    'L22-06 : « aucune non lue »',
  );
  await bell2.click();
  await p2.waitForSelector('.nb-empty');
  ok(/Rien de nouveau/.test(await p2.textContent('.nb-empty')), 'L22-06 : « Rien de nouveau »');
  ok((await p2.getAttribute('.nb-empty', 'role')) === 'status', 'L22-06 : role=status');
  if (SHOTS) await p2.screenshot({ path: `${SHOTS}/l22-06-vide${sfx}.png` });

  ok(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
