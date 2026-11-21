/**
 * Boutons des pages d'authentification (retour client du 21/11, bug bloquant de la page d'invitation :
 * bouton principal vide au repos, texte prune sur fond prune). axe ne le voit pas, le texte existe dans
 * le DOM : ce test mesure ce qui se voit.
 * Pages : connexion (mot de passe et lien par e-mail, boutons Google compris), inscription, mot de passe
 * oublié, nouveau mot de passe, invitation (visiteur non connecté, puis connecté), désinscription.
 * Pour chaque bouton visible (button, liens habillés en bouton, role=button), en clair et en sombre,
 * au repos, au survol et au focus :
 *  - un libellé non vide (texte visible, ou aria-label pour un bouton d'icône) ;
 *  - un contraste du texte sur son fond de 4,5:1 au moins (fond composé avec ceux des parents) ;
 *  - aucun texte de la couleur de son fond.
 * Faux Supabase, données fictives (Acme, .example).
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};

const INVITATION = {
  workspace_name: 'Acme Formation',
  role: 'editor',
  email: 'bob@acme.example',
  expired: false,
  accepted: false,
};
const PAGES = [
  { name: 'Connexion', route: '/#/login', signedOut: true },
  {
    name: 'Connexion par lien e-mail',
    route: '/#/login',
    signedOut: true,
    open: (p) => p.getByRole('button', { name: /lien de connexion par e-mail/ }).click(),
  },
  { name: 'Inscription', route: '/#/signup', signedOut: true },
  { name: 'Mot de passe oublié', route: '/#/forgot-password', signedOut: true },
  { name: 'Nouveau mot de passe', route: '/#/reset-password' },
  { name: 'Invitation (non connecté)', route: '/#/invite/jeton-acme', signedOut: true, invitation: true },
  { name: 'Invitation (connecté)', route: '/#/invite/jeton-acme', invitation: true },
  { name: 'Désinscription', route: '/#/unsubscribe/jeton-desinscription' },
];

/** Dans la page : boutons visibles, libellé et contraste. */
function measure() {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1]
      .split(/[ ,/]+/)
      .filter(Boolean)
      .map(Number);
    return { r, g, b, a };
  };
  const over = (top, under) => ({
    r: top.r * top.a + under.r * (1 - top.a),
    g: top.g * top.a + under.g * (1 - top.a),
    b: top.b * top.a + under.b * (1 - top.a),
    a: 1,
  });
  /** Fond réellement vu derrière l'élément : son fond composé avec ceux de ses parents. */
  const backdrop = (el) => {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c && c.a > 0) {
        layers.push(c);
        if (c.a >= 1) break;
      }
    }
    let acc = { r: 255, g: 255, b: 255, a: 1 };
    for (const l of layers.reverse()) acc = over(l, acc);
    return acc;
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  const out = [];
  const els = document.querySelectorAll(
    'button, a.fd-btn, a.btn, [role="button"], input[type="submit"], input[type="button"]',
  );
  for (const el of els) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (!r.width || !r.height || cs.visibility === 'hidden' || el.closest('[aria-hidden="true"], .sr-only'))
      continue;
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue;
    const text = (el.innerText || el.value || '').trim();
    const label = text || el.getAttribute('aria-label') || '';
    const bg = backdrop(el);
    const fg = parse(cs.color);
    const color = over(fg, bg);
    out.push({
      id: el.dataset.e2eBtn,
      label,
      text: !!text,
      ratio: text ? Math.round(ratio(color, bg) * 100) / 100 : null,
    });
  }
  return out;
}

(async () => {
  const b = await chromium.launch();
  for (const theme of ['light', 'dark'])
    for (const pg of PAGES) {
      const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
      await ctx.addInitScript((t) => localStorage.setItem('fd.theme', t), theme);
      const p = await ctx.newPage();
      const errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      const state = { ...seed(), signedOut: !!pg.signedOut };
      if (pg.invitation) state.invitation = INVITATION;
      state.unsubTokens = { 'jeton-desinscription': state.user?.id ?? 'u-alice' };
      await install(p, state);
      await p.goto(`${APP}${pg.route}`);
      await p.locator('main h1, h1').first().waitFor();
      if (pg.open) await pg.open(p);
      await p.waitForTimeout(500);
      const tag = `${pg.name} (${theme})`;
      // Identifiant de chaque bouton visible, pour le survoler et le focaliser ensuite
      const n = await p.evaluate(() => {
        let i = 0;
        for (const el of document.querySelectorAll(
          'button, a.fd-btn, a.btn, [role="button"], input[type="submit"], input[type="button"]',
        ))
          el.dataset.e2eBtn = String(i++);
        return i;
      });
      const rest = await p.evaluate(measure);
      ok(rest.length > 0 && n > 0, `${tag} : ${rest.length} bouton(s) mesuré(s)`);
      const empty = rest.filter((x) => !x.label);
      ok(!empty.length, `${tag} : aucun bouton sans libellé (${empty.map((x) => x.id).join(', ')})`);
      const low = (list) =>
        list.filter((x) => x.text && x.ratio < 4.5).map((x) => `« ${x.label} » ${x.ratio}:1`);
      ok(!low(rest).length, `${tag} : contraste ≥ 4,5:1 au repos (${low(rest).join(' ; ')})`);
      // Survol puis focus de chaque bouton avec texte
      const hover = [];
      const focus = [];
      for (const x of rest.filter((y) => y.text)) {
        const loc = p.locator(`[data-e2e-btn="${x.id}"]`);
        await loc.hover();
        await p.waitForTimeout(150);
        hover.push(...(await p.evaluate(measure)).filter((y) => y.id === x.id));
        await loc.focus();
        await p.mouse.move(0, 0);
        await p.waitForTimeout(150);
        focus.push(...(await p.evaluate(measure)).filter((y) => y.id === x.id));
      }
      ok(!low(hover).length, `${tag} : contraste ≥ 4,5:1 au survol (${low(hover).join(' ; ')})`);
      ok(!low(focus).length, `${tag} : contraste ≥ 4,5:1 au focus (${low(focus).join(' ; ')})`);
      if (pg.name.startsWith('Connexion') && pg.signedOut && !pg.open)
        ok(
          rest.some((x) => /Google/.test(x.label)),
          `${tag} : bouton Google mesuré`,
        );
      if (pg.name === 'Invitation (non connecté)')
        ok(
          rest.some((x) => x.label === 'Se connecter') && rest.some((x) => x.label === 'Créer mon compte'),
          `${tag} : « Se connecter » et « Créer mon compte » visibles`,
        );
      ok(errors.length === 0, `${tag} : aucune erreur JS (${errors.join(' | ')})`);
      await ctx.close();
    }
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
