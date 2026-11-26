/**
 * Retours client, planche 1 : Accès › Avec un mot de passe, façon gestionnaire de mots de passe.
 *  - champ de 40 px : clé à gauche, Afficher (aria-pressed) et Copier (32 px) dans le champ ;
 *  - au focus du champ vide : suggestion sous le champ (combobox + listbox, 4 px), « Mot de passe fort ·
 *    n caractères », étiquette « Suggéré » ; quatre parties, 16 caractères au moins ;
 *  - clic ou Entrée remplit le champ ; taper ou Échap ferme ; nouvelle suggestion à chaque ouverture ;
 *  - plus de « Proposer un mot de passe » ni de bloc bleu ; aide « 8 caractères au moins… » gardée ;
 *    « Enregistrer le mot de passe » à droite, désactivé sous 8 caractères.
 * Faux Supabase, données fictives. Usage : [THEME=dark] [SHOTS_DIR=…] node e2e/acces-mot-de-passe.e2e.cjs
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { seedExport } = require('./export-data.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};

(async () => {
  const b = await chromium.launch();
  for (const vp of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const tag = `${vp.width}`;
    const ctx = await themedContext(b, {
      viewport: vp,
      locale: 'fr-FR',
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const state = seed();
    seedExport(state, { steps: 3 });
    await install(page, state);
    await page.goto(`${APP}/#/demos/${DEMO}/share?tab=access`);
    await page.getByRole('radio', { name: /Avec un mot de passe/ }).check();
    const field = page.locator('#acc-pw');
    await field.waitFor();
    const box = await field.boundingBox();
    const geo = await page.evaluate(() => {
      const f = document.getElementById('acc-pw');
      const r = f.getBoundingClientRect();
      const btns = [...f.parentElement.querySelectorAll('.pwf-acts .btn')].map((x) =>
        x.getBoundingClientRect(),
      );
      const key = f.parentElement.querySelector('.pwf-key').getBoundingClientRect();
      return {
        inside: btns.every(
          (x) => x.left >= r.left && x.right <= r.right && x.top >= r.top && x.bottom <= r.bottom,
        ),
        sizes: btns.map((x) => Math.round(x.width)),
        keyLeft: key.left > r.left && key.right < r.left + 40,
      };
    });
    ok(
      Math.round(box.height) === 40 && geo.inside && geo.sizes.join() === '32,32' && geo.keyLeft,
      `${tag} · champ de 40 px, clé à gauche, Afficher et Copier (32 px) dans le champ (${JSON.stringify(geo)})`,
    );
    ok(
      (await page.getByRole('button', { name: /Proposer|Générer/ }).count()) === 0 &&
        (await page.locator('.l11-info, .alert').count()) === 0,
      `${tag} · plus de « Proposer un mot de passe » ni de bloc bleu`,
    );
    ok(
      (await page.locator('#acc-pw-h').innerText()).startsWith(
        '8 caractères au moins. Communiquez-le séparément du lien.',
      ),
      `${tag} · aide gardée`,
    );

    // Focus : suggestion sous le champ
    await field.focus();
    const list = page.getByRole('listbox', { name: 'Mot de passe proposé' });
    await list.waitFor();
    const opt = list.getByRole('option');
    const first = await opt.locator('b').innerText();
    const lb = await list.boundingBox();
    ok(
      (await field.getAttribute('role')) === 'combobox' &&
        (await field.getAttribute('aria-autocomplete')) === 'list' &&
        (await field.getAttribute('aria-expanded')) === 'true' &&
        Math.round(lb.y - (box.y + box.height)) === 4,
      `${tag} · combobox ouverte, liste 4 px sous le champ (${Math.round(lb.y - (box.y + box.height))} px)`,
    );
    ok(
      /^[A-Z][a-z]+-[A-Z][a-z]+-\d{2}-[A-Z][a-z]+$/.test(first) &&
        first.length >= 16 &&
        (await opt.innerText()).includes(`Mot de passe fort · ${first.length} caractères`) &&
        (await opt.locator('.pwf-sug').innerText()) === 'Suggéré',
      `${tag} · suggestion « ${first} », force et longueur, étiquette « Suggéré »`,
    );
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/acces-mdp-suggestion-${tag}${sfx}.png` });
    // Échap ferme ; une nouvelle ouverture propose un autre mot de passe
    await page.keyboard.press('Escape');
    await list.waitFor({ state: 'hidden' });
    await page.locator('#acc-pw-h').click();
    await field.focus();
    await list.waitFor();
    const second = await opt.locator('b').innerText();
    ok(second !== first, `${tag} · Échap ferme ; nouvelle suggestion à la réouverture (${second})`);
    // Entrée choisit
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await list.waitFor({ state: 'hidden' });
    const save = page.getByRole('button', { name: 'Enregistrer le mot de passe' });
    ok(
      (await field.inputValue()) === second &&
        (await field.getAttribute('aria-expanded')) === 'false' &&
        !(await save.isDisabled()),
      `${tag} · Entrée remplit le champ et ferme la liste ; Enregistrer actif`,
    );
    // Afficher, Copier
    const eye = page.getByRole('button', { name: 'Afficher le mot de passe' });
    await eye.click();
    ok(
      (await eye.getAttribute('aria-pressed')) === 'true' && (await field.getAttribute('type')) === 'text',
      `${tag} · Afficher : aria-pressed, texte visible`,
    );
    await page.getByRole('button', { name: 'Copier le mot de passe' }).click();
    await page.getByText('Mot de passe copié').waitFor();
    ok(
      (await page.evaluate(() => navigator.clipboard.readText())) === second,
      `${tag} · Copier : mot de passe dans le presse-papiers, toast`,
    );
    // Taper : la liste se ferme, la personne garde son mot de passe
    await field.fill('');
    await field.blur();
    await field.focus();
    await list.waitFor();
    await page.keyboard.type('court');
    ok(
      (await list.isHidden()) && (await field.inputValue()) === 'court' && (await save.isDisabled()),
      `${tag} · taper ferme la liste ; sous 8 caractères, Enregistrer désactivé`,
    );
    const sb = await save.boundingBox();
    const fb = await field.boundingBox();
    ok(Math.abs(sb.x + sb.width - (fb.x + fb.width)) <= 1, `${tag} · Enregistrer aligné à droite`);
    // Clic sur la suggestion
    await field.fill('');
    await field.blur();
    await field.focus();
    await list.waitFor();
    const third = await opt.locator('b').innerText();
    await opt.click();
    ok(
      (await field.inputValue()) === third && (await list.isHidden()),
      `${tag} · un clic choisit la suggestion`,
    );
    await field.fill('');
    await field.blur();
    await field.focus();
    await list.waitFor();
    const bad = (
      await new AxeBuilder({ page }).include('.l11-cfg').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    ).violations.map((v) => v.id);
    ok(bad.length === 0, `${tag} · axe, liste ouverte (${bad.join(', ')})`);
    ok(errors.length === 0, `${tag} · aucune erreur JS (${errors.join(' | ')})`);
    await ctx.close();
  }
  await b.close();
})();
