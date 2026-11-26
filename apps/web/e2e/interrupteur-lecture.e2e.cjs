/**
 * Interrupteur activé mais désactivé (recette UX de 31bc369 et bc4b452) : dans l'éditeur ouvert par un
 * lecteur, « Lecture automatique » et « Sous-titres affichés » (Voix off, pour toute la démo) ont la piste
 * grise du composant partagé, pas la prune de la maquette (.mk). Propriétaire : piste prune.
 * Usage : [THEME=dark] node e2e/interrupteur-lecture.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { themedContext } = require('./_theme.cjs');
const { openTool } = require('./editor-rail.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};

/** Couleurs de la piste et du bouton des deux interrupteurs, et des jetons attendus. */
async function pistes(p) {
  return p.evaluate(() => {
    const probe = (v) => {
      const e = document.createElement('span');
      e.style.color = `var(${v})`;
      document.body.append(e);
      const c = getComputedStyle(e).color;
      e.remove();
      return c;
    };
    const sw = [...document.querySelectorAll('.vo-demo input[role=switch]')].map((i) => {
      const tr = i.nextElementSibling;
      return {
        checked: i.checked,
        disabled: i.disabled || i.getAttribute('aria-disabled') === 'true',
        track: getComputedStyle(tr).backgroundColor,
        knob: getComputedStyle(tr, '::after').backgroundColor,
      };
    });
    return {
      sw,
      muted: probe('--fd-color-text-muted'),
      surface: probe('--fd-color-surface'),
      primary: probe('--fd-color-primary'),
    };
  });
}

(async () => {
  const b = await chromium.launch();
  const errors = [];
  for (const role of ['viewer', 'owner']) {
    const state = seed();
    state.tables.members[0].role = role;
    const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await install(p, state);
    await p.goto(`${APP}/#/demos/${DEMO}/edit`);
    await openTool(p, 'voice');
    await p.locator('.vo-demo input[role=switch]').first().waitFor();
    const r = await pistes(p);
    if (role === 'viewer')
      ok(
        r.sw.length === 2 &&
          r.sw.every((s) => s.checked && s.disabled && s.track === r.muted && s.knob === r.surface),
        `lecteur : « Lecture automatique » et « Sous-titres affichés » activés et désactivés, piste grise (${JSON.stringify(r)})`,
      );
    else
      ok(
        r.sw.length === 2 && r.sw.every((s) => s.checked && !s.disabled && s.track === r.primary),
        `propriétaire : interrupteurs actifs, piste prune (${JSON.stringify(r.sw)})`,
      );
    await ctx.close();
  }
  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})();
