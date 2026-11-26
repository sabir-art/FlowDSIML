import {
  DEFAULT_FRAME,
  MASK_RADIUS,
  MASK_TINT_ALPHA,
  maskIntensity,
  maskPixelBlock,
  maskTintColor,
  type Mask,
} from '@flowdsiml/manifest';
import type { Json } from '@flowdsiml/supabase-types';
import { LAYER_RADIUS, LAYER_SHADOW } from '../pages/editor/images/layers';
import { supabase } from './supabase';

interface PublishResult {
  versionId: string;
  number: number;
  manifest: Record<string, unknown> & {
    steps: Array<{
      id: string;
      blurs: Mask[];
      image: { url: string } | null;
      /** L25-02 : recadrage ; masques et images ajoutées sont relatifs au cadre recadré. */
      options?: { crop?: Frame | null } | null;
      /** L17 : capture « Avant » d'une étape Avant / Après (flous incrustés comme blurs). */
      beforeAfter?: { before: { url: string }; beforeBlurs: Mask[] } | null;
    }>;
  };
  /** F7 / A8 : bucket source (captures par défaut ; videos ou html, copiés sans retouche). */
  copies: Array<{
    from: string;
    to: string;
    bucket?: 'videos' | 'html' | 'html_live' | 'voices';
    /** Images ajoutées visibles de l'étape (chemins du bucket captures), du dessous vers le dessus. */
    images?: Array<Frame & { path: string; opacity?: number; rounded?: boolean; shadow?: boolean }>;
  }>;
}

type Frame = { x: number; y: number; w: number; h: number };
/** Image ajoutée prête à être dessinée (retours client du 24/11 §1). */
export type BurnLayer = Frame & {
  image: CanvasImageSource;
  opacity?: number;
  rounded?: boolean;
  shadow?: boolean;
};

/**
 * Masque réellement les zones sensibles dans les pixels (et pas seulement en CSS) :
 * l'image publiée ne doit pas contenir la donnée d'origine.
 * - Flou : pixellisation forte + flou, pour résister à un « dé-floutage » naïf ;
 * - Pixels (L12-01) : gros pixels nets ;
 * - Aplat (L12-01) : couleur pleine, texte facultatif ; rien de l'original n'est lisible.
 */
export function burnBlurs(
  src: Blob,
  blurs: Array<Partial<Mask> & Pick<Mask, 'x' | 'y' | 'w' | 'h'>>,
): Promise<Blob> {
  return burnStep(src, { blurs });
}

/**
 * Image publiée d'une étape : les images ajoutées sont dessinées sur la capture, puis les masques
 * par-dessus (un masque couvre donc aussi une image ajoutée). Positions relatives au cadre de l'étape :
 * avec un recadrage, elles sont ramenées dans l'image entière, que le lecteur recadre à l'affichage.
 */
