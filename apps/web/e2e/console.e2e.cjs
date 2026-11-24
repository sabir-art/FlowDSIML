/**
 * L41 : retours sur l'aide et Console propriétaire (faux backend, données fictives Acme et Globex).
 *  - Client : «\u202fNon\u202f» puis commentaire (donnée personnelle bloquée), «\u202fPasser\u202f» ; aucune entrée Console ;
 *    #/console se comporte comme une adresse inconnue ; Nouveautés et point de nouveauté.
 *  - Propriétaire admin : Vue d'ensemble, Retours, Créer un élément, Backlog, Fait → Annoncer → publier,
 *    Équipe (compte inconnu : «\u202fintrouvable\u202f»), journal ; axe sans violation.
 *  - Lecture seule : bandeau, actions désactivées.
 * Usage : node e2e/console.e2e.cjs
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const axe = async (p, label) => {
    const r = await new AxeBuilder({ page: p }).withTags(TAGS).analyze();
    const bad = r.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    ok(bad.length === 0, `axe : ${label}${bad.length ? ` (${bad.map((v) => v.id).join(', ')})` : ''}`);
  };

  // ===== Client (propriétaire de son espace, pas de la plateforme) =====
  const state = seed();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await install(p, state);
  await p.goto(`${APP}/#/`);
  await p.getByRole('button', { name: /^Mon compte/ }).click();
  ok(
    (await p.getByRole('menuitem', { name: 'Nouveautés' }).count()) === 1,
    'client : entrée «\u202fNouveautés\u202f»',
  );
  ok(
    (await p.getByRole('menuitem', { name: 'Console propriétaire' }).count()) === 0,
    'client : aucune entrée Console',
  );
  ok(
    (await p.getByText('Équipe TutoClick').count()) === 0,
    'client : aucun groupe «\u202fÉquipe TutoClick\u202f»',
  );
  await p.keyboard.press('Escape');
  await p.goto(`${APP}/#/console`);
  await p.waitForURL((u) => !u.hash.startsWith('#/console'));
  ok(new URL(p.url()).hash === '#/', 'client : #/console se comporte comme une adresse inconnue');
  ok(
    !state.calls.some((c) => /console_(overview|items|comments|team)/.test(c.path)),
    'client : aucune lecture de la console',
  );

  // Aide : «\u202fNon\u202f», commentaire
  await p.getByRole('button', { name: 'Aide', exact: true }).click();
  const drawer = p.getByRole('complementary', { name: /Aide/ });
  await drawer.locator('.help-link').first().click();
  const art = drawer.getByRole('article');
  await art.getByRole('button', { name: 'Non' }).click();
  const box = art.getByLabel('Qu’est-ce qui vous manquait ?');
  await box.waitFor();
  ok(
    await box.evaluate((e) => e === document.activeElement),
    'après «\u202fNon\u202f» : focus dans le champ',
  );
  ok(
    (state.helpFeedback || []).some((x) => x.p_helpful === false && x.p_page === 'demos'),
    'vote «\u202fNon\u202f» enregistré tout de suite (avec la page)',
  );
  ok(
    await art.getByRole('button', { name: 'Envoyer' }).isDisabled(),
    '«\u202fEnvoyer\u202f» désactivé si le champ est vide',
  );
  await box.fill('Écrivez-moi à test@example.com');
  await art.getByRole('button', { name: 'Envoyer' }).click();
  ok(
    /adresse e-mail ou un numéro/.test(await art.getByRole('alert').innerText()),
    'donnée personnelle bloquée côté client',
  );
  ok(!(state.helpComments || []).length, 'rien envoyé au serveur');
  const msg = 'Il manque un exemple avec deux dossiers.';
  await box.fill(msg);
  ok((await art.getByText(`${msg.length} / 500`).count()) === 1, 'compteur «\u202fn / 500\u202f»');
  await art.getByRole('button', { name: 'Envoyer' }).click();
  await art.getByText('Merci, votre commentaire a été transmis.').waitFor();
  ok((state.helpComments || []).length === 1, 'commentaire transmis');
  await axe(p, 'panneau d’aide après envoi');
  await p.keyboard.press('Escape');

  // Nouveautés : point puis page
  state.news = [
    {
      id: 'n1',
      title: 'Rôles mieux expliqués',
      body: 'L’article sur les rôles a été réécrit.',
      article: 'membres-roles',
      itemId: null,
      state: 'published',
      publishedAt: new Date().toISOString(),
    },
    {
      id: 'n2',
      title: 'Brouillon',
      body: 'Pas encore',
      article: null,
      itemId: null,
      state: 'draft',
      publishedAt: null,
    },
  ];
  await p.goto(`${APP}/#/analytics`);
  await p.reload();
  await p.locator('.user-block .news-dot').waitFor();
  ok(true, 'point de nouveauté sur l’avatar');
  ok(
    (await p.getByRole('button', { name: 'Mon compte, 1 nouveauté' }).count()) === 1,
    'nom accessible : «\u202fMon compte, 1 nouveauté\u202f»',
  );
  await p.goto(`${APP}/#/nouveautes`);
  await p.getByRole('heading', { level: 2, name: 'Rôles mieux expliqués' }).waitFor();
  ok((await p.locator('.news-card').count()) === 1, 'Nouveautés : seules les annonces publiées');
  ok((await p.getByText('Brouillon').count()) === 0, 'brouillon absent côté client');
  await p.waitForTimeout(400);
  ok((await p.locator('.user-block .news-dot').count()) === 0, 'point effacé à l’ouverture de la page');
  await axe(p, 'page Nouveautés');

  // ===== Propriétaire de la plateforme (admin) =====
  const os = seed();
  os.platformRole = 'admin';
  const o = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  o.on('pageerror', (e) => errors.push(e.message));
  await install(o, os);
  await o.goto(`${APP}/#/`);
  await o.getByRole('button', { name: /^Mon compte/ }).click();
  ok(
    (await o
      .getByRole('group', { name: 'Équipe TutoClick' })
      .getByRole('menuitem', { name: 'Console propriétaire' })
      .count()) === 1,
    'propriétaire : «\u202fConsole propriétaire\u202f» dans le groupe «\u202fÉquipe TutoClick\u202f»',
  );
  await o.getByRole('menuitem', { name: 'Console propriétaire' }).click();
  await o.waitForURL(/#\/console$/);
  await o.getByText('Satisfaction').first().waitFor();
  // PAGE-01 §16.2 : variante éditeur de la barre, onglets segmentés au centre (liens, aria-current)
  const cbar = o.locator('.fd-page-header.fd-page-header--editor');
  const ctabs = cbar.getByRole('navigation', { name: 'Sections de la console' });
  ok((await ctabs.locator('.console-tab').count()) === 5, '5 onglets dans la barre');
  ok(
    (await ctabs.getByRole('link', { name: 'Vue d’ensemble' }).getAttribute('aria-current')) === 'page',
    'onglet actif en aria-current="page"',
  );
  ok(
    (await ctabs.locator('.console-tab__n').innerText()) === '3' &&
      (await ctabs.getByRole('link', { name: /^Retours\s*3 nouveaux$/ }).count()) === 1,
    'onglet «\u202fRetours\u202f» avec sa pastille «\u202f3\u202f» (nom accessible «\u202fRetours 3 nouveaux\u202f»)',
  );
  ok(
    (await cbar.getByRole('heading', { level: 1, name: 'Console propriétaire' }).count()) === 1 &&
      (await o.locator('h1').count()) === 1 &&
      (await cbar.getByRole('link', { name: 'Retour à l’application' }).getAttribute('href')) === '#/' &&
      (await cbar.getByRole('button', { name: 'Aide' }).count()) === 1,
    'barre : retour «\u202fApplication\u202f», seul h1 «\u202fConsole propriétaire\u202f», Aide à droite',
  );
  const cb = await cbar.boundingBox();
  ok(
    Math.round(cb.y) === 0 &&
      Math.round(cb.height) === 56 &&
      (await o.locator('.console-head').count()) === 0,
    `barre de 56 px en haut, ancien en-tête retiré (${Math.round(cb.height)} px)`,
  );
  ok(
    /1 article à surveiller|articles à surveiller/.test(await o.locator('main').innerText()),
    'articles à surveiller (au moins 5 réponses)',
  );
  ok(
    !/partager-lien|Partager un lien/.test(await o.locator('.console-watch').innerText()),
    'article à 1 réponse : pas en tête des articles à surveiller',
  );
  if (process.env.DBG)
    console.log(
      os.calls.filter((c) => c.path.includes('console')).map((c) => c.path + ' ' + JSON.stringify(c.body)),
    );
  ok(
    os.calls.some((c) => c.path.endsWith('/console_log_event') && c.body?.p_action === 'console.open'),
    'connexion à la console journalisée',
  );
  await axe(o, 'console, vue d’ensemble');

  // Retours > Articles : le peu de réponses vient après
  await o.getByRole('link', { name: /^Retours/ }).click();
  const firstRow = await o.locator('.console-table tbody tr').first().innerText();
  ok(/membres|rôles/i.test(firstRow), `moins bien noté d'abord (${firstRow.split('\n')[0]})`);
  ok((await o.getByText('Peu de réponses').count()) === 1, 'badge «\u202fPeu de réponses\u202f»');
  await axe(o, 'console, retours par article');

  // Commentaires : aucune identité, créer un élément
  await o.getByRole('button', { name: 'Commentaires', exact: true }).click();
  await o.locator('.console-comment').first().waitFor();
  const txt = await o.locator('main').innerText();
  ok(!/@example\.com|@tutoclick/.test(txt), 'aucune adresse à l’écran');
  await o.getByRole('button', { name: 'Créer un élément' }).first().click();
  const dlg = o.getByRole('dialog', { name: 'Créer un élément' });
  await dlg.getByLabel('Ticket GitHub').fill('https://example.com/x');
  ok(
    await dlg.getByRole('button', { name: 'Créer l’élément' }).isDisabled(),
    'ticket invalide : création impossible',
  );
  await dlg.getByLabel('Ticket GitHub').fill('https://github.com/acme/app/issues/431');
  await dlg.getByLabel('Titre').fill('Expliquer les rôles');
  await dlg.getByRole('button', { name: 'Créer l’élément' }).click();
  await o.getByText('Élément créé dans «\u202fÀ trier\u202f». Le commentaire y est rattaché.').waitFor();
  ok(true, 'toast «\u202fÉlément créé dans «\u202fÀ trier\u202f». Le commentaire y est rattaché.\u202f»');
  ok(!os.calls.some((c) => /github\.com/.test(c.url || '')), 'aucun appel vers GitHub');
  await axe(o, 'console, commentaires');

  // Backlog : carte, fiche, passage à Fait, annonce
  await o.getByRole('link', { name: /^Backlog/ }).click();
  const card = o.getByRole('button', {
    name: /^Expliquer les rôles\s*, À trier, priorité\s*Moyenne\s*1 retour/,
  });
  await card.waitFor();
  ok((await o.locator('.console-card').first().innerText()).includes('#431'), 'carte : «\u202f#431\u202f»');
  await axe(o, 'console, backlog');
  await card.click();
  const drawerItem = o.getByRole('dialog', { name: 'Élément du backlog' });
  await drawerItem.waitFor();
  ok(
    (await drawerItem.getByRole('link', { name: 'Ouvrir le ticket #431' }).getAttribute('target')) ===
      '_blank',
    'lien «\u202fOuvrir le ticket #431\u202f»',
  );
  await drawerItem.getByRole('button', { name: 'Rejeté' }).click();
  const rj = o.getByRole('dialog', { name: 'Rejeter cet élément' });
  ok(await rj.getByRole('button', { name: 'Rejeter' }).isDisabled(), 'Rejeté sans motif : impossible');
  await rj.getByRole('button', { name: 'Annuler' }).click();
  await drawerItem.getByRole('button', { name: 'Fait' }).click();
  const an = o.getByRole('alertdialog', { name: 'Annoncer cette amélioration ?' });
  await an.waitFor();
  ok(true, '«\u202fAnnoncer cette amélioration ?\u202f» au passage à Fait');
  await an.getByRole('button', { name: 'Rédiger l’annonce' }).click();
  const ed = o.getByRole('dialog', { name: 'Rédiger l’annonce' });
  await ed.getByLabel('Texte').fill('L’article sur les rôles a été réécrit avec des exemples.');
  ok(
    (await ed.getByRole('group', { name: 'Aperçu côté client' }).innerText()).includes('avec des exemples'),
    'aperçu côté client',
  );
  await ed.getByRole('button', { name: 'Publier l’annonce' }).click();
  await o.getByText('Annonce publiée. Les clients voient un point sur «\u202fNouveautés\u202f».').waitFor();
  ok(
    os.news.some((n) => n.state === 'published' && n.itemId),
    'annonce publiée, liée à l’élément',
  );
  await o.keyboard.press('Escape');

  // Nouveautés (console)
  await o.goto(`${APP}/#/console/nouveautes`);
  await o.getByText('Publiée · 1').waitFor();
  ok(true, 'onglet Nouveautés : «\u202fPubliée · 1\u202f»');
  await axe(o, 'console, nouveautés');

  // Équipe et journal
  await o.goto(`${APP}/#/console/equipe`);
  await o.getByRole('heading', { name: 'Journal d’audit' }).waitFor();
  ok(await o.getByLabel('Rôle de Alice').isDisabled(), 'son propre rôle : non modifiable');
  await o.getByRole('button', { name: 'Ajouter un propriétaire' }).click();
  const add = o.getByRole('dialog', { name: 'Ajouter un propriétaire' });
  await add.getByLabel('E-mail du compte TutoClick').fill('personne@example.com');
  await add.getByRole('button', { name: 'Ajouter' }).click();
  ok(
    (await add.getByRole('alert').innerText()) === 'Compte introuvable.',
    'compte inconnu : «\u202fintrouvable\u202f», rien d’autre',
  );
  await add.getByRole('button', { name: 'Annuler' }).click();
  const journal = await o.locator('main').innerText();
  ok(
    /Élément créé/.test(journal) &&
      /Passé à «\u202fFait\u202f»/.test(journal) &&
      /Annonce publiée/.test(journal),
    'journal : actions du parcours tracées',
  );
  await axe(o, 'console, équipe et journal');

  // ===== Lecture seule =====
  const rs = seed();
  rs.platformRole = 'read_only';
  const r = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  r.on('pageerror', (e) => errors.push(e.message));
  await install(r, rs);
  await r.goto(`${APP}/#/console/retours?vue=commentaires`);
  await r.locator('.console-comment').first().waitFor();
  ok((await r.getByRole('note').innerText()).startsWith('Lecture seule'), 'lecture seule : bandeau');
  const create = r.getByRole('button', { name: 'Créer un élément' }).first();
  ok(
    (await create.getAttribute('aria-disabled')) === 'true',
    'lecture seule : action désactivée (aria-disabled)',
  );
  await create.dispatchEvent('click');
  ok((await r.getByRole('dialog').count()) === 0, 'lecture seule : rien ne s’ouvre');
  ok(
    !rs.calls.some((c) => /console_(create|update|link|set|delete|save|withdraw|add|remove)/.test(c.path)),
    'lecture seule : aucune écriture appelée',
  );

  // Mobile
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const ms = seed();
  ms.platformRole = 'admin';
  await install(m, ms);
  await m.goto(`${APP}/#/console/backlog`);
  await m.getByRole('button', { name: 'Nouvel élément' }).waitFor();
  ok(
    (await m.evaluate(() => document.documentElement.scrollWidth)) <= 390,
    '390 px : aucun défilement horizontal de la page',
  );

  ok(errors.length === 0, `aucune erreur JavaScript (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.log(`NOT OK - ${e.message.split('\n')[0]}`);
  process.exit(1);
});
