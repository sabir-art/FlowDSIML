/**
 * Retours client 21/11 §6 : barre latérale principale repliable en rail de 64 px (spec
 * docs/ux/specs/retours-client-21-11.md §6). Faux Supabase, données de la maquette.
 *  - épinglée par défaut à partir de 1 440 px, rail en dessous ; état retenu (fd.sidebar) ;
 *  - rail : icônes de 20 px dans des cibles de 44 px, noms accessibles gardés, infobulle à droite ;
 *  - survol : déplié par-dessus le contenu après 150 ms (sans le pousser), replié 300 ms après la sortie ;
 *  - bouton d'épinglage au même endroit dans les deux états, aria-pressed ;
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
      pressed: pin?.getAttribute('aria-pressed') ?? null,
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
  ok(g.pressed === 'false' && g.pin.width === 32, 'bouton d’épinglage de 32 px, aria-pressed="false"');
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
  ok((await p.locator('.brand__symbol').count()) === 1, 'logo réduit à son icône');
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

  // Épingler : même place du bouton, pousse le contenu, retenu
  const pinRail = g.pin;
  await p.locator('.sidebar__pin').click();
  await p.mouse.move(700, 400);
  await p.waitForTimeout(400);
  g = await geo(p);
  ok(
    g.pressed === 'true' && g.sb === 256 && g.main === 256,
    'épinglée : 256 px, pousse le contenu, aria-pressed="true"',
  );
  ok(
    Math.abs(g.pin.x - pinRail.x) <= 1 && Math.abs(g.pin.y - pinRail.y) <= 1,
    `bouton d’épinglage au même endroit (${Math.round(pinRail.x)},${Math.round(pinRail.y)} → ${Math.round(g.pin.x)},${Math.round(g.pin.y)})`,
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
