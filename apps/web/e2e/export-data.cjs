/**
 * L15 : démo publiée à exporter (données inventées, « Mission Locale Exemple »). Le manifeste est
 * celui de la version publiée ; les captures sont servies par le faux Storage (fixture.png).
 */
const STEPS = [
  ['Ouvrir le menu Usagers', 'Le menu se trouve dans la barre de gauche.', [0.02, 0.2, 0.16, 0.06]],
  ['Filtrer par structure', 'Choisissez votre antenne pour réduire la liste.', [0.25, 0.12, 0.2, 0.06]],
  [
    'Cliquer sur « + Ajouter »',
    'Depuis la liste des usagers, le bouton se trouve en haut à droite.',
    [0.78, 0.06, 0.16, 0.08],
  ],
  ['Renseigner l’identité', 'Nom, prénom et date de naissance sont obligatoires.', [0.3, 0.3, 0.4, 0.1]],
  [
    'Choisir la structure de rattachement',
    'La structure détermine le conseiller référent.',
    [0.3, 0.45, 0.4, 0.08],
  ],
  ['Vérifier les informations', 'Relisez la fiche avant de l’enregistrer.', [0.3, 0.6, 0.4, 0.12]],
  ['Enregistrer la fiche', 'La fiche apparaît dans la liste des usagers.', [0.72, 0.85, 0.2, 0.07]],
];

function seedExport(d, { published = true, steps = STEPS.length, video = null } = {}) {
  const t = d.tables;
  const demo = t.demos[0];
  const ws = t.workspaces[0];
  ws.name = 'Mission Locale Exemple';
  demo.title = 'Créer une fiche usager';
  if (!published) {
    demo.status = 'draft';
    demo.current_version_id = null;
    return;
  }
  demo.status = 'published';
  demo.current_version_id = demo.current_version_id || 'v-export';
  const manifest = {
    schemaVersion: 1,
    demoId: demo.id,
    versionId: demo.current_version_id,
    workspaceId: ws.id,
    workspaceName: 'Mission Locale Exemple',
    title: 'Créer une fiche usager',
    locale: 'fr',
    publishedAt: '2026-11-10T09:00:00Z',
    theme: { primary: '#A3195B' },
    variables: [],
    steps: STEPS.slice(0, steps).map(([title, body, [x, y, w, h]], i) => ({
      id: `st-${i + 1}`,
      kind: 'image',
      image: { url: `assets/st-${i + 1}.webp`, width: 1100, height: 750 },
      hotspots: [{ id: `h-${i + 1}`, x, y, w, h, title, body }],
    })),
  };
  // L25-11 : étape vidéo (L21) ajoutée à la fin, servie par le faux Storage (fixture-video.webm)
  if (video)
    manifest.steps.push({
      id: 'st-video',
      kind: 'video',
      title: 'Démonstration filmée',
      video: { url: 'assets/st-video.webm', durationMs: 12008, cuts: video.cuts || [] },
      hotspots: [],
    });
  t.demo_versions = (t.demo_versions || []).filter((v) => v.id !== demo.current_version_id);
  t.demo_versions.push({
    id: demo.current_version_id,
    demo_id: demo.id,
    number: 3,
    manifest,
    published_at: manifest.publishedAt,
  });
  t.paths = [...(t.paths || []), { id: 'p-export', workspace_id: ws.id, title: 'Nouvel outil de gestion' }];
  t.path_modules = [
    ...(t.path_modules || []),
    { path_id: 'p-export', demo_id: demo.id, workspace_id: ws.id, position: 0, required: true },
  ];
}

module.exports = { seedExport, STEPS };
