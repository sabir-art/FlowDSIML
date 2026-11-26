/**
 * Sandbox v2, étape 4 (docs/tech/sandbox-v2.md §3.2 et §10) : pages liées d'une capture. À partir des
 * pages déjà capturées (adresse et liens relevés), la liste des destinations du même site, avec leur état
 * (capturée ou à capturer), et la prochaine passe de la capture en série. Fonctions pures, sans navigateur.
 */

import { isRisky } from '@flowdsiml/core';

export interface CapturedPage {
  url: string;
  links: Array<{ href: string; label?: string }>;
}

export interface LinkedPage {
  /** Adresse normalisée (sans ancre ni barre finale ; une route « #/… » est gardée). */
  url: string;
  /** Libellé du premier lien qui y mène. */
  label: string;
  /** Nombre de pages capturées qui portent un lien vers elle. */
  from: number;
  state: 'captured' | 'todo' | 'risky';
}

/** Même normalisation que l'éditeur (normUrl de draftManifest) : les routes « #/… » sont des pages. */
export function normUrl(u: string): string {
  const i = u.indexOf('#');
  const base = (i < 0 ? u : u.slice(0, i)).replace(/\/$/, '');
  const frag = i < 0 ? '' : u.slice(i);
  return base + (/^#[/!]./.test(frag) ? frag.replace(/\/$/, '') : '');
}

// Règle partagée avec le plan de l'éditeur (étape 4, décision du chef) : @flowdsiml/core
export { isRisky };

/**
 * Destinations du même site que la première page capturée, sans ancre seule ni adresse non web. Une
 * route vue pendant la capture (application à page unique) compte comme une destination.
 */
export function linkedPages(pages: CapturedPage[], routes: string[] = []): LinkedPage[] {
  const first = pages[0];
  if (!first) return [];
  let origin: string;
  try {
    origin = new URL(first.url).origin;
  } catch {
    return [];
  }
  const captured = new Set(pages.map((p) => normUrl(p.url)));
  const out = new Map<string, LinkedPage>();
  const add = (href: string, base: string, label: string, count: boolean) => {
    // Ancre seule (« #haut ») : même page ; une route « #/… » est une page
    if (!href || (href.startsWith('#') && !/^#[/!]./.test(href))) return;
    let u: URL;
    try {
      u = new URL(href, base);
    } catch {
      return;
    }
    if ((u.protocol !== 'https:' && u.protocol !== 'http:') || u.origin !== origin) return;
    const url = normUrl(u.href);
    const cur = out.get(url);
    if (cur) {
      if (count) cur.from++;
      if (!cur.label && label) cur.label = label;
      return;
    }
    out.set(url, {
      url,
      label,
      from: count ? 1 : 0,
      state: captured.has(url) ? 'captured' : isRisky(u.href, label) ? 'risky' : 'todo',
    });
  };
  for (const p of pages) {
    const seen = new Set<string>();
    for (const l of p.links.slice(0, 300)) {
      let key: string;
      try {
        key = normUrl(new URL(l.href, p.url).href);
      } catch {
        continue;
      }
      // Un même lien répété sur une page ne compte qu'une fois pour elle
      const again = seen.has(key);
      seen.add(key);
      add(l.href, p.url, (l.label ?? '').trim(), !again);
    }
  }
  for (const r of routes) add(r, first.url, '', false);
  // Les pages capturées sont dans la liste, même sans lien qui y mène
  for (const p of pages) add(p.url, p.url, '', false);
  return [...out.values()];
}

/** Prochaine passe de la capture en série : destinations à capturer, dans l'ordre, 20 au plus. */
export function nextBatch(list: LinkedPage[], max = 20): LinkedPage[] {
  return list.filter((p) => p.state === 'todo').slice(0, max);
}
