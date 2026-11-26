/**
 * Planche UX « Vérifier avant l'envoi » d'un Sandbox vivant (docs/ux/propositions/sandbox-vivant-verification).
 * Capture RÉELLE sur le banc avec l'extension construite et chargée, en mode Sandbox, puis contrôles dans
 * l'écran de vérification, en clair et en sombre :
 *  1. aucun texte de la copie inerte (« copie fixe », « non copié ») ;
 *  2. un seul groupe « Scripts » ; ni « Scripts de la page » ni « Scripts de suivi » ;
 *  3. « Garder » sur un script d'un autre site : pastille « Gardé » (orange), « Gardés par vous » +1,
 *     l'élément ajouté par ce script passe d'« Absent » à « Affiché » ;
 *  4. les réponses du site forment leur propre groupe, aucune ligne de réponse dans les scripts ;
 *  5. axe : aucune violation sérieuse.
 * Prérequis : node e2e/mock-supabase.cjs, node e2e/banc/serveur.cjs, build WXT_E2E=1.
 * Usage : node e2e/banc/verification-vivant.cjs [SHOTS_DIR=…]
 */
const path = require('path');
const { capturer } = require('./etat-html.cjs');
const { SITES } = require('./mesure-sandbox.cjs');
const { default: AxeBuilder } = require(
  require.resolve('@axe-core/playwright', { paths: [path.resolve(__dirname, '../../../web')] }),
);
const MOCK = 'http://localhost:54400';
const SHOTS = process.env.SHOTS_DIR;

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};

const titres = (review) => review.locator('section.grp h2').allInnerTexts();
const compteur = async (review, label) =>
  Number(
    await review
      .locator('#sumbar > div')
      .filter({ has: review.locator('dt', { hasText: label }) })
      .locator('dd')
      .innerText(),
  );
const ouvrir = async (region, nom) => {
  const b = region.getByRole('button', { name: `Voir : ${nom}` });
  if (await b.count()) await b.click();
};

async function communs(review, theme, site) {
  await review.emulateMedia({ colorScheme: theme });
  await review.waitForTimeout(200);
  const texte = await review.locator('main').innerText();
  ok(
    !/copie fixe|non copi|n’en a pas besoin/i.test(texte),
    `${site} · ${theme} : aucun texte de la copie inerte`,
  );
  const t = await titres(review);
  ok(
    t.filter((x) => x === 'Scripts').length === 1 &&
      !t.includes('Scripts de la page') &&
      !t.includes('Scripts de suivi') &&
      !t.includes('Sandbox vivant'),
    `${site} · ${theme} : un seul groupe « Scripts » (${t.join(' · ')})`,
  );
  const cellules = await review.locator('#sumbar dt').allInnerTexts();
  ok(
    cellules.join('|') === 'Pages copiées|Scripts rejoués|Scripts bloqués|Gardés par vous',
    `${site} · ${theme} : compteurs ${cellules.join(' · ')}`,
  );
  const axe = await new AxeBuilder({ page: review }).analyze();
  const bad = axe.violations.filter((x) => ['serious', 'critical'].includes(x.impact));
  ok(
    bad.length === 0,
    `${site} · ${theme} : axe, aucune violation sérieuse (${bad.map((x) => `${x.id} ${x.nodes[0]?.target}`).join(' ; ')})`,
  );
}

