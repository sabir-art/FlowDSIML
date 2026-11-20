/**
 * Recette L48-A (spec docs/ux/specs/l48a-navigation.md §1, §4, §5, §6, §7). Données fictives.
 *  - barre latérale : Contenus, Formation, Utilitaires (Extension, Centre d'aide, Paramètres) ; plus de
 *    Leads, Membres ni Plans ; deux nav ; « Espace · n membres » ; Paramètres actif sur /settings/* ;
 *  - modale Extension (non détectée, puis détectée) ; Centre d'aide ouvre le tiroir ;
 *  - Utilisation : aucun prix ni offre, jauges à 2, 82 et 100 %, « Demander plus à la DSI » avec le lien
 *    du support (masqué sans lien) ; /settings/plans et /settings/soon redirigés ;
 *  - textes : aucun « Workspace », « € » ni « facturation » dans fr.json.
 * Usage : node e2e/l48a-navigation.e2e.cjs
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install } = require('./fake-supabase.cjs');
const { seedMaquette } = require('./maquette-data.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const MB = 1024 * 1024;

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const open = async (route, seed, width = 1440) => {
    const ctx = await b.newContext({ viewport: { width, height: 900 }, locale: 'fr-FR' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    const data = seedMaquette();
    if (seed) seed(data);
    const state = await install(page, data);
    await page.goto(`${APP}${route}`);
    return { page, state, ctx };
  };

  // ===== §1 Barre latérale =====
  {
    const { page, ctx } = await open('/#/');
    const main = page.getByRole('navigation', { name: 'Navigation principale' });
    await main.waitFor();
    const utils = page.getByRole('navigation', { name: 'Utilitaires' });
    const names = (await main.locator('.fd-nav__item').allTextContents()).map((s) => s.trim());
    ok(
      names.join('|') === 'Démos|Parcours de formation|Analytics|Apprenants',
      `Contenus puis Formation : ${names.join(', ')}`,
    );
    ok(
      (await utils.locator('.fd-nav__item').allTextContents()).map((s) => s.trim()).join('|') ===
        'Extension|Centre d’aide|Paramètres',
      'Utilitaires : Extension, Centre d’aide, Paramètres',
    );
    const side = await page.locator('#sidebar').innerText();
    ok(
      !/\bLeads\b|\bMembres\b|\bPlans\b|Workspace/.test(side),
      'ni Leads, ni Membres, ni Plans, ni « Workspace »',
    );
    ok(
      (await main.locator('[aria-current="page"]').textContent()).trim() === 'Démos',
      'page active : aria-current sur « Démos »',
    );
    ok(
      /^Espace · \d+ membres?$/.test(await page.locator('.ws-text small').innerText()),
      'sous-titre « Espace · n membres »',
    );

    // Extension : non détectée
    await utils.getByRole('button', { name: 'Extension' }).click();
    const dlg = page.getByRole('dialog', { name: 'Installer l’extension' });
    await dlg.waitFor();
    ok((await dlg.locator('.ext-steps li').count()) === 3, 'Extension non détectée : trois étapes');
    await page.keyboard.press('Escape');
    await dlg.waitFor({ state: 'hidden' });
    ok(
      await page.evaluate(() => document.activeElement?.textContent?.trim() === 'Extension'),
      'Échap ferme la modale et rend le focus',
    );

    // Centre d'aide : ouvre le tiroir
    await utils.getByRole('button', { name: 'Centre d’aide' }).click();
    await page.getByRole('complementary', { name: 'Aide' }).waitFor();
    ok(true, 'Centre d’aide ouvre le tiroir d’aide');
    await page.keyboard.press('Escape');

    // Paramètres : actif sur toutes les pages /settings/*
    await utils.getByRole('link', { name: 'Paramètres' }).click();
    await page.waitForURL(/settings\/workspace/);
    for (const r of ['/#/settings/workspace', '/#/settings/glossary', '/#/settings/profile']) {
      await page.goto(`${APP}${r}`);
      await page.locator('.snav').waitFor();
      ok(
        (await utils.locator('[aria-current="page"]').textContent())?.trim() === 'Paramètres',
        `Paramètres actif sur ${r}`,
      );
    }
    await ctx.close();
  }

  // Extension détectée ; éditeur : pas d'entrée « Parcours de formation » (droits inchangés)
  {
    const { page, ctx } = await open('/#/', (d) => {
      d.tables.profiles[0].extension_seen_at = '2026-11-02T10:00:00Z';
      d.tables.members[0].role = 'editor';
    });
    await page.getByRole('navigation', { name: 'Navigation principale' }).waitFor();
    ok(
      (await page.getByRole('link', { name: 'Parcours de formation' }).count()) === 0,
      'éditeur : pas de « Parcours de formation »',
    );
    await page.getByRole('button', { name: 'Extension', exact: true }).click();
    const dlg = page.getByRole('dialog', { name: 'Extension installée' });
    await dlg.waitFor();
    ok(/2 nov\. 2026/.test(await dlg.innerText()), 'Extension détectée : date de détection');
    await dlg.getByRole('button', { name: 'Lancer une capture' }).click();
    await page.getByRole('dialog', { name: /Nouvelle démo/ }).waitFor();
    ok(true, '« Lancer une capture » ouvre « Nouvelle démo »');
    await ctx.close();
  }

  // ===== §6 Utilisation =====
  {
    const { page, ctx } = await open('/#/settings/plans', (d) => {
      d.storageUsage = { media: 300 * MB, videos: 160 * MB, voices: 40 * MB };
    });
    await page.waitForURL(/settings\/usage/);
    ok(true, '/settings/plans redirige vers Utilisation');
    await page.locator('.us-row').first().waitFor();
    const text = await page.locator('main').innerText();
    ok(!/€|Plan |facturation|Business|Choisir/i.test(text), 'aucun prix, nom d’offre ni paiement');
    ok(
      (await page.getByRole('navigation', { name: 'Fil d’Ariane' }).innerText())
        .replace(/\s+/g, ' ')
        .trim() === 'Paramètres Espace Utilisation',
      'fil d’Ariane « Paramètres > Espace > Utilisation »',
    );
    ok((await page.locator('.us-row').count()) === 7, 'sept lignes de quota');
    // L48-03 : voix de synthèse et sous-titres, deux lignes distinctes (minutes)
    ok(
      (await page.locator('.us-row', { hasText: 'Voix de synthèse' }).getByRole('meter').count()) === 1 &&
        /0 \/ 5 min/.test(await page.locator('.us-row', { hasText: 'Sous-titres' }).innerText()),
      'voix de synthèse et sous-titres : deux jauges en minutes',
    );
    // L48-01 (T5) : entrée active en fond surface, texte courant, graisse 600
    const active = await page.locator('.snav .is-active').evaluate((el) => {
      const c = getComputedStyle(el);
      const probe = document.createElement('span');
      probe.style.color = 'var(--fd-color-text)';
      probe.style.background = 'var(--fd-color-surface)';
      document.body.append(probe);
      const p = getComputedStyle(probe);
      const r = { ok: c.color === p.color && c.backgroundColor === p.backgroundColor, w: c.fontWeight };
      probe.remove();
      return r;
    });
    ok(active.ok && active.w === '600', 'Paramètres : entrée active surface, texte, 600');
    const storage = page.locator('.us-row', { hasText: 'Stockage' });
    ok(
      (await storage.getByRole('meter').getAttribute('aria-valuenow')) === '100' &&
        (await storage.getByRole('meter').getAttribute('aria-label')) === 'Stockage : 100 % utilisés',
      'stockage : jauge à 100 %, nom « Stockage : 100 % utilisés »',
    );
    ok(/Limite atteinte/.test(await storage.innerText()), 'stockage : « Limite atteinte » en texte');
    ok(/Ajout de fichiers bloqué/.test(await storage.innerText()), 'stockage : conséquence écrite');
    ok(/Médiathèque 300 Mo · vidéos 160 Mo · voix 40 Mo/.test(await storage.innerText()), 'détail par type');
    const ai = page.locator('.us-row', { hasText: 'Assistance IA' });
    ok(
      (await ai.getByRole('meter').getAttribute('aria-valuenow')) === '2' &&
        !/atteinte/.test(await ai.innerText()),
      'Assistance IA : 2 %, sans pastille',
    );
    ok(/Remise à zéro le 1er décembre/.test(await ai.innerText()), 'remise à zéro le 1er du mois');
    const pub = page.locator('.us-row', { hasText: 'Démos publiées' });
    ok(
      (await pub.getByRole('meter').count()) === 0 && /sans limite/.test(await pub.innerText()),
      'démos publiées : « sans limite », sans jauge',
    );
    ok(
      /24 mois/.test(await page.locator('.us-row', { hasText: 'Conservation' }).innerText()),
      'conservation : 24 mois',
    );
    ok(
      (await page.getByRole('link', { name: 'Demander plus à la DSI' }).count()) === 0,
      'sans lien du support : pas de demande',
    );
    ok(
      (await page.getByRole('link', { name: 'Renseigner le lien du support' }).getAttribute('href')) ===
        '#/settings/workspace',
      'U2 : propriétaire sans lien du support : « Renseigner le lien du support »',
    );
    const axe = await new AxeBuilder({ page }).analyze();
    ok(axe.violations.length === 0, `axe : Utilisation (${axe.violations.map((v) => v.id).join(', ')})`);
    await ctx.close();
  }
  {
    const { page, ctx, state } = await open('/#/settings/usage', (d) => {
      d.tables.workspaces[0].settings = {
        ...d.tables.workspaces[0].settings,
        helpContact: 'dsi@acme.example',
      };
    });
    await page.locator('.us-row').first().waitFor();
    state.ai.used = 410;
    await page.reload();
    const ai = page.locator('.us-row', { hasText: 'Assistance IA' });
    await ai.getByRole('meter').waitFor();
    ok(
      (await ai.getByRole('meter').getAttribute('aria-valuenow')) === '82' &&
        /Bientôt atteinte/.test(await ai.innerText()),
      'Assistance IA : 82 %, « Bientôt atteinte »',
    );
    ok(
      (await page.getByRole('link', { name: 'Demander plus à la DSI' }).getAttribute('href')) ===
        `mailto:dsi@acme.example?subject=${encodeURIComponent('Demande de quota : Acme Analytics')}`,
      '« Demander plus à la DSI » : lien du support, objet prérempli',
    );
    await page.goto(`${APP}/#/settings/soon`);
    await page.waitForURL(/settings\/workspace/);
    ok(true, '/settings/soon redirige vers Général');
    await ctx.close();
  }

  // ===== Vocabulaire =====
  const fr = fs.readFileSync(path.join(__dirname, '../src/locales/fr.json'), 'utf8');
  const values = [...fr.matchAll(/":\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\{\{[^}]*\}\}/g, ''));
  ok(!values.some((v) => /workspace/i.test(v)), 'fr.json : aucun « Workspace » visible');
  ok(!values.some((v) => /€|facturation/i.test(v)), 'fr.json : aucun « € » ni « facturation »');

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
