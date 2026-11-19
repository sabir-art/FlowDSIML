/**
 * L26-04 / L26-05 : modèles de formation. La structure (instantané jsonb, voir la migration
 * 20261121090000_modeles.sql) décrit chapitres, étapes, bulles, quiz et réglages.
 */
import type { Json, Tables } from '@flowdsiml/supabase-types';
import { supabase } from '../../lib/supabase';

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

const ext = (p: string) => (/\.(png|jpe?g|webp)$/i.exec(p)?.[1] ?? 'webp').toLowerCase();

/**
 * Démo créée depuis un modèle « avec captures » : chaque image d'exemple est copiée dans le dossier de la
 * nouvelle démo (jamais de chemin partagé), puis posée sur l'étape. Une copie qui échoue laisse l'étape
 * « À capturer ».
 */
export async function copyTemplateImages(workspaceId: string, demoId: string) {
  const { data } = await supabase
    .from('steps')
    .select('id, options')
    .eq('demo_id', demoId)
    .not('options->templateImage', 'is', null);
  for (const st of data ?? []) {
    const opts = { ...((st.options ?? {}) as Record<string, unknown>) };
    const from = typeof opts.templateImage === 'string' ? opts.templateImage : null;
    if (!from || !from.startsWith(`${workspaceId}/`)) continue;
    const to = `${workspaceId}/${demoId}/${st.id}-${crypto.randomUUID().slice(0, 8)}.${ext(from)}`;
    const cp = await supabase.storage.from('captures').copy(from, to);
    if (cp.error) continue;
    delete opts.templateImage;
    await supabase
      .from('steps')
      .update({ image_path: to, options: opts as NonNullable<Json> })
      .eq('id', st.id);
  }
}

/** L26-05 : un modèle « avec captures » range ses images dans son propre dossier (<espace>/templates/<id>/). */
export async function copyImagesIntoTemplate(workspaceId: string, templateId: string) {
  const { data } = await supabase.from('demo_templates').select('structure').eq('id', templateId).single();
  const paths = new Set<string>();
  const st = (data?.structure ?? {}) as {
    chapters?: Array<{ steps?: Array<{ image?: { path?: string } }> }>;
  };
  for (const c of st.chapters ?? [])
    for (const s of c.steps ?? []) if (s.image?.path) paths.add(s.image.path);
  const map: Record<string, string> = {};
  let i = 0;
  for (const from of paths) {
    if (!from.startsWith(`${workspaceId}/`)) continue;
    const to = `${workspaceId}/templates/${templateId}/${++i}.${ext(from)}`;
    const cp = await supabase.storage.from('captures').copy(from, to);
    if (!cp.error) map[from] = to;
  }
  if (Object.keys(map).length)
    await supabase.rpc('template_set_images', { p_template: templateId, p_map: map });
}
