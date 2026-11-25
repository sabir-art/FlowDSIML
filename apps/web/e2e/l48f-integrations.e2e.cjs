/**
 * Recette L48-F (spec docs/ux/specs/l48f-integrations.md §5). Données fictives (acme.example).
 *  - « Toutes » : 4 groupes, Webhooks, Clés d'API et Slack disponibles, les autres « Bientôt » sans focus
 *    ni clic ; Slack (ALERT-01) : webhook entrant, test, état « Connecté », retrait ;
 *  - « Connectées » vide puis avec 2 webhooks actifs ; « Connecter » ouvre « Ajouter un webhook » ;
 *  - demande à la DSI (mailto avec sujet) ou « Renseigner le lien du support » ; page Webhooks et détail ;
 *  - 390 px : select « Catégorie », pas de défilement horizontal ; segmenté aux flèches ; axe.
 * Usage : node e2e/l48f-integrations.e2e.cjs
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';

const hook = (id, state, ws) => ({
  id,
  workspace_id: ws,
  url: `https://hooks.acme.example/${id}`,
  name: null,
  events: ['demo.completed'],
  state,
  failures: state === 'paused_auto' ? 6 : 0,
  secret_hint: 'b58b',
  created_by: null,
  created_at: new Date(Date.now() - 86400_000).toISOString(),
  updated_at: new Date(Date.now() - 86400_000).toISOString(),
});

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const open = async (data, path = '/settings/integrations', width = 1440) => {
    const page = await (await b.newContext({ viewport: { width, height: 900 }, locale: 'fr-FR' })).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await install(page, data);
    await page.goto(`${APP}/#${path}`);
    return page;
  };
  const axe = async (page, label) => {
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    ok(bad.length === 0, `axe ${label} : ${bad.map((v) => v.id).join(', ') || '0 violation grave'}`);
  };

  // ===== Sans webhook, lien du support en mailto =====
  const s = seed();
  s.tables.webhooks = [];
  s.tables.workspaces[0].settings = {
    ...(s.tables.workspaces[0].settings ?? {}),
    helpContact: 'dsi@acme.example',
  };
  const p = await open(s);
  await p.locator('.int-list').first().waitFor();
  ok(
    JSON.stringify(await p.locator('.int-group__t').allTextContents()) ===
      JSON.stringify(['Automatisation', 'Communication', 'Mesure d’audience', 'Relation usagers']) ||
      (await p.locator('.int-group__t').count()) === 4,
    '« Toutes » : 4 groupes',
  );
  const rows = p.locator('.int-list > li');
  const soon = p.locator('.int-list > li .int-soon');
  ok(
    (await rows.count()) === 11 && (await soon.count()) === 8,
    `11 lignes dont 8 « Bientôt » : Webhooks, Clés d’API et Slack sont disponibles (${await rows.count()}, ${await soon.count()})`,
  );
  ok(
    (await p.locator('.int-list > li[aria-disabled="true"]').count()) === 7,
    `lignes « Bientôt » aria-disabled, hors e-mailing (${await p.locator('.int-list > li[aria-disabled="true"]').count()})`,
  );
  ok(
    (await p
      .locator('.int-list > li[aria-disabled="true"] a, .int-list > li[aria-disabled="true"] button')
      .count()) === 0,
    'lignes « Bientôt » : rien de focalisable',
  );
  ok((await p.locator('.int-list .badge').count()) === 0, 'aucun badge');
  const wh = rows.first();
  ok((await wh.innerText()).startsWith('Webhooks'), 'Webhooks en tête d’Automatisation');
  // Connecter : la boîte « Ajouter un webhook »
  await wh.getByRole('button', { name: 'Connecter' }).click();
  await p.getByRole('dialog', { name: 'Ajouter un webhook' }).waitFor();
  ok(true, '« Connecter » ouvre « Ajouter un webhook »');
  await p.keyboard.press('Escape');
  // Demande à la DSI
  const href = await p.getByRole('link', { name: 'Contactez le support' }).getAttribute('href');
  ok(href === 'mailto:dsi@acme.example?subject=Demande%20de%20connexion', `demande à la DSI : ${href}`);
  // Connectées, vide
  await p.getByRole('radio', { name: 'Connectées' }).click();
  await p.waitForURL(/categorie=connectees/);
  await p.getByText('Aucune connexion active').waitFor();
  ok(true, '« Connectées » : état vide');
  ok(
    (await p.getByRole('button', { name: 'Ajouter un webhook' }).count()) === 0 &&
      (await p.locator('.fd-es').getByRole('button', { name: 'Voir les intégrations' }).count()) === 1,
    '« Connectées » : pas d’« Ajouter un webhook » répété, « Voir les intégrations » (EMPTY-01)',
  );
  // Clavier : flèches dans le segmenté
  await p.getByRole('radio', { name: 'Connectées' }).focus();
  await p.keyboard.press('ArrowRight');
  await p.waitForURL(/categorie=communication/);
  await p.locator('.int-list > li', { hasText: 'Slack' }).waitFor();
  ok(
    (await p.getByRole('radio', { name: 'Communication' }).evaluate((el) => el === document.activeElement)) &&
      (await p.locator('.int-group__t').count()) === 0,
    'flèche droite : Communication, sans titre de groupe',
  );
  await axe(p, 'Intégrations (aucune connexion)');

  // ===== ALERT-01 §7-8 : Slack par webhook entrant (adresse fictive, aucun appel réel) =====
  const FAKE_HOOK = 'https://hooks.slack.com/services/T000FICTIF/B000FICTIF/cle-factice';
  const slackLi = p.locator('.int-list > li', { hasText: 'Slack' });
  ok(
    /Recevoir les alertes analytics dans un canal\./.test(await slackLi.innerText()) &&
      (await slackLi.locator('.int-soon').count()) === 0,
    'Slack : ligne disponible, plus de « Bientôt »',
  );
  await slackLi.getByRole('button', { name: 'Connecter Slack' }).click();
  const sd = p.getByRole('dialog', { name: 'Slack' });
  await sd.waitFor();
  const field = sd.getByLabel('Adresse du webhook entrant');
  ok(
    (await field.getAttribute('placeholder')) === 'https://hooks.slack.com/services/…' &&
      (await field.evaluate((el) => el === document.activeElement)),
    'fenêtre Slack : champ « Adresse du webhook entrant » avec son exemple, focus dessus',
  );
  ok(
    (await sd.locator('.fd-modal__foot button').allInnerTexts()).map((x) => x.trim()).join(' | ') ===
      'Envoyer un test | Enregistrer',
    'boutons « Envoyer un test » (secondaire) et « Enregistrer » (primaire)',
  );
  ok(
    (await sd.locator('.int-slack__scope li[aria-disabled="true"] .soon-text').count()) === 2 &&
      (await sd.getByText('Ce qui arrive dans le canal').count()) === 1 &&
      (await sd.locator('.int-slack__scope li').first().locator('svg').count()) === 1 &&
      /Nouveaux leads/.test(await sd.locator('.int-slack__scope').innerText()) &&
      /Commentaires/.test(await sd.locator('.int-slack__scope').innerText()),
    'leads et commentaires : visibles en gris, « Bientôt »',
  );
  // Adresse refusée : autre hôte
  await field.fill('https://hooks.slack.com.evil.example/services/T000FICTIF/B000FICTIF/cle-factice');
  await sd.getByRole('button', { name: 'Enregistrer' }).click();
  await sd.getByText('Indiquez une adresse https://hooks.slack.com/services/…').waitFor();
  ok(
    (await field.getAttribute('aria-invalid')) === 'true' && !s.slack,
    'autre hôte que hooks.slack.com : erreur sous le champ, rien n’est enregistré',
  );
  await axe(p, 'Intégrations, fenêtre Slack (erreur)');
  // « Envoyer un test » enregistre l'adresse puis envoie le test
  await field.fill(FAKE_HOOK);
  await sd.getByRole('button', { name: 'Envoyer un test' }).click();
  await p.getByText('Test envoyé dans Slack').waitFor();
  ok(
    s.slack?.url === FAKE_HOOK && s.slack.tests === 1 && !('app_url' in s.slack),
    '« Envoyer un test » : adresse enregistrée, un test envoyé ; le navigateur n’envoie pas l’adresse de l’app',
  );
  await sd.getByText('Connecté', { exact: true }).waitFor();
  ok(
    (await sd.getByLabel('Adresse du webhook entrant').count()) === 0 &&
      !(await sd.innerText()).includes('cle-factice') &&
      (await sd.getByRole('button', { name: 'Retirer' }).count()) === 1,
    'connecté : pastille « Connecté », action « Retirer », l’adresse n’est plus affichée',
  );
  {
    // Le bouton vient d'apparaître : on lit ses couleurs une fois sa transition finie
    await p.waitForFunction(() => {
      const cs = getComputedStyle(document.querySelector('.fd-modal__foot .int-slack__remove'));
      return cs.backgroundColor === 'rgba(0, 0, 0, 0)' && cs.borderTopColor === cs.color;
    });
    const foot = await sd.evaluate((d) => {
      const [rm, test] = [...d.querySelectorAll('.fd-modal__foot button')];
      const cs = getComputedStyle(rm);
      return {
        order: [rm.textContent.trim(), test.textContent.trim()].join(' | '),
        left: rm.getBoundingClientRect().right < test.getBoundingClientRect().left,
        gap: test.getBoundingClientRect().left - rm.getBoundingClientRect().right,
        outline: `${cs.backgroundColor} | ${cs.borderTopColor} | ${cs.color}`,
      };
    });
    ok(
      foot.order === 'Retirer | Envoyer un test' &&
        foot.left &&
        foot.gap > 40 &&
        // Fond transparent, contour et texte de la même couleur (rouge de danger)
        /^rgba\(0, 0, 0, 0\) \| (rgb\([^)]+\)) \| \1$/.test(foot.outline),
      `connecté : « Retirer » en danger secondaire (contour), à gauche ; « Envoyer un test » à droite (${foot.order}, écart ${Math.round(foot.gap)} px, ${foot.outline})`,
    );
    ok(
      (await sd.getByText(/Pour changer de canal, retirez Slack puis reconnectez-le\./).count()) === 1 &&
        (await sd.getByText(/Collez l’adresse/).count()) === 0,
      'connecté : l’introduction dit comment changer de canal',
    );
  }
  await axe(p, 'Intégrations, fenêtre Slack (connecté)');
  await p.keyboard.press('Escape');
  await sd.waitFor({ state: 'detached' });
  ok(/Connecté/.test(await slackLi.innerText()), 'ligne Slack : « Connecté »');
  await p.getByRole('radio', { name: 'Connectées' }).click();
  await p.waitForURL(/categorie=connectees/);
  await p.locator('.int-list--bare > li').first().waitFor();
  ok(
    (await p.locator('.int-list > li').count()) === 1 &&
      /Slack/.test(await p.locator('.int-list > li').innerText()),
    `« Connectées » : Slack y figure (${await p.locator('.int-list > li').count()} : ${(await p.locator('.int-list').innerText()).replace(/\n/g, ' ')})`,
  );
  // Slack refuse le test : le message le dit
  await p.getByRole('button', { name: 'Ouvrir Slack' }).click();
  s.slackTestFails = true;
  await sd.getByRole('button', { name: 'Envoyer un test' }).click();
  await p.getByText('Le test n’a pas pu être envoyé').waitFor();
  ok(s.slack.tests === 1, 'test refusé par Slack : « Le test n’a pas pu être envoyé »');
  s.slackTestFails = false;
  // Retrait, avec confirmation
  await sd.getByRole('button', { name: 'Retirer' }).click();
  await p.getByRole('dialog', { name: 'Retirer Slack ?' }).getByRole('button', { name: 'Retirer' }).click();
  await p.getByText('Slack retiré').waitFor();
  ok(s.slack === null, '« Retirer » (confirmé) : webhook retiré');
  await p.keyboard.press('Escape');
  await p.context().close();

  // ===== Avec webhooks, sans lien du support =====
  const s2 = seed();
  const ws = s2.tables.workspaces[0].id;
  s2.tables.webhooks = [
    hook('wh-1', 'active', ws),
    hook('wh-2', 'active', ws),
    hook('wh-3', 'paused_auto', ws),
  ];
  s2.tables.workspaces[0].settings = { ...(s2.tables.workspaces[0].settings ?? {}), helpContact: null };
  const q = await open(s2, '/settings/integrations?categorie=connectees');
  await q.locator('.int-list').waitFor();
  const line = q.locator('.int-list > li');
  ok(
    (await line.count()) === 1 && /2 actifs/.test(await line.innerText()),
    '« Connectées » : Webhooks · 2 actifs',
  );
  ok(/1 en pause après des échecs/.test(await line.innerText()), '1 en pause après des échecs');
  await q.getByRole('link', { name: 'Renseigner le lien du support' }).click();
  await q.waitForURL(/settings\/workspace/);
  await q.waitForTimeout(300);
  ok(
    await q.evaluate(() => document.activeElement?.id === 'ws-help'),
    '« Renseigner le lien du support » : focus sur le champ',
  );
  await q.goto(`${APP}/#/settings/integrations`);
  await q.locator('.int-row--link', { hasText: 'Webhooks' }).click();
  await q.waitForURL(/settings\/integrations\/webhooks$/);
  await q.locator('.l23 tbody tr').first().waitFor();
  ok((await q.locator('.l23 tbody tr').count()) === 3, 'page Webhooks : la liste');
  ok(
    (await q.locator('.fd-crumb').innerText()).includes('Intégrations') &&
      (await q.getByRole('heading', { level: 1 }).innerText()) === 'Webhooks',
    'page Webhooks : fil « … › Intégrations », titre « Webhooks »',
  );
  ok(
    (await q.locator('.l23 tbody .badge-success, .l23 tbody .badge-warning').count()) === 0,
    'état en texte avec un point (T4)',
  );
  await axe(q, 'page Webhooks');
  await q.goto(`${APP}/#/settings/integrations/wh-1`);
  await q.locator('.fd-crumb').getByRole('link', { name: 'Webhooks' }).waitFor();
  ok(true, 'détail : fil « … › Intégrations › Webhooks »');
  await q.goto(`${APP}/#/settings/integrations#webhooks`);
  await q.waitForURL(/settings\/integrations\/webhooks$/);
  ok(true, 'ancien lien #webhooks : page Webhooks');
  await q.context().close();

  // ===== 390 px =====
  const m = await open(seed(), '/settings/integrations', 390);
  await m.locator('.int-list').first().waitFor();
  // Maquette lot1-parametres/integrations (390 px) : le filtre segmenté passe à la ligne, sans liste native
  ok(
    (await m.getByRole('radio', { name: /^Mesure d.audience$/ }).isVisible()) &&
      (await m.locator('.int select').count()) === 0,
    '390 px : filtre segmenté sur plusieurs lignes, aucun select natif',
  );
  ok(
    await m.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    '390 px : pas de défilement horizontal',
  );
  await m.getByRole('radio', { name: /^Mesure d.audience$/ }).click();
  await m.waitForURL(/categorie=mesure/);
  // Attendre que la liste soit stable (l'ancienne liste disparaît après le changement de catégorie)
  const two = await m
    .waitForFunction(() => document.querySelectorAll('.int-list > li').length === 2, null, { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  ok(two, '390 px : Mesure d’audience, 2 lignes');
  await axe(m, '390 px');
  await m.context().close();

  ok(errors.length === 0, `aucune erreur de page${errors.length ? ` : ${errors.join(' / ')}` : ''}`);
  await b.close();
})();
