import { MANIFEST_SCHEMA_VERSION, manifestSchema, type Manifest } from '@flowdsiml/manifest';
import type { DemoEditor } from './useDemoEditor';
import { asAction, asAnswers, asCta, asFields, asRects, asSettings, asStepOptions, asZoom } from './types';
import { questionErrors } from './quizValidation';

/**
 * Manifeste de prévisualisation construit côté client (miroir de publish_demo en SQL),
 * avec les URLs signées des captures privées. Jamais publié tel quel.
 */
export function buildDraftManifest(ed: DemoEditor, workspaceName = ''): Manifest {
  const demo = ed.demo!;
  const settings = asSettings(demo.settings);
  return manifestSchema.parse({
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    demoId: demo.id,
    versionId: 'preview',
    workspaceId: demo.workspace_id,
    // EDT-12 : nom du workspace, comme dans le manifeste publié (migration 131500)
    workspaceName,
    title: demo.title,
    locale: settings.locale ?? 'fr',
    publishedAt: new Date().toISOString(),
    theme: settings.theme ?? {},
    variables: ed.variables.map((v) => ({ key: v.key, label: v.label, default: v.default_value })),
    chapters: ed.chapters.map((c) => ({ id: c.id, title: c.title })),
    steps: ed.steps.map((s) => ({
      id: s.id,
      chapterId: s.chapter_id,
      kind: s.kind,
      image: s.image_path
        ? {
            url: ed.imageUrls[s.image_path] ?? '',
            width: s.image_width ?? 1280,
            height: s.image_height ?? 800,
          }
        : null,
      title: s.title,
      body: s.body,
      blurs: asRects(s.blurs),
      zoom: asZoom(s.zoom),
      cta: asCta(s.cta),
      gateFormId: s.gate_form_id,
      options: asStepOptions(s.options),
      hotspots: ed.hotspots
        .filter((h) => h.step_id === s.id)
        .map((h) => ({
          id: h.id,
          x: h.x,
          y: h.y,
          w: h.w,
          h: h.h,
          title: h.title,
          body: h.body,
          placement: h.placement,
          action: asAction(h.action),
          cta: asCta(h.cta),
          pulse: h.pulse,
          style: settings.mode === 'spotlight' ? 'spotlight' : h.style,
        })),
    })),
    forms: ed.forms.map((f) => ({
      id: f.id,
      title: f.title,
      description: f.description,
      submitLabel: f.submit_label,
      fields: asFields(f.fields).length
        ? asFields(f.fields)
        : [{ key: 'email', label: 'Email', type: 'email', required: true }],
      consentText: f.consent_text,
      skippable: f.skippable,
    })),
    allowedEmbedOrigins: settings.allowedEmbedOrigins ?? [],
    cta: settings.cta ?? null,
    quiz: draftQuiz(ed, settings),
    checklist: settings.checklist?.enabled
      ? {
          title: (settings.checklist.title ?? '').slice(0, 80),
          position: settings.checklist.position ?? 'right',
        }
      : null,
    autoplay: settings.autoplay?.enabled
      ? {
          enabled: true,
          delayMs: Math.min(30000, Math.max(1500, Math.round(settings.autoplay.delayMs || 4000))),
        }
      : null,
  });
}

/** F2 : quiz du brouillon (questions valides seulement : l'aperçu reste jouable pendant l'édition). */
function draftQuiz(ed: DemoEditor, settings: ReturnType<typeof asSettings>) {
  const q = settings.quiz ?? {};
  const mode = q.mode === 'survey' ? 'survey' : 'quiz';
  const questions = ed.questions
    .map((x) => ({ ...x, answers: asAnswers(x.answers) }))
    .filter((x) => Object.keys(questionErrors(x, mode)).length === 0)
    .map((x) => ({
      id: x.id,
      type: x.type,
      prompt: x.prompt,
      answers: x.answers,
      explanation: x.explanation,
      stepId: x.step_id,
      points: x.points,
    }));
  if (!questions.length) return null;
  return {
    mode,
    threshold: q.threshold ?? 70,
    attempts: q.attempts ?? 3,
    feedback: q.feedback ?? 'each',
    shuffle: q.shuffle ?? true,
    required: q.required ?? true,
    questions,
  };
}
