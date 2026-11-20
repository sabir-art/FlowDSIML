import { DEFAULT_FRAME, type Mask } from '@flowdsiml/manifest';
import type { Json } from '@flowdsiml/supabase-types';
import { supabase } from './supabase';

interface PublishResult {
  versionId: string;
  number: number;
  manifest: Record<string, unknown> & {
    steps: Array<{
      id: string;
      blurs: Mask[];
      image: { url: string } | null;
      /** L17 : capture « Avant » d'une étape Avant / Après (flous incrustés comme blurs). */
      beforeAfter?: { before: { url: string }; beforeBlurs: Mask[] } | null;
    }>;
  };
  /** F7 / A8 : bucket source (captures par défaut ; videos ou html, copiés sans retouche). */
  copies: Array<{ from: string; to: string; bucket?: 'videos' | 'html' | 'voices' }>;
}

/**
 * Masque réellement les zones sensibles dans les pixels (et pas seulement en CSS) :
 * l'image publiée ne doit pas contenir la donnée d'origine.
 * - Flou : pixellisation forte + flou, pour résister à un « dé-floutage » naïf ;
 * - Pixels (L12-01) : gros pixels nets ;
 * - Aplat (L12-01) : couleur pleine, texte facultatif ; rien de l'original n'est lisible.
 */
export async function burnBlurs(
  src: Blob,
  blurs: Array<Partial<Mask> & Pick<Mask, 'x' | 'y' | 'w' | 'h'>>,
): Promise<Blob> {
  const bmp = await createImageBitmap(src);
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0);
  for (const b of blurs) {
    const x = Math.floor(b.x * bmp.width);
    const y = Math.floor(b.y * bmp.height);
    const w = Math.max(1, Math.ceil(b.w * bmp.width));
    const h = Math.max(1, Math.ceil(b.h * bmp.height));
    const style = b.style ?? 'blur';
    if (style === 'solid') {
      ctx.save();
      ctx.fillStyle = /^#[0-9a-fA-F]{6}$/.test(b.color ?? '') ? b.color! : '#2A2F3A';
      ctx.fillRect(x, y, w, h);
      if (b.text) {
        const size = Math.max(10, Math.min(h * 0.45, 28 * (bmp.width / 1280)));
        ctx.font = `600 ${size}px system-ui, sans-serif`;
        ctx.fillStyle = textOn(ctx.fillStyle as string);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.text, x + w / 2, y + h / 2, w - 8);
      }
      ctx.restore();
      continue;
    }
    // Réduction puis agrandissement sans lissage (gros pixels), suivi d'un flou pour « Flou »
    const factor = style === 'pixels' ? 12 : 16;
    const small = document.createElement('canvas');
    small.width = Math.max(1, Math.round(w / factor));
    small.height = Math.max(1, Math.round(h / factor));
    const sctx = small.getContext('2d')!;
    sctx.drawImage(canvas, x, y, w, h, 0, 0, small.width, small.height);
    ctx.save();
    if (style === 'pixels') {
      ctx.imageSmoothingEnabled = false;
    } else {
      ctx.imageSmoothingEnabled = true;
      ctx.filter = 'blur(6px)';
    }
    ctx.drawImage(small, 0, 0, small.width, small.height, x, y, w, h);
    ctx.restore();
  }
  bmp.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/webp', 0.88),
  );
}

/** Texte lisible (noir ou blanc) sur une couleur de masque. */
export function textOn(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#080808' : '#FFFFFF';
}

async function exists(bucket: string, path: string): Promise<boolean> {
  const dir = path.slice(0, path.lastIndexOf('/'));
  const name = path.slice(path.lastIndexOf('/') + 1);
  const { data } = await supabase.storage.from(bucket).list(dir, { search: name, limit: 1 });
  return !!data?.some((f) => f.name === name);
}

/**
 * L25-03 : une démo dont le cadre n'a jamais été réglé est publiée avec le cadre par défaut (celui
 * que montre l'éditeur). Les manifestes publiés avant L25 n'ont pas de cadre.
 */
async function ensureFrame(demoId: string) {
  const d = await supabase.from('demos').select('settings').eq('id', demoId).maybeSingle();
  const settings = (d.data?.settings ?? {}) as { theme?: Record<string, unknown> };
  if (d.error || !d.data || settings.theme?.frame) return;
  await supabase
    .from('demos')
    .update({
      settings: {
        ...settings,
        theme: { ...(settings.theme ?? {}), frame: DEFAULT_FRAME },
      } as NonNullable<Json>,
    })
    .eq('id', demoId);
}

