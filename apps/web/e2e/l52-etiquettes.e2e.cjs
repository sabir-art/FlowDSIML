/**
 * Recette L52 (spec docs/ux/specs/l52-etiquettes.md). Données fictives (acme.example).
 *  - P1 : les 8 couleurs sur des cartes de Démos ; contraste au-dessus de 4,5:1 (axe et calcul), en clair et en sombre ;
 *    l'orange a le texte #8F5300.
 * Usage : node e2e/l52-etiquettes.e2e.cjs
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';

const COLORS = ['blue', 'green', 'orange', 'raspberry', 'plum', 'slate', 'teal', 'violet'];
const NAMES = ['Outil CRM', 'Accueil', 'Agenda', 'Facturation', 'RH', 'Archives', 'Usagers', 'Formation'];

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];

  // ===== P1 : 8 couleurs (5 sur la première démo, 3 sur la seconde : 5 au plus par démo) =====
  for (const theme of ['light', 'dark']) {
    const page = await (
      await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' })
    ).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript((t) => localStorage.setItem('fd.theme', t), theme);
    const s = seed();
    const ws = s.tables.workspaces[0].id;
    const [d1, d2] = s.tables.demos;
    s.tables.tags = COLORS.map((color, i) => ({
      id: `0b5c1f0e-0000-4000-8000-0000000052${String(i).padStart(2, '0')}`,
      workspace_id: ws,
      name: NAMES[i],
      color,
      created_at: new Date().toISOString(),
    }));
    s.tables.demo_tags = s.tables.tags.map((tag, i) => ({
      demo_id: i < 5 ? d1.id : d2.id,
      tag_id: tag.id,
      workspace_id: ws,
    }));
    await install(page, s);
    await page.goto(`${APP}/#/`);
    await page.waitForSelector('.demo-card .tg');
    const chips = await page.$$eval('.demo-card .tg', (els) => {
      const lum = (c) => {
        const [r, g, bl] = c
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map((x) => {
            const v = Number(x) / 255;
            return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          });
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
      };
      // Fond effectif : couleur de l'étiquette (éventuellement translucide) posée sur la surface de la carte
      const solid = (el) => {
        const parse = (c) => (c.match(/[\d.]+/g) || []).map(Number);
        const layers = [];
        for (let n = el; n; n = n.parentElement) {
          const p = parse(getComputedStyle(n).backgroundColor);
          if (p.length === 4 && p[3] === 0) continue;
          layers.push(p.length === 4 ? p : [...p, 1]);
          if ((p[3] ?? 1) === 1) break;
        }
        let [r, g, bl] = layers.pop().slice(0, 3);
        for (const [lr, lg, lb, a] of layers.reverse()) {
          r = lr * a + r * (1 - a);
          g = lg * a + g * (1 - a);
          bl = lb * a + bl * (1 - a);
        }
        return `rgb(${r}, ${g}, ${bl})`;
      };
      return els.map((el) => {
        const cs = getComputedStyle(el);
        const a = lum(cs.color);
        const bg = lum(solid(el));
        const ratio = (Math.max(a, bg) + 0.05) / (Math.min(a, bg) + 0.05);
        return { cls: el.className, color: cs.color, ratio: Math.round(ratio * 100) / 100 };
      });
    });
    const classes = COLORS.filter((c) => chips.some((x) => x.cls.includes(`tg--${c}`)));
    ok(classes.length === 8, `${theme} : les 8 couleurs affichées (${classes.join(', ')})`);
    const low = chips.filter((x) => x.ratio < 4.5);
    ok(low.length === 0, `${theme} : contraste ≥ 4,5:1 (${chips.map((x) => x.ratio).join(' ')})`);
    if (theme === 'light') {
      const orange = chips.find((x) => x.cls.includes('tg--orange'));
      ok(orange?.color === 'rgb(143, 83, 0)', `orange : texte #8F5300 (${orange?.color})`);
    }
    const r = await new AxeBuilder({ page }).include('.demo-card').withRules(['color-contrast']).analyze();
    ok(
      r.violations.length === 0,
      `${theme} : axe color-contrast sur les cartes (${r.violations.length} violation)`,
    );
    await page.context().close();
  }

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})();
