/**
 * Sandbox v2, étape 3c : réglages et aperçu dans l'app. Données fictives.
 *  - Éditeur › Réglages du Sandbox : « Sandbox vivant » proposé dès qu'une page a son enregistrement ;
 *    l'activer enregistre demos.sandbox.live ;
 *  - Aperçu de l'éditeur : la page est rejouée avec ses scripts (un compteur réagit) ;
 *  - Paramètres › Sécurité › « Sandbox vivant » : admin, interdire → Enregistrer → RPC et journal ; le
 *    réglage de la démo est alors désactivé, avec la raison ; éditeur : lecture seule.
 * Usage : [THEME=dark] [SHOTS_DIR=…] node e2e/sandbox-vivant-reglages.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const ID = (n) => `0b5c1f0e-0000-4000-8000-0000000003f${n}`;
const U = 'https://crm.exemple.test';

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};

function prepare(state) {
  const ws = state.tables.workspaces[0].id;
  const base = state.tables.steps.find((s) => s.demo_id === DEMO);
  const demo = state.tables.demos.find((d) => d.id === DEMO);
  demo.kind = 'sandbox';
  demo.sandbox = { start: ID(1), autoLink: true, unlinked: 'toast', guide: false, keyPages: [] };
  state.htmlPages = {};
  state.livePages = {};
  state.tables.steps = state.tables.steps.filter((s) => s.demo_id !== DEMO);
  for (const n of [1, 2]) {
    const path = `${ws}/${DEMO}/${ID(n)}.html`;
    const live = `${ws}/${DEMO}/${ID(n)}.json`;
    state.htmlPages[path] =
      `<!doctype html><html><body><h1>Compteur ${n}</h1><p id="v">0</p><button>Ajouter</button></body></html>`;
    state.livePages[live] = {
      url: `${U}/compteur/${n}`,
      html: `<!doctype html><html><body><h1>Compteur ${n}</h1><p id="v">0</p><button id="b">Ajouter</button><script data-fd-script="s1"></script></body></html>`,
      scripts: [
        {
          id: 's1',
          keep: true,
          category: 'page',
          source: 'page',
          code: `let n = 0; document.getElementById('b').onclick = () => (document.getElementById('v').textContent = String(++n));`,
        },
      ],
      responses: [],
    };
    state.tables.steps.push({
      ...base,
      id: ID(n),
      position: n - 1,
      kind: 'html',
      title: `Compteur ${n}`,
      image_path: null,
      html_path: path,
      html_live_path: live,
      html_ops: [],
      html_meta: {
        title: `Compteur ${n}`,
        url: `${U}/compteur/${n}`,
        viewport: { w: 1280, h: 720 },
        links: [],
        live: { scripts: [{ id: 's1', source: 'page', category: 'page', keep: true }], responses: 0 },
      },
    });
  }
  return { ws, demo };
}

(async () => {
  const b = await chromium.launch();
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => {
    if (!/lacks the 'allow-same-origin' flag/.test(e.message)) errors.push(e.message);
  });
  const state = seed();
  const { ws, demo } = prepare(state);
  await install(p, state);

  // ===== Éditeur : réglage de la démo =====
  await p.goto(`${APP}/#/demos/${DEMO}/edit`);
  await p.frameLocator('.html-stage iframe').locator('h1').waitFor();
  // Réglages du Sandbox : vue « Plan »
  await p
    .getByRole('radiogroup', { name: 'Affichage du canevas' })
    .getByRole('radio', { name: 'Plan' })
    .click();
  const live = p.getByLabel('Sandbox vivant', { exact: true });
  await live.waitFor();
  ok(
    !(await live.isChecked()) && (await live.isEnabled()),
    'réglage « Sandbox vivant » proposé, désactivé par défaut',
  );
  ok(
    (await p.locator('#sb-unlinked').isEnabled()) && (await p.locator('#sb-unlinked-h').count()) === 0,
    'sans Sandbox vivant : « Clic sur un élément non relié » actif',
  );
  await live.check();
  await p.waitForTimeout(1400);
  ok(demo.sandbox.live === true, 'activé : demos.sandbox.live enregistré');
  // Recette UX de l'étape 3 : « Clic sur un élément non relié » grisé, avec son aide
  const unlinked = p.locator('#sb-unlinked');
  ok(
    (await unlinked.isDisabled()) &&
      (await p.locator('#sb-unlinked-h').innerText()) ===
        'Sans effet sur une page vivante : elle réagit elle-même.' &&
      (await unlinked.getAttribute('aria-describedby')) === 'sb-unlinked-h',
    'vivant : « Clic sur un élément non relié » grisé, aide « Sans effet sur une page vivante »',
  );
  if (SHOTS) {
    await live.scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${SHOTS}/sandbox-vivant-reglage${sfx}.png` });
  }

  // ===== Aperçu : page rejouée avec son script =====
  await p.getByRole('radio', { name: 'Aperçu' }).click();
  const f = p.frameLocator('iframe.preview-frame').frameLocator('.p-html-frame iframe');
  const vivant = await f
    .getByRole('button', { name: 'Ajouter' })
    .waitFor({ timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  if (vivant) {
    await f.getByRole('button', { name: 'Ajouter' }).click();
    await f.getByRole('button', { name: 'Ajouter' }).click();
  }
  const v = vivant ? await f.locator('#v').innerText() : '';
  ok(v === '2', `aperçu : la page est rejouée, son script réagit (compteur ${v || 'absent'})`);
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/sandbox-vivant-apercu${sfx}.png` });

  // ===== Paramètres › Sécurité : garde-fou =====
  await p.goto(`${APP}/#/settings/security`);
  const card = p.getByRole('region', { name: 'Sandbox vivant' });
  await card.waitFor();
  const sw = card.getByRole('switch', { name: 'Autoriser le Sandbox vivant' });
  ok(await sw.isChecked(), 'Sécurité : Sandbox vivant autorisé par défaut');
  await sw.uncheck();
  await p.getByRole('button', { name: 'Enregistrer' }).click();
  await p.waitForTimeout(800);
  const wsRow = state.tables.workspaces.find((w) => w.id === ws);
  ok(
    wsRow.settings?.sandboxLive === false &&
      (state.tables.audit_log ?? []).some(
        (x) => x.action === 'settings.sandbox_live' && x.meta.new === false,
      ),
    'Sécurité : interdit, enregistré par la RPC et journalisé',
  );
  if (SHOTS) {
    await card.scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${SHOTS}/sandbox-vivant-securite${sfx}.png` });
  }
  await p.goto(`${APP}/#/demos/${DEMO}/edit`);
  await p.frameLocator('.html-stage iframe').locator('h1').waitFor();
  await p
    .getByRole('radiogroup', { name: 'Affichage du canevas' })
    .getByRole('radio', { name: 'Plan' })
    .click();
  const live2 = p.getByLabel('Sandbox vivant', { exact: true });
  await live2.waitFor();
  await p.waitForTimeout(500);
  ok(
    (await live2.isDisabled()) &&
      (await p.locator('#sb-live-h').innerText()).startsWith('Désactivé par un administrateur de l’espace'),
    'interdit par l’espace : réglage de la démo désactivé, avec la raison',
  );
  ok(
    (await p.locator('#sb-unlinked').isEnabled()) && (await p.locator('#sb-unlinked-h').count()) === 0,
    'interdit par l’espace : « Clic sur un élément non relié » de nouveau actif, sans aide',
  );

  // ===== Éditeur de l'espace : lecture seule =====
  const s2 = seed();
  prepare(s2);
  const me = s2.tables.members.find(
    (m) => m.workspace_id === s2.tables.workspaces[0].id && m.role === 'owner',
  );
  if (me) me.role = 'editor';
  const ctx2 = await themedContext(b, { viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const p2 = await ctx2.newPage();
  await install(p2, s2);
  await p2.goto(`${APP}/#/settings/security`);
  const card2 = p2.getByRole('region', { name: 'Sandbox vivant' });
  const seen = await card2
    .waitFor({ timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  ok(
    !seen ||
      ((await card2.getByRole('switch').getAttribute('aria-disabled')) === 'true' &&
        (await card2.innerText()).includes('Seuls les propriétaires et les administrateurs')),
    'éditeur : réglage en lecture seule (ou page réservée)',
  );
  await ctx2.close();

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})();
