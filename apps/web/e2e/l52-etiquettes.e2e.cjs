/**
 * Recette L52 (spec docs/ux/specs/l52-etiquettes.md). Données fictives (acme.example).
 *  - P1 : les 8 couleurs sur des cartes de Démos ; contraste au-dessus de 4,5:1 (axe et calcul), en clair et en sombre ;
 *    l'orange a le texte #8F5300.
 *  - P2 (recette 1, 4, 5, 7, 9) : /settings/tags trié par nom, «\u202f8 sur 20\u202f», lien «\u202fn démos\u202f» vers Démos filtré
 *    (?etiquettes=), tri par nombre de démos ; suppression confirmée (les démos restent) ; couleur Sarcelle (anneau,
 *    coche, flèches) ; lecteur sans bouton ni menu ; clavier (menu, renommage Entrée et Échap) ; création, nom pris ;
 *    état vide.
 *  - P3 (recette 2, 3) : nom déjà pris → «\u202fFusionner avec «\u202fOutil CRM\u202f»\u202f» ouvre la fusion ; fusion de «\u202fOutil métier\u202f»
 *    (7 démos) dans «\u202fOutil CRM\u202f» : toutes l'ont, «\u202fOutil métier\u202f» a disparu, aucune démo au-delà de 5, toast.
 *  - P4 (recette 6) : «\u202f+ Étiquette\u202f» au survol et au focus de la carte (et de la ligne de liste) ; sélecteur accroché à
 *    la ligne, créer «\u202fNouvelle\u202f» (couleur proposée) : elle paraît sur la carte et dans la page ; limite de 5 ; lecteur.
 * Usage : node e2e/l52-etiquettes.e2e.cjs
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';

const COLORS = ['blue', 'green', 'orange', 'raspberry', 'plum', 'slate', 'teal', 'violet'];
const NAMES = ['Outil CRM', 'Accueil', 'Agenda', 'Facturation', 'RH', 'Archives', 'Usagers', 'Formation'];

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];

  // ===== P1 : 8 couleurs (5 sur la première démo, 3 sur la seconde : 5 au plus par démo) =====
  for (const theme of ['light', 'dark']) {
    const page = await (
      await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' })
    ).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript((t) => localStorage.setItem('fd.theme', t), theme);
    const s = seed();
    const ws = s.tables.workspaces[0].id;
    const [d1, d2] = s.tables.demos;
    s.tables.tags = COLORS.map((color, i) => ({
      id: `0b5c1f0e-0000-4000-8000-0000000052${String(i).padStart(2, '0')}`,
      workspace_id: ws,
      name: NAMES[i],
      color,
      created_at: new Date().toISOString(),
    }));
    s.tables.demo_tags = s.tables.tags.map((tag, i) => ({
      demo_id: i < 5 ? d1.id : d2.id,
      tag_id: tag.id,
      workspace_id: ws,
    }));
    await install(page, s);
    await page.goto(`${APP}/#/`);
    await page.waitForSelector('.demo-card .tg');
    const chips = await page.$$eval('.demo-card .tg', (els) => {
      const lum = (c) => {
        const [r, g, bl] = c
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map((x) => {
            const v = Number(x) / 255;
            return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          });
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
      };
      // Fond effectif : couleur de l'étiquette (éventuellement translucide) posée sur la surface de la carte
      const solid = (el) => {
        const parse = (c) => (c.match(/[\d.]+/g) || []).map(Number);
        const layers = [];
        for (let n = el; n; n = n.parentElement) {
          const p = parse(getComputedStyle(n).backgroundColor);
          if (p.length === 4 && p[3] === 0) continue;
          layers.push(p.length === 4 ? p : [...p, 1]);
          if ((p[3] ?? 1) === 1) break;
        }
        let [r, g, bl] = layers.pop().slice(0, 3);
        for (const [lr, lg, lb, a] of layers.reverse()) {
          r = lr * a + r * (1 - a);
          g = lg * a + g * (1 - a);
          bl = lb * a + bl * (1 - a);
        }
        return `rgb(${r}, ${g}, ${bl})`;
      };
      return els.map((el) => {
        const cs = getComputedStyle(el);
        const a = lum(cs.color);
        const bg = lum(solid(el));
        const ratio = (Math.max(a, bg) + 0.05) / (Math.min(a, bg) + 0.05);
        return { cls: el.className, color: cs.color, ratio: Math.round(ratio * 100) / 100 };
      });
    });
    const classes = COLORS.filter((c) => chips.some((x) => x.cls.includes(`tg--${c}`)));
    ok(classes.length === 8, `${theme} : les 8 couleurs affichées (${classes.join(', ')})`);
    const low = chips.filter((x) => x.ratio < 4.5);
    ok(low.length === 0, `${theme} : contraste ≥ 4,5:1 (${chips.map((x) => x.ratio).join(' ')})`);
    if (theme === 'light') {
      const orange = chips.find((x) => x.cls.includes('tg--orange'));
      ok(orange?.color === 'rgb(143, 83, 0)', `orange : texte #8F5300 (${orange?.color})`);
    }
    const r = await new AxeBuilder({ page }).include('.demo-card').withRules(['color-contrast']).analyze();
    ok(
      r.violations.length === 0,
      `${theme} : axe color-contrast sur les cartes (${r.violations.length} violation)`,
    );
    await page.context().close();
  }

  // ===== P2 : page Paramètres › Contenu › Étiquettes =====
  const PAGE_TAGS = [
    ['Accueil', 'teal', 6],
    ['Logiciel métier', 'blue', 12],
    ['Nouveaux agents', 'green', 9],
    ['Outil CRM', 'violet', 7],
    ['Outil métier', 'orange', 7],
    ['Pilotage', 'plum', 3],
    ['Réglementaire', 'raspberry', 0],
    ['Tutoriel interne', 'slate', 2],
  ];
  const pageSeed = ({ tags = PAGE_TAGS, role } = {}) => {
    const s = seed();
    const ws = s.tables.workspaces[0].id;
    const base = s.tables.demos[1];
    for (let i = 0; i < 10; i++)
      s.tables.demos.push({
        ...base,
        id: `0b5c1f0e-0000-4000-8000-0000000003${String(i).padStart(2, '0')}`,
        title: `Démo ${i + 1}`,
      });
    s.tables.tags = tags.map(([name, color], i) => ({
      id: `0b5c1f0e-0000-4000-8000-0000000052${String(i).padStart(2, '0')}`,
      workspace_id: ws,
      name,
      color,
      created_at: new Date().toISOString(),
    }));
    const ids = s.tables.demos.map((d) => d.id);
    s.tables.demo_tags = [];
    tags.forEach(([, , n], i) => {
      for (let k = 0; k < n; k++)
        s.tables.demo_tags.push({
          demo_id: ids[(k + i) % ids.length],
          tag_id: s.tables.tags[i].id,
          workspace_id: ws,
        });
    });
    if (role) {
      s.tables.members[0].role = role;
      s.role = role;
    }
    return s;
  };
  const openPage = async (s, path = '/settings/tags') => {
    const page = await (
      await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'fr-FR' })
    ).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    const state = await install(page, s);
    await page.goto(`${APP}/#${path}`);
    return { page, state };
  };
  const names = (page) => page.locator('.tgs-row:not(.tgs-row--head) .tgs-name .tg').allTextContents();

  // Recette 1 : liste, compteur, tri, lien vers Démos filtré
  {
    const { page, state } = await openPage(pageSeed());
    await page.locator('.tgs-row .tg').first().waitFor();
    ok(
      JSON.stringify(await names(page)) === JSON.stringify(PAGE_TAGS.map((x) => x[0])),
      'recette 1 : liste triée par nom',
    );
    ok((await page.locator('.tgs-quota').innerText()) === '8 sur\u00a020', '«\u202f8 sur 20\u202f»');
    ok(
      (await page.getByRole('columnheader', { name: 'Nom' }).getAttribute('aria-sort')) === 'ascending',
      'en-tête Nom : aria-sort="ascending"',
    );
    ok(
      (await page.locator('.tgs-row', { hasText: 'Réglementaire' }).getByText('Aucune démo').count()) === 1 &&
        (await page.locator('.tgs-row', { hasText: 'Réglementaire' }).getByRole('link').count()) === 0,
      '«\u202fAucune démo\u202f», sans lien',
    );
    await page.getByRole('button', { name: 'Démos' }).click();
    ok(
      (await names(page))[0] === 'Logiciel métier' &&
        (await page.getByRole('columnheader', { name: 'Démos' }).getAttribute('aria-sort')) === 'descending',
      'tri par nombre de démos (le plus grand en tête, aria-sort)',
    );
    // Lecteur d'écran et lien : «\u202f3 démos avec l'étiquette Pilotage\u202f»
    await page.getByRole('link', { name: '3 démos avec l’étiquette Pilotage' }).click();
    await page.waitForSelector('.demo-card');
    await page.waitForTimeout(300);
    const pil = state.tables.tags.find((x) => x.name === 'Pilotage').id;
    ok(page.url().includes(`etiquettes=${pil}`), 'Démos : ?etiquettes=<id> dans l’adresse');
    ok((await page.locator('.demo-card').count()) === 3, 'Démos filtré sur l’étiquette (3 démos)');
    ok(
      (await page.locator('.tg-filter').getAttribute('class')).includes('fd-filter--active'),
      'filtre Étiquettes prérempli et actif',
    );
    await page.locator('.tg-filter').click();
    await page.getByRole('button', { name: 'Effacer' }).click();
    await page.waitForTimeout(200);
    ok(!page.url().includes('etiquettes='), 'vider le filtre efface ?etiquettes=');
    await page.context().close();
  }

  // Recette 4 : suppression confirmée, les démos restent
  {
    const { page, state } = await openPage(pageSeed());
    await page.locator('.tgs-row .tg').first().waitFor();
    const before = state.tables.demos.length;
    await page.getByRole('button', { name: 'Plus d’actions pour Pilotage' }).click();
    await page.getByRole('menuitem', { name: 'Supprimer' }).click();
    const dlg = page.getByRole('dialog', { name: 'Supprimer «\u202fPilotage\u202f» ?' });
    await dlg.waitFor();
    ok(
      /Elle sera retirée de 3 démos\. Les démos ne sont pas supprimées\./.test(await dlg.innerText()),
      'recette 4 : la confirmation cite 3 démos',
    );
    await dlg.getByRole('button', { name: 'Supprimer' }).click();
    await page.waitForTimeout(400);
    ok(
      !state.tables.tags.some((x) => x.name === 'Pilotage') && state.tables.demos.length === before,
      'étiquette supprimée, démos conservées',
    );
    ok(!(await names(page)).includes('Pilotage'), 'ligne retirée de la liste');
    // Sans démo : «\u202fAucune démo ne l'utilise.\u202f»
    await page.getByRole('button', { name: 'Plus d’actions pour Réglementaire' }).click();
    await page.getByRole('menuitem', { name: 'Supprimer' }).click();
    const d2 = page.getByRole('dialog', { name: 'Supprimer «\u202fRéglementaire\u202f» ?' });
    await d2.waitFor();
    ok(
      /Aucune démo ne l’utilise\./.test(await d2.innerText()),
      'sans démo : «\u202fAucune démo ne l’utilise.\u202f»',
    );
    await d2.getByRole('button', { name: 'Annuler' }).click();
    await page.context().close();
  }

  // Recette 5 et 9 : couleur, clavier, renommage, création
  {
    const { page, state } = await openPage(pageSeed());
    await page.locator('.tgs-row .tg').first().waitFor();
    // Menu aux flèches
    await page.getByRole('button', { name: 'Plus d’actions pour Outil CRM' }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('menuitem', { name: 'Renommer' }).waitFor();
    await page.keyboard.press('ArrowDown');
    ok(
      (await page.evaluate(() => document.activeElement?.textContent)) === 'Couleur',
      'recette 9 : menu «\u202fPlus d’actions\u202f» aux flèches',
    );
    await page.keyboard.press('Enter');
    const colors = page.getByRole('radiogroup', { name: 'Couleur' });
    await colors.waitFor();
    ok(
      (await colors.getByRole('radio', { name: 'Violet' }).getAttribute('aria-checked')) === 'true' &&
        (await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))) === 'Violet',
      'fenêtre Couleur : la couleur actuelle cochée et focalisée',
    );
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(300);
    const crm = () => state.tables.tags.find((x) => x.name === 'Outil CRM');
    ok(
      crm().color === 'teal' &&
        (await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))) === 'Sarcelle',
      'recette 9 : pastilles aux flèches (Violet → Sarcelle)',
    );
    const teal = colors.getByRole('radio', { name: 'Sarcelle' });
    const ring = await teal.evaluate((el) => ({
      checked: el.getAttribute('aria-checked'),
      icon: !!el.querySelector('svg'),
      shadow: getComputedStyle(el).boxShadow,
    }));
    ok(
      ring.checked === 'true' && ring.icon && /0px 0px 0px 4px/.test(ring.shadow),
      `recette 5 : Sarcelle choisie, anneau et coche (${ring.shadow})`,
    );
    ok(
      (
        await page.locator('.tgs-row', { hasText: 'Outil CRM' }).locator('.tg').getAttribute('class')
      ).includes('tg--teal'),
      'aperçu de la ligne changé tout de suite',
    );
    // Pastilles sans infobulle (nom sous la grille) : un seul Échap ferme la fenêtre
    ok((await page.locator('.fd-tip, [role="tooltip"]').count()) === 0, 'pastilles : pas d’infobulle');
    await page.keyboard.press('Escape');
    ok(
      (await page.locator('.tgs-pop').count()) === 0 &&
        (await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))) ===
          'Plus d’actions pour Outil CRM',
      'Échap : focus rendu au bouton de la ligne',
    );

    // Renommage : Échap annule, Entrée valide, nom pris refusé
    const openRename = async (name) => {
      await page.getByRole('button', { name: `Plus d’actions pour ${name}` }).click();
      await page.getByRole('menuitem', { name: 'Renommer' }).click();
      const field = page.getByRole('textbox', { name: `Renommer ${name}` });
      await field.waitFor();
      return field;
    };
    let field = await openRename('Accueil');
    ok(
      await field.evaluate((el) => el.selectionStart === 0 && el.selectionEnd === el.value.length),
      'renommage : texte sélectionné',
    );
    await field.fill('Accueil des agents');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    ok(
      state.tables.tags.some((x) => x.name === 'Accueil'),
      'recette 9 : Échap annule le renommage',
    );
    field = await openRename('Accueil');
    await field.fill('Accueil des agents');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    ok(
      state.tables.tags.some((x) => x.name === 'Accueil des agents'),
      'recette 9 : Entrée valide le renommage',
    );
    field = await openRename('Outil métier');
    await field.fill('outil crm');
    await page.keyboard.press('Enter');
    ok(
      (await page.getByRole('alert').filter({ hasText: 'Cette étiquette existe déjà.' }).count()) === 1 &&
        (await field.getAttribute('aria-invalid')) === 'true',
      'nom déjà pris (casse ignorée) : «\u202fCette étiquette existe déjà.\u202f»',
    );
    await page.keyboard.press('Escape');

    // Création : ligne en tête, couleur proposée, Créer
    await page.getByRole('button', { name: 'Nouvelle étiquette' }).click();
    const nameField = page.getByRole('textbox', { name: 'Nom', exact: true });
    await nameField.waitFor();
    ok(await nameField.evaluate((el) => el === document.activeElement), 'création : focus sur le nom');
    await nameField.fill('Nouvelle');
    await page.getByRole('button', { name: 'Créer', exact: true }).click();
    await page.waitForTimeout(400);
    const created = state.tables.tags.find((x) => x.name === 'Nouvelle');
    // Outil CRM est passé en Sarcelle : le violet est la seule couleur libre
    ok(
      !!created && created.color === 'violet',
      `étiquette créée, couleur proposée : la seule libre (${created?.color})`,
    );
    ok((await page.locator('.tgs-quota').innerText()) === '9 sur\u00a020', 'compteur mis à jour (9 sur 20)');
    await page.context().close();
  }

  // Recette 2 et 3 : nom déjà pris, puis fusion
  {
    const { page, state } = await openPage(pageSeed());
    await page.locator('.tgs-row .tg').first().waitFor();
    await page.getByRole('button', { name: 'Plus d’actions pour Outil métier' }).click();
    await page.getByRole('menuitem', { name: 'Renommer' }).click();
    const field = page.getByRole('textbox', { name: 'Renommer Outil métier' });
    await field.fill('outil crm');
    await page.keyboard.press('Enter');
    const link = page.getByRole('button', { name: 'Fusionner avec «\u202fOutil CRM\u202f»' });
    ok(
      (await link.count()) === 1,
      'recette 2 : «\u202fFusionner avec «\u202fOutil CRM\u202f»\u202f» sous le message',
    );
    await link.click();
    const dlg = page.getByRole('dialog', { name: 'Fusionner «\u202fOutil métier\u202f»' });
    await dlg.waitFor();
    ok(
      (await dlg.getByRole('radio', { name: /Outil CRM/ }).isChecked()) &&
        /Les 7 démos de «\u202fOutil métier\u202f» reçoivent l’étiquette choisie\. «\u202fOutil métier\u202f» est ensuite supprimée\./.test(
          await dlg.innerText(),
        ),
      'recette 2 : la fusion s’ouvre, «\u202fOutil CRM\u202f» choisie, phrase avec 7 démos',
    );
    ok(
      state.tables.tags.some((x) => x.name === 'Outil métier'),
      'nom inchangé tant que la fusion n’est pas faite',
    );
    const crm = state.tables.tags.find((x) => x.name === 'Outil CRM').id;
    const met = state.tables.tags.find((x) => x.name === 'Outil métier').id;
    const before = new Set(state.tables.demo_tags.filter((x) => x.tag_id === met).map((x) => x.demo_id));
    await dlg.getByRole('button', { name: 'Fusionner' }).click();
    await page.waitForTimeout(500);
    ok(
      !state.tables.tags.some((x) => x.id === met) &&
        [...before].every((d) => state.tables.demo_tags.some((x) => x.demo_id === d && x.tag_id === crm)),
      'recette 3 : les 7 démos ont «\u202fOutil CRM\u202f», «\u202fOutil métier\u202f» a disparu',
    );
    const perDemo = {};
    for (const x of state.tables.demo_tags) perDemo[x.demo_id] = (perDemo[x.demo_id] || 0) + 1;
    ok(Math.max(...Object.values(perDemo)) <= 5, 'aucune démo au-delà de 5 étiquettes');
    ok(
      /«\u202fOutil métier\u202f» fusionnée dans «\u202fOutil CRM\u202f» \(7 démos\)/.test(
        await page.locator('.mk-toasts').innerText(),
      ),
      'toast avec le compte',
    );
    ok(!(await names(page)).includes('Outil métier'), 'ligne retirée de la liste');
    // Menu «\u202fFusionner avec…\u202f» : choix dans la liste (pastille et nombre de démos)
    await page.getByRole('button', { name: 'Plus d’actions pour Pilotage' }).click();
    await page.getByRole('menuitem', { name: 'Fusionner avec…' }).click();
    const d2 = page.getByRole('dialog', { name: 'Fusionner «\u202fPilotage\u202f»' });
    await d2.waitFor();
    ok(
      (await d2.getByRole('radio').count()) === 6 &&
        (await d2.locator('.tgs-merge__o', { hasText: 'Logiciel métier' }).innerText()).includes('12 démos'),
      'liste des autres étiquettes avec leur nombre de démos',
    );
    await d2.getByRole('button', { name: 'Annuler' }).click();
    await page.context().close();
  }

  // Recette 6 : depuis la carte d'une démo
  {
    const s = seed();
    const ws = s.tables.workspaces[0].id;
    s.tables.tags = [
      ['Accueil', 'teal'],
      ['Nouveaux agents', 'green'],
    ].map(([name, color], i) => ({
      id: `0b5c1f0e-0000-4000-8000-0000000054${i}0`,
      workspace_id: ws,
      name,
      color,
      created_at: new Date().toISOString(),
    }));
    const [d1, d2] = s.tables.demos;
    s.tables.demo_tags = [{ demo_id: d1.id, tag_id: s.tables.tags[0].id, workspace_id: ws }];
    const { page, state } = await openPage(s, '/');
    await page.waitForSelector('.demo-card');
    const card2 = page.locator('.demo-card').filter({ hasText: d2.title });
    const add = card2.getByRole('button', { name: '+ Étiquette' });
    const opacity = () => add.evaluate((el) => getComputedStyle(el.closest('.tg-card')).opacity);
    await page.mouse.move(0, 0);
    ok((await opacity()) === '0', 'recette 6 : «\u202f+ Étiquette\u202f» masqué au repos');
    await card2.hover();
    ok((await opacity()) === '1', '«\u202f+ Étiquette\u202f» visible au survol de la carte');
    await page.mouse.move(0, 0);
    await add.focus();
    ok((await opacity()) === '1', '«\u202f+ Étiquette\u202f» visible au focus');
    await page.keyboard.press('Enter');
    const pop = card2.getByRole('dialog', { name: `Étiquettes de ${d2.title}` });
    await pop.waitFor();
    ok(
      (await pop.getByRole('link', { name: 'Gérer les étiquettes' }).getAttribute('href')).endsWith(
        '/settings/tags',
      ),
      'sélecteur accroché à la ligne, lien de pied «\u202fGérer les étiquettes\u202f»',
    );
    await pop.getByRole('searchbox').fill('Nouvelle');
    ok(
      (await pop.getByRole('radio', { name: 'Bleu' }).getAttribute('aria-checked')) === 'true',
      'couleur proposée : la première libre (Bleu)',
    );
    await pop.getByRole('button', { name: 'Créer «\u202fNouvelle\u202f»' }).click();
    await page.waitForTimeout(500);
    const created = state.tables.tags.find((x) => x.name === 'Nouvelle');
    ok(
      !!created && state.tables.demo_tags.some((x) => x.demo_id === d2.id && x.tag_id === created.id),
      'étiquette créée et posée sur la démo',
    );
    await page.keyboard.press('Escape');
    ok((await card2.locator('.tg', { hasText: 'Nouvelle' }).count()) === 1, 'elle apparaît sur la carte');
    // La carte a maintenant une étiquette : la ligne ouvre le sélecteur
    ok(
      (await card2.getByRole('button', { name: `Étiquettes de ${d2.title}` }).count()) === 1,
      'ligne d’étiquettes cliquable (nom «\u202fÉtiquettes de …\u202f»)',
    );
    await page.goto(`${APP}/#/settings/tags`);
    await page.locator('.tgs-row .tg').first().waitFor();
    ok((await names(page)).includes('Nouvelle'), 'elle apparaît dans la page Étiquettes');
    // Vue liste : même ligne
    await page.goto(`${APP}/#/`);
    await page.waitForSelector('.demo-card');
    await page.getByRole('radio', { name: 'Liste' }).click();
    await page.waitForSelector('table');
    ok(
      (await page
        .locator('tr')
        .filter({ hasText: d1.title })
        .getByRole('button', { name: `Étiquettes de ${d1.title}` })
        .count()) === 1,
      'vue liste : ligne d’étiquettes cliquable',
    );
    await page.context().close();
  }
  // Limite de 5 par démo : les autres cases désactivées, avec la raison
  {
    const five = Array.from({ length: 6 }, (_, i) => [`Étiquette ${i + 1}`, 'blue', 0]);
    const s = pageSeed({ tags: five });
    const d = s.tables.demos[0];
    s.tables.demo_tags = s.tables.tags
      .slice(0, 5)
      .map((x) => ({ demo_id: d.id, tag_id: x.id, workspace_id: x.workspace_id }));
    const { page } = await openPage(s, '/');
    await page.waitForSelector('.demo-card');
    await page
      .getByRole('button', { name: `Étiquettes de ${d.title}` })
      .first()
      .click();
    const pop = page.getByRole('dialog', { name: `Étiquettes de ${d.title}` }).first();
    await pop.waitFor();
    ok(
      (await pop.getByRole('checkbox', { name: 'Étiquette 6' }).isDisabled()) &&
        (await pop.getByText('5 étiquettes au plus par démo.').count()) === 1,
      'à 5 étiquettes : les autres cases désactivées, «\u202f5 étiquettes au plus par démo.\u202f»',
    );
    await page.context().close();
  }
  // Lecteur : pastilles seules, sans «\u202f+ Étiquette\u202f»
  {
    const { page } = await openPage(pageSeed({ role: 'viewer' }), '/');
    await page.waitForSelector('.demo-card .tg');
    ok(
      (await page.getByRole('button', { name: '+ Étiquette' }).count()) === 0 &&
        (await page.locator('.demo-card .tg-line').count()) === 0,
      'lecteur : pastilles seules, ni «\u202f+ Étiquette\u202f» ni sélecteur',
    );
    await page.context().close();
  }

  // 390 px : pas de défilement horizontal
  {
    const page = await (
      await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR' })
    ).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await install(page, pageSeed());
    await page.goto(`${APP}/#/settings/tags`);
    await page.locator('.tgs-row .tg').first().waitFor();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(over <= 0, `390 px : pas de défilement horizontal (${over} px)`);
    await page.context().close();
  }

  // Recette 7 : rôle Lecteur
  {
    const { page } = await openPage(pageSeed({ role: 'viewer' }));
    await page.locator('.tgs-row .tg').first().waitFor();
    ok(
      (await page.getByText('Seuls les éditeurs peuvent modifier les étiquettes.').count()) === 1 &&
        (await page.getByRole('button', { name: 'Nouvelle étiquette' }).count()) === 0 &&
        (await page.getByRole('button', { name: /Plus d’actions pour/ }).count()) === 0 &&
        (await names(page)).length === 8,
      'recette 7 : lecteur, liste visible sans bouton ni menu',
    );
    await page.context().close();
  }

  // État vide et limite de 20
  {
    const { page } = await openPage(pageSeed({ tags: [] }));
    await page.getByText('Aucune étiquette pour l’instant').waitFor();
    ok(
      (await page.getByText('Créez-en une ici, ou depuis la carte d’une démo.').count()) === 1 &&
        (await page.locator('.stg-empty').getByRole('button', { name: 'Nouvelle étiquette' }).count()) === 1,
      'état vide : titre, phrase, bouton',
    );
    await page.context().close();
    const twenty = Array.from({ length: 20 }, (_, i) => [
      `Étiquette ${String(i + 1).padStart(2, '0')}`,
      'blue',
      0,
    ]);
    const { page: p20 } = await openPage(pageSeed({ tags: twenty }));
    await p20.locator('.tgs-row .tg').first().waitFor();
    const btn = p20.getByRole('button', { name: 'Nouvelle étiquette' });
    ok(
      (await btn.getAttribute('aria-disabled')) === 'true' &&
        (await btn.getAttribute('title')) === '20 étiquettes au plus par espace.',
      'à 20 : «\u202fNouvelle étiquette\u202f» désactivé, raison en infobulle',
    );
    await p20.context().close();
  }

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})();
