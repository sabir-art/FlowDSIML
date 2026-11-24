/**
 * NAV-02 et NAV-03 (retours-client-21-11.md §11.7, comp-01-composants.md §12), pages passées à la
 * PageHeader. Lot 1 : les Paramètres. En clair et en sombre, à 1440 px puis à 390 px :
 *  - surfaces : nav-bg sur la seule barre latérale (COL-01) ; navigation des Paramètres et contenu sur le blanc,
 *    filet de 1 px entre les colonnes ;
 *  - élément actif : fond nav-active, texte text en 600, aria-current, ni ombre ni bordure ;
 *  - PageHeader : barre fixe de 56 px avec un filet en bas, qui reste en haut au défilement ;
 *  - un seul <h1> par page ; c'est l'élément courant du fil d'Ariane (aria-current="page") ;
 *  - fil d'Ariane : parents sans soulignement, séparateur ChevronRight de 14 px ;
 *  - Aide et Notifications dans la barre, après un filet vertical (32 px, icônes de 16 px) ;
 *  - aucune entrée « Domaine » ; « Page publique » garde son lien et porte « Bientôt » ;
 *  - à 390 px : le fil d'Ariane devient un bouton de retour « Retour à Paramètres », la navigation
 *    n'est plus dans la page, Menu, Aide et Notifications sont dans la barre mobile (cibles de 44 px) ;
 *  - accueil des Paramètres (/settings sous 768 px) : groupes en listes de lignes de 52 px.
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};

/** Pages des Paramètres passées à la PageHeader : route, groupe et titre attendus. */
const PAGES = [
  ['/settings/workspace', 'Espace', 'Général'],
  ['/settings/members', 'Espace', 'Équipe'],
  ['/settings/usage', 'Espace', 'Utilisation'],
  ['/settings/security', 'Espace', 'Sécurité'],
  ['/settings/privacy', 'Espace', 'Confidentialité'],
  ['/settings/brand', 'Marque', 'Thème et couleurs'],
  ['/settings/brand/page', 'Marque', 'Page publique'],
  ['/settings/variables', 'Contenu', 'Variables'],
  ['/settings/glossary', 'Contenu', 'Glossaire'],
  ['/settings/tags', 'Contenu', 'Étiquettes'],
  ['/settings/ai', 'Contenu', 'Assistance IA'],
  ['/settings/integrations', 'Connexions', 'Intégrations'],
  ['/settings/profile', 'Mon compte', 'Profil'],
];

const TOKENS = {
  light: { navBg: 'rgb(247, 247, 248)', navActive: 'rgb(233, 235, 238)', contentBg: 'rgb(255, 255, 255)' },
  dark: { navBg: 'rgb(16, 19, 23)', navActive: 'rgb(37, 43, 51)', contentBg: 'rgb(21, 25, 31)' },
};

