import type { StepRow } from '../types';
import { resolveLinks, sandboxOf } from '../draftManifest';
import { asOps } from './htmlModel';

export interface SbNode {
  id: string;
  title: string;
  /** Numéro d'étape (1-n). */
  n: number;
  col: number;
  row: number;
  /** Pages liées depuis cette page (sans doublon). */
  to: string[];
  start: boolean;
  orphan: boolean;
}

/**
 * A8 (L20-02) : plan du Sandbox. Liens d'une page = liens « Lier à une étape » + liens
 * automatiques (même adresse) si la liaison automatique est active. Colonnes par distance depuis la
 * page de départ ; une page qu'aucune autre ne relie (hors départ) est « À relier ».
 */
export function sandboxGraph(steps: StepRow[], sandbox: unknown): { nodes: SbNode[]; start: string | null } {
  const pages = steps.filter((s) => s.kind === 'html');
  const sb = sandboxOf(sandbox, pages);
  const ids = new Set(pages.map((p) => p.id));
  const out = new Map<string, string[]>();
  for (const p of pages) {
    const explicit = asOps(p.html_ops).flatMap((o) =>
      o.op === 'link' && typeof o.value === 'string' && ids.has(o.value) ? [o.value] : [],
    );
    const auto = sb.autoLink ? resolveLinks(p, pages).map((l) => l.step) : [];
    out.set(
      p.id,
      [...new Set([...explicit, ...auto])].filter((x) => x !== p.id),
    );
  }
  const incoming = new Set([...out.values()].flat());
  // Distance depuis le départ (parcours en largeur)
  const level = new Map<string, number>();
  if (sb.start) {
    level.set(sb.start, 0);
    const queue = [sb.start];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const nx of out.get(cur) ?? [])
        if (!level.has(nx)) {
          level.set(nx, level.get(cur)! + 1);
          queue.push(nx);
        }
    }
  }
  const maxLevel = Math.max(0, ...level.values());
  const rows = new Map<number, number>();
  const nodes = pages.map((p) => {
    const reach = level.get(p.id);
    const col = reach ?? maxLevel + 1;
    const row = rows.get(col) ?? 0;
    rows.set(col, row + 1);
    return {
      id: p.id,
      title: p.title || String((p.html_meta as { title?: string } | null)?.title ?? ''),
      n: steps.indexOf(p) + 1,
      col,
      row,
      to: out.get(p.id) ?? [],
      start: p.id === sb.start,
      orphan: p.id !== sb.start && !incoming.has(p.id),
    };
  });
  return { nodes, start: sb.start };
}
