/**
 * L41 étape 2 : Console › Modèles IA, section Fournisseurs (spec UX l41-console-modeles-ia §2 et §7).
 * Faux backend, données et clés fictives ; aucun appel réseau.
 *  - Client : pas d'onglet ; #/console/modeles renvoie à l'accueil.
 *  - Admin : état vide, puis clé de déploiement (« Clé définie au déploiement ») ; Tester et enregistrer :
 *    échec → erreur sous le champ, rien n'est gardé ; succès → Connecté, « Clé ajoutée le … », toast ;
 *    la clé n'apparaît JAMAIS (DOM, réponses du faux serveur) ; Tester → toast « Anthropic répond (320 ms) » ;
 *    clé refusée → « Clé refusée » et sa cause ; journal.
 *  - Lecture seule : tout visible, actions désactivées.
 *  - axe sans violation sérieuse. Usage : [THEME=dark] [SHOTS_DIR=…] node e2e/console-modeles.e2e.cjs
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const BAD = 'sk-fictive-refusee-000111';
const GOOD = 'sk-fictive-bonne-000222';
const GOOD2 = 'sk-fictive-bonne-000333';

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const axe = async (p, label) => {
    const r = await new AxeBuilder({ page: p }).withTags(TAGS).analyze();
    const bad = r.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    ok(
      bad.length === 0,
      `axe : ${label}${bad.length ? ` (${bad.map((v) => `${v.id} ${v.nodes[0]?.target}`).join(', ')})` : ''}`,
    );
  };
  const open = async (state) => {
    const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    const bodies = [];
    p.on('response', async (r) => {
      if (r.url().includes('/functions/v1/ai')) bodies.push(await r.text().catch(() => ''));
    });
    await install(p, state);
    return { ctx, p, bodies };
  };

  // ===== Client : rien =====
  {
    const { ctx, p } = await open(seed());
    await p.goto(`${APP}/#/console/modeles`);
    await p.waitForTimeout(800);
    ok(!/console/.test(p.url()), `client : #/console/modeles renvoie à l’accueil (${p.url().split('#')[1]})`);
    await ctx.close();
  }

  // ===== Admin de la plateforme =====
  const state = seed();
  state.platformRole = 'admin';
  const { ctx, p, bodies } = await open(state);
  await p.goto(`${APP}/#/console/modeles`);
  await p.getByRole('heading', { name: 'Modèles IA', exact: true }).waitFor();
  const tab = p.locator('.console-top nav').getByRole('link', { name: 'Modèles IA' });
  ok(
    (await tab.count()) === 1 && (await tab.getAttribute('aria-current')) === 'page',
    'onglet « Modèles IA », actif',
  );
  const tabs = await p.locator('.console-top nav a').allInnerTexts();
  ok(
    tabs.at(-1).trim() === 'Modèles IA',
    `onglet après « Équipe et journal » (${tabs.map((x) => x.trim().replace(/\s+/g, ' ')).join(' · ')})`,
  );
  ok(
    await p.getByRole('heading', { name: 'Aucun fournisseur connecté' }).isVisible(),
    'aucune clé : état vide',
  );
  const row = (name) => p.locator('.console-ai-row').filter({ has: p.locator('b', { hasText: name }) });
  ok(
    (await row('OpenAI').locator('.console-ai-pill').innerText()).trim() === 'Clé manquante' &&
      (await p.locator('.console-ai-row.is-soon').innerText()).includes('Bientôt'),
    'Fournisseurs : « Clé manquante », « Autres fournisseurs · Bientôt »',
  );
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/console-modeles-vide${sfx}.png`, fullPage: true });
  await axe(p, 'état vide');

  // Échec : erreur sous le champ, rien n'est gardé
  await p.getByRole('button', { name: 'Ajouter la clé OpenAI' }).click();
  const dlg = p.getByRole('dialog', { name: 'Ajouter la clé OpenAI' });
  await dlg.waitFor();
  const field = dlg.getByLabel('Clé d’API');
  ok(
    (await field.getAttribute('type')) === 'password' &&
      (await dlg.getByRole('button', { name: /Afficher/ }).count()) === 0 &&
      (await dlg.innerText()).includes('Collée une seule fois'),
    'fenêtre : champ mot de passe sans « Afficher », aide « Collée une seule fois »',
  );
  await field.fill(BAD);
  await dlg.getByRole('button', { name: 'Tester et enregistrer' }).click();
  await dlg.getByRole('alert').waitFor();
  ok(
    (await dlg.getByRole('alert').innerText()).includes('Le fournisseur refuse la clé (401)') &&
      !state.aiKeys?.openai &&
      (await field.inputValue()) === '',
    'échec du test : erreur sous le champ, rien n’est enregistré, champ vidé',
  );
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/console-modeles-echec${sfx}.png` });
  await axe(p, 'fenêtre en erreur');
  await dlg.getByRole('button', { name: 'Annuler' }).click();

  // Succès : Anthropic
  await p.getByRole('button', { name: 'Ajouter la clé Anthropic' }).click();
  const dlg2 = p.getByRole('dialog', { name: 'Ajouter la clé Anthropic' });
  await dlg2.getByLabel('Clé d’API').fill(GOOD);
  await dlg2.getByRole('button', { name: 'Tester et enregistrer' }).click();
  await p.getByText('Clé Anthropic ajoutée : le fournisseur répond (320 ms)').waitFor();
  await p.waitForTimeout(300);
  ok(
    (await row('Anthropic').locator('.console-ai-pill').innerText()).trim() === 'Connecté' &&
      /Clé ajoutée le /.test(await row('Anthropic').innerText()) &&
      (await p.getByRole('heading', { name: 'Aucun fournisseur connecté' }).count()) === 0,
    'succès : « Connecté », « Clé ajoutée le … », toast, plus d’état vide',
  );

  // Tester
  await p.getByRole('button', { name: 'Tester la clé Anthropic' }).click();
  await p.getByText('Anthropic répond (320 ms)').waitFor();
  ok(true, 'Tester : toast « Anthropic répond (320 ms) »');

  // Remplacer
  await p.getByRole('button', { name: 'Remplacer la clé Anthropic' }).click();
  const dlg3 = p.getByRole('dialog', { name: 'Remplacer la clé Anthropic' });
  await dlg3.getByLabel('Clé d’API').fill(GOOD2);
  await dlg3.getByRole('button', { name: 'Tester et enregistrer' }).click();
  await p.getByText('Clé Anthropic remplacée : le fournisseur répond (320 ms)').waitFor();
  ok(state.aiKeys.anthropic === GOOD2, 'Remplacer : la nouvelle clé prend la place');

  // Clé de déploiement et clé refusée (état serveur)
  state.aiEnvKeys = ['elevenlabs'];
  state.aiEnvKeyValue = 'xi-fictive-deploiement-refusee';
  await p.reload();
  await p.getByRole('heading', { name: 'Modèles IA', exact: true }).waitFor();
  ok(
    /Clé définie au déploiement/.test(await row('ElevenLabs').innerText()),
    'clé de déploiement : « Clé définie au déploiement »',
  );
  await p.getByRole('button', { name: 'Tester la clé ElevenLabs' }).click();
  await p.getByText('ElevenLabs : Le fournisseur refuse la clé (401)').waitFor();
  await p.waitForTimeout(400);
  ok(
    (await row('ElevenLabs').locator('.console-ai-pill').innerText()).trim() === 'Clé refusée' &&
      (await row('ElevenLabs').innerText()).includes('Le fournisseur refuse la clé (401)'),
    'test refusé : « Clé refusée » et sa cause',
  );
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/console-modeles-fournisseurs${sfx}.png`, fullPage: true });
  await axe(p, 'fournisseurs (connecté, manquante, refusée)');

  // La clé n'apparaît jamais
  const html = await p.content();
  const all = bodies.join('\n');
  ok(
    ![BAD, GOOD, GOOD2, 'xi-fictive-deploiement-refusee'].some((k) => html.includes(k) || all.includes(k)),
    `aucune clé dans le DOM ni dans les ${bodies.length} réponses du serveur`,
  );

  // Journal
  await p.goto(`${APP}/#/console/equipe`);
  await p.getByRole('table', { name: 'Journal d’audit' }).or(p.locator('table').nth(1)).waitFor();
  const journal = await p.locator('table').nth(1).innerText();
  ok(
    ['Clé IA ajoutée', 'Clé IA remplacée', 'Clé IA testée'].every((x) => journal.includes(x)) &&
      ![GOOD, GOOD2].some((k) => journal.includes(k)),
    'journal : ajoutée, remplacée, testée, sans la clé',
  );
  await ctx.close();

  // ===== Lecture seule =====
  {
    const s = seed();
    s.platformRole = 'read_only';
    s.aiEnvKeys = ['anthropic'];
    const { ctx: c2, p: p2 } = await open(s);
    await p2.goto(`${APP}/#/console/modeles`);
    await p2.getByRole('heading', { name: 'Modèles IA', exact: true }).waitFor();
    const acts = p2.locator('.console-ai-acts button');
    const n = await acts.count();
    const disabled = await acts.evaluateAll((els) =>
      els.every((e) => e.getAttribute('aria-disabled') === 'true'),
    );
    ok(n >= 3 && disabled, `Lecture seule : ${n} actions visibles, toutes désactivées`);
    await acts.first().click({ force: true });
    await p2.waitForTimeout(300);
    ok(
      (await p2.getByRole('dialog').count()) === 0 && !Object.keys(s.aiKeys ?? {}).length,
      'Lecture seule : aucune fenêtre, rien d’écrit',
    );
    await c2.close();
  }

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})();
