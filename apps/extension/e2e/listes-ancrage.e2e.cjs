/**
 * Retours client sur l'extension 0.3.3 (récidive) : toutes les listes de l'extension s'ouvrent COLLÉES à
 * leur champ, à 4 px (dessous, ou dessus s'il n'y a pas la place), alignées sur lui, même quand le contenu
 * du popup a défilé. Couvre chaque liste déroulante du popup (createSelect) et le menu ⋯.
 * Prérequis : node e2e/mock-supabase.cjs, build WXT_E2E=1. Usage : node e2e/listes-ancrage.e2e.cjs [SHOTS_DIR=…]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const SHOTS = process.env.SHOTS_DIR;

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};

/** Écart entre le champ et sa liste ouverte, côté et alignement. */
async function mesure(popup, buttonSel, listSel) {
  return popup.evaluate(
    ([b, l]) => {
      const br = document.querySelector(b).getBoundingClientRect();
      const lr = document.querySelector(l).getBoundingClientRect();
      const below = lr.top >= br.bottom - 1;
      return {
        side: below ? 'dessous' : 'dessus',
        gap: Math.round((below ? lr.top - br.bottom : br.top - lr.bottom) * 10) / 10,
        // Alignée sur le champ : même bord gauche, ou même bord droit (liste plus large qu'un petit champ)
        aligned: Math.abs(lr.left - br.left) <= 1 || Math.abs(lr.right - br.right) <= 1,
        inside: lr.top >= 0 && lr.bottom <= innerHeight + 1 && lr.left >= 0 && lr.right <= innerWidth + 1,
      };
    },
    [buttonSel, listSel],
  );
}

(async () => {
  const ext = path.resolve(__dirname, '../.output/chrome-mv3');
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'fd-ext-')), {
    headless: true,
    locale: 'fr-FR',
    channel: 'chromium',
    viewport: { width: 360, height: 600 },
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2];
  const popup = await ctx.newPage();
  const errors = [];
  popup.on('pageerror', (e) => errors.push(e.message));
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.waitForSelector('#login:not([hidden])');
  await popup.fill('#email', 'a@b.c');
  await popup.fill('#password', 'x');
  await popup.click('button[form=login]');
  await popup.waitForSelector('#setup:not([hidden])');

  const verifier = async (nom, button, list) => {
    await popup.click(button);
    await popup.waitForSelector(`${list}:not([hidden])`);
    await popup.waitForTimeout(150);
    const m = await mesure(popup, button, list);
    ok(
      Math.abs(m.gap - 4) <= 1 && m.aligned && m.inside,
      `${nom} : ouverte ${m.side}, à ${m.gap} px de son champ, alignée, visible (${JSON.stringify(m)})`,
    );
    if (SHOTS) await popup.screenshot({ path: `${SHOTS}/liste-${nom.replace(/\W+/g, '-')}.png` });
    await popup.keyboard.press('Escape');
    await popup.waitForTimeout(100);
  };

  // Toutes les listes déroulantes du popup, dans chaque vue où elles sont visibles
  const listes = async () =>
    popup.evaluate(() =>
      [...document.querySelectorAll('button.sel[aria-haspopup="listbox"]')]
        .filter((b) => b.getBoundingClientRect().width > 0)
        .map((b) => `#${b.id}`),
    );
  const vues = [];
  // Vue principale (destination, espace…)
  for (const b of await listes()) {
    vues.push(b);
    await verifier(`principale ${b}`, b, `${b} + [role=listbox]`);
  }
  // Menu ⋯
  await verifier('menu ⋯', '#more', '#more-menu');
  // Réglages de capture (« Cadre par défaut » : défaut signalé par le client)
  await popup.click('#open-prefs');
  await popup.waitForSelector('#settings-t');
  for (const b of await listes()) {
    vues.push(b);
    await verifier(`réglages ${b}`, b, `${b} + [role=listbox]`);
  }
  ok(vues.includes('#frame'), `« Cadre par défaut » couvert (${vues.join(', ')})`);
  // Contenu défilé : la liste reste collée à son champ
  await popup.evaluate(() => {
    document.body.style.minHeight = '1400px';
    scrollTo(0, 120);
  });
  await verifier('réglages #frame, après défilement', '#frame', '#frame + [role=listbox]');
  ok(errors.length === 0, `aucune erreur (${errors.join(' | ')})`);
  await ctx.close();
})();
