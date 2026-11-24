/**
 * Contrôle CI de PAGE-01 (COMP-01 §16.1) : toute page de la coque a, en haut, une seule barre
 * `.fd-page-header` ; aucun h1 hors de cette barre. Démo du jeu fictif, à 1440 et 390 px.
 *  - exactement une `.fd-page-header` visible, haut à 0 (ou sous la barre mobile de 56 px) ;
 *  - aucun `h1` (visible ou `sr-only`) hors de la barre, et un seul dedans ;
 *  - barre en `position: sticky`, avec un filet en bas.
 * Routes hors coque (connexion, pages légales, onboarding) : aucune `.fd-page-header`, un seul h1.
 * Usage : app web (:5173) lancée, puis `node e2e/page-header.e2e.cjs`.
 */
const { chromium } = require('playwright');
const { install } = require('./fake-supabase.cjs');
const { seedMaquette } = require('./maquette-data.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';

const data = seedMaquette();
const DEMO = data.tables.demos[0].id;
const SHELL = [
  ['Démos', '/'],
  ['Sandbox', '/sandbox'],
  ['Paramètres · Profil', '/settings/profile'],
  ['Paramètres · Général', '/settings/workspace'],
  ['Paramètres · Intégrations', '/settings/integrations'],
  ['Centre de formation', '/center'],
  ['Apprenants', '/learners'],
  ['Analytics', '/analytics'],
  ['Analytics · Leads', '/analytics?tab=leads'],
  ['Nouveautés', '/nouveautes'],
];
// Éditeurs : variante `.fd-page-header--editor` de la même barre (≥ 1 024 px, écran étroit en dessous)
const EDITORS = [
  ['Éditeur', `/demos/${DEMO}/edit`],
  ['Éditeur de quiz', `/demos/${DEMO}/quiz`],
  // §16.2 : hors coque, même variante (la Console demande un rôle d'équipe)
  ['Console', '/console', 'admin'],
  ['Présentateur', `/demos/${DEMO}/present`],
];
const OUTSIDE = [
  ['Connexion', '/login'],
  ['Mentions légales', '/legal/terms'],
];

/** Dans la page : barres visibles et titres de niveau 1. */
function measure() {
  const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const bars = [...document.querySelectorAll('.fd-page-header')].filter(shown);
  const bar = bars[0];
  const cs = bar ? getComputedStyle(bar) : null;
  return {
    bars: bars.length,
    top: bar ? Math.round(bar.getBoundingClientRect().top) : null,
    sticky: cs?.position ?? null,
    rule: cs ? parseFloat(cs.borderBottomWidth) : 0,
    h1In: bar ? bar.querySelectorAll('h1').length : 0,
    h1Out: [...document.querySelectorAll('h1')]
      .filter((h) => !h.closest('.fd-page-header'))
      .map((h) => h.textContent.trim().slice(0, 40)),
  };
}

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const open = async (route, width, signedOut, platformRole) => {
    const ctx = await b.newContext({
      viewport: { width, height: width === 390 ? 844 : 900 },
      locale: 'fr-FR',
    });
    const p = await ctx.newPage();
    await install(p, { ...seedMaquette(), signedOut, ...(platformRole ? { platformRole } : {}) });
    await p.goto(`${APP}/#${route}`);
    // Le titre de la page est rendu (dans la barre, ou seul hors coque)
    await p.locator('h1').first().waitFor({ state: 'attached' });
    await p.waitForLoadState('networkidle');
    return p;
  };
  for (const width of [1440, 390])
    for (const [name, route] of SHELL) {
      const p = await open(route, width, false);
      // Sous 768 px, l'accueil des Paramètres n'est pas concerné ; les pages gardent leur barre
      await p
        .locator('.fd-page-header')
        .first()
        .waitFor({ timeout: 10000 })
        .catch(() => undefined);
      const m = await p.evaluate(measure);
      const top = width === 390 ? 56 : 0;
      ok(
        m.bars === 1 && m.top === top && m.sticky === 'sticky' && m.rule >= 1,
        `${name} (${width} px) : une barre en haut, collante, avec son filet (${m.bars} barre, haut ${m.top}, ${m.sticky}, filet ${m.rule})`,
      );
      // §6 (exception à PAGE-01) : dans les Paramètres, le h1 est dans l'en-tête de page, sous la barre
      if (route.startsWith('/settings'))
        ok(
          m.h1In === 0 && m.h1Out.length === 1 && (await p.locator('.stg-page h1').count()) === 1,
          `${name} (${width} px) : un seul h1, dans l’en-tête de page (${m.h1In} dans la barre, ${m.h1Out.join(' | ')})`,
        );
      else
        ok(
          m.h1In === 1 && m.h1Out.length === 0,
          `${name} (${width} px) : un seul h1, dans la barre${m.h1Out.length ? ` (hors barre : ${m.h1Out.join(' | ')})` : ''}`,
        );
      await p.context().close();
    }
  for (const [name, route, platformRole] of EDITORS) {
    const p = await open(route, 1440, false, platformRole);
    await p
      .locator('.fd-page-header--editor')
      .waitFor({ timeout: 10000 })
      .catch(() => undefined);
    const m = await p.evaluate(measure);
    ok(
      m.bars === 1 && m.top === 0 && m.sticky === 'sticky' && m.rule >= 1 && m.h1In === 1 && !m.h1Out.length,
      `${name} : variante éditeur, une barre en haut avec son filet et le seul h1 (${m.bars} barre, haut ${m.top}, ${m.sticky}, h1 hors barre ${m.h1Out.length})`,
    );
    await p.context().close();
  }
  for (const [name, route] of OUTSIDE) {
    const p = await open(route, 1440, true);
    const m = await p.evaluate(measure);
    ok(
      m.bars === 0 && m.h1Out.length === 1,
      `${name} : hors coque, pas de barre et un seul h1 (${m.bars} barre, ${m.h1Out.length} h1)`,
    );
    await p.context().close();
  }
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
