// L41 étape 3 (docs/tech/ia-fournisseurs.md §5, spec UX §3) : fonctions de la Console, modèle par défaut
// et résolution pure : modèle choisi et utilisable ; retiré → repli sur le premier modèle disponible du
// même fournisseur ; fournisseur sans clé → fonction coupée dans tous les espaces.
import { isRetired, modelById, modelsFor, type Capability, type Provider } from './catalogue.ts';

export type Fn = 'assistant' | 'write' | 'suggest' | 'translate' | 'voice' | 'captions';

export interface FnDef {
  fn: Fn;
  capability: Capability;
  /** Fonctions de l'espace (ai_features) couvertes : coupées avec elle. */
  features: string[];
  /** Modèle par défaut (celui du code) ; « auto » : le serveur choisit selon la demande. */
  defaultModel: string;
  /** Fournisseur du défaut (pour savoir si « auto » est coupé). */
  provider: Provider;
}

/** Nom des fonctions dans le journal de la Console (en français, comme le reste du journal). */
export const FN_LABEL: Record<Fn, string> = {
  assistant: 'Assistant IA de l’éditeur',
  write: 'Rédaction automatique',
  suggest: 'Vérification de cohérence',
  translate: 'Traduction',
  voice: 'Voix',
  captions: 'Transcription',
};

/** Libellé lisible d'un changement : « Traduction · Claude Sonnet (défaut) → Claude Opus ». */
export function changeLabel(def: FnDef, from: string | null, to: string | null): string {
  const name = (id: string | null) => {
    const m = id ?? def.defaultModel;
    const label = m === 'auto' ? 'Auto' : (modelById(m)?.label ?? 'Ancien modèle (retiré)');
    return id === null ? `${label} (défaut)` : label;
  };
  return `${FN_LABEL[def.fn]} · ${name(from)} → ${name(to)}`;
}

export const FUNCTIONS: FnDef[] = [
  {
    fn: 'assistant',
    capability: 'text',
    features: ['assistant'],
    defaultModel: 'auto',
    provider: 'anthropic',
  },
  // Rédaction : la rédaction automatique et les autres tâches de texte (écrire, générer, données, graphique)
  {
    fn: 'write',
    capability: 'text',
    features: ['write', 'generate', 'dataset', 'chart'],
    defaultModel: 'claude-haiku-5-5',
    provider: 'anthropic',
  },
  {
    fn: 'suggest',
    capability: 'text',
    features: ['suggest'],
    defaultModel: 'claude-sonnet-5-5',
    provider: 'anthropic',
  },
  {
    fn: 'translate',
    capability: 'text',
    features: ['translate'],
    defaultModel: 'claude-sonnet-5-5',
    provider: 'anthropic',
  },
  {
    fn: 'voice',
    capability: 'tts',
    features: ['voice'],
    defaultModel: 'eleven_multilingual_v2',
    provider: 'elevenlabs',
  },
  {
    fn: 'captions',
    capability: 'stt',
    features: ['captions'],
    defaultModel: 'scribe_v1',
    provider: 'elevenlabs',
  },
];

/** Tâche de l'Edge Function → fonction de la Console. */
export const FN_OF_TASK: Record<string, Fn> = {
  assistant: 'assistant',
  step_draft: 'write',
  write: 'write',
  write_all: 'write',
  generate: 'write',
  dataset: 'write',
  chart: 'write',
  suggest: 'suggest',
  translate: 'translate',
  voice: 'voice',
  voice_sample: 'voice',
  voice_list: 'voice',
  captions: 'captions',
};

export interface Resolution {
  fn: Fn;
  /** active : choisi et utilisable ; fallback : modèle retiré, repli ; cut : clé manquante ; off : aucun modèle. */
  status: 'active' | 'fallback' | 'cut' | 'off';
  /** Modèle choisi (ou le défaut), tel qu'enregistré. */
  chosen: string;
  /** Modèle réellement utilisé ; null si la fonction est coupée ; « auto » : choix du serveur. */
  model: string | null;
  /** Fournisseur concerné (clé manquante, repli). */
  provider: Provider | null;
  /** Le modèle choisi a été changé dans la Console (sinon, défaut du code). */
  explicit: boolean;
}

export function resolve(
  def: FnDef,
  chosen: string | null | undefined,
  keys: ReadonlySet<Provider>,
  today?: string,
): Resolution {
  const pick = chosen || def.defaultModel;
  const explicit = !!chosen;
  const base = { fn: def.fn, chosen: pick, explicit };
  if (pick === 'auto')
    return keys.has(def.provider)
      ? { ...base, status: 'active', model: 'auto', provider: def.provider }
      : { ...base, status: 'cut', model: null, provider: def.provider };
  const entry = modelById(pick);
  const provider = entry?.provider ?? def.provider;
  if (!keys.has(provider)) return { ...base, status: 'cut', model: null, provider };
  if (entry && entry.capabilities.includes(def.capability) && !isRetired(entry, today))
    return { ...base, status: 'active', model: entry.id, provider };
  // Retiré (catalogue) ou inconnu. Décision du chef : repli sur le modèle par défaut de la fonction ;
  // s'il est lui-même indisponible, sur le premier modèle disponible du même fournisseur.
  const dflt = modelById(def.defaultModel);
  if (
    dflt &&
    keys.has(dflt.provider) &&
    dflt.capabilities.includes(def.capability) &&
    !isRetired(dflt, today)
  )
    return { ...base, status: 'fallback', model: dflt.id, provider: dflt.provider };
  const fb = modelsFor(provider, def.capability, today)[0];
  return fb
    ? { ...base, status: 'fallback', model: fb.id, provider }
    : { ...base, status: 'off', model: null, provider };
}

/** Fonctions de l'espace coupées (ai_cut) d'après les résolutions. */
export const cutFeatures = (rs: Resolution[]) =>
  [
    ...new Set(
      rs
        .filter((r) => r.status === 'cut' || r.status === 'off')
        .flatMap((r) => FUNCTIONS.find((d) => d.fn === r.fn)!.features),
    ),
  ].sort();

/** Modèles proposables pour une fonction : capacité, non retirés ; disponibles si leur fournisseur a une clé. */
export function choicesFor(def: FnDef, keys: ReadonlySet<Provider>, today?: string) {
  const providers: Provider[] = ['anthropic', 'openai', 'elevenlabs'];
  return providers.flatMap((p) =>
    modelsFor(p, def.capability, today).map((m) => ({
      id: m.id,
      label: m.label,
      provider: m.provider,
      speed: m.speed,
      cost: m.cost,
      available: keys.has(m.provider),
    })),
  );
}
