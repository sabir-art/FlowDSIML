// L49 §4.1 : Google Safe Browsing, API v5 « hashes:search » (préfixes de hachage de 4 octets) : seuls des
// préfixes SHA-256 sortent du serveur, jamais une adresse complète ; la correspondance des hachages
// complets se fait ici. Clé : secret GOOGLE_SAFE_BROWSING_API_KEY (jamais journalisée, ni l'adresse
// des liens). Délai de 5 s ; en cas de panne, de quota (429) ou de délai : « unavailable ».

const ENDPOINT = 'https://safebrowsing.googleapis.com/v5/hashes:search';
const TIMEOUT_MS = 5000;
const MAX_URLS = 300;
const PREFIXES_PER_CALL = 100;

export interface SafeBrowsingResult {
  status: 'ok' | 'unavailable';
  /** Adresses signalées (parmi celles fournies). */
  flagged: Set<string>;
}

/**
 * Expressions « hôte + chemin » d'une adresse (suffixes d'hôte et préfixes de chemin), selon la
 * méthode de Safe Browsing : au plus 5 hôtes × 6 chemins. Canonisation simplifiée par URL (minuscules,
 * sans fragment, points de fin retirés).
 */
export function expressions(raw: string): string[] {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return [];
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return [];
  const host = u.hostname.toLowerCase().replace(/\.+$/, '');
  if (!host) return [];
  const isIp = /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':');
  const hosts = [host];
  if (!isIp) {
    const parts = host.split('.');
    for (let i = Math.max(1, parts.length - 5); i < parts.length - 1; i++)
      hosts.push(parts.slice(i).join('.'));
  }
  const path = u.pathname || '/';
  const paths = [path + u.search, path];
  const segs = path.split('/').filter(Boolean);
  paths.push('/');
  for (let i = 1; i < Math.min(segs.length, 4); i++) paths.push('/' + segs.slice(0, i).join('/') + '/');
  const out = new Set<string>();
  for (const h of hosts.slice(0, 5)) for (const p of paths.slice(0, 6)) out.add(h + p);
  return [...out];
}

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

async function sha256(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
}

/**
 * Vérifie des adresses. `fetchImpl` est remplaçable (tests : aucun appel réel). Sans clé : unavailable.
 */
export async function checkUrls(
  urls: string[],
  key: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<SafeBrowsingResult> {
  const flagged = new Set<string>();
  const list = [...new Set(urls)].slice(0, MAX_URLS);
  if (!list.length) return { status: 'ok', flagged };
  if (!key) return { status: 'unavailable', flagged };
  // Hachage complet (base64) → adresses concernées ; préfixes de 4 octets à demander
  const byFull = new Map<string, Set<string>>();
  const prefixes = new Set<string>();
  for (const url of list) {
    for (const e of expressions(url)) {
      const h = await sha256(e);
      const full = b64(h);
      if (!byFull.has(full)) byFull.set(full, new Set());
      byFull.get(full)!.add(url);
      prefixes.add(b64(h.slice(0, 4)));
    }
  }
  const all = [...prefixes];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    for (let i = 0; i < all.length; i += PREFIXES_PER_CALL) {
      const qs = new URLSearchParams({ key });
      for (const p of all.slice(i, i + PREFIXES_PER_CALL)) qs.append('hashPrefixes', p);
      const res = await fetchImpl(`${ENDPOINT}?${qs}`, { signal: ctrl.signal });
      if (!res.ok) return { status: 'unavailable', flagged: new Set() };
      const body = (await res.json()) as { fullHashes?: Array<{ fullHash?: string }> };
      for (const f of body.fullHashes ?? []) {
        for (const url of (f.fullHash && byFull.get(f.fullHash)) || []) flagged.add(url);
      }
    }
    return { status: 'ok', flagged };
  } catch {
    return { status: 'unavailable', flagged: new Set() };
  } finally {
    clearTimeout(timer);
  }
}
