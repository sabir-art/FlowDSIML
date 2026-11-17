import type { RelRect } from './geometry';

/** Boîte en pixels d'image, élargie d'une marge et bornée à l'image (pure, testée). */
export function burnBox(r: RelRect, width: number, height: number, pad = 4) {
  const x = Math.max(0, Math.floor(r.x * width) - pad);
  const y = Math.max(0, Math.floor(r.y * height) - pad);
  const x2 = Math.min(width, Math.ceil((r.x + r.w) * width - 1e-6) + pad);
  const y2 = Math.min(height, Math.ceil((r.y + r.h) * height - 1e-6) + pad);
  return { x, y, w: Math.max(0, x2 - x), h: Math.max(0, y2 - y) };
}

/** Taille des pavés de la mosaïque : assez gros pour qu'aucun caractère ne reste lisible. */
export const blockSize = (w: number, h: number) => Math.max(8, Math.round(Math.min(w, h) / 2));

/**
 * Flou incrusté dans les pixels (spec f1-formation §1) : mosaïque puis flou gaussien sur chaque
 * zone, puis encodage WebP. L'original non flouté n'est jamais envoyé ni conservé.
 */
export async function burnBlurs(image: Blob, zones: RelRect[], quality = 0.85) {
  const bitmap = await createImageBitmap(image);
  const { width, height } = bitmap;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponible');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  for (const z of zones) {
    const b = burnBox(z, width, height);
    if (!b.w || !b.h) continue;
    const size = blockSize(b.w, b.h);
    const sw = Math.max(1, Math.round(b.w / size));
    const sh = Math.max(1, Math.round(b.h / size));
    const small = new OffscreenCanvas(sw, sh);
    const sctx = small.getContext('2d')!;
    sctx.drawImage(canvas, b.x, b.y, b.w, b.h, 0, 0, sw, sh);
    ctx.save();
    ctx.beginPath();
    ctx.rect(b.x, b.y, b.w, b.h);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.filter = `blur(${Math.max(4, Math.round(size / 2))}px)`;
    ctx.drawImage(small, 0, 0, sw, sh, b.x - size, b.y - size, b.w + 2 * size, b.h + 2 * size);
    ctx.filter = 'none';
    ctx.drawImage(small, 0, 0, sw, sh, b.x, b.y, b.w, b.h);
    ctx.restore();
  }
  const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
  return { blob, width, height };
}
