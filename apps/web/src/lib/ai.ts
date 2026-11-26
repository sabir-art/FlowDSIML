import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * L30 : client de l'Assistance IA. État de l'espace (ai_status, sans appel au fournisseur) et
 * demandes à l'Edge Function `ai`. Aucun texte n'est envoyé si l'espace est désactivé ou si le
 * quota est atteint (vérifié ici avant l'appel, puis par la base).
 */
export type AiFeature =
  'write' | 'translate' | 'suggest' | 'generate' | 'dataset' | 'chart' | 'assistant' | 'voice' | 'captions';
export const AI_FEATURES: AiFeature[] = [
  'write',
  'translate',
  'suggest',
  'generate',
  'dataset',
  'chart',
  'assistant',
  'voice',
  'captions',
];
export type AiTask = AiFeature | 'write_all' | 'voice_sample' | 'voice_list';
/** 065/066 : fonctions audio (ElevenLabs), quota en secondes. */
export const AUDIO_FEATURES: AiFeature[] = ['voice', 'captions'];

export interface AiStatus {
  enabled: boolean;
  features: Record<AiFeature, boolean>;
  used: number;
  quota: number | null;
  userToday: number;
  userDailyRequests: number;
  workspaceQuotaReached: boolean;
  userQuotaReached: boolean;
  /** 065/066 : secondes utilisées ce mois-ci et quota (null : non défini). */
  ttsUsed?: number;
  ttsQuota?: number | null;
  sttUsed?: number;
  sttQuota?: number | null;
  renewsOn: string | null;
  canEdit: boolean;
  canManage: boolean;
  /** L41 étape 3 : fonctions coupées pour tous les espaces par TutoClick (clé du fournisseur absente). */
  unavailable?: AiFeature[];
}

/** Secondes restantes ce mois-ci pour la voix ou les sous-titres (null : quota non défini). */
export function audioLeft(s: AiStatus | null, feature: AiFeature): number | null {
  if (!s) return null;
  const [used, quota] = feature === 'voice' ? [s.ttsUsed, s.ttsQuota] : [s.sttUsed, s.sttQuota];
  if (quota == null) return null;
  return Math.max(0, quota - (used ?? 0));
}

/** « 45 s », au-delà de 120 s « 4 min 10 s » (spec L30b §2). */
export function formatSeconds(n: number): string {
  if (n <= 120) return `${n}\u00a0s`;
  const m = Math.floor(n / 60);
  const r = n % 60;
  return r ? `${m}\u00a0min ${r}\u00a0s` : `${m}\u00a0min`;
}

/** Pourquoi une entrée IA est indisponible (null : disponible). */
export type AiBlock = 'disabled' | 'unavailable' | 'quota' | 'userQuota' | 'role' | null;

export function aiBlock(s: AiStatus | null, feature: AiFeature): AiBlock {
  if (!s || !s.enabled || !s.features[feature]) return 'disabled';
  // Coupée par TutoClick : « Indisponible pour le moment », sans décompter de quota
  if (s.unavailable?.includes(feature)) return 'unavailable';
  if (!s.canEdit) return 'role';
  if (s.workspaceQuotaReached) return 'quota';
  if (AUDIO_FEATURES.includes(feature) && audioLeft(s, feature) === 0) return 'quota';
  if (s.userQuotaReached) return 'userQuota';
  return null;
}

const listeners = new Set<() => Promise<void>>();
/** Recharger l'état après une demande (compteurs) ou un changement de réglage. */
export const refreshAiStatus = () => Promise.all([...listeners].map((l) => l())).then(() => undefined);

export function useAiStatus(ws: string | undefined) {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    if (!ws) return;
    const { data, error: e } = await supabase.rpc('ai_status', { p_ws: ws });
    if (e) return setError(true);
    setError(false);
    setStatus(data as unknown as AiStatus);
  }, [ws]);
  useEffect(() => {
    void load();
    listeners.add(load);
    return () => void listeners.delete(load);
  }, [load]);
  return { status, error, reload: load };
}

