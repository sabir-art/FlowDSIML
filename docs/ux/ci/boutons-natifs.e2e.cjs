/**
 * Contrôle CI : aucun bouton visible ne garde l'apparence native du navigateur (composants.md §18.1).
 * À copier dans apps/web/e2e/ et à lancer en CI comme les autres e2e. Données fictives (faux Supabase).
 *
 * Un bouton est « natif » si l'un de ces critères est vrai (styles calculés) :
 *  - sa police n'est pas celle de <body> (le navigateur met Arial ou system-ui sur <button> sans style) ;
 *  - sa bordure est en relief (outset ou inset) ;
 *  - son fond est celui du navigateur : rgb(239, 239, 239) en clair, rgb(107, 107, 107) en sombre (Chromium).
 * Éléments vérifiés : button, [role="button"], input[type=button|submit|reset], visibles (taille non nulle).
 * Pages : toutes les routes de l'app, en clair et en sombre, plus les dialogues qui ont déjà eu le défaut.
 * Usage : node e2e/boutons-natifs.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';

const ROUTES = [
  '/',
  '/sandbox',
  '/analytics',
  '/leads',
  '/learners',
  '/center',
  '/nouveautes',
  '/settings/workspace',
  '/settings/members',
  '/settings/usage',
  '/settings/security',
  '/settings/privacy',
  '/settings/brand',
  '/settings/brand/page',
  '/settings/variables',
  '/settings/glossary',
  '/settings/ai',
  '/settings/integrations',
  '/settings/integrations/webhooks',
  '/settings/profile',
  '/settings/plans',
  '/demos/0b5c1f0e-0000-4000-8000-000000000001/edit',
  '/demos/0b5c1f0e-0000-4000-8000-000000000001/share',
  '/demos/0b5c1f0e-0000-4000-8000-000000000001/analytics',
];

/** Dialogues ouverts après le chargement de la route ; chaque étape est un clic sur un nom accessible. */
const DIALOGS = [
  { route: '/', label: 'Installer l’extension', open: [['button', 'Extension']] },
  { route: '/', label: 'Nouvelle démo', open: [['button', 'Nouvelle démo']] },
  { route: '/settings/ai', label: 'Activer l’Assistance IA', open: [['switch', null]] },
];

const audit = (page) =>
  page.evaluate(() => {
    const appFont = getComputedStyle(document.body).fontFamily.split(',')[0].trim();
    const UA_BG = ['rgb(239, 239, 239)', 'rgb(107, 107, 107)'];
    return [
      ...document.querySelectorAll(
        'button, [role="button"], input[type=button], input[type=submit], input[type=reset]',
      ),
    ]
      .filter((b) => {
        const r = b.getBoundingClientRect();
        const s = getComputedStyle(b);
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
      })
      .map((b) => {
        const s = getComputedStyle(b);
        const why = [];
        // La police ne compte que si le bouton affiche du texte (un bouton à icône seule n'en montre pas).
        if (b.innerText.trim() && s.fontFamily.split(',')[0].trim() !== appFont)
          why.push(`police ${s.fontFamily.split(',')[0]}`);
        if (/outset|inset/.test(s.borderTopStyle)) why.push(`bordure ${s.borderTopStyle}`);
        if (UA_BG.includes(s.backgroundColor)) why.push(`fond ${s.backgroundColor}`);
        const name = (b.getAttribute('aria-label') || b.innerText || b.value || '')
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 50);
        return { name, cls: String(b.className || '(aucune classe)'), why };
      })
      .filter((x) => x.why.length);
  });

(async () => {
  const b = await chromium.launch();
  let bad = 0;
  const report = (where, list) => {
    for (const x of list) {
      bad++;
      console.log(`NOT OK - ${where} : bouton natif « ${x.name} » (.${x.cls}) : ${x.why.join(', ')}`);
    }
    if (!list.length) console.log(`ok - ${where} : aucun bouton natif`);
  };
  for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'fr-FR',
      colorScheme: scheme,
    });
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem('fd.theme', t);
      } catch {
        /* indisponible */
      }
    }, scheme);
    const page = await ctx.newPage();
    await install(page, seed());
    for (const r of ROUTES) {
      await page.goto(`${APP}/#${r}`);
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(600);
      report(`${scheme} ${r}`, await audit(page));
    }
    for (const d of DIALOGS) {
      // Page neuve pour chaque dialogue : l'état laissé par la route précédente ne doit pas compter.
      const page = await ctx.newPage();
      await install(page, seed());
      await page.goto(`${APP}/#${d.route}`);
      await page.waitForTimeout(800);
      for (const [role, name] of d.open) {
        const loc = name ? page.getByRole(role, { name, exact: true }) : page.getByRole(role);
        await loc.first().click();
      }
      // Attend un vrai dialogue modal ouvert (et non un élément role="dialog" déjà présent dans la page).
      await page.waitForFunction(
        (label) =>
          [...document.querySelectorAll('dialog[open], [role="dialog"][aria-modal="true"]')].some((el) =>
            el.textContent.includes(label),
          ),
        d.label,
      );
      await page.waitForTimeout(300);
      report(`${scheme} dialogue « ${d.label} »`, await audit(page));
      await page.close();
    }
    await ctx.close();
  }
  await b.close();
  if (bad) process.exitCode = 1;
  console.log(bad ? `${bad} bouton(s) natif(s)` : 'aucun bouton natif');
})();
