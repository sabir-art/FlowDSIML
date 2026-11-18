/**
 * L13 : réponse fictive de learners_progress (données inventées, domaines *.example) pour les tests e2e
 * et les captures de conformité. Déterministe : mêmes données à chaque exécution.
 */
const DAY = 86_400_000;

function learnersFixture(now = Date.now()) {
  const ago = (d, h = 0) => new Date(now - d * DAY - h * 3_600_000).toISOString();
  const paths = [
    {
      id: 'p-logiciel',
      title: 'Logiciel métier',
      ordered: true,
      goal: 80,
      modules: [
        { demoId: 'm-prise', title: 'Prise en main', required: true, hasQuiz: false, threshold: 70 },
        { demoId: 'm-fiches', title: 'Fiches usagers', required: true, hasQuiz: false, threshold: 70 },
        { demoId: 'm-agenda', title: 'Agenda', required: true, hasQuiz: false, threshold: 70 },
        { demoId: 'm-quiz', title: 'Quiz final', required: true, hasQuiz: true, threshold: 70 },
      ],
    },
    {
      id: 'p-agenda',
      title: 'Agenda partagé',
      ordered: false,
      goal: 80,
      modules: [
        { demoId: 'a-creer', title: 'Créer un rendez-vous', required: true, hasQuiz: false, threshold: 70 },
        { demoId: 'a-partager', title: 'Partager un agenda', required: true, hasQuiz: false, threshold: 70 },
      ],
    },
    {
      id: 'p-stats',
      title: "Statistiques d'activité",
      ordered: true,
      goal: 80,
      modules: [
        { demoId: 's-tableaux', title: 'Tableaux de bord', required: true, hasQuiz: true, threshold: 70 },
        { demoId: 's-export', title: 'Exports', required: true, hasQuiz: true, threshold: 70 },
        { demoId: 's-indic', title: 'Indicateurs', required: false, hasQuiz: true, threshold: 70 },
      ],
    },
  ];
  const structures = [
    { id: 'st-nord', name: 'Antenne Nord' },
    { id: 'st-sud', name: 'Antenne Sud' },
    { id: 'st-siege', name: 'Siège' },
  ];
  const all = paths.flatMap((p) => p.modules);
  const mod = (demoId, o = {}) => ({
    demoId,
    total: 8,
    seen: 0,
    completed: false,
    hasQuiz: all.find((m) => m.demoId === demoId).hasQuiz,
    best: null,
    used: 0,
    max: all.find((m) => m.demoId === demoId).hasQuiz ? 3 : null,
    status: 'not_started',
    lastActivity: null,
    ...o,
  });
  const done = (id, d) => mod(id, { seen: 8, completed: true, status: 'validated', lastActivity: ago(d) });
  const quiz = (id, d, best, used, passed) =>
    mod(id, {
      seen: 8,
      best,
      used,
      status: passed ? 'validated' : used >= 3 ? 'failed' : 'in_progress',
      lastActivity: ago(d),
    });
  const part = (id, d, seen) => mod(id, { seen, status: 'in_progress', lastActivity: ago(d) });
  const fill = (mods) => all.map((m) => mods.find((x) => x.demoId === m.demoId) || mod(m.demoId));

  const named = [
    [
      'Léa Exemple',
      'lea.exemple@mission-locale.example',
      'st-nord',
      'link',
      30,
      [done('m-prise', 20), part('m-fiches', 12, 3), done('a-creer', 26), done('a-partager', 25)],
    ],
    ['Hugo Test', 'hugo.test@dsi-ml.example', 'st-sud', 'lead', 20, [part('m-prise', 9, 6)]],
    [
      'Nina Demo',
      'nina.demo@mission-locale.example',
      'st-nord',
      'link',
      40,
      [
        done('a-creer', 15),
        part('a-partager', 8, 4),
        quiz('s-tableaux', 10, 80, 1, true),
        part('s-export', 10, 2),
        done('m-prise', 30),
      ],
    ],
    [
      'Camille Exemple',
      'camille@mission-locale.example',
      'st-siege',
      'lead',
      35,
      [done('m-prise', 30), done('m-fiches', 28), done('m-agenda', 25), quiz('m-quiz', 24, 55, 3, false)],
    ],
    [
      'Sam Essai',
      'sam.essai@dsi-ml.example',
      null,
      'lead',
      22,
      [done('a-creer', 14), part('a-partager', 14, 5)],
    ],
    [
      'Inès Modèle',
      'ines.modele@mission-locale.example',
      'st-sud',
      'link',
      12,
      [done('m-prise', 2), done('m-fiches', 2), done('m-agenda', 1), quiz('m-quiz', 1, 92, 1, true)],
    ],
    [
      'Tom Fictif',
      'tom.fictif@dsi-ml.example',
      'st-nord',
      'lead',
      6,
      [done('m-prise', 3), part('m-fiches', 1, 5)],
    ],
  ];
  const first = [
    'Alex',
    'Jade',
    'Louis',
    'Emma',
    'Noah',
    'Lina',
    'Rayan',
    'Chloé',
    'Adam',
    'Zoé',
    'Yanis',
    'Manon',
  ];
  const last = ['Exemple', 'Test', 'Essai', 'Modèle', 'Fictif', 'Demo'];
  const generated = [];
  for (let i = 0; i < 34; i++) {
    const f = first[i % first.length];
    const l = last[(i * 5) % last.length];
    const r = (i * 37) % 100;
    const mods =
      r < 55
        ? [
            done('m-prise', 10 + (i % 9)),
            done('m-fiches', 9 + (i % 7)),
            done('m-agenda', 8 + (i % 6)),
            quiz('m-quiz', 8 + (i % 6), 70 + (i % 30), 1 + (i % 2), true),
          ]
        : r < 75
          ? [done('m-prise', 3), part('m-fiches', i % 6, 2 + (i % 5))]
          : r < 90
            ? [done('a-creer', 4 + (i % 4)), done('a-partager', 3 + (i % 3))]
            : [part('m-prise', 9 + (i % 10), 3)];
    generated.push([
      `${f} ${l}`,
      `${f.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')}.${l.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')}${i}@mission-locale.example`,
      structures[i % 3].id,
      i % 3 === 0 ? 'link' : 'lead',
      40 + (i % 10),
      mods,
    ]);
  }
  const learners = [...named, ...generated].map(([name, email, structureId, source, created, mods], i) => ({
    id: `l-${i + 1}`,
    email,
    name,
    source,
    structureId,
    createdAt: ago(created),
    lastReminder: i === 1 ? ago(1) : null,
    modules: fill(mods),
  }));
  const detail = {
    'l-1': {
      events: [
        { type: 'demo_view', demoId: 'm-fiches', stepIndex: 3, at: ago(12) },
        { type: 'demo_complete', demoId: 'a-partager', stepIndex: null, at: ago(25) },
        { type: 'demo_view', demoId: 'm-prise', stepIndex: 0, at: ago(20, 1) },
      ],
      attempts: [],
      reminders: [ago(13)],
    },
    'l-4': {
      events: [{ type: 'demo_complete', demoId: 'm-agenda', stepIndex: null, at: ago(25) }],
      attempts: [
        { demoId: 'm-quiz', score: 55, passed: false, correct: 5, total: 9, at: ago(24) },
        { demoId: 'm-quiz', score: 44, passed: false, correct: 4, total: 9, at: ago(24, 2) },
        { demoId: 'm-quiz', score: 33, passed: false, correct: 3, total: 9, at: ago(24, 4) },
      ],
      reminders: [],
    },
  };
  return { progress: { paths, structures, learners }, detail };
}

