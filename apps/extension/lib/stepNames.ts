/**
 * Lot B (recette UX §3.1) : deux étapes ne portent jamais le même nom. Une page qui reprend le nom d'une
 * page déjà envoyée est nommée d'après le clic qui l'a amenée (« Tableau de bord · après « Ajouter une
 * vente » ») ; si rien ne la distingue, elle prend un numéro (« Catalogue (2) »). Le nom reste modifiable
 * dans l'éditeur.
 */
export function distinctNames(pages: Array<{ name: string; clickLabel?: string }>): string[] {
  const out: string[] = [];
  const taken = new Set<string>();
  pages.forEach((p, i) => {
    let name = p.name;
    const before = i > 0 ? pages[i - 1]!.clickLabel?.trim() : '';
    if (taken.has(name) && before) name = `${p.name} · après « ${before} »`;
    for (let n = 2; taken.has(name); n++) name = `${p.name} (${n})`;
    taken.add(name);
    out.push(name);
  });
  return out;
}
