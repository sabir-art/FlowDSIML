// L41 (docs/tech/ia-fournisseurs.md §4) : clé d'un fournisseur, lue seulement par les Edge Functions.
// Ordre : le coffre (Vault, écrit depuis la Console après un test réussi), puis la variable définie au
// déploiement (repli de la transition, réponse du chef §12.2). Cache de 60 s : un remplacement
// s'applique vite. Une clé n'est jamais renvoyée, journalisée ni incluse dans une erreur.
import type { Provider } from './catalogue.ts';

const ENV: Record<Provider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  elevenlabs: 'ELEVENLABS_API_KEY',
};

export interface ProviderKey {
  key: string;
  /** « vault » : enregistrée depuis la Console ; « env » : définie au déploiement. */
  source: 'vault' | 'env';
}

/** Lecture du coffre (RPC ai_key_read, rôle de service) ; null sans clé ou en cas d'erreur. */
export type VaultRead = (provider: Provider) => Promise<string | null>;

const envOf = (n: string) => {
  try {
    return Deno.env.get(n);
  } catch {
    return undefined;
  }
};

/** Clé de déploiement seule (sans coffre). */
export function envKey(
  provider: Provider,
  env: (n: string) => string | undefined = envOf,
): ProviderKey | null {
  const key = env(ENV[provider]);
  return key ? { key, source: 'env' } : null;
}

const cache = new Map<Provider, { at: number; value: ProviderKey | null }>();
export const KEY_TTL_MS = 60_000;

/** Clé d'un fournisseur : coffre d'abord, puis déploiement. */
export async function providerKey(
  provider: Provider,
  vault: VaultRead,
  opts: { env?: (n: string) => string | undefined; now?: number; fresh?: boolean } = {},
): Promise<ProviderKey | null> {
  const now = opts.now ?? Date.now();
  const hit = cache.get(provider);
  if (!opts.fresh && hit && now - hit.at < KEY_TTL_MS) return hit.value;
  const stored = await vault(provider).catch(() => null);
  const value: ProviderKey | null = stored ? { key: stored, source: 'vault' } : envKey(provider, opts.env);
  cache.set(provider, { at: now, value });
  return value;
}

/** Après un enregistrement depuis la Console : la nouvelle clé sert dès la demande suivante. */
export const forgetKey = (provider: Provider) => cache.delete(provider);

/** Retire la clé d'un texte (message d'erreur, journal) par précaution. */
export function scrub(text: string, key: string): string {
  return key && key.length >= 8 ? text.split(key).join('[clé]') : text;
}
