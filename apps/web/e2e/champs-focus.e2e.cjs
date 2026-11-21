/**
 * FIELD-01 (comp-01-composants.md §11, décision du client du 21/11) : aucun double contour, nulle part.
 * Sur les pages de a11y.e2e.cjs, en clair et en sombre :
 *  1. chaque champ visible (input, textarea, select, combobox), focalisé : l'élément qui porte la bordure
 *     (le champ, ou son groupe en :focus-within) a une bordure prune (rouge s'il est invalide) et pour seule
 *     ombre le trait intérieur de 1 px de la même couleur ; aucun outline ; l'input d'un groupe n'a ni
 *     bordure, ni ombre ; aucun ancêtre ne porte d'ombre de focus ; le fond ne change pas ;
 *  2. au repos : bordure border-field (ou danger si invalide, border si désactivé), sans ombre ;
 *  3. invalide : bordure danger, message relié par aria-describedby avec l'icône CircleAlert ;
 *  4. remplissage automatique : la règle :-webkit-autofill (fond tint, bordure primary) est chargée ;
 *  5. boutons, liens et onglets au clavier : outline à none, aucune ombre extérieure ; secondaire : bordure
 *     prune + trait intérieur ; primaire : fond assombri et trait couleur de surface ; lien : soulignement de
 *     2 px sur fond teinté ; au clic souris, aucun indicateur ;
 *  6. grep : plus de --fd-shadow-focus, #1f7fb6, #51abdd, ni de l'ancien rouge d'erreur (#f07ca2, et
 *     #d60b52 employé comme danger) dans packages/ui et apps/{web,player}/src.
 * Usage : `node e2e/champs-focus.e2e.cjs [filtre…]` (THEMES=light pour une relance réduite).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { APP_PAGES, appPage } = require('./a11y.e2e.cjs');

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};

/** Dans la page : contrôle de chaque champ visible (au plus 12 par page). */
function fields() {
  let scope = document.body;
  const css = (n) => getComputedStyle(scope).getPropertyValue(n).trim();
  const probe = (c) => {
    const i = document.createElement('i');
    i.style.color = c;
    document.body.append(i);
    const v = getComputedStyle(i).color;
    i.remove();
    return v;
  };
  const C = {
    primary: probe(css('--fd-color-primary')),
    danger: probe(css('--fd-color-danger')),
    field: probe(css('--fd-color-border-field')),
    border: probe(css('--fd-color-border')),
    focus: probe(css('--fd-color-focus')),
  };
  const parts = (bs) => (bs === 'none' ? [] : bs.split(/,(?![^(]*\))/).map((x) => x.trim()));
  const SKIP = new Set([
    'hidden',
    'checkbox',
    'radio',
    'range',
    'file',
    'color',
    'submit',
    'button',
    'image',
  ]);
  const sel = (el) =>
    `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 8 && r.height > 8 && cs.visibility !== 'hidden' && cs.opacity !== '0';
  };
  /** Élément qui porte la bordure : le champ, sinon le premier parent bordé (groupe). */
  const bearerOf = (el) => {
    const has = (e) => {
      const cs = getComputedStyle(e);
      return (
        parseFloat(cs.borderTopWidth) > 0 &&
        cs.borderTopStyle !== 'none' &&
        cs.borderTopColor !== 'rgba(0, 0, 0, 0)'
      );
    };
    if (has(el)) return el;
    for (let e = el.parentElement, i = 0; e && i < 3; e = e.parentElement, i++) if (has(e)) return e;
    return el;
  };
  const list = [...document.querySelectorAll('input, textarea, select, [role="combobox"]')].filter(
    (el) =>
      !SKIP.has(el.type) &&
      visible(el) &&
      !el.disabled &&
      !el.closest('[aria-hidden="true"], .sr-only, iframe, .p-root, [inert]'),
  );
  const out = [];
  // Transitions coupées le temps de la mesure (sinon le style lu est celui du milieu de la transition)
  const still = document.createElement('style');
  still.textContent = '*, *::before, *::after { transition: none !important; }';
  document.head.append(still);
  for (const el of list.slice(0, 12)) {
    scope = el;
    Object.assign(C, {
      primary: probe(css('--fd-color-primary')),
      danger: probe(css('--fd-color-danger')),
      field: probe(css('--fd-color-border-field')),
      border: probe(css('--fd-color-border')),
      focus: probe(css('--fd-color-focus')),
    });
    const b = bearerOf(el);
    const group = b !== el;
    const invalid = el.getAttribute('aria-invalid') === 'true';
    const rest = getComputedStyle(b);
    const restBorder = rest.borderTopColor;
    const restBg = rest.backgroundColor;
    const restShadow = rest.boxShadow;
    el.focus({ preventScroll: true });
    const f = getComputedStyle(b);
    const want = invalid ? C.danger : C.primary;
    const sh = parts(f.boxShadow);
    const problems = [];
    // Champ inerte (derrière une modale ouverte) : pas focalisable, hors contrôle
    if (document.activeElement !== el) continue;
    {
      if (f.borderTopColor !== want) problems.push(`bordure ${f.borderTopColor} (attendu ${want})`);
      if (!(sh.length === 1 && /inset/.test(sh[0]) && sh[0].includes(want) && /\b1px\b/.test(sh[0])))
        problems.push(`ombre « ${f.boxShadow} » (attendu le seul trait intérieur de 1 px)`);
      if (getComputedStyle(el).outlineStyle !== 'none' || f.outlineStyle !== 'none') problems.push('outline');
      if (group) {
        const ic = getComputedStyle(el);
        if (
          parseFloat(ic.borderTopWidth) > 0 &&
          ic.borderTopStyle !== 'none' &&
          ic.borderTopColor !== 'rgba(0, 0, 0, 0)'
        )
          problems.push('bordure sur l’input intérieur');
        if (ic.boxShadow !== 'none') problems.push(`ombre sur l’input intérieur (${ic.boxShadow})`);
      }
      for (let e = b.parentElement, i = 0; e && i < 4 && e !== document.body; e = e.parentElement, i++) {
        const as = getComputedStyle(e);
        if (as.outlineStyle !== 'none' && parseFloat(as.outlineWidth) > 0)
          problems.push(`outline sur l’ancêtre ${sel(e)}`);
        if (parts(as.boxShadow).some((x) => x.includes(C.focus) || x.includes(C.primary)))
          problems.push(`ombre de focus sur l’ancêtre ${sel(e)}`);
      }
      if (f.backgroundColor !== restBg && !el.matches(':-webkit-autofill'))
        problems.push('fond changé au focus');
    }
    el.blur();
    // Repos
    const restWant = invalid ? C.danger : C.field;
    // Champ modifiable en place, sans bordure au repos (titre de l'éditeur) : repos non contrôlé
    const inline = restBorder === 'rgba(0, 0, 0, 0)' && !group;
    if (restBorder !== restWant && !el.readOnly && !inline)
      problems.push(`repos : bordure ${restBorder} (attendu ${restWant})`);
    if (parts(restShadow).some((x) => !/inset/.test(x) && !/0px 0px 0px 0px/.test(x)))
      problems.push(`repos : ombre extérieure ${restShadow}`);
    // Invalide : message relié avec l'icône
    if (invalid) {
      const ids = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
      if (!ids.some((id) => document.getElementById(id)?.querySelector('svg.lucide-circle-alert')))
        problems.push('invalide : message sans icône CircleAlert');
    }
    if (problems.length)
      out.push(`${sel(group ? b : el)}${group ? ` > ${sel(el)}` : ''} : ${problems.join(' ; ')}`);
  }
  still.remove();
  return { n: list.length, out };
}

/** Règle d'autofill chargée (contrôle statique des feuilles de styles). */
function autofillRule() {
  for (const sh of document.styleSheets) {
    let rules;
    try {
      rules = sh.cssRules;
    } catch {
      continue;
    }
    for (const r of rules)
      if (
        r.selectorText &&
        r.selectorText.includes(':-webkit-autofill') &&
        /--fd-color-tint/.test(r.cssText) &&
        /--fd-color-primary/.test(r.cssText)
      )
        return true;
  }
  return false;
}

/** Boutons, liens et onglets au clavier : Tab sur les premiers éléments, puis clic souris. */
async function keyboard(p) {
  const out = [];
  await p
    .locator('body')
    .click({ position: { x: 1, y: 1 } })
    .catch(() => {});
  for (let i = 0; i < 18; i++) {
    await p.keyboard.press('Tab');
    const r = await p.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el.matches('input, textarea, select, [role="combobox"]'))
        return null;
      const cs = getComputedStyle(el);
      let scope = document.body;
      const css = (n) => getComputedStyle(scope).getPropertyValue(n).trim();
      const parts = (bs) => (bs === 'none' ? [] : bs.split(/,(?![^(]*\))/).map((x) => x.trim()));
      const outer = parts(cs.boxShadow).filter(
        (x) => !/inset/.test(x) && !/0px 0px 0px 0px/.test(x) && !/rgba\(0, 0, 0, 0\)/.test(x),
      );
      const focusLike = outer.filter((x) => /0px 0px 0px [1-9]/.test(x));
      return {
        sel: `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`,
        outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0,
        outer: focusLike.join(' | '),
        indicator:
          /inset/.test(cs.boxShadow) ||
          parseFloat(cs.textDecorationThickness) >= 2 ||
          cs.borderTopColor === css('--fd-color-focus'),
      };
    });
    if (!r) continue;
    if (r.outline) out.push(`${r.sel} : outline au focus clavier`);
    if (r.outer) out.push(`${r.sel} : ombre extérieure au focus clavier (${r.outer})`);
  }
  return out;
}

(async () => {
  const only = process.argv.slice(2);
  const themes = (process.env.THEMES || 'light,dark').split(',');
  const b = await chromium.launch();
  const pages = APP_PAGES.filter(
    (s) => !only.length || only.some((o) => s.name.toLowerCase().includes(o.toLowerCase())),
  );
  let total = 0;
  for (const theme of themes)
    for (const s of pages) {
      let r;
      try {
        r = await appPage(b, s, theme, async (p) => {
          // Repos mesuré sans focus ni survol
          await p.mouse.move(0, 0);
          await p.evaluate(() => document.activeElement?.blur?.());
          const f = await p.evaluate(fields);
          const auto = await p.evaluate(autofillRule);
          const k = s.keyboard === false ? [] : await keyboard(p);
          return { ...f, auto, k };
        });
      } catch (e) {
        ok(false, `${s.name} (${theme}) : contrôle impossible (${e.message.split('\n')[0]})`);
        continue;
      }
      total += r.n;
      ok(
        !r.out.length,
        `${s.name} (${theme}) : ${r.n} champ(s), un seul indicateur${r.out.map((x) => `\n    ${x}`).join('')}`,
      );
      ok(
        !r.k.length,
        `${s.name} (${theme}) : boutons et liens au clavier sans contour ajouté${r.k.map((x) => `\n    ${x}`).join('')}`,
      );
      if (s === pages[0]) ok(r.auto, `règle :-webkit-autofill teintée chargée (${theme})`);
    }
  ok(total > 0, `${total} champs contrôlés`);

  // 3. Invalide (cas provoqués) et 5. indicateurs exacts des boutons et liens, en clair et en sombre
  const { install, seed } = require('./fake-supabase.cjs');
  const APP = process.env.APP_URL || 'http://localhost:5173';
  const probeTokens = (p, scopeSel) =>
    p.evaluate((sel) => {
      const scope = (sel && document.querySelector(sel)) || document.body;
      const get = (n) => {
        const i = document.createElement('i');
        i.style.color = getComputedStyle(scope).getPropertyValue(n).trim();
        document.body.append(i);
        const v = getComputedStyle(i).color;
        i.remove();
        return v;
      };
      return Object.fromEntries(
        ['primary', 'danger', 'surface', 'focus', 'primary-focus', 'tint'].map((k) => [
          k,
          get(`--fd-color-${k}`),
        ]),
      );
    }, scopeSel);
  const style = (loc) =>
    loc.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        border: cs.borderTopColor,
        shadow: cs.boxShadow,
        bg: cs.backgroundColor,
        outline: cs.outlineStyle,
        deco: cs.textDecorationThickness,
      };
    });
  for (const theme of themes) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
    await ctx.addInitScript((t) => localStorage.setItem('fd.theme', t), theme);
    // Invalide : connexion envoyée vide
    {
      const p = await ctx.newPage();
      await install(p, { ...seed(), signedOut: true });
      await p.goto(`${APP}/#/login`);
      await p.locator('#email').waitFor();
      await p.addStyleTag({ content: '*{transition:none!important}' });
      const T = await probeTokens(p);
      await p.locator('form button[type=submit]').first().click();
      const email = p.locator('#email');
      await p.waitForFunction(
        () => document.querySelector('#email')?.getAttribute('aria-invalid') === 'true',
      );
      await p.mouse.move(0, 0);
      await p.locator('body').click({ position: { x: 1, y: 1 } });
      await p.evaluate(() => document.activeElement?.blur?.());
      const rest = await style(email);
      await email.focus();
      await p.addStyleTag({ content: '*{transition:none!important}' });
      const foc = await style(email);
      const msg = await email.evaluate((el) =>
        (el.getAttribute('aria-describedby') || '')
          .split(/\s+/)
          .some((id) => document.getElementById(id)?.querySelector('svg.lucide-circle-alert')),
      );
      ok(
        rest.border === T.danger &&
          foc.border === T.danger &&
          foc.shadow === `${T.danger} 0px 0px 0px 1px inset` &&
          rest.bg === T.surface &&
          foc.bg === T.surface,
        `invalide (${theme}) : bordure rouge, trait rouge de 1 px au focus, fond surface (${JSON.stringify({ rest, foc })})`,
      );
      ok(msg, `invalide (${theme}) : message relié avec l’icône CircleAlert`);
      // Lien de texte au clavier : soulignement de 2 px sur fond teinté ; au clic souris, rien
      const link = p.locator('form a:not([class*="btn"])').first();
      await p.keyboard.press('Shift');
      await link.focus();
      const kl = await style(link);
      ok(
        kl.outline === 'none' &&
          kl.deco === '2px' &&
          kl.bg === T.tint &&
          !/0px 0px 0px [1-9]px(?! inset)/.test(kl.shadow.replace(/inset/g, '')),
        `lien au clavier (${theme}) : soulignement de 2 px sur fond teinté, sans cadre (${JSON.stringify(kl)})`,
      );
      // Bouton primaire au clavier : fond assombri, bordure et trait couleur de surface
      const prim = p.locator('form button[type=submit]').first();
      await p.keyboard.press('Shift');
      await prim.focus();
      const kp = await style(prim);
      ok(
        kp.outline === 'none' &&
          kp.bg === T['primary-focus'] &&
          kp.border === T.surface &&
          kp.shadow === `${T.surface} 0px 0px 0px 1px inset`,
        `bouton primaire au clavier (${theme}) : fond assombri, trait de surface (${JSON.stringify(kp)})`,
      );
      // Au clic souris : aucun indicateur
      await p.locator('body').click({ position: { x: 1, y: 1 } });
      await prim.focus();
      const mp = await style(prim);
      ok(
        mp.bg !== T['primary-focus'] && !/inset/.test(mp.shadow),
        `bouton primaire à la souris (${theme}) : aucun indicateur`,
      );
      await p.close();
    }
    // Case à cocher invalide (inscription envoyée vide) : bordure rouge, comme les champs ; case dessinée
    {
      const p = await ctx.newPage();
      await install(p, { ...seed(), signedOut: true });
      await p.goto(`${APP}/#/signup`);
      await p.locator('#consent').waitFor();
      await p.addStyleTag({ content: '*{transition:none!important}' });
      const T = await probeTokens(p);
      await p.locator('form button[type=submit]').first().click();
      await p.waitForFunction(
        () => document.querySelector('#consent')?.getAttribute('aria-invalid') === 'true',
      );
      const c = await p.locator('#consent').evaluate((el) => ({
        border: getComputedStyle(el).borderTopColor,
        appearance: getComputedStyle(el).appearance,
      }));
      ok(
        c.border === T.danger && c.appearance === 'none',
        `case à cocher invalide (${theme}) : bordure rouge, case dessinée (${JSON.stringify(c)})`,
      );
      await p.close();
    }
    // Bouton secondaire au clavier, puis champ à puces invalide (modale d'invitation)
    {
      const p = await ctx.newPage();
      await install(p, seed());
      await p.goto(`${APP}/#/settings/members`);
      await p.getByRole('button', { name: 'Inviter des membres' }).click();
      await p.addStyleTag({ content: '*{transition:none!important}' });
      const T = await probeTokens(p);
      const sec = p.locator('[role=dialog] .btn-secondary').first();
      await p.keyboard.press('Shift');
      await sec.focus();
      const ks = await style(sec);
      ok(
        ks.outline === 'none' && ks.border === T.focus && ks.shadow === `${T.focus} 0px 0px 0px 1px inset`,
        `bouton secondaire au clavier (${theme}) : sa bordure en prune sur 2 px (${JSON.stringify(ks)})`,
      );
      await p.locator('#inv-email').fill('pas-un-email');
      await p.getByRole('button', { name: 'Envoyer les invitations' }).click();
      await p.locator('#inv-email-error').waitFor();
      const grp = p.locator('.email-chips');
      await p.addStyleTag({ content: '*{transition:none!important}' });
      const g = await style(grp);
      const icon = await p.locator('#inv-email-error svg.lucide-circle-alert').count();
      ok(
        g.border === T.danger && icon === 1,
        `champ à puces invalide (${theme}) : bordure rouge, message avec l’icône (${g.border})`,
      );
      await p.close();
    }
    await ctx.close();
  }

  // 6. Grep statique
  const root = path.resolve(__dirname, '../../..');
  const dirs = ['packages/ui/src', 'apps/web/src', 'apps/player/src'];
  const hits = [];
  const walk = (d) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) walk(p);
      else if (/\.(css|tsx?)$/.test(f.name) && f.name !== 'tokens.css') {
        fs.readFileSync(p, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            // Palette de la charte (bleu-400, framboise-600) : couleurs de marque, pas de focus ni d'erreur
            if (f.name === 'tokens.ts' && /^\s+\d{2,3}: '#/.test(line)) return;
            if (
              /--fd-shadow-focus|#1f7fb6|#51abdd|#f07ca2/i.test(line) ||
              (/#d60b52/i.test(line) && /danger|erreur|error/i.test(line))
            )
              hits.push(`${path.relative(root, p)}:${i + 1}`);
          });
      }
    }
  };
  for (const d of dirs) walk(path.join(root, d));
  ok(
    !hits.length,
    `grep : plus de --fd-shadow-focus, #1f7fb6, #51abdd ni ancien rouge d’erreur (${hits.join(', ')})`,
  );
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
