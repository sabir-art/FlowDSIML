import type { Tables } from '@flowdsiml/supabase-types';
import type { Cta, HotspotAction, Rect, Theme, Zoom } from '@flowdsiml/manifest';

export type DemoRow = Tables<'demos'>;
export type StepRow = Tables<'steps'>;
export type HotspotRow = Tables<'hotspots'>;
export type ChapterRow = Tables<'chapters'>;
export type FormRow = Tables<'forms'>;
export type VariableRow = Tables<'variables'>;

export type DemoSettings = {
  locale?: 'fr' | 'en';
  allowedEmbedOrigins?: string[];
  theme?: Partial<Theme>;
  cta?: Cta | null;
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
