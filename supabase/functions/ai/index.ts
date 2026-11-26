// Edge Function `ai` (L30 Assistance IA) : seule à lire les clés des fournisseurs, jamais exposées au client.
// L41 : appels aux fournisseurs derrière les adaptateurs de _shared/ai (catalogue, clés, fournisseurs).
//  * POST { ws, task, lang, input } : utilisateur éditeur ou plus (JWT vérifié par la plateforme,
//    config.toml verify_jwt = true, puis ici auth.getUser) ; user_id tiré du JWT, jamais du corps.
//  * Réservation d'une demande en base AVANT l'appel (ai_reserve : espace activé, fonction cochée,
//    quota mensuel de l'espace, limite du jour par utilisateur), puis jetons comptés (ai_commit).
//  * Texte seulement, données personnelles masquées (lib.ts redact) avant l'envoi.
//  * Aucun prompt ni réponse stocké ni journalisé : seuls des codes d'erreur sont écrits dans les logs.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { labelOf, type Provider } from '../_shared/ai/catalogue.ts';
import { providerKey } from '../_shared/ai/keys.ts';
import { CONSOLE_ACTIONS, consoleAction, type ProviderRow } from '../_shared/ai/console.ts';
import { FN_OF_TASK, FUNCTIONS, cutFeatures, resolve, type Fn } from '../_shared/ai/functions.ts';
import {
  DEFAULT_RULES,
  autoMenuOf,
  autoPick,
  fallbackOf,
  menuOf,
  requested,
  workspaceMenu,
  type AssistantRow,
  type AutoRules,
} from '../_shared/ai/assistant.ts';
import * as claude from '../_shared/ai/providers/anthropic.ts';
import * as eleven from '../_shared/ai/providers/elevenlabs.ts';
import * as openai from '../_shared/ai/providers/openai.ts';
import {
  AiError,
  DEADLINE_MS,
  FEATURE_OF,
  applyModel,
  buildPrompt,
  checkOutput,
  parseRequest,
} from './lib.ts';
import {
  STT_MODEL,
  TTS_FORMAT,
  TTS_MODEL,
  STT_MAX_S,
  VOICES,
  VOICE_MAX_BYTES,
  VOICE_MAX_MS,
  cuesFromWords,
  mp3DurationMs,
  parseCaptions,
  parseVoice,
  providerRefusal,
  resolveVoices,
  SAMPLE_TEXT,
  accountVoices,
  sampleLang,
  samplePath,
  voiceIdFor,
  type AccountVoice,
} from './audio.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RANK: Record<string, number> = { viewer: 1, editor: 2, admin: 3, owner: 4 };
const MAX_BODY = 200_000;

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

/** L41 étape 2 : clé du coffre (rôle de service), puis variable de déploiement. */
const vaultRead = async (p: Provider) => {
  const { data, error } = await admin.rpc('ai_key_read', { p_provider: p });
  return error || typeof data !== 'string' || !data ? null : data;
};
const keyOf = async (p: Provider) => (await providerKey(p, vaultRead))?.key ?? null;

