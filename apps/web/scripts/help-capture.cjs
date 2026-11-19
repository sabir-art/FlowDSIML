/**
 * L26 §3.3-3.4 (arbitrage du chef) : génère les visites guidées et les modules « Apprendre TutoClick »
 * en démos statiques embarquées (apps/web/public/help/<id>/manifest.json + captures WebP), lues par le
 * lecteur existant en aperçu. Source : docs/ux/aide/help-tours.json (scénarios de la Lead UX).
 * Captures prises sur l'app avec le faux Supabase (données fictives, .example), 1440 × 900, thème clair,
 * sans toast. Une visite dont une étape ne peut pas être capturée (surface extension, cible absente) n'est
 * pas générée : l'app l'affiche « Bientôt ». Régénérable : node scripts/help-capture.cjs (app sur :5173).
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { install, seed } = require('../e2e/fake-supabase.cjs');
const { learnersFixture } = require('../e2e/learners-data.cjs');

const BASE = process.env.APP_URL || 'http://localhost:5173';
const ROOT = path.resolve(__dirname, '../../..');
const SRC = path.join(ROOT, 'docs/ux/aide/help-tours.json');
const OUT = path.resolve(__dirname, '../public/help');
const spec = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const DEMO_CRM = '0b5c1f0e-0000-4000-8000-000000000001';
const DEMO_RAPPORT = '0b5c1f0e-0000-4000-8000-000000000002';

/** Noms accessibles réels quand ils diffèrent de l'hypothèse des scénarios (clé : visite#étape). */
const TARGETS = require('./help-targets.cjs');

const idOf = (key) => key.replace(':', '-');
const demoIdFor = (name) => (/rapport/i.test(name || '') ? DEMO_RAPPORT : DEMO_CRM);

function routeFor(route, demo) {
  switch (route) {
    case 'demos':
      return '/#/';
    case 'editor':
      return `/#/demos/${demo}/edit`;
    case 'share':
      return `/#/demos/${demo}/share`;
    case 'share/distribution':
      return `/#/demos/${demo}/distribute`;
    case 'analytics':
      return '/#/analytics';
    case 'learners':
      return '/#/learners';
    case 'center':
      return '/#/center';
    case 'settings/brand':
      return '/#/settings/brand';
    case 'settings/members':
      return '/#/settings/members';
    case 'settings/general':
      return '/#/settings/workspace';
    case 'settings/privacy':
      return '/#/settings/privacy';
    default:
      return null;
  }
}

async function toWebp(page, png) {
  const b64 = png.toString('base64');
  const out = await page.evaluate(async (data) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.8));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  }, b64);
  return Buffer.from(out, 'base64');
}

