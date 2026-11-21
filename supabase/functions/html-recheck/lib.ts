// L49 §4.1 : nouvelle vérification Google Safe Browsing à la publication (logique pure, testée).

export interface RecheckStep {
  id: string;
  html_path: string;
  html_meta: {
    links?: Array<{ href?: string; label?: string; sel?: string }>;
    security?: Record<string, unknown>;
  } | null;
  html_ops: Array<{ id?: string; sel?: string; op?: string; value?: unknown }> | null;
}

/** Adresses à vérifier : liens repérés à la capture et liens autorisés (sans doublon). */
export function recheckUrls(steps: RecheckStep[]): string[] {
  const out = new Set<string>();
  for (const s of steps) {
    for (const l of s.html_meta?.links ?? [])
      if (typeof l.href === 'string' && /^https?:\/\//.test(l.href)) out.add(l.href);
    for (const o of s.html_ops ?? []) if (o.op === 'extlink' && typeof o.value === 'string') out.add(o.value);
  }
  return [...out];
}

export interface RecheckUpdate {
  stepId: string;
  path: string;
  /** Rapport mis à jour (adresses signalées ajoutées, état de la vérification). */
  security: Record<string, unknown>;
  /** Liens autorisés qui viennent d'être bloqués (texte affiché dans l'éditeur). */
  newlyBlocked: string[];
}

/**
 * Pour chaque page : adresses signalées ajoutées au rapport (une adresse bloquée le reste) et liens
 * autorisés devenus dangereux. Sans changement, la page n'apparaît pas.
 */
export function recheckPlan(steps: RecheckStep[], flagged: Set<string>, now: string): RecheckUpdate[] {
  const out: RecheckUpdate[] = [];
  for (const s of steps) {
    const sec = (s.html_meta?.security ?? {}) as Record<string, unknown>;
    const before = new Set(Array.isArray(sec.blocked) ? (sec.blocked as string[]) : []);
    const mine = recheckUrls([s]).filter((u) => flagged.has(u));
    const added = mine.filter((u) => !before.has(u));
    const newlyBlocked = (s.html_ops ?? [])
      .filter((o) => o.op === 'extlink' && typeof o.value === 'string' && flagged.has(o.value))
      .map((o) => {
        const link = (s.html_meta?.links ?? []).find((l) => l.sel === o.sel);
        return (link?.label ?? '').trim() || String(o.value);
      });
    if (!added.length && sec.safeBrowsing === 'ok') continue;
    const blocked = [...before, ...added].slice(0, 300);
    out.push({
      stepId: s.id,
      path: s.html_path,
      security: { ...sec, blocked, dangerousLinks: blocked.length, safeBrowsing: 'ok', analyzedAt: now },
      newlyBlocked,
    });
  }
  return out;
}
