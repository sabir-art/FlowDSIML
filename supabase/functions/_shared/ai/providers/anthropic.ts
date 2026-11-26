// L41 (docs/tech/ia-fournisseurs.md §3) : adaptateur Anthropic. Code déplacé de ai/index.ts sans
// changement de comportement : Haiku en effort faible et sans repli serveur ; Sonnet et Opus avec le
// repli côté serveur sur refus (« default »). Aucun prompt ni réponse journalisé.
import Anthropic from 'npm:@anthropic-ai/sdk@1.11.0';

export const HAIKU = 'claude-haiku-5-5';

export interface TextRequest {
  model: string;
  maxTokens: number;
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: unknown }>;
  schema?: Record<string, unknown> | null;
}

export type TextResult =
  | { usage: { input: number; output: number }; out: unknown; error?: undefined }
  | {
      usage: { input: number; output: number };
      error: 'REFUSED' | 'TOO_LONG' | 'BAD_OUTPUT';
      out?: undefined;
    };

type Fetch = typeof fetch;
/**
 * Options explicites : le SDK ne lit plus l'environnement (adresse et jeton par défaut). Mêmes valeurs
 * que ses défauts ; la clé vient de keys.ts.
 */
const BASE = { baseURL: 'https://api.anthropic.com', authToken: null, timeout: 90_000, maxRetries: 1 };
const clients = new Map<string, Anthropic>();
/** Client par clé (une clé remplacée crée un nouveau client) ; `fetchImpl` sert aux tests. */
function client(key: string, fetchImpl?: Fetch): Anthropic {
  if (fetchImpl) return new Anthropic({ ...BASE, apiKey: key, fetch: fetchImpl });
  let c = clients.get(key);
  if (!c) {
    clients.clear();
    c = new Anthropic({ ...BASE, apiKey: key });
    clients.set(key, c);
  }
  return c;
}

/** Appel au modèle. Délai de la tâche : un seul essai, abandonné au-delà. */
export async function text(
  key: string,
  req: TextRequest,
  opts: { deadline?: number; fetch?: Fetch } = {},
): Promise<TextResult> {
  const anthropic = client(key, opts.fetch);
  const call = opts.deadline ? { timeout: opts.deadline, maxRetries: 0 } : undefined;
  const output_config = {
    effort: req.model === HAIKU ? ('low' as const) : ('medium' as const),
    ...(req.schema ? { format: { type: 'json_schema' as const, schema: req.schema } } : {}),
  };
  const base = { model: req.model, max_tokens: req.maxTokens, system: req.system, messages: req.messages };
  const res =
    req.model !== HAIKU
      ? // deno-lint-ignore no-explicit-any
        await anthropic.beta.messages.create(
          {
            ...base,
            output_config,
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
          } as any,
          call,
        )
      : // deno-lint-ignore no-explicit-any
        await anthropic.messages.create({ ...base, output_config } as any, call);
  // deno-lint-ignore no-explicit-any
  const r = res as any;
  const usage = { input: Number(r.usage?.input_tokens ?? 0), output: Number(r.usage?.output_tokens ?? 0) };
  if (r.stop_reason === 'refusal') return { usage, error: 'REFUSED' };
  if (r.stop_reason === 'max_tokens') return { usage, error: 'TOO_LONG' };
  const out = (r.content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');
  if (!req.schema) return { usage, out: { text: out } };
  try {
    return { usage, out: JSON.parse(out) };
  } catch {
    return { usage, error: 'BAD_OUTPUT' };
  }
}

/** Échec d'appel : réponse rendue au navigateur et cause courte pour le journal (jamais le message). */
export function failure(e: unknown): { http: number; error: 'TIMEOUT' | 'PROVIDER'; log: string } {
  if (e instanceof Anthropic.APIConnectionTimeoutError)
    return { http: 504, error: 'TIMEOUT', log: 'timeout' };
  const status = e instanceof Anthropic.APIError ? (e.status ?? 0) : 0;
  return {
    http: status === 429 || status === 529 ? 503 : 502,
    error: 'PROVIDER',
    log: String(status || (e instanceof Error ? e.name : 'unknown')),
  };
}

/** Résultat d'un test de clé : délai, ou cause nommée (jamais le texte du fournisseur ni la clé). */
export type KeyTest = { ok: true; ms: number } | { ok: false; ms: number; cause: string; status: number };

/** Causes nommées d'un refus, communes aux adaptateurs. */
export function causeOf(status: number): string {
  if (status === 401) return 'KEY_REFUSED';
  if (status === 403) return 'KEY_FORBIDDEN';
  if (status === 404) return 'MODEL_UNKNOWN';
  if (status === 429 || status === 529) return 'BUSY';
  if (status >= 500) return 'PROVIDER_DOWN';
  return 'PROVIDER';
}

/** Demande minimale (Haiku, 1 jeton) : la clé est-elle acceptée ? */
export async function test(key: string, opts: { fetch?: Fetch; timeout?: number } = {}): Promise<KeyTest> {
  const t0 = Date.now();
  try {
    await client(key, opts.fetch).messages.create(
      { model: HAIKU, max_tokens: 1, messages: [{ role: 'user', content: 'ok' }] },
      { timeout: opts.timeout ?? 10_000, maxRetries: 0 },
    );
    return { ok: true, ms: Date.now() - t0 };
  } catch (e) {
    const ms = Date.now() - t0;
    if (e instanceof Anthropic.APIConnectionTimeoutError)
      return { ok: false, ms, cause: 'TIMEOUT', status: 0 };
    const status = e instanceof Anthropic.APIError ? (e.status ?? 0) : 0;
    // Le message d'erreur du fournisseur n'est jamais rendu : seulement la cause nommée et le statut
    return { ok: false, ms, cause: status ? causeOf(status) : 'NETWORK', status };
  }
}
