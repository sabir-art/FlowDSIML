/**
 * L24 : audit d'accessibilité automatisé (axe-core, règles WCAG 2.1 A et AA) sur les pages
 * principales de l'app, du lecteur et du centre, en clair et en sombre. Échoue s'il reste une
 * violation « serious » ou « critical ».
 * Usage : app web (:5173) et player (:5174) lancés avec VITE_SUPABASE_ANON_KEY défini,
 * puis `node e2e/a11y.e2e.cjs [--report fichier.json] [filtre…]`.
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const fs = require('fs');
const { install } = require('./fake-supabase.cjs');
const { seedMaquette } = require('./maquette-data.cjs');
const { seedPathTables, learnersFixture } = require('./learners-data.cjs');
const { centerFixture, seedCenterTables } = require('./center-data.cjs');
const { seedExport } = require('./export-data.cjs');

const APP = process.env.APP_URL || 'http://localhost:5173';
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const BLOCKING = new Set(['serious', 'critical']);
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };

/** L16 : démo publiée et une diffusion SCORM d'une version ancienne (données fictives). */
function seedDiffusion(d) {
  seedExport(d, { steps: 3 });
  const v = d.tables.demo_versions.find((x) => x.id === d.tables.demos[0].current_version_id);
  d.tables.demos[0].updated_at = v.published_at;
  d.tables.training_centers = [];
  d.tables.diffusions = [
    {
      id: 'df-1',
      workspace_id: d.tables.workspaces[0].id,
      demo_id: DEMO,
      kind: 'scorm',
      label: 'SCORM 1.2 · v2',
      settings: { version: '1.2', pass: { kind: 'steps' }, stats: false, number: 2 },
      version_id: 'v-ancienne',
      created_by: null,
      first_at: v.published_at,
      last_at: v.published_at,
      uses: 1,
    },
  ];
  d.embedViews = [{ origin: 'https://intranet.acme.example', views: 312, last_at: v.published_at }];
}

/** L23 : un webhook actif et deux envois (données fictives). */
function seedGlossary(d) {
  const ws = d.tables.workspaces[0].id;
  d.tables.glossary_terms = [
    ['Dossier usager', 'fiche bénéficiaire', 'Toutes les informations d’une personne accompagnée.'],
    ['Tableau de bord', 'synthèse mensuelle', 'Page d’accueil qui regroupe vos indicateurs.'],
  ].map(([term, old_term, definition], i) => ({
    id: `gl-${i}`,
    workspace_id: ws,
    term,
    old_term,
    definition,
    forms: [],
    created_by: null,
    created_at: '2026-11-19T08:00:00Z',
    updated_at: '2026-11-19T08:00:00Z',
  }));
}

function seedWebhooks(d) {
  const ws = d.tables.workspaces[0].id;
  const at = new Date(Date.now() - 3600_000).toISOString();
  d.tables.webhooks = [
    {
      id: 'wh-a11y',
      workspace_id: ws,
      url: 'https://hooks.acme.example/tutoclick',
      name: 'CRM interne',
      events: ['lead.created'],
      state: 'active',
      failures: 0,
      secret_hint: 'b58b',
      created_by: null,
      created_at: at,
      updated_at: at,
    },
  ];
  d.tables.webhook_deliveries = ['success', 'dead'].map((status, i) => ({
    id: `d-a11y-${i}`,
    workspace_id: ws,
    webhook_id: 'wh-a11y',
    event_id: `e-${i}`,
    event_type: 'lead.created',
    payload: { id: `e-${i}`, type: 'lead.created', data: {} },
    status,
    attempt: status === 'dead' ? 6 : 1,
    next_attempt_at: at,
    response_status: status === 'dead' ? 503 : 200,
    response_body: 'ok',
    duration_ms: 120,
    error: status === 'dead' ? 'HTTP 503' : null,
    replay_of: null,
    created_at: at,
    finished_at: at,
  }));
}

