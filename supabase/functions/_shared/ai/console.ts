// L41 étape 2 (docs/tech/ia-fournisseurs.md §4, spec UX l41-console-modeles-ia §2) : actions de la
// Console sur les fournisseurs, servies par l'Edge Function `ai`. Rôles vérifiés par la base
// (is_platform_owner pour lire, is_platform_admin pour écrire). Une clé collée part une seule fois, est
// testée, et n'est enregistrée qu'en cas de succès ; aucune réponse ne contient de clé.
import { PROVIDERS, publicCatalogue, type Provider } from './catalogue.ts';
import { forgetKey, providerKey, type VaultRead } from './keys.ts';
import type { KeyTest } from './providers/anthropic.ts';

export interface ProviderRow {
  provider: Provider;
  added_at: string | null;
  last_test_at: string | null;
  last_test_ok: boolean | null;
  last_test_error: string | null;
  last_test_ms: number | null;
}

export interface ProviderState {
  provider: Provider;
  label: string;
  /** connected : clé présente et dernier test non refusé ; refused : dernier test refusé ; missing. */
  state: 'connected' | 'refused' | 'missing';
  /** vault : enregistrée depuis la Console ; env : définie au déploiement (« Clé définie au déploiement »). */
  source: 'vault' | 'env' | null;
  addedAt: string | null;
  lastTest: { at: string; ok: boolean; cause: string | null; ms: number | null } | null;
}

/** État de chaque fournisseur du catalogue, sans aucune clé. */
export function providerStates(
  rows: ProviderRow[],
  has: Record<Provider, 'vault' | 'env' | null>,
): ProviderState[] {
  return PROVIDERS.map(({ id, label }) => {
    const r = rows.find((x) => x.provider === id);
    const source = has[id];
    const lastTest = r?.last_test_at
      ? { at: r.last_test_at, ok: !!r.last_test_ok, cause: r.last_test_error, ms: r.last_test_ms }
      : null;
    return {
      provider: id,
      label,
      state: !source ? 'missing' : lastTest && !lastTest.ok ? 'refused' : 'connected',
      source,
      addedAt: source === 'vault' ? (r?.added_at ?? null) : null,
      lastTest,
    };
  });
}

/** Forme d'une clé collée : 10 à 500 caractères, sans espace (rien d'autre n'est jugé ici). */
export const keyShapeOk = (k: unknown): k is string =>
  typeof k === 'string' && k.length >= 10 && k.length <= 500 && !/\s/.test(k);

const isProvider = (p: unknown): p is Provider => PROVIDERS.some((x) => x.id === p);

export interface ConsoleDeps {
  /** Compte de la Console (null : pas un compte de la plateforme). */
  role: () => Promise<{ uid: string; admin: boolean } | null>;
  vault: VaultRead;
  rows: () => Promise<ProviderRow[]>;
  save: (provider: Provider, key: string, uid: string, ms: number) => Promise<{ replaced: boolean }>;
  tested: (provider: Provider, r: KeyTest, uid: string) => Promise<void>;
  test: (provider: Provider, key: string) => Promise<KeyTest>;
  env?: (n: string) => string | undefined;
}

export type ConsoleReply = { status: number; body: Record<string, unknown> };

export const CONSOLE_ACTIONS = [
  'console_catalog',
  'console_providers',
  'console_key_test',
  'console_key_save',
];

export async function consoleAction(body: Record<string, unknown>, d: ConsoleDeps): Promise<ConsoleReply> {
  const who = await d.role();
  // Hors de la plateforme : comme une adresse inconnue
  if (!who) return { status: 404, body: { error: 'NOT_FOUND' } };
  const action = body.action;
  if (action === 'console_catalog') return { status: 200, body: { result: publicCatalogue() } };
  if (action === 'console_providers') {
    const has = {} as Record<Provider, 'vault' | 'env' | null>;
    for (const { id } of PROVIDERS) {
      const k = await providerKey(id, d.vault, { env: d.env, fresh: true });
      has[id] = k?.source ?? null;
    }
    return { status: 200, body: { result: providerStates(await d.rows(), has) } };
  }
  if (action !== 'console_key_test' && action !== 'console_key_save')
    return { status: 400, body: { error: 'BAD_REQUEST' } };
  if (!who.admin) return { status: 403, body: { error: 'READ_ONLY' } };
  const provider = body.provider;
  if (!isProvider(provider)) return { status: 400, body: { error: 'BAD_PROVIDER' } };

  if (action === 'console_key_test') {
    const k = await providerKey(provider, d.vault, { env: d.env, fresh: true });
    if (!k) return { status: 409, body: { error: 'MISSING' } };
    const r = await d.test(provider, k.key);
    await d.tested(provider, r, who.uid);
    return {
      status: 200,
      body: {
        result: r.ok ? { ok: true, ms: r.ms } : { ok: false, ms: r.ms, cause: r.cause, status: r.status },
      },
    };
  }

  // Tester et enregistrer : rien n'est gardé si le test échoue
  const key = body.key;
  if (!keyShapeOk(key)) return { status: 400, body: { error: 'BAD_KEY' } };
  const r = await d.test(provider, key);
  if (!r.ok) return { status: 422, body: { error: 'KEY_TEST', cause: r.cause, status: r.status, ms: r.ms } };
  try {
    const saved = await d.save(provider, key, who.uid, r.ms);
    forgetKey(provider);
    return { status: 200, body: { result: { ok: true, ms: r.ms, replaced: saved.replaced } } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    return msg.includes('NO_VAULT')
      ? { status: 503, body: { error: 'NO_VAULT' } }
      : { status: 500, body: { error: 'SERVER' } };
  }
}
