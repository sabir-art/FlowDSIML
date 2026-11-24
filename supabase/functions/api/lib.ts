// API publique v1 de TutoClick, en lecture seule (retours client du 24/11 §6.2.1). Logique pure, testée
// avec des doubles (lib_test.ts) : aucune dépendance à Deno ni à Supabase ici.
//  GET /v1/demos                 accès « demos »
//  GET /v1/demos/{id}/stats      accès « stats »   (?days=1..365, 30 par défaut)
//  GET /v1/demos/{id}/leads      accès « leads »   (?limit=1..500, ?cursor=…, ?format=csv)
// Chaque demande porte la clé (Authorization: Bearer tc_…). La clé n'est jamais journalisée ni
// renvoyée ; seul son condensé sha-256 part vers la base. Toutes les lectures sont bornées à l'espace
// de la clé, côté base (api_demos, api_demo_stats, api_demo_leads).

export type Scope = 'demos' | 'stats' | 'leads';
export type KeyCheck =
  { ok: true; workspace_id: string; scopes: string[] } | { ok: false; reason: 'invalid' | 'rate' };

export interface DemoRow {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
}
export interface StatsRow {
  demo_id: string;
  from: string;
  to: string;
  views: number;
  visitors: number;
  completions: number;
}
export interface LeadRow {
  id: string;
  email: string;
  created_at: string;
}

export interface Deps {
  /** Adresse publique du lecteur (lien d'une démo publiée) ; absente : pas de lien. */
  playerUrl: string | null;
  /** Vérifie la clé par son condensé, compte l'appel (limite de débit) et note la dernière utilisation. */
  useKey(hash: string): Promise<KeyCheck>;
  demos(workspace: string): Promise<DemoRow[]>;
  /** null : la démo n'est pas dans l'espace de la clé. */
  stats(workspace: string, demo: string, days: number): Promise<StatsRow | null>;
  /** Jusqu'à limit + 1 lignes (la dernière dit seulement qu'il en reste) ; null : démo hors de l'espace. */
  leads(
    workspace: string,
    demo: string,
    limit: number,
    before: { at: string; id: string } | null,
  ): Promise<LeadRow[] | null>;
}

export interface Reply {
  status: number;
  headers: Record<string, string>;
  body: string;
}

const KEY_RE = /^tc_[0-9a-f]{48}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE_HEADERS = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };

const json = (status: number, body: unknown, headers: Record<string, string> = {}): Reply => ({
  status,
  headers: { ...BASE_HEADERS, 'content-type': 'application/json; charset=utf-8', ...headers },
  body: JSON.stringify(body),
});
const fail = (status: number, code: string, message: string, headers: Record<string, string> = {}) =>
  json(status, { error: { code, message } }, headers);

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Clé portée par l'en-tête, ou null (absente, mal formée). */
export function bearerKey(authorization: string | null): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(authorization?.trim() ?? '');
  return m && KEY_RE.test(m[1]!) ? m[1]! : null;
}

/** Curseur opaque de pagination : date et identifiant du dernier lead de la page. */
export const encodeCursor = (l: Pick<LeadRow, 'created_at' | 'id'>) =>
  btoa(`${l.created_at}|${l.id}`).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function decodeCursor(raw: string): { at: string; id: string } | null {
  try {
    const [at, id] = atob(raw.replace(/-/g, '+').replace(/_/g, '/')).split('|');
    return at && id && UUID_RE.test(id) && !Number.isNaN(Date.parse(at)) ? { at, id } : null;
  } catch {
    return null;
  }
}

/** Cellule CSV : guillemets doublés ; une valeur qui commencerait une formule de tableur est neutralisée. */
export const csvCell = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;