/** L41 étape 3 : modèles choisis dans la Console (cache de 60 s, comme les clés). */
let fnCache: { at: number; v: Partial<Record<Fn, string>> } | null = null;
async function fnModels(fresh = false): Promise<Partial<Record<Fn, string>>> {
  if (!fresh && fnCache && Date.now() - fnCache.at < 60_000) return fnCache.v;
  const { data } = await admin.from('ai_function_models').select('fn, model');
  const v = Object.fromEntries(
    ((data ?? []) as Array<{ fn: Fn; model: string }>).map((r) => [r.fn, r.model]),
  );
  fnCache = { at: Date.now(), v };
  return v;
}
async function keySet() {
  const out = new Set<Provider>();
  for (const p of ['anthropic', 'openai', 'elevenlabs'] as const) if (await keyOf(p)) out.add(p);
  return out;
}
/** L41 étape 4 : liste de l'assistant et règles d'Auto (cache de 60 s). */
let asstCache: { at: number; rows: AssistantRow[]; rules: AutoRules } | null = null;
async function assistantConfig(fresh = false) {
  if (!fresh && asstCache && Date.now() - asstCache.at < 60_000) return asstCache;
  const [{ data: rows }, { data: rules }] = await Promise.all([
    admin.from('ai_assistant_models').select('model, position, proposed, tag'),
    admin.from('ai_auto_rules').select('rule, model'),
  ]);
  asstCache = {
    at: Date.now(),
    rows: (rows ?? []) as AssistantRow[],
    rules: {
      ...DEFAULT_RULES,
      ...Object.fromEntries(
        ((rules ?? []) as Array<{ rule: string; model: string }>).map((r) => [r.rule, r.model]),
      ),
    } as AutoRules,
  };
  return asstCache;
}
/**
 * Menu de l'assistant pour un espace (L41 étape 5) : modèles de la Console, utilisables, gardés par
 * l'espace. `all` : le menu de la Console (Paramètres de l'espace, relais d'Auto) ; `chosen` : la liste de
 * l'espace, null tant qu'elle n'a jamais été enregistrée.
 */
async function assistantMenu(ws: string) {
  const c = await assistantConfig();
  const all = menuOf(c.rows, await keySet());
  const { data } = await admin.from('workspaces').select('settings').eq('id', ws).maybeSingle();
  const raw = (data?.settings as { ai?: { models?: unknown } } | null)?.ai?.models;
  const chosen = Array.isArray(raw) ? (raw as string[]) : null;
  return { menu: workspaceMenu(all, chosen), all, chosen, rules: c.rules };
}

/** Fonctions coupées tenues à jour pour les espaces (ai_cut), au plus une écriture par changement. */
let lastCut: string | null = null;
async function syncCut(features: string[]) {
  const k = features.join(',');
  if (k === lastCut) return;
  const { error } = await admin.rpc('ai_set_cut', { p_features: features });
  if (error) console.error('ai: cut', error.code);
  else lastCut = k;
}
/** Résolution du modèle de la tâche (choisi, repli ou coupure) ; met à jour les fonctions coupées. */
async function resolveTask(task: string) {
  const keys = await keySet();
  const chosen = await fnModels();
  const all = FUNCTIONS.map((def) => resolve(def, chosen[def.fn], keys));
  await syncCut(cutFeatures(all));
  return all.find((r) => r.fn === FN_OF_TASK[task]) ?? null;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

const renewsOn = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
};

const ELEVEN = eleven.ELEVEN;

/** Client au nom de l'utilisateur (RLS : dossiers restreints compris), pour vérifier l'accès à l'étape. */
const asUser = (req: Request) =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false },
    global: { headers: { authorization: req.headers.get('authorization') ?? '' } },
  });

async function reserveOr(ws: string, uid: string, feature: string, audio = 0): Promise<Response | null> {
  const reserve = await admin.rpc('ai_reserve', {
    p_ws: ws,
    p_user: uid,
    p_feature: feature,
    p_audio_seconds: audio,
  });
  if (!reserve.error) return null;
  const code = ['AI_DISABLED', 'AI_QUOTA_AUDIO', 'AI_QUOTA_WORKSPACE', 'AI_QUOTA_USER', 'FORBIDDEN'].find(
    (c) => reserve.error!.message.includes(c),
  );
  if (code === 'AI_DISABLED' || code === 'FORBIDDEN') return json(403, { error: code });
  if (code) return json(429, { error: code, renewsOn: renewsOn() });
  console.error('ai: reserve', reserve.error.code);
  return json(500, { error: 'SERVER' });
}

/**
 * L62 §8 : voix du compte du fournisseur (GET /voices, cache d'une heure). En cas d'erreur du fournisseur
 * (clé sans le droit de lire les voix, panne), rien n'est mis en cache : les anciens emplacements gardent
 * leurs identifiants prévus et la génération n'est pas bloquée.
 */