/** L19 : temps réel, sondages, segments et alertes (données fictives). */
function seedL19(d) {
  const ws = d.tables.workspaces[0].id;
  const demo = d.tables.demos.find((x) => x.status === 'published') || d.tables.demos[0];
  const at = new Date().toISOString();
  d.live = {
    kpis: { live: 2, views30: 9, ctaToday: 3, leadsToday: 1 },
    stepsTotal: 4,
    more: 0,
    visitors: [
      {
        key: 'a',
        lastAt: at,
        since: at,
        stepIndex: 1,
        stepTitle: 'Bienvenue',
        device: 'mobile',
        country: 'FR',
        lastType: 'step_view',
        identity: 'lea@acme.example',
      },
      {
        key: 'b',
        lastAt: at,
        since: at,
        stepIndex: 2,
        stepTitle: null,
        device: 'desktop',
        country: null,
        lastType: 'step_view',
        identity: null,
      },
    ],
  };
  d.surveys = {
    [demo.id]: [
      {
        id: 'q1',
        type: 'nps',
        prompt: 'Recommanderiez-vous ce tutoriel ?',
        responses: 24,
        nps: { histogram: [0, 0, 1, 0, 1, 2, 2, 3, 5, 6, 4], score: 25 },
        choices: null,
      },
      {
        id: 'q2',
        type: 'single',
        prompt: 'Votre rôle',
        responses: 10,
        nps: null,
        choices: [
          { id: 'a', label: 'Conseiller', n: 7 },
          { id: 'b', label: 'Encadrant', n: 3 },
        ],
      },
    ],
  };
  d.tables.segments = [
    {
      id: 'sg1',
      workspace_id: ws,
      name: 'Visiteurs sur mobile',
      match: 'all',
      conditions: [{ field: 'device', op: 'is', value: 'mobile' }],
      created_at: at,
      updated_at: at,
    },
  ];
  d.tables.alerts = [
    {
      id: 'al1',
      workspace_id: ws,
      trigger: 'lead',
      threshold: null,
      demo_id: null,
      path_id: null,
      segment_id: null,
      channels: ['app'],
      frequency: 'immediate',
      active: true,
      created_at: at,
    },
    {
      id: 'al2',
      workspace_id: ws,
      trigger: 'completion_below',
      threshold: 40,
      demo_id: demo.id,
      path_id: null,
      segment_id: null,
      channels: ['app'],
      frequency: 'daily',
      active: false,
      created_at: at,
    },
  ];
}

