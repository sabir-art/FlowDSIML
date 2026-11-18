/**
 * Contrat central entre l'éditeur, le player, l'extension et les Edge Functions.
 * Le manifeste publié est IMMUABLE : chaque publication produit une nouvelle version.
 * Toute évolution incompatible incrémente MANIFEST_SCHEMA_VERSION ; le player doit
 * continuer à lire les versions antérieures.
 */
import { z } from 'zod';

export const MANIFEST_SCHEMA_VERSION = 1 as const;

/** Coordonnées relatives (0–1) au cadre de l'image de l'étape. */
export const rectSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});
export type Rect = z.infer<typeof rectSchema>;

/** L12-01 : zone masquée d'une capture (flou, pixels ou aplat de couleur, texte facultatif). */
export const maskSchema = rectSchema.extend({
  style: z.enum(['blur', 'pixels', 'solid']).default('blur').catch('blur'),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#2A2F3A')
    .catch('#2A2F3A'),
  text: z.string().max(60).default('').catch(''),
  /** Zones copiées sur toutes les étapes (même position) : même identifiant de groupe. */
  group: z.string().max(40).optional().catch(undefined),
});
export type Mask = z.infer<typeof maskSchema>;

export const placementSchema = z.enum(['auto', 'top', 'bottom', 'left', 'right']);

export const hotspotActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('next') }),
  z.object({ type: z.literal('goto'), stepId: z.string() }),
  z.object({ type: z.literal('url'), url: z.string().url(), newTab: z.boolean().default(true) }),
  z.object({ type: z.literal('none') }),
]);
export type HotspotAction = z.infer<typeof hotspotActionSchema>;

export const ctaSchema = z.object({
  label: z.string().max(80),
  url: z.string().url(),
});
export type Cta = z.infer<typeof ctaSchema>;

export const hotspotSchema = rectSchema.extend({
  id: z.string(),
  /** Titre et corps en texte riche restreint (voir @flowdsiml/core richText). */
  title: z.string().max(200).default(''),
  body: z.string().max(4000).default(''),
  placement: placementSchema.default('auto'),
  action: hotspotActionSchema.default({ type: 'next' }),
  cta: ctaSchema.nullable().default(null),
  pulse: z.boolean().default(true),
  /** F1 : « beacon » = Walkthrough (pastille + bulle) ; « spotlight » = zone éclairée, reste assombri. */
  style: z.enum(['beacon', 'spotlight']).default('beacon').catch('beacon'),
});
export type Hotspot = z.infer<typeof hotspotSchema>;

export const zoomSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  scale: z.number().min(1).max(4),
  /** L12-02 : « smooth » glisse depuis l'état précédent, « instant » saute directement. */
  transition: z.enum(['smooth', 'instant']).default('smooth').catch('smooth'),
  /** L12-02 : l'étape suivante (sans zoom propre) garde ce zoom. */
  keep: z.boolean().default(false).catch(false),
});
export type Zoom = z.infer<typeof zoomSchema>;

export const imageRefSchema = z.object({
  url: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

/** F1 : destination d'un choix de parcours (étape, chapitre, fin de la démo ou lien). */
export const choiceActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('goto'), stepId: z.string() }),
  z.object({ type: z.literal('chapter'), chapterId: z.string() }),
  z.object({ type: z.literal('end') }),
  z.object({ type: z.literal('url'), url: z.string().url().startsWith('https://') }),
]);
export type ChoiceAction = z.infer<typeof choiceActionSchema>;

/** F1 : choix de parcours (« Vous êtes conseiller → parcours A »). */
export const choiceSchema = z.object({ label: z.string().max(80), action: choiceActionSchema });
export type Choice = z.infer<typeof choiceSchema>;

