/** Réponse de `live_space` (temps réel de l'espace). */
export interface LiveSpace {
  kpis: { live: number; views30: number; endsToday: number; leadsToday: number };
  more: number;
  demos: Array<{ demoId: string; live: number }>;
  visitors: Array<{
    key: string;
    demoId: string;
    lastAt: string;
    since: string;
    stepIndex: number | null;
    stepsTotal: number;
    device: string | null;
    country: string | null;
    /** Visiteur rattaché à un apprenant (même sans droit au suivi nominatif). */
    learner?: boolean;
    /** Nom de l'apprenant ou e-mail du lead : éditeurs et plus seulement. */
    identity: string | null;
  }>;
  feed: Array<{ kind: 'start' | 'end' | 'lead'; demoId: string; at: string }>;
}

/** Espace insécable entre le nombre et son unité. */
const NBSP = String.fromCharCode(160);

/** Durée écoulée, courte : « 40 s », « 2 min », « 1 h ». */
export function elapsedShort(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (!Number.isFinite(s)) return '—';
  if (s < 60) return `${s}${NBSP}s`;
  if (s < 3600) return `${Math.round(s / 60)}${NBSP}min`;
  return `${Math.round(s / 3600)}${NBSP}h`;
}

const cell = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Export CSV de « Sur les démos maintenant » (séparateur « ; », une ligne par visiteur). */
export function liveCsv(
  data: LiveSpace,
  titleOf: (demoId: string) => string,
  labels: { visitor: string; demo: string; step: string; since: string; anon: string; learner: string },
  now: number,
): string {
  const rows = data.visitors.map((v) => {
    const seen = v.stepIndex === null ? 0 : v.stepIndex + 1;
    return [
      v.identity ?? (v.learner ? labels.learner : labels.anon),
      titleOf(v.demoId),
      `${seen}/${Math.max(v.stepsTotal, seen)}`,
      elapsedShort(v.since, now).replace(NBSP, ' '),
    ];
  });
  return [[labels.visitor, labels.demo, labels.step, labels.since], ...rows]
    .map((r) => r.map(cell).join(';'))
    .join('\r\n');
}
