/**
 * Contrôle CI : aucun bouton visible ne garde l'apparence native du navigateur (composants.md §18.1).
 * Critères et dialogues repris de docs/ux/ci/boutons-natifs.e2e.cjs (Lead UX), sur les 105 pages de
 * a11y.e2e.cjs (app, lecteur, centre), en clair et en sombre.
 *
 * Un bouton est « natif » si l'un de ces critères est vrai (styles calculés) :
 *  - il affiche du texte et sa police n'est pas celle de son parent (un <button> sans style ne l'hérite pas : Arial
 *    ou system-ui). Le parent plutôt que <body> : une page publique peut avoir la police de sa marque ;
 *  - il affiche du texte dans une police par défaut du navigateur (Arial, system-ui…) alors que la page en a une
 *    autre : le cas où le parent est lui-même sans style (L48-02, le critère précédent ne le voyait pas) ;
 *  - sa bordure est en relief (outset ou inset) ;
 *  - son fond est celui du navigateur : rgb(239, 239, 239) en clair, rgb(107, 107, 107) en sombre (Chromium).
 * Éléments vérifiés : button, [role="button"], input[type=button|submit|reset], visibles (taille non nulle).
 * Usage : app web (:5173) et player (:5174) lancés, puis `node e2e/boutons-natifs.e2e.cjs [filtre…]`.
 */
const { chromium } = require('playwright');
const { APP_PAGES, PLAYER_PAGES, appPage, playerPage } = require('./a11y.e2e.cjs');

/** Dialogues qui ont déjà eu le défaut (ouverts après le chargement de la page). */
const DIALOGS = [
  {
    name: 'Dialogue Extension TutoClick',
    route: '/#/',
    open: async (p) => {
      await p
        .getByRole('navigation', { name: 'Utilitaires' })
        .getByRole('button', { name: 'Extension' })
        .click();
      await p.getByRole('dialog', { name: /Extension TutoClick|Installer l’extension/ }).waitFor();
    },
  },
  {
    name: 'Dialogue Nouvelle démo',
    route: '/#/',
    open: async (p) => {
      await p.getByRole('button', { name: 'Nouvelle démo' }).first().click();
      await p.locator('dialog.new-demo-dialog[open]').waitFor();
    },
  },
  {
    // L52 §7 : Démos avec le sélecteur d'étiquettes ouvert depuis la carte
    name: 'Démos · sélecteur d’étiquettes',
    route: '/#/',
    open: async (p) => {
      await p.locator('.demo-card').first().hover();
      await p.locator('.demo-card .tg-line').first().click();
      await p.locator('.tg-card .tg-pop').waitFor();
    },
  },
  {
    name: 'Dialogue Activer l’Assistance IA',
    route: '/#/settings/ai',
    open: async (p) => {
      await p.getByRole('switch', { name: 'Activer l’Assistance IA pour cet espace' }).click();
      await p.getByRole('dialog', { name: 'Activer l’Assistance IA ?' }).waitFor();
    },
  },
];

/** Dans la page : boutons et groupes de champs visibles dont le rendu reste celui du navigateur. */
function natives() {
  const first = (el) => getComputedStyle(el).fontFamily.split(',')[0].trim();
  const UA_FONT =
    /^["']?(arial|helvetica|system-ui|-apple-system|sans-serif|serif|times new roman|times)["']?$/i;
  const pageFont = first(document.body);
  const UA_BG = ['rgb(239, 239, 239)', 'rgb(107, 107, 107)'];
  const sel = 'button, [role="button"], input[type=button], input[type=submit], input[type=reset]';
  const out = [];
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
    const why = [];
    // La police ne compte que si le bouton affiche du texte (un bouton à icône seule n'en montre pas)
    const parent = el.parentElement || document.body;
    const text = (el.innerText || el.value || '').trim();
    if (text && first(el) !== first(parent)) why.push(`police ${cs.fontFamily.split(',')[0]}`);
    else if (text && UA_FONT.test(first(el)) && !UA_FONT.test(pageFont))
      why.push(`police du navigateur ${cs.fontFamily.split(',')[0]}`);
    if (/outset|inset/.test(cs.borderTopStyle)) why.push(`bordure ${cs.borderTopStyle}`);
    if (UA_BG.includes(cs.backgroundColor)) why.push(`fond ${cs.backgroundColor}`);
    if (!why.length) continue;
    const name = (el.getAttribute('aria-label') || el.innerText || el.value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 50);
    out.push({ name, cls: String(el.className || '(aucune classe)'), why: why.join(', ') });
  }
  // Groupe de champs au cadre natif (bordure en relief « groove », légende posée sur le cadre)
  for (const el of document.querySelectorAll('fieldset')) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden') continue;
    if (cs.borderTopStyle === 'groove')
      out.push({
        name: (el.querySelector('legend')?.innerText || 'fieldset').trim().slice(0, 50),
        cls: String(el.className || '(aucune classe)'),
        why: 'fieldset au cadre natif (groove)',
      });
  }
  return out;
}

(async () => {
  const only = process.argv.slice(2);
  const b = await chromium.launch();
  const pages = [
    ...APP_PAGES.map((s) => ({ ...s, kind: 'app' })),
    ...DIALOGS.map((s) => ({ ...s, kind: 'app' })),
    ...PLAYER_PAGES.map((s) => ({ ...s, kind: 'player' })),
  ].filter((s) => !only.length || only.some((o) => s.name.toLowerCase().includes(o.toLowerCase())));
  let bad = 0;
  const check = (p) => p.evaluate(natives);
  for (const theme of ['light', 'dark'])
    for (const s of pages) {
      let m;
      try {
        m = s.kind === 'app' ? await appPage(b, s, theme, check) : await playerPage(b, s, theme, check);
      } catch (e) {
        console.log(`NOT OK - ${s.name} (${theme}) : contrôle impossible (${e.message.split('\n')[0]})`);
        process.exitCode = 1;
        continue;
      }
      bad += m.length;
      console.log(`${m.length ? 'NOT OK' : 'ok'} - ${s.name} (${theme})`);
      for (const x of m) console.log(`    « ${x.name} » (.${x.cls}) : ${x.why}`);
    }
  await b.close();
  console.log(`\n${bad} bouton(s) natif(s) sur ${pages.length} pages × 2 thèmes`);
  if (bad) process.exitCode = 1;
})();
