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
  // L41 étape 6 : colonnes Avant et Après ; pour une clé, un état, jamais la clé
  const heads = (await p.locator('table').nth(1).locator('thead th').allInnerTexts()).map((x) => x.trim());
  const cells = await p
    .locator('table')
    .nth(1)
    .locator('tbody tr')
    .evaluateAll((trs) => trs.map((tr) => [...tr.cells].map((c) => c.textContent.trim())));
  const added = cells.find((r) => r[2] === 'Clé IA ajoutée');
  const replaced = cells.find((r) => r[2] === 'Clé IA remplacée');
  ok(
    heads.join('|') === 'Date|Personne|Action|Objet|Avant|Après' &&
      added?.slice(3).join(' | ') === 'Anthropic | Aucune clé | Clé enregistrée, test réussi' &&
      replaced?.slice(3).join(' | ') === 'Anthropic | Clé enregistrée | Clé remplacée, test réussi' &&
      cells.some((r) => r[2] === 'Clé IA testée' && r[4] && r[5]),
    `journal : objet, avant, après (${JSON.stringify([added?.slice(3), replaced?.slice(3)])})`,
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
    // Règles d'Auto empilées : 8 px entre deux règles (décision du chef)
    await pg.locator('.console-ai-rule').first().waitFor();
    const rg = await pg.evaluate(() => {
      const rs = [...document.querySelectorAll('.console-ai-rule')].map((r) => r.getBoundingClientRect());
      return rs.slice(1).map((r, i) => Math.round(r.top - rs[i].bottom));
    });
    ok(
      rg.length === 2 && rg.every((g) => g === 8),
      `390 px : 8 px entre deux règles d’Auto (${rg.join(', ')})`,
    );
    if (SHOTS) await pg.screenshot({ path: `${SHOTS}/console-modeles-390${sfx}.png`, fullPage: true });
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
    // L41 étape 6 : objet | avant | après dans leurs colonnes
    const jc = await p3
      .locator('table')
      .nth(1)
      .locator('tbody tr')
      .evaluateAll((trs) =>
        trs.map((tr) =>
          [...tr.cells]
            .slice(3)
            .map((c) => c.textContent.trim())
            .join(' | '),
        ),
      );
    ok(
      jc.includes('Traduction | Claude Sonnet (défaut) | Claude Opus') &&
        jc.includes('Traduction | Claude Opus | Claude Sonnet (défaut)') &&
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

  // ===== Étape 4 : modèles proposés dans l'assistant =====
  {
    const s5 = seed();
    s5.platformRole = 'admin';
    s5.aiKeys = { anthropic: 'sk-fictive-bonne-000555' };
    s5.ai = { enabled: true };
    const { ctx: c5, p: p5 } = await open(s5);
    await p5.goto(`${APP}/#/console/modeles`);
    await p5.getByRole('heading', { name: 'Assistant IA : modèles proposés' }).waitFor();
    // Texte de l'aperçu, sans les tuiles (initiales du fournisseur)
    const preview = async () =>
      (await p5.locator('.console-ai-preview__menu').locator('.aim-head, .aim-tx').allInnerTexts())
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    ok(
      (await preview()) ===
        'Auto Équilibre la vitesse, l’effort et le coût Recommandé Claude Sonnet Claude Opus',
      `départ : Sonnet et Opus recommandés ; pas d’« Autres modèles » vide dans l’aperçu (${await preview()})`,
    );
    // Haiku proposé, étiquette « Recommandé », monté en tête : l'aperçu suit
    await p5.locator('#ai-as-p-claude-haiku-5-5').check();
    await p5.getByText('Liste de l’assistant enregistrée').first().waitFor();
    ok(
      (await preview()).endsWith('Autres modèles'),
      'Haiku proposé sans étiquette : « Autres modèles » apparaît dans l’aperçu',
    );
    await p5.locator('#ai-as-tag-claude-haiku-5-5').click();
    await p5.getByRole('option', { name: 'Recommandé' }).click();
    await p5.waitForTimeout(300);
    await p5.getByRole('button', { name: 'Monter : Claude Haiku' }).click();
    await p5.waitForTimeout(300);
    await p5.getByRole('button', { name: 'Monter : Claude Haiku' }).click();
    await p5.waitForTimeout(400);
    ok(
      (await p5.locator('.toast', { hasText: 'Liste de l’assistant enregistrée' }).count()) === 1,
      `quatre enregistrements de suite : un seul toast « Liste de l’assistant enregistrée » (${await p5
        .locator('.toast', { hasText: 'Liste de l’assistant enregistrée' })
        .count()})`,
    );
    ok(
      (await preview()).includes('Recommandé Claude Haiku Claude Sonnet Claude Opus') &&
        s5.aiAssistant.map((r) => r.model).join(',') ===
          'claude-haiku-5-5,claude-sonnet-5-5,claude-opus-5-5' &&
        (await p5.evaluate(() => document.activeElement?.id)) === 'ai-as-up-claude-haiku-5-5',
      'ordre et étiquettes reflétés dans l’aperçu ; le focus reste sur « Monter »',
    );
    // Décocher tout : le dernier est refusé
    for (const m of ['claude-haiku-5-5', 'claude-sonnet-5-5']) {
      await p5.locator(`#ai-as-p-${m}`).uncheck();
      await p5.waitForTimeout(300);
    }
    // Refusé : la case reste cochée (clic simple, pas uncheck(), qui exige un changement d'état)
    await p5.locator('#ai-as-p-claude-opus-5-5').click();
    await p5.waitForTimeout(300);
    ok(
      (await p5.locator('#ai-as-keep').innerText()) === 'Gardez au moins un modèle.' &&
        s5.aiAssistant
          .filter((r) => r.proposed)
          .map((r) => r.model)
          .join(',') === 'claude-opus-5-5',
      'décocher le dernier modèle : refusé, « Gardez au moins un modèle. »',
    );
    // Règle d'Auto, journalisée lisiblement
    await p5.locator('#ai-rule-whole_demo').click();
    await p5.getByRole('option', { name: 'Claude Opus' }).click();
    await p5.getByText('Règle d’Auto enregistrée').first().waitFor();
    ok(s5.aiAutoRules.whole_demo === 'claude-opus-5-5', 'règle « Analyse de toute la démo » → Claude Opus');
    ok(
      (await p5.locator('#ai-rule-short').innerText()).includes('Claude Sonnet (non proposé)'),
      'règle dont le modèle n’est plus proposé : la valeur reste visible, « (non proposé) »',
    );
    // Même motif que « Modèle retiré » : bordure orange, phrase sous la règle, ligne dans le bandeau
    const rw = await p5.evaluate(() => {
      const sel = document.querySelector('#ai-rule-short');
      const box = sel?.closest('.fd-sel') ?? sel;
      const probe = document.createElement('span');
      probe.style.color = 'var(--fd-color-warning)';
      document.body.append(probe);
      const warnColor = getComputedStyle(probe).color;
      probe.remove();
      const w = document.getElementById('ai-rule-short-w');
      return {
        border: getComputedStyle(box).borderTopColor,
        warnColor,
        text: w?.textContent ?? '',
        described: sel?.getAttribute('aria-describedby'),
        clipped:
          (w ? w.scrollWidth > w.clientWidth + 1 : true) ||
          [...document.querySelectorAll('.console-ai-rule .fd-sel__value')].some(
            (v) => v.scrollWidth > v.clientWidth + 1,
          ),
        others: ['whole_demo', 'fallback'].filter((r) => document.getElementById(`ai-rule-${r}-w`)),
      };
    });
    ok(
      rw.border === rw.warnColor &&
        rw.text.trim() === 'Non proposé : Auto utilise Claude Opus' &&
        rw.described === 'ai-rule-short-w' &&
        !rw.clipped &&
        rw.others.length === 0,
      `règle « Demandes courtes » : bordure orange, « ${rw.text.trim()} » sans troncature (phrase et valeur des listes), rattachée à la liste`,
    );
    const banner = (await p5.locator('.console-ai-attention').innerText()).replace(/\s+/g, ' ');
    ok(
      banner.includes('1 règle d’Auto vise un modèle qui n’est plus proposé : demandes courtes.'),
      `bandeau d’attention : « ${banner.trim()} »`,
    );
    if (SHOTS) await p5.screenshot({ path: `${SHOTS}/console-modeles-assistant${sfx}.png`, fullPage: true });
    await axe(p5, 'liste de l’assistant');
    await p5.getByRole('link', { name: 'Historique des changements' }).click();
    await p5.getByText('Filtré sur Modèles IA').waitFor();
    const jr = (await p5.locator('table').nth(1).locator('tbody tr').allInnerTexts())
      .join(' | ')
      .replace(/\s+/g, ' ');
    const jc5 = await p5
      .locator('table')
      .nth(1)
      .locator('tbody tr')
      .evaluateAll((trs) => trs.map((tr) => [...tr.cells].slice(3).map((c) => c.textContent.trim())));
    const order = jc5.find((r) => r[0].startsWith('Liste de l’assistant · Ordre'));
    if (SHOTS) await p5.screenshot({ path: `${SHOTS}/console-journal-ia${sfx}.png`, fullPage: true });
    ok(
      jc5.some((r) => r.join(' | ') === 'Auto · analyse de toute la démo | Claude Sonnet | Claude Opus') &&
        // Dernier « Monter » : Haiku passe devant Sonnet
        order?.[1] === 'Claude Sonnet (Recommandé), Claude Haiku (Recommandé), Claude Opus (Recommandé)' &&
        order?.[2] === 'Claude Haiku (Recommandé), Claude Sonnet (Recommandé), Claude Opus (Recommandé)',
      `journal : règle d’Auto et liste de l’assistant avec avant et après (${JSON.stringify(order)})`,
    );
    ok(
      jr.includes('Liste de l’assistant · Claude Haiku : proposé') &&
        jr.includes('Liste de l’assistant · Claude Haiku : étiquette Recommandé') &&
        jr.includes('Liste de l’assistant · Ordre : Claude Haiku, Claude Sonnet, Claude Opus') &&
        jr.includes('Liste de l’assistant · Claude Sonnet : retiré') &&
        !/claude-/.test(jr),
      'journal lisible : proposé, étiquette et ordre distingués ; règle d’Auto',
    );
    // Éditeur : le menu de l'assistant suit la liste de la Console (Opus seul, recommandé)
    await p5.goto(`${APP}/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit`);
    await p5.waitForSelector('.canvas-frame img');
    await p5.getByRole('button', { name: 'Assistant' }).click();
    await p5.locator('.ai-assistant').waitFor();
    await p5.locator('.aim-pill').click();
    const items = (await p5.locator('.aim-menu [role=menuitemradio] .aim-tx b').allInnerTexts()).map((x) =>
      x.trim(),
    );
    ok(
      items.join(',') === 'Auto,Claude Opus',
      `éditeur : menu Auto, Claude Opus seulement (${items.join(', ')})`,
    );
    ok(
      (await p5.locator('.aim-menu [data-more]').count()) === 0 &&
        !/Autres modèles|Le propriétaire choisit/.test(await p5.locator('.aim-menu').innerText()),
      'éditeur : pas d’« Autres modèles » quand le sous-menu serait vide, pas de note du propriétaire',
    );
    await c5.close();
  }
  // Lecture seule : liste et règles désactivées
  {
    const s6 = seed();
    s6.platformRole = 'read_only';
    s6.aiEnvKeys = ['anthropic'];
    const { ctx: c6, p: p6 } = await open(s6);
    await p6.goto(`${APP}/#/console/modeles`);
    await p6.getByRole('heading', { name: 'Assistant IA : modèles proposés' }).waitFor();
    ok(
      (await p6
        .locator('.console-ai-aslist input[type=checkbox]')
        .evaluateAll((xs) => xs.every((x) => x.disabled))) &&
        (await p6
          .locator('.console-ai-moves button')
          .evaluateAll((xs) => xs.every((x) => x.getAttribute('aria-disabled') === 'true'))),
      'Lecture seule : cases et Monter / Descendre désactivés',
    );
    await c6.close();
  }

  // ===== Fonction coupée pendant que l'éditeur est ouvert (503 UNAVAILABLE) =====
  {
    const s4 = seed();
    s4.ai = { enabled: true };
    const { ctx: c4, p: p4 } = await open(s4);
    await p4.goto(`${APP}/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit`);
    await p4.waitForSelector('.canvas-frame img');
    await p4.locator('.canvas-hotspot').first().click();
    await p4.waitForSelector('#hs-body');
    const menu = p4.getByRole('button', { name: 'Assistance IA' }).first();
    await menu.waitFor();
    // TutoClick coupe la rédaction après l'ouverture de l'éditeur
    s4.aiCut = ['write'];
    await menu.click();
    await p4.getByRole('menuitem', { name: 'Raccourcir' }).click();
    await p4.waitForFunction(() => document.activeElement?.classList.contains('ai-entry'));
    const focused = await p4.evaluate(() => {
      const a = document.activeElement;
      const wrap = a?.closest('.ai-disabled-wrap');
      const live = [...document.querySelectorAll('[role="status"], [role="alert"]')]
        .map((e) => ({ role: e.getAttribute('role'), text: e.textContent ?? '' }))
        .filter((e) => e.text.includes('Indisponible pour le moment'));
      return {
        disabled: a?.getAttribute('aria-disabled'),
        describedby: a?.getAttribute('aria-describedby'),
        tip: wrap?.querySelector('.ai-tip')?.textContent ?? '',
        live,
      };
    });
    ok(
      focused.disabled === 'true' && focused.tip.includes('Indisponible pour le moment'),
      `coupée pendant l’édition : 503 UNAVAILABLE, le focus va à l’entrée désactivée, « ${focused.tip.trim()} »`,
    );
    ok(
      focused.live.length === 1 && focused.live[0].role === 'status' && !focused.describedby,
      `« Indisponible » annoncé une seule fois, par role=status (${JSON.stringify(focused.live)}, description au focus : ${focused.describedby ?? 'aucune'})`,
    );
    await p4.keyboard.press('Tab');
    await p4.keyboard.press('Shift+Tab');
    ok(
      !!(await p4.evaluate(() => document.activeElement?.getAttribute('aria-describedby'))),
      'au retour sur l’entrée, la description est de nouveau rattachée',
    );
    await c4.close();
  }

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})();