/**
 * Publication en 3 temps :
 * 1. publish_demo (SQL) construit le manifeste immuable et crée la version (pas encore en ligne) ;
 * 2. le client copie les images vers le bucket public (en floutant si besoin) et téléverse le manifeste ;
 * 3. finalize_publication met la version en ligne.
 * Un échec en 2 laisse la version précédente en ligne.
 */
export async function publishDemo(
  demoId: string,
  /** F1 : confirmation RGPD (deux cases) exigée pour toute publication publique, journalisée. */
  ack: { reviewed: true; fictional: true },
  onProgress?: (done: number, total: number) => void,
): Promise<PublishResult> {
  await ensureFrame(demoId);
  const { data, error } = await supabase.rpc('publish_demo', { p_demo: demoId, p_ack: ack });
  if (error) throw error;
  const res = data as unknown as PublishResult;
  // L28 035 : le manifeste enregistré porte les voix off (ajoutées par la base) ; pistes copiées en plus
  const ver = await supabase.from('demo_versions').select('manifest').eq('id', res.versionId).single();
  if (ver.error) throw ver.error;
  res.manifest = ver.data.manifest as unknown as PublishResult['manifest'];
  const voiced = await supabase
    .from('steps')
    .select('voice_path')
    .eq('demo_id', demoId)
    .not('voice_path', 'is', null);
  if (voiced.error) throw voiced.error;
  for (const v of voiced.data) {
    const file = v.voice_path?.split('/')[2];
    if (!file) continue;
    res.copies.push({ from: v.voice_path!, to: `${demoId}/assets/voice-${file}`, bucket: 'voices' });
  }
  // Flous par chemin publié (<demo>/assets/…), pour les appliquer dans les pixels.
  const blurByPath = new Map(
    res.manifest.steps.filter((s) => s.image).map((s) => [`${demoId}/${s.image!.url}`, s.blurs ?? []]),
  );
  // L17 : flous de la capture « Avant » incrustés de la même façon
  for (const s of res.manifest.steps)
    if (s.beforeAfter)
      blurByPath.set(`${demoId}/${s.beforeAfter.before.url}`, s.beforeAfter.beforeBlurs ?? []);
  const total = res.copies.length + 1;
  let done = 0;

  for (const c of res.copies) {
    if (!(await exists('published', c.to))) {
      const blurs = c.bucket ? [] : (blurByPath.get(c.to) ?? []);
      const dl = await supabase.storage.from(c.bucket ?? 'captures').download(c.from);
      if (dl.error) throw dl.error;
      const blob = blurs.length ? await burnBlurs(dl.data, blurs) : dl.data;
      const up = await supabase.storage.from('published').upload(c.to, blob, {
        contentType:
          c.bucket === 'videos'
            ? 'video/webm'
            : c.bucket === 'voices'
              ? dl.data.type || 'audio/webm'
              : c.bucket === 'html'
                ? 'text/html'
                : blurs.length
                  ? 'image/webp'
                  : dl.data.type || 'image/webp',
        cacheControl: '31536000',
        upsert: true,
      });
      if (up.error) throw up.error;
    }
    onProgress?.(++done, total);
  }

  // Les flous sont déjà appliqués dans les pixels : inutile de les rejouer dans le player.
  const manifest = {
    ...res.manifest,
    steps: res.manifest.steps.map((s) => ({
      ...s,
      blurs: [],
      ...(s.beforeAfter ? { beforeAfter: { ...s.beforeAfter, beforeBlurs: [] } } : {}),
    })),
  };
  const body = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
  for (const [path, cache] of [
    [`${demoId}/v${res.number}.json`, '31536000'],
    [`${demoId}/latest.json`, '30'],
  ] as const) {
    const up = await supabase.storage
      .from('published')
      .upload(path, body, { contentType: 'application/json', cacheControl: cache, upsert: true });
    if (up.error) throw up.error;
  }
  const fin = await supabase.rpc('finalize_publication', { p_version: res.versionId });
  if (fin.error) throw fin.error;
  onProgress?.(total, total);
  return res;
}

export async function unpublishDemo(demoId: string) {
  const { error } = await supabase.rpc('unpublish_demo', { p_demo: demoId });
  if (error) throw error;
  // Retire le manifeste « latest » : le player affichera « démo non publiée ».
  await supabase.storage.from('published').remove([`${demoId}/latest.json`]);
}
