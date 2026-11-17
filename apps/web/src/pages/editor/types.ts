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
  locale?: 'fr' | 'en';
  allowedEmbedOrigins?: string[];
  theme?: Partial<Theme>;
  cta?: Cta | null;
  /** F1 : mode de lecture de toute la démo (visite guidée = pastille + bulle). */
  mode?: 'walkthrough' | 'spotlight';
  /** F1 : checklist de progression dans le player (un élément par chapitre). */
  checklist?: { enabled: boolean; title?: string; position?: 'left' | 'right' | 'collapsed' };
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
export const asZoom = (v: unknown): Zoom | null => (v && typeof v === 'object' ? (v as Zoom) : null);
export const asCta = (v: unknown): Cta | null =>
  v && typeof v === 'object' && 'url' in (v as object) ? (v as Cta) : null;
export const asAction = (v: unknown): HotspotAction =>
  v && typeof v === 'object' && 'type' in (v as object) ? (v as HotspotAction) : { type: 'next' };
export const asSettings = (v: unknown): DemoSettings =>
  v && typeof v === 'object' ? (v as DemoSettings) : {};
export const asFields = (v: unknown): FormField[] => (Array.isArray(v) ? (v as FormField[]) : []);

export type Selection = { kind: 'step' } | { kind: 'hotspot'; id: string } | { kind: 'blur'; index: number };
export const asStepOptions = (v: unknown): StepOptions => stepOptionsSchema.parse(v ?? {});

/** F2 : réponse d'une question (jsonb answers). */
export type QuizAnswer = { id: string; label: string; correct: boolean };
export const asAnswers = (v: unknown): QuizAnswer[] => (Array.isArray(v) ? (v as QuizAnswer[]) : []);