(async () => {
  const vp = spec.capture.viewport;
  const b = await chromium.launch();
  const ctx = await b.newContext({
    viewport: vp,
    deviceScaleFactor: 1,
    colorScheme: 'light',
    locale: 'fr-FR',
  });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('fd.theme', 'light');
    } catch {
      /* rien */
    }
  });
  const page = await ctx.newPage();
  const state = seed();
  // Données fictives des scénarios : « Créer un rapport en 2 minutes » publiée, avec les étapes de « Démo CRM »
  const second = state.tables.demos.find((d) => d.id === DEMO_RAPPORT);
  second.title = 'Créer un rapport en 2 minutes';
  for (const st of state.tables.steps.filter((x) => x.demo_id === DEMO_CRM)) {
    const sid = `${st.id}-r`;
    state.tables.steps.push({ ...st, id: sid, demo_id: DEMO_RAPPORT });
    for (const h of state.tables.hotspots.filter((x) => x.step_id === st.id))
      state.tables.hotspots.push({ ...h, id: `${h.id}-r`, step_id: sid, demo_id: DEMO_RAPPORT });
  }
  state.tables.demo_versions.push({
    id: second.current_version_id || 'v-2',
    demo_id: DEMO_RAPPORT,
    number: 3,
    manifest: { steps: [] },
    published_by: state.user.id,
    published_at: '2026-11-18T09:00:00Z',
  });
  second.current_version_id = second.current_version_id || 'v-2';
  if (state.tables.profiles?.[0]) state.tables.profiles[0].full_name = 'Alice Exemple';
  // Apprenants fictifs (dont « Léa Exemple », comme dans les scénarios)
  const lf = learnersFixture();
  state.learners = lf.progress;
  state.learnerDetail = lf.detail;
  state.onboarding = Object.fromEntries(
    ['brand', 'extension', 'capture', 'pii', 'publish', 'invite', 'distribute'].map((k) => [k, true]),
  );
  state.onboardingDoneAt = '2026-01-01T00:00:00Z'; // carte de prise en main masquée sur les captures
  await install(page, state);
  // Pas de toast ni d'aide ouverte sur les captures
  await page.addStyleTag({ content: '' }).catch(() => undefined);

  fs.mkdirSync(OUT, { recursive: true });
  const index = [];
  const report = [];
  for (const tour of spec.tours) {
    const id = idOf(tour.key);
    const dir = path.join(OUT, id);
    const steps = [];
    const files = [];
    let ok = true;
    let demo = DEMO_CRM;
    let current = null;
    for (const [i, st] of tour.steps.entries()) {
      const key = `${tour.key}#${i + 1}`;
      const surface = st.surface || 'app';
      if (surface !== 'app') {
        report.push(`${key} : surface « ${surface} » non capturable`);
        ok = false;
        break;
      }
      if (st.setup?.demo) demo = demoIdFor(st.setup.demo);
      const tgt = { ...st.target, ...(TARGETS[key] || {}) };
      const url = routeFor(tgt.route || st.route, demo);
      if (!url) {
        report.push(`${key} : route inconnue « ${st.route} »`);
        ok = false;
        break;
      }
      if (url !== current || st.setup?.demo || tgt.reload) {
        await page.goto(`${BASE}${url}`);
        if (url === current) await page.reload();
        await page.waitForLoadState('networkidle').catch(() => undefined);
        await page.waitForTimeout(600);
        current = url;
      }
      if (tgt.before) {
        for (const act of [].concat(tgt.before)) {
          if (act.key) {
            await page.keyboard.press(act.key);
            continue;
          }
          await (
            act.selector
              ? page.locator(act.selector).first()
              : page.getByRole(act.role, { name: act.name, exact: true }).first()
          )
            .click({ timeout: 3000, force: !!act.selector })
            .catch(() => report.push(`${key} : préparation « ${act.name || act.selector} » impossible`));
        }
        await page.waitForTimeout(500);
      }
      const loc = tgt.selector
        ? page.locator(tgt.selector).first()
        : page.getByRole(tgt.role, { name: tgt.name, exact: tgt.exact !== false }).first();
      const box = await loc
        .waitFor({ state: 'visible', timeout: 4000 })
        .then(() => loc.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => undefined))
        .then(() => page.waitForTimeout(200))
        .then(() => loc.boundingBox())
        .catch(() => null);
      if (!box) {
        report.push(`${key} : cible introuvable ${tgt.role} « ${tgt.name} »`);
        ok = false;
        break;
      }
      await page.mouse.move(0, 0);
      await page.evaluate(() => {
        document.querySelectorAll('.toast, [data-toast], .fd-toast').forEach((e) => e.remove());
        document.activeElement?.blur?.();
      });
      await page.waitForTimeout(150);
      const png = await page.screenshot({ type: 'png' });
      const webp = await toWebp(page, png);
      files.push({ name: `${i + 1}.webp`, buf: webp });
      const pad = 4;
      const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
      const x = clamp((box.x - pad) / vp.width, 0, 0.98);
      const y = clamp((box.y - pad) / vp.height, 0, 0.98);
      steps.push({
        id: `${id}-${i + 1}`,
        chapterId: null,
        kind: 'image',
        image: { url: `${i + 1}.webp`, width: vp.width, height: vp.height },
        snapshotUrl: null,
        beforeAfter: null,
        title: st.title || '',
        body: '',
        blurs: [],
        zoom: null,
        cta: null,
        gateFormId: null,
        hotspots: [
          {
            id: `${id}-${i + 1}-h`,
            x,
            y,
            w: clamp((box.width + 2 * pad) / vp.width, 0.01, 1 - x),
            h: clamp((box.height + 2 * pad) / vp.height, 0.01, 1 - y),
            title: st.title || '',
            body: st.text,
            placement: st.placement || 'auto',
            action: { type: 'next' },
            cta: null,
            pulse: true,
          },
        ],
      });
    }
    fs.rmSync(dir, { recursive: true, force: true });
    if (!ok) continue;
    fs.mkdirSync(dir, { recursive: true });
    for (const f of files) fs.writeFileSync(path.join(dir, f.name), f.buf);
    steps.push({
      id: `${id}-fin`,
      chapterId: null,
      kind: 'text',
      image: null,
      snapshotUrl: null,
      beforeAfter: null,
      title: tour.end?.title || spec.tours[0].end.title,
      body: tour.end?.text || spec.tours[0].end.text,
      blurs: [],
      zoom: null,
      cta: null,
      gateFormId: null,
      hotspots: [],
    });
    const manifest = {
      schemaVersion: 1,
      demoId: `00000000-0000-4000-8000-${String(index.length + 1).padStart(12, '0')}`,
      versionId: `00000000-0000-4000-8000-${String(index.length + 101).padStart(12, '0')}`,
      workspaceId: '00000000-0000-4000-8000-000000000000',
      title: tour.title,
      locale: 'fr',
      publishedAt: '2026-11-20T00:00:00.000Z',
      theme: {},
      variables: [],
      chapters: [],
      forms: [],
      allowedEmbedOrigins: [],
      trackUrl: null,
      steps,
    };
    fs.writeFileSync(path.join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    index.push({
      key: tour.key,
      id,
      kind: tour.kind,
      order: tour.order ?? null,
      title: tour.title,
      steps: tour.steps.length,
    });
  }
  fs.writeFileSync(
    path.join(OUT, 'index.json'),
    `${JSON.stringify({ version: 1, tours: index }, null, 2)}\n`,
  );
  console.log(`${index.length} visite(s) générée(s) sur ${spec.tours.length}`);
  for (const r of report) console.log(`- ${r}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
