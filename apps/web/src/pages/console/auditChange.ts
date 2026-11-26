/**
 * L41 étape 6 (recette UX) : à l'écran, le journal de la liste de l'assistant ne montre que ce qui change.
 * Les valeurs enregistrées sont les listes complètes (« Claude Sonnet (Recommandé), Claude Haiku (Bêta) »),
 * gardées telles quelles dans l'export ; ici, on en tire une ligne par changement :
 *  - proposition : « Claude Haiku » « Non proposé » → « Proposé » ;
 *  - étiquette : « Claude Haiku » « Recommandé » → « Bêta » ;
 *  - ordre : « Ordre » « Sonnet · Opus · Haiku » → « Haiku · Sonnet · Opus » (noms courts, sans étiquette).
 * Liste illisible ou rien de visible dans les listes (étiquette d'un modèle non proposé) : null, le
 * journal garde l'objet et les valeurs enregistrés.
 */
export interface AuditChange {
  object: string;
  before: string;
  after: string;
}

export interface AuditWords {
  order: string;
  proposed: string;
  notProposed: string;
  noTag: string;
}

const ITEM = /^(.+?)(?: \(([^()]+)\))?$/;

function parseList(v: string | null | undefined): Array<{ name: string; tag: string }> | null {
  if (v == null) return null;
  if (!v.trim()) return [];
  const out = [];
  for (const raw of v.split(', ')) {
    const m = ITEM.exec(raw.trim());
    if (!m) return null;
    out.push({ name: m[1]!, tag: m[2] ?? '' });
  }
  return out;
}

/** Nom court : sans le nom de la famille commun à tous (« Claude Sonnet » → « Sonnet »). */
function shortNames(names: string[]): string[] {
  const first = names.map((n) => n.split(' ')[0]);
  const common = first.length > 1 && first.every((f) => f === first[0]) ? `${first[0]} ` : '';
  return names.map((n) => (common && n.startsWith(common) ? n.slice(common.length) : n));
}

export function assistantListChanges(
  before: string | null | undefined,
  after: string | null | undefined,
  w: AuditWords,
): AuditChange[] | null {
  const a = parseList(before);
  const b = parseList(after);
  if (!a || !b) return null;
  const out: AuditChange[] = [];
  const inA = new Map(a.map((x) => [x.name, x]));
  const inB = new Map(b.map((x) => [x.name, x]));
  for (const x of b) {
    const o = inA.get(x.name);
    if (!o) out.push({ object: x.name, before: w.notProposed, after: w.proposed });
    else if (o.tag !== x.tag) out.push({ object: x.name, before: o.tag || w.noTag, after: x.tag || w.noTag });
  }
  for (const x of a)
    if (!inB.has(x.name)) out.push({ object: x.name, before: w.proposed, after: w.notProposed });
  // Ordre : seulement s'il change pour les modèles présents avant et après
  const keptA = a.filter((x) => inB.has(x.name)).map((x) => x.name);
  const keptB = b.filter((x) => inA.has(x.name)).map((x) => x.name);
  if (keptA.join('\n') !== keptB.join('\n')) {
    const all = shortNames([...new Set([...a, ...b].map((x) => x.name))]);
    const short = new Map([...new Set([...a, ...b].map((x) => x.name))].map((n, i) => [n, all[i]!]));
    out.push({
      object: w.order,
      before: a.map((x) => short.get(x.name)).join(' · '),
      after: b.map((x) => short.get(x.name)).join(' · '),
    });
  }
  return out.length ? out : null;
}
