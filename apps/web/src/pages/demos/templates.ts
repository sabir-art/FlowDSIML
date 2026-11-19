/**
 * L26-04 / L26-05 : modèles de formation. La structure (instantané jsonb, voir la migration
 * 20261121090000_modeles.sql) décrit chapitres, étapes, bulles, quiz et réglages.
 */
import type { Tables } from '@flowdsiml/supabase-types';

export type Template = Tables<'demo_templates'>;
export type TemplateCategory = 'logiciel' | 'procedure' | 'reglementaire' | 'accueil';
export const CATEGORIES: TemplateCategory[] = ['logiciel', 'procedure', 'reglementaire', 'accueil'];
export type StepType = 'bulle' | 'saisie' | 'quiz' | 'popup' | 'fin' | 'texte';

export interface TemplateStep {
  type: StepType;
  title: string;
  /** Étape avec capture (bulle, saisie) : sans image, elle sera « À capturer ». */
  image?: unknown;
}
export interface TemplateChapter {
  title: string;
  steps: TemplateStep[];
}
interface Structure {
  chapters?: TemplateChapter[];
  quiz?: unknown[];
  settings?: { quiz?: { threshold?: number }; checklist?: { enabled?: boolean } };
  features?: string[];
}

const structureOf = (t: Template): Structure =>
  t.structure && typeof t.structure === 'object' && !Array.isArray(t.structure)
    ? (t.structure as Structure)
    : {};

export const chaptersOf = (t: Template): TemplateChapter[] =>
  (structureOf(t).chapters ?? []).map((c) => ({
    title: c.title ?? '',
    steps: (c.steps ?? []).map((s) => ({ type: s.type, title: s.title ?? '', image: s.image })),
  }));

const isCapture = (s: TemplateStep) => s.type === 'bulle' || s.type === 'saisie';

/** Nombre de chapitres, d'étapes, d'étapes à capturer et ce qui caractérise le modèle. */
export function summary(t: Template) {
  const st = structureOf(t);
  const chapters = chaptersOf(t);
  const steps = chapters.flatMap((c) => c.steps);
  // Un modèle d'espace sans chapitre a un chapitre sans titre : il ne compte pas
  const nChapters = chapters.filter((c) => c.title).length || (steps.length ? 1 : 0);
  const features: Array<'quiz' | 'avant_apres' | 'seuil' | 'checklist' | 'cta'> = [];
  const declared = st.features;
  if (declared) {
    for (const f of declared)
      if (f === 'quiz' || f === 'avant_apres' || f === 'seuil' || f === 'checklist' || f === 'cta')
        features.push(f);
  } else {
    if ((st.quiz ?? []).length) features.push('quiz');
    if (st.settings?.checklist?.enabled) features.push('checklist');
  }
  return {
    chapters: nChapters,
    steps: steps.length,
    toCapture: steps.filter((s) => isCapture(s) && !(t.with_captures && s.image)).length,
    features,
    threshold: st.settings?.quiz?.threshold ?? 70,
  };
}
