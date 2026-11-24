/**
 * Recette L48-E (spec docs/ux/specs/l48e-editeur.md §8). Données fictives, faux Supabase.
 *  - rail d'outils (groupes, flèches, Alt + 3, Échap), un seul panneau, fermeture par l'outil actif ;
 *  - point d'intérêt du canevas → « Points d'intérêt » ; flou en modale (Annuler confirmé, Appliquer) ;
 *  - commentaires sous le canevas (21/11 §1, largeur du canevas gardée) ; en-tête (un seul primaire, menu Plus) ;
 *  - étape HTML : Zoom et Recadrage désactivés avec la raison ; outil gardé (fd.editor.tool) ; axe.
 * Usage : node e2e/l48e-editeur.e2e.cjs
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { openComments, openTool } = require('./editor-rail.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const state = seed();
  // Une étape HTML en 4e position (Zoom et Recadrage sans objet)
  const ws = state.tables.workspaces[0].id;
  const base = state.tables.steps.find((s) => s.demo_id === DEMO);
  const path = `${ws}/${DEMO}/st-html.html`;
  state.htmlPages = { [path]: '<!doctype html><html><body><h1>Page HTML</h1></body></html>' };
  state.tables.steps.push({
    ...base,
    id: 'st-html',
    position: 3,
    kind: 'html',
    title: 'Page HTML',
    image_path: null,
    html_path: path,
    html_ops: [],
    html_meta: {
      title: 'Page HTML',
      url: 'https://app.acme.example/',
      viewport: { w: 1280, h: 720 },
      links: [],
    },
  });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' })).newPage();
  p.on('pageerror', (e) => {
    if (!/lacks the 'allow-same-origin' flag/.test(e.message)) errors.push(e.message);
  });
  await install(p, state);
  await p.goto(`${APP}/#/demos/${DEMO}/edit`);
  const rail = p
    .getByRole('toolbar', { name: 'Outils de l’étape' })
    .or(p.getByRole('toolbar', { name: "Outils de l'étape" }));
  await rail.waitFor();

  // ===== Rail =====
  ok((await rail.getAttribute('aria-orientation')) === 'vertical', 'rail vertical');
  // Recette du lot 3 (P7) : Design et Assistant dans le même groupe, un filet entre les groupes
  ok((await rail.getByRole('group').count()) === 4, 'groupes : Contenu, Écran, Apparence, Démo');
  ok(
    (await rail
      .locator('button[data-tool="assistant"]')
      .evaluate((el) => Math.round(el.getBoundingClientRect().top))) === 530,
    // EXT-02 §6.3 : « Projecteur » ajouté au groupe Écran, un cran de 40 px plus bas
    'P7 : « Assistant » à y 530',
  );
  // Retours client 21/11 §1 : Commentaires sortis du rail (panneau sous le canevas)
  ok((await rail.locator('button[data-tool]').count()) === 13, '13 outils (dont « Projecteur »)');
  ok((await p.locator('.ed-tool').count()) === 1, 'un panneau ouvert (Étape par défaut)');
  ok((await p.locator('#ed-tool-title').innerText()) === 'Étape', 'panneau « Étape »');
  ok((await p.locator('.stage-head + * .floatbar, .floatbar').count()) === 0, 'plus de barre flottante');
  // Fermer par l'outil actif : le canevas s'élargit
  const w0 = (await p.locator('.stage').boundingBox()).width;
  await rail.locator('[data-tool="step"]').click();
  ok((await p.locator('.ed-tool').count()) === 0, 'clic sur l’outil actif : panneau fermé');
  const w1 = (await p.locator('.stage').boundingBox()).width;
  ok(w1 > w0 + 300, `canevas élargi (${Math.round(w0)} → ${Math.round(w1)} px)`);
  // Clavier : flèches, Alt + 3, Échap
  await rail.locator('[data-tool="step"]').focus();
  await p.keyboard.press('ArrowDown');
  ok(
    await rail.locator('[data-tool="cta"]').evaluate((el) => el === document.activeElement),
    'flèche bas : outil suivant',
  );
  await p.locator('.stage').click({ position: { x: 10, y: 10 } });
  await p.keyboard.press('Alt+Digit3');
  await p.locator('[data-tool-panel="hotspots"]').waitFor();
  ok(true, 'Alt + 3 : Points d’intérêt');
  ok(
    await p.evaluate(() => document.activeElement?.id === 'ed-tool-title'),
    'le titre du panneau prend le focus',
  );
  await p.keyboard.press('Escape');
  ok((await p.locator('.ed-tool').count()) === 0, 'Échap ferme le panneau');
  await p.waitForTimeout(100);
  ok(
    await rail.locator('[data-tool="hotspots"]').evaluate((el) => el === document.activeElement),
    'Échap rend le focus à l’outil',
  );
  // Point d'intérêt du canevas → panneau avec ce point
  await p.locator('[data-canvas-item]').first().click();
  await p.locator('[data-tool-panel="hotspots"] #hs-rect-x').waitFor();
  ok(true, 'clic sur un point : « Points d’intérêt » avec ce point');
  ok(
    JSON.parse(await p.evaluate(() => JSON.stringify(localStorage.getItem('fd.editor.tool')))) === 'hotspots',
    'outil gardé (fd.editor.tool)',
  );

  // ===== Retour client P1 du 21/11 : chaque outil du rail s'ouvre dans le même emplacement =====
  // (même rectangle, même en-tête, remplace l'outil actif, bouton actif) ; seul Flouter est une modale.
  {
    const rects = {};
    for (const tool of ['step', 'design', 'assistant', 'settings', 'hotspots']) {
      const panel = await openTool(p, tool);
      await p.waitForTimeout(150);
      rects[tool] = await panel.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return {
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
          pos: getComputedStyle(el).position,
          title: el.querySelector('#ed-tool-title')?.textContent,
          close: !!el.querySelector('.ed-tool__head button[aria-label]'),
          panels: document.querySelectorAll('.ed-tool').length,
          overlays: document.querySelectorAll('.ai-suggest, .ai-assistant[role="dialog"]').length,
        };
      });
    }
    const ref = rects.step;
    const same = (r) => r.x === ref.x && r.y === ref.y && r.w === ref.w && r.h === ref.h;
    ok(
      same(rects.assistant) && same(rects.design) && same(rects.settings) && same(rects.hotspots),
      `Assistant au même rectangle que les autres panneaux (${JSON.stringify(rects.assistant)} / ${JSON.stringify(ref)})`,
    );
    ok(
      rects.assistant.title === 'Assistant' &&
        rects.assistant.close &&
        rects.assistant.panels === 1 &&
        rects.assistant.overlays === 0 &&
        rects.assistant.pos !== 'fixed',
      'Assistant : en-tête (titre + ×), remplace l’outil actif, aucune surimpression',
    );
    const asst = await openTool(p, 'assistant');
    ok(
      (await rail.locator('[data-tool="assistant"]').getAttribute('aria-pressed')) === 'true',
      'Assistant : bouton du rail actif',
    );
    // Suggestions et champ collés en bas du panneau
    // §18.6 (retour client 21/11) : 16 px autour du composeur, 8 px entre les puces, 16 px avant le champ,
    // puces sur la marge de 16 px du panneau
    const sp = await asst.evaluate((el) => {
      const panel = el.getBoundingClientRect();
      const form = el.querySelector('.ai-as-form .fd-composer').getBoundingClientRect();
      const chips = [...el.querySelectorAll('.ai-as-starters button')].map((x) => x.getBoundingClientRect());
      return {
        bottom: Math.round(panel.bottom - form.bottom),
        // depuis l'intérieur du filet de gauche du panneau
        left: Math.round(form.left - panel.left - el.clientLeft),
        right: Math.round(panel.right - form.right),
        between: chips.slice(1).map((c, i) => Math.round(c.top - chips[i].bottom)),
        toField: Math.round(form.top - chips.at(-1).bottom),
        chipLeft: Math.round(chips[0].left - panel.left - el.clientLeft),
      };
    });
    ok(
      sp.bottom === 16 && sp.left === 16 && sp.right === 16,
      `composeur à 16 px du bas et des côtés (${JSON.stringify(sp)})`,
    );
    ok(
      sp.between.every((g) => g === 8) && sp.toField === 16 && sp.chipLeft === 16,
      'puces : 8 px entre elles, 16 px avant le champ, marge de 16 px',
    );
    await asst.getByLabel('Message à l’assistant').fill('Bonjour');
    await asst.getByLabel('Message à l’assistant').press('Escape');
    ok((await p.locator('[data-tool-panel="assistant"]').count()) === 0, 'Échap depuis le champ : fermé');
    await openTool(p, 'assistant');
    ok(
      (await p.locator('[data-tool-panel="assistant"] .ai-as-msg').count()) === 0 &&
        (await p.locator('[data-tool-panel="assistant"] textarea').inputValue()) === '',
      'à la réouverture, conversation effacée',
    );
    await rail.locator('[data-tool="blur"]').click();
    await p.locator('dialog[open]').waitFor();
    ok(
      (await p.locator('dialog[open]').count()) === 1 && (await p.locator('.ed-tool').count()) <= 1,
      'Flouter reste une modale',
    );
    await p.keyboard.press('Escape');
    await p.waitForTimeout(200);
    await openTool(p, 'hotspots');
  }

  {
    const act = rail.locator('.ed-rail__btn.is-active').first();
    await p.mouse.click(5, 5);
    // Lot 3 : outil actif sur nav-active avec un filet intérieur de 1 px (couleur de bordure) ; le trait
    // de focus de 2 px n'apparaît qu'au clavier
    const sh = await act.evaluate((el) => {
      const probe = document.createElement('i');
      probe.style.color = 'var(--fd-color-border)';
      el.append(probe);
      const border = getComputedStyle(probe).color;
      probe.remove();
      const c = getComputedStyle(el);
      return { shadow: c.boxShadow, outline: c.outlineStyle, border };
    });
    ok(
      sh.outline === 'none' && sh.shadow === `${sh.border} 0px 0px 0px 1px inset`,
      `E1 : outil actif avec un filet de 1 px, sans trait de focus hors clavier (${sh.shadow})`,
    );
  }

  // ===== Flou en modale =====
  await rail.locator('[data-tool="blur"]').click();
  const dlg = p.getByRole('dialog', { name: 'Flouter des zones' });
  await dlg.waitFor();
  const before = JSON.stringify(state.tables.steps.find((s) => s.id === 's1').blurs ?? null);
  ok(
    (await dlg.getByRole('button', { name: 'Ajuster' }).count()) === 1 &&
      !(await dlg.locator('.blurm-zoom').innerText()).replace('Ajuster', '').includes('Ajuster'),
    'E2 : « Ajuster » une seule fois',
  );
  ok(
    (await dlg.locator('.canvas-hotspot').count()) === 0,
    'E4 : pas de point d’intérêt dans la fenêtre du flou',
  );
  {
    const h = dlg.locator('#blurm-list');
    const st = await h.evaluate((el) => {
      const c = getComputedStyle(el);
      return { tt: c.textTransform, fs: c.fontSize, fw: c.fontWeight };
    });
    ok(
      (await h.innerText()) === 'Aucune zone' && st.tt === 'none' && st.fs === '13px' && st.fw === '600',
      `E3 : « Aucune zone » en casse normale, 13 px 600 (${st.tt} ${st.fs} ${st.fw})`,
    );
  }
  const draw = async (x, y) => {
    const box = await dlg.locator('.canvas-frame').boundingBox();
    await p.mouse.move(box.x + box.width * x, box.y + box.height * y);
    await p.mouse.down();
    await p.mouse.move(box.x + box.width * (x + 0.15), box.y + box.height * (y + 0.1), { steps: 5 });
    await p.mouse.up();
  };
  await draw(0.1, 0.1);
  await draw(0.78, 0.04);
  ok((await dlg.locator('.blurm-zones > li').count()) === 2, '2 zones dessinées');
  ok((await dlg.locator('#blurm-list').innerText()) === 'Zones · 2', 'E3 : « Zones · 2 »');
  await dlg.getByRole('button', { name: 'Annuler' }).first().click();
  const confirm = p.getByRole('dialog', { name: 'Abandonner les zones modifiées ?' });
  await confirm.waitFor();
  await confirm.getByRole('button', { name: 'Abandonner' }).click();
  await dlg.waitFor({ state: 'detached' }).catch(() => {});
  await p.waitForTimeout(1200);
  ok(
    JSON.stringify(state.tables.steps.find((s) => s.id === 's1').blurs ?? null) === before,
    'Annuler : zones rétablies',
  );
  await rail.locator('[data-tool="blur"]').click();
  await dlg.waitFor();
  await draw(0.2, 0.2);
  await dlg.getByRole('button', { name: 'Appliquer le flou' }).click();
  await p.waitForTimeout(1200);
  ok(
    (state.tables.steps.find((s) => s.id === 's1').blurs ?? []).length === 1,
    'Appliquer : zone enregistrée',
  );

  // ===== Commentaires : panneau sous le canevas (retours client 21/11 §1) =====
  ok((await rail.locator('[data-tool="comments"]').count()) === 0, 'Commentaires hors du rail');
  const stageW = (await p.locator('.stage').boundingBox()).width;
  await openComments(p);
  ok(Math.abs((await p.locator('.stage').boundingBox()).width - stageW) < 2, 'le canevas garde sa largeur');
  ok((await p.locator('.cm-dock .fd-composer').count()) === 1, 'composeur dans le panneau');
  ok(
    (await p.locator('.cm-dock .cm .fd-card__title, .cm-dock .cm .fd-icon-chip').count()) === 0 &&
      /Interne à l’équipe/.test(await p.locator('.cm-dock__private').innerText()),
    'E5 : en-tête seul, « Interne à l’équipe… » dans la barre',
  );

  // ===== En-tête =====
  ok(
    (await p
      .locator('.ed-bar .btn-primary, .ed-bar .fd-btn--primary')
      .evaluateAll((els) => els.filter((e) => e.getClientRects().length > 0).length)) === 1,
    'un seul bouton principal visible (Publier)',
  );
  ok(
    (await p.locator('.ed-bar').getByRole('button', { name: 'Présenter' }).count()) === 0,
    'Présenter quitte l’en-tête',
  );
  await p.getByRole('button', { name: 'Plus d’options' }).click();
  const items = await p.getByRole('menuitem').allInnerTexts();
  ok(
    ['Présenter', 'Exporter', 'Traduire'].every((x) => items.some((i) => i.includes(x))),
    'Plus : Présenter, Exporter, Traduire',
  );
  await p.keyboard.press('Escape');
  ok(/Enregistré/.test(await p.locator('.ed-state').innerText()), 'état en texte « Enregistré »');

  // ===== Étape HTML =====
  await p.locator('.rail-list li').nth(3).locator('button, .step').first().click();
  await p.waitForTimeout(400);
  const zoom = rail.locator('[data-tool="zoom"]');
  ok(
    (await zoom.getAttribute('aria-disabled')) === 'true' &&
      (await zoom.getAttribute('data-tip')).includes('Pas de zoom sur une page HTML'),
    'étape HTML : Zoom désactivé, raison dans l’infobulle',
  );
  ok(
    (await rail.locator('[data-tool="crop"]').getAttribute('aria-disabled')) === 'true',
    'étape HTML : Recadrage désactivé',
  );

  // ===== axe =====
  for (const tool of ['step', 'settings']) {
    if ((await p.locator(`[data-tool-panel="${tool}"]`).count()) === 0)
      await rail.locator(`[data-tool="${tool}"]`).click();
    await p.waitForTimeout(300);
    const r = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    ok(bad.length === 0, `axe ${tool} : ${bad.map((v) => v.id).join(', ') || '0 violation grave'}`);
  }

  // ===== Lien d'une notification : ?outil=commentaires =====
  await p.goto(`${APP}/#/demos/${DEMO}/edit?outil=commentaires`);
  await p.reload();
  await p.locator('.cm-dock.is-open .cm').waitFor();
  ok(true, '?outil=commentaires ouvre le panneau Commentaires');

  ok(errors.length === 0, `aucune erreur de page${errors.length ? ` : ${errors.join(' / ')}` : ''}`);
  await b.close();
})();
