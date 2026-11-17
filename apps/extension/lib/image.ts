/** Convertit une capture PNG (data URL) en WebP, dans le service worker (OffscreenCanvas). */
export async function pngDataUrlToWebp(
  dataUrl: string,
  quality = 0.85,
): Promise<{ blob: Blob; width: number; height: number }> {
  const png = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(png);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponible');
  ctx.drawImage(bitmap, 0, 0);
  const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
  const out = { blob, width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return out;
}
