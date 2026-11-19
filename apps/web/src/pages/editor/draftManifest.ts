import { asOps } from './html/htmlModel';
import type { StepRow } from './types';
import { MANIFEST_SCHEMA_VERSION, manifestSchema, type Manifest } from '@flowdsiml/manifest';
import type { DemoEditor } from './useDemoEditor';
import {
  asAction,
  asAnswers,
  asBeforeAfter,
  asCta,
  asFields,
  asMasks,
  asRects,
  asSettings,
  asStepOptions,
  asZoom,
} from './types';
import { asVideo } from './video/videoModel';
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
    device: demo.device === 'mobile' ? ('mobile' as const) : ('desktop' as const),
    viewport: null,
    // A8 : démo guidée ou Sandbox
    kind: demo.kind === 'sandbox' ? ('sandbox' as const) : ('guided' as const),
    sandbox: demo.kind === 'sandbox' ? sandboxOf(demo.sandbox, ed.steps) : null,
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
      // L17 : Avant / Après (null tant que la capture « Avant » manque, comme publish_demo)
      beforeAfter:
        s.kind === 'before_after' && s.before_image_path
          ? (() => {
              const ba = asBeforeAfter(s.options);
              return {
                layout: ba.layout,
                labels: ba.labels,
                notes: ba.notes,
                before: {
                  url: ed.imageUrls[s.before_image_path] ?? '',
                  width: s.before_image_width ?? 1280,
                  height: s.before_image_height ?? 800,
                },
                beforeBlurs: asMasks(s.before_blurs),
              };
            })()
          : null,
      // A8 : page HTML (URL signée du bucket html) ; liens résolus comme à la publication
      html:
        s.kind === 'html' && s.html_path
          ? {
              url: ed.imageUrls[s.html_path] ?? '',
              ops: asOps(s.html_ops).filter((o) => o.op !== 'link' || ed.steps.some((x) => x.id === o.value)),
              title: String((s.html_meta as { title?: string } | null)?.title ?? ''),
              viewport: (s.html_meta as { viewport?: { w: number; h: number } } | null)?.viewport ?? null,
              links: resolveLinks(s, ed.steps),
            }
          : null,
      // F7 : vidéo (URL signée du bucket videos) pour l'aperçu
      video:
        s.kind === 'video' && s.video_path && s.video_duration_ms
          ? (() => {
              const v = asVideo(s.video);
              return {
                url: ed.imageUrls[s.video_path] ?? '',
                durationMs: s.video_duration_ms,
                cuts: v.cuts,
                pauses: v.pauses,
                captions: v.captions,
                captionsDefault: v.captionsDefault || v.hasVoice,
                autoplayMuted: v.autoplayMuted,
                hasVoice: v.hasVoice,
                frames: Object.fromEntries(
                  Object.entries(v.frames).map(([k, path]) => [k, ed.imageUrls[path] ?? '']),
                ),
              };
            })()
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

type PageMeta = { url?: string; links?: Array<{ sel: string; href: string }> };
const norm = (u: string) => u.replace(/#.*$/, '').replace(/\/$/, '');
/** Liens d'une page vers une autre page de la démo (même adresse) : même règle que publish_demo. */
function resolveLinks(s: StepRow, steps: StepRow[]) {
  const links = ((s.html_meta as PageMeta | null)?.links ?? []).slice(0, 300);
  const out: Array<{ sel: string; step: string }> = [];
  for (const l of links) {
    const target = steps.find(
      (t) =>
        t.kind === 'html' &&
        t.id !== s.id &&
        norm((t.html_meta as PageMeta | null)?.url ?? '') === norm(l.href),
    );
    if (target) out.push({ sel: l.sel, step: target.id });
  }
  return out;
}
function sandboxOf(v: unknown, steps: StepRow[]) {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const ids = new Set(steps.map((s) => s.id));
  const start = typeof o.start === 'string' && ids.has(o.start) ? o.start : (steps[0]?.id ?? null);
  return {
    start,
    autoLink: o.autoLink !== false,
    unlinked: o.unlinked === 'none' || o.unlinked === 'highlight' ? o.unlinked : ('toast' as const),
    guide: o.guide === true,
    keyPages: Array.isArray(o.keyPages)
      ? o.keyPages.filter((k): k is string => typeof k === 'string' && ids.has(k))
      : [],
  };
}
