/**
 * SETTINGS-HDR-01 : en-tête des pages Paramètres. Sur chaque page, en clair et en sombre, à 1440 et 390 px :
 *  - titre, sous-titre, recherche et actions sont dans l'en-tête du contenu (.stg-page) ; la barre du haut
 *    ne porte plus aucune action de page ;
 *  - le filet de la bande va d'un bord à l'autre de la colonne de contenu, 24 px avant la première section ;
 *  - ordre des actions : recherche, secondaires, « Annuler », puis l'action principale (une au plus) ;
 *  - les contrôles de l'en-tête ont le rayon --fd-radius-control (RADIUS-01) ;
 *  - aucun débordement horizontal à 390 px.
 * Faux Supabase (données fictives). Usage : APP_URL=… node e2e/parametres-entete.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';

/** Page, titre attendu, libellés des actions de gauche à droite (null : selon l'état, non contrôlé). */
const PAGES = [
  ['/settings/profile', 'Profil', ['Annuler', 'Enregistrer']],
  ['/settings/notifications', 'Notifications', []],
  ['/settings/workspace', 'Général', ['Annuler', 'Enregistrer']],
  ['/settings/members', 'Équipe', ['Inviter'], 'Rechercher un membre'],
  ['/settings/usage', 'Utilisation', []],
  ['/settings/security', 'Sécurité', ['Annuler', 'Enregistrer']],
  ['/settings/privacy', 'Confidentialité', []],
  ['/settings/brand', 'Thème et couleurs', ['Annuler', 'Enregistrer']],
  ['/settings/brand/page', 'Page publique', ['Voir la page', 'Annuler', 'Enregistrer']],
  ['/settings/variables', 'Variables', ['Nouvelle variable']],
  ['/settings/glossary', 'Glossaire', null],
  ['/settings/tags', 'Étiquettes', ['Nouvelle étiquette']],
  ['/settings/ai', 'Assistance IA', []],
  ['/settings/integrations', 'Intégrations', ['Webhooks']],
  ['/settings/integrations/webhooks', 'Webhooks', ['Ajouter un webhook']],
  ['/settings/keys', 'Clés d’accès', ['Créer une clé']],
];

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  for (const width of [1440, 390]) {
    for (const theme of ['light', 'dark']) {
      const ctx = await b.newContext({
        viewport: { width, height: 900 },
        locale: 'fr-FR',
        colorScheme: theme,
      });
      await ctx.addInitScript((t) => localStorage.setItem('fd.theme', t), theme);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      await install(page, seed());
      const bad = [];
      for (const [route, title, actions, search] of PAGES) {
        await page.goto(`${APP}/#${route}`);
        const head = page.locator('.st-wrap > .stg-page');
        await head.waitFor();
        await page.locator('.st-wrap > .stg-page h1', { hasText: title }).waitFor();
        // La première section est là (les listes se chargent) et plus rien ne bouge
        await page.waitForFunction(() => {
          const h = document.querySelector('.st-wrap > .stg-page');
          return !!h?.nextElementSibling && !document.querySelector('.fd-modal__box[inert]');
        });
        const m = await page.evaluate(() => {
          const h = document.querySelector('.st-wrap > .stg-page');
          const col = document.querySelector('.st-main').getBoundingClientRect();
          const rule = getComputedStyle(h, '::after');
          const hr = h.getBoundingClientRect();
          // Filet : pseudo-élément centré, large de la fenêtre, coupé par la colonne
          const clip = getComputedStyle(document.querySelector('.st-main')).overflowX;
          let next = h.nextElementSibling;
          while (next && (next.getClientRects().length === 0 || getComputedStyle(next).position === 'fixed'))
            next = next.nextElementSibling;
          const acts = [...h.querySelectorAll('.stg-page__acts > *')].filter(
            (e) => e.getClientRects().length,
          );
          const ctl = acts.map(
            (e) => (e.matches('.fd-btn, .stg-search') ? e : e.querySelector('.fd-btn, .stg-search')) ?? e,
          );
          const want = getComputedStyle(document.documentElement)
            .getPropertyValue('--fd-radius-control')
            .trim();
          return {
            ruleW: parseFloat(rule.width),
            ruleBorder: rule.borderBottomWidth,
            clip,
            colW: col.width,
            headBottom: hr.bottom,
            gap: next ? next.getBoundingClientRect().top - hr.bottom : null,
            labels: acts.map((e) =>
              e.matches('.stg-search')
                ? `[${e.querySelector('input')?.getAttribute('placeholder') ?? ''}]`
                : (e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g, ' ').trim(),
            ),
            primaries: h.querySelectorAll('.stg-page__acts .fd-btn--primary').length,
            radii: [...new Set(ctl.map((e) => getComputedStyle(e).borderTopLeftRadius))],
            want,
            lefts: acts.map((e) => Math.round(e.getBoundingClientRect().left)),
            topbar: [
              ...document.querySelectorAll(
                '.st-main > :not(.st-wrap) :is(button, a).fd-btn--primary, .st-main > :not(.st-wrap) .fd-ph__actions > *',
              ),
            ].length,
            h1: document.querySelectorAll('h1').length,
            scroll: document.documentElement.scrollWidth - innerWidth,
          };
        });
        const where = `${title} (${route})`;
        if (!(m.ruleW >= m.colW && m.clip === 'clip' && m.ruleBorder === '1px'))
          bad.push(`${where} : filet ${m.ruleW} px pour une colonne de ${m.colW} px (${m.clip})`);
        if (m.gap === null || Math.abs(m.gap - 24) > 1)
          bad.push(`${where} : ${m.gap} px du filet à la première section (24 attendus)`);
        const got = m.labels.filter((l) => !l.startsWith('['));
        // Sous 600 px, avec trois boutons ou plus, les secondaires sont dans un menu ⋯ (40 px)
        const want =
          actions && width < 600 && actions.length >= 3 ? ['Autres actions', actions.at(-1)] : actions;
        if (want && got.join(' | ') !== want.join(' | '))
          bad.push(`${where} : actions « ${got.join(' | ')} » (attendu « ${want.join(' | ')} »)`);
        if (search && m.labels[0] !== `[${search}]`)
          bad.push(`${where} : la recherche n’est pas la première (${m.labels[0]})`);
        if (m.primaries > 1) bad.push(`${where} : ${m.primaries} actions principales`);
        if (
          m.primaries === 1 &&
          !/fd-btn--primary/.test(
            await page
              .locator('.stg-page__acts > *')
              .last()
              .evaluate((e) => (e.matches('.fd-btn') ? e : (e.querySelector('.fd-btn') ?? e)).className),
          )
        )
          bad.push(`${where} : l’action principale n’est pas la dernière`);
        if (m.radii.some((r) => r !== m.want))
          bad.push(`${where} : rayons ${m.radii.join(', ')} (jeton ${m.want})`);
        if (m.lefts.some((x, i) => i > 0 && x < m.lefts[i - 1]))
          bad.push(`${where} : actions dans le désordre à l’écran`);
        if (m.topbar > 0)
          bad.push(`${where} : ${m.topbar} action(s) de page restée(s) dans la barre du haut`);
        if (m.h1 !== 1) bad.push(`${where} : ${m.h1} h1`);
        if (m.scroll > 0) bad.push(`${where} : débordement horizontal de ${m.scroll} px`);
      }
      ok(
        bad.length === 0,
        `en-tête des Paramètres, ${PAGES.length} pages, ${theme === 'dark' ? 'sombre' : 'clair'}, ${width} px${bad.length ? ` :\n  ${bad.join('\n  ')}` : ''}`,
      );
      // §3 : formulaire modifié, en-tête sorti de l'écran → barre collée en bas (sous 600 px seulement)
      {
        await page.goto(`${APP}/#/settings/workspace`);
        const name = page.locator('#ws-name');
        await name.waitFor();
        const bar = page.getByRole('region', { name: 'Modifications non enregistrées' });
        const before = await bar.count();
        // L'espace est chargé (un rechargement tardif remettrait le champ à sa valeur enregistrée)
        await page.waitForLoadState('networkidle');
        await name.fill('Acme modifié');
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        if (width < 600) {
          await bar.waitFor();
          await bar.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
          // La barre réserve sa place en bas de page : en bout de défilement, rien n'est caché dessous
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          const g = await bar.evaluate((el) => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            const probe = document.createElement('i');
            probe.style.background = 'var(--fd-color-surface)';
            document.body.append(probe);
            const surface = getComputedStyle(probe).backgroundColor;
            probe.remove();
            const last = document.querySelector('.st-wrap').lastElementChild.getBoundingClientRect();
            return {
              h: r.height,
              bottom: Math.round(innerHeight - r.bottom),
              w: Math.round(r.width),
              bg: cs.backgroundColor === surface,
              top: cs.borderTopWidth,
              btns: [...el.querySelectorAll('.fd-btn')].map((x) => x.textContent.trim()).join('|'),
              gap: Math.round(r.top - last.bottom),
              scroll: document.documentElement.scrollWidth - innerWidth,
            };
          });
          ok(
            before === 0 &&
              g.h === 64 &&
              g.bottom === 0 &&
              g.w === width &&
              g.bg &&
              g.top === '1px' &&
              g.btns === 'Annuler|Enregistrer' &&
              g.gap >= 8 &&
              g.scroll <= 0,
            `barre « Modifications non enregistrées », ${theme === 'dark' ? 'sombre' : 'clair'}, ${width} px : 64 px, collée en bas, Annuler puis Enregistrer, contenu lisible au-dessus (${JSON.stringify(g)})`,
          );
          ok(
            (await page
              .locator('p[aria-live="polite"]', { hasText: 'Modifications non enregistrées' })
              .count()) === 1,
            `barre annoncée une fois (${width} px)`,
          );
          // De retour en haut, l'en-tête porte les actions : la barre s'efface
          await page.evaluate(() => window.scrollTo(0, 0));
          await bar.waitFor({ state: 'detached' });
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          await bar.waitFor();
          await bar.getByRole('button', { name: 'Annuler' }).click();
          await bar.waitFor({ state: 'detached' });
          ok(
            (await name.inputValue()) !== 'Acme modifié',
            `« Annuler » dans la barre : modifications annulées, barre retirée (${width} px)`,
          );
        } else {
          await page.waitForFunction(
            () => scrollY > 0 || document.documentElement.scrollHeight <= innerHeight,
          );
          ok((await bar.count()) === 0, `pas de barre collée en bas à ${width} px`);
        }
      }
      // §3 : Page publique à 390, menu ⋯ de 40 px avec « Voir la page » et « Annuler »
      if (width < 600) {
        await page.goto(`${APP}/#/settings/brand/page`);
        const more = page.locator('.stg-page__acts').getByRole('button', { name: 'Autres actions' });
        await more.waitFor();
        const box = await more.boundingBox();
        await more.click();
        const items = (await page.getByRole('menuitem').allInnerTexts()).map((x) => x.trim());
        ok(
          box.width === 40 && box.height === 40 && items.join('|') === 'Voir la page|Annuler',
          `Page publique, ${width} px : menu ⋯ de 40 px (${box.width} × ${box.height}) avec ${items.join(', ')}`,
        );
        await page.keyboard.press('Escape');
      }
      await ctx.close();
    }
  }
  ok(errors.length === 0, `aucune erreur de page${errors.length ? ` : ${errors.join(' | ')}` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
