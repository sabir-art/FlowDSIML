/**
 * L25-06 : onglets de la capture (pur, testé). Chaque étape capturée avec le suivi des onglets porte
 * options.tab = { n, title }. La barre du navigateur montre les onglets connus jusqu'à l'étape.
 */
export type CaptureTab = { n: number; title: string };
type WithOptions = { options?: unknown };

export function stepTab(step: WithOptions | undefined): CaptureTab | null {
  const t = (step?.options as { tab?: unknown } | null | undefined)?.tab as Partial<CaptureTab> | undefined;
  return t && typeof t.n === 'number' && t.n >= 1
    ? { n: t.n, title: typeof t.title === 'string' ? t.title : '' }
    : null;
}

/** Onglets affichés dans le cadre (absent : oui). */
export const showTabs = (step: WithOptions | undefined) =>
  (step?.options as { showTabs?: unknown } | null | undefined)?.showTabs !== false;

/** Onglet d'origine de la capture (avant un rattachement à un autre onglet dans l'éditeur). */
export function capturedTab(step: WithOptions | undefined): CaptureTab | null {
  return stepTab({
    options: { tab: (step?.options as { tabCaptured?: unknown } | null | undefined)?.tabCaptured },
  });
}

/** Tous les onglets de la démo, un par numéro (premier titre rencontré), triés. */
export function allTabs(steps: WithOptions[]): CaptureTab[] {
  const by = new Map<number, CaptureTab>();
  for (const s of steps) {
    for (const t of [stepTab(s), capturedTab(s)]) if (t && !by.has(t.n)) by.set(t.n, t);
  }
  return [...by.values()].sort((a, b) => a.n - b.n);
}

/**
 * Onglets visibles à l'étape `index` : ceux déjà ouverts (numéro ≤ le plus grand vu jusqu'ici), avec
 * le titre du dernier passage, et l'onglet actif. Vide si l'étape n'a pas d'onglet.
 */
export function tabsAt(steps: WithOptions[], index: number): { tabs: CaptureTab[]; active: number } {
  const cur = stepTab(steps[index]);
  if (!cur) return { tabs: [], active: 0 };
  const seen = new Map<number, CaptureTab>();
  for (let i = 0; i <= index; i++) {
    const t = stepTab(steps[i]);
    if (t) seen.set(t.n, t);
  }
  return { tabs: [...seen.values()].sort((a, b) => a.n - b.n), active: cur.n };
}

/** L'étape change d'onglet par rapport à l'étape précédente qui en a un. */
export function tabChanged(steps: WithOptions[], index: number): boolean {
  const cur = stepTab(steps[index]);
  if (!cur) return false;
  for (let i = index - 1; i >= 0; i--) {
    const t = stepTab(steps[i]);
    if (t) return t.n !== cur.n;
  }
  return cur.n > 1;
}