/** Entier de la requête dans [min, max], ou la valeur par défaut ; null si la valeur est invalide. */
function intParam(raw: string | null, def: number, min: number, max: number): number | null {
  if (raw === null) return def;
  if (!/^\d{1,4}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= min && n <= max ? n : null;
}

/**
 * Traite une demande. `path` est le chemin après le nom de la fonction (« /v1/demos »).
 * Ordre : méthode, clé (401), limite de débit (429), route (404), accès de la clé (403), paramètres (400).
 */
export async function handle(
  req: { method: string; path: string; query: URLSearchParams; authorization: string | null },
  deps: Deps,
): Promise<Reply> {
  if (req.method !== 'GET')
    return fail(405, 'method_not_allowed', 'This API is read-only: use GET.', { allow: 'GET' });
  const key = bearerKey(req.authorization);
  const denied = () =>
    fail(401, 'unauthorized', 'Missing, invalid or revoked API key.', { 'www-authenticate': 'Bearer' });
  if (!key) return denied();
  const check = await deps.useKey(await sha256Hex(key));
  if (!check.ok)
    return check.reason === 'rate'
      ? fail(429, 'rate_limited', 'Too many requests: retry in a minute.', { 'retry-after': '60' })
      : denied();
  const ws = check.workspace_id;
  const needs = (scope: Scope) =>
    check.scopes.includes(scope)
      ? null
      : fail(403, 'forbidden', `This key does not have the "${scope}" access.`);
  const notFound = () => fail(404, 'not_found', 'Not found.');

  const path = req.path.replace(/\/+$/, '');
  if (path === '/v1/demos') {
    const no = needs('demos');
    if (no) return no;
    const base = deps.playerUrl?.replace(/\/+$/, '') ?? null;
    return json(200, {
      data: (await deps.demos(ws)).map((d) => ({
        id: d.id,
        title: d.title,
        status: d.status,
        // Le lien n'est donné que pour une démo publiée
        url: d.status === 'published' && base ? `${base}/#/d/${d.id}` : null,
        created_at: d.created_at,
        updated_at: d.updated_at,
      })),
    });
  }
  const m = /^\/v1\/demos\/([^/]+)\/(stats|leads)$/.exec(path);
  if (!m) return notFound();
  const [, demo, what] = m as unknown as [string, string, 'stats' | 'leads'];
  const no = needs(what);
  if (no) return no;
  if (!UUID_RE.test(demo)) return notFound();

  if (what === 'stats') {
    const days = intParam(req.query.get('days'), 30, 1, 365);
    if (days === null) return fail(400, 'bad_request', '"days" must be between 1 and 365.');
    const s = await deps.stats(ws, demo, days);
    if (!s) return notFound();
    return json(200, {
      data: {
        demo_id: s.demo_id,
        from: s.from,
        to: s.to,
        views: s.views,
        visitors: s.visitors,
        completions: s.completions,
        completion_rate: s.views > 0 ? Math.min(1, Math.round((s.completions / s.views) * 1000) / 1000) : 0,
      },
    });
  }

  const format = req.query.get('format') ?? 'json';
  if (format !== 'json' && format !== 'csv') return fail(400, 'bad_request', '"format" must be json or csv.');
  const limit = intParam(req.query.get('limit'), 100, 1, 500);
  if (limit === null) return fail(400, 'bad_request', '"limit" must be between 1 and 500.');
  const rawCursor = req.query.get('cursor');
  const before = rawCursor === null ? null : decodeCursor(rawCursor);
  if (rawCursor !== null && !before) return fail(400, 'bad_request', '"cursor" is invalid.');
  const rows = await deps.leads(ws, demo, limit, before);
  if (!rows) return notFound();
  const page = rows.slice(0, limit);
  const next = rows.length > limit && page.length ? encodeCursor(page[page.length - 1]!) : null;
  if (format === 'csv')
    return {
      status: 200,
      headers: {
        ...BASE_HEADERS,
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="leads.csv"',
        ...(next ? { 'x-next-cursor': next } : {}),
      },
      body:
        ['email,created_at', ...page.map((l) => `${csvCell(l.email)},${csvCell(l.created_at)}`)].join(
          '\r\n',
        ) + '\r\n',
    };
  return json(200, {
    data: page.map((l) => ({ email: l.email, created_at: l.created_at })),
    next_cursor: next,
  });
}
