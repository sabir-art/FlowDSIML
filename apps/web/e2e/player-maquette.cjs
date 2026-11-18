/** Manifeste de la maquette refonte/player.html (conformité PLY-01) : 6 étapes, formulaire avant l'étape 3. */
const DEMO = '0b5c1f0e-0000-4000-8000-0000000000ba';
const step = (n, extra = {}) => ({
  id: `s${n}`,
  kind: 'image',
  image: { url: 'assets/a.webp', width: 1100, height: 750 },
  title: `Étape ${n}`,
  body: '',
  chapterId: 'c1',
  hotspots: [
    {
      id: `h${n}`,
      x: 0.44,
      y: 0.45,
      w: 0.04,
      h: 0.04,
      title: n === 1 ? 'Commencez ici' : `Étape ${n}`,
      body: n === 1 ? 'Cliquez sur « + Ajouter » pour créer une fiche usager.' : 'Poursuivez le tutoriel.',
      placement: 'auto',
      action: { type: 'next' },
      pulse: true,
    },
  ],
  ...extra,
});
module.exports = {
  schemaVersion: 1,
  demoId: DEMO,
  versionId: '0b5c1f0e-0000-4000-8000-0000000000bb',
  workspaceId: 'w',
  workspaceName: 'DSI Missions Locales',
  title: 'Créer une fiche usager',
  locale: 'fr',
  publishedAt: '2026-11-17T10:00:00Z',
  theme: {},
  variables: [],
  chapters: [{ id: 'c1', title: 'Fiche usager' }],
  forms: [
    {
      id: 'f1',
      title: 'Recevez la suite',
      description: 'Laissez votre e-mail pour continuer le tutoriel.',
      submitLabel: 'Continuer',
      fields: [{ key: 'email', label: 'Email', type: 'email', required: true }],
      consentText: 'J’accepte d’être recontacté au sujet de ce tutoriel.',
      skippable: false,
    },
  ],
  privacyUrl: 'https://example.com/confidentialite',
  cta: { label: 'Revenir au centre de formation', url: 'https://example.com' },
  steps: [1, 2, 3, 4, 5, 6].map((n) => step(n, n === 3 ? { gateFormId: 'f1' } : {})),
};
