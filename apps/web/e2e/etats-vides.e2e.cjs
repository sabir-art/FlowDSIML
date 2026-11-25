/**
 * EMPTY-01 : états vides « premier usage ». Sur chaque page à l'état vide, en clair et en sombre, à 1440
 * et 390 px :
 *  - aucun doublon : aucun bouton ni lien de l'état vide ne porte le nom d'une action de l'en-tête ;
 *  - l'aperçu est décoratif (aria-hidden, inerte, rien de focalisable) et son socle a le rayon
 *    --fd-radius-surface ;
 *  - titre et phrase visibles, contraste AA ;
 *  - aucun débordement horizontal.
 * Faux Supabase (données fictives). Usage : APP_URL=… node e2e/etats-vides.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';

/** Page, titre de l'état vide, nom de l'action secondaire admise (elle fait autre chose que l'en-tête). */
const PAGES = [
  ['/settings/glossary', 'Ajoutez votre premier terme'],
  ['/settings/tags', 'Créez votre première étiquette'],
  ['/settings/keys', 'Aucune clé pour l’instant'],
  ['/settings/integrations/webhooks', 'Ajoutez votre premier webhook'],
  ['/settings/variables', 'Créez votre première variable'],
  ['/settings/members', 'Invitez votre équipe'],
  ['/settings/integrations?categorie=connectees', 'Aucune connexion active', 'Voir les intégrations'],
];
const EMPTY = ['glossary_terms', 'tags', 'demo_tags', 'api_keys', 'webhooks', 'variables', 'invitations'];

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
      const bad = [];
      for (const [route, title, extra] of PAGES) {
        const page = await ctx.newPage();
        page.on('pageerror', (e) => errors.push(e.message));
        const state = seed();
        for (const k of EMPTY) if (state.tables[k]) state.tables[k] = [];
        await install(page, state);
        await page.goto(`${APP}/#${route}`);
        const es = page.locator('.fd-es', { has: page.getByRole('heading', { name: title, exact: true }) });
        const where = `${title} (${route})`;
        try {
          await es.waitFor({ timeout: 15000 });
        } catch {
          bad.push(`${where} : état vide absent`);
          await page.close();
          continue;
        }
        const m = await es.evaluate((el) => {
          const lum = (c) => {
            const [r, g, b2] = c
              .match(/[\d.]+/g)
              .slice(0, 3)
              .map((v) => {
                const x = v / 255;
                return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
              });
            return 0.2126 * r + 0.7152 * g + 0.0722 * b2;
          };
          const bgOf = (n) => {
            for (let x = n; x; x = x.parentElement) {
              const c = getComputedStyle(x).backgroundColor;
              if (c && !/rgba\(.*, 0\)$|transparent/.test(c)) return c;
            }
            return 'rgb(255, 255, 255)';
          };
          const ratio = (n) => {
            const a = lum(getComputedStyle(n).color);
            const c = lum(bgOf(n));
            return (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05);
          };
          const name = (x) =>
            (x.getAttribute('aria-label') || x.textContent || '').replace(/\s+/g, ' ').trim();
          const base = el.querySelector('.fd-es__base');
          const probe = document.createElement('i');
          probe.style.borderRadius = 'var(--fd-radius-surface)';
          document.body.append(probe);
          const surface = getComputedStyle(probe).borderTopLeftRadius;
          probe.remove();
          const head = [
            ...document.querySelectorAll('.stg-page__acts :is(button, a), .fd-page-header :is(button, a)'),
          ]
            .map(name)
            .filter(Boolean);
          const t = el.querySelector('.fd-es__title');
          const p = el.querySelector('.fd-es__body');
          return {
            own: [
              ...el.querySelectorAll(':scope > :not(.fd-es__base) :is(button, a), :scope > :is(button, a)'),
            ].map(name),
            head,
            hidden: base?.getAttribute('aria-hidden') === 'true' && base?.inert === true,
            focusable: base
              ? [...base.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')].filter(
                  (x) => !x.closest('[inert]'),
                ).length
              : -1,
            radius: base ? getComputedStyle(base).borderTopLeftRadius : '',
            surface,
            baseW: base ? base.getBoundingClientRect().width : 0,
            previewH: el.querySelector('.fd-es__preview')?.getBoundingClientRect().height ?? 0,
            tSize: t ? getComputedStyle(t).fontSize : '',
            tRatio: t ? ratio(t) : 0,
            pRatio: p ? ratio(p) : 0,
            pVisible: !!p && p.getClientRects().length > 0,
            scroll: document.documentElement.scrollWidth - innerWidth,
          };
        });
        const dup = m.own.filter((n) => m.head.includes(n));
        if (dup.length) bad.push(`${where} : l’état vide répète « ${dup.join(', ')} »`);
        if (m.own.join('|') !== (extra ?? ''))
          bad.push(`${where} : boutons de l’état vide « ${m.own.join(', ')} » (attendu « ${extra ?? ''} »)`);
        if (!m.hidden || m.focusable !== 0)
          bad.push(
            `${where} : aperçu non décoratif (aria-hidden/inert ${m.hidden}, ${m.focusable} focalisable)`,
          );
        if (m.radius !== m.surface) bad.push(`${where} : socle au rayon ${m.radius} (jeton ${m.surface})`);
        if (m.baseW > 460 || m.previewH < 100 || m.previewH > 140)
          bad.push(`${where} : socle ${m.baseW} px, aperçu ${m.previewH} px`);
        if (m.tSize !== '16px' || m.tRatio < 4.5 || !m.pVisible || m.pRatio < 4.5)
          bad.push(
            `${where} : titre ${m.tSize} (contraste ${m.tRatio.toFixed(1)}), phrase (contraste ${m.pRatio.toFixed(1)})`,
          );
        if (m.scroll > 0) bad.push(`${where} : débordement horizontal de ${m.scroll} px`);
        // Rien de l'aperçu n'est atteint au clavier ni exposé aux lecteurs d'écran
        if ((await es.getByRole('button').count()) + (await es.getByRole('link').count()) !== (extra ? 1 : 0))
          bad.push(`${where} : des contrôles de l’aperçu sont exposés`);
        await page.close();
      }
      ok(
        bad.length === 0,
        `états vides, ${PAGES.length} pages, ${theme === 'dark' ? 'sombre' : 'clair'}, ${width} px${bad.length ? ` :\n  ${bad.join('\n  ')}` : ''}`,
      );
      await ctx.close();
    }
  }
  ok(errors.length === 0, `aucune erreur de page${errors.length ? ` : ${errors.join(' | ')}` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
