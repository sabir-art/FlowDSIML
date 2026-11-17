/**
 * Conformité aux maquettes (règle D13) : pour chaque écran, capture la maquette d'origine et l'app
 * dans le même état (mêmes données, 1440×900, clair et sombre), puis produit une image côte à côte
 * « Maquette | App » dans docs/tech/conformite/<écran>-<thème>.png.
 * Usage : app web lancée (APP_URL), puis `node e2e/conformite.cjs [écran…]`.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { install } = require('./fake-supabase.cjs');
const { seedMaquette } = require('./maquette-data.cjs');

const APP = process.env.APP_URL || 'http://localhost:5173';
const MAQ = path.resolve(__dirname, '../../../docs/ux/maquettes');
const OUT = path.resolve(__dirname, '../../../docs/tech/conformite');
const VIEW = { width: 1440, height: 900 };

/** Écrans : maquette (fichier + préparation) et route de l'app. */
// Choix du client par écran (outil de suivi « Conformité TutoClick ») : maquette d'origine
// (docs/ux/maquettes/*.html) ou refonte (docs/ux/maquettes/refonte/*.html).
const SCREENS = {
  'CAD-01': { maquette: 'refonte/dashboard.html', route: '/#/' },
  'DSH-01': { maquette: 'refonte/dashboard.html', route: '/#/' },
  'PLN-01': { maquette: 'plans.html', route: '/#/settings/plans' },
  'CNX-01': {
    maquette: 'connexion.html',
    route: '/#/login',
    signedOut: true,
    // État de la maquette : identifiants saisis, refusés (message sous le mot de passe)
    async prepare(p) {
      await p.fill('#email', 'camille@acme.example');
      await p.fill('#password', 'motdepasse');
      await p.click('button[type=submit]');
      await p.waitForSelector('#login-error');
      await p.fill('#password', 'motdepasse');
      await p.locator('#password').blur();
    },
  },
  'INS-01': {
    maquette: 'inscription.html',
    route: '/#/signup',
    signedOut: true,
    // État de la maquette : mot de passe saisi (robustesse « bonne »), autres champs vides
    async prepare(p) {
      await p.fill('#password', 'Demo-2026!');
      await p.locator('#password').blur();
    },
  },
  'ONB-01': {
    maquette: 'onboarding.html',
    route: '/#/onboarding',
    // État de la maquette : étape 1, nom de l'espace saisi, « Site web » choisi
    async prepare(p) {
      await p.fill('#ws-name', 'Acme Analytics');
      await p.locator('#ws-name').blur();
    },
  },
  'ONB-02': {
    maquette: 'onboarding.html',
    maquettePrep: (p) => p.click('#p1 [data-next="2"]'),
    route: '/#/onboarding',
    async prepare(p) {
      await p.fill('#ws-name', 'Acme Analytics');
      await p.click('button[type=submit]');
      await p.waitForSelector('#ob-h2');
      await p.mouse.move(0, 0);
    },
  },
  'ONB-03': {
    maquette: 'onboarding.html',
    maquettePrep: async (p) => {
      await p.click('#p1 [data-next="2"]');
      await p.click('#p2 [data-next="3"]');
      await p.mouse.move(0, 0);
    },
    route: '/#/onboarding',
    async prepare(p) {
      await p.fill('#ws-name', 'Acme Analytics');
      await p.click('button[type=submit]');
      await p.waitForSelector('#ob-h2');
      await p.getByRole('button', { name: 'J’ai installé l’extension' }).click();
      await p.waitForTimeout(600);
      await p.mouse.move(0, 0);
    },
  },
};

async function shotMaquette(b, file, theme, prep) {
  const p = await b.newPage({ viewport: VIEW });
  await p.goto(`file://${MAQ}/${file}${file.includes('?') ? '&' : '?'}theme=${theme}`);
  await p.evaluate((th) => {
    document.documentElement.dataset.theme = th;
    document.querySelector('.mock-nav')?.remove();
    // bascule clair / sombre des maquettes de refonte
    document.querySelector('[data-theme-set]')?.parentElement?.remove();
  }, theme);
  await p.waitForTimeout(500);
  if (prep) await prep(p);
  const buf = await p.screenshot();
  await p.close();
  return buf;
}

async function shotApp(b, s, theme) {
  const p = await b.newPage({ viewport: VIEW });
  await p.addInitScript((th) => {
    try {
      localStorage.setItem('fd.theme', th);
    } catch {}
  }, theme);
  await install(p, { ...seedMaquette(), signedOut: Boolean(s.signedOut) });
  await p.goto(`${APP}${s.route}`);
  await p.waitForTimeout(1800);
  if (s.prepare) await s.prepare(p);
  const buf = await p.screenshot();
  await p.close();
  return buf;
}

async function sideBySide(b, left, right, label) {
  const p = await b.newPage({ viewport: { width: VIEW.width * 2 + 48, height: VIEW.height + 64 } });
  const img = (buf) => `data:image/png;base64,${buf.toString('base64')}`;
  await p.setContent(`<!doctype html><html><body style="margin:0;font:600 18px system-ui;background:#888">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px">
      <div><div style="color:#fff;margin:0 0 8px">Maquette · ${label}</div><img src="${img(left)}" style="width:100%;display:block"></div>
      <div><div style="color:#fff;margin:0 0 8px">App · ${label}</div><img src="${img(right)}" style="width:100%;display:block"></div>
    </div></body></html>`);
  const buf = await p.screenshot({ fullPage: true });
  await p.close();
  return buf;
}

(async () => {
  const only = process.argv.slice(2);
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  for (const [name, s] of Object.entries(SCREENS)) {
    if (only.length && !only.includes(name)) continue;
    for (const theme of ['light', 'dark']) {
      const left = await shotMaquette(b, s.maquette, theme, s.maquettePrep);
      const right = await shotApp(b, s, theme);
      // Capture de l'app seule (téléversée dans l'outil de suivi « Conformité TutoClick »)
      fs.writeFileSync(path.join(OUT, `${name}-app-${theme === 'light' ? 'clair' : 'sombre'}.png`), right);
      fs.writeFileSync(
        path.join(OUT, `${name}-${theme === 'light' ? 'clair' : 'sombre'}.png`),
        await sideBySide(b, left, right, `${name} (${theme === 'light' ? 'clair' : 'sombre'})`),
      );
      console.log(`ok - ${name} (${theme})`);
    }
  }
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
