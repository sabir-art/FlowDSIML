/**
 * RGAA 11.13 (finalité des champs) : chaque champ de donnée personnelle porte le bon jeton
 * autocomplete et un attribut name, pour que le navigateur propose les valeurs connues (retour client
 * du 21/11 : la modale d'invitation ne proposait pas les adresses connues).
 * Pages : authentification (connexion, lien par e-mail, inscription, mot de passe oublié, nouveau mot
 * de passe), Onboarding, Profil, modale « Inviter des membres », télécommande (code), lecteur
 * (formulaire de contact, mots de passe de démo et du centre).
 * Champ personnel, d'après son type ou son libellé → jeton attendu :
 *  e-mail → email ; mot de passe → current-password ou new-password ; prénom → given-name ;
 *  nom de famille → family-name ; nom (de la personne) → name ; entreprise, organisation → organization ;
 *  téléphone → tel ; site web → url ; code reçu → one-time-code.
 * Les champs non personnels (recherche, nom de démo…) ne sont pas contrôlés ici.
 */
const { chromium } = require('playwright');
const { APP_PAGES, PLAYER_PAGES, appPage, playerPage } = require('./a11y.e2e.cjs');

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};

const APP = [
  'Connexion',
  'Inscription',
  'Mot de passe oublié',
  'Nouveau mot de passe',
  'Onboarding · profil',
  'Profil',
  'Télécommande',
];
const PLAYER = ['Lecteur · formulaire de contact', 'Lecteur · mot de passe', 'Centre · mot de passe'];
const EXTRA = [
  {
    name: 'Connexion par lien e-mail',
    route: '/#/login',
    signedOut: true,
    open: (p) => p.getByRole('button', { name: /lien de connexion par e-mail/ }).click(),
  },
  {
    name: 'Inviter des membres',
    route: '/#/settings/members',
    open: async (p) => {
      await p.getByRole('button', { name: 'Inviter des membres' }).click();
      await p.locator('#inv-email').waitFor();
    },
  },
];

/** Dans la page : champs personnels sans le bon jeton ou sans name. */
function audit() {
  const RULES = [
    [/e-?mail|courriel/i, ['email']],
    [/prénom|first name/i, ['given-name']],
    [/nom de famille|last name/i, ['family-name']],
    [/entreprise|organisation|société|company|organization/i, ['organization']],
    [/téléphone|phone/i, ['tel']],
    [/site web|website/i, ['url']],
    [
      /^(votre |nom complet|nom et prénom|full name|your name|nom\b(?! de (la |l’|l')?(démo|espace|dossier|étape|fichier|modèle|variable|segment|parcours|structure)))/i,
      ['name'],
    ],
  ];
  const labelOf = (el) => {
    const parts = [];
    if (el.labels) for (const l of el.labels) parts.push(l.innerText);
    const by = el.getAttribute('aria-labelledby');
    if (by) for (const id of by.split(/\s+/)) parts.push(document.getElementById(id)?.innerText ?? '');
    parts.push(el.getAttribute('aria-label') ?? '');
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  };
  const SKIP = new Set([
    'hidden',
    'checkbox',
    'radio',
    'range',
    'file',
    'color',
    'submit',
    'button',
    'search',
  ]);
  const out = [];
  for (const el of document.querySelectorAll('input, textarea, select')) {
    if (SKIP.has(el.type) || !el.getClientRects().length) continue;
    const label = labelOf(el);
    const ac = (el.getAttribute('autocomplete') || '').trim();
    let want = null;
    if (el.type === 'email') want = ['email'];
    else if (el.type === 'password') want = ['current-password', 'new-password'];
    else if (el.type === 'tel') want = ['tel'];
    else if (/\bcode\b/i.test(label) && /numeric/.test(el.inputMode)) want = ['one-time-code'];
    else for (const [re, tok] of RULES) if (re.test(label)) want = want || tok;
    if (!want) continue;
    out.push({
      label: label || el.id || el.name,
      ac,
      name: el.getAttribute('name') || '',
      good: want.includes(ac) && !!el.getAttribute('name'),
      want: want.join(' ou '),
    });
  }
  return out;
}

(async () => {
  const only = process.argv.slice(2);
  const b = await chromium.launch();
  const pages = [
    ...APP_PAGES.filter((s) => APP.includes(s.name)).map((s) => ({ ...s, kind: 'app' })),
    ...EXTRA.map((s) => ({ ...s, kind: 'app' })),
    ...PLAYER_PAGES.filter((s) => PLAYER.includes(s.name)).map((s) => ({ ...s, kind: 'player' })),
  ].filter((s) => !only.length || only.some((o) => s.name.toLowerCase().includes(o.toLowerCase())));
  ok(pages.length === APP.length + EXTRA.length + PLAYER.length || only.length, `${pages.length} pages`);
  for (const s of pages) {
    const run = (p) => p.evaluate(audit);
    let fields;
    try {
      fields = s.kind === 'app' ? await appPage(b, s, 'light', run) : await playerPage(b, s, 'light', run);
    } catch (e) {
      ok(false, `${s.name} : contrôle impossible (${e.message.split('\n')[0]})`);
      continue;
    }
    const bad = fields.filter((f) => !f.good);
    ok(fields.length > 0, `${s.name} : ${fields.length} champ(s) personnel(s)`);
    ok(
      !bad.length,
      `${s.name} : jeton autocomplete et name sur chaque champ personnel${bad
        .map((f) => ` | « ${f.label} » : autocomplete="${f.ac}" (attendu ${f.want}), name="${f.name}"`)
        .join('')}`,
    );
  }
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