/** Pages de l'app (faux Supabase). `open` amène la page dans l'état audité (modale ouverte…). */
const APP_PAGES = [
  { name: 'Connexion', route: '/#/login', signedOut: true },
  { name: 'Inscription', route: '/#/signup', signedOut: true },
  { name: 'Mot de passe oublié', route: '/#/forgot-password', signedOut: true },
  { name: 'Démos', route: '/#/' },
  {
    name: 'Démos · nouvelle démo',
    route: '/#/',
    open: async (p) => {
      await p.getByRole('button', { name: 'Nouvelle démo' }).first().click();
      await p.waitForSelector('dialog[open]');
    },
  },
  {
    name: 'Démos · export PDF',
    route: '/#/',
    seed: (d) => seedExport(d),
    open: async (p) => {
      await p
        .getByRole('button', { name: /Actions.*Créer une fiche usager/ })
        .first()
        .click();
      await p.getByRole('menuitem', { name: 'Exporter (PDF, GIF)' }).click();
      await p.waitForFunction(() =>
        /\d+ pages/.test(document.querySelector('.x15-foot .fd-help')?.textContent || ''),
      );
    },
  },
  { name: 'Éditeur', route: `/#/demos/${DEMO}/edit` },
  { name: 'Quiz (éditeur)', route: `/#/demos/${DEMO}/quiz` },
  { name: 'Partager', route: `/#/demos/${DEMO}/share` },
  { name: 'Partager · accès', route: `/#/demos/${DEMO}/share?tab=access` },
  { name: 'Analytics d’une démo', route: `/#/demos/${DEMO}/analytics` },
  { name: 'Analytics', route: '/#/analytics' },
  { name: 'Leads', route: '/#/analytics?tab=leads' },
  {
    name: 'Analytics · temps réel',
    route: '/#/analytics?tab=live',
    seed: seedL19,
    open: (p) => p.waitForSelector('.l19-hero'),
  },
  {
    name: 'Analytics · sondages et tests',
    route: '/#/analytics?tab=tests',
    seed: seedL19,
    open: (p) => p.waitForSelector('.l19 .chart-card, .l19 .empty'),
  },
  {
    name: 'Analytics · segments',
    route: '/#/analytics?tab=segments',
    seed: seedL19,
    open: (p) => p.waitForSelector('fieldset.cond'),
  },
  {
    name: 'Analytics · alertes',
    route: '/#/analytics?tab=alerts',
    seed: seedL19,
    open: (p) => p.waitForSelector('.al-row'),
  },
  {
    name: 'Analytics · nouvelle alerte',
    route: '/#/analytics?tab=alerts',
    seed: seedL19,
    open: async (p) => {
      await p.getByRole('button', { name: 'Nouvelle alerte' }).click();
      await p.waitForSelector('dialog.l19-alert[open]');
    },
  },
  {
    name: 'Apprenants',
    route: '/#/learners',
    seed: (d) => {
      seedPathTables(d.tables, d.tables.workspaces[0].id);
      d.learners = learnersFixture().progress;
    },
  },
  { name: 'Centre de formation (réglages)', route: '/#/center', seed: (d) => seedCenterTables(d) },
  { name: 'Profil', route: '/#/settings/profile' },
  { name: 'Membres', route: '/#/settings/members' },
  { name: 'Workspace', route: '/#/settings/workspace' },
  { name: 'Plans', route: '/#/settings/plans' },
  { name: 'Marque', route: '/#/settings/brand' },
  { name: 'Variables', route: '/#/settings/variables' },
  { name: 'Glossaire (vide)', route: '/#/settings/glossary' },
  { name: 'Glossaire', route: '/#/settings/glossary', seed: seedGlossary },
  { name: 'Intégrations', route: '/#/settings/integrations', seed: seedWebhooks },
  // L16 : modale « Diffuser » (onglets SCORM, Intranet, E-mail, Où elle est diffusée)
  ...['SCORM', 'Intranet', 'E-mail', 'Où elle est diffusée'].map((c) => ({
    name: `Diffuser · ${c}`,
    route: `/#/demos/${DEMO}/distribute`,
    seed: seedDiffusion,
    open: async (p) => {
      await p.waitForSelector('dialog.dif-dialog[open] .dif-sub');
      await p
        .locator('dialog.dif-dialog[open]')
        .getByRole('tab', { name: new RegExp(`^${c}`) })
        .click();
    },
  })),
  {
    name: 'Intégrations · ajout',
    route: '/#/settings/integrations',
    seed: seedWebhooks,
    open: (p) => p.getByRole('button', { name: 'Ajouter un webhook' }).first().click(),
  },
  {
    name: 'Intégrations · détail',
    route: '/#/settings/integrations/wh-a11y',
    seed: seedWebhooks,
    open: (p) => p.locator('.l23-log tbody tr').first().click(),
  },
];

/** Pages du lecteur et du centre (réponses des fonctions simulées). */
const PLAYER_PAGES = [
  { name: 'Lecteur · démo', path: '/d/0b5c1f0e-0000-4000-8000-000000000001' },
  {
    name: 'Lecteur · mot de passe',
    path: '/d/0b5c1f0e-0000-4000-8000-000000000001',
    gate: { status: 'password_required' },
  },
  {
    name: 'Lecteur · lien expiré',
    path: '/d/0b5c1f0e-0000-4000-8000-000000000001',
    gate: { status: 'expired' },
  },
  { name: 'Centre · accueil', path: '/c/ml-exemple?l=jeton-alex-0001', center: () => centerFixture() },
  {
    name: 'Centre · visiteur anonyme',
    path: '/c/ml-exemple',
    center: () => centerFixture({ identified: false }),
  },
  {
    name: 'Centre · formation terminée',
    path: '/c/ml-exemple/f/00000000-0000-4000-8000-0000000000f2?l=jeton-alex-0001',
    center: () => centerFixture(),
  },
  { name: 'Centre · mot de passe', path: '/c/ml-exemple', center: () => ({ status: 'password_required' }) },
];

