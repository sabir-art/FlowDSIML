/** Dernière version publiée avant que l'extension ne déclare la sienne (elle ne la communique pas). */
export const LEGACY_VERSION = '0.2.0';

/** Compare deux versions « a.b.c » : négatif si `a` est plus ancienne que `b`. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/**
 * État de la version installée. `reported` : version déclarée par l'extension (absente : publiée avant
 * cette déclaration, donc 0.2.0 ou antérieure). `latest` : dernière version publiée.
 */
export function versionState(
  reported: string | null | undefined,
  latest: string,
): { version: string; known: boolean; upToDate: boolean } {
  const version = reported || LEGACY_VERSION;
  return { version, known: !!reported, upToDate: compareVersions(version, latest) >= 0 };
}