async function tiers(review) {
  await review.click('#kind [data-kind="sandbox"]');
  await review.getByRole('region', { name: 'Scripts', exact: true }).waitFor();
  await communs(review, 'light', 'tiers');
  const scripts = review.getByRole('region', { name: 'Scripts', exact: true });
  await ouvrir(scripts, 'Scripts');
  const widgets = review.getByRole('region', { name: 'Éléments ajoutés par un script', exact: true });
  await ouvrir(widgets, 'Éléments ajoutés par un script');
  const chat = scripts.locator('li.el2').filter({ hasText: 'chat.js' }).first();
  const widget = widgets.locator('li.el2').filter({ hasText: 'Discuter avec nous' }).first();
  const avant = {
    pastille: (await chat.locator('.st2').innerText()).trim(),
    widget: (await widget.locator('.st2').innerText()).trim(),
    meta: (await widget.locator('.mu').innerText()).trim(),
    gardes: await compteur(review, 'Gardés par vous'),
    lignes: (await scripts.locator('li.el2').allInnerTexts()).join(' | '),
  };
  ok(
    avant.pastille === 'Bloqué' &&
      avant.widget === 'Absent' &&
      /^Ajouté par localhost:54411\/chat\.js/.test(avant.meta),
    `tiers : chat.js « Bloqué », élément « Absent », « ${avant.meta} »`,
  );
  ok(
    !/Réponses du site/.test(avant.lignes) && (await scripts.locator('.st2.kp').count()) === 0,
    'tiers : pastilles neutres par défaut, aucune ligne de réponse dans les scripts',
  );
  if (SHOTS)
    await review.screenshot({ path: `${SHOTS}/verification-vivant-tiers-clair.png`, fullPage: true });
  await chat.getByRole('button', { name: /^Garder/ }).click();
  await review.waitForTimeout(150);
  const chat2 = scripts.locator('li.el2').filter({ hasText: 'chat.js' }).first();
  const widget2 = widgets.locator('li.el2').filter({ hasText: 'Discuter avec nous' }).first();
  const apres = {
    pastille: (await chat2.locator('.st2').innerText()).trim(),
    orange: (await chat2.locator('.st2.kp').count()) === 1,
    widget: (await widget2.locator('.st2').innerText()).trim(),
    widgetOrange: (await widget2.locator('.st2.kp').count()) === 1,
    gardes: await compteur(review, 'Gardés par vous'),
    focus: await review.evaluate(() => document.activeElement?.textContent?.trim()),
  };
  ok(
    apres.pastille === 'Gardé' && apres.orange && apres.gardes === avant.gardes + 1,
    `tiers : « Garder » → pastille « Gardé » orange, « Gardés par vous » ${avant.gardes} → ${apres.gardes}`,
  );
  ok(
    apres.widget === 'Affiché' && apres.widgetOrange,
    `tiers : l’élément ajouté par chat.js passe d’« Absent » à « Affiché »`,
  );
  ok(apres.focus === 'Bloquer', `tiers : le focus reste sur le bouton de la ligne (« ${apres.focus} »)`);
  const note = await review.locator('#note').innerText();
  ok(
    /scripts? d’autres? sites? (est|sont) bloqués?/.test(note) && /succès fictif/.test(note),
    `tiers : note « ${note} »`,
  );
  await communs(review, 'dark', 'tiers');
  if (SHOTS)
    await review.screenshot({ path: `${SHOTS}/verification-vivant-tiers-sombre.png`, fullPage: true });
}

async function spa(review) {
  await review.click('#kind [data-kind="sandbox"]');
  await review.getByRole('region', { name: 'Scripts', exact: true }).waitFor();
  await communs(review, 'light', 'spa');
  const t = await titres(review);
  const iS = t.indexOf('Scripts');
  const iR = t.indexOf('Réponses du site');
  ok(
    iR === iS + 1,
    `spa : « Réponses du site » est un groupe à part, juste après « Scripts » (${t.join(' · ')})`,
  );
  const rep = review.getByRole('region', { name: 'Réponses du site', exact: true });
  await ouvrir(rep, 'Réponses du site');
  const lignes = await rep.locator('li.el2').allInnerTexts();
  ok(
    lignes.length >= 1 &&
      lignes.every(
        (l) =>
          /réponses? lues? par la page · (\d+ données? remplacées?|aucune donnée personnelle)/.test(l) &&
          /Rejouées/.test(l),
      ) &&
      (await rep.locator('li.el2 button.ac2').count()) === 0,
    `spa : une ligne par page, « n réponses lues · données », pastille « Rejouées », sans action (${lignes.map((l) => l.replace(/\s+/g, ' ')).join(' | ')})`,
  );
  const scripts = review.getByRole('region', { name: 'Scripts', exact: true });
  await ouvrir(scripts, 'Scripts');
  ok(
    !(await scripts.locator('li.el2').allInnerTexts()).some((l) =>
      /Réponses du site|réponses? lues?/.test(l),
    ),
    'spa : aucune ligne de réponse dans les scripts',
  );
  if (SHOTS) await review.screenshot({ path: `${SHOTS}/verification-vivant-spa-clair.png`, fullPage: true });
  await communs(review, 'dark', 'spa');
  if (SHOTS) await review.screenshot({ path: `${SHOTS}/verification-vivant-spa-sombre.png`, fullPage: true });
}

(async () => {
  await fetch(`${MOCK}/__html-capture`, {
    method: 'POST',
    body: JSON.stringify({ mode: 'allowed', domains: [] }),
  });
  await fetch(`${MOCK}/__sandbox-live`, { method: 'POST', body: 'true' });
  for (const [id, fn] of [
    ['tiers', tiers],
    ['spa', spa],
  ]) {
    const s = SITES.find((x) => x.id === id);
    let fini = false;
    const r = await capturer(
      { ...s, gestes: s.capture },
      async (review) => {
        await fn(review);
        fini = true;
      },
      { kind: 'sandbox' },
    );
    ok(fini && !r.erreur, `${id} : capture et vérification sans erreur${r.erreur ? ` (${r.erreur})` : ''}`);
  }
})();
