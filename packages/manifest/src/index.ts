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
});
export type Hotspot = z.infer<typeof hotspotSchema>;

export const zoomSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  scale: z.number().min(1).max(4),
});
export type Zoom = z.infer<typeof zoomSchema>;

export const imageRefSchema = z.object({
  url: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

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
  blurs: z.array(rectSchema).default([]),
  zoom: zoomSchema.nullable().default(null),
  /** Formulaire de lead affiché avant cette étape. */
  gateFormId: z.string().nullable().default(null),
  cta: ctaSchema.nullable().default(null),
});
export type Step = z.infer<typeof stepSchema>;

export const chapterSchema = z.object({ id: z.string(), title: z.string().max(120) });
export type Chapter = z.infer<typeof chapterSchema>;

export const themeSchema = z.object({
  primary: z.string().default('#0E7C71'),
  background: z.string().default('#1F1D1A'),
  surface: z.string().default('#ffffff'),
  text: z.string().default('#1F1D1A'),
  fontFamily: z.string().default("'Instrument Sans', system-ui, sans-serif"),
  radius: z.number().min(0).max(32).default(10),
  logoUrl: z.string().nullable().default(null),
  showBranding: z.boolean().default(true),
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
