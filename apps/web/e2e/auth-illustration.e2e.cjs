/**
 * Recette AUTH-ILL (docs/ux/specs/auth-illustration.md §6) : panneau illustré des pages de connexion,
 * d'inscription, d'invitation et de mot de passe oublié.
 *  - fond du panneau, titre et sous-titre : couleurs et contrastes calculés, en clair et en sombre ;
 *  - aucun bleu d'interface (teinte de 190° à 250°) hors des quatre points de la DSIML ;
 *  - fenêtre de 560 px au plus, hotspot à contour blanc sur le bouton, bulle « 1 / 6 » avec « Suivant »,
 *    rien ne déborde à 1440 et à 1024 px ; panneau absent sous 900 px ; aucun texte lisible hors bulle ;
 *  - la bulle passe de 1/6 à 2/6 ; mouvement réduit : aucune animation, étape figée sur 1/6.
 * Faux Supabase, données fictives (Acme, .example).
 * Usage : node e2e/auth-illustration.e2e.cjs   (SHOTS_DIR pour les captures)
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;

// Contrastes de la spec à 0,35 près (arrondis de la formule), et toujours au-dessus de 7:1
const near = (got, want) => Math.abs(got - want) <= 0.35 && got >= 7;
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
  { name: 'connexion', route: '/#/login', title: 'Montrez la procédure. Laissez‑la guider.' },
  { name: 'inscription', route: '/#/signup', title: 'Capturez · Guidez · Diffusez', steps: true },
  { name: 'invitation', route: '/#/invite/jeton-acme', title: 'Montrez la procédure. Laissez‑la guider.' },
  {
    name: 'mot-de-passe-oublie',
    route: '/#/forgot-password',
    title: 'Montrez la procédure. Laissez‑la guider.',
  },
];
const EXPECT = {
  light: { bg: 'rgb(72, 15, 42)', title: 15.2, sub: 11.0, hs: 'rgb(163, 25, 91)' },
  dark: { bg: 'rgb(42, 12, 26)', title: 18.3, sub: 13.3, hs: 'rgb(207, 134, 169)' },
};

/** Mesures faites dans la page : couleurs, contrastes, teintes, cadres. */
function measure() {
  const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p);
    return Math.round(((x + 0.05) / (y + 0.05)) * 10) / 10;
  };
  const hue = ([r, g, b]) => {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    // Gris et neutres de la marque (#8A94A2, #E2E8EF…) : écart trop faible entre canaux pour être une couleur
    if (max - min < 40) return null;
    const d = max - min;
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return Math.round((h * 60 + 360) % 360);
  };
  const aside = document.querySelector('.auth-ill');
  if (!aside || getComputedStyle(aside).display === 'none') return null;
  const cs = (el) => getComputedStyle(el);
  const bg = cs(aside).backgroundColor;
  const blue = [];
  for (const el of aside.querySelectorAll('*')) {
    if (el.closest('.auth-ill__dots')) continue;
    for (const k of ['backgroundColor', 'color', 'borderTopColor']) {
      const c = rgb(cs(el)[k]);
      if (c.length === 4 && c[3] === 0) continue;
      const h = hue(c);
      if (h !== null && h >= 190 && h <= 250) blue.push(`${el.className} ${k} ${cs(el)[k]}`);
    }
  }
  const box = (el) => el.getBoundingClientRect();
  const win = aside.querySelector('.auth-ill__win');
  const tip = aside.querySelector('.auth-ill__tip');
  const hs = aside.querySelector('.auth-ill__hs');
  const inside = (a, b) =>
    a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5;
  const title = aside.querySelector('.auth-ill__h');
  const sub = aside.querySelector('.auth-ill__sub, .auth-ill__steps li');
  const btn = box(aside.querySelector('.auth-ill__new'));
  const h = box(hs);
  // Texte lisible de la fenêtre, hors de la bulle
  const stray = [...win.querySelectorAll('*')]
    .filter((el) => !el.closest('.auth-ill__tip'))
    .map((el) =>
      [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.trim())
        .join(''),
    )
    .join('');
  return {
    hidden: aside.getAttribute('aria-hidden'),
    bg,
    title: {
      text: title.textContent,
      size: cs(title).fontSize,
      weight: cs(title).fontWeight,
      ratio: ratio(cs(title).color, bg),
    },
    sub: { size: cs(sub).fontSize, ratio: ratio(cs(sub).color, bg) },
    blue,
    win: { w: Math.round(box(win).width), ratio: Math.round((box(win).width / box(win).height) * 100) / 100 },
    winInside: inside(box(win), box(aside)),
    tipInside: inside(box(tip), box(win)),
    tipWidth: Math.round(box(tip).width),
    quoteInside: inside(box(aside.querySelector('.auth-ill__quote')), box(aside)),
    gap: Math.round(box(aside.querySelector('.auth-ill__quote')).top - box(win).bottom),
    hs: { size: Math.round(h.width), bg: cs(hs).backgroundColor, ring: cs(hs).boxShadow },
    hsOnButton:
      h.left >= btn.left && h.right <= btn.right + 8 && h.top >= btn.top - 8 && h.bottom <= btn.bottom + 8,
    tip: tip.innerText.replace(/\s+/g, ' ').trim(),
    step: win.dataset.step,
    stray,
    dots: [...aside.querySelectorAll('.auth-ill__dots i')].map((i) => cs(i).backgroundColor),
    steps: [...aside.querySelectorAll('.auth-ill__steps li')].length,
    scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    anims: aside.getAnimations({ subtree: true }).length,
  };
}

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const open = async (pg, theme, width, extra = {}) => {
    const ctx = await b.newContext({ viewport: { width, height: 900 }, locale: 'fr-FR', ...extra });
    await ctx.addInitScript((t) => localStorage.setItem('fd.theme', t), theme);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    const state = { ...seed(), signedOut: true, invitation: INVITATION };
    await install(p, state);
    await p.goto(`${APP}${pg.route}`);
    await p.locator('main h1').first().waitFor();
    return { p, ctx };
  };

  for (const theme of ['light', 'dark']) {
    const sfx = theme === 'dark' ? '-sombre' : '';
    for (const pg of PAGES) {
      const tag = `${pg.name} (${theme})`;
      const { p, ctx } = await open(pg, theme, 1440);
      const m = await p.evaluate(measure);
      const e = EXPECT[theme];
      ok(m && m.hidden === 'true', `${tag} : panneau présent à 1440 px, décoratif (aria-hidden)`);
      if (!m) {
        await ctx.close();
        continue;
      }
      ok(m.bg === e.bg, `${tag} : fond du panneau ${m.bg}`);
      ok(
        m.title.text === pg.title &&
          m.title.size === '30px' &&
          m.title.weight === '800' &&
          near(m.title.ratio, e.title),
        `${tag} : titre de 30 px en 800, contraste ${m.title.ratio}:1 (${m.title.text})`,
      );
      ok(
        (m.sub.size === '16px' || pg.steps) && near(m.sub.ratio, e.sub),
        `${tag} : texte en prune-100, ${m.sub.ratio}:1`,
      );
      ok(
        m.blue.length === 0,
        `${tag} : aucun bleu hors des quatre points${m.blue.length ? ` (${m.blue[0]})` : ''}`,
      );
      ok(
        m.dots.join('|') === 'rgb(213, 13, 82)|rgb(43, 149, 210)|rgb(149, 192, 32)|rgb(241, 145, 3)',
        `${tag} : signature, les quatre points de la DSIML`,
      );
      ok(
        m.win.w <= 560 &&
          Math.abs(m.win.ratio - 1.78) <= 0.01 &&
          m.winInside &&
          m.tipInside &&
          m.quoteInside &&
          m.gap >= 48,
        `${tag} : fenêtre de ${m.win.w} px en 16/9, bulle et accroche dans le panneau, ${m.gap} px entre les deux`,
      );
      ok(
        m.hs.size === 14 &&
          m.hs.bg === e.hs &&
          /rgb\(255, 255, 255\) 0px 0px 0px 2px/.test(m.hs.ring) &&
          m.hsOnButton,
        `${tag} : hotspot de 14 px à contour blanc, sur le bouton (${m.hs.bg})`,
      );
      ok(
        m.tipWidth === 196 &&
          m.tip ===
            '1 / 6 Créez votre première démo Cliquez sur « Nouvelle démo », puis capturez la procédure. Suivant',
        `${tag} : bulle de 196 px, « 1 / 6 », « Suivant »`,
      );
      ok(m.stray === '', `${tag} : aucun texte lisible dans la fenêtre hors de la bulle`);
      ok(
        pg.steps ? m.steps === 3 : m.steps === 0,
        `${tag} : ${pg.steps ? 'trois étapes numérotées' : 'accroche seule'}`,
      );
      ok(m.scroll <= 0, `${tag} : pas de défilement horizontal à 1440 px`);
      if (SHOTS) {
        await p.mouse.move(0, 0);
        await p.screenshot({ path: `${SHOTS}/auth-ill-${pg.name}${sfx}.png` });
      }
      await ctx.close();
    }

    // 1024 px : rien ne déborde ; sous 900 px : pas de panneau
    {
      const { p, ctx } = await open(PAGES[0], theme, 1024);
      const m = await p.evaluate(measure);
      ok(
        m && m.winInside && m.tipInside && m.quoteInside && m.scroll <= 0,
        `1024 px (${theme}) : fenêtre de ${m?.win.w} px, bulle dans la fenêtre, aucun débordement`,
      );
      if (SHOTS) await p.screenshot({ path: `${SHOTS}/auth-ill-connexion-1024${sfx}.png` });
      await ctx.close();
    }
    {
      const { p, ctx } = await open(PAGES[0], theme, 899);
      ok((await p.evaluate(measure)) === null, `899 px (${theme}) : panneau absent`);
      await ctx.close();
    }
  }

  // La bulle passe de 1/6 à 2/6 (toutes les 4 s) : on attend l'état réel, sans délai fixe
  {
    const { p, ctx } = await open(PAGES[0], 'light', 1440);
    const win = p.locator('.auth-ill__win');
    ok((await win.getAttribute('data-step')) === '1', 'mouvement : départ sur 1/6');
    ok((await p.evaluate(measure)).anims > 0, 'mouvement : l’anneau du hotspot pulse');
    await p.mouse.move(200, 400);
    await p.locator('.auth-ill__win[data-step="2"]').waitFor({ timeout: 15000 });
    await p.locator('.auth-ill__tip:not(.is-fade)').waitFor();
    ok(
      /^2 \/ 6 Ouvrez la démo Acme CRM/.test(
        (await p.locator('.auth-ill__tip').innerText()).replace(/\s+/g, ' '),
      ),
      'mouvement : la bulle passe à « 2 / 6 · Ouvrez la démo Acme CRM »',
    );
    await p.locator('.auth-ill__win[data-step="1"]').waitFor({ timeout: 15000 });
    ok(true, 'mouvement : puis revient à 1/6');
    await ctx.close();
  }
  // Étape figée par l'adresse (captures)
  {
    const { p, ctx } = await open({ route: '/#/login?ill=2' }, 'light', 1440);
    const m = await p.evaluate(measure);
    ok(m.step === '2' && m.tipInside, 'étape 2 figée : bulle dans la fenêtre');
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/auth-ill-connexion-etape2.png` });
    await ctx.close();
  }
  // Mouvement réduit : aucune animation, étape figée
  {
    const { p, ctx } = await open(PAGES[0], 'light', 1440, { reducedMotion: 'reduce' });
    const m = await p.evaluate(measure);
    ok(m.anims === 0, `mouvement réduit : aucune animation (${m.anims})`);
    // Deux cycles d'horloge de la page plus tard, toujours 1/6
    await p.clock.install().catch(() => {});
    await p.clock.fastForward(9000).catch(() => {});
    ok(
      (await p.locator('.auth-ill__win').getAttribute('data-step')) === '1',
      'mouvement réduit : figé sur 1/6',
    );
    await ctx.close();
  }

  // Lot 7 : formulaire sur le fond du contenu ; après une erreur d'identifiants, la saisie est gardée,
  // un encadré l'annonce en haut, le mot de passe est marqué invalide, focalisé, et a son œil
  for (const theme of ['light', 'dark']) {
    const { p, ctx } = await open(PAGES[0], theme, 1440);
    const bg = await p.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--fd-color-content-bg)';
      document.body.append(probe);
      const want = getComputedStyle(probe).color;
      probe.remove();
      return { got: getComputedStyle(document.querySelector('.auth')).backgroundColor, want };
    });
    ok(bg.got === bg.want, `connexion (${theme}) : formulaire sur le fond du contenu (${bg.got})`);
    await p.getByLabel('Adresse e-mail professionnelle').fill('camille.martin@example.com');
    const eye = p.getByRole('button', { name: 'Afficher le mot de passe' });
    ok((await eye.count()) === 0, `connexion (${theme}) : pas d’œil tant que rien n’est tapé`);
    await p.locator('#password').pressSequentially('mot-de-passe-faux');
    ok((await eye.count()) === 1, `connexion (${theme}) : œil sur le mot de passe une fois tapé`);
    await p.getByRole('button', { name: 'Se connecter', exact: true }).click();
    const box = p.locator('.auth-alert');
    await box.waitFor();
    ok(
      (await box.getAttribute('role')) === 'alert' &&
        (await box.innerText()).replace(/\s+/g, ' ') ===
          'Adresse e-mail ou mot de passe incorrect. Vérifiez les deux champs, ou recevez un lien de connexion par e-mail.',
      `connexion (${theme}) : encadré d’erreur en haut du formulaire`,
    );
    ok(
      (await p.locator('#password').inputValue()) === 'mot-de-passe-faux' &&
        (await p.getByLabel('Adresse e-mail professionnelle').inputValue()) === 'camille.martin@example.com',
      `connexion (${theme}) : saisie gardée après l’erreur`,
    );
    ok(
      (await p.evaluate(() => document.activeElement?.id)) === 'password' &&
        (await p.locator('#password').getAttribute('aria-invalid')) === 'true' &&
        (await p.locator('#password').getAttribute('aria-describedby')) === 'login-error' &&
        (await p.locator('#login-error').innerText()).trim() === 'Mot de passe incorrect.' &&
        (await p.getByLabel('Adresse e-mail professionnelle').getAttribute('aria-invalid')) === null,
      `connexion (${theme}) : mot de passe focalisé, seul champ invalide, « Mot de passe incorrect. »`,
    );
    ok((await p.getByRole('alert').count()) === 1, `connexion (${theme}) : une seule annonce d’erreur`);
    if (SHOTS)
      await p.screenshot({ path: `${SHOTS}/auth-connexion-erreur${theme === 'dark' ? '-sombre' : ''}.png` });
    await p.locator('#password').pressSequentially('x');
    await box.waitFor({ state: 'detached' });
    ok(true, `connexion (${theme}) : l’encadré disparaît à la correction`);
    await ctx.close();
  }

  // Lien du pied « Accessibilité : non conforme » (mention du RGAA sans audit complet) sur chaque page
  // d'accès ; la déclaration est celle d'un projet personnel (aucune donnée d'organisme)
  for (const pg of PAGES) {
    const { p, ctx } = await open(pg, 'light', 1440);
    const link = p
      .locator('.auth-legal')
      .getByRole('link', { name: 'Accessibilité : non conforme', exact: true });
    ok((await link.count()) === 1, `${pg.name} : lien « Accessibilité : non conforme » au pied`);
    if (pg.name === 'connexion') {
      await link.click();
      await p
        .getByRole('heading', { level: 1, name: 'Déclaration d’accessibilité' })
        .or(p.getByRole('heading', { level: 1, name: "Déclaration d'accessibilité" }))
        .waitFor();
      // e9a9c51 : apostrophes typographiques dans les pages légales ; on compare sur l'apostrophe droite
      const doc = (await p.locator('main').innerText()).replace(/\s+/g, ' ').replace(/’/g, "'");
      ok(
        /déclaré non conforme au sens du référentiel général d'amélioration de l'accessibilité \(RGAA\), version 4\.1/.test(
          doc,
        ) && !/non évaluée|partiellement conforme/.test(doc),
        'déclaration : état « non conforme », aucun taux',
      );
      // Retours client du 24/11 §10 : projet personnel, sans aucune donnée d'organisme ni de personne
      ok(
        (await p.getByRole('note').count()) === 0 && !/[[\]]/.test(doc),
        'déclaration : ni encart « en attente de validation », ni champ entre crochets',
      );
      ok(
        doc.includes(
          "TutoClick est un projet personnel, en cours de développement. Il suit le référentiel général d'amélioration de l'accessibilité (RGAA 4.1) comme référence.",
        ) &&
          doc.includes('Cette déclaration a été établie le 24 novembre 2026.') &&
          doc.includes('Mise à jour : 24 novembre 2026'),
        'déclaration : introduction du projet personnel, établie et mise à jour le 24 novembre 2026',
      );
      ok(
        !/article 47|schéma pluriannuel|plan d.action|Voies de recours|Défenseur des droits|@/.test(doc),
        'déclaration : ni article 47, ni schéma pluriannuel, ni voies de recours, ni adresse',
      );
      ok(
        doc.includes("Centre d'aide, article « Accessibilité de TutoClick »") &&
          /un moyen de contact pour les visiteurs est à venir\./i.test(doc),
        'déclaration : retour par l’aide de l’application ; contact des visiteurs à venir',
      );
      ok(
        (await p.locator('main h2').allInnerTexts()).join(' | ').replace(/’/g, "'") ===
          "État de conformité | Vérifications réalisées | Contenus non accessibles | Établissement de cette déclaration d'accessibilité | Retour d'information",
        'déclaration : sections attendues',
      );
      if (SHOTS) await p.screenshot({ path: `${SHOTS}/legal-accessibilite.png`, fullPage: true });
    }
    await ctx.close();
  }

  ok(errors.length === 0, `aucune erreur de page${errors.length ? ` : ${errors.join(' | ')}` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
