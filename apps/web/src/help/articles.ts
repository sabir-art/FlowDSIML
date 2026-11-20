/**
 * L26-03 : articles d'aide livrés avec l'app (src/aide/*.md, versionnés). Aucun service externe :
 * recherche côté client, insensible aux accents et à la casse.
 */
const files = import.meta.glob('../aide/*.md', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

export interface Article {
  slug: string;
  title: string;
  section: string;
  summary: string;
  body: string;
  /** L41 / L51 : « console » = réservé aux comptes qui ont un rôle dans la Console propriétaire. */
  audience: 'all' | 'console';
}

export function parseArticle(slug: string, raw: string): Article {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
  const meta: Record<string, string> = {};
  for (const line of (m?.[1] ?? '').split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return {
    slug,
    title: meta.title ?? slug,
    section: meta.section ?? '',
    summary: meta.summary ?? '',
    body: (m?.[2] ?? raw).trim(),
    audience: meta.audience === 'console' ? 'console' : 'all',
  };
}

export const ARTICLES: Article[] = Object.entries(files)
  .map(([path, raw]) => parseArticle(path.replace(/^.*\/(.*)\.md$/, '$1'), raw))
  .sort((a, b) => a.title.localeCompare(b.title, 'fr'));
export const articleBySlug = (slug: string) => ARTICLES.find((a) => a.slug === slug) ?? null;
/** Articles visibles selon le compte : jamais ceux de la console pour un compte sans rôle dans la console. */
export const visibleArticles = (console: boolean) =>
  console ? ARTICLES : ARTICLES.filter((a) => a.audience === 'all');

/** Pages de l'app et articles « Sur cette page » (2 à 4 par page). */
export type HelpPage =
  | 'demos'
  | 'editor-step'
  | 'editor-design'
  | 'editor-settings'
  | 'share'
  | 'distribute'
  | 'analytics'
  | 'learners'
  | 'center'
  | 'settings';
export const PAGE_ARTICLES: Record<HelpPage, string[]> = {
  demos: ['creer-demo-extension', 'ranger-demos', 'partir-modele'],
  'editor-step': ['modifier-etape', 'animations-etape', 'flouter-donnees'],
  'editor-design': ['style-demo', 'accessibilite-demos'],
  'editor-settings': ['reglages-demo', 'accessibilite-demos'],
  share: ['partager-lien', 'page-publique', 'flouter-donnees'],
  distribute: ['diffuser-intranet', 'exporter-scorm', 'mettre-a-jour-scorm'],
  analytics: ['lire-statistiques', 'visiteurs-recurrents'],
  learners: ['suivre-apprenants', 'exporter-scorm'],
  center: ['centre-formation', 'suivre-apprenants'],
  settings: ['parametres-espace', 'membres-roles', 'visiteurs-recurrents'],
};

/** Page d'aide d'une route (l'éditeur précise son onglet). */
export function pageFor(pathname: string, editorTab?: string | null): HelpPage | null {
  if (pathname === '/') return 'demos';
  if (/^\/demos\/[^/]+\/edit/.test(pathname))
    return editorTab === 'design'
      ? 'editor-design'
      : editorTab === 'settings'
        ? 'editor-settings'
        : 'editor-step';
  if (/^\/demos\/[^/]+\/share/.test(pathname)) return 'share';
  if (/^\/demos\/[^/]+\/distribute/.test(pathname)) return 'distribute';
  if (/^\/demos\/[^/]+\/analytics/.test(pathname) || pathname.startsWith('/analytics')) return 'analytics';
  if (pathname.startsWith('/learners')) return 'learners';
  if (pathname.startsWith('/center')) return 'center';
  if (pathname.startsWith('/settings')) return 'settings';
  return null;
}

/** Texte comparable : minuscules, sans accents (un caractère d'origine → un fragment). */
const fold = (c: string) => c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const normalize = (s: string) => Array.from(s, fold).join('');
export const termsOf = (q: string) =>
  normalize(q)
    .split(/\s+/)
    .filter((x) => x.length > 1);

/** Articles qui contiennent tous les termes ; ceux qui les ont dans le titre d'abord. */
export function searchArticles(q: string, list: Article[]): Article[] {
  const terms = termsOf(q);
  if (!terms.length) return [];
  const scored = list.flatMap((a) => {
    const title = normalize(a.title);
    const all = normalize(`${a.title} ${a.section} ${a.summary} ${a.body}`);
    if (!terms.every((t) => all.includes(t))) return [];
    return [{ a, score: terms.filter((t) => title.includes(t)).length }];
  });
  return scored.sort((x, y) => y.score - x.score).map((x) => x.a);
}

/** Découpe un texte en segments, les termes trouvés (sans accents ni casse) marqués. */
export function highlight(text: string, terms: string[]): Array<{ text: string; hit: boolean }> {
  const chars = Array.from(text);
  const folded = chars.map(fold);
  const flat = folded.join('');
  // Position de début de chaque caractère d'origine dans le texte replié
  const starts: number[] = [];
  let acc = 0;
  for (const f of folded) {
    starts.push(acc);
    acc += f.length;
  }
  const hit = new Array<boolean>(chars.length).fill(false);
  for (const t of terms) {
    let from = 0;
    for (;;) {
      const i = flat.indexOf(t, from);
      if (i < 0) break;
      chars.forEach((_, k) => {
        if (starts[k]! >= i && starts[k]! < i + t.length) hit[k] = true;
      });
      from = i + t.length;
    }
  }
  const out: Array<{ text: string; hit: boolean }> = [];
  chars.forEach((c, k) => {
    const last = out[out.length - 1];
    if (last && last.hit === hit[k]) last.text += c;
    else out.push({ text: c, hit: hit[k]! });
  });
  return out;
}
