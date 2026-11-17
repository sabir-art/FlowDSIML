export interface StepCount {
  stepIndex: number;
  visitors: number;
}

export interface FunnelRow extends StepCount {
  /** Part des visiteurs de la démo ayant atteint cette étape (0–1). */
  reach: number;
  /** Perte par rapport à l'étape précédente (0–1). */
  dropOff: number;
}

/** Calcule l'entonnoir par étape à partir du nombre de visiteurs uniques par étape. */
export function computeFunnel(counts: StepCount[], totalSteps: number, totalVisitors: number): FunnelRow[] {
  const byIndex = new Map(counts.map((c) => [c.stepIndex, c.visitors]));
  const rows: FunnelRow[] = [];
  let prev = totalVisitors;
  for (let i = 0; i < totalSteps; i++) {
    const visitors = byIndex.get(i) ?? 0;
    rows.push({
      stepIndex: i,
      visitors,
      reach: totalVisitors > 0 ? visitors / totalVisitors : 0,
      dropOff: prev > 0 ? Math.max(0, (prev - visitors) / prev) : 0,
    });
    prev = visitors;
  }
  return rows;
}

export function completionRate(views: number, completions: number): number {
  return views > 0 ? Math.min(1, completions / views) : 0;
}