let catalog: { at: number; account: AccountVoice[] } | null = null;
async function accountList(key: string): Promise<AccountVoice[] | null> {
  if (catalog && Date.now() - catalog.at < 3_600_000) return catalog.account;
  const res = await eleven.voices(key);
  if (!res?.ok) {
    console.error('ai: voices', await refusalOf(res).then((r) => r.log));
    return null;
  }
  const out = (await res.json().catch(() => ({}))) as { voices?: AccountVoice[] };
  const account = Array.isArray(out.voices) ? out.voices : [];
  console.log('ai: voices', `account=${account.length}`);
  catalog = { at: Date.now(), account };
  return account;
}
/** Voix proposées (toutes celles du compte) et correspondance des anciens emplacements. */
async function voiceCatalog(key: string, lang: string) {
  const account = await accountList(key);
  if (!account) return { list: null, aliases: { ...VOICES } };
  return { list: accountVoices(account, lang), aliases: resolveVoices(account, lang) };
}

/** Refus du fournisseur : statut et code court, jamais le message (il peut reprendre le texte envoyé). */
async function refusalOf(res: Response | null | undefined) {
  if (!res) return providerRefusal(null, null);
  return providerRefusal(res.status, await res.json().catch(() => null));
}

const purge = (key: string, url: string, what: string) => eleven.purge(key, url, what);

