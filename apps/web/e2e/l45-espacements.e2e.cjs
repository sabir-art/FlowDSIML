/**
 * L45 : loi de proximité (composants §15.4 bis). Mesure, à 1 440 px, les écarts relevés par l'audit
 * (E1 à E20) entre un bloc et celui qui le précède, et la modale Exporter (E21). Données fictives.
 * Tolérance : 1 px (arrondis). Usage : app web (:5173) lancée, puis `node e2e/l45-espacements.e2e.cjs`.
 */
const { chromium } = require('playwright');
const { APP_PAGES, appPage } = require('./a11y.e2e.cjs');

const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

/** Écart vertical (px) entre le bas de `a` et le haut de `b` (premiers éléments visibles). */
async function gap(p, a, b) {
  return p.evaluate(
    ([sa, sb]) => {
      const vis = (el) => el && el.getBoundingClientRect().height > 0;
      const pick = (s) => (typeof s === 'string' ? [...document.querySelectorAll(s)].find(vis) : null);
      const ea = pick(sa);
      const eb = pick(sb);
      if (!ea || !eb) return null;
      return Math.round(eb.getBoundingClientRect().top - ea.getBoundingClientRect().bottom);
    },
    [a, b],
  );
}

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const near = (v, want) => v !== null && Math.abs(v - want) <= 1;
  const page = (name, extra = {}) => ({ ...APP_PAGES.find((s) => s.name === name), ...extra });
  const editor = page('Éditeur');

  // ===== Éditeur > Réglages (E1 à E6) =====
  await appPage(b, editor, 'light', async (p) => {
    await p.getByRole('tab', { name: 'Réglages' }).click();
    await p.waitForTimeout(400);
    const e1 = await gap(p, '.fmt-sec .fmt-group:last-of-type', '.fmt-sec .field:has(#fmt-out)');
    ok(near(e1, 20), `E1 : format → « Largeur de sortie » : ${e1} px (20)`);
    const e2 = await p.evaluate(() => {
      const r = [...document.querySelectorAll('.fmt-sec .fmt-radios')][0].children;
      return Math.round(r[1].getBoundingClientRect().top - r[0].getBoundingClientRect().bottom);
    });
    ok(near(e2, 8), `E2 : option → option : ${e2} px (8)`);
    const e3 = await p.evaluate(() => {
      const g = document.querySelector('.fmt-sec .fmt-group');
      return Math.round(
        g.querySelector('legend').getBoundingClientRect().left -
          g.querySelector('.fmt-radios').getBoundingClientRect().left,
      );
    });
    ok(e3 === 0, `E3 : légende alignée sur les radios (${e3} px)`);
    const e4 = await p.evaluate(() => {
      const sec = [...document.querySelectorAll('.panel .sec')].find((s) =>
        /Jeu de données/i.test(s.querySelector('.sec-title')?.textContent || ''),
      );
      const help = sec.querySelector('.help');
      const btn = sec.querySelector('button');
      return Math.round(btn.getBoundingClientRect().top - help.getBoundingClientRect().bottom);
    });
    ok(near(e4, 12), `E4 : « Aucun jeu de données… » → bouton : ${e4} px (12)`);
    const e5 = await p.evaluate(() => {
      const t = document.querySelector('.panel .notes-sec .sec-title');
      const lock = t.querySelector('.lock');
      const svg = lock.querySelector('svg');
      return {
        oneLine: t.getBoundingClientRect().height <= 22,
        sameLine: Math.abs(svg.getBoundingClientRect().top - lock.getBoundingClientRect().top) < 6,
      };
    });
    ok(e5.oneLine && e5.sameLine, 'E5 : en-tête des notes sur une ligne, cadenas à côté de « Privées »');
    const e6 = await p.evaluate(() => {
      const sec = [...document.querySelectorAll('.panel .sec')].find((s) =>
        /Lecture/i.test(s.querySelector('.sec-title')?.textContent || ''),
      );
      const rows = [...sec.querySelectorAll('.setting')];
      const help = rows[1].parentElement.querySelector('.help');
      return {
        help: Math.round(help.getBoundingClientRect().top - rows[1].getBoundingClientRect().bottom),
        rows: Math.round(rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().bottom),
        rule: rows.some((r) => getComputedStyle(r).borderTopWidth !== '0px'),
      };
    });
    ok(
      near(e6.help, 4) && near(e6.rows, 16) && !e6.rule,
      `E6 : aide ${e6.help} px (4), lignes ${e6.rows} px (16), sans filet`,
    );
    return [];
  });

  // ===== Éditeur > Étape (E7 à E9) et Design (E10 à E12) =====
  await appPage(b, editor, 'light', async (p) => {
    const e7 = await p.evaluate(() => {
      const st = document.querySelector('.panel .ab-sec .fd-stack--action');
      if (!st) return null;
      return Math.round(
        st.querySelector(':scope > button').getBoundingClientRect().top -
          st.querySelector(':scope > .help').getBoundingClientRect().bottom,
      );
    });
    ok(near(e7, 12), `E7 : test A/B, texte → « Créer une variante B » : ${e7} px (12)`);
    const e9 = await p.evaluate(() => {
      const h = document.querySelector('.panel .rules-sec .sec-title');
      const ref = document.querySelector('.panel .sec:not(.rules-sec) > .sec-title');
      if (!h || !ref) return null;
      const a = getComputedStyle(h);
      const r = getComputedStyle(ref);
      return (
        a.fontSize === r.fontSize &&
        a.textTransform === r.textTransform &&
        !h.parentElement.querySelector('.fd-icon-chip')
      );
    });
    ok(e9 === true, 'E9 : « Suite de l’étape » avec le titre de section commun');
    await p.getByRole('tab', { name: 'Design' }).click();
    await p.waitForTimeout(400);
    const e10 = await p.evaluate(() => {
      const f = document.querySelector('.panel .fr-fields');
      const sw = f.querySelector('.setting');
      const field = sw.nextElementSibling;
      return Math.round(field.getBoundingClientRect().top - sw.getBoundingClientRect().bottom);
    });
    ok(near(e10, 20), `E10 : « Barre d’adresse » → « Adresse affichée » : ${e10} px (20)`);
    const e10b = await p.evaluate(() => {
      const f = document.querySelector('.panel .fr-fields');
      const next = f.nextElementSibling;
      return Math.round(next.getBoundingClientRect().top - f.getBoundingClientRect().bottom);
    });
    ok(near(e10b, 20), `E10 : cadre → « Fond autour du cadre » : ${e10b} px (20)`);
    const e11 = await p.evaluate(() => {
      const btn = document.querySelector('.panel .sty-save');
      const prev = btn?.previousElementSibling;
      return btn && prev
        ? Math.round(btn.getBoundingClientRect().top - prev.getBoundingClientRect().bottom)
        : null;
    });
    ok(near(e11, 12), `E11 : styles → « Enregistrer le style actuel » : ${e11} px (12)`);
    const e12 = await p.evaluate(() => {
      const row = document.querySelector('.panel .logo-row');
      const check = row.parentElement.querySelector('.check');
      return Math.round(check.getBoundingClientRect().top - row.getBoundingClientRect().bottom);
    });
    ok(near(e12, 16), `E12 : médiathèque → « Afficher Créé avec TutoClick » : ${e12} px (16)`);
    return [];
  });

  // ===== Partager (E13 à E15) =====
  const share = { name: 'Partager', route: `/#/demos/${DEMO}/share` };
  await appPage(b, { ...share, route: `/#/demos/${DEMO}/share?tab=embed` }, 'light', async (p) => {
    await p.waitForTimeout(400);
    const e13 = await p.evaluate(() => {
      const panel = document.querySelector('#sh-panel-embed');
      const where = panel.querySelector('.snip-where');
      const mode = panel.querySelector('.sh-embed-mode');
      const guide = panel.querySelector('.snip-guide');
      const r = (el) => el.getBoundingClientRect();
      return {
        a: Math.round(r(mode).top - r(where).bottom),
        b: Math.round(r(guide).top - r(mode).bottom),
        label: mode.querySelector('.t-label')?.textContent,
      };
    });
    ok(
      near(e13.a, 24) && near(e13.b, 24) && !!e13.label,
      `E13 : groupes à ${e13.a} et ${e13.b} px (24), libellé « ${e13.label} »`,
    );
    const e14 = await p.evaluate(() => {
      const st = document.querySelector('#sh-panel-embed .sh-field .fd-stack--action');
      const btn = st?.querySelector('button');
      return btn
        ? Math.round(
            btn.getBoundingClientRect().top - st.querySelector('.help').getBoundingClientRect().bottom,
          )
        : null;
    });
    ok(near(e14, 12), `E14 : aide → « Enregistrer » : ${e14} px (12)`);
    return [];
  });
  await appPage(b, { ...share, route: `/#/demos/${DEMO}/share?tab=link` }, 'light', async (p) => {
    await p.waitForTimeout(400);
    const e15 = await gap(p, '#sh-slug-help', '.sh-addr-actions');
    ok(e15 === null || near(e15, 12), `E15 : aide → « Enregistrer l’adresse » : ${e15} px (12)`);
    return [];
  });

  // ===== Paramètres (E16 à E20) =====
  await appPage(b, page('Profil'), 'light', async (p) => {
    const e16 = await p.evaluate(() => {
      const c = document.querySelector('.st-mydata');
      return Math.round(
        c.querySelector('.st-mydata-act').getBoundingClientRect().top -
          c.querySelector('p.muted').getBoundingClientRect().bottom,
      );
    });
    ok(near(e16, 12), `E16 : « Mes données » texte → bouton : ${e16} px (12)`);
    const e17 = await p.evaluate(() => {
      const lang = document.querySelector('label[for="loc"]').getBoundingClientRect().left;
      const app = document.querySelector('.st-pf-fs legend').getBoundingClientRect().left;
      return Math.round(app - lang);
    });
    ok(e17 === 0, `E17 : « Apparence » aligné sur « Langue » (${e17} px)`);
    return [];
  });
  await appPage(b, page('Marque'), 'light', async (p) => {
    const m = await p.evaluate(() => {
      const r = (el) => el.getBoundingClientRect();
      const col = document.querySelector('[aria-labelledby="br-col-t"]');
      const lastField = [...col.querySelectorAll('.br-colors')].at(-1);
      const save = col.querySelector('.br-actions');
      const pp = document.querySelector('[aria-labelledby="br-pp-t"]');
      const f = [...pp.querySelectorAll(':scope > .field')];
      const sty = document.querySelector('[aria-labelledby="br-sty-t"]');
      const mine = sty.querySelector('#br-mine-t');
      return {
        e18: save ? Math.round(r(save).top - r(lastField).bottom) : null,
        e19: Math.round(r(f[1]).top - r(f[0]).bottom),
        e20: Math.round(r(mine.nextElementSibling).top - r(mine).bottom),
      };
    });
    ok(near(m.e18, 24), `E18 : couleurs → « Enregistrer » : ${m.e18} px (24)`);
    ok(near(m.e19, 24), `E19 : « Bouton principal » → « Bouton secondaire » : ${m.e19} px (24)`);
    ok(near(m.e20, 12), `E20 : « Styles de l’espace » → contenu : ${m.e20} px (12)`);
    return [];
  });

  // ===== Modale Exporter (E21) =====
  await appPage(b, page('Démos · export PDF'), 'light', async (p) => {
    await p.waitForTimeout(400);
    const m = await p.evaluate(() => {
      const rows = [...document.querySelectorAll('dialog[open] .exp-format')];
      const r = (el) => el.getBoundingClientRect();
      return {
        n: rows.length,
        minH: Math.min(...rows.map((x) => r(x).height)),
        gaps: rows.slice(1).map((x, i) => Math.round(r(x).top - r(rows[i]).bottom)),
        oneLine: rows.every((x) => r(x.querySelector('small')).height <= 20),
        soon: rows.filter((x) => x.querySelector('input').disabled && x.querySelector('.soon')).length,
      };
    });
    ok(m.n === 5 && m.minH >= 60, `E21 : 5 formats en liste, ${Math.round(m.minH)} px de haut au moins (60)`);
    ok(
      m.gaps.every((g) => g === 8),
      `E21 : 8 px entre les lignes (${m.gaps.join(', ')})`,
    );
    ok(m.oneLine, 'E21 : descriptions sur une ligne');
    ok(m.soon === 1, 'E21 : « Hors ligne » visible, désactivé, badge « Bientôt »');
    await p.keyboard.press('Escape').catch(() => {});
    return [];
  });

  await b.close();
})().catch((e) => {
  console.log(`NOT OK - ${e.message.split('\n')[0]}`);
  process.exit(1);
});
