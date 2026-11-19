/**
 * L14 : logique du centre de formation public (sans rendu) : états des formations et des modules,
 * recherche et étiquettes, couleurs de la marque. Les données viennent d'open-center (center_open).
 */

export type ModuleAccess = 'open' | 'password' | 'expired';
export type ModuleStatus = 'validated' | 'failed' | 'in_progress' | 'not_started';

export interface CenterModule {
  demoId: string;
  title: string;
  required: boolean;
  steps: number;
  hasQuiz: boolean;
  access: ModuleAccess;
  cover: string | null;
  status?: ModuleStatus | null;
  seen?: number | null;
  total?: number | null;
  /** Date d'expiration L11 dépassée (module expiré). */
  expiredAt?: string | null;
  /** Meilleur score au quiz de l'apprenant identifié. */
  best?: number | null;
}

export interface CenterPath {
  id: string;
  title: string;
  description: string;
  ordered: boolean;
  isNew: boolean;
  tags: Array<{ name: string; color: string }>;
  modules: CenterModule[];
}

export interface CenterInfo {
  title: string;
  intro: string;
  brand: string | null;
  accent: string | null;
  style: 'workspace' | 'sober' | 'dark' | 'contrast';
  logoPath: string | null;
  help: string;
  a11y: 'non_evalue' | 'partiel' | 'total';
  a11yUrl?: string;
  privacyUrl?: string;
  indexable: boolean;
  workspace: string;
  /** A8 : type de centre (absent avant la migration 160100 : centre de formation). */
  kind?: 'training' | 'demo';
  heroTitle?: string;
  heroSubtitle?: string;
  cta?: { label: string; url?: string; formId?: string } | null;
}

/** A8 : démo d'un Demo Center (ouverte, sans compte ni progression). */
export interface CenterDemo {
  demoId: string;
  title: string;
  kind: 'guided' | 'sandbox';
  steps: number;
  section: string | null;
  tags: Array<{ name: string; color: string }>;
  cover: string | null;
}

export interface CenterData {
  center: CenterInfo;
  /** hasName : nom connu pour l'attestation (booléen seul ; absent avant la migration 140000). */
  visitor: { firstName: string; hasName?: boolean } | null;
  paths: CenterPath[];
  /** A8 : Demo Center (null pour un centre de formation). */
  demos?: CenterDemo[] | null;
}

/** État d'un module tel qu'affiché (carte et page de la formation). */
export type ModuleView =
  | { kind: 'ok'; best: number | null }
  | { kind: 'cur'; step: number; total: number }
  | { kind: 'lock'; after: number }
  | { kind: 'todo' }
  | { kind: 'password' }
  | { kind: 'expired'; since: string | null };

export interface PathView {
  path: CenterPath;
  identified: boolean;
  validated: number;
  total: number;
  started: boolean;
  done: boolean;
  badge: 'done' | 'current' | 'new' | null;
  cta: 'resume' | 'start' | 'review';
  modules: ModuleView[];
  /** Premier module à faire (reprise), s'il est ouvert. */
  next: CenterModule | null;
  optional: number;
  quizzes: number;
  /** Modules expirés au-delà des 3 premiers (note « + n module(s) expiré(s) »). */
  expiredHidden: number;
}

export function pathView(p: CenterPath, identified: boolean): PathView {
  const mods = p.modules;
  // Un module expiré reste listé mais ne compte pas dans la progression
  const live = mods.filter((m) => m.access !== 'expired');
  const valid = (m: CenterModule) => identified && m.access !== 'expired' && m.status === 'validated';
  const validated = live.filter(valid).length;
  const mustDo = live.some((m) => m.required) ? live.filter((m) => m.required) : live;
  const done = identified && mustDo.length > 0 && mustDo.every(valid);
  const started = identified && live.some((m) => m.status && m.status !== 'not_started');
  const firstOpen = mods.findIndex((m) => m.access !== 'expired' && !valid(m));
  const views: ModuleView[] = mods.map((m, i) => {
    if (m.access === 'expired') return { kind: 'expired', since: m.expiredAt ?? null };
    if (valid(m)) return { kind: 'ok', best: m.hasQuiz ? (m.best ?? null) : null };
    if (m.access === 'password') return { kind: 'password' };
    if (identified && p.ordered && firstOpen >= 0 && i > firstOpen) return { kind: 'lock', after: i };
    if (identified && (m.status === 'in_progress' || m.status === 'failed') && (m.total ?? 0) > 0)
      return { kind: 'cur', step: Math.min((m.seen ?? 0) + 1, m.total!), total: m.total! };
    return { kind: 'todo' };
  });
  const next = mods.find((m, i) => !valid(m) && m.access !== 'expired' && views[i]!.kind !== 'lock') ?? null;
  return {
    path: p,
    identified,
    validated,
    total: live.length,
    started,
    done,
    badge: done ? 'done' : started ? 'current' : p.isNew ? 'new' : null,
    cta: done ? 'review' : started ? 'resume' : 'start',
    modules: views,
    next,
    optional: live.filter((m) => !m.required).length,
    quizzes: live.filter((m) => m.hasQuiz).length,
    expiredHidden: mods.slice(3).filter((m) => m.access === 'expired').length,
  };
}

