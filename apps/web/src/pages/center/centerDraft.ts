/** L14 : brouillon du centre de formation (réglages) et règles de publication, sans rendu. */

export type CenterStyle = 'workspace' | 'sober' | 'dark' | 'contrast';
export const CENTER_STYLES: CenterStyle[] = ['workspace', 'sober', 'dark', 'contrast'];

export interface CenterDraft {
  title?: string;
  intro?: string;
  brand?: string;
  accent?: string;
  style?: CenterStyle;
  logoPath?: string | null;
  help?: string;
  indexable?: boolean;
  a11y?: 'non_evalue' | 'partiel' | 'total';
  a11yUrl?: string;
  privacyUrl?: string;
  paths?: Array<{ id: string; visible: boolean }>;
}

export interface PathSummary {
  id: string;
  title: string;
  ordered: boolean;
  modules: number;
  /** Modules publiés et non supprimés (seuls visibles sur la page). */
  published: number;
  protectedCount: number;
  expiredCount: number;
  tags: string[];
}

/** Adresse publique du centre (lecteur : #/c/<adresse>). */
export const centerUrl = (playerUrl: string, slug: string) => `${playerUrl.replace(/\/$/, '')}/#/c/${slug}`;

/** Adresse proposée à la création : minuscules, chiffres et tirets, 3 à 48 caractères. */
export function defaultSlug(name: string): string {
  const s = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '');
  return s.length >= 3 ? s : `centre-${s || 'formation'}`.slice(0, 48);
}

/** Publication possible : au moins une formation visible avec un module publié. */
export function publishable(d: CenterDraft, paths: PathSummary[]): boolean {
  return (d.paths ?? []).some((x) => x.visible && (paths.find((p) => p.id === x.id)?.published ?? 0) > 0);
}

/** Nombre de réglages qui diffèrent entre le brouillon et la version publiée. */
export function pendingChanges(draft: CenterDraft, published: CenterDraft): number {
  const keys = new Set([...Object.keys(draft), ...Object.keys(published)]) as Set<keyof CenterDraft>;
  let n = 0;
  for (const k of keys) if (JSON.stringify(draft[k] ?? null) !== JSON.stringify(published[k] ?? null)) n++;
  return n;
}

/**
 * Nettoie un logo SVG : retire scripts, contenus étrangers, gestionnaires d'événements et liens
 * externes. Le logo n'est de toute façon affiché qu'en <img> (jamais en ligne dans la page).
 * Renvoie null si le fichier n'est pas un SVG valide.
 */
export function sanitizeSvg(text: string): string | null {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) return null;
  doc
    .querySelectorAll('script, foreignObject, iframe, object, embed, use[href^="http"], image')
    .forEach((n) => n.remove());
  const walk = (el: Element) => {
    for (const a of [...el.attributes]) {
      const v = a.value.trim().toLowerCase();
      if (/^on/i.test(a.name)) el.removeAttribute(a.name);
      else if ((a.name === 'href' || a.name === 'xlink:href') && !v.startsWith('#'))
        el.removeAttribute(a.name);
      else if (/javascript:|data:text\/html/.test(v)) el.removeAttribute(a.name);
    }
    for (const c of [...el.children]) walk(c);
  };
  walk(root);
  return new XMLSerializer().serializeToString(root);
}