export async function burnStep(
  src: Blob,
  {
    blurs = [],
    layers = [],
    crop = null,
  }: {
    blurs?: Array<Partial<Mask> & Pick<Mask, 'x' | 'y' | 'w' | 'h'>>;
    layers?: BurnLayer[];
    crop?: Frame | null;
  },
): Promise<Blob> {
  const bmp = await createImageBitmap(src);
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0);
  // Cadre de l'étape dans l'image (l'image entière sans recadrage)
  const fx = (crop?.x ?? 0) * bmp.width;
  const fy = (crop?.y ?? 0) * bmp.height;
  const fw = (crop?.w ?? 1) * bmp.width;
  const fh = (crop?.h ?? 1) * bmp.height;
  // EXT-02 §6.2 : les réglages sont donnés à l'échelle d'un cadre de 1 280 px de large
  const scale = fw / 1280;
  for (const l of layers) {
    const w = Math.max(1, Math.round(l.w * fw));
    const h = Math.max(1, Math.round(l.h * fh));
    const tile = document.createElement('canvas');
    tile.width = w;
    tile.height = h;
    const tctx = tile.getContext('2d')!;
    if (l.rounded) {
      tctx.beginPath();
      tctx.roundRect(0, 0, w, h, Math.min(LAYER_RADIUS * scale, w / 2, h / 2));
      tctx.clip();
    }
    tctx.drawImage(l.image, 0, 0, w, h);
    ctx.save();
    // Rien hors du cadre de l'étape
    ctx.beginPath();
    ctx.rect(fx, fy, fw, fh);
    ctx.clip();
    ctx.globalAlpha = Math.min(100, Math.max(10, l.opacity ?? 100)) / 100;
    if (l.shadow) {
      ctx.shadowColor = LAYER_SHADOW.canvas;
      ctx.shadowBlur = LAYER_SHADOW.blur * scale;
      ctx.shadowOffsetY = LAYER_SHADOW.y * scale;
    }
    ctx.drawImage(tile, Math.round(fx + l.x * fw), Math.round(fy + l.y * fh));
    ctx.restore();
  }
  for (const b of blurs) {
    const x = Math.floor(fx + b.x * fw);
    const y = Math.floor(fy + b.y * fh);
    const w = Math.max(1, Math.ceil(b.w * fw));
    const h = Math.max(1, Math.ceil(b.h * fh));
    const style = b.style ?? 'blur';
    const tuned = typeof b.intensity === 'number';
    ctx.save();
    // Forme : tout ce qui suit est limité à la zone (arrondi, ellipse inscrite, ou rectangle d'une zone
    // réglée). Une zone d'avant ce réglage est rendue comme avant, sans découpe.
    if (b.shape === 'ellipse' || b.shape === 'rounded' || tuned) {
      ctx.beginPath();
      if (b.shape === 'ellipse') ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      else if (b.shape === 'rounded') ctx.roundRect(x, y, w, h, Math.min(MASK_RADIUS * scale, w / 2, h / 2));
      else ctx.rect(x, y, w, h);
      ctx.clip();
    }
    if (style === 'solid') {
      ctx.fillStyle = /^#[0-9a-fA-F]{6}$/.test(b.color ?? '') ? b.color! : '#2A2F3A';
      ctx.fillRect(x, y, w, h);
      if (b.text) {
        const size = Math.max(10, Math.min(h * 0.45, 28 * scale));
        ctx.font = `600 ${size}px system-ui, sans-serif`;
        ctx.fillStyle = textOn(ctx.fillStyle as string);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.text, x + w / 2, y + h / 2, w - 8);
      }
      ctx.restore();
      continue;
    }
    // Réduction puis agrandissement : c'est elle qui rend le texte illisible, quel que soit le réglage.
    // Pavés : agrandissement sans lissage. Flou : agrandissement lissé, puis flou de l'intensité choisie.
    // Une zone sans réglage garde le rendu d'origine (pavés de 12 px, réduction par 16 et flou de 6 px).
    const factor = style === 'pixels' ? (tuned ? Math.max(8, maskPixelBlock(b) * scale) : 12) : 16;
    const small = document.createElement('canvas');
    small.width = Math.max(1, Math.round(w / factor));
    small.height = Math.max(1, Math.round(h / factor));
    const sctx = small.getContext('2d')!;
    sctx.drawImage(canvas, x, y, w, h, 0, 0, small.width, small.height);
    if (style === 'pixels') {
      ctx.imageSmoothingEnabled = false;
    } else {
      ctx.imageSmoothingEnabled = true;
      ctx.filter = tuned ? `blur(${Math.max(1, maskIntensity(b) * scale)}px)` : 'blur(6px)';
    }
    ctx.drawImage(small, 0, 0, small.width, small.height, x, y, w, h);
    ctx.filter = 'none';
    const tint = maskTintColor({ ...b, style });
    if (tint) {
      ctx.globalAlpha = MASK_TINT_ALPHA;
      ctx.fillStyle = tint;
      ctx.fillRect(x, y, w, h);
    }
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
  // Masques et recadrage par chemin publié (<demo>/assets/…), pour les appliquer dans les pixels.
  const burnByPath = new Map<string, { blurs: Mask[]; crop: Frame | null }>(
    res.manifest.steps
      .filter((s) => s.image)
      .map((s) => [`${demoId}/${s.image!.url}`, { blurs: s.blurs ?? [], crop: s.options?.crop ?? null }]),
  );
  // L17 : flous de la capture « Avant » incrustés de la même façon
  for (const s of res.manifest.steps)
    if (s.beforeAfter)
      burnByPath.set(`${demoId}/${s.beforeAfter.before.url}`, {
        blurs: s.beforeAfter.beforeBlurs ?? [],
        crop: null,
      });
  const total = res.copies.length + 1;
  let done = 0;

  for (const c of res.copies) {
    if (!(await exists('published', c.to))) {
      const burn = c.bucket ? undefined : burnByPath.get(c.to);
      const blurs = burn?.blurs ?? [];
      const dl = await supabase.storage.from(c.bucket ?? 'captures').download(c.from);
      if (dl.error) throw dl.error;
      // Images ajoutées : lues dans les captures de la démo, dessinées sous les masques
      const layers: BurnLayer[] = [];
      for (const l of c.bucket ? [] : (c.images ?? [])) {
        const img = await supabase.storage.from('captures').download(l.path);
        if (img.error) throw img.error;
        layers.push({ ...l, image: await createImageBitmap(img.data) });
      }
      const burned = blurs.length > 0 || layers.length > 0;
      const blob = burned ? await burnStep(dl.data, { blurs, layers, crop: burn?.crop ?? null }) : dl.data;
      const up = await supabase.storage.from('published').upload(c.to, blob, {
        contentType:
          c.bucket === 'videos'
            ? c.to.endsWith('.mp4')
              ? 'video/mp4'
              : 'video/webm'
            : c.bucket === 'voices'
              ? dl.data.type || 'audio/webm'
              : c.bucket === 'html'
                ? 'text/html'
                : // Sandbox v2 : enregistrement vivant d'une page
                  c.bucket === 'html_live'
                  ? 'application/json'
                  : burned
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