const dataUrl = (bytes: Uint8Array) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:audio/mpeg;base64,${btoa(bin)}`;
};

/**
 * L62 §8 : exemple d'une voix dans la langue de la démo. Phrase courte fixe, générée une seule fois par voix
 * et par langue puis gardée (bucket voices, hors des dossiers des espaces), sans compter dans le quota.
 * Repli sur l'extrait du fournisseur (souvent en anglais) seulement si la génération échoue.
 */
async function voiceSample(key: string, voice: string, langIn: unknown) {
  const lang = sampleLang(langIn);
  const { list, aliases } = await voiceCatalog(key, lang);
  const id = voiceIdFor(voice, list, aliases);
  if (!id) return json(400, { error: 'BAD_VOICE' });
  const path = samplePath(id, lang);
  const cached = await admin.storage.from('voices').download(path);
  if (!cached.error && cached.data)
    return json(200, { result: { audio: dataUrl(new Uint8Array(await cached.data.arrayBuffer())), lang } });
  const res = await eleven.tts(key, id, TTS_FORMAT, { text: SAMPLE_TEXT[lang], model_id: TTS_MODEL });
  if (res?.ok) {
    const bytes = new Uint8Array(await res.arrayBuffer());
    const hid = res.headers.get('history-item-id');
    if (hid && /^[A-Za-z0-9]{1,64}$/.test(hid)) await purge(key, `${ELEVEN}/history/${hid}`, 'sample');
    if (bytes.byteLength > 0 && bytes.byteLength <= 1024 * 1024) {
      const up = await admin.storage
        .from('voices')
        .upload(path, bytes, { contentType: 'audio/mpeg', upsert: true });
      if (up.error) console.error('ai: sample cache', up.error.message);
      return json(200, { result: { audio: dataUrl(bytes), lang } });
    }
  } else console.error('ai: sample tts', (await refusalOf(res)).log);
  // Repli : extrait du fournisseur
  const meta = await eleven.voice(key, id);
  if (!meta?.ok) {
    const r = await refusalOf(meta);
    console.error('ai: sample', r.log);
    return json(r.http, { error: r.error });
  }
  const url = ((await meta.json().catch(() => ({}))) as { preview_url?: string }).preview_url;
  if (!url || !/^https:\/\//.test(url)) {
    console.error('ai: sample no_preview_url');
    return json(424, { error: 'PROVIDER_VOICE' });
  }
  const mp3 = await fetch(url).catch(() => null);
  if (!mp3?.ok) {
    console.error('ai: sample preview', mp3?.status ?? 'network');
    return json(502, { error: 'PROVIDER' });
  }
  const bytes = new Uint8Array(await mp3.arrayBuffer());
  if (bytes.byteLength > 1024 * 1024) return json(502, { error: 'PROVIDER' });
  return json(200, { result: { audio: dataUrl(bytes), lang: null } });
}

/**
 * 065 Voix de synthèse (TTS) et 066 Sous-titres automatiques (STT), ElevenLabs. Seule cette fonction
 * lit ELEVENLABS_API_KEY. Rien n'est conservé hors des fichiers produits (voix : bucket voices).
 */
async function audio(req: Request, body: Record<string, unknown>, ws: string, uid: string) {
  // L41 étape 3 : fonction coupée (clé manquante) : « Indisponible pour le moment », sans quota
  const r = await resolveTask(String(body.task));
  if (r && (r.status === 'cut' || r.status === 'off')) return json(503, { error: 'UNAVAILABLE' });
  const key = await keyOf('elevenlabs');
  if (!key) return json(503, { error: 'PROVIDER' });
  const input = (body.input ?? {}) as Record<string, unknown>;
  if (body.task === 'voice_sample' || body.task === 'voice_list') {
    // Fonction activée exigée, sans réservation (aucun quota, aucune donnée de l'utilisateur)
    const { data: cfg } = await admin.rpc('ai_config', { p_ws: ws });
    const c = cfg as { enabled?: boolean; features?: Record<string, boolean> } | null;
    if (!c?.enabled || !c.features?.voice) return json(403, { error: 'AI_DISABLED' });
    if (body.task === 'voice_list') {
      // L62 §8 : toutes les voix utilisables du compte, recommandées pour la langue de la démo d'abord ;
      // aliases : voix des anciens emplacements (claire, louise…), pour les démos qui les utilisent
      const { list, aliases } = await voiceCatalog(key, sampleLang(body.lang));
      return json(200, { result: { voices: list ?? [], aliases } });
    }
    return voiceSample(key, String(input.voice ?? ''), body.lang);
  }
  let parsed;
  try {
    parsed = body.task === 'voice' ? parseVoice(input) : parseCaptions(input);
  } catch (e) {
    return e instanceof AiError ? json(e.status, { error: e.code }) : json(400, { error: 'BAD_REQUEST' });
  }
  // L'étape doit être visible par l'utilisateur (RLS) et appartenir à l'espace
  const { data: step } = await asUser(req)
    .from('steps')
    .select('id, demo_id, workspace_id, kind, video_path, video_duration_ms, voice_path, voice_duration_ms')
    .eq('id', parsed.stepId)
    .maybeSingle();
  if (!step || step.workspace_id !== ws) return json(404, { error: 'NOT_FOUND' });
  const refund = () =>
    admin.rpc('ai_commit', { p_ws: ws, p_user: uid, p_input: 0, p_output: 0, p_refund: true });

  if (body.task === 'voice') {
    const v = parsed as ReturnType<typeof parseVoice>;
    const { list, aliases } = await voiceCatalog(key, sampleLang(body.lang));
    const voiceId = voiceIdFor(v.voice, list, aliases);
    if (!voiceId) return json(400, { error: 'BAD_VOICE' });
    const blocked = await reserveOr(ws, uid, 'voice', v.estimate);
    if (blocked) return blocked;
    const res = await eleven.tts(key, voiceId, TTS_FORMAT, {
      text: v.text,
      model_id: TTS_MODEL,
      voice_settings: { speed: v.speed },
    });
    if (!res || !res.ok) {
      await refund();
      const r = await refusalOf(res);
      console.error('ai: tts', r.log);
      return json(r.http, { error: r.error });
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    // Historique de la génération supprimé chez le fournisseur (identifiant renvoyé dans l'en-tête)
    const hid = res.headers.get('history-item-id');
    if (hid && /^[A-Za-z0-9]{1,64}$/.test(hid)) await purge(key, `${ELEVEN}/history/${hid}`, 'tts');
    const durationMs = mp3DurationMs(bytes.byteLength);
    await admin.rpc('ai_commit', {
      p_ws: ws,
      p_user: uid,
      p_input: 0,
      p_output: 0,
      p_tts_seconds: Math.min(3600, Math.ceil(durationMs / 1000)),
    });
    if (bytes.byteLength > VOICE_MAX_BYTES || durationMs > VOICE_MAX_MS)
      return json(422, { error: 'TOO_LONG' });
    const path = `${ws}/${step.demo_id}/${crypto.randomUUID()}.mp3`;
    const up = await admin.storage
      .from('voices')
      .upload(path, bytes, { contentType: 'audio/mpeg', upsert: false });
    if (up.error) return json(400, { error: 'STORAGE' });
    return json(200, { result: { path, durationMs } });
  }

  // Sous-titres : la piste audio (vidéo de l'étape ou voix off) part chez le fournisseur, après avertissement
  const c = parsed as ReturnType<typeof parseCaptions>;
  const bucket = c.source === 'voice' ? 'voices' : 'videos';
  const path = c.source === 'voice' ? step.voice_path : step.kind === 'video' ? step.video_path : null;
  const ms = Number((c.source === 'voice' ? step.voice_duration_ms : step.video_duration_ms) ?? 0);
  if (!path) return json(400, { error: 'NO_AUDIO' });
  if (ms > STT_MAX_S * 1000) return json(422, { error: 'TOO_LONG' });
  const seconds = Math.min(STT_MAX_S, Math.max(1, Math.ceil(ms / 1000)));
  const blocked = await reserveOr(ws, uid, 'captions', seconds);
  if (blocked) return blocked;
  const file = await admin.storage.from(bucket).download(path);
  if (file.error || !file.data) {
    await refund();
    return json(404, { error: 'NOT_FOUND' });
  }
  const form = new FormData();
  form.append('model_id', STT_MODEL);
  form.append('file', file.data, path.split('/').pop() ?? 'audio');
  const lang = typeof body.lang === 'string' ? body.lang.slice(0, 2).toLowerCase() : '';
  if (/^[a-z]{2}$/.test(lang)) form.append('language_code', lang);
  const res = await eleven.stt(key, form);
  if (!res || !res.ok) {
    await refund();
    const r = await refusalOf(res);
    console.error('ai: stt', r.log);
    return json(r.http, { error: r.error });
  }
  const out = (await res.json().catch(() => ({}))) as {
    text?: string;
    language_code?: string;
    transcription_id?: string;
    words?: Array<{ text: string; start: number; end: number; type?: string }>;
  };
  // Transcription supprimée chez le fournisseur dès réception
  if (typeof out.transcription_id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(out.transcription_id))
    await purge(key, `${ELEVEN}/speech-to-text/transcripts/${out.transcription_id}`, 'stt');
  await admin.rpc('ai_commit', { p_ws: ws, p_user: uid, p_input: 0, p_output: 0, p_stt_seconds: seconds });
  return json(200, {
    result: {
      captions: cuesFromWords(Array.isArray(out.words) ? out.words : []),
      text: typeof out.text === 'string' ? out.text.trim().slice(0, 4000) : '',
      language: typeof out.language_code === 'string' ? out.language_code.slice(0, 8) : '',
    },
  });
}

/** L41 étape 2 : actions de la Console (fournisseurs, clés), réservées aux comptes de la plateforme. */
async function consoleOf(req: Request, body: Record<string, unknown>) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const reply = await consoleAction(body, {
    role: async () => {
      if (!token) return null;
      const { data } = await admin.auth.getUser(token);
      const uid = data.user?.id;
      if (!uid) return null;
      const { data: row } = await admin
        .from('platform_admins')
        .select('role')
        .eq('user_id', uid)
        .maybeSingle();
      return row ? { uid, admin: row.role === 'admin' } : null;
    },
    vault: vaultRead,
    rows: async () => {
      const { data } = await admin.from('ai_providers').select('*');
      return (data ?? []) as ProviderRow[];
    },
    save: async (provider, key, uid, ms) => {
      const { data, error } = await admin.rpc('ai_key_save', {
        p_provider: provider,
        p_key: key,
        p_actor: uid,
        p_ms: ms,
      });
      // Jamais le message d'erreur complet (il pourrait citer la requête)
      if (error) throw new Error(/NO_VAULT/.test(error.message) ? 'NO_VAULT' : 'SERVER');
      return { replaced: !!(data as { replaced?: boolean } | null)?.replaced };
    },
    tested: async (provider, r, uid) => {
      const { error } = await admin.rpc('ai_key_tested', {
        p_provider: provider,
        p_ok: r.ok,
        p_cause: r.ok ? null : r.cause,
        p_ms: r.ms,
        p_actor: uid,
      });
      if (error) console.error('ai: console tested', error.code);
    },
    fnModels: () => fnModels(true),
    setModel: async (fn, model, uid, label) => {
      const { data, error } = await admin.rpc('ai_set_function_model', {
        p_fn: fn,
        p_model: model,
        p_actor: uid,
        p_label: label,
      });
      if (error) throw new Error('SERVER');
      fnCache = null;
      return { old: (data as { old?: string | null } | null)?.old ?? null };
    },
    setCut: syncCut,
    assistantRows: async () => (await assistantConfig(true)).rows,
    autoRules: async () => (await assistantConfig(true)).rules,
    setAssistant: async (rows, uid, label) => {
      const { error } = await admin.rpc('ai_assistant_set', { p_models: rows, p_actor: uid, p_label: label });
      if (error) throw new Error(/LAST_MODEL/.test(error.message) ? 'LAST_MODEL' : 'SERVER');
      asstCache = null;
    },
    setRule: async (rule, model, uid, label) => {
      const { data, error } = await admin.rpc('ai_auto_rule_set', {
        p_rule: rule,
        p_model: model,
        p_actor: uid,
        p_label: label,
      });
      if (error) throw new Error('SERVER');
      asstCache = null;
      return { old: (data as { old?: string | null } | null)?.old ?? null };
    },
    test: (provider, key) =>
      provider === 'anthropic'
        ? claude.test(key)
        : provider === 'openai'
          ? openai.test(key)
          : eleven.test(key),
  });
  return json(reply.status, reply.body);
}

async function editorOf(req: Request, ws: string): Promise<string | null> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token || !UUID.test(ws)) return null;
  const { data } = await admin.auth.getUser(token);
  const uid = data.user?.id;
  if (!uid) return null;
  const { data: m } = await admin
    .from('members')
    .select('role')
    .eq('workspace_id', ws)
    .eq('user_id', uid)
    .maybeSingle();
  return m && (RANK[m.role as string] ?? 0) >= RANK.editor! ? uid : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'METHOD' });
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) return json(413, { error: 'TOO_BIG' });
  const raw = await req.text().catch(() => '');
  if (raw.length > MAX_BODY) return json(413, { error: 'TOO_BIG' });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: 'BAD_REQUEST' });
  }
  if (CONSOLE_ACTIONS.includes(String(body.action))) return consoleOf(req, body);
  const ws = String(body.ws ?? '');
  const uid = await editorOf(req, ws);
  if (!uid) return json(403, { error: 'FORBIDDEN' });

  // L41 étape 4 : menu de l'assistant (modèles proposés par la Console, utilisables), sans quota
  if (body.action === 'assistant_models') {
    const a = await assistantMenu(ws);
    return json(200, { result: { models: a.menu, all: a.all, chosen: a.chosen } });
  }

  if (
    body.task === 'voice' ||
    body.task === 'captions' ||
    body.task === 'voice_sample' ||
    body.task === 'voice_list'
  )
    return audio(req, body, ws, uid);

  let parsed;
  try {
    parsed = parseRequest(body);
  } catch (e) {
    return json(400, { error: e instanceof AiError ? e.code : 'BAD_REQUEST' });
  }

  // L41 étape 3 : fonction coupée (clé du fournisseur manquante) : rien n'est réservé ni décompté
  const resolved = await resolveTask(parsed.task);
  if (resolved && (resolved.status === 'cut' || resolved.status === 'off'))
    return json(503, { error: 'UNAVAILABLE' });

  // L41 étape 4 : assistant. Modèle demandé contrôlé contre le menu (403 MODEL), Auto selon les règles
  let assistantModel: string | null = null;
  let asst: Awaited<ReturnType<typeof assistantMenu>> | null = null;
  if (parsed.task === 'assistant') {
    asst = await assistantMenu(ws);
    const want = requested(String(parsed.model), asst.menu);
    if (!want) return json(403, { error: 'MODEL' });
    const msgs = (parsed.payload.messages ?? []) as Array<{ text: string }>;
    assistantModel = want.auto
      ? autoPick(asst.rules, autoMenuOf(asst.menu, asst.all), msgs.at(-1)?.text ?? '')
      : want.model;
    if (!assistantModel) return json(503, { error: 'UNAVAILABLE' });
  }

  const blocked = await reserveOr(ws, uid, FEATURE_OF[parsed.task]);
  if (blocked) return blocked;

  let prompt;
  try {
    prompt = assistantModel
      ? { ...buildPrompt(parsed), model: assistantModel }
      : applyModel(buildPrompt(parsed), parsed);
    // Modèle choisi dans la Console (ou repli d'un modèle retiré), sauf choix explicite dans l'assistant
    const m = resolved?.model;
    if (
      m &&
      m !== 'auto' &&
      (resolved!.explicit || resolved!.status === 'fallback') &&
      parsed.model === 'auto' &&
      !assistantModel
    )
      prompt = { ...prompt, model: m };
  } catch (e) {
    return json(e instanceof AiError ? e.status : 400, {
      error: e instanceof AiError ? e.code : 'BAD_REQUEST',
    });
  }
  let result;
  try {
    try {
      result = await claude.text((await keyOf('anthropic')) ?? '', prompt, {
        deadline: DEADLINE_MS[parsed.task],
      });
    } catch (first) {
      // L41 étape 4 : Auto, modèle indisponible ou surchargé : un essai sur le repli (règle de la Console)
      const fb =
        asst && parsed.model === 'auto' && claude.failure(first).error === 'PROVIDER'
          ? fallbackOf(asst.rules, autoMenuOf(asst.menu, asst.all), prompt.model)
          : null;
      if (!fb) throw first;
      prompt = { ...prompt, model: fb };
      result = await claude.text((await keyOf('anthropic')) ?? '', prompt, {
        deadline: DEADLINE_MS[parsed.task],
      });
    }
  } catch (e) {
    // Aucune réponse (ou pas dans le délai de la tâche) : la demande est rendue, aucun crédit décompté.
    // Seul le statut est journalisé.
    await admin.rpc('ai_commit', { p_ws: ws, p_user: uid, p_input: 0, p_output: 0, p_refund: true });
    const f = claude.failure(e);
    console.error(f.error === 'TIMEOUT' ? 'ai: provider timeout' : 'ai: provider', f.log);
    return json(f.http, { error: f.error });
  }
  await admin.rpc('ai_commit', {
    p_ws: ws,
    p_user: uid,
    p_input: result.usage.input,
    p_output: result.usage.output,
  });
  if (result.error) return json(422, { error: result.error });
  try {
    return json(200, {
      result: checkOutput(parsed.task, result.out, parsed.payload),
      redacted: parsed.redacted,
      // Planche 3 : modèle réellement utilisé (pied « Généré par IA (Auto · Claude Sonnet), à vérifier »)
      model: labelOf(prompt.model),
    });
  } catch (e) {
    return json(502, { error: e instanceof AiError ? e.code : 'BAD_OUTPUT' });
  }
});
