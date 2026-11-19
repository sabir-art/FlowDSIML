/** L18-02 : lecture prudente des résultats d'un test A/B (pas de p-value ni de « gagnant »). */
export type AbGoal = 'completion' | 'cta' | 'lead';
export type AbCounts = {
  goal: AbGoal;
  A: { visitors: number; reached: number };
  B: { visitors: number; reached: number };
};

/** Pas de meneur sous 50 visiteurs par variante. */
export const MIN_PER_VARIANT = 50;
/** Seuil indicatif d'un résultat fiable (« environ 1 000 visiteurs »). */
export const RELIABLE_TOTAL = 1000;

export function abOutcome(c: AbCounts): {
  tooFew: boolean;
  leader: 'A' | 'B' | null;
  points: number;
  total: number;
} {
  const total = c.A.visitors + c.B.visitors;
  const tooFew = c.A.visitors < MIN_PER_VARIANT || c.B.visitors < MIN_PER_VARIANT;
  const rate = (v: { visitors: number; reached: number }) =>
    v.visitors ? (100 * v.reached) / v.visitors : 0;
  const diff = rate(c.B) - rate(c.A);
  const points = Math.round(Math.abs(diff));
  const leader = tooFew || points === 0 ? null : diff > 0 ? 'B' : 'A';
  return { tooFew, leader, points, total };
}
