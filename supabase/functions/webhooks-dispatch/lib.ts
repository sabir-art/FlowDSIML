// L23 : logique pure de l'envoi des webhooks (signature, contrôle des adresses, envoi d'un événement).
// Les dépendances réseau (résolution DNS, envoi vers l'IP contrôlée) sont injectées : tout se teste sans
// réseau.

export const TIMEOUT_MS = 10_000;
export const MAX_RESPONSE = 2048;
export const USER_AGENT = 'TutoClick-Webhooks/1';

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** HMAC-SHA256 hexadécimal de « t.corps ». */
export async function sign(secret: string, t: number, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${body}`)));
}

/** En-tête TutoClick-Signature : « t=…, v1=… » (deux v1 pendant les 24 h qui suivent un renouvellement). */
export async function signatureHeader(secrets: string[], t: number, body: string): Promise<string> {
  const sigs = await Promise.all(secrets.map((s) => sign(s, t, body)));
  return [`t=${t}`, ...sigs.map((s) => `v1=${s}`)].join(', ');
}

/** Comparaison en temps constant (secret partagé du planificateur). */
export function safeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

function v4(ip: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  const p = m.slice(1).map(Number);
  return p.every((n) => n <= 255) ? p : null;
}

function v4Private([a, b, c]: number[]): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b! >= 64 && b! <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b! >= 16 && b! <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a! >= 224
  );
}

/** Adresse privée, réservée, locale ou non routable (IPv4 et IPv6, IPv4 mappée comprise). */
export function isPrivateIp(ip: string): boolean {
  const four = v4(ip);
  if (four) return v4Private(four);
  const s = ip
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .split('%')[0]!;
  if (!s.includes(':')) return true; // forme inconnue : refusée
  const mapped = /^(?:0*:)*:?ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s) ?? /^::(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (mapped) {
    const p = v4(mapped[1]!);
    return !p || v4Private(p);
  }
  if (s === '::' || s === '::1') return true;
  const first = parseInt(s.split(':')[0] || '0', 16);
  return (
    (first & 0xfe00) === 0xfc00 || // fc00::/7 unique local
    (first & 0xffc0) === 0xfe80 || // fe80::/10 lien local
    (first & 0xff00) === 0xff00 || // ff00::/8 multicast
    (first === 0x2001 && parseInt(s.split(':')[1] || '0', 16) === 0x0db8) || // 2001:db8::/32 documentation
    first === 0x64 || // 64:ff9b::/96 NAT64
    first === 0
  );
}

/** Contrôle syntaxique (redit celui de la base) : https, port 443/8443, pas d'identifiants ni d'IP littérale. */
export function checkUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password) return null;
  if (u.port && u.port !== '443' && u.port !== '8443') return null;
  const host = u.hostname.toLowerCase();
  if (host.startsWith('[') || v4(host) || !host.includes('.'))
    return v4(host) && !isPrivateIp(host) ? u : null;
  if (host === 'localhost' || /\.(localhost|local|internal|intranet|lan|home\.arpa|corp)\.?$/.test(host))
    return null;
  return u;
}

export type Resolver = (host: string) => Promise<string[]>;
/** Envoi vers l'IP contrôlée (troisième argument), sans nouvelle résolution du nom (pinned.ts). */
export type Fetcher = (url: string, init: RequestInit, ip: string) => Promise<Response>;

export interface Delivery {
  id: string;
  url: string;
  event_id: string;
  event_type: string;
  attempt: number;
  body: string;
  secrets: string[];
}

export interface Result {
  status: number;
  body: string;
  durationMs: number;
  error: string | null;
}

/**
 * Envoie un événement : contrôle de l'URL, résolution DNS (toutes les adresses doivent être publiques,
 * contre le rebinding), POST signé sans suivre les redirections, délai de 10 s, réponse tronquée à 2 Ko.
 * Un refus local renvoie le statut 0 avec une erreur (compté comme un échec).
 */
export async function deliver(
  d: Delivery,
  deps: { resolve: Resolver; fetch: Fetcher; now?: () => number },
): Promise<Result> {
  const now = deps.now ?? Date.now;
  const started = now();
  const fail = (error: string, status = 0, body = ''): Result => ({
    status,
    body,
    durationMs: now() - started,
    error,
  });
  const url = checkUrl(d.url);
  if (!url) return fail('URL refusée');
  // checkUrl refuse les IP littérales : le nom est toujours résolu, puis l'envoi part vers une adresse
  // contrôlée (L37 : plus de seconde résolution entre le contrôle et la connexion)
  let ips: string[];
  try {
    ips = await deps.resolve(url.hostname);
  } catch {
    return fail('Résolution DNS impossible');
  }
  if (!ips.length) return fail('Résolution DNS impossible');
  if (ips.some(isPrivateIp)) return fail('Adresse privée ou réservée refusée');
  const t = Math.floor(now() / 1000);
  let res: Response;
  try {
    res = await deps.fetch(
      url.toString(),
      {
        method: 'POST',
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'content-type': 'application/json',
          'user-agent': USER_AGENT,
          'tutoclick-signature': await signatureHeader(d.secrets, t, d.body),
          'tutoclick-event': d.event_type,
          'tutoclick-event-id': d.event_id,
          'tutoclick-delivery': d.id,
        },
        body: d.body,
      },
      ips[0]!,
    );
  } catch (e) {
    return fail(
      e instanceof Error && e.name === 'TimeoutError' ? 'Délai de 10 s dépassé' : 'Envoi impossible',
    );
  }
  const text = (await res.text().catch(() => '')).slice(0, MAX_RESPONSE);
  if (res.status >= 300 && res.status < 400) return fail('Redirection non suivie', res.status, text);
  return {
    status: res.status,
    body: text,
    durationMs: now() - started,
    error: res.ok ? null : `HTTP ${res.status}`,
  };
}

export interface Orphan {
  id: number;
  bucket: string;
  path: string;
}

/**
 * Purge de storage_orphans : retire les fichiers par l'API Storage, par lots de 100 et par bucket. Un
 * lot réussi (fichiers retirés ou déjà absents) est marqué traité ; un lot en erreur reste pour la nuit
 * suivante. Renvoie le nombre de fichiers retirés et la liste des lignes traitées.
 */
export async function purgeOrphans(
  rows: Orphan[],
  remove: (bucket: string, paths: string[]) => Promise<{ removed: number; ok: boolean }>,
): Promise<{ removed: number; done: number[] }> {
  const byBucket = new Map<string, Orphan[]>();
  for (const r of rows) byBucket.set(r.bucket, [...(byBucket.get(r.bucket) ?? []), r]);
  let removed = 0;
  const done: number[] = [];
  for (const [bucket, list] of byBucket)
    for (let i = 0; i < list.length; i += 100) {
      const part = list.slice(i, i + 100);
      const r = await remove(
        bucket,
        part.map((o) => o.path),
      );
      if (!r.ok) continue;
      removed += r.removed;
      done.push(...part.map((o) => o.id));
    }
  return { removed, done };
}
