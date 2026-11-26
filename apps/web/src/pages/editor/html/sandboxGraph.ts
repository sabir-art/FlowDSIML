import type { StepRow } from '../types';
import { normUrl, resolveLinks, sandboxOf } from '../draftManifest';
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

/** L48-G §5 : lien d'une page vers une page du même site qui n'a pas été capturée. */
export interface DeadLink {
  /** Page d'origine. */
  from: string;
  /** Sélecteur de l'élément cliquable (pour « Relier à une page »). */
  sel: string;
  /** Adresse visée (sans ancre). */
  url: string;
  label: string;
}

/** Liens laissés volontairement (demos.sandbox.ignoredLinks). */
export function ignoredOf(sandbox: unknown): Array<{ url: string; from: string }> {
  const v =
    (sandbox && typeof sandbox === 'object' ? (sandbox as Record<string, unknown>).ignoredLinks : null) ?? [];
  return Array.isArray(v)
    ? v.filter(
        (x): x is { url: string; from: string } =>
          !!x && typeof x === 'object' && typeof x.url === 'string' && typeof x.from === 'string',
      )
    : [];
}

/**
 * L48-G §5 : liens sans page. Un lien de html_meta.links compte s'il vise le même site que sa page
 * (http ou https), une autre adresse que la page elle-même, aucune page capturée (même normalisation que
 * resolveLinks), et s'il n'est pas relié à la main (op « link »). Les liens externes et les ancres sont
 * ignorés. `ignored` : ceux que la personne a laissés volontairement.
 */
export function deadLinks(steps: StepRow[], sandbox: unknown): { dead: DeadLink[]; ignored: DeadLink[] } {
  const pages = steps.filter((s) => s.kind === 'html');
  type Meta = { url?: string; links?: Array<{ sel: string; href: string; label?: string }> };
  const known = new Set(pages.map((p) => normUrl((p.html_meta as Meta | null)?.url ?? '')).filter(Boolean));
  const skip = new Set(ignoredOf(sandbox).map((x) => `${x.from} ${normUrl(x.url)}`));
  const dead: DeadLink[] = [];
  const ignored: DeadLink[] = [];
  const seen = new Set<string>();
  for (const p of pages) {
    const meta = (p.html_meta as Meta | null) ?? {};
    let base: URL;
    try {
      base = new URL(meta.url ?? '');
    } catch {
      continue;
    }
    const linked = new Set(asOps(p.html_ops).flatMap((o) => (o.op === 'link' ? [o.sel] : [])));
    for (const l of (meta.links ?? []).slice(0, 300)) {
      if (!l.href || l.href.startsWith('#') || linked.has(l.sel)) continue;
      let u: URL;
      try {
        u = new URL(l.href, base);
      } catch {
        continue;
      }
      if ((u.protocol !== 'https:' && u.protocol !== 'http:') || u.origin !== base.origin) continue;
      const url = normUrl(u.href);
      if (url === normUrl(base.href) || known.has(url)) continue;
      const key = `${p.id} ${url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const item = { from: p.id, sel: l.sel, url, label: (l.label ?? '').trim() || url };
      (skip.has(key) ? ignored : dead).push(item);
    }
  }
  return { dead, ignored };
}

/**
 * Lot B (recette UX §3.2) : une ligne par destination. Le même lien porté par plusieurs pages (« Services »
 * dans l'en-tête) ne se lit qu'une fois, avec les pages qui le portent, dans l'ordre de la démo.
 */
export interface DeadGroup {
  url: string;
  label: string;
  items: DeadLink[];
}
export function deadByUrl(dead: DeadLink[]): DeadGroup[] {
  const out = new Map<string, DeadGroup>();
  for (const d of dead) {
    const g = out.get(d.url);
    if (g) g.items.push(d);
    else out.set(d.url, { url: d.url, label: d.label, items: [d] });
  }
  return [...out.values()];
}

/** Sandbox v2, étape 4a : couverture du site par la démo. */
export interface Coverage {
  /** Pages capturées (étapes HTML). */
  captured: number;
  /** Destinations du même site sans page, que l'auteur n'a pas laissées. */
  missing: number;
  /** Destinations laissées volontairement par l'auteur (« Laisser le message »). */
  left: number;
}

/**
 * Couverture : pages capturées face aux destinations du même site trouvées dans leurs liens (une
 * destination comptée une fois, quelle que soit la page qui la porte). Les liens laissés par l'auteur
 * sont comptés à part : leur place dans le total reste un choix d'affichage.
 */
export function coverage(steps: StepRow[], sandbox: unknown): Coverage {
  const { dead, ignored } = deadLinks(steps, sandbox);
  const missing = new Set(dead.map((d) => d.url));
  const left = new Set(ignored.map((d) => d.url).filter((u) => !missing.has(u)));
  return { captured: steps.filter((s) => s.kind === 'html').length, missing: missing.size, left: left.size };
}

/** Part couverte, en pour cent arrondi ; `withLeft` compte les liens laissés dans le total. */
export function coverageRatio(c: Coverage, withLeft = false): number {
  const total = c.captured + c.missing + (withLeft ? c.left : 0);
  return total ? Math.round((c.captured / total) * 100) : 100;
}
