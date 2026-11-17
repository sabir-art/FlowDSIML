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

export function formatNumber(n: number): string {
  return new Intl.NumberFormat(locale()).format(n);
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
