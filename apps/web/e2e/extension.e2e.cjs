/**
 * Page Extension (retours du 24/11, 2e série §7).
 *  - extension absente : bloc d'accueil (puce « Chrome et Edge », titre, trois bénéfices, bouton primaire
 *    vers la boutique dans un nouvel onglet, aide) si l'extension a une fiche (VITE_EXTENSION_URL), sinon
 *    « Bientôt disponible » ; le test lit cet état au lieu de le supposer ;
 *  - extension présente : « L'extension est prête », « Capturer une démo », trois faits (version, dernière
 *    capture, raccourci) et « Bien capturer ».
 * Données fictives. Usage : [THEME=dark] [WIDTH=390] [SHOTS_DIR=…] node e2e/extension.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const WIDTH = Number(process.env.WIDTH || 1440);
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const open = async (prepare = () => {}) => {
    const page = await (await themedContext(b, { viewport: { width: WIDTH, height: 900 } })).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    const state = seed();
    prepare(state);
    await install(page, state);
    await page.goto(`${APP}/#/extension`);
    await page.getByRole('heading', { name: 'Extension', level: 1 }).waitFor();
    return { page, state };
  };
  const shot = async (page, name) => {
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}-${WIDTH}${sfx}.png` });
  };
  const noScroll = (page) =>
    page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

  // ===== Extension absente =====
  {
    const { page } = await open();
    await page.locator('.xt-card').first().waitFor();
    if ((await page.locator('.xt-hero').count()) === 1) {
      const hero = page.locator('.xt-hero');
      ok(
        (await hero.locator('.xt-chip').innerText()).trim() === 'Chrome et Edge' &&
          (await hero.getByRole('heading', { name: 'Capturez votre logiciel en quelques clics' }).count()) ===
            1 &&
          (await hero.locator('.xt-benefits li').count()) === 3,
        'absente : puce « Chrome et Edge », titre, trois bénéfices',
      );
      const install = hero.getByRole('link', { name: /Installer depuis le Chrome Web Store/ });
      ok(
        (await install.getAttribute('target')) === '_blank' &&
          /noopener/.test((await install.getAttribute('rel')) || '') &&
          (await hero.locator('.fd-btn--primary').count()) === 1,
        'absente : un seul bouton primaire, vers la boutique, dans un nouvel onglet',
      );
      ok(
        (await install.evaluate((el) =>
          [...el.querySelectorAll('svg')].map((x) => x.getAttribute('class')).join(' '),
        )) === 'lucide lucide-arrow-up-right',
        'absente : lien externe, une seule icône (ArrowUpRight) à droite',
      );
      ok(
        (await hero.locator('.xt-help').innerText()) ===
          'Déjà installée ? Rechargez cette page pour la relier à l’espace.' &&
          (await hero.locator('.xt-ill img').count()) === 0,
        'absente : aide « Déjà installée ? », illustration maison (aucune capture de la boutique)',
      );
    } else {
      const soon = page.locator('.xt-soon');
      ok(
        /^Extension TutoClick\s*Bientôt disponible$/.test((await soon.locator('h2').innerText()).trim()) &&
          (await soon.locator('.fd-badge').count()) === 1 &&
          (await page.getByRole('link', { name: /Installer/ }).count()) === 0,
        'absente et pas encore publiée : « Bientôt disponible », aucun lien d’installation',
      );
    }
    ok(
      (await page
        .getByRole('navigation', { name: 'Utilitaires' })
        .getByRole('link', { name: 'Extension' })
        .getAttribute('aria-current')) === 'page' || WIDTH < 1024,
      'barre latérale : « Extension » est un lien, page active',
    );
    ok(await noScroll(page), 'absente : pas de défilement horizontal');
    await shot(page, 'extension-absente');
    await page.context().close();
  }

  // ===== Extension présente, version déclarée, capture connue =====
  {
    const { page, state } = await open((s) => {
      Object.assign(s.tables.profiles[0], {
        extension_seen_at: '2026-11-02T10:00:00Z',
        extension_version: '0.2.0',
        extension_last_capture_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
        extension_last_demo: DEMO,
      });
    });
    const title = state.tables.demos.find((d) => d.id === DEMO).title;
    const ready = page.locator('.xt-ready');
    await ready.waitFor();
    ok(
      (await ready.getByRole('heading', { name: 'L’extension est prête' }).count()) === 1 &&
        /reliée à l’espace Acme\./.test(await ready.innerText()),
      'présente : « L’extension est prête », reliée à l’espace',
    );
    const facts = await page
      .locator('.xt-fact')
      .evaluateAll((l) =>
        l.map((f) => [f.querySelector('dt').textContent, f.querySelector('dd').textContent]),
      );
    ok(
      facts.map((f) => f[0]).join('|') === 'Version|Dernière capture|Raccourci',
      `présente : trois faits (${facts.map((f) => f[0]).join('|')})`,
    );
    ok(/^0\.2\.0 · à jour$/.test(facts[0][1].trim()), `version déclarée et à jour (${facts[0][1]})`);
    await page.waitForFunction(
      (t) => document.querySelectorAll('.xt-fact dd')[1]?.textContent.includes(t),
      title,
    );
    ok(
      /^il y a 2\sh · «\s.+\s»$/.test(await page.locator('.xt-fact dd').nth(1).innerText()),
      `dernière capture : date relative et nom de la démo (${await page.locator('.xt-fact dd').nth(1).innerText()})`,
    );
    ok(
      (await page.locator('.xt-keys kbd').allTextContents()).join('+') === 'Alt+Maj+S',
      'raccourci en touches',
    );
    ok(
      (await page.getByRole('heading', { name: 'Bien capturer' }).count()) === 1 &&
        (await page.locator('.xt-tips li').count()) === 3,
      'présente : « Bien capturer », trois conseils',
    );
    ok(
      (await page.locator('.fd-btn--primary').count()) === 1,
      'présente : un seul bouton primaire, « Capturer une démo »',
    );
    ok(await noScroll(page), 'présente : pas de défilement horizontal');
    await shot(page, 'extension-installee');
    await ready.getByRole('link', { name: 'Capturer une démo' }).click();
    await page.getByRole('dialog', { name: /Nouvelle démo/ }).waitFor();
    ok(true, '« Capturer une démo » ouvre « Nouvelle démo »');
    await page.context().close();
  }

  // ===== Extension présente, publiée avant la déclaration de version =====
  {
    const { page } = await open((s) => {
      s.tables.profiles[0].extension_seen_at = '2026-11-02T10:00:00Z';
    });
    await page.locator('.xt-fact').first().waitFor();
    ok(
      /^0\.2\.0 ou antérieure · /.test((await page.locator('.xt-fact dd').first().innerText()).trim()) &&
        (await page.locator('.xt-fact dd').nth(1).innerText()).trim() === 'Pas encore connue',
      'version non déclarée : « 0.2.0 ou antérieure », dernière capture « Pas encore connue »',
    );
    await page.context().close();
  }

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})();
