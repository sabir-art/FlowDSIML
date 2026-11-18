import type { Mask } from '@flowdsiml/manifest';
import { supabase } from './supabase';

interface PublishResult {
  versionId: string;
  number: number;
  manifest: Record<string, unknown> & {
    steps: Array<{ id: string; blurs: Mask[]; image: { url: string } | null }>;
  };
  copies: Array<{ from: string; to: string }>;
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
  const { data, error } = await supabase.rpc('publish_demo', { p_demo: demoId, p_ack: ack });
  if (error) throw error;
  const res = data as unknown as PublishResult;
  // Flous par chemin publié (<demo>/assets/…), pour les appliquer dans les pixels.
  const blurByPath = new Map(
    res.manifest.steps.filter((s) => s.image).map((s) => [`${demoId}/${s.image!.url}`, s.blurs ?? []]),
  );
  const total = res.copies.length + 1;
  let done = 0;

  for (const c of res.copies) {
    if (!(await exists('published', c.to))) {
      const blurs = blurByPath.get(c.to) ?? [];
      const dl = await supabase.storage.from('captures').download(c.from);
      if (dl.error) throw dl.error;
      const blob = blurs.length ? await burnBlurs(dl.data, blurs) : dl.data;
      const up = await supabase.storage.from('published').upload(c.to, blob, {
        contentType: blurs.length ? 'image/webp' : dl.data.type || 'image/webp',
        cacheControl: '31536000',
        upsert: true,
      });
      if (up.error) throw up.error;
    }
    onProgress?.(++done, total);
  }

  // Les flous sont déjà appliqués dans les pixels : inutile de les rejouer dans le player.
  const manifest = { ...res.manifest, steps: res.manifest.steps.map((s) => ({ ...s, blurs: [] })) };
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
