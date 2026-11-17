import { MANIFEST_SCHEMA_VERSION, manifestSchema, type Manifest } from '@flowdsiml/manifest';
import type { DemoEditor } from './useDemoEditor';
import { asAction, asCta, asFields, asRects, asSettings, asZoom } from './types';

/**
 * Manifeste de prévisualisation construit côté client (miroir de publish_demo en SQL),
 * avec les URLs signées des captures privées. Jamais publié tel quel.
 */
export function buildDraftManifest(ed: DemoEditor): Manifest {
  const demo = ed.demo!;
  const settings = asSettings(demo.settings);
  return manifestSchema.parse({
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    demoId: demo.id,
    versionId: 'preview',
    workspaceId: demo.workspace_id,
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
  });
}
