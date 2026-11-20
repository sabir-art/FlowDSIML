/** Captures des états du panneau Commentaires (25b à 25i), en clair et en sombre (faux Supabase). */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const BASE = path.resolve(__dirname, '../../../docs/tech/captures/finition');

const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
function withComments(state, { resolvedAll = false } = {}) {
  const st = state.tables.steps.find((s) => s.demo_id === DEMO && s.position === 0);
  const ws = st.workspace_id;
  const marie = '00000000-0000-4000-8000-0000000000aa';
  state.tables.step_comments = [
    {
      id: 'c1',
      step_id: st.id,
      demo_id: DEMO,
      workspace_id: ws,
      author_id: marie,
      body: 'Le libellé du bouton doit suivre la charte : « S’inscrire ».',
      resolved_at: resolvedAll ? ago(5) : null,
      resolved_by: resolvedAll ? state.user.id : null,
      created_at: ago(180),
      updated_at: ago(180),
    },
    {
      id: 'c2',
      step_id: st.id,
      demo_id: DEMO,
      workspace_id: ws,
      author_id: state.user.id,
      body: 'Ajouter une étape sur le choix du conseiller ? Voir https://exemple.test/maquette',
      resolved_at: resolvedAll ? ago(4) : null,
      resolved_by: resolvedAll ? state.user.id : null,
      created_at: ago(30),
      updated_at: ago(25),
    },
    {
      id: 'c3',
      step_id: st.id,
      demo_id: DEMO,
      workspace_id: ws,
      author_id: marie,
      body: 'Capture à refaire avec les données de démonstration.',
      resolved_at: ago(10),
      resolved_by: state.user.id,
      created_at: ago(300),
      updated_at: ago(300),
    },
  ];
  state.extraMembers = [
    { user_id: marie, email: 'marie.durand@exemple.test', full_name: 'Marie Durand', role: 'editor' },
  ];
  return state;
}

(async () => {
  const b = await chromium.launch();
  for (const theme of ['light', 'dark']) {
    const OUT = theme === 'dark' ? path.join(BASE, 'sombre') : BASE;
    fs.mkdirSync(OUT, { recursive: true });
    const open = async (state, { width = 1440, height = 900, role } = {}) => {
      const ctx = await b.newContext({ viewport: { width, height } });
      await ctx.addInitScript((t) => {
        localStorage.setItem('fd.theme', t);
        localStorage.setItem('fd.editor.comments.collapsed', '0');
      }, theme);
      const page = await ctx.newPage();
      if (role) state.tables.members[0].role = role;
      await install(page, state);
      await page.goto(`${APP}/#/demos/${DEMO}/edit`);
      await page.waitForSelector('.cm');
      await page.waitForTimeout(600);
      return page;
    };
    const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });

    // 25b vide
    let p = await open(seed());
    await shot(p, '25b-commentaires-vide');
    // 25 liste (2 ouverts) + 25c filtre résolus
    p = await open(withComments(seed()));
    await shot(p, '25-editeur-commentaires');
    await p.getByText(/Afficher les résolus/).click();
    await p.waitForTimeout(200);
    await shot(p, '25c-commentaires-resolus');
    // 25d modification
    await p.getByRole('button', { name: 'Actions sur votre commentaire' }).click();
    await p.getByRole('menuitem', { name: 'Modifier' }).click();
    await p.waitForTimeout(200);
    await shot(p, '25d-commentaires-modification');
    // 25e replié
    await p.keyboard.press('Escape');
    await p.getByRole('button', { name: 'Replier les commentaires' }).click();
    await p.waitForTimeout(200);
    await shot(p, '25e-commentaires-replie');
    // 25f tout résolu
    p = await open(withComments(seed(), { resolvedAll: true }));
    await shot(p, '25f-commentaires-tout-resolu');
    // 25g erreur d'envoi
    p = await open(withComments(seed()));
    await p.route('**/rest/v1/step_comments*', (r) =>
      r.request().method() === 'POST' ? r.fulfill({ status: 500, body: '{}' }) : r.fallback(),
    );
    await p.getByRole('textbox', { name: 'Nouveau commentaire' }).fill('Ce commentaire ne passera pas');
    await p.keyboard.press('Enter');
    await p.waitForTimeout(400);
    await shot(p, '25g-commentaires-erreur');
    // 25h lecteur (viewer)
    p = await open(withComments(seed()), { role: 'viewer' });
    await shot(p, '25h-commentaires-lecteur');
    // 25i mobile
    p = await open(withComments(seed()), { width: 390, height: 844 });
    await p.screenshot({ path: `${OUT}/25i-commentaires-mobile.png`, fullPage: true });
  }
  console.log('captures des commentaires écrites');
  await b.close();
})();
