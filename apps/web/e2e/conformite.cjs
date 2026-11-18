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
  'PLN-01': { maquette: 'reference/plans.html', route: '/#/settings/plans' },
  'ANA-01': { maquette: 'reference/analytics.html', route: '/#/analytics' },
  'PRM-01': { maquette: 'reference/parametres.html', route: '/#/settings/members' },
  'EDT-01': {
    maquette: 'reference/editeur.html',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit',
    // État de la maquette : hotspot de l'étape sélectionné (panneau Étape › bulle)
    async prepare(p) {
      await p.locator('.canvas-frame [data-canvas-item]').first().click();
      await p.waitForTimeout(300);
      await p.mouse.move(0, 0);
    },
  },
  'EDT-08': {
    maquette: 'reference/editeur.html',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit',
    async maquettePrep(p) {
      await p.locator('#rail .step[data-i="5"]').click();
      await p.waitForTimeout(200);
    },
    // EDT-08 : le formulaire se place dans le rail (avant l'étape 2) et s'édite dans l'onglet Étape
    async prepare(p) {
      await p.getByRole('tab', { name: 'Réglages' }).click();
      await p.getByRole('button', { name: 'Créer le formulaire' }).click();
      await p.waitForSelector('#f-title');
      await p
        .locator('#f-desc')
        .fill('Laissez vos coordonnées, nous vous envoyons l’accès au parcours avancé.');
      await p.waitForTimeout(500);
      await p.mouse.move(0, 0);
    },
  },
  'EDT-09': {
    maquette: 'reference/editeur.html',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit',
    async maquettePrep(p) {
      await p.locator('#rail .step[data-i="7"]').click();
      await p.waitForTimeout(200);
    },
    async prepare(p) {
      await p.locator('.rail-list .step').nth(2).click();
      await p.waitForTimeout(400);
      // Bouton principal activé, pour valider la section « Bouton principal (CTA) »
      await p.locator('#st-cta-on').check();
      await p.locator('#st-cta-l').fill('Réserver une démo');
      await p.locator('#st-cta-u').fill('https://agenda.example.com/demo');
      await p.waitForTimeout(400);
    },
  },
  'EDT-10': {
    maquette: 'reference/editeur.html',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit',
    async maquettePrep(p) {
      await p.locator('#tb-design').click();
      await p.waitForTimeout(200);
    },
    async prepare(p) {
      await p.getByRole('tab', { name: 'Design' }).click();
      await p.waitForTimeout(400);
    },
  },
  'EDT-11': {
    maquette: 'reference/editeur.html',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit',
    async maquettePrep(p) {
      await p.locator('#tb-settings').click();
      await p.waitForTimeout(200);
    },
    async prepare(p) {
      await p.getByRole('tab', { name: 'Réglages' }).click();
      await p.waitForTimeout(400);
    },
  },
  'PLY-01': {
    maquette: 'refonte/player.html?view=etape',
    player: true,
  },
  'PLY-01-formulaire': {
    maquette: 'refonte/player.html?view=formulaire',
    player: true,
    async prepare(p) {
      for (let i = 0; i < 2; i++) {
        await p.locator('.p-tip .p-btn-primary, .p-sheet .p-btn-primary').click();
        await p.waitForTimeout(500);
      }
    },
  },
  'PLY-01-fin': {
    maquette: 'refonte/player.html?view=fin',
    player: true,
    async prepare(p) {
      for (let i = 0; i < 6; i++) {
        await p.locator('.p-tip .p-btn-primary, .p-sheet .p-btn-primary').click();
        await p.waitForTimeout(400);
        if (await p.locator('.p-form').count()) {
          await p.locator('.p-form input[type=email]').fill('lea@example.com');
          await p.locator('.p-form input[type=checkbox]').check();
          await p.locator('.p-form button[type=submit]').click();
          await p.waitForTimeout(500);
        }
      }
    },
  },
  'PLY-01-mobile': {
    maquette: 'refonte/player.html?view=etape',
    player: true,
    view: { width: 390, height: 844 },
  },
  'PLY-01-mobile-formulaire': {
    maquette: 'refonte/player.html?view=formulaire',
    player: true,
    view: { width: 390, height: 844 },
    prepare: (p) => SCREENS['PLY-01-formulaire'].prepare(p),
  },
  'PLY-01-mobile-fin': {
    maquette: 'refonte/player.html?view=fin',
    player: true,
    view: { width: 390, height: 844 },
    prepare: (p) => SCREENS['PLY-01-fin'].prepare(p),
  },
  'PRT-01': {
    maquette: 'reference/partage.html',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/share',
  },
  'PRT-02': {
    maquette: 'reference/partage.html',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/share',
    async maquettePrep(p) {
      await p.locator('#tab-embed').click();
      await p.waitForTimeout(200);
    },
    async prepare(p) {
      await p.getByRole('tab', { name: 'Intégrer' }).click();
      await p.waitForTimeout(300);
    },
  },
  'CNX-01': {
    maquette: 'reference/connexion.html',
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
    maquette: 'reference/inscription.html',
    route: '/#/signup',
    signedOut: true,
    // État de la maquette : mot de passe saisi (robustesse « bonne »), autres champs vides
    async prepare(p) {
      await p.fill('#password', 'Demo-2026!');
      await p.locator('#password').blur();
    },
  },
  'ONB-01': {
    maquette: 'reference/onboarding.html',
    route: '/#/onboarding',
    // État de la maquette : étape 1, nom de l'espace saisi, « Site web » choisi
    async prepare(p) {
      await p.fill('#ws-name', 'Acme Analytics');
      await p.locator('#ws-name').blur();
    },
  },
  'ONB-02': {
    maquette: 'reference/onboarding.html',
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
    maquette: 'reference/onboarding.html',
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

async function shotMaquette(b, file, theme, prep, view = VIEW) {
  const p = await b.newPage({ viewport: view });
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

const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';

/** Lecteur (PLY-01) : manifeste de la maquette servi à la place du stockage. */
async function shotPlayer(b, s, theme) {
  const manifest = require('./player-maquette.cjs');
  const p = await b.newPage({ viewport: s.view || VIEW, colorScheme: theme });
  await p.route('**/latest.json', (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(manifest),
      headers: { 'access-control-allow-origin': '*' },
    }),
  );
  await p.route('**/assets/a.webp', (r) =>
    r.fulfill({ contentType: 'image/png', body: fs.readFileSync(path.join(__dirname, 'fixture.png')) }),
  );
  await p.route('**/rest/v1/rpc/**', (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: '"ok"',
      headers: { 'access-control-allow-origin': '*' },
    }),
  );
  await p.route('**/functions/v1/**', (r) =>
    r.fulfill({ status: 200, body: '{}', headers: { 'access-control-allow-origin': '*' } }),
  );
  await p.goto(`${PLAYER}/#/d/${manifest.demoId}`);
  await p.waitForSelector('.p-stage');
  await p.waitForTimeout(900);
  if (s.prepare) await s.prepare(p);
  await p.mouse.move(0, 0);
  const buf = await p.screenshot();
  await p.close();
  return buf;
}

async function shotApp(b, s, theme) {
  if (s.player) return shotPlayer(b, s, theme);
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

async function sideBySide(b, left, right, label, view = VIEW) {
  const p = await b.newPage({ viewport: { width: view.width * 2 + 48, height: view.height + 64 } });
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
      const left = await shotMaquette(b, s.maquette, theme, s.maquettePrep, s.view);
      const right = await shotApp(b, s, theme);
      // Capture de l'app seule (téléversée dans l'outil de suivi « Conformité TutoClick »)
      fs.writeFileSync(path.join(OUT, `${name}-app-${theme === 'light' ? 'clair' : 'sombre'}.png`), right);
      fs.writeFileSync(
        path.join(OUT, `${name}-${theme === 'light' ? 'clair' : 'sombre'}.png`),
        await sideBySide(b, left, right, `${name} (${theme === 'light' ? 'clair' : 'sombre'})`, s.view),
      );
      console.log(`ok - ${name} (${theme})`);
    }
  }
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