(async () => {
  const b = await chromium.launch();
  for (const theme of ['light', 'dark']) {
    const T = TOKENS[theme];
    // ---------- 1440 px ----------
    {
      const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
      await ctx.addInitScript((t) => localStorage.setItem('fd.theme', t), theme);
      const p = await ctx.newPage();
      await install(p, seed());
      for (const [route, group, title] of PAGES) {
        const who = `${title} (${theme})`;
        await p.goto(`${APP}/#${route}`);
        await p.locator('.fd-page-header h1').waitFor();
        const m = await p.evaluate(() => {
          const cs = (el) => (el ? getComputedStyle(el) : null);
          const header = document.querySelector('.fd-page-header');
          const hr = header.getBoundingClientRect();
          const h1s = [...document.querySelectorAll('h1')];
          const crumb = document.querySelector('nav.fd-crumb');
          const links = [...crumb.querySelectorAll('.fd-crumb__link')];
          const sep = crumb.querySelector('li > svg');
          const tools = [...header.querySelectorAll('.fd-page-header__tools button')];
          const active = document.querySelector('.st-nav__item[aria-current="page"]');
          const side = document.querySelector('.sidebar');
          const sideActive = side.querySelector('.fd-nav__item[aria-current="page"]');
          return {
            headerH: hr.height,
            headerPos: cs(header).position,
            headerBorder: cs(header).borderBottomWidth,
            headerBg: cs(header).backgroundColor,
            h1Count: h1s.length,
            h1Text: h1s[0]?.textContent.trim(),
            h1Current: h1s[0]?.getAttribute('aria-current'),
            h1InCrumb: !!h1s[0]?.closest('nav.fd-crumb'),
            crumbLabel: crumb.getAttribute('aria-label'),
            parents: links.map((a) => ({
              text: a.textContent.trim(),
              tag: a.tagName,
              deco: cs(a).textDecorationLine,
            })),
            sepW: sep?.getBoundingClientRect().width,
            bigTitles: [...document.querySelectorAll('.st-main *')].filter(
              (el) =>
                el.children.length === 0 &&
                el.textContent.trim() === h1s[0]?.textContent.trim() &&
                parseFloat(getComputedStyle(el).fontSize) >= 24,
            ).length,
            tools: tools.map((t) => ({
              name: t.getAttribute('aria-label'),
              w: t.getBoundingClientRect().width,
              icon: t.querySelector('svg')?.getBoundingClientRect().width,
            })),
            divider: !!header.querySelector('.fd-page-header__sep'),
            navBg: cs(document.querySelector('.st-nav')).backgroundColor,
            navBorder: cs(document.querySelector('.st-nav')).borderRightWidth,
            sideBg: cs(side).backgroundColor,
            sideBorder: cs(side).borderRightWidth,
            mainBg: cs(document.querySelector('.main')).backgroundColor,
            active: active && {
              text: active.querySelector('span').textContent.trim(),
              bg: cs(active).backgroundColor,
              weight: cs(active).fontWeight,
              shadow: cs(active).boxShadow,
              border: cs(active).borderTopWidth,
              current: active.getAttribute('aria-current'),
              h: active.getBoundingClientRect().height,
              icon: active.querySelector('svg')?.getBoundingClientRect().width,
            },
            sideActive: sideActive && {
              bg: cs(sideActive).backgroundColor,
              weight: cs(sideActive).fontWeight,
              shadow: cs(sideActive).boxShadow,
              h: sideActive.getBoundingClientRect().height,
            },
            navTexts: [...document.querySelectorAll('.st-nav__item')].map((i) => i.textContent.trim()),
            publicPage: (() => {
              const i = [...document.querySelectorAll('.st-nav__item')].find((x) =>
                x.textContent.includes('Page publique'),
              );
              return i && { tag: i.tagName, soon: i.querySelector('.st-nav__soon')?.textContent.trim() };
            })(),
          };
        });
        ok(
          m.headerH === 56 &&
            m.headerPos === 'sticky' &&
            m.headerBorder === '1px' &&
            m.headerBg === T.contentBg,
          `${who} : PageHeader fixe de 56 px, filet en bas, fond content-bg (${m.headerH}, ${m.headerPos})`,
        );
        ok(
          m.h1Count === 1 && m.h1Text === title && m.h1Current === 'page' && m.h1InCrumb,
          `${who} : un seul h1, élément courant du fil d'Ariane (${m.h1Count}, « ${m.h1Text} »)`,
        );
        ok(m.bigTitles === 0, `${who} : pas de grand titre qui répète le fil d'Ariane`);
        ok(
          m.crumbLabel === 'Fil d’Ariane' &&
            m.parents[0]?.text === group &&
            m.parents[0]?.tag === 'A' &&
            m.parents.every((x) => x.deco === 'none') &&
            m.sepW === 14,
          `${who} : fil « ${group} › ${title} », parents sans soulignement, chevron de 14 px`,
        );
        ok(
          m.divider &&
            m.tools.length === 2 &&
            m.tools[0].name === 'Aide' &&
            /^Notifications/.test(m.tools[1].name) &&
            m.tools.every((t) => t.w === 32 && t.icon === 16),
          `${who} : Aide et Notifications après un filet, 32 px, icônes de 16 px (${JSON.stringify(m.tools)})`,
        );
        ok(
          m.navBg === T.contentBg && m.sideBg === T.navBg && m.mainBg === T.contentBg,
          `${who} : COL-01, nav-bg sur la seule barre latérale, colonne des Paramètres et contenu sur le blanc`,
        );
        ok(m.navBorder === '1px' && m.sideBorder === '1px', `${who} : filet de 1 px entre les colonnes`);
        ok(
          m.active &&
            m.active.text === title &&
            m.active.bg === T.navActive &&
            m.active.weight === '600' &&
            m.active.shadow === 'none' &&
            m.active.border === '0px' &&
            m.active.current === 'page' &&
            m.active.h === 34 &&
            m.active.icon === 16,
          `${who} : entrée active (nav-active, 600, aria-current, 34 px, icône de 16 px, ni ombre ni bordure)`,
        );
        ok(
          m.sideActive &&
            m.sideActive.bg === T.navActive &&
            m.sideActive.weight === '600' &&
            m.sideActive.shadow === 'none' &&
            m.sideActive.h === 40,
          `${who} : « Paramètres » actif dans la barre latérale, sans pastille noire (40 px)`,
        );
        if (route === '/settings/workspace') {
          ok(!m.navTexts.some((x) => /^Domaine/.test(x)), `${who} : aucune entrée « Domaine »`);
          ok(
            m.publicPage?.tag === 'A' && m.publicPage.soon === 'Bientôt',
            `${who} : « Page publique » est un lien et porte « Bientôt »`,
          );
          // Titres de groupe : 24 px au-dessus, mesurés (décision UX du 22/11)
          const gaps = await p.evaluate(() =>
            [...document.querySelectorAll('.st-nav__grp + .st-nav__grp .st-nav__title')].map((t) =>
              Math.round(
                t.getBoundingClientRect().top -
                  t.parentElement.previousElementSibling.lastElementChild.getBoundingClientRect().bottom,
              ),
            ),
          );
          ok(
            gaps.length === 4 && gaps.every((g) => g === 24),
            `${who} : 24 px au-dessus des titres de groupe (${gaps.join(', ')})`,
          );
          // La barre reste en haut au défilement
          await p.evaluate(() => window.scrollTo(0, 400));
          await p.waitForFunction(() => window.scrollY > 0);
          const top = await p.evaluate(
            () => document.querySelector('.fd-page-header').getBoundingClientRect().top,
          );
          ok(top === 0, `${who} : la barre reste en haut au défilement (top ${top})`);
          // Le groupe du fil mène à la première page du groupe
          await p.goto(`${APP}/#/settings/usage`);
          await p.locator('.fd-crumb__link').first().click();
          await p.waitForFunction(() => location.hash === '#/settings/workspace');
          ok(true, `${who} : « Espace » ouvre la première page du groupe`);
        }
      }
      await ctx.close();
    }
    // ---------- 390 px ----------
    {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR' });
      await ctx.addInitScript((t) => localStorage.setItem('fd.theme', t), theme);
      const p = await ctx.newPage();
      await install(p, seed());
      await p.goto(`${APP}/#/settings/workspace`);
      await p.locator('.fd-page-header h1').waitFor();
      const m = await p.evaluate(() => {
        const vis = (el) =>
          !!el && el.getBoundingClientRect().width > 0 && getComputedStyle(el).visibility !== 'hidden';
        const header = document.querySelector('.fd-page-header');
        const back = [...header.querySelectorAll('.fd-back')].find(vis);
        const bar = document.querySelector('.topbar');
        return {
          parents: [...document.querySelectorAll('.fd-crumb__link, .fd-crumb__sep')].filter(vis).length,
          nav: vis(document.querySelector('.st-nav')),
          back: back && {
            name: back.getAttribute('aria-label'),
            w: back.getBoundingClientRect().width,
            h: back.getBoundingClientRect().height,
            href: back.getAttribute('href'),
          },
          h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()),
          actions: [...header.querySelectorAll('.fd-page-header__actions .fd-btn')]
            .filter((x) => vis(x) && !x.closest('.fd-page-header__tools'))
            .map((x) => x.textContent.trim()),
          headerTools: [...header.querySelectorAll('.fd-page-header__tools button')].filter(vis).length,
          barH: bar.getBoundingClientRect().height,
          barBg: getComputedStyle(bar).backgroundColor,
          barBtns: [...bar.querySelectorAll('button')].filter(vis).map((t) => ({
            name: t.getAttribute('aria-label'),
            w: t.getBoundingClientRect().width,
            h: t.getBoundingClientRect().height,
            icon: t.querySelector('svg')?.getBoundingClientRect().width,
          })),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      const who = `Général à 390 px (${theme})`;
      ok(m.parents === 0 && !m.nav, `${who} : ni parents du fil d'Ariane ni navigation dans la page`);
      ok(
        m.back &&
          m.back.name === 'Retour à Paramètres' &&
          m.back.w === 32 &&
          m.back.h === 32 &&
          m.back.href === '#/settings',
        `${who} : bouton de retour en icône vers l'accueil, « Retour à Paramètres » (${JSON.stringify(m.back)})`,
      );
      ok(m.h1.length === 1 && m.h1[0] === 'Général', `${who} : le titre de la barre est le seul h1`);
      ok(
        m.actions.length === 1 && m.actions[0] === 'Enregistrer',
        `${who} : l'action principale seule dans la barre (${m.actions.join(', ')})`,
      );
      ok(
        m.headerTools === 0 &&
          m.barBtns.length === 3 &&
          m.barBtns[1].name === 'Aide' &&
          /^Notifications/.test(m.barBtns[2].name) &&
          m.barBtns.every((x) => x.w === 44 && x.h === 44 && x.icon === 20),
        `${who} : Menu, Aide et Notifications dans la barre mobile, cibles de 44 px, icônes de 20 px (${JSON.stringify(m.barBtns)})`,
      );
      ok(m.barH === 56 && m.barBg === T.navBg, `${who} : barre mobile de 56 px sur nav-bg`);
      ok(m.overflow <= 0, `${who} : aucun défilement horizontal (${m.overflow})`);
      // Accueil des Paramètres : PageHeader sans retour, lignes de 52 px, « Bientôt » visible
      await p.locator('.fd-page-header .fd-back').click();
      await p.locator('.st-home').waitFor();
      const h = await p.evaluate(() => {
        const rows = [...document.querySelectorAll('.st-home__row')];
        return {
          h1: [...document.querySelectorAll('h1')].map((x) => x.textContent.trim()),
          back: [...document.querySelectorAll('.fd-page-header .fd-back')].filter(
            (x) => x.getBoundingClientRect().width > 0,
          ).length,
          groups: [...document.querySelectorAll('.st-home h2')].map((x) => x.textContent.trim()),
          rows: rows.length,
          minH: Math.min(...rows.map((r) => r.getBoundingClientRect().height)),
          icon: rows[0].querySelector('svg').getBoundingClientRect().width,
          font: getComputedStyle(rows[0]).fontSize,
          soon: rows
            .filter((r) => r.querySelector('.stg-soon'))
            .map((r) => r.querySelector('.st-home__label').textContent),
          radius: getComputedStyle(document.querySelector('.st-home ul')).borderTopLeftRadius,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      ok(
        h.h1.length === 1 && h.h1[0] === 'Paramètres' && h.back === 0,
        `Accueil des Paramètres (${theme}) : titre « Paramètres », sans bouton de retour`,
      );
      ok(
        h.groups.join('|') === 'Espace|Marque|Contenu|Connexions|Mon compte' && h.rows === 15,
        `Accueil des Paramètres (${theme}) : cinq groupes, 15 lignes (${h.rows})`,
      );
      ok(
        h.minH === 52 && h.icon === 20 && h.font === '15px' && h.radius === '12px',
        `Accueil des Paramètres (${theme}) : lignes de 52 px, icône de 20 px, 15 px, rayon de 12 px (${h.minH}, ${h.icon}, ${h.font})`,
      );
      ok(
        // « Bientôt » ne reste que sur ce qui n'est pas encore livré (Notifications livré le 24/11)
        !h.soon.includes('Notifications') &&
          h.soon.every((x) => ['Page publique', 'Clés d’accès'].includes(x)),
        `Accueil des Paramètres (${theme}) : « Bientôt » sur ${h.soon.join(', ')}`,
      );
      ok(h.overflow <= 0, `Accueil des Paramètres (${theme}) : aucun défilement horizontal`);
      await p.getByRole('link', { name: 'Équipe' }).click();
      await p.waitForFunction(() => location.hash === '#/settings/members');
      ok(true, `Accueil des Paramètres (${theme}) : une ligne ouvre sa page`);
      await ctx.close();
    }
  }
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