/** L13-06 : réponse fictive de learner_resume pour la démo de player-maquette.cjs (6 étapes). */
function resumeFixture(demoId) {
  return {
    firstName: 'Alex',
    module: { demoId, seen: 3, total: 6, status: 'in_progress' },
    path: {
      title: 'Logiciel métier',
      ordered: true,
      modules: [
        { title: 'Prise en main', status: 'validated', seen: 8, total: 8, current: false },
        { title: 'Fiches usagers', status: 'in_progress', seen: 3, total: 6, current: true },
        { title: 'Agenda', status: null, seen: null, total: null, current: false },
      ],
    },
  };
}

/**
 * L13-07 : tables (paths, path_modules, structures, démos et versions) cohérentes avec learnersFixture,
 * pour la modale « Formations et structures ». `ws` : workspace courant du faux Supabase.
 */
function seedPathTables(tables, ws, now = Date.now()) {
  const { progress } = learnersFixture(now);
  const at = new Date(now - 30 * 86_400_000).toISOString();
  const steps = {
    'm-prise': 8,
    'm-fiches': 12,
    'm-agenda': 9,
    'm-quiz': 6,
    'a-creer': 5,
    'a-partager': 4,
    's-tableaux': 7,
    's-export': 5,
    's-indic': 6,
  };
  const mods = progress.paths.flatMap((p) => p.modules);
  const extra = [
    { demoId: 'x-rdv', title: 'Saisir un rendez-vous', hasQuiz: false },
    { demoId: 'x-liste', title: 'Exporter une liste', hasQuiz: false },
  ];
  tables.paths = progress.paths.map((p, i) => ({
    id: p.id,
    workspace_id: ws,
    title: p.title,
    ordered: p.ordered,
    goal: p.goal,
    created_at: new Date(Date.parse(at) + i * 1000).toISOString(),
    updated_at: at,
  }));
  tables.path_modules = progress.paths.flatMap((p) =>
    p.modules.map((m, i) => ({
      path_id: p.id,
      demo_id: m.demoId,
      workspace_id: ws,
      position: i,
      required: m.demoId !== 'm-agenda' && m.required,
    })),
  );
  const demos = [...mods, ...extra];
  tables.demos = [
    ...(tables.demos || []),
    ...demos.map((m) => ({
      id: m.demoId,
      workspace_id: ws,
      folder_id: null,
      title: m.title,
      status: 'published',
      theme_id: null,
      settings: {},
      cover_path: null,
      current_version_id: `v-${m.demoId}`,
      created_by: 'u-alice',
      created_at: at,
      updated_at: at,
      deleted_at: null,
    })),
  ];
  tables.demo_versions = [
    ...(tables.demo_versions || []),
    ...demos.map((m) => ({
      id: `v-${m.demoId}`,
      demo_id: m.demoId,
      workspace_id: ws,
      number: 1,
      created_at: at,
      manifest: {
        steps: Array.from({ length: steps[m.demoId] || 6 }, () => ({})),
        quiz: m.hasQuiz ? { mode: 'quiz', threshold: 70 } : null,
      },
    })),
  ];
  tables.structures = [
    {
      id: 'st-nord',
      workspace_id: ws,
      name: 'Antenne Nord',
      domains: ['mission-locale.example'],
      created_at: at,
    },
    {
      id: 'st-sud',
      workspace_id: ws,
      name: 'Antenne Sud',
      domains: ['sud.mission-locale.example'],
      created_at: at,
    },
    {
      id: 'st-siege',
      workspace_id: ws,
      name: 'Siège',
      domains: ['dsi-ml.example', 'acme.example'],
      created_at: at,
    },
  ];
}

module.exports = { learnersFixture, resumeFixture, seedPathTables };
