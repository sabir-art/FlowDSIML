// L41 (docs/tech/ia-fournisseurs.md §4) : clé d'un fournisseur, lue seulement par les Edge Functions.
// Étape 1 : les variables d'environnement actuelles (définies au déploiement) ; l'étape 2 lira d'abord le
// coffre (Vault), ces variables restant le repli pendant la transition (réponse du chef, §12.2).
// Une clé n'est jamais renvoyée, journalisée ni incluse dans une erreur.
import type { Provider } from './catalogue.ts';

const ENV: Record<Provider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  elevenlabs: 'ELEVENLABS_API_KEY',
};

export interface ProviderKey {
  key: string;
  /** Origine de la clé : « env » = définie au déploiement. */
  source: 'env';
}

export function providerKey(
  provider: Provider,
  env: (n: string) => string | undefined = Deno.env.get,
): ProviderKey | null {
  const key = env(ENV[provider]);
  return key ? { key, source: 'env' } : null;
}

/** Retire la clé d'un texte (message d'erreur, journal) par précaution. */
export function scrub(text: string, key: string): string {
  return key && key.length >= 8 ? text.split(key).join('[clé]') : text;
}
