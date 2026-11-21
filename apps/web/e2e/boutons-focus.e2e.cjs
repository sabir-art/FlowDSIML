/**
 * WCAG 2.4.7 (focus visible), défaut bloquant relevé par l'UX : les boutons .btn-secondary (dont
 * « Continuer avec Google ») n'avaient aucun indicateur au focus clavier. FIELD-01 §11.4 : la bordure du
 * bouton passe en prune sur 2 px, le primaire s'assombrit, le lien se souligne sur 2 px.
 * Sur /login, /signup, /analytics et /settings/profile, en clair et en sombre : on parcourt la page au
 * clavier (Tab) et, pour chaque bouton atteint (button, liens habillés en bouton, role=button), on
 * compare son style au focus et sans focus. Il faut un indicateur visible (bordure, trait intérieur,
 * fond ou soulignement de 2 px), sans outline ni ombre extérieure.
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};

const PAGES = [
  { route: '/#/login', signedOut: true },
  { route: '/#/signup', signedOut: true },
  { route: '/#/analytics' },
  { route: '/#/settings/profile' },
];

(async () => {
  const b = await chromium.launch();
  for (const theme of ['light', 'dark'])
    for (const pg of PAGES) {
      const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
      await ctx.addInitScript((t) => localStorage.setItem('fd.theme', t), theme);
      const p = await ctx.newPage();
      await install(p, { ...seed(), signedOut: !!pg.signedOut });
      await p.goto(`${APP}${pg.route}`);
      await p.locator('h1').first().waitFor();
      await p.waitForTimeout(500);
      await p.addStyleTag({ content: '*{transition:none!important}' });
      let seen = 0;
      const bad = [];
      const visited = new Set();
      for (let i = 0; i < 70; i++) {
        await p.keyboard.press('Tab');
        const r = await p.evaluate(() => {
          const el = document.activeElement;
          if (!el || !el.matches('button, a.btn, a.fd-btn, [role="button"]')) return null;
          const key = `${el.tagName}|${el.className}|${(el.textContent || el.getAttribute('aria-label') || '').trim()}`;
          const look = () => {
            const cs = getComputedStyle(el);
            return {
              border: cs.borderTopColor,
              shadow: cs.boxShadow,
              bg: cs.backgroundColor,
              deco: cs.textDecorationThickness,
              outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0,
            };
          };
          const on = look();
          el.blur();
          const off = look();
          el.focus();
          const outer = on.shadow
            .split(/,(?![^(]*\))/)
            .some((x) => x.trim() !== 'none' && !/inset/.test(x) && /0px 0px 0px [1-9]/.test(x));
          const visible =
            on.border !== off.border ||
            (on.shadow !== off.shadow && /inset/.test(on.shadow)) ||
            on.bg !== off.bg ||
            (parseFloat(on.deco) >= 2 && on.deco !== off.deco);
          return {
            key,
            name: `${el.tagName.toLowerCase()}.${String(el.className).trim().split(/\s+/).slice(0, 3).join('.')} « ${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)} »`,
            visible,
            outline: on.outline,
            outer,
          };
        });
        if (!r || visited.has(r.key)) continue;
        visited.add(r.key);
        seen++;
        if (!r.visible || r.outline || r.outer)
          bad.push(
            `${r.name}${!r.visible ? ' : aucun indicateur' : ''}${r.outline ? ' : outline' : ''}${r.outer ? ' : ombre extérieure' : ''}`,
          );
      }
      ok(
        seen > 0 && !bad.length,
        `${pg.route} (${theme}) : ${seen} bouton(s), chacun avec un indicateur visible au clavier${bad.map((x) => `\n    ${x}`).join('')}`,
      );
      if (pg.route === '/#/login')
        ok(
          [...visited].some((k) => /Google/.test(k)),
          `${pg.route} (${theme}) : bouton Google atteint au clavier`,
        );
      await ctx.close();
    }
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
