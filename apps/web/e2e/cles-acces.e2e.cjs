/**
 * Paramètres › Clés d'accès (retours client §6.2 et §6.2.1, maquettes lot1-parametres/cles-*) : liste,
 * création (accès, expiration), clé affichée une seule fois, renommage, révocation, section « Utiliser
 * l'API ». Données fictives ; la clé du faux serveur n'a pas le format d'une vraie clé.
 * Usage : SHOTS_DIR=… [THEME=dark] [WIDTH=390] node e2e/cles-acces.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const BASE = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const WIDTH = Number(process.env.WIDTH || 1440);
const MOBILE = WIDTH < 768;

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const open = async (prepare = () => {}) => {
    const ctx = await themedContext(b, {
      viewport: { width: WIDTH, height: MOBILE ? 844 : 900 },
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    const state = seed();
    prepare(state);
    await install(page, state);
    await page.goto(`${BASE}/#/settings/keys`);
    return { page, state };
  };
  const shot = async (page, name) => {
    if (!SHOTS) return;
    // Captures après la fin des animations (fenêtres, menus)
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));
    await page.screenshot({ path: `${SHOTS}/${name}-${WIDTH}${sfx}.png`, fullPage: true });
  };
  const noScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

  // 1. Liste vide, puis création
  {
    const { page, state } = await open();
    await page.getByRole('heading', { name: 'Aucune clé', level: 3 }).waitFor();
    ok(
      (await page.getByText('Elle ne s’affiche qu’une fois, à la création.').count()) === 1,
      'liste vide : « Aucune clé » et son texte',
    );
    // « Utiliser l'API » est visible aussi sans clé
    const api = page.locator('section.ak-api');
    ok(
      (await api.getByRole('heading', { name: 'Utiliser l’API', level: 2 }).count()) === 1 &&
        /\/functions\/v1\/api\/v1$/.test(await api.getByLabel('Adresse de l’API').inputValue()),
      '« Utiliser l’API » visible sans clé, avec l’adresse de base',
    );
    const pre = api.locator('pre.ak-pre');
    const example = await pre.textContent();
    ok(
      /\/v1\/demos \\\n {2}-H "Authorization: Bearer tc_votre_cle"$/.test(example) &&
        (await pre.getAttribute('tabindex')) === '0',
      'exemple curl : emplacement « tc_votre_cle », jamais une vraie clé ; bloc atteignable au clavier',
    );
    await api.getByRole('button', { name: 'Copier l’exemple' }).click();
    await api.getByRole('button', { name: 'Exemple copié' }).waitFor();
    ok((await page.evaluate(() => navigator.clipboard.readText())) === example, 'exemple copié tel quel');
    const paths = await api
      .locator('.ak-routes tbody tr')
      .evaluateAll((rows) =>
        rows.map((r) => `${r.cells[1].textContent.trim()} → ${r.cells[2].textContent.trim()}`),
      );
    ok(
      paths.join(' | ') === '/demos → Démos | /demos/{id}/stats → Statistiques | /demos/{id}/leads → Leads',
      `tableau des adresses et de l’accès requis (${paths.join(' | ')})`,
    );
    ok(
      (await api.locator('.ak-routes__path').first().isVisible()) === !MOBILE,
      MOBILE ? '390 : colonne Adresse masquée, « Accès requis » gardée' : 'colonne Adresse visible',
    );
    await shot(page, 'cles-vide');

    await page.getByRole('button', { name: 'Créer une clé' }).first().click();
    const dlg = page.getByRole('dialog', { name: 'Créer une clé d’accès' });
    await dlg.waitFor();
    const create = dlg.getByRole('button', { name: 'Créer la clé' });
    ok(
      (await dlg.getByRole('checkbox', { name: /^Démos/ }).isChecked()) &&
        !(await dlg.getByRole('checkbox', { name: /^Statistiques/ }).isChecked()) &&
        !(await dlg.getByRole('checkbox', { name: /^Leads/ }).isChecked()),
      'création : « Démos » cochée par défaut, les autres non',
    );
    ok(
      (await dlg.getByRole('group', { name: 'Ce que la clé peut lire' }).count()) === 1 &&
        (await dlg.getByText('À réserver à un outil de confiance, comme votre CRM.').count()) === 1,
      'groupe « Ce que la clé peut lire » (fieldset, legend), aide sous chaque case',
    );
    ok(
      (await dlg.getByRole('combobox', { name: 'Expiration' }).textContent()).includes('90 jours'),
      'expiration : 90 jours par défaut',
    );
    await dlg.getByRole('checkbox', { name: /^Démos/ }).uncheck();
    ok(
      (await create.getAttribute('aria-disabled')) === 'true' &&
        (await dlg.getByText('Choisissez au moins un accès.').isVisible()),
      'aucun accès : « Créer la clé » désactivé, « Choisissez au moins un accès. »',
    );
    await dlg.getByRole('checkbox', { name: /^Démos/ }).check();
    await dlg.getByRole('checkbox', { name: /^Statistiques/ }).check();
    await create.click();
    ok(
      (await dlg.getByText('Donnez un nom à la clé.').isVisible()) && !(state.tables.api_keys || []).length,
      'nom obligatoire : rien n’est créé sans lui',
    );
    await dlg.getByLabel('Nom').fill('Intranet RH');
    await shot(page, 'cles-creer');
    await create.click();

    // Clé affichée une seule fois
    const done = page.getByRole('alertdialog', { name: 'Clé « Intranet RH » créée' });
    await done.waitFor();
    ok(
      (await done.evaluate(
        (el) =>
          el.closest('.fd-modal')?.classList.contains('fd-modal--success') ??
          el.classList.contains('fd-modal--success'),
      )) && (await done.locator('.fd-modal__tile svg.lucide-key-round').count()) === 1,
      'fenêtre « Clé créée » : ton succès, icône de clé',
    );
    const key = await done.getByLabel('Clé « Intranet RH »').inputValue();
    ok(/^tc_/.test(key) && key.length > 10, 'la clé entière est affichée dans un champ à copier');
    ok(
      (await done
        .getByText('Copiez-la maintenant : elle ne sera plus jamais affichée.', { exact: false })
        .count()) === 1,
      'avertissement : à copier maintenant',
    );
    const finish = done.getByRole('button', { name: 'Terminé' });
    ok(
      (await finish.getAttribute('aria-disabled')) === 'true',
      '« Terminé » désactivé tant que la case n’est pas cochée',
    );
    await page.keyboard.press('Escape');
    // Bouton aria-disabled : le clic est envoyé quand même, il ne doit rien faire
    await finish.click({ force: true });
    ok(await done.isVisible(), 'Échap et « Terminé » ne ferment pas la fenêtre sans la case');
    await done.getByRole('button', { name: 'Copier la clé' }).click();
    await done.getByText('Clé copiée').waitFor();
    ok((await page.evaluate(() => navigator.clipboard.readText())) === key, 'la clé est copiée');
    await done.getByRole('checkbox', { name: 'J’ai copié la clé et l’ai rangée en lieu sûr' }).check();
    await shot(page, 'cles-copie');
    await finish.click();
    await done.waitFor({ state: 'detached' });

    // Liste : la clé n'est plus jamais entière
    const row = page.locator('.ak-table tbody tr');
    await row.first().waitFor();
    const stored = state.tables.api_keys[0];
    ok(
      stored.name === 'Intranet RH' && stored.scopes.join(',') === 'demos,stats' && !!stored.expires_at,
      'clé créée avec ses accès (Démos, Statistiques) et son expiration',
    );
    ok(
      (await row.first().locator('.ak-code').textContent()) === `tc_••••••••${key.slice(-4)}` &&
        !(await page.locator('main').innerHTML()).includes(key),
      'liste : « tc_ », des points et les 4 derniers caractères ; la clé entière n’est plus dans la page',
    );
    if (!MOBILE)
      ok(
        (await row.first().locator('.ak-chip').allTextContents()).join(',') === 'Démos,Statistiques' &&
          (await row.first().textContent()).includes('par ') &&
          (await row.first().textContent()).includes('Jamais utilisée'),
        'ligne : auteur, pastilles d’accès, « Jamais utilisée »',
      );
    else ok(!(await row.first().locator('.ak-chips').isVisible()), '390 : colonne « Accès » masquée');
    ok(await noScroll(page), 'pas de défilement horizontal');
    await shot(page, 'cles');

    // Renommer
    await page.getByRole('button', { name: 'Actions pour la clé Intranet RH' }).click();
    await page.getByRole('menuitem', { name: 'Renommer' }).click();
    const ren = page.getByRole('dialog', { name: 'Renommer la clé' });
    await ren.getByLabel('Nom').fill('Intranet RH 2');
    await ren.getByRole('button', { name: 'Enregistrer' }).click();
    await page.getByRole('button', { name: 'Actions pour la clé Intranet RH 2' }).waitFor();
    ok(stored.name === 'Intranet RH 2', 'renommage enregistré');

    // Révoquer
    await page.getByRole('button', { name: 'Actions pour la clé Intranet RH 2' }).click();
    await page.getByRole('menuitem', { name: 'Révoquer' }).click();
    const rev = page.getByRole('alertdialog', { name: 'Révoquer « Intranet RH 2 » ?' });
    await rev.waitFor();
    ok(
      (await rev.textContent()).includes(
        'L’outil qui utilise cette clé perdra l’accès tout de suite. Cette action est définitive.',
      ),
      'révocation : fenêtre de confirmation',
    );
    await shot(page, 'cles-revoquer');
    await rev.getByRole('button', { name: 'Révoquer la clé' }).click();
    await rev.waitFor({ state: 'detached' });
    await page.locator('.ak-table tbody tr.is-revoked').waitFor();
    ok(!!stored.revoked_at, 'clé révoquée');
    if (!MOBILE)
      ok((await row.first().locator('.ak-pill').textContent()) === 'Révoquée', 'pastille « Révoquée »');
    await page.getByRole('button', { name: 'Actions pour la clé Intranet RH 2' }).click();
    ok(
      (await page.getByRole('menuitem', { name: 'Révoquer' }).count()) === 0 &&
        (await page.getByRole('menuitem', { name: 'Renommer' }).count()) === 1,
      'clé révoquée : plus de « Révoquer » dans le menu',
    );
    await page.keyboard.press('Escape');
    await page.context().close();
  }

  // 1 bis. Vingt clés actives : la fenêtre dit pourquoi, sans formulaire, avec « Fermer » seul
  {
    const { page } = await open((s) => {
      s.tables.api_keys = Array.from({ length: 20 }, (_, i) => ({
        id: `k-${i}`,
        workspace_id: 'ws-1',
        created_by: s.user.id,
        name: `Outil ${i + 1}`,
        scopes: ['demos'],
        last4: String(i).padStart(4, '0'),
        created_at: new Date(Date.UTC(2026, 9, 1 + i)).toISOString(),
        expires_at: null,
        revoked_at: null,
        last_used_at: null,
      }));
    });
    await page.locator('.ak-table tbody tr').first().waitFor();
    await page.getByRole('button', { name: 'Créer une clé' }).first().click();
    const dlg = page.getByRole('dialog', { name: 'Créer une clé d’accès' });
    await dlg.waitFor();
    ok(
      (await dlg.textContent()).includes(
        'L’espace a déjà 20 clés actives. Révoquez-en une avant d’en créer une autre.',
      ) &&
        (await dlg.getByRole('textbox').count()) === 0 &&
        (await dlg.getByRole('button', { name: 'Créer la clé' }).count()) === 0 &&
        (await dlg.locator('.fd-modal__foot, footer').getByRole('button', { name: 'Fermer' }).count()) === 1,
      '20 clés actives : message à la place du formulaire, un seul bouton « Fermer »',
    );
    await page.context().close();
  }

  // 2. Rôle editor : rubrique masquée, page sans accès
  {
    const { page } = await open((s) => {
      s.tables.members[0].role = 'editor';
    });
    await page
      .getByRole('heading', { name: 'Les clés d’accès sont réservées aux propriétaires et administrateurs.' })
      .waitFor();
    ok(
      (await page.getByRole('button', { name: 'Créer une clé' }).count()) === 0 &&
        (await page.locator('section.ak-api').count()) === 0,
      'rôle editor : ni liste, ni création, ni section API',
    );
    if (!MOBILE)
      ok(
        (await page.locator('.st-nav').getByText('Clés d’accès').count()) === 0,
        'rôle editor : rubrique masquée dans la navigation des Paramètres',
      );
    await page.context().close();
  }

  ok(errors.length === 0, `aucune erreur (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
