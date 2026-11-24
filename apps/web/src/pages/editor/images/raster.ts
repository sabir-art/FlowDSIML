/**
 * Image prête pour le dossier des captures (PNG, JPEG ou WebP seulement). Un SVG est dessiné dans une
 * image : rien de son contenu actif ne peut atteindre l'éditeur ni le lecteur.
 */
const RASTER = ['image/png', 'image/jpeg', 'image/webp'];
/** Plus grand côté d'un SVG converti. */
const SVG_SIDE = 1024;

export async function toRaster(src: Blob): Promise<{ blob: Blob; width: number; height: number }> {
  if (RASTER.includes(src.type)) {
    const bmp = await createImageBitmap(src);
    const out = { blob: src, width: bmp.width, height: bmp.height };
    bmp.close();
    return out;
  }
  if (src.type !== 'image/svg+xml') throw new Error('type');
  const url = URL.createObjectURL(src);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    // Un SVG sans taille propre est rendu en carré
    const nw = img.naturalWidth || SVG_SIDE;
    const nh = img.naturalHeight || SVG_SIDE;
    const scale = SVG_SIDE / Math.max(nw, nh);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(nw * scale));
    canvas.height = Math.max(1, Math.round(nh * scale));
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/webp', 0.92),
    );
    return { blob, width: canvas.width, height: canvas.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