async function audit(page) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return r.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.length,
    targets: v.nodes.slice(0, 4).map((n) => n.target.join(' ')),
    why: v.nodes
      .slice(0, 4)
      .map((n) => (n.failureSummary || '').split('\n').slice(1).join(' ').slice(0, 200)),
  }));
}

async function appPage(b, s, theme) {
  const ctx = await b.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR',
    colorScheme: theme,
  });
  const p = await ctx.newPage();
  await p.addInitScript((th) => {
    try {
      localStorage.setItem('fd.theme', th);
    } catch {
      /* stockage indisponible */
    }
  }, theme);
  const data = seedMaquette();
  if (s.seed) s.seed(data);
  await install(p, { ...data, signedOut: Boolean(s.signedOut) });
  await p.goto(`${APP}${s.route}`);
  await p.waitForTimeout(1500);
  if (s.open) await s.open(p);
  await p.waitForTimeout(300);
  const v = await audit(p);
  await ctx.close();
  return v;
}

async function playerPage(b, s, theme) {
  const manifest = require('./player-maquette.cjs');
  const ctx = await b.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR',
    colorScheme: theme,
  });
  const p = await ctx.newPage();
  const json = (r, body) =>
    r.request().method() === 'OPTIONS'
      ? r.fulfill({ status: 204, headers: cors })
      : r.fulfill({ contentType: 'application/json', body: JSON.stringify(body), headers: cors });
  await p.route('**/functions/v1/**', (r) => json(r, {}));
  await p.route('**/functions/v1/open-demo', (r) => json(r, s.gate ?? { status: 'ok', manifest }));
  await p.route('**/functions/v1/open-center', (r) => json(r, s.center ? s.center() : {}));
  await p.route('**/rest/v1/rpc/**', (r) => json(r, null));
  await p.route('**/assets/**', (r) =>
    r.fulfill({ contentType: 'image/png', body: fs.readFileSync(`${__dirname}/fixture.png`), headers: cors }),
  );
  await p.goto(`${PLAYER}/#${s.path}`);
  await p.waitForTimeout(1500);
  const v = await audit(p);
  await ctx.close();
  return v;
}

(async () => {
  const args = process.argv.slice(2);
  const ri = args.indexOf('--report');
  const reportFile = ri >= 0 ? args.splice(ri, 2)[1] : null;
  const only = args;
  const b = await chromium.launch();
  const report = [];
  let blocking = 0;
  const pages = [
    ...APP_PAGES.map((s) => ({ ...s, kind: 'app' })),
    ...PLAYER_PAGES.map((s) => ({ ...s, kind: 'player' })),
  ].filter((s) => !only.length || only.some((o) => s.name.toLowerCase().includes(o.toLowerCase())));
  for (const s of pages)
    for (const theme of ['light', 'dark']) {
      let v;
      try {
        v = s.kind === 'app' ? await appPage(b, s, theme) : await playerPage(b, s, theme);
      } catch (e) {
        console.log(`NOT OK - ${s.name} (${theme}) : audit impossible (${e.message.split('\n')[0]})`);
        process.exitCode = 1;
        continue;
      }
      const bad = v.filter((x) => BLOCKING.has(x.impact));
      blocking += bad.length;
      report.push({ page: s.name, theme, violations: v });
      console.log(
        `${bad.length ? 'NOT OK' : 'ok'} - ${s.name} (${theme})` +
          (v.length ? ` : ${v.map((x) => `${x.id}[${x.impact}]×${x.nodes}`).join(', ')}` : ''),
      );
      for (const x of bad) console.log(`    ${x.id} : ${x.help} → ${x.targets.join(' | ')}`);
    }
  await b.close();
  if (reportFile) fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`\n${blocking} violation(s) serious/critical sur ${pages.length} pages × 2 thèmes`);
  if (blocking) process.exitCode = 1;
})();
