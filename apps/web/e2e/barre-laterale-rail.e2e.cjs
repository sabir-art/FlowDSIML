/**
 * Retours client 21/11 §6 : barre latérale principale repliable en rail de 64 px (spec
 * docs/ux/specs/retours-client-21-11.md §6). Faux Supabase, données de la maquette.
 *  - épinglée par défaut à partir de 1 440 px, rail en dessous ; état retenu (fd.sidebar) ;
 *  - rail : icônes de 20 px dans des cibles de 44 px, noms accessibles gardés, infobulle à droite ;
 *  - survol : déplié par-dessus le contenu après 150 ms (sans le pousser), replié 300 ms après la sortie ;
 *  - NAV-04 (COMP-01 §14) : logo de 184 px à gauche et bouton de repli à droite sur une ligne, filet dessous ;
 *    rail : bouton seul en tête, il garde sa place au survol (le logo vient à sa droite) ; aria-expanded ;
 *  - clavier : le focus déplie, Échap replie et rend le focus à l'élément actif ;
 *  - sous 1 024 px : comportement inchangé (barre du haut et tiroir).
 */
const { chromium } = require('playwright');
const { install } = require('./fake-supabase.cjs');
const { seedMaquette } = require('./maquette-data.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};

async function open(b, width, stored) {
  const ctx = await b.newContext({ viewport: { width, height: 800 } });
  if (stored) await ctx.addInitScript((v) => localStorage.setItem('fd.sidebar', v), stored);
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', (e) => p.errors.push(e.message));
  await install(p, seedMaquette());
  await p.goto(`${APP}/#/analytics`);
  await p.locator('main h1').waitFor();
  await p.waitForTimeout(600);
  return p;
}
const geo = (p) =>
  p.evaluate(() => {
    const sb = document.querySelector('.sidebar');
    const pin = document.querySelector('.sidebar__pin');
    const item = document.querySelector('.fd-nav__item');
    const icon = item?.querySelector('svg')?.getBoundingClientRect();
    return {
      sb: Math.round(sb.getBoundingClientRect().width),
      main: Math.round(document.querySelector('main').getBoundingClientRect().left),
      exp: sb.dataset.expanded ?? null,
      pin: pin ? pin.getBoundingClientRect().toJSON() : null,
      pressed: pin?.getAttribute('aria-expanded') ?? null,
      pinName: pin?.getAttribute('aria-label') ?? null,
      logo: (() => {
        const i = [...document.querySelectorAll('.sidebar .brand img')].find((x) => x.offsetParent);
        return i ? i.getBoundingClientRect().toJSON() : null;
      })(),
      head: document.querySelector('.sidebar__head').getBoundingClientRect().toJSON(),
      rule: getComputedStyle(document.querySelector('.sidebar__head')).borderBottomWidth,
      ws: Math.round(document.querySelector('.sidebar .ws-switch').getBoundingClientRect().top),
      item: item ? Math.round(item.getBoundingClientRect().width) : 0,
      itemH: item ? Math.round(item.getBoundingClientRect().height) : 0,
      icon: icon ? Math.round(icon.width) : 0,
      iconX: icon ? Math.round(icon.left) : 0,
      shadow: getComputedStyle(sb).boxShadow,
      over: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
    };
  });

(async () => {
  const b = await chromium.launch();

  // ===== 1 440 px : épinglée par défaut =====
  {
    const p = await open(b, 1440);
    const g = await geo(p);
    ok(g.sb === 256 && g.main === 256 && g.pressed === 'true', `1 440 px : épinglée par défaut (${g.sb} px)`);
    // NAV-04 : logo à gauche, bouton de repli à droite sur la même ligne, filet dessous, puis l'espace
    ok(
      g.pinName === 'Replier la barre latérale' &&
        Math.round(g.logo.x) === 16 &&
        Math.round(g.logo.y) === 16 &&
        Math.round(g.pin.x) === 208 &&
        Math.round(g.pin.y) === 30,
      `NAV-04 : logo à 16,16 et bouton « Replier » à 208,30 (${Math.round(g.pin.x)},${Math.round(g.pin.y)})`,
    );
    ok(
      g.rule === '1px' && g.ws === 111,
      `NAV-04 : filet sous l'en-tête, sélecteur d'espace à 111 px (${g.ws})`,
    );
    // LOGO-01 (§16.5) : logo complet de 184 px (NAV-04), sans sous-titre ; fichier sombre en thème sombre, sans filtre
    const logo = () =>
      p.evaluate(() =>
        [...document.querySelectorAll('.sidebar .brand img')]
          .filter((i) => i.offsetParent)
          .map((i) => ({
            w: Math.round(i.getBoundingClientRect().width),
            alt: i.alt,
            dark: /sombre/.test(i.getAttribute('src')),
            filter: getComputedStyle(i).filter,
          })),
      );
    let l = await logo();
    ok(
      l.length === 1 && l[0].w === 184 && l[0].alt === 'TutoClick, porté par la DSIML' && !l[0].dark,
      `logo complet de 184 px (${JSON.stringify(l)})`,
    );
    ok((await p.locator('.sidebar .brand-mark__sub').count()) === 0, 'aucun sous-titre HTML sous le logo');
    await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    l = await logo();
    ok(
      l.length === 1 && l[0].dark && l[0].filter === 'none',
      'thème sombre : fichier sombre, aucun filtre CSS',
    );
    await p.context().close();
  }

  // ===== 1 280 px : rail par défaut =====
  const p = await open(b, 1280);
  let g = await geo(p);
  ok(g.sb === 64 && g.main === 64 && g.exp === 'false', `1 280 px : rail de 64 px par défaut (${g.sb} px)`);
  ok(
    g.item === 44 && g.itemH === 44 && g.icon === 20,
    `icônes de 20 px dans des cibles de 44 × 44 (${g.item} × ${g.itemH})`,
  );
  ok(
    g.pressed === 'false' && g.pin.width === 32 && g.pinName === 'Déplier la barre latérale',
    'bouton « Déplier la barre latérale » de 32 px, aria-expanded="false"',
  );
  ok(
    Math.round(g.pin.x) === 16 && Math.round(g.pin.y) === 30 && g.rule === '1px' && g.ws === 111,
    `NAV-04 : bouton seul en tête du rail, centré (x ${Math.round(g.pin.x)}), filet, pastille de l'espace dessous`,
  );
  ok(
    (await p.getByRole('link', { name: 'Démos', exact: true }).count()) === 1 &&
      (await p.getByRole('link', { name: 'Analytics', exact: true }).getAttribute('aria-current')) === 'page',
    'noms accessibles gardés (« Démos », « Analytics » actif)',
  );
  ok(
    (await p.locator('.fd-nav__item').first().getAttribute('data-tip')) === 'Démos' &&
      (await p.locator('.sidebar').getAttribute('data-tip-side')) === 'right',
    'infobulle du libellé, à droite',
  );
  ok(
    (await p
      .locator('.sidebar .fd-nav__label')
      .first()
      .evaluate((el) => el.getBoundingClientRect().width)) <= 1,
    'libellés masqués visuellement',
  );
  ok(g.logo === null, 'NAV-04 : pas de logo dans le rail replié');
  ok(g.over <= 1, 'aucun défilement horizontal');

  // Survol : 150 ms, par-dessus, sans pousser ; repli 300 ms après la sortie
  await p.mouse.move(700, 400);
  await p.mouse.move(32, 300);
  await p.waitForTimeout(60);
  ok((await geo(p)).exp === 'false', 'survol : pas encore déplié à 60 ms');
  await p.waitForTimeout(250);
  g = await geo(p);
  ok(
    g.exp === 'true' && g.sb === 256 && g.main === 64,
    `survol : déplié à 256 px par-dessus, contenu immobile (main ${g.main})`,
  );
  ok(g.shadow !== 'none', 'ombre portée quand il est déplié');
  ok(
    Math.round(g.pin.x) === 16 && Math.round(g.pin.y) === 30 && g.logo && Math.round(g.logo.x) === 56,
    `NAV-04 : au survol le bouton garde sa place (x ${Math.round(g.pin.x)}), le logo vient à sa droite (x ${g.logo && Math.round(g.logo.x)})`,
  );
  ok(
    (await p.locator('.fd-nav__item').first().getAttribute('data-tip')) === null,
    'déplié : plus d’infobulle (libellé visible)',
  );
  const iconRail = (await geo(p)).iconX;
  await p.mouse.move(700, 400);
  await p.waitForTimeout(150);
  ok((await geo(p)).exp === 'true', 'sortie : encore déplié à 150 ms');
  await p.waitForTimeout(300);
  g = await geo(p);
  ok(g.exp === 'false' && g.sb === 64, 'sortie : replié après 300 ms');
  ok(Math.abs(g.iconX - iconRail) <= 1, 'les icônes ne bougent pas au dépli');

  // Clic dans la barre dépliée au survol (Centre d'aide) : se replie quand le pointeur sort
  await p.mouse.move(32, 300);
  await p.waitForTimeout(300);
  await p.getByRole('button', { name: 'Centre d’aide' }).click();
  await p.keyboard.press('Escape'); // referme le centre d'aide
  await p.mouse.move(700, 400);
  await p.waitForTimeout(450);
  ok((await geo(p)).exp === 'false', 'après un clic dans la barre, la sortie du pointeur la replie');

  // Épingler : pousse le contenu, retenu ; le bouton passe à droite du logo
  await p.locator('.sidebar__pin').click();
  await p.mouse.move(700, 400);
  await p.waitForTimeout(400);
  g = await geo(p);
  ok(
    g.pressed === 'true' && g.sb === 256 && g.main === 256,
    'épinglée : 256 px, pousse le contenu, aria-expanded="true"',
  );
  ok(
    Math.round(g.pin.x) === 208 && Math.round(g.pin.y) === 30 && Math.round(g.logo.x) === 16,
    `épinglée : logo à gauche, bouton à droite (${Math.round(g.pin.x)},${Math.round(g.pin.y)})`,
  );
  ok((await p.evaluate(() => localStorage.getItem('fd.sidebar'))) === 'pinned', 'état retenu : pinned');
  await p.reload();
  await p.locator('main h1').waitFor();
  ok((await geo(p)).sb === 256, 'après rechargement : toujours épinglée');
  await p.locator('.sidebar__pin').click();
  await p.mouse.move(700, 400);
  await p.waitForTimeout(400);
  ok(
    (await geo(p)).sb === 64 && (await p.evaluate(() => localStorage.getItem('fd.sidebar'))) === 'rail',
    'réduire : rail, retenu (rail)',
  );

  // Clavier : le focus déplie ; Échap replie et rend le focus à l'élément actif
  await p.locator('main h1').click();
  // Focus clavier (une touche d'abord, comme en arrivant par Tab) : seul le focus clavier déplie
  await p.keyboard.press('Shift');
  await p.locator('.fd-nav__item').first().focus();
  await p.waitForTimeout(100);
  ok((await geo(p)).exp === 'true', 'focus dans le rail : déplié');
  await p.keyboard.press('Tab');
  await p.waitForTimeout(100);
  ok((await geo(p)).exp === 'true', 'tant que le focus y reste, il reste déplié');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(100);
  g = await geo(p);
  const focused = await p.evaluate(() => document.activeElement?.getAttribute('aria-current'));
  ok(g.exp === 'false' && focused === 'page', 'Échap : replié, focus sur l’élément actif (Analytics)');
  await p.keyboard.press('Shift+Tab');
  await p.waitForTimeout(100);
  ok((await geo(p)).exp === 'true', 'nouveau déplacement du focus : déplié de nouveau');
  ok(p.errors.length === 0, `aucune erreur JS (${p.errors.join(' | ')})`);
  await p.context().close();

  // ===== Clic souris sur « Mon compte » dans le rail, sur une page neuve : le menu s'ouvre =====
  // (le focus donné par le clic dépliait la barre avant le relâchement ; le bouton changeait de place et
  // le clic tombait sur la barre)
  {
    const q = await open(b, 1280);
    await q.getByRole('button', { name: 'Mon compte' }).click();
    await q.waitForTimeout(400);
    ok(
      (await q.getByRole('menuitemradio', { name: 'Sombre' }).count()) === 1,
      'rail : clic sur « Mon compte », menu ouvert',
    );
    await q.context().close();
  }

  // ===== Préférence « rail » à 1 440 px, puis < 1 024 px inchangé =====
  {
    const q = await open(b, 1440, 'rail');
    ok((await geo(q)).sb === 64, '1 440 px avec « rail » retenu : rail');
    await q.context().close();
  }
  {
    const q = await open(b, 390, 'rail');
    const m = await q.evaluate(() => ({
      rail: document.querySelector('.shell').classList.contains('shell--rail'),
      topbar: getComputedStyle(document.querySelector('.topbar')).display,
      pin: document.querySelectorAll('.sidebar__pin').length,
    }));
    ok(!m.rail && m.topbar !== 'none' && m.pin === 0, 'sous 1 024 px : barre du haut et tiroir, inchangés');
    await q.context().close();
  }

  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