/** F1 : options d'affichage d'une étape (pop-up, variante, menu de choix). */
export const stepOptionsSchema = z
  .object({
    /** « popup » : carte centrée par-dessus l'écran précédent ; « screen » : écran plein. */
    display: z.enum(['screen', 'popup']).default('screen').catch('screen'),
    variant: z.enum(['info', 'instruction']).default('info').catch('info'),
    /** Fond d'une pop-up : capture précédente floutée, ou couleur unie. */
    background: z.enum(['blur', 'color']).default('blur').catch('blur'),
    bgColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default('#080808')
      .catch('#080808'),
    showIcon: z.boolean().default(true).catch(true),
    /** Libellé du bouton principal (vide = « Suivant »). */
    buttonLabel: z.string().max(40).default('').catch(''),
    /** L12-05 : libellé de « Précédent » dans la bulle (vide = thème) et affichage du bouton. */
    prevLabel: z.string().max(24).default('').catch(''),
    showPrev: z.boolean().default(false).catch(false),
    /** Choix invalides ignorés un par un (un lien mal formé n'invalide pas la démo). */
    choices: z
      .array(z.unknown())
      .max(6)
      .default([])
      .catch([])
      .transform((list) =>
        list.flatMap((c) => {
          const r = choiceSchema.safeParse(c);
          return r.success ? [r.data] : [];
        }),
      ),
  })
  .default({
    display: 'screen',
    variant: 'info',
    background: 'blur',
    bgColor: '#080808',
    showIcon: true,
    buttonLabel: '',
    prevLabel: '',
    showPrev: false,
    choices: [],
  });
export type StepOptions = z.infer<typeof stepOptionsSchema>;

export const stepSchema = z.object({
  id: z.string(),
  chapterId: z.string().nullable().default(null),
  kind: z.enum(['image', 'text', 'html']),
  /** Pour kind = image (MVP). */
  image: imageRefSchema.nullable().default(null),
  /** Pour kind = html (V2) : URL du snapshot assaini. */
  snapshotUrl: z.string().nullable().default(null),
  /** Pour kind = text : écran de titre / transition. */
  title: z.string().max(200).default(''),
  body: z.string().max(4000).default(''),
  hotspots: z.array(hotspotSchema).default([]),
  blurs: z.array(maskSchema).default([]),
  zoom: zoomSchema.nullable().default(null),
  /** Formulaire de lead affiché avant cette étape. */
  gateFormId: z.string().nullable().default(null),
  cta: ctaSchema.nullable().default(null),
  options: stepOptionsSchema,
});
export type Step = z.infer<typeof stepSchema>;

/** F2 : question de quiz (réponses : 2 à 6 ; vrai/faux : 2 réponses fixes). */
export const quizQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(['single', 'multiple', 'truefalse']),
  prompt: z.string().max(200),
  answers: z
    .array(z.object({ id: z.string(), label: z.string().max(200), correct: z.boolean().default(false) }))
    .min(2)
    .max(6),
  explanation: z.string().max(1000).default(''),
  stepId: z.string().nullable().default(null),
  points: z.number().int().min(1).max(100).default(1),
});
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

/** F2 : quiz de validation du module (ou sondage : même moteur, sans bonne réponse ni seuil). */
export const quizSchema = z.object({
  mode: z.enum(['quiz', 'survey']).default('quiz').catch('quiz'),
  threshold: z.number().int().min(0).max(100).default(70),
  /** 0 = illimitées. */
  attempts: z.number().int().min(0).max(5).default(3),
  feedback: z.enum(['each', 'end']).default('each').catch('each'),
  shuffle: z.boolean().default(true),
  required: z.boolean().default(true),
  questions: z.array(quizQuestionSchema).min(1),
});
export type Quiz = z.infer<typeof quizSchema>;

export const chapterSchema = z.object({ id: z.string(), title: z.string().max(120) });
export type Chapter = z.infer<typeof chapterSchema>;

export const themeSchema = z.object({
  // Valeurs par défaut = tokens --fd-player-* (packages/ui/src/tokens.ts)
  // Charte DSI des Missions Locales (refonte) : prune, framboise, fond ardoise 100
  primary: z.string().default('#A3195B'),
  hotspot: z.string().default('#D60B52'),
  background: z.string().default('#EEF2F6'),
  surface: z.string().default('#FFFFFF'),
  text: z.string().default('#080808'),
  fontFamily: z.string().default("'Plus Jakarta Sans', system-ui, sans-serif"),
  radius: z.number().min(0).max(32).default(20),
  logoUrl: z.string().nullable().default(null),
  showBranding: z.boolean().default(true),
  /** Fond dégradé du lecteur (maquette editeur.html, onglet Design › Cadre). */
  backgroundGradient: z.boolean().default(false),
});
export type Theme = z.infer<typeof themeSchema>;

