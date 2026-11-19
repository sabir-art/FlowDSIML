/** L27 §3 : règles de la page Marque, sans interface (testées). */

/** Limites du bucket « branding » (20261117130300_storage.sql). */
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] as const;
export const LOGO_MAX = 2 * 1024 * 1024;
export const STYLE_NAME_MAX = 40;

export function logoError(file: { type: string; size: number }): 'format' | 'size' | null {
  if (!(LOGO_TYPES as readonly string[]).includes(file.type)) return 'format';
  if (file.size > LOGO_MAX) return 'size';
  return null;
}

/** Nom libre (sans tenir compte de la casse ni des espaces autour) ? */
export const nameTaken = (name: string, taken: string[]) =>
  taken.some((x) => x.trim().toLowerCase() === name.trim().toLowerCase());

/** Nom proposé pour une copie : « Nom (copie) », puis « Nom (copie 2) »…, 40 caractères au plus. */
export function copyName(name: string, taken: string[], word: string): string {
  for (let i = 1; i < 100; i++) {
    const suffix = i === 1 ? ` (${word})` : ` (${word} ${i})`;
    const out = name.slice(0, STYLE_NAME_MAX - suffix.length).trimEnd() + suffix;
    if (!nameTaken(out, taken)) return out;
  }
  return name.slice(0, STYLE_NAME_MAX);
}

export const isHex = (v: string) => /^#[0-9A-F]{6}$/i.test(v.trim());
