// L41 (docs/tech/ia-fournisseurs.md §3) : catalogue des fournisseurs et des modèles, dans le code, parce
// que chaque fournisseur demande un adaptateur. Jamais d'adresse ni de clé ici : la Console ne lit que ces
// fiches (identifiant, nom affiché, capacités, vitesse et coût relatifs, retrait annoncé).

export type Provider = 'anthropic' | 'openai' | 'elevenlabs';
export type Capability = 'text' | 'vision' | 'tts' | 'stt';

export interface ModelEntry {
  /** Identifiant du fournisseur (« claude-sonnet-5-5 »). */
  id: string;
  provider: Provider;
  /** Nom affiché (« Claude Sonnet »). */
  label: string;
  capabilities: Capability[];
  /** Aide de la liste : 1 rapide / peu coûteux, 3 lent / coûteux. */
  speed: 1 | 2 | 3;
  cost: 1 | 2 | 3;
  /** Date de retrait annoncée (AAAA-MM-JJ) : le modèle n'est plus proposé. */
  retired?: string;
}

export const PROVIDERS: Array<{ id: Provider; label: string }> = [
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'elevenlabs', label: 'ElevenLabs' },
];

export const CATALOGUE: ModelEntry[] = [
  {
    id: 'claude-haiku-5-5',
    provider: 'anthropic',
    label: 'Claude Haiku',
    capabilities: ['text', 'vision'],
    speed: 1,
    cost: 1,
  },
  {
    id: 'claude-sonnet-5-5',
    provider: 'anthropic',
    label: 'Claude Sonnet',
    capabilities: ['text', 'vision'],
    speed: 2,
    cost: 2,
  },
  {
    id: 'claude-opus-5-5',
    provider: 'anthropic',
    label: 'Claude Opus',
    capabilities: ['text', 'vision'],
    speed: 3,
    cost: 3,
  },
  {
    id: 'eleven_multilingual_v2',
    provider: 'elevenlabs',
    label: 'ElevenLabs · voix multilingue',
    capabilities: ['tts'],
    speed: 2,
    cost: 2,
  },
  {
    id: 'scribe_v1',
    provider: 'elevenlabs',
    label: 'ElevenLabs · transcription',
    capabilities: ['stt'],
    speed: 2,
    cost: 2,
  },
];

export const modelById = (id: string): ModelEntry | undefined => CATALOGUE.find((m) => m.id === id);

/** Nom affiché du modèle réellement utilisé ; chaîne vide s'il est inconnu. */
export const labelOf = (id: string): string => modelById(id)?.label ?? '';

/** Un modèle est retiré dès sa date de retrait atteinte (comparaison de dates ISO). */
export function isRetired(m: ModelEntry, today = new Date().toISOString().slice(0, 10)): boolean {
  return !!m.retired && m.retired <= today;
}

/** Modèles disponibles d'un fournisseur pour une capacité, dans l'ordre du catalogue. */
export function modelsFor(provider: Provider, capability: Capability, today?: string): ModelEntry[] {
  return CATALOGUE.filter(
    (m) => m.provider === provider && m.capabilities.includes(capability) && !isRetired(m, today),
  );
}

/** Fiches lisibles par la Console (action console_catalog) : rien d'autre que le catalogue lui-même. */
export function publicCatalogue(today?: string) {
  return {
    providers: PROVIDERS,
    models: CATALOGUE.map((m) => ({ ...m, available: !isRetired(m, today) })),
  };
}
