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
  ok(
    (await p.locator('main .fd-btn--primary').count()) === 1 &&
      (await p.locator('main .fd-btn--primary').innerText()).includes('Ajouter une clé'),
    'état vide : un seul bouton primaire, « Ajouter une clé » (les lignes en secondaire)',
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
  ok(
    await dlg.evaluate(() => {
      const e = document.getElementById('ai-key-e');
      const h = document.getElementById('ai-key-h');
      return document.getElementById('ai-key').nextElementSibling === e && e.nextElementSibling === h;
    }),
    'erreur juste sous le champ, avant l’aide',
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
  const toasts = await p.locator('.toast').allInnerTexts();
  ok(
    toasts.some((x) => x.includes('320\u00a0ms')) &&
      !toasts.some((x) => / ms\)/.test(x.replace(/\u00a0/g, '·'))),
    'Tester : toast « Anthropic répond (320 ms) », espace insécable avant « ms » (NUM-01)',
  );

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

  // ===== 390 px : en-tête en colonne, bouton sous le texte à 12 px (recette UX) =====
  {
    const s390 = seed();
    s390.platformRole = 'admin';
    const c = await themedContext(b, { viewport: { width: 390, height: 844 }, locale: 'fr-FR' });
    const pg = await c.newPage();
    await install(pg, s390);
    await pg.goto(`${APP}/#/console/modeles`);
    await pg.getByRole('heading', { name: 'Modèles IA', exact: true }).waitFor();
    const m = await pg.evaluate(() => {
      const t = document.querySelector('.console-ai-title').getBoundingClientRect();
      const sub = document.querySelector('.console-ai-head p').getBoundingClientRect();
      const btn = document.querySelector('.console-ai-head > a').getBoundingClientRect();
      return {
        titleH: Math.round(t.height),
        gap: Math.round(btn.top - sub.bottom),
        left: Math.round(btn.left - t.left),
        subLines: Math.round(sub.height / 18),
      };
    });
    ok(
      m.titleH <= 32 && Math.abs(m.gap - 12) <= 1 && Math.abs(m.left) <= 1 && m.subLines <= 3,
      `390 px : titre sur une ligne, bouton sous le texte à 12 px, aligné à gauche (${JSON.stringify(m)})`,
    );
    if (SHOTS) await pg.screenshot({ path: `${SHOTS}/console-modeles-390${sfx}.png` });
    await c.close();
  }

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

  // ===== Étape 3 : modèle par fonction =====
  {
    const s3 = seed();
    s3.platformRole = 'admin';
    s3.aiEnvKeys = ['elevenlabs'];
    s3.aiKeys = { anthropic: 'sk-fictive-bonne-000444' };
    s3.ai = { ...(s3.ai ?? {}), enabled: true };
    const { ctx: c3, p: p3 } = await open(s3);
    await p3.goto(`${APP}/#/console/modeles`);
    await p3.getByRole('heading', { name: 'Modèle par fonction' }).waitFor();
    const FN = {
      'Assistant IA de l’éditeur': 'assistant',
      'Rédaction automatique': 'write',
      Traduction: 'translate',
      Voix: 'voice',
    };
    const fnRow = (name) =>
      p3.locator('.console-ai-fns .console-ai-row').filter({ has: p3.locator(`#ai-fn-${FN[name]}`) });
    const states = await p3.locator('.console-ai-fns .console-ai-fstate').allInnerTexts();
    ok(
      states.length === 6 &&
        states.every((x) => x.trim() === 'Actif') &&
        (await p3.locator('.console-ai-attention').count()) === 0,
      `6 fonctions, toutes « Actif », pas de bandeau (${states.map((x) => x.trim()).join(', ')})`,
    );
    ok(
      (await fnRow('Assistant IA de l’éditeur').locator('.fd-sel').innerText()).includes('Auto · voir') &&
        (await fnRow('Rédaction automatique').locator('.fd-sel').innerText()).includes('Claude Haiku') &&
        (await fnRow('Voix').locator('.fd-sel').innerText()).includes('ElevenLabs · voix multilingue'),
      'défauts : Auto pour l’assistant, Claude Haiku pour la rédaction, ElevenLabs pour la voix',
    );
    // Changement : Traduction → Claude Opus, toast avec Annuler
    await fnRow('Traduction').locator('.fd-sel').click();
    await p3.getByRole('option', { name: /Claude Opus/ }).click();
    await p3.getByText('Traduction : Claude Opus').waitFor();
    ok(s3.aiFnModels.translate === 'claude-opus-5-5', 'Traduction : Claude Opus enregistré');
    await p3.waitForTimeout(200);
    ok(
      (await p3.evaluate(() => document.activeElement?.id)) === 'ai-fn-translate',
      'souris : le focus reste sur la liste de la fonction changée (WCAG 2.4.3)',
    );
    await p3.locator('.toast').getByRole('button', { name: 'Annuler' }).click();
    await p3.waitForTimeout(500);
    // Clavier : Entrée, Flèche bas, Entrée sur « Vérification de cohérence »
    await p3.locator('#ai-fn-suggest').focus();
    await p3.keyboard.press('Enter');
    await p3.getByRole('option', { name: /Claude Opus/ }).waitFor();
    await p3.keyboard.press('ArrowDown');
    await p3.keyboard.press('Enter');
    await p3.waitForFunction(() =>
      /Claude Opus/.test(document.getElementById('ai-fn-suggest')?.textContent ?? ''),
    );
    await p3.waitForTimeout(300);
    ok(
      s3.aiFnModels.suggest === 'claude-opus-5-5' &&
        (await p3.evaluate(() => document.activeElement?.id)) === 'ai-fn-suggest',
      'clavier : choix enregistré, le focus reste sur la liste',
    );
    ok(
      (await p3.locator('#ai-fn-suggest').evaluate((e) => Math.round(e.getBoundingClientRect().height))) ===
        40,
      'listes de 40 px (spec §3)',
    );
    ok(
      !s3.aiFnModels.translate &&
        (await fnRow('Traduction').locator('.fd-sel').innerText()).includes('Claude Sonnet'),
      'Annuler : retour au modèle précédent (défaut, Claude Sonnet)',
    );
    if (SHOTS) await p3.screenshot({ path: `${SHOTS}/console-modeles-fonctions${sfx}.png`, fullPage: true });
    await p3.getByRole('link', { name: 'Historique des changements' }).click();
    await p3.waitForURL(/equipe\?objet=ai/);
    await p3.getByText('Filtré sur Modèles IA').waitFor();
    const jr = (await p3.locator('table').nth(1).locator('tbody tr').allInnerTexts()).map((x) =>
      x.replace(/\s+/g, ' '),
    );
    ok(
      jr.some((x) => x.includes('Traduction · Claude Sonnet (défaut) → Claude Opus')) &&
        jr.some((x) => x.includes('Traduction · Claude Opus → Claude Sonnet (défaut)')) &&
        !jr.some((x) => /claude-|translate|suggest/.test(x)) &&
        jr.every((x) => /Clé IA|Modèle IA/.test(x)),
      `journal filtré sur Modèles IA, lisible (${jr.length} lignes, ex. « ${jr.find((x) => x.includes('Traduction')) ?? ''} »)`,
    );
    await p3.goto(`${APP}/#/console/modeles`);
    await p3.getByRole('heading', { name: 'Modèle par fonction' }).waitFor();
    await axe(p3, 'modèle par fonction');

    // Modèle retiré : repli et bandeau
    s3.aiFnModels.translate = 'claude-ancien-4';
    await p3.reload();
    await p3.getByRole('heading', { name: 'Modèle par fonction' }).waitFor();
    await p3.locator('.console-ai-attention').waitFor();
    ok(
      (await p3.locator('.console-ai-attention').innerText())
        .replace(/\s+/g, ' ')
        .includes('1 fonction en repli, son modèle est retiré : Traduction.') &&
        (await fnRow('Traduction').locator('.console-ai-pick.is-retired').count()) === 1 &&
        (await fnRow('Traduction').innerText())
          .replace(/\s+/g, ' ')
          .includes('Modèle retiré : repli sur Claude Sonnet') &&
        (await fnRow('Traduction').locator('.fd-sel').innerText()).includes('Ancien modèle (retiré)'),
      'modèle retiré : bandeau par cause, bordure orange, repli sur le défaut de la fonction (Claude Sonnet)',
    );
    if (SHOTS) await p3.screenshot({ path: `${SHOTS}/console-modeles-retire${sfx}.png`, fullPage: true });
    await axe(p3, 'modèle retiré');

    // Clé manquante : fonctions coupées, l'espace voit « Indisponible pour le moment »
    delete s3.aiFnModels.translate;
    s3.aiKeys = {};
    await p3.reload();
    await p3.getByRole('heading', { name: 'Modèle par fonction' }).waitFor();
    await p3.locator('.console-ai-attention').waitFor();
    ok(
      (await fnRow('Traduction').innerText()).includes('Clé Anthropic manquante : coupée') &&
        (await fnRow('Voix').innerText()).includes('Actif') &&
        /4 fonctions coupées faute de clé Anthropic : Assistant IA de l’éditeur, Rédaction automatique, Vérification de cohérence et Traduction\./.test(
          (await p3.locator('.console-ai-attention').innerText()).replace(/\s+/g, ' '),
        ) &&
        ['assistant', 'translate', 'write'].every((f) => s3.aiCut.includes(f)) &&
        !s3.aiCut.includes('voice'),
      `clé Anthropic manquante : 4 fonctions coupées (${s3.aiCut.join(', ')}), la voix reste active`,
    );
    if (SHOTS) await p3.screenshot({ path: `${SHOTS}/console-modeles-coupee${sfx}.png`, fullPage: true });
    await p3.goto(`${APP}/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit`);
    await p3.waitForSelector('.canvas-frame img');
    await p3.locator('.canvas-hotspot').first().click();
    await p3.waitForSelector('#hs-body');
    await p3.locator('.ai-entry').first().waitFor();
    // Entrée amenée en bas de la fenêtre (900 px) : l'infobulle doit rester visible, ouverte au-dessus
    const last = p3.locator('.ai-disabled-wrap').last();
    await last.evaluate((e) => e.scrollIntoView({ block: 'end' }));
    await last.hover();
    await p3.waitForTimeout(250);
    const tr = await last.locator('.ai-tip').evaluate((e) => {
      const r = e.getBoundingClientRect();
      return {
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        h: innerHeight,
        above: e.classList.contains('ai-tip--above'),
      };
    });
    ok(
      tr.top >= 0 && tr.bottom <= tr.h,
      `infobulle visible dans la fenêtre de ${tr.h} px (${tr.top} → ${tr.bottom}${tr.above ? ', ouverte au-dessus' : ''})`,
    );
    const tip = (await p3.locator('.ai-tip').first().textContent()) || '';
    ok(
      (await p3.locator('.ai-entry').first().getAttribute('aria-disabled')) === 'true' &&
        tip.includes('Indisponible pour le moment') &&
        (await p3.getByRole('link', { name: 'Ouvrir le réglage' }).count()) === 0,
      `espace : entrée IA désactivée, « ${tip.trim()} », sans lien vers le réglage`,
    );
    await p3.keyboard.press('Escape');
    await p3.getByRole('button', { name: 'Assistant' }).click();
    await p3.locator('.ai-assistant').waitFor();
    const starters = p3.locator('.ai-as-starters button');
    ok(
      (await p3.locator('.ai-as-unavailable').innerText()).includes('Indisponible pour le moment') &&
        (await starters.count()) === 3 &&
        (await starters.evaluateAll((bs) => bs.every((b) => b.getAttribute('aria-disabled') === 'true'))) &&
        (await p3.locator('.ai-assistant textarea').isDisabled()) &&
        !(s3.aiCalls ?? []).length,
      'Assistant coupé : « Indisponible » dès l’ouverture, suggestions et envoi désactivés, aucune demande',
    );
    if (SHOTS) await p3.screenshot({ path: `${SHOTS}/console-modeles-assistant-coupe${sfx}.png` });
    await c3.close();
  }

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})();
