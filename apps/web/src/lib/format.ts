import i18n from '../i18n';

/** Formats localisés (Intl) selon la langue courante de l'interface. */
const locale = () => (i18n.language === 'en' ? 'en-GB' : 'fr-FR');

export function formatDate(
  iso: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat(locale(), opts).format(d);
}

export function formatDateTime(iso: string | null | undefined): string {
  return formatDate(iso, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Nombre localisé. Séparateur des milliers en espace insécable (U+00A0) plutôt qu'en espace fine
 * (U+202F, rendue presque nulle par la police de l'app) : « 3 127 » reste lisible (retour Lead UX L26-06).
 */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat(locale()).format(n).replace(/\u202f/g, '\u00a0');
}

export function formatPercent(ratio: number): string {
  return new Intl.NumberFormat(locale(), { style: 'percent', maximumFractionDigits: 0 }).format(ratio);
}

/** Date relative (« il y a 2 h », « hier ») ; au-delà de 30 jours, date absolue. */
export function formatRelative(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const sec = Math.round((t - now) / 1000);
  const abs = Math.abs(sec);
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
  if (abs < 60) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), 'hour');
  if (abs < 30 * 86400) return rtf.format(Math.round(sec / 86400), 'day');
  return formatDate(iso);
}

/**
 * Date relative abrégée des cartes (maquette dashboard) : « à l’instant », « il y a 5 min »,
 * « il y a 2 h », « hier », « il y a 3 j », puis « 12 nov. » (année ajoutée si elle diffère).
 */
const NBSP = String.fromCharCode(160);

export function formatRelativeShort(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const sec = Math.max(0, Math.round((now - t) / 1000));
  const en = i18n.language === 'en';
  const ago = (n: number, unit: string) => (en ? `${n}${unit} ago` : `il y a ${n}${NBSP}${unit}`);
  if (sec < 60) return en ? 'just now' : 'à l’instant';
  if (sec < 3600) return ago(Math.round(sec / 60), en ? 'min' : 'min');
  if (sec < 86400) return ago(Math.round(sec / 3600), 'h');
  const days = Math.floor(sec / 86400);
  if (days === 1) return en ? 'yesterday' : 'hier';
  if (days < 7) return ago(days, en ? 'd' : 'j');
  const sameYear = new Date(t).getFullYear() === new Date(now).getFullYear();
  return formatDate(
    iso,
    sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' },
  );
}
