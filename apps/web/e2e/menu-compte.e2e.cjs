/**
 * Menu du compte (« ⋯ » de la carte utilisateur, bas de la barre latérale), retour client P1 du 21/11 et
 * COMP-01 (menus). En administrateur de la plateforme et en simple membre, en clair et en sombre :
 *  - groupes séparés par un filet de 1 px (marge de 4 px) : [Mon profil, Nouveautés] | [ÉQUIPE TUTOCLICK,
 *    Console propriétaire] (admin seulement) | [Nouvel espace, English, Thème] | [Se déconnecter] ;
 *  - intitulé de groupe en 12 px majuscules, gris, aligné sur l'icône des éléments (12 px), non
 *    focalisable, relié au groupe par aria-labelledby ; les flèches le sautent ;
 *  - éléments de 36 px, icône de 16 px, 8 px d'écart ;
 *  - Thème : libellé à gauche, contrôle à droite, un seul contour ; l'option choisie a un fond prune doux
 *    et une icône prune, sans bordure ni ombre.
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};

(async () => {
  const b = await chromium.launch();
  for (const theme of ['light', 'dark'])
    for (const admin of [true, false]) {
      const who = `${admin ? 'admin de la plateforme' : 'membre'}, ${theme}`;
      const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
      await ctx.addInitScript((t) => localStorage.setItem('fd.theme', t), theme);
      const p = await ctx.newPage();
      const st = seed();
      if (admin) st.platformRole = 'owner';
      await install(p, st);
      await p.goto(`${APP}/#/`);
      await p.locator('.demo-card').first().waitFor();
      await p.getByRole('button', { name: /Mon compte/ }).click();
      const menu = p.getByRole('menu');
      await menu.waitFor();
      // MOTION-01 : le menu s'ouvre de 96 % à 100 % ; les mesures se font une fois l'animation finie
      await menu.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
      await p.addStyleTag({ content: '*{transition:none!important}' });
      const m = await menu.evaluate((root) => {
        const kids = [...root.children];
        // Séquence : élément ou intitulé, « | » pour un filet
        const seq = kids
          .map((k) =>
            k.classList.contains('menu-sep')
              ? '|'
              : k.classList.contains('menu-radios')
                ? 'Thème'
                : k.classList.contains('menu-group')
                  ? [...k.children].map((c) => c.textContent.trim()).join('+')
                  : k.textContent.trim(),
          )
          .join(' ');
        const sep = [...root.querySelectorAll('.menu-sep')].map((s) => {
          const cs = getComputedStyle(s);
          return { h: s.getBoundingClientRect().height, mt: cs.marginTop, mb: cs.marginBottom };
        });
        const items = [...root.querySelectorAll('.menu-item')].map((i) => ({
          h: Math.round(i.getBoundingClientRect().height),
          icon: i.querySelector('.menu-item__icon svg')?.getBoundingClientRect(),
          iconX: Math.round(i.querySelector('.menu-item__icon')?.getBoundingClientRect().left ?? -1),
          gap: getComputedStyle(i).columnGap,
        }));
        const label = root.querySelector('.menu-group__label');
        const lcs = label && getComputedStyle(label);
        const group = root.querySelector('.menu-group');
        const textX = (el) => {
          const r = document.createRange();
          r.selectNodeContents(el);
          return Math.round(r.getBoundingClientRect().left);
        };
        const seg = root.querySelector('.menu-radios .segmented');
        const sel = seg?.querySelector('[aria-checked="true"]');
        const body = getComputedStyle(document.body);
        const color = (v) => {
          const i = document.createElement('i');
          i.style.color = body.getPropertyValue(v).trim();
          document.body.append(i);
          const c = getComputedStyle(i).color;
          i.remove();
          return c;
        };
        return {
          seq,
          sep,
          items,
          label: label && {
            size: lcs.fontSize,
            upper: lcs.textTransform,
            spacing: lcs.letterSpacing,
            color: lcs.color,
            muted: color('--fd-color-text-muted'),
            x: textX(label),
            focusable: label.tabIndex >= 0 || label.matches('[role^="menuitem"]'),
            named: group?.getAttribute('aria-labelledby') === label.id,
          },
          theme: seg && {
            border: getComputedStyle(seg).borderTopWidth,
            labelX: textX(root.querySelector('.menu-radios__label')),
            selBorder: getComputedStyle(sel).borderTopWidth + ' ' + getComputedStyle(sel).borderLeftWidth,
            selShadow: getComputedStyle(sel).boxShadow,
            selBg: getComputedStyle(sel).backgroundColor,
            soft: color('--fd-color-primary-soft'),
            selColor: getComputedStyle(sel).color,
            primary: color('--fd-color-primary'),
            segRight: Math.round(seg.getBoundingClientRect().right),
            rowRight: Math.round(seg.parentElement.getBoundingClientRect().right),
          },
        };
      });
      const expected = admin
        ? 'Mon profil Nouveautés | Équipe TutoClick+Console propriétaire | Nouvel espace English Thème | Se déconnecter'
        : 'Mon profil Nouveautés | Nouvel espace English Thème | Se déconnecter';
      ok(m.seq === expected, `${who} : groupes séparés par un filet (${m.seq})`);
      ok(
        m.sep.every((s) => s.h === 1 && s.mt === '4px' && s.mb === '4px'),
        `${who} : filets de 1 px, 4 px de marge (${JSON.stringify(m.sep)})`,
      );
      ok(
        m.items.every((i) => i.h === 36 && i.gap === '8px' && Math.round(i.icon.width) === 16),
        `${who} : éléments de 36 px, icône de 16 px, écart de 8 px`,
      );
      const iconX = m.items[0].iconX;
      ok(
        m.items.every((i) => i.iconX === iconX),
        `${who} : icônes alignées (x = ${iconX})`,
      );
      if (admin)
        ok(
          m.label.size === '12px' &&
            m.label.upper === 'uppercase' &&
            m.label.spacing !== 'normal' &&
            m.label.color === m.label.muted &&
            Math.abs(m.label.x - iconX) <= 1 &&
            !m.label.focusable &&
            m.label.named,
          `${who} : intitulé « Équipe TutoClick » en 12 px majuscules gris, aligné sur les icônes, non focalisable, relié au groupe (${JSON.stringify(m.label)})`,
        );
      ok(
        m.theme.border === '1px' &&
          Math.abs(m.theme.labelX - iconX) <= 1 &&
          m.theme.selBorder === '0px 0px' &&
          m.theme.selShadow === 'none' &&
          m.theme.selBg === m.theme.soft &&
          m.theme.selColor === m.theme.primary &&
          m.theme.rowRight - m.theme.segRight <= 8,
        `${who} : Thème, libellé à gauche, contrôle à droite, un seul contour, option choisie sans bordure (${JSON.stringify(m.theme)})`,
      );
      // Clavier : de « Nouveautés », flèche bas va à l'élément suivant en sautant l'intitulé
      await menu.getByRole('menuitem', { name: 'Nouveautés' }).focus();
      await p.keyboard.press('ArrowDown');
      const next = await p.evaluate(() => document.activeElement?.textContent?.trim());
      ok(
        next === (admin ? 'Console propriétaire' : 'Nouvel espace'),
        `${who} : flèche bas, l'intitulé est sauté (${next})`,
      );
      await ctx.close();
    }
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
