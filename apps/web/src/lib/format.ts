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
