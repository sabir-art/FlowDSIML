/**
 * Médiathèque (retours client du 24/11 §3.2) : catégorie déduite à l'import, modifiable ensuite.
 *  - WOFF2 : Police ;
 *  - SVG, ou PNG avec transparence et à peu près carré (rapport entre 1:2 et 2:1, côté de 1 024 px au
 *    plus) : Logo ;
 *  - sinon : Image.
 * Importé depuis un filtre Logos ou Images, le fichier prend la catégorie du filtre.
 */
export type MediaKind = 'logo' | 'image' | 'font';
/** Pourquoi la catégorie a été choisie (dite dans le toast d'import). */
export type KindReason = 'font' | 'svg' | 'transparentSquare' | 'default' | 'filter';

export interface FileFacts {
  font: boolean;
  svg: boolean;
  width: number | null;
  height: number | null;
  /** Au moins un pixel transparent (PNG) ; null : non mesuré. */
  alpha: boolean | null;
}

export const LOGO_MAX_SIDE = 1024;

export function deduceKind(
  f: FileFacts,
  filter: 'all' | MediaKind = 'all',
): { kind: MediaKind; reason: KindReason } {
  // Le type réel prime : une police n'est jamais rangée ailleurs
  if (f.font) return { kind: 'font', reason: 'font' };
  if (filter === 'logo' || filter === 'image') return { kind: filter, reason: 'filter' };
  if (f.svg) return { kind: 'logo', reason: 'svg' };
  if (f.alpha && f.width && f.height) {
    const ratio = f.width / f.height;
    if (ratio >= 0.5 && ratio <= 2 && Math.max(f.width, f.height) <= LOGO_MAX_SIDE)
      return { kind: 'logo', reason: 'transparentSquare' };
  }
  return { kind: 'image', reason: 'default' };
}

/** Dimensions et transparence d'un fichier image, lues dans le navigateur (rien n'est envoyé). */
export async function inspectFile(file: File): Promise<FileFacts> {
  const name = file.name.toLowerCase();
  const font = name.endsWith('.woff2') || file.type === 'font/woff2';
  const svg = name.endsWith('.svg') || file.type === 'image/svg+xml';
  const facts: FileFacts = { font, svg, width: null, height: null, alpha: null };
  if (font || svg || !(name.endsWith('.png') || file.type === 'image/png')) return facts;
  try {
    const bitmap = await createImageBitmap(file);
    facts.width = bitmap.width;
    facts.height = bitmap.height;
    // Un grand visuel n'est pas un logo : inutile de lire ses pixels
    if (Math.max(bitmap.width, bitmap.height) <= LOGO_MAX_SIDE) {
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
        const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
        facts.alpha = false;
        for (let i = 3; i < data.length; i += 4)
          if (data[i]! < 250) {
            facts.alpha = true;
            break;
          }
      }
    }
    bitmap.close();
  } catch {
    // Image illisible ici : rangée avec les images, le serveur décidera de son sort
  }
  return facts;
}