export class AiRequestError extends Error {
  constructor(
    public code: string,
    public renewsOn: string | null = null,
  ) {
    super(code);
  }
}

/** Envoie une demande ; lève AiRequestError (AI_DISABLED, AI_QUOTA_WORKSPACE, AI_QUOTA_USER, ABORTED, …). */
export async function callAi<T>(
  ws: string,
  task: AiTask,
  lang: string,
  input: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  return (await callAiWith<T>(ws, task, lang, input, { signal })).result;
}

/** Planche 3 : modèle demandé à l'assistant (« auto » : le serveur choisit), sinon un modèle du menu. */
export type AiModelChoice = 'auto' | (string & {});

/** L41 étape 4 : un modèle du menu de l'assistant (proposé par la Console, utilisable). */
export interface AssistantModel {
  id: string;
  label: string;
  tag: 'none' | 'recommended' | 'beta';
  speed: 1 | 2 | 3;
  cost: 1 | 2 | 3;
}

/** Menu de l'assistant, lu sur le serveur (aucun quota) ; null pendant le chargement. */
export function useAssistantModels(ws: string | undefined) {
  const [models, setModels] = useState<AssistantModel[] | null>(null);
  useEffect(() => {
    if (!ws) return;
    let alive = true;
    void supabase.functions
      .invoke('ai', { body: { action: 'assistant_models', ws } })
      .then(({ data, error }) => {
        if (!alive) return;
        setModels(error ? [] : ((data as { result?: { models?: AssistantModel[] } })?.result?.models ?? []));
      });
    return () => {
      alive = false;
    };
  }, [ws]);
  return models;
}

/**
 * L41 étape 5 : Paramètres › Assistance IA. `all` : modèles proposés par la Console (ordre, étiquette) ;
 * `chosen` : modèles gardés par l'espace (null tant que le propriétaire n'a rien enregistré = tous).
 */
export function useWorkspaceModels(ws: string | undefined) {
  const [st, setSt] = useState<{ all: AssistantModel[]; chosen: string[] | null } | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!ws) return;
    let alive = true;
    void supabase.functions
      .invoke('ai', { body: { action: 'assistant_models', ws } })
      .then(({ data, error }) => {
        if (!alive) return;
        const r = (data as { result?: { all?: AssistantModel[]; chosen?: string[] | null } })?.result;
        setSt(error ? { all: [], chosen: null } : { all: r?.all ?? [], chosen: r?.chosen ?? null });
      });
    return () => {
      alive = false;
    };
  }, [ws, n]);
  return { state: st, set: setSt, reload: () => setN((x) => x + 1) };
}

/** Comme callAi, avec le modèle demandé ; rend aussi le modèle réellement utilisé (« Claude Sonnet »). */
export async function callAiWith<T>(
  ws: string,
  task: AiTask,
  lang: string,
  input: Record<string, unknown>,
  opts: { signal?: AbortSignal; model?: AiModelChoice } = {},
): Promise<{ result: T; model: string }> {
  const { signal, model } = opts;
  const { data, error } = await supabase.functions.invoke('ai', {
    body: { ws, task, lang, input, ...(model && model !== 'auto' ? { model } : {}) },
    signal,
  });
  if (signal?.aborted) throw new AiRequestError('ABORTED');
  refreshAiStatus();
  if (error) {
    let body: { error?: string; renewsOn?: string } = {};
    const ctx = (error as { context?: Response }).context;
    try {
      if (ctx && typeof ctx.json === 'function') body = await ctx.json();
    } catch {
      /* corps illisible : erreur générique */
    }
    throw new AiRequestError(body.error ?? 'NETWORK', body.renewsOn ?? null);
  }
  const d = data as { result: T; model?: string };
  return { result: d.result, model: d.model ?? '' };
}

/** Variables {{x}} présentes dans `before` et absentes de `after`. */
export function lostVariables(before: string, after: string): string[] {
  const vars = (s: string) => new Set([...s.matchAll(/\{\{\s*([\w.-]+)[^}]*\}\}/g)].map((m) => m[1]!));
  const a = vars(after);
  return [...vars(before)].filter((v) => !a.has(v));
}
