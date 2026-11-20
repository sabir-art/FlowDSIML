/**
 * L47 §9 : évolution d'un indicateur par rapport à la période précédente, jamais en pourcentage
 * aberrant. Règle commune à la page Démos et aux deux pages Analytics ; le texte est formé par l'appli.
 */

/** En dessous de cette base (période précédente), on n'affiche pas de pourcentage. */
export const TREND_MIN_BASE = 10;

export type Trend =
  /** Pourcentage arrondi à l'unité (base ≥ 10). */
  | { kind: 'pct'; value: number }
  /** Hausse au-delà de +999 % : multiplicateur arrondi (« ×112 »). */
  | { kind: 'mult'; value: number }
  /** Base entre 1 et 9 : écart absolu, et la valeur précédente. */
  | { kind: 'abs'; value: number; previous: number }
  /** Taux : écart en points. */
  | { kind: 'pts'; value: number }
  /** Rien avant, de l'activité maintenant. */
  | { kind: 'new' }
  /** Pas d'activité sur les deux périodes, ou taux sur une base trop faible. */
  | { kind: 'none' };

/** Évolution d'un compte (vues, visiteurs, leads, clics). */
export function countTrend(current: number, previous: number): Trend {
  if (previous <= 0) return current > 0 ? { kind: 'new' } : { kind: 'none' };
  if (previous < TREND_MIN_BASE) return { kind: 'abs', value: current - previous, previous };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 999) return { kind: 'mult', value: Math.round(current / previous) };
  return { kind: 'pct', value: pct };
}

/**
 * Évolution d'un taux (0–1) en points, si la période précédente compte au moins
 * TREND_MIN_BASE visiteurs (sinon « — »).
 */
export function rateTrend(current: number, previous: number, previousBase: number): Trend {
  if (previousBase < TREND_MIN_BASE) return { kind: 'none' };
  return { kind: 'pts', value: Math.round((current - previous) * 100) };
}

/** Sens de l'évolution : sert à la couleur et à l'icône (aucune icône sur 0, « Nouveau » ou « — »). */
export function trendDirection(t: Trend): 'up' | 'down' | 'flat' | null {
  if (t.kind === 'none' || t.kind === 'new') return null;
  if (t.kind === 'mult') return 'up';
  return t.value > 0 ? 'up' : t.value < 0 ? 'down' : 'flat';
}
