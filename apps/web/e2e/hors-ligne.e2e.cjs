/**
 * Démo hors ligne (retours du 24/11, 2e série §8, v1 sans lead ni suivi).
 *  - Diffuser › Hors ligne : taille estimée, avertissement d'accès, limites, « Télécharger l'archive » ;
 *  - l'archive : index.html, lecteur, configuration sans LMS ni suivi, ressources, LISEZ-MOI.txt ; les
 *    formulaires de lead sont retirés du manifeste embarqué ;
 *  - ouverte depuis le disque, réseau coupé : toutes les étapes se lisent, aucune requête ne sort, un lien
 *    externe reste visible mais ne s'ouvre pas (« Disponible en ligne seulement ») ;
 *  - exports interdits par les règles de l'espace, ou rôle sans droit de diffuser : bouton inactif.
 * Données fictives. Usage : [THEME=dark] [SHOTS_DIR=…] node e2e/hors-ligne.e2e.cjs
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const { unzipSync, strFromU8 } = require('fflate');
const { install, seed } = require('./fake-supabase.cjs');
const { seedExport } = require('./export-data.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

function seedOffline(s, { rules = null, role = null } = {}) {
  seedExport(s, { steps: 3, published: true });
  const t = s.tables;
  const v = t.demo_versions.find((x) => x.id === t.demos[0].current_version_id);
  // Un formulaire de lead devant l'étape 2 et un bouton d'action vers un site externe (barre du lecteur)
  v.manifest.forms = [
    { id: 'f1', title: 'Restons en contact', fields: [{ key: 'email', label: 'E-mail', type: 'email' }] },
  ];
  v.manifest.steps[1].gateFormId = 'f1';
  v.manifest.cta = { label: 'Voir le site', url: 'https://www.acme.example/tarifs' };
  t.demos[0].updated_at = v.published_at;
  const body = Buffer.from(JSON.stringify(v.manifest));
  s.storage[`published/${DEMO}/v${v.number}.json`] = { data: body, type: 'application/json' };
  s.storage[`published/${DEMO}/latest.json`] = { data: body, type: 'application/json' };
  if (rules) t.share_rules = [{ workspace_id: t.workspaces[0].id, modes: ['link'], ...rules }];
  if (role) t.members[0].role = role;
  return s;
}

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const open = async (opts) => {
    const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    const state = seedOffline(seed(), opts);
    await install(page, state);
    await page.goto(`${APP}/#/demos/${DEMO}/distribute`);
    const dlg = page.locator('dialog.dif-dialog[open]');
    await dlg.waitFor();
    await dlg.getByRole('tab', { name: 'Hors ligne' }).click();
    await dlg.locator('.dif-off').waitFor();
    return { ctx, page, dlg, state };
  };

  let dir = null;
  // ===== Diffuser › Hors ligne =====
  {
    const { ctx, page, dlg } = await open();
    const tabs = (await dlg.getByRole('tab').allInnerTexts()).map((x) => x.replace(/\s+\d+$/, '').trim());
    ok(
      tabs.join('|') === 'Parcours de formation|SCORM|Intranet|Hors ligne|E-mail|Où elle est diffusée' &&
        !/Bientôt/.test(await dlg.getByRole('tab', { name: 'Hors ligne' }).innerText()),
      `Diffuser : onglet « Hors ligne » avec SCORM et Intranet, sans « Bientôt » (${tabs.join('|')})`,
    );
    const off = dlg.locator('.dif-off');
    await page.waitForFunction(() =>
      /fichiers?$/.test(document.querySelector('.dif-off__facts dd')?.textContent ?? ''),
    );
    ok(
      /^\d+([,.]\d)?\s(Ko|Mo) · 3 fichiers$/.test(
        (await off.locator('.dif-off__facts dd').first().innerText()).trim(),
      ),
      `taille estimée avant de générer (${await off.locator('.dif-off__facts dd').first().innerText()})`,
    );
    ok(
      (await off.locator('.dif-off__warn').innerText()).trim() ===
        'Toute personne qui a le fichier voit la démo, sans mot de passe.',
      'avertissement d’accès avant la génération',
    );
    ok(
      (await off.locator('.dif-off__limits li').count()) === 3,
      'limites : suivi, liens externes, mise à jour',
    );
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/hors-ligne${sfx}.png` });
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      off.getByRole('button', { name: 'Télécharger l’archive' }).click(),
    ]);
    await off.locator('.dif-file').waitFor();
    const name = dl.suggestedFilename();
    ok(/^creer-une-fiche-usager-hors-ligne-\d{4}-\d{2}-\d{2}\.zip$/.test(name), `nom de l’archive (${name})`);
    ok(
      /Archive prête\./.test(await off.locator('.alert-success').innerText()) &&
        (await off.locator('.dif-file b').innerText()) === name,
      'archive prête : fichier nommé, poids affiché',
    );
    ok(
      (await off.locator('.dif-file b').evaluate((el) => {
        const cs = getComputedStyle(el);
        return !/mono/i.test(cs.fontFamily) && cs.fontWeight === '500';
      })) === true,
      'archive prête : nom du fichier en texte normal (500), pas en monospace',
    );
    const again = off.locator('.dif-off__acts .btn');
    ok(
      (await again.innerText()).trim() === 'Télécharger de nouveau' &&
        (await again.getAttribute('class')).includes('btn-secondary'),
      'archive prête : « Télécharger de nouveau » en secondaire',
    );
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/hors-ligne-pret${sfx}.png` });
    const files = unzipSync(fs.readFileSync(await dl.path()));
    const names = Object.keys(files);
    ok(
      ['index.html', 'package.js', 'tutoclick.js', 'tutoclick.css', 'LISEZ-MOI.txt'].every((f) =>
        names.includes(f),
      ) &&
        names.filter((f) => f.startsWith('assets/')).length === 3 &&
        !names.includes('imsmanifest.xml'),
      `archive : page, lecteur, configuration, LISEZ-MOI et 3 captures (${names.join(', ')})`,
    );
    const cfg = JSON.parse(
      strFromU8(files['package.js']).replace('window.TUTOCLICK_PACKAGE = ', '').replace(/;\n$/, ''),
    );
    ok(
      cfg.offline === true && cfg.scorm === null && cfg.stats === null,
      'configuration : hors ligne, ni LMS ni adresse de suivi',
    );
    ok(
      cfg.manifest.forms.length === 0 && cfg.manifest.steps.every((s) => !s.gateFormId),
      'v1 sans lead : formulaires retirés du manifeste embarqué',
    );
    ok(
      /Double-cliquez sur index\.html/.test(strFromU8(files['LISEZ-MOI.txt'])),
      'LISEZ-MOI : explique l’ouverture',
    );
    const html = strFromU8(files['index.html']);
    ok(
      !/https?:\/\//.test(html) && !/type="module"/.test(html),
      'index.html : aucune adresse externe, scripts classiques',
    );
    // Décompressée sur le disque, pour l'ouvrir comme le ferait un double-clic
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tutoclick-hors-ligne-'));
    for (const [f, bytes] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
      fs.writeFileSync(path.join(dir, f), bytes);
    }
    await ctx.close();
  }

  // ===== Ouverte depuis le disque, réseau coupé =====
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, offline: true });
    const page = await ctx.newPage();
    const out = [];
    const popups = [];
    page.on('request', (r) => {
      if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && !r.url().startsWith('blob:'))
        out.push(r.url());
    });
    page.on('pageerror', (e) => errors.push(`archive : ${e.message}`));
    ctx.on('page', (p) => popups.push(p));
    await page.goto(pathToFileURL(path.join(dir, 'index.html')).href);
    await page.locator('.p-root, #root > *').first().waitFor();
    ok((await page.title()) === 'Créer une fiche usager', 'hors ligne : la démo s’ouvre depuis le disque');
    const img = page.locator('#root img').first();
    await img.waitFor();
    ok(
      await img.evaluate((el) => el.complete && el.naturalWidth > 0 && el.src.startsWith('file:')),
      'hors ligne : la capture vient de l’archive',
    );
    // Toutes les étapes, sans formulaire de lead devant l'étape 2
    const next = page.getByRole('button', { name: /Suivant|Étape suivante|Continuer/ }).first();
    let seen = 1;
    for (let i = 0; i < 2; i++) {
      await next.click();
      seen++;
      await page.waitForFunction(
        (n) => new RegExp(`\\b${n}\\s*(/|sur)\\s*3\\b`).test(document.body.innerText),
        seen,
      );
    }
    ok(seen === 3, 'hors ligne : les trois étapes se lisent');
    ok(
      (await page.locator('form').count()) === 0 &&
        (await page.getByText('Restons en contact').count()) === 0,
      'hors ligne : aucun formulaire de lead',
    );
    // Lien externe : visible, mais il ne s'ouvre pas
    const cta = page.getByRole('button', { name: 'Voir le site' }).first();
    await cta.waitFor();
    await cta.click();
    await page.locator('.p-online-only').waitFor();
    ok(
      (await page.locator('.p-online-only').innerText()) === 'Disponible en ligne seulement' &&
        popups.length === 0,
      'hors ligne : lien externe visible, « Disponible en ligne seulement », rien ne s’ouvre',
    );
    ok(out.length === 0, `hors ligne : aucune requête sortante (${out.slice(0, 3).join(' | ')})`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/hors-ligne-lecteur${sfx}.png` });
    await ctx.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }

  // ===== Exports interdits par les règles de l'espace =====
  {
    const { ctx, dlg } = await open({
      rules: { max_link_days: null, publish_role: 'editor', exports_allowed: false },
    });
    const btn = dlg.getByRole('button', { name: 'Télécharger l’archive' });
    const note = await btn.getAttribute('aria-describedby');
    ok(
      (await btn.getAttribute('aria-disabled')) === 'true' &&
        /exports sont désactivés/.test(await dlg.locator(`[id="${note}"]`).innerText()),
      'exports interdits : bouton inactif, la règle de l’espace est dite',
    );
    await ctx.close();
  }

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})();
