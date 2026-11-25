/**
 * Éditeur : états sans contenu. En erreur de chargement, la barre ne garde que « ← Démos » (rien d'autre
 * n'est utilisable) et la carte d'erreur est centrée ; pendant le chargement, la barre a la structure de la
 * barre réelle (gauche · onglets · droite) avec ses actions désactivées. Ces écrans, comme l'éditeur sur
 * petit écran, sont sur le fond du contenu. Données fictives.
 * Usage : [THEME=dark] node e2e/editeur-erreur.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const open = async (prepare, width = 1440) => {
    const page = await (await themedContext(b, { viewport: { width, height: 900 } })).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    const state = seed();
    prepare(state);
    await install(page, state);
    await page.goto(`${APP}/#/demos/${DEMO}/edit`);
    return page;
  };
  /** Le fond de l'écran est celui du contenu (jamais le fond bleuté de la page). */
  const onContent = (page) =>
    page.evaluate(() => {
      const probe = document.createElement('i');
      probe.style.background = 'var(--fd-color-content-bg)';
      document.body.append(probe);
      const want = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return getComputedStyle(document.querySelector('main')).backgroundColor === want;
    });

  // ===== Erreur de chargement =====
  {
    const page = await open((d) => {
      d.homeFail = true;
    });
    const alert = page.getByRole('alert');
    await alert.waitFor();
    const bar = page.locator('.ed-bar');
    ok(
      (await bar.getByRole('link').count()) === 1 &&
        (await bar.getByRole('link', { name: 'Retour aux démos' }).count()) === 1 &&
        (await bar.getByRole('button').count()) === 0,
      'erreur : la barre ne garde que « ← Démos »',
    );
    const [a, v] = [await alert.boundingBox(), page.viewportSize()];
    ok(
      Math.abs(a.x + a.width / 2 - v.width / 2) <= 2 && a.y > (await bar.boundingBox()).height,
      'erreur : la carte est centrée, sous la barre',
    );
    ok(await onContent(page), 'erreur : fond du contenu');
    await page.context().close();
  }

  // ===== Chargement : même structure que la barre réelle, actions désactivées =====
  {
    const page = await open((d) => {
      d.homeDelay = 20_000;
    });
    const bar = page.locator('.ed-bar');
    await bar.locator('.ed-bar__r').waitFor();
    const cols = await bar.evaluate((el) =>
      [...el.children]
        .filter((c) => c.getBoundingClientRect().width > 0)
        .map((c) => ({
          cls: c.className.split(' ')[0],
          top: Math.round(c.getBoundingClientRect().top),
          bottom: Math.round(c.getBoundingClientRect().bottom),
        })),
    );
    const box = await bar.boundingBox();
    ok(
      cols.map((c) => c.cls).join('|') === 'ed-bar__l|ed-tabs|ed-bar__r' &&
        cols.every((c) => c.top >= box.y && c.bottom <= box.y + box.height + 1),
      `chargement : gauche · onglets · droite, tout dans la barre (${JSON.stringify(cols)})`,
    );
    ok(
      await bar.getByRole('button').evaluateAll((l) => l.length >= 4 && l.every((x) => x.disabled)),
      'chargement : les actions de la barre sont désactivées',
    );
    const pub = await bar.getByRole('button', { name: 'Publier' }).boundingBox();
    ok(pub.x + pub.width > box.width - 40, 'chargement : « Publier » est à droite de la barre');
    await page.context().close();
  }

  // ===== Petit écran : « L'éditeur s'utilise sur ordinateur », sur le fond du contenu =====
  {
    const page = await open(() => {}, 390);
    await page.getByRole('heading', { name: 'L’éditeur s’utilise sur ordinateur' }).waitFor();
    ok(await onContent(page), 'petit écran : fond du contenu');
    await page.context().close();
  }

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})();
