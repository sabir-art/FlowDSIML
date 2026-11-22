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
      names.join('|') === 'Démos|Sandbox|Parcours de formation|Analytics|Apprenants', // L48-G : entrée Sandbox
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
    // §18.4 : pas de VITE_EXTENSION_URL dans les tests, extension jamais détectée : « Bientôt disponible »
    const dlg = page.getByRole('dialog', { name: /^Extension TutoClick/ });
    await dlg.waitFor();
    {
      const soon = await dlg.locator('h2 .ext-soon').evaluate((el) => ({
        txt: el.textContent,
        fs: getComputedStyle(el).fontSize,
      }));
      ok(
        soon.txt === 'Bientôt disponible' && soon.fs === '13px',
        '§18.4 : titre « Extension TutoClick », « Bientôt disponible » en 13 px',
      );
    }
    ok(
      (await dlg.locator('.dialog-body > *').count()) === 1 &&
        (await dlg.locator('.ext-steps, .link-button').count()) === 0 &&
        JSON.stringify(await dlg.locator('.dialog-actions').getByRole('button').allInnerTexts()) ===
          JSON.stringify(['Fermer']) &&
        (await dlg.locator('.dialog-actions a').count()) === 0,
      '§18.4 : une phrase, ni étapes ni lien d’aide, « Fermer » seul',
    );
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
      await page.locator('.st-nav').waitFor();
      ok(
        (await utils.locator('[aria-current="page"]').textContent())?.trim() === 'Paramètres',
        `Paramètres actif sur ${r}`,
      );
    }
    // Retour client : intitulés de groupe = étiquettes (non cliquables), 24 px au-dessus, entrées serrées
    {
      const g = await page.evaluate(() => {
        const grps = [...document.querySelectorAll('.st-nav .st-nav__grp')];
        const lab = grps[1].querySelector('.st-nav__title');
        const items = [...grps[1].querySelectorAll('.st-nav__item')];
        const r = (el) => el.getBoundingClientRect();
        const ls = getComputedStyle(lab);
        return {
          fs: ls.fontSize,
          tt: ls.textTransform,
          lh: ls.lineHeight,
          toFirst: Math.round(r(items[0]).top - r(lab).bottom),
          itemColor: getComputedStyle(items[0]).color,
          muted: (() => {
            const i = document.createElement('i');
            i.style.color = 'var(--fd-color-text-muted)';
            document.body.append(i);
            const c = getComputedStyle(i).color;
            i.remove();
            return c;
          })(),
          // Sous le padding haut de la colonne (72 px, aligné sous le PageHeader)
          firstTop: Math.round(
            r(grps[0]).top -
              r(grps[0].parentElement).top -
              parseFloat(getComputedStyle(grps[0].parentElement).paddingTop),
          ),
          tag: lab.tagName,
          role: grps[1].getAttribute('role'),
          named: grps[1].getAttribute('aria-labelledby') === lab.id,
          cursor: getComputedStyle(lab).cursor,
          above: Math.round(r(lab).top - r(grps[0]).bottom),
          inner: items.length > 1 ? Math.round(r(items[1]).top - r(items[0]).bottom) : 0,
        };
      });
      ok(
        g.tag === 'P' && g.role === 'group' && g.named && g.cursor === 'default',
        '§18.3 : titre de groupe (p) qui nomme le groupe, sans pointeur',
      );
      ok(
        g.fs === '11px' && g.tt === 'uppercase' && g.lh === '16px',
        `§18.3 : titre 11 px en capitales, boîte de 16 px (${g.fs} ${g.tt} ${g.lh})`,
      );
      ok(
        g.above === 24 && g.toFirst === 6 && g.inner === 2 && g.firstTop === 0,
        `§18.3 : 24 px avant le titre (${g.above}), 6 px jusqu'au premier élément (${g.toFirst}), 2 px entre éléments (${g.inner}), rien au-dessus du premier groupe (${g.firstTop})`,
      );
      ok(g.itemColor === g.muted, `NAV-02 : éléments au repos en text-muted (${g.itemColor})`);
    }
    // Retour client : au moins 16 px entre les blocs du corps de modale (Assistance IA)
    await page.goto(`${APP}/#/settings/ai`);
    await page.getByRole('switch', { name: 'Activer l’Assistance IA pour cet espace' }).click();
    const ai = page.getByRole('dialog', { name: 'Activer l’Assistance IA ?' });
    await ai.waitFor();
    {
      const gap = await ai.locator('.modal-body').evaluate((el) => {
        const k = [...el.children].filter((c) => c.getBoundingClientRect().height > 0);
        let min = Infinity;
        for (let i = 1; i < k.length; i++)
          min = Math.min(min, k[i].getBoundingClientRect().top - k[i - 1].getBoundingClientRect().bottom);
        return Math.round(min);
      });
      ok(gap >= 16, `§18.2 : modale Assistance IA, ${gap} px entre l’information et la case (16 au moins)`);
    }
    await page.keyboard.press('Escape');
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
        .trim() === 'Espace Utilisation',
      'fil d’Ariane « Espace › Utilisation »',
    );
    ok((await page.locator('.us-row').count()) === 7, 'sept lignes de quota');
    // L48-03 : voix de synthèse et sous-titres, deux lignes distinctes (minutes)
    ok(
      (await page.locator('.us-row', { hasText: 'Voix de synthèse' }).getByRole('meter').count()) === 1 &&
        /0 \/ 5 min/.test(await page.locator('.us-row', { hasText: 'Sous-titres' }).innerText()),
      'voix de synthèse et sous-titres : deux jauges en minutes',
    );
    // NAV-02 §11.7.2 : actif = fond nav-active, texte text en 600, aria-current, ni ombre ni bordure ;
    // survol = fond nav-hover, texte text, 500
    const tok = (v) =>
      page.evaluate((name) => {
        const i = document.createElement('i');
        i.style.color = `var(${name})`;
        document.body.append(i);
        const c = getComputedStyle(i).color;
        i.remove();
        return c;
      }, v);
    const [navActive, navHover, textColor] = [
      await tok('--fd-color-nav-active'),
      await tok('--fd-color-nav-hover'),
      await tok('--fd-color-text'),
    ];
    const active = await page.locator('.st-nav a[aria-current="page"]').evaluate((el) => {
      const c = getComputedStyle(el);
      return {
        bg: c.backgroundColor,
        color: c.color,
        w: c.fontWeight,
        sh: c.boxShadow,
        bw: c.borderTopWidth,
      };
    });
    ok(
      active.bg === navActive &&
        active.color === textColor &&
        active.w === '600' &&
        active.sh === 'none' &&
        active.bw === '0px',
      `Paramètres : entrée active nav-active, text, 600, sans ombre ni bordure (${JSON.stringify(active)})`,
    );
    await page.addStyleTag({ content: '*{transition:none!important}' });
    await page.locator('.st-nav a.st-nav__item:not([aria-current])').first().hover();
    const hov = await page.evaluate(() => {
      const h = getComputedStyle(document.querySelector('.st-nav a.st-nav__item:not([aria-current]):hover'));
      return { bg: h.backgroundColor, color: h.color, w: h.fontWeight, sh: h.boxShadow };
    });
    ok(
      hov.bg === navHover &&
        hov.bg !== active.bg &&
        hov.color === textColor &&
        hov.w === '500' &&
        hov.sh === 'none',
      `Paramètres : survol nav-hover, text, 500, distinct de l'actif (${JSON.stringify(hov)})`,
    );
    await page.mouse.move(0, 0);
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

  // ===== LOGO-01 (§16.5) : logo complet de 400 px sur la connexion, logo compact de 40 px sous 480 px =====
  for (const width of [1440, 390]) {
    const ctx = await b.newContext({ viewport: { width, height: 900 }, locale: 'fr-FR' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await install(page, { ...seedMaquette(), signedOut: true });
    await page.goto(`${APP}/#/login`);
    const logo = page.locator('.auth-logo-link img:visible');
    await logo.first().waitFor();
    const info = await logo.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), alt: el.getAttribute('alt') };
      }),
    );
    ok(
      width >= 480
        ? info.length === 1 &&
            info[0].w === 400 &&
            Math.abs(info[0].h - (400 * 260) / 803.5) <= 1 &&
            info[0].alt === 'TutoClick, porté par la DSIML'
        : info.length === 1 && info[0].h === 40 && Math.abs(info[0].w - Math.round((40 * 742) / 204)) <= 1,
      `connexion ${width} px : ${width >= 480 ? 'logo complet de 400 px' : 'logo compact de 40 px'} (${JSON.stringify(info)})`,
    );
    await ctx.close();
  }

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
