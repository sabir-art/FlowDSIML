/**
 * L14 : réponses fictives d'open-center (centre de formation public), données inventées (*.example,
 * « Mission Locale Exemple »). `identified` : visiteur venu par son lien personnel.
 */
const PNG = 'https://storage.example/cover.png';

function centerFixture({
  identified = true,
  style = 'workspace',
  empty = false,
  cover = null,
  statsStarted = false,
} = {}) {
  const st = (status, seen, total) =>
    identified ? { status, seen, total } : { status: null, seen: null, total: null };
  const m = (id, title, o = {}) => ({
    demoId: `00000000-0000-4000-8000-0000000000${id}`,
    title,
    required: true,
    steps: 6,
    hasQuiz: false,
    access: 'open',
    cover: null,
    ...st('not_started', 0, 6),
    ...o,
  });
  const paths = [
    {
      id: '00000000-0000-4000-8000-0000000000f1',
      title: 'Nouvel outil de gestion',
      description: 'Prendre en main le logiciel métier, de la fiche usager à l’agenda.',
      ordered: true,
      isNew: false,
      tags: [
        { name: 'Logiciel métier', color: 'blue' },
        { name: 'Nouveaux agents', color: 'green' },
      ],
      modules: [
        m('a1', 'Prise en main', { cover, ...st('validated', 8, 8) }),
        m('a2', 'Fiches usagers', { ...st('in_progress', 3, 7) }),
        m('a3', 'Agenda'),
        m('a4', 'Quiz final', { hasQuiz: true, required: false }),
      ],
    },
    {
      id: '00000000-0000-4000-8000-0000000000f2',
      title: 'Agenda partagé',
      description: '',
      ordered: false,
      isNew: false,
      tags: [{ name: 'Bureautique', color: 'orange' }],
      modules: [
        m('b1', 'Partager un agenda', { cover, ...st('validated', 6, 6) }),
        m('b2', 'Planifier un rendez-vous', { ...st('validated', 6, 6) }),
      ],
    },
    {
      id: '00000000-0000-4000-8000-0000000000f3',
      title: 'Statistiques d’activité',
      description: 'Lire et exporter les indicateurs de la structure.',
      ordered: false,
      isNew: false,
      tags: [
        { name: 'Pilotage', color: 'plum' },
        { name: 'Logiciel métier', color: 'blue' },
      ],
      modules: [
        m('c1', 'Lire le tableau de bord', {
          hasQuiz: true,
          cover,
          ...(statsStarted ? st('validated', 6, 6) : {}),
        }),
        m('c2', 'Exporter un indicateur', {
          hasQuiz: true,
          ...(statsStarted ? st('in_progress', 2, 8) : {}),
        }),
        m('c3', 'Rapport aux financeurs', { hasQuiz: true, access: 'password' }),
      ],
    },
    {
      id: '00000000-0000-4000-8000-0000000000f4',
      title: 'Accueil d’un nouvel agent',
      description: '',
      ordered: false,
      isNew: true,
      tags: [{ name: 'Nouveaux agents', color: 'green' }],
      modules: [
        m('d1', 'Mes premiers jours', { cover }),
        m('d2', 'Messagerie et agenda'),
        m('d3', 'Où trouver les documents', { access: 'expired' }),
      ],
    },
  ];
  return {
    status: 'ok',
    title: 'Se former aux outils de la Mission Locale',
    workspace: 'Mission Locale Exemple',
    center: {
      title: 'Se former aux outils de la Mission Locale',
      intro: 'Des tutoriels interactifs pour prendre en main vos outils, à votre rythme.',
      brand: '#A3195B',
      accent: '#95C11F',
      style,
      logoPath: null,
      help: 'aide@mission-locale.example',
      a11y: 'non_evalue',
      indexable: false,
      workspace: 'Mission Locale Exemple',
    },
    visitor: identified ? { firstName: 'Alex' } : null,
    paths: empty ? [] : paths,
  };
}

module.exports = { centerFixture, PNG };

/**
 * L14-08 : tables du faux Supabase pour les réglages (formations L13 + étiquettes + module protégé).
 * `published` : centre déjà publié (avec une modification en attente) ; sinon jamais publié.
 */
function seedCenterTables(d, { published = true, empty = false } = {}) {
  const { seedPathTables, learnersFixture } = require('./learners-data.cjs');
  const ws = d.tables.workspaces[0].id;
  d.learners = learnersFixture().progress;
  seedPathTables(d.tables, ws);
  if (empty) {
    d.tables.paths = [];
    d.tables.path_modules = [];
  }
  d.tables.tags = [
    { id: 'tg-1', workspace_id: ws, name: 'Logiciel métier', color: 'blue' },
    { id: 'tg-2', workspace_id: ws, name: 'Bureautique', color: 'orange' },
    { id: 'tg-3', workspace_id: ws, name: 'Pilotage', color: 'plum' },
  ];
  d.tables.demo_tags = [
    { demo_id: 'm-prise', tag_id: 'tg-1', workspace_id: ws },
    { demo_id: 'a-creer', tag_id: 'tg-2', workspace_id: ws },
    { demo_id: 's-tableaux', tag_id: 'tg-3', workspace_id: ws },
  ];
  d.tables.demo_access = [{ demo_id: 's-indic', workspace_id: ws, mode: 'password', expires_at: null }];
  const conf = {
    title: 'Se former aux outils de la Mission Locale',
    intro: 'Des tutoriels interactifs pour prendre en main vos outils, à votre rythme.',
    brand: '#A3195B',
    accent: '#95C11F',
    style: 'workspace',
    a11y: 'non_evalue',
    indexable: false,
    help: 'aide@mission-locale.example',
    paths: (d.tables.paths || []).map((p) => ({ id: p.id, visible: true })),
  };
  d.tables.training_centers =
    empty || !published
      ? []
      : [
          {
            workspace_id: ws,
            slug: 'mission-locale-exemple',
            draft: { ...conf, intro: `${conf.intro} Chaque module se suit en quelques minutes.` },
            published: conf,
            published_at: new Date().toISOString(),
            access_mode: 'link',
            password_changed_at: null,
            updated_at: new Date().toISOString(),
          },
        ];
}

module.exports.seedCenterTables = seedCenterTables;
