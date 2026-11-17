/**
 * Données de démonstration identiques aux maquettes d'origine (docs/ux/maquettes/*.html) :
 * workspace « Acme Analytics », Camille Martin, 24 démos (18 publiées), 128 leads, 6 membres,
 * 3 dossiers. Sert au script de conformité (images côte à côte maquette | app).
 */
const { seed } = require('./fake-supabase.cjs');

const DEMOS = [
  ['Créer un rapport en 2 minutes', 'published', 'Site web', 8],
  ['Onboarding — import de données', 'published', 'Onboarding', 9],
  ['Démo Acme × Globex (perso)', 'published', 'Sales — Outbound', 10],
  ['Tableau de bord temps réel', 'draft', 'Site web', 11],
  ['Intégration HubSpot', 'published', 'Site web', 12],
  ['Nouveautés de novembre', 'published', 'Onboarding', 13],
];

function seedMaquette() {
  const s = seed();
  const t = s.tables;
  const ws = t.workspaces[0];
  Object.assign(ws, { name: 'Acme Analytics', slug: 'acme-analytics', plan_code: 'business' });
  s.user.email = 'camille@acme.example';
  t.profiles[0].full_name = 'Camille Martin';
  const now = Date.now();
  t.folders = ['Sales — Outbound', 'Site web', 'Onboarding'].map((name, i) => ({
    id: `f-${i + 1}`,
    workspace_id: ws.id,
    name,
    created_at: new Date(now + i * 1000).toISOString(),
  }));
  const base = t.demos[0];
  const hours = [2, 24, 72, 120, 24 * 9, 24 * 11];
  t.demos = Array.from({ length: 24 }, (_, i) => {
    const [title, status, folder] = DEMOS[i % DEMOS.length];
    const at = new Date(now - (hours[i % hours.length] + Math.floor(i / 6) * 24 * 14) * 3600e3).toISOString();
    return {
      ...base,
      id: i === 0 ? base.id : `0b5c1f0e-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
      title: i < DEMOS.length ? title : `${title} (${Math.floor(i / DEMOS.length) + 1})`,
      // 18 publiées sur 24
      status: i < 18 ? (status === 'draft' ? 'published' : status) : 'draft',
      current_version_id: i < 18 ? `v-${i + 1}` : null,
      folder_id: t.folders.find((f) => f.name === folder).id,
      created_at: at,
      updated_at: at,
    };
  });
  // Versions publiées (date de publication) ; la démo 1 a des modifications non publiées
  t.demo_versions = t.demos
    .filter((d) => d.current_version_id)
    .map((d) => ({ id: d.current_version_id, demo_id: d.id, number: 1, published_at: d.updated_at }));
  t.demo_versions[0].published_at = new Date(Date.parse(t.demos[0].updated_at) - 3 * 3600e3).toISOString();
  // Variables et liens personnalisés de la maquette partage.html
  t.variables = [
    { id: 'var-1', workspace_id: ws.id, key: 'first_name', label: 'Prénom', default_value: 'vous' },
    { id: 'var-2', workspace_id: ws.id, key: 'company', label: 'Entreprise', default_value: 'votre équipe' },
  ];
  t.share_links = [
    ['Globex — Léa Dupont', { first_name: 'Léa', company: 'Globex' }, null],
    ['Initech — Marc Petit', { first_name: 'Marc', company: 'Initech' }, null],
    ['Salon de l’emploi', {}, '2026-11-30T23:00:00Z'],
  ].map(([name, variables, expires_at], i) => ({
    id: `sl-${i + 1}`,
    demo_id: t.demos[0].id,
    workspace_id: ws.id,
    token: `tok-${i + 1}`,
    name,
    variables,
    expires_at,
    is_active: true,
    created_by: s.user.id,
    created_at: new Date(now - i * 86400e3).toISOString(),
  }));
  t.demos[3].status = 'draft';
  t.demos[3].current_version_id = null;
  t.demos[18].status = 'published';
  t.demos[18].current_version_id = 'v-19';
  t.leads = Array.from({ length: 128 }, (_, i) => ({
    id: `lead-${i + 1}`,
    workspace_id: ws.id,
    demo_id: t.demos[i % 6].id,
    email:
      i === 0
        ? 'lea@globex.example'
        : i === 1
          ? 'j.martin@umbrella.example'
          : `contact${i + 1}@exemple.example`,
    fields:
      i === 0
        ? { name: 'Léa Dupont', company: 'Globex' }
        : i === 1
          ? { company: 'Umbrella' }
          : i % 4 === 0
            ? { company: 'Initech' }
            : {},
    consent: true,
    created_at: new Date(now - i * 3600e3).toISOString(),
  }));
  // Membres de la maquette parametres.html (noms et rôles), plus une invitation en attente
  const people = [
    ['u-2', 'Thomas Bernard', 'thomas@acme.example', 'admin'],
    ['u-3', 'Inès Haddad', 'ines@acme.example', 'editor'],
    ['u-4', 'Hugo Lefèvre', 'hugo@acme.example', 'editor'],
    ['u-5', 'Nina Roux', 'nina@acme.example', 'viewer'],
  ];
  t.members = [
    t.members[0],
    ...people.map(([id, , , role]) => ({
      workspace_id: ws.id,
      user_id: id,
      role,
      created_at: new Date(now).toISOString(),
    })),
  ];
  s.memberDirectory = Object.fromEntries(people.map(([id, full_name, email]) => [id, { full_name, email }]));
  t.invitations = [
    {
      id: 'inv-1',
      workspace_id: ws.id,
      email: 'paul@acme.example',
      role: 'editor',
      token: 'tok-paul',
      invited_by: s.user.id,
      accepted_at: null,
      created_at: '2026-11-15T09:00:00Z',
      expires_at: '2026-11-22T09:00:00Z',
    },
  ];
  return s;
}

module.exports = { seedMaquette };