/** « Ma formation en cours » : la première formation commencée et non terminée, dans l'ordre de la page. */
export function currentPath(views: PathView[]): PathView | null {
  return views.find((v) => v.started && !v.done) ?? null;
}

// ---------------------------------------------------------------------------
// Recherche et étiquettes
// ---------------------------------------------------------------------------
export const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** La recherche porte sur les titres des formations et des modules, leurs descriptions et les étiquettes. */
export function matches(p: CenterPath, q: string): boolean {
  const n = fold(q.trim());
  if (!n) return true;
  return [p.title, p.description, ...p.modules.map((m) => m.title), ...p.tags.map((t) => t.name)].some((s) =>
    fold(s).includes(n),
  );
}

export function filterPaths(paths: CenterPath[], q: string, tag: string): CenterPath[] {
  return paths.filter((p) => (!tag || p.tags.some((t) => t.name === tag)) && matches(p, q));
}

/** Étiquettes utilisées par au moins une formation visible, avec leur nombre de formations. */
export function tagCounts(paths: CenterPath[]): Array<{ name: string; color: string; count: number }> {
  const m = new Map<string, { name: string; color: string; count: number }>();
  for (const p of paths)
    for (const t of p.tags) {
      const x = m.get(t.name) ?? { ...t, count: 0 };
      x.count++;
      m.set(t.name, x);
    }
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/** Découpe un texte pour surligner le terme cherché (sans tenir compte des accents ni de la casse). */
export function highlight(text: string, q: string): Array<{ text: string; hit: boolean }> {
  const n = fold(q.trim());
  if (!n) return [{ text, hit: false }];
  const f = fold(text);
  // fold() garde la longueur des caractères de base : les positions se correspondent après NFD
  const base = text.normalize('NFD').replace(/\p{M}/gu, '');
  if (base.length !== text.length) {
    const i = f.indexOf(n);
    return i < 0 ? [{ text, hit: false }] : [{ text, hit: true }];
  }
  const out: Array<{ text: string; hit: boolean }> = [];
  let from = 0;
  for (let i = f.indexOf(n); i >= 0; i = f.indexOf(n, i + n.length)) {
    if (i > from) out.push({ text: text.slice(from, i), hit: false });
    out.push({ text: text.slice(i, i + n.length), hit: true });
    from = i + n.length;
  }
  if (from < text.length) out.push({ text: text.slice(from), hit: false });
  return out.length ? out : [{ text, hit: false }];
}

// ---------------------------------------------------------------------------
// Couleurs
// ---------------------------------------------------------------------------
function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m) as [number, number];
  return (x + 0.05) / (y + 0.05);
}
const HEX = /^#[0-9a-f]{6}$/i;
export const DEFAULT_BRAND = '#A3195B';
export const DEFAULT_ACCENT = '#95C11F';

/** Variables CSS de la page selon le style prédéfini et les couleurs du workspace. */
export function themeVars(c: Pick<CenterInfo, 'brand' | 'accent' | 'style'>): Record<string, string> {
  const brand =
    c.style === 'sober' || c.style === 'contrast'
      ? '#12161B'
      : c.brand && HEX.test(c.brand)
        ? c.brand
        : DEFAULT_BRAND;
  const accent = c.accent && HEX.test(c.accent) ? c.accent : DEFAULT_ACCENT;
  if (c.style === 'dark') return { '--accent': accent };
  const on = contrast(brand, '#FFFFFF') >= 4.5 ? '#FFFFFF' : '#12161B';
  return {
    '--brand': brand,
    '--brand-on': on,
    '--brand-soft': `color-mix(in srgb, ${brand} 10%, #FFFFFF)`,
    '--accent': accent,
  };
}

const norm = (x: string) => x.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** A8 : recherche (titre, étiquettes, section) et filtre par étiquette du Demo Center. */
export function filterDemos(demos: CenterDemo[], q: string, tag: string): CenterDemo[] {
  const needle = norm(q.trim());
  return demos.filter(
    (d) =>
      (!tag || d.tags.some((x) => x.name === tag)) &&
      (!needle ||
        norm(d.title).includes(needle) ||
        norm(d.section ?? '').includes(needle) ||
        d.tags.some((x) => norm(x.name).includes(needle))),
  );
}

/** A8 : sections du Demo Center (dossiers), dans l'ordre reçu ; sans dossier en dernier. */
export function demoSections(demos: CenterDemo[]): Array<{ name: string | null; demos: CenterDemo[] }> {
  const out: Array<{ name: string | null; demos: CenterDemo[] }> = [];
  for (const d of demos) {
    const s = out.find((x) => x.name === d.section);
    if (s) s.demos.push(d);
    else out.push({ name: d.section, demos: [d] });
  }
  return [...out.filter((s) => s.name !== null), ...out.filter((s) => s.name === null)];
}

/** A8 : étiquettes du Demo Center avec leur nombre de démos. */
export function demoTagCounts(demos: CenterDemo[]): Array<{ name: string; color: string; count: number }> {
  const m = new Map<string, { name: string; color: string; count: number }>();
  for (const d of demos)
    for (const t of d.tags) {
      const cur = m.get(t.name) ?? { ...t, count: 0 };
      cur.count++;
      m.set(t.name, cur);
    }
  return [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