export const variableSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  label: z.string().max(80).default(''),
  default: z.string().max(200).default(''),
});
export type Variable = z.infer<typeof variableSchema>;

export const formFieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  label: z.string().max(80),
  type: z.enum(['email', 'text', 'tel']),
  required: z.boolean().default(false),
});
export const formSchema = z.object({
  id: z.string(),
  title: z.string().max(120),
  description: z.string().max(500).default(''),
  submitLabel: z.string().max(40).default('Continuer'),
  fields: z.array(formFieldSchema).min(1),
  consentText: z.string().max(500).default(''),
  skippable: z.boolean().default(false),
});
export type LeadForm = z.infer<typeof formSchema>;

export const manifestSchema = z.object({
  schemaVersion: z.literal(MANIFEST_SCHEMA_VERSION),
  demoId: z.string(),
  versionId: z.string(),
  workspaceId: z.string(),
  /** PLY-01 : nom du workspace (en-tête du lecteur, « Données traitées par … »). Absent avant la migration 131500. */
  workspaceName: z.string().max(120).default('').catch(''),
  title: z.string(),
  locale: z.string().default('fr'),
  publishedAt: z.string(),
  theme: themeSchema,
  variables: z.array(variableSchema).default([]),
  chapters: z.array(chapterSchema).default([]),
  steps: z.array(stepSchema).min(1),
  forms: z.array(formSchema).default([]),
  /** Origines autorisées à embarquer la démo (vide = toutes). Contrôle côté player, contournable. */
  allowedEmbedOrigins: z.array(z.string()).default([]),
  /** F1 : checklist de progression (un élément par chapitre, sinon par étape) dans le player. */
  checklist: z
    .object({
      title: z.string().max(80).default(''),
      position: z.enum(['left', 'right', 'collapsed']).default('right').catch('right'),
    })
    .nullable()
    .default(null)
    .catch(null),
  /** F1 : lecture automatique (avance seule après delayMs, avec pause). */
  autoplay: z
    .object({
      enabled: z.boolean().default(false),
      delayMs: z.number().int().min(1500).max(30000).default(4000),
    })
    .nullable()
    .default(null)
    .catch(null),
  /** F2 : quiz après la dernière étape (null si le module n'en a pas). */
  quiz: quizSchema.nullable().default(null).catch(null),
  /** Bouton d'action du client, affiché en permanence dans la barre du player (P6). */
  cta: ctaSchema.nullable().default(null),
  /** P13 : politique de confidentialité du workspace (https), affichée sous les formulaires de lead. */
  privacyUrl: z.string().url().startsWith('https://').nullable().default(null).catch(null),
  /** URL de l'endpoint d'ingestion analytics. */
  trackUrl: z.string().nullable().default(null),
});
export type Manifest = z.infer<typeof manifestSchema>;

export function parseManifest(input: unknown): Manifest {
  return manifestSchema.parse(input);
}

/** Événements analytics émis par le player. */
export const eventTypeSchema = z.enum([
  'demo_view',
  'step_view',
  'hotspot_click',
  'cta_click',
  'form_view',
  'form_submit',
  'demo_complete',
]);
export type EventType = z.infer<typeof eventTypeSchema>;

export const trackEventSchema = z.object({
  type: eventTypeSchema,
  stepId: z.string().nullable().optional(),
  hotspotId: z.string().nullable().optional(),
  stepIndex: z.number().int().min(0).optional(),
  props: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  at: z.string().optional(),
});
export const trackBatchSchema = z.object({
  demoId: z.string().uuid(),
  versionId: z.string().uuid(),
  linkToken: z.string().max(64).nullable().optional(),
  visitorId: z.string().min(8).max(64),
  sessionId: z.string().min(8).max(64),
  referrer: z.string().max(500).nullable().optional(),
  embedOrigin: z.string().max(300).nullable().optional(),
  events: z.array(trackEventSchema).min(1).max(50),
});
export type TrackBatch = z.infer<typeof trackBatchSchema>;
