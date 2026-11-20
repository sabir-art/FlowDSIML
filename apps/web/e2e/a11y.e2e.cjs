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
  // REV-02 à 04 : les trois étapes de l'onboarding
  { name: 'Onboarding · espace', route: '/#/onboarding' },
  {
    name: 'Onboarding · extension',
    route: '/#/onboarding',
    open: async (p) => {
      await p.fill('#ws-name', 'Service RH Acme');
      await p.keyboard.press('Enter');
      await p.waitForSelector('#ob-h2');
    },
  },
  {
    name: 'Onboarding · premiers pas',
    route: '/#/onboarding',
    open: async (p) => {
      await p.fill('#ws-name', 'Service RH Acme');
      await p.keyboard.press('Enter');
      await p.waitForSelector('#ob-h2');
      await p.getByRole('button', { name: /Continuer sans/ }).click();
      await p.waitForSelector('#ob-h3');
    },
  },
  {
    name: 'Démos · nouvelle démo',
    route: '/#/',
    open: async (p) => {
      await p.getByRole('button', { name: 'Nouvelle démo' }).first().click();
      await p.waitForSelector('dialog[open]');
    },
  },
  {
    name: 'Démos · aide',
    route: '/#/',
    open: async (p) => {
      await p.getByRole('button', { name: 'Aide (F1)' }).first().click();
      await p.getByRole('complementary', { name: 'Aide' }).waitFor();
    },
  },
  {
    name: 'Démos · aide, recherche et article',
    route: '/#/',
    open: async (p) => {
      await p.getByRole('button', { name: 'Aide (F1)' }).first().click();
      await p.getByRole('searchbox', { name: 'Rechercher dans l’aide' }).fill('scorm');
      await p.locator('.help-results .help-link').first().waitFor();
    },
  },
  {
    name: 'Démos · partir d’un modèle',
    route: '/#/',
    open: async (p) => {
      await p.getByRole('button', { name: 'Nouvelle démo' }).first().click();
      await p.getByRole('button', { name: /Partir d’un modèle/ }).click();
      await p.getByRole('radio').first().waitFor();
    },
  },
  {
    name: 'Éditeur · enregistrer comme modèle',
    route: `/#/demos/${DEMO}/edit`,
    open: async (p) => {
      await p.getByRole('button', { name: 'Plus d’options' }).click();
      await p.getByRole('menuitem', { name: 'Enregistrer comme modèle' }).click();
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
  // L27 : écrans ajoutés depuis L24
  {
    name: 'Éditeur · onglet Design (styles)',
    route: `/#/demos/${DEMO}/edit`,
    open: async (p) => {
      await p.getByRole('tab', { name: 'Design' }).click();
      await p.waitForTimeout(400);
    },
  },
  // L30-02 et L30-03 : proposition « Rédiger » et aperçu de la traduction
  {
    name: 'Éditeur · Assistance IA (proposition)',
    route: `/#/demos/${DEMO}/edit`,
    seed: (d) => {
      d.ai = {
        enabled: true,
        features: {
          write: true,
          translate: true,
          suggest: true,
          generate: true,
          dataset: true,
          chart: true,
          assistant: true,
        },
        used: 1,
        quota: 500,
        userToday: 0,
        userDailyRequests: 30,
        workspaceQuotaReached: false,
        userQuotaReached: false,
        renewsOn: '2026-12-01',
        canEdit: true,
        canManage: true,
      };
    },
    open: async (p) => {
      await p.locator('.canvas-hotspot').first().click();
      await p.getByRole('button', { name: 'Assistance IA' }).click();
      await p.getByRole('menuitem', { name: 'Raccourcir' }).click();
      await p.getByRole('button', { name: 'Appliquer', exact: true }).waitFor();
    },
  },
  {
    name: 'Éditeur · Traduire (aperçu)',
    route: `/#/demos/${DEMO}/edit`,
    seed: (d) => {
      d.ai = {
        enabled: true,
        features: {
          write: true,
          translate: true,
          suggest: true,
          generate: true,
          dataset: true,
          chart: true,
          assistant: true,
        },
        used: 1,
        quota: 500,
        userToday: 0,
        userDailyRequests: 30,
        workspaceQuotaReached: false,
        userQuotaReached: false,
        renewsOn: '2026-12-01',
        canEdit: true,
        canManage: true,
      };
      d.aiReply = (task, input) => ({ items: input.items.map((i) => ({ id: i.id, text: `EN ${i.text}` })) });
    },
    open: async (p) => {
      await p.getByRole('button', { name: 'Plus d’options' }).click();
      await p.getByRole('menuitem', { name: 'Traduire la démo…' }).click();
      await p.getByRole('button', { name: 'Préparer la traduction' }).click();
      await p.getByRole('button', { name: 'Créer la copie' }).waitFor();
    },
  },
  {
    name: 'Éditeur · Suggestions',
    route: `/#/demos/${DEMO}/edit`,
    seed: (d) => {
      d.ai = {
        enabled: true,
        features: {
          write: true,
          translate: true,
          suggest: true,
          generate: true,
          dataset: true,
          chart: true,
          assistant: true,
        },
        used: 1,
        quota: 500,
        userToday: 0,
        userDailyRequests: 30,
        workspaceQuotaReached: false,
        userQuotaReached: false,
        renewsOn: '2026-12-01',
        canEdit: true,
        canManage: true,
      };
      d.aiReply = (task, input) => ({
        suggestions: [
          {
            id: input.items[0].id,
            type: 'clarity',
            message: 'Phrase ambiguë.',
            proposal: 'Ouvrez la fiche.',
          },
        ],
      });
    },
    open: async (p) => {
      await p.getByRole('button', { name: 'Suggestions' }).click();
      await p.getByRole('button', { name: 'Analyser la démo' }).click();
      await p.getByRole('button', { name: 'Analyser à nouveau' }).waitFor();
    },
  },
  {
    name: 'Éditeur · test A/B',
    route: `/#/demos/${DEMO}/edit`,
    open: async (p) => {
      await p.getByRole('button', { name: 'Créer une variante B' }).click();
      await p.waitForTimeout(400);
    },
  },
  {
    name: 'Éditeur · zone de flou',
    route: `/#/demos/${DEMO}/edit`,
    open: async (p) => {
      await p.getByRole('button', { name: /^2 Écran 2/ }).click();
      await p.locator('.canvas-blur').first().click({ force: true });
      await p.getByRole('radiogroup', { name: 'Style de masquage' }).waitFor();
    },
  },
  { name: 'Diffuser', route: `/#/demos/${DEMO}/distribute` },
  { name: 'Présentateur', route: `/#/demos/${DEMO}/present` },
  {
    name: 'Présenter · lancement',
    route: `/#/demos/${DEMO}/edit`,
    open: async (p) => {
      await p.getByRole('button', { name: 'Présenter', exact: true }).click();
      await p.waitForSelector('dialog[open]');
    },
  },
  { name: 'Quiz (éditeur)', route: `/#/demos/${DEMO}/quiz` },
  { name: 'Partager', route: `/#/demos/${DEMO}/share` },
  {
    name: 'Partager · page publique',
    route: `/#/demos/${DEMO}/share?tab=page`,
    seed: (d) => {
      d.tables.demo_pages = [
        {
          demo_id: DEMO,
          workspace_id: d.tables.workspaces[0].id,
          enabled: true,
          title: '',
          description: 'Démo fictive.',
          cta_label: null,
          cta_url: null,
          style: 'demo',
          related: false,
          indexable: false,
        },
      ];
    },
    open: (p) => p.waitForSelector('.sh-page-form'),
  },
  { name: 'Partager · accès', route: `/#/demos/${DEMO}/share?tab=access` },
  { name: 'Analytics d’une démo', route: `/#/demos/${DEMO}/analytics` },
  { name: 'Analytics', route: '/#/analytics' },
  { name: 'Analytics · sessions', route: '/#/analytics?tab=sessions' },
  {
    name: 'Analytics · mesure des visites',
    route: '/#/analytics',
    open: async (p) => {
      await p.getByRole('button', { name: 'Mesure des visites' }).click();
      await p.getByRole('dialog', { name: 'Mesure des visites' }).waitFor();
    },
  },
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
  {
    name: 'Marque · modifier le style',
    route: '/#/settings/brand',
    // L27 §3.4 : l'aperçu (aria-hidden) montre volontairement les couleurs choisies, même sous le seuil ;
    // le contraste est annoncé en texte à côté du champ (alerte et couleur proposée).
    exclude: '.br-sd-preview',
    open: async (p) => {
      await p.getByRole('button', { name: 'Nouveau style' }).click();
      await p.getByRole('textbox', { name: 'Texte de la bulle', exact: true }).fill('#C8CCD2');
      await p.keyboard.press('Tab');
      await p.waitForSelector('dialog[open] .alert');
    },
  },
  {
    name: 'Marque · style par défaut',
    route: '/#/settings/brand',
    open: async (p) => {
      await p.getByRole('button', { name: 'Actions pour Nuit' }).click();
      await p.getByRole('menuitem', { name: 'Définir par défaut' }).click();
      await p.waitForSelector('dialog[open]');
    },
  },
  {
    name: 'Marque · éditeur',
    route: '/#/settings/brand',
    seed: (d) => {
      d.tables.members[0].role = 'editor';
    },
  },
  {
    name: 'Médiathèque',
    route: '/#/settings/brand',
    open: async (p) => {
      await p
        .getByRole('button', { name: /Médiathèque/ })
        .first()
        .click();
      await p.waitForSelector('dialog[open]');
    },
  },
  { name: 'Sécurité · règles de partage (plan)', route: '/#/settings/security' },
  {
    name: 'Sécurité · règles de partage (Enterprise)',
    route: '/#/settings/security',
    seed: (d) => {
      d.tables.workspaces[0].plan_code = 'enterprise';
    },
  },
  {
    name: 'Sécurité · liens non conformes',
    route: '/#/settings/security',
    seed: (d) => {
      d.tables.workspaces[0].plan_code = 'enterprise';
      for (const x of d.tables.demos.slice(0, 2)) x.status = 'published';
    },
    open: async (p) => {
      await p.getByRole('checkbox', { name: 'Toute personne avec le lien' }).uncheck();
      await p.getByRole('button', { name: 'Enregistrer les règles' }).click();
      await p.waitForSelector('dialog[open]');
    },
  },
  {
    name: 'Partager · règles de l’espace',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/share?tab=access',
    seed: (d) => {
      d.tables.share_rules = [
        {
          workspace_id: d.tables.workspaces[0].id,
          modes: ['password'],
          max_link_days: 30,
          publish_role: 'admin',
          exports_allowed: false,
        },
      ];
    },
  },
  {
    name: 'Démos · accès au dossier',
    route: '/#/',
    seed: (d) => {
      d.tables.workspaces[0].plan_code = 'enterprise';
      d.tables.folders.push({
        id: 'f-rh',
        workspace_id: d.tables.workspaces[0].id,
        name: 'RH',
        parent_id: null,
        restricted: false,
      });
    },
    open: async (p) => {
      await p
        .getByRole('button', { name: /Dossiers/ })
        .first()
        .click();
      await p.getByRole('menuitem', { name: /^RH/ }).click();
      await p.getByRole('button', { name: /RH/ }).first().click();
      await p.getByRole('menuitem', { name: /Accès/ }).click();
      await p.getByRole('radio', { name: 'Membres choisis' }).check();
      await p.waitForSelector('dialog[open] .fa-list');
    },
  },
  { name: 'Variables', route: '/#/settings/variables' },
  { name: 'Glossaire (vide)', route: '/#/settings/glossary' },
  { name: 'Glossaire', route: '/#/settings/glossary', seed: seedGlossary },
  { name: 'Intégrations', route: '/#/settings/integrations', seed: seedWebhooks },
  // VB-01 à 03 : fonctions à venir et Sécurité (cartes « Bientôt »)
  { name: 'Fonctions à venir (IA)', route: '/#/settings/soon?tab=ia' },
  { name: 'Fonctions à venir (CRM)', route: '/#/settings/soon?tab=crm' },
  { name: 'Fonctions à venir (SSO)', route: '/#/settings/soon?tab=sso' },
  { name: 'Sécurité', route: '/#/settings/security' },
  { name: 'Confidentialité', route: '/#/settings/privacy' },
  // L30-01 : Assistance IA désactivée, puis activée (quota, fonctions)
  { name: 'Assistance IA (désactivée)', route: '/#/settings/ai' },
  {
    name: 'Assistance IA (activée)',
    route: '/#/settings/ai',
    seed: (d) => {
      d.ai = {
        enabled: true,
        features: {
          write: true,
          translate: true,
          suggest: true,
          generate: true,
          dataset: true,
          chart: false,
          assistant: true,
        },
        used: 12,
        quota: 500,
        userToday: 0,
        userDailyRequests: 30,
        workspaceQuotaReached: false,
        userQuotaReached: false,
        renewsOn: '2026-12-01',
        canEdit: true,
        canManage: true,
      };
    },
  },
  // L26-11 : télécommande (saisie du code, sans compte)
  { name: 'Télécommande', route: '/#/t' },
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
  // L27 : page publique d'une démo (L19b)
  {
    name: 'Lecteur · page publique',
    path: '/p/0b5c1f0e-0000-4000-8000-000000000001',
    publicPage: {
      demoId: '0b5c1f0e-0000-4000-8000-000000000001',
      title: 'Créer un rapport en 2 minutes',
      description: 'Suivez pas à pas la création d’un rapport, à votre rythme, sans compte.',
      cta: { label: 'Réserver un accompagnement', url: 'https://www.acme.example/rdv' },
      endTitle: 'Besoin d’aide\u202f?',
      endBody: 'Un membre de l’équipe vous accompagne.',
      style: 'light',
      indexable: false,
      steps: 6,
      updatedAt: '2026-11-14T10:00:00Z',
      workspace: 'Acme',
      privacyUrl: 'https://www.acme.example/confidentialite',
      a11y: 'non_evalue',
      a11yUrl: 'https://www.acme.example/accessibilite',
      related: [],
    },
  },
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

async function audit(page, exclude) {
  let builder = new AxeBuilder({ page }).withTags(TAGS);
  if (exclude) builder = builder.exclude(exclude);
  const r = await builder.analyze();
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
  const v = await audit(p, s.exclude);
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
  await p.route('**/rest/v1/rpc/**', (r) =>
    json(r, s.publicPage && r.request().url().includes('/rpc/public_page') ? s.publicPage : null),
  );
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
