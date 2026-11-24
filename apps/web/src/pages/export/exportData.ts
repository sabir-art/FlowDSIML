/**
 * L15 : données d'export d'une démo, tirées de la version PUBLIÉE (flous incrustés, variables par
 * défaut). Une démo jamais publiée n'est pas exportable.
 */
import { parseManifest } from '@flowdsiml/manifest';
import { demoLang, stepsFromManifest, type ExportDemo } from '@flowdsiml/exports/model';
import { supabase } from '../../lib/supabase';
import { publicDemoUrl } from '../../lib/embed';

export type ExportSource =
  { kind: 'ok'; demo: ExportDemo; logoUrl: string | null } | { kind: 'unpublished'; title: string };

export async function loadExportSource(demoId: string): Promise<ExportSource> {
  const { data: d, error } = await supabase
    .from('demos')
    .select('id, title, status, current_version_id, workspace_id')
    .eq('id', demoId)
    .single();
  if (error || !d) throw error ?? new Error('NOT_FOUND');
  if (d.status !== 'published' || !d.current_version_id) return { kind: 'unpublished', title: d.title };
  const [v, ws, ctx] = await Promise.all([
    supabase.from('demo_versions').select('manifest, number').eq('id', d.current_version_id).single(),
    supabase.from('workspaces').select('name').eq('id', d.workspace_id).single(),
    supabase.from('path_modules').select('path_id, paths(title)').eq('demo_id', demoId).limit(1),
  ]);
  if (v.error || !v.data) throw v.error ?? new Error('NO_VERSION');
  const m = parseManifest(v.data.manifest);
  const steps = stepsFromManifest(m);
  // Captures publiées (bucket privé « published ») : URL signées le temps de l'export
  const rel = [
    ...new Set(
      steps
        .flatMap((s) => [s.imageUrl, s.fullPage?.url ?? null, s.video?.url ?? null])
        .filter((u): u is string => !!u && !/^(https?:|data:|blob:)/.test(u)),
    ),
  ];
  const signed = new Map<string, string>();
  if (rel.length) {
    const { data } = await supabase.storage.from('published').createSignedUrls(
      rel.map((p) => `${demoId}/${p}`),
      3600,
    );
    for (const s of data ?? [])
      if (s.path && s.signedUrl) signed.set(s.path.slice(demoId.length + 1), s.signedUrl);
  }
  const path = (ctx.data?.[0] as { paths?: { title?: string } | null } | undefined)?.paths?.title;
  return {
    kind: 'ok',
    logoUrl: m.theme.logoUrl,
    demo: {
      title: m.title || d.title,
      workspace: m.workspaceName || ws.data?.name || '',
      brand: /^#[0-9a-fA-F]{6}$/.test(m.theme.primary) ? m.theme.primary : '#A3195B',
      logo: null,
      version: v.data.number ?? 1,
      url: publicDemoUrl(demoId),
      context: path ? `Formation «\u202f${path}\u202f»` : '',
      // L48-A : plus de mention imposée par l'offre (fonctions ouvertes à tous)
      showBranding: false,
      device: m.device === 'mobile' ? 'mobile' : 'desktop',
      // L29 : langue de la démo (métadonnées du PDF, version accessible), chapitres et quiz
      lang: demoLang(m.locale),
      chapters: m.chapters.map((c) => ({ id: c.id, title: c.title })),
      questions: (m.quiz?.questions ?? []).map((q) => q.prompt).filter(Boolean),
      steps: steps.map((s) => {
        const sign = (u: string) => signed.get(u) ?? (/^https?:/.test(u) ? u : null);
        const full = s.fullPage ? sign(s.fullPage.url) : null;
        return {
          ...s,
          imageUrl: s.imageUrl ? sign(s.imageUrl) : null,
          fullPage: s.fullPage && full ? { ...s.fullPage, url: full } : null,
          video: s.video && sign(s.video.url) ? { ...s.video, url: sign(s.video.url)! } : null,
        };
      }),
    },
  };
}

/** Image chargée et décodée (capture ou logo). */
export async function fetchBitmap(
  url: string,
  signal?: AbortSignal,
  /** L25-02 : capture recadrée (zone relative à l'image d'origine). */
  crop?: { x: number; y: number; w: number; h: number } | null,
): Promise<ImageBitmap> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  if (blob.type === 'image/svg+xml') {
    const img = new Image();
    const u = URL.createObjectURL(blob);
    try {
      img.src = u;
      await img.decode();
      return await createImageBitmap(img, { resizeWidth: 256, resizeHeight: 256 });
    } finally {
      URL.revokeObjectURL(u);
    }
  }
  if (!crop) return createImageBitmap(blob);
  const full = await createImageBitmap(blob);
  try {
    return await createImageBitmap(
      full,
      Math.round(full.width * crop.x),
      Math.round(full.height * crop.y),
      Math.max(1, Math.round(full.width * crop.w)),
      Math.max(1, Math.round(full.height * crop.h)),
    );
  } finally {
    full.close();
  }
}

/** Bitmap → JPEG (ou PNG pour un logo) limité en largeur, pour le PDF. */
export async function toPdfImage(bmp: ImageBitmap, maxW: number, format: 'JPEG' | 'PNG') {
  const scale = Math.min(1, maxW / bmp.width);
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext('2d')!;
  if (format === 'JPEG') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, c.width, c.height);
  }
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob | null>((r) =>
    c.toBlob(r, format === 'JPEG' ? 'image/jpeg' : 'image/png', 0.86),
  );
  if (!blob) throw new Error('ENCODE');
  return { data: new Uint8Array(await blob.arrayBuffer()), format };
}

export function download(bytes: ArrayBuffer | Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** L29-04 : image en data URL JPEG (version accessible : un seul fichier, hors connexion). */
export function bitmapToDataUrl(b: ImageBitmap, maxWidth = 1600): string {
  const scale = Math.min(1, maxWidth / b.width);
  const c = document.createElement('canvas');
  c.width = Math.round(b.width * scale);
  c.height = Math.round(b.height * scale);
  const g = c.getContext('2d')!;
  g.fillStyle = '#FFFFFF';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(b, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

/** L29-04 : première image d'une vidéo (étape vidéo de la version accessible). */
export async function videoPoster(url: string, signal?: AbortSignal): Promise<ImageBitmap> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const u = URL.createObjectURL(await res.blob());
  try {
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'auto';
    v.src = u;
    await new Promise<void>((ok, ko) => {
      v.onloadeddata = () => ok();
      v.onerror = () => ko(new Error('VIDEO'));
    });
    v.currentTime = 0.05;
    await new Promise<void>((ok) => {
      v.onseeked = () => ok();
      setTimeout(ok, 1500);
    });
    return await createImageBitmap(v);
  } finally {
    URL.revokeObjectURL(u);
  }
}
