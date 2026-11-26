// Sandbox v2, étape 3 (docs/tech/sandbox-v2.md §3.5 règle 7) : contrôle d'un enregistrement « vivant »
// envoyé par l'extension. Logique pure, sans réseau (testée par live.test.ts).
//  * Le document garde ses scripts sous forme de marques <script data-fd-script="sN"></script> ; tout autre
//    <script>, et toute balise <meta http-equiv> (rafraîchissement vers une autre adresse), est retiré.
//  * Scripts acceptés seulement s'ils sont déclarés et marqués dans le document ; tailles et types bornés.
//  * Réponses : GET seulement, adresse http(s), 1 Mo par réponse, 300 au plus et 10 Mo en tout.
//  * Une adresse signalée par Safe Browsing bloque le script (keep = false) ou retire la réponse.
// La lecture applique en plus sa CSP (aucune sortie) : ce contrôle borne ce qui est stocké.

export const LIVE_MAX = {
  html: 10 * 1024 * 1024,
  scripts: 200,
  script: 3 * 1024 * 1024,
  scriptsTotal: 15 * 1024 * 1024,
  responses: 300,
  response: 1024 * 1024,
  responsesTotal: 10 * 1024 * 1024,
  record: 30 * 1024 * 1024,
};

export type Category = 'page' | 'third' | 'tracking';
export interface LiveScriptIn {
  id: string;
  code: string;
  keep: boolean;
  module?: boolean;
  source?: string;
  category: Category;
}
export interface LiveResponseIn {
  method?: string;
  url: string;
  status: number;
  type: string;
  body: string;
}
export interface LiveRecord {
  url: string;
  html: string;
  scripts: LiveScriptIn[];
  responses: LiveResponseIn[];
}
/** Fiche d'un script dans steps.html_meta.live (jamais son code). */
export interface ScriptCard {
  id: string;
  source: string;
  category: Category;
  keep: boolean;
  bytes: number;
}

const enc = new TextEncoder();
const size = (s: string) => enc.encode(s).length;
const httpUrl = (u: unknown): u is string =>
  typeof u === 'string' && u.length <= 2000 && /^https?:\/\/[^\s]+$/i.test(u);

export type LiveError = 'BAD_REQUEST' | 'TOO_BIG';

/** Contrôle la forme et les tailles ; rend l'enregistrement nettoyé ou une erreur. */
export function parseLive(v: unknown): { record: LiveRecord } | { error: LiveError } {
  if (!v || typeof v !== 'object') return { error: 'BAD_REQUEST' };
  const o = v as Record<string, unknown>;
  if (!httpUrl(o.url) || typeof o.html !== 'string' || !o.html) return { error: 'BAD_REQUEST' };
  if (size(o.html) > LIVE_MAX.html) return { error: 'TOO_BIG' };
  if (!Array.isArray(o.scripts) || !Array.isArray(o.responses)) return { error: 'BAD_REQUEST' };
  if (o.scripts.length > LIVE_MAX.scripts || o.responses.length > LIVE_MAX.responses)
    return { error: 'TOO_BIG' };

  const scripts: LiveScriptIn[] = [];
  const ids = new Set<string>();
  let total = 0;
  for (const s of o.scripts as Array<Record<string, unknown>>) {
    if (!s || typeof s !== 'object') return { error: 'BAD_REQUEST' };
    const id = String(s.id ?? '');
    if (!/^s[0-9]{1,4}$/.test(id) || ids.has(id)) return { error: 'BAD_REQUEST' };
    if (typeof s.code !== 'string' || typeof s.keep !== 'boolean') return { error: 'BAD_REQUEST' };
    if (!['page', 'third', 'tracking'].includes(String(s.category))) return { error: 'BAD_REQUEST' };
    const bytes = size(s.code);
    if (bytes > LIVE_MAX.script) return { error: 'TOO_BIG' };
    total += bytes;
    ids.add(id);
    scripts.push({
      id,
      code: s.code,
      keep: s.keep,
      module: s.module === true,
      source: typeof s.source === 'string' ? s.source.slice(0, 200) : 'page',
      category: s.category as Category,
    });
  }
  if (total > LIVE_MAX.scriptsTotal) return { error: 'TOO_BIG' };

  const responses: LiveResponseIn[] = [];
  let rtotal = 0;
  for (const r of o.responses as Array<Record<string, unknown>>) {
    if (!r || typeof r !== 'object') return { error: 'BAD_REQUEST' };
    const method = String(r.method ?? 'GET').toUpperCase();
    // Seules les lectures sont gardées : une écriture ne se rejoue jamais (succès fictif à la lecture)
    if (method !== 'GET') continue;
    if (!httpUrl(r.url) || typeof r.body !== 'string') return { error: 'BAD_REQUEST' };
    const status = Number(r.status);
    if (!Number.isInteger(status) || status < 100 || status > 599) return { error: 'BAD_REQUEST' };
    const bytes = size(r.body);
    if (bytes > LIVE_MAX.response) return { error: 'TOO_BIG' };
    rtotal += bytes;
    responses.push({
      method: 'GET',
      url: r.url,
      status,
      type: String(r.type ?? 'application/octet-stream').slice(0, 200),
      body: r.body,
    });
  }
  if (rtotal > LIVE_MAX.responsesTotal) return { error: 'TOO_BIG' };

  // Document : seules les marques de scripts déclarés restent ; meta http-equiv retirées
  const html = o.html
    .replace(/<meta\b[^>]*http-equiv[^>]*>/gi, '')
    .replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, (_m, attrs: string, body: string) => {
      const id = /\bdata-fd-script="(s[0-9]{1,4})"/.exec(attrs)?.[1];
      return id && ids.has(id) && !body.trim() ? `<script data-fd-script="${id}"></script>` : '';
    })
    // Balise <script> non fermée : tout ce qui suit serait du code ; refus
    .replace(/<script\b(?![^>]*data-fd-script=)[^>]*>/gi, '');
  const marked = new Set([...html.matchAll(/data-fd-script="(s[0-9]{1,4})"/g)].map((m) => m[1]!));
  const record: LiveRecord = {
    url: o.url,
    html,
    // Un script déclaré mais absent du document n'a pas de place : il n'est pas gardé
    scripts: scripts.filter((s) => marked.has(s.id)),
    responses,
  };
  if (size(JSON.stringify(record)) > LIVE_MAX.record) return { error: 'TOO_BIG' };
  return { record };
}

/** Adresses à vérifier par Safe Browsing : source des scripts (si adresse) et réponses. */
export function liveUrls(r: LiveRecord): string[] {
  const out = new Set<string>();
  for (const s of r.scripts) if (s.source && /^https?:\/\//i.test(s.source)) out.add(s.source);
  for (const x of r.responses) out.add(x.url);
  return [...out].slice(0, 300);
}

/** Applique le verdict Safe Browsing : script signalé bloqué, réponse signalée retirée. */
export function applyFlags(r: LiveRecord, flagged: Set<string>): LiveRecord {
  return {
    ...r,
    scripts: r.scripts.map((s) => (s.source && flagged.has(s.source) ? { ...s, keep: false } : s)),
    responses: r.responses.filter((x) => !flagged.has(x.url)),
  };
}

/** Fiches des scripts et compteurs pour steps.html_meta.live. */
export function liveMeta(r: LiveRecord): { scripts: ScriptCard[]; responses: number } {
  return {
    scripts: r.scripts.map((s) => ({
      id: s.id,
      source: s.source ?? 'page',
      category: s.category,
      keep: s.keep,
      bytes: size(s.code),
    })),
    responses: r.responses.length,
  };
}
