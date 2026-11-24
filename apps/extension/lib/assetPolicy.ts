/**
 * Règle de récupération d'une ressource de page pendant une capture HTML (image, police, feuille de
 * style). Le service de fond ne va chercher que ce que la page capturée affiche déjà : adresse en http(s),
 * demandée par l'onglet en cours de capture, hors réseau interne sauf si la page capturée s'y trouve elle-même
 * (même hôte), d'un type attendu et d'une taille bornée. Les cookies ne partent que vers le site capturé.
 */
export type AssetKind = 'image' | 'font' | 'css';
export const ASSET_KINDS: readonly AssetKind[] = ['image', 'font', 'css'];
export const ASSET_MAX_BYTES = 3 * 1024 * 1024;
export const ASSET_TIMEOUT_MS = 15_000;

/** Hôte du réseau interne ou de la machine : nom local, ou adresse IP privée, de boucle ou de lien local. */
export function isPrivateHost(hostname: string): boolean {
  const h = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (/\.(local|internal|intranet|lan|home|corp|localdomain)$/.test(h)) return true;
  // Nom sans point (machine du réseau local)
  if (!h.includes('.') && !h.includes(':')) return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  if (h.includes(':')) {
    // IPv6 : boucle, non spécifiée, locale unique (fc00::/7), lien local (fe80::/10), IPv4 projetée
    if (h === '::1' || h === '::') return true;
    if (/^f[cd][0-9a-f]{2}:/.test(h) || /^fe[89ab][0-9a-f]:/.test(h)) return true;
    const mapped = /^::ffff:(.+)$/.exec(h);
    if (mapped) return mapped[1]!.includes('.') ? isPrivateHost(mapped[1]!) : true;
  }
  return false;
}

export interface AssetDecision {
  url: string;
  /** Cookies du site capturé seulement ; aucune identification vers un autre site. */
  credentials: 'include' | 'omit';
}

/**
 * Décide si l'adresse peut être récupérée pour la page capturée. `pageUrl` : adresse de l'onglet en cours
 * de capture. Rend null si la demande est refusée.
 */
export function assetDecision(
  rawUrl: unknown,
  kind: unknown,
  pageUrl: string | undefined,
): AssetDecision | null {
  if (typeof rawUrl !== 'string' || rawUrl.length > 4096) return null;
  if (!ASSET_KINDS.includes(kind as AssetKind)) return null;
  let u: URL;
  let page: URL;
  try {
    u = new URL(rawUrl);
    page = new URL(pageUrl ?? '');
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (page.protocol !== 'https:' && page.protocol !== 'http:') return null;
  if (u.username || u.password) return null;
  // Une page en https ne charge pas de ressource en clair
  if (page.protocol === 'https:' && u.protocol === 'http:') return null;
  const sameHost = u.hostname === page.hostname;
  if (isPrivateHost(u.hostname) && !sameHost) return null;
  return { url: u.toString(), credentials: u.origin === page.origin ? 'include' : 'omit' };
}

/** Type de contenu attendu pour la ressource demandée (jamais une page ni des données). */
export function assetTypeAllowed(kind: AssetKind, contentType: string | null | undefined): boolean {
  const t = (contentType ?? '').split(';')[0]!.trim().toLowerCase();
  if (kind === 'css') return t === 'text/css';
  if (kind === 'image') return t.startsWith('image/');
  return (
    t.startsWith('font/') ||
    /^application\/(font-woff2?|x-font-(woff2?|ttf|otf|truetype|opentype)|vnd\.ms-fontobject)$/.test(t) ||
    // Polices servies sans type précis par certains serveurs
    t === 'application/octet-stream'
  );
}

/** Longueur annoncée au-delà de la limite : inutile de lire le corps. */
export const assetTooLong = (contentLength: string | null | undefined) =>
  !!contentLength && Number(contentLength) > ASSET_MAX_BYTES;
