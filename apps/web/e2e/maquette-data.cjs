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
  t.demos[3].status = 'draft';
  t.demos[3].current_version_id = null;
  t.demos[18].status = 'published';
  t.demos[18].current_version_id = 'v-19';
  t.leads = Array.from({ length: 128 }, (_, i) => ({
    id: `lead-${i + 1}`,
    workspace_id: ws.id,
    demo_id: t.demos[i % 6].id,
    email: `contact${i + 1}@exemple.example`,
    fields: {},
    consent: true,
    created_at: new Date(now - i * 3600e3).toISOString(),
  }));
  t.members = [
    t.members[0],
    ...['u-2', 'u-3', 'u-4', 'u-5', 'u-6'].map((id) => ({
      workspace_id: ws.id,
      user_id: id,
      role: 'editor',
      created_at: new Date(now).toISOString(),
    })),
  ];
  return s;
}

module.exports = { seedMaquette };
