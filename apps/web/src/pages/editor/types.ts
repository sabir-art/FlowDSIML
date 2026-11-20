import type { Tables } from '@flowdsiml/supabase-types';
import {
  stepOptionsSchema,
  type Cta,
  type HotspotAction,
  type Rect,
  type StepOptions,
  type Theme,
  type Zoom,
} from '@flowdsiml/manifest';

export type DemoRow = Tables<'demos'>;
export type StepRow = Tables<'steps'>;
export type HotspotRow = Tables<'hotspots'>;
export type ChapterRow = Tables<'chapters'>;
export type FormRow = Tables<'forms'>;
export type VariableRow = Tables<'variables'>;
export type QuestionRow = Tables<'quiz_questions'>;

export type DemoSettings = {
  /** Langue du contenu (L30-03 : copies traduites ; arabe lu de droite à gauche). */
  locale?: 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'ar';
  allowedEmbedOrigins?: string[];
  /** L30-11 : dernière voix de synthèse choisie pour la démo. */
  aiVoice?: string;
  theme?: Partial<Theme>;
  cta?: Cta | null;
  /** F1 : mode de lecture de toute la démo (visite guidée = pastille + bulle). */
  mode?: 'walkthrough' | 'spotlight';
  /** F1 : checklist de progression dans le player (un élément par chapitre). */
  checklist?: { enabled: boolean; title?: string; position?: 'left' | 'right' | 'collapsed' };
  /** L17 : false = termes du glossaire du workspace non soulignés dans cette démo. */
  glossary?: boolean;
  /** F1 : lecture automatique (délai en ms, 1500–30000). */
  autoplay?: { enabled: boolean; delayMs: number };
  /** F2 : réglages du quiz du module. */
  quiz?: {
    mode?: 'quiz' | 'survey';
    threshold?: number;
    attempts?: number;
    feedback?: 'each' | 'end';
    shuffle?: boolean;
    required?: boolean;
  };
};

export type FormField = {
  key: string;
  label: string;
  type: 'email' | 'text' | 'tel';
  required: boolean;
};

/** Accès typés aux colonnes JSON. */
export const asRects = (v: unknown): Rect[] => (Array.isArray(v) ? (v as Rect[]) : []);
/** L12-01 : zones masquées (flou, pixels, aplat) telles qu'enregistrées dans steps.blurs. */
export type MaskRect = Rect & {
  style?: 'blur' | 'pixels' | 'solid';
  color?: string;
  text?: string;
  group?: string;
};
export const asMasks = (v: unknown): MaskRect[] => (Array.isArray(v) ? (v as MaskRect[]) : []);
export const asZoom = (v: unknown): Zoom | null => (v && typeof v === 'object' ? (v as Zoom) : null);
export const asCta = (v: unknown): Cta | null =>
  v && typeof v === 'object' && 'url' in (v as object) ? (v as Cta) : null;
export const asAction = (v: unknown): HotspotAction =>
  v && typeof v === 'object' && 'type' in (v as object) ? (v as HotspotAction) : { type: 'next' };
export const asSettings = (v: unknown): DemoSettings =>
  v && typeof v === 'object' ? (v as DemoSettings) : {};
export const asFields = (v: unknown): FormField[] => (Array.isArray(v) ? (v as FormField[]) : []);

export type Selection =
  | { kind: 'step' }
  | { kind: 'hotspot'; id: string }
  | { kind: 'blur'; index: number }
  /** EDT-08 : formulaire de lead sélectionné dans le rail (avant l'étape qu'il précède). */
  | { kind: 'form'; id: string }
  /** L25-02 : recadrage de la capture de l'étape. */
  | { kind: 'crop' };
export const asStepOptions = (v: unknown): StepOptions => stepOptionsSchema.parse(v ?? {});

/** F2 : réponse d'une question (jsonb answers). */
export type QuizAnswer = { id: string; label: string; correct: boolean };
export const asAnswers = (v: unknown): QuizAnswer[] => (Array.isArray(v) ? (v as QuizAnswer[]) : []);

/** L17 : origine d'une capture d'une étape Avant / Après (étape copiée ou image importée). */
export type BeforeAfterSource = { kind: 'step'; stepId: string } | { kind: 'upload'; name: string };
/** L17 : réglages d'une étape Avant / Après (steps.options.beforeAfter). */
export type BeforeAfterConfig = {
  layout: 'side' | 'slider' | 'toggle';
  labels: { before: string; after: string };
  notes: { before: string; after: string };
  sources: { before?: BeforeAfterSource; after?: BeforeAfterSource };
};
export const BA_LABEL_MAX = 20;
export const BA_NOTE_MAX = 140;
export function asBeforeAfter(options: unknown): BeforeAfterConfig {
  const raw = ((options ?? {}) as { beforeAfter?: Partial<BeforeAfterConfig> }).beforeAfter ?? {};
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  return {
    layout: raw.layout === 'slider' || raw.layout === 'toggle' ? raw.layout : 'side',
    labels: { before: str(raw.labels?.before, BA_LABEL_MAX), after: str(raw.labels?.after, BA_LABEL_MAX) },
    notes: { before: str(raw.notes?.before, BA_NOTE_MAX), after: str(raw.notes?.after, BA_NOTE_MAX) },
    sources: raw.sources && typeof raw.sources === 'object' ? raw.sources : {},
  };
}
/** L17 : une étape Avant / Après publiable a ses deux captures. */
export const beforeAfterComplete = (s: {
  kind: string;
  image_path: string | null;
  before_image_path: string | null;
}) => s.kind !== 'before_after' || (!!s.image_path && !!s.before_image_path);
