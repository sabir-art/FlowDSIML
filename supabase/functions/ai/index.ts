// Edge Function `ai` (L30 Assistance IA) : seule à lire ANTHROPIC_API_KEY, jamais exposée au client.
//  * POST { ws, task, lang, input } : utilisateur éditeur ou plus (JWT vérifié par la plateforme,
//    config.toml verify_jwt = true, puis ici auth.getUser) ; user_id tiré du JWT, jamais du corps.
//  * Réservation d'une demande en base AVANT l'appel (ai_reserve : espace activé, fonction cochée,
//    quota mensuel de l'espace, limite du jour par utilisateur), puis jetons comptés (ai_commit).
//  * Texte seulement, données personnelles masquées (lib.ts redact) avant l'envoi.
//  * Aucun prompt ni réponse stocké ni journalisé : seuls des codes d'erreur sont écrits dans les logs.
import Anthropic from 'npm:@anthropic-ai/sdk@1.11.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { AiError, FEATURE_OF, SONNET, buildPrompt, checkOutput, parseRequest } from './lib.ts';
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
  type AccountVoice,
} from './audio.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RANK: Record<string, number> = { viewer: 1, editor: 2, admin: 3, owner: 4 };
const MAX_BODY = 200_000;

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});
const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '',
  timeout: 90_000,
  maxRetries: 1,
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

const renewsOn = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
};

const ELEVEN = 'https://api.elevenlabs.io/v1';

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
 * Voix prédéfinies réellement disponibles sur le compte (GET /voices, cache d'une heure) : les voix
 * absentes sont masquées. En cas d'erreur du fournisseur, la liste complète est gardée sans être mise en cache.
 */
let catalog: { at: number; map: Record<string, string> } | null = null;
/** L62 : voix proposée → identifiant d'une voix DU COMPTE (resolveVoices), cache d'une heure. */
async function voiceMap(key: string): Promise<Record<string, string>> {
  if (catalog && Date.now() - catalog.at < 3_600_000) return catalog.map;
  const res = await fetch(`${ELEVEN}/voices?show_legacy=true`, { headers: { 'xi-api-key': key } }).catch(
    () => null,
  );
  if (!res?.ok) {
    console.error('ai: voices', await refusalOf(res).then((r) => r.log));
    return { ...VOICES };
  }
  const out = (await res.json().catch(() => ({}))) as { voices?: AccountVoice[] };
  const map = resolveVoices(out.voices ?? []);
  // Combien de voix prévues existent telles quelles sur le compte, et combien ont été remplacées
  const kept = Object.keys(map).filter((k) => map[k] === VOICES[k]).length;
  console.log(
    'ai: voices',
    `account=${(out.voices ?? []).length} kept=${kept} mapped=${Object.keys(map).length - kept}`,
  );
  catalog = { at: Date.now(), map };
  return map;
}

/** Refus du fournisseur : statut et code court, jamais le message (il peut reprendre le texte envoyé). */
async function refusalOf(res: Response | null | undefined) {
  if (!res) return providerRefusal(null, null);
  return providerRefusal(res.status, await res.json().catch(() => null));
}

/** Suppression immédiate côté fournisseur après génération (historique TTS, transcription STT). */
async function purge(key: string, url: string, what: string) {
  const res = await fetch(url, { method: 'DELETE', headers: { 'xi-api-key': key } }).catch(() => null);
  if (!res?.ok) console.error(`ai: purge ${what}`, res?.status ?? 'network');
}

/** Extrait d'une voix (fourni par le fournisseur) : aucun texte envoyé, aucun quota consommé. */
async function voiceSample(key: string, voice: string) {
  const id = (await voiceMap(key))[voice];
  if (!id) return json(400, { error: 'BAD_VOICE' });
  const meta = await fetch(`${ELEVEN}/voices/${id}`, { headers: { 'xi-api-key': key } }).catch(() => null);
  if (!meta?.ok) {
    const r = await refusalOf(meta);
    console.error('ai: sample', r.log);
    return json(r.http, { error: r.error });
  }
  const url = ((await meta.json().catch(() => ({}))) as { preview_url?: string }).preview_url;
  if (!url || !/^https:\/\//.test(url)) {
    console.error('ai: sample no_preview_url');
    return json(502, { error: 'PROVIDER_VOICE' });
  }
  const mp3 = await fetch(url).catch(() => null);
  if (!mp3?.ok) {
    console.error('ai: sample preview', mp3?.status ?? 'network');
    return json(502, { error: 'PROVIDER' });
  }
  const bytes = new Uint8Array(await mp3.arrayBuffer());
  if (bytes.byteLength > 1024 * 1024) return json(502, { error: 'PROVIDER' });
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return json(200, { result: { audio: `data:audio/mpeg;base64,${btoa(bin)}` } });
}

/**
 * 065 Voix de synthèse (TTS) et 066 Sous-titres automatiques (STT), ElevenLabs. Seule cette fonction
 * lit ELEVENLABS_API_KEY. Rien n'est conservé hors des fichiers produits (voix : bucket voices).
 */
async function audio(req: Request, body: Record<string, unknown>, ws: string, uid: string) {
  const key = Deno.env.get('ELEVENLABS_API_KEY');
  if (!key) return json(503, { error: 'PROVIDER' });
  const input = (body.input ?? {}) as Record<string, unknown>;
  if (body.task === 'voice_sample' || body.task === 'voice_list') {
    // Fonction activée exigée, sans réservation (aucun quota, aucune donnée de l'utilisateur)
    const { data: cfg } = await admin.rpc('ai_config', { p_ws: ws });
    const c = cfg as { enabled?: boolean; features?: Record<string, boolean> } | null;
    if (!c?.enabled || !c.features?.voice) return json(403, { error: 'AI_DISABLED' });
    if (body.task === 'voice_list')
      return json(200, { result: { voices: Object.keys(await voiceMap(key)) } });
    return voiceSample(key, String(input.voice ?? ''));
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
    const voiceId = (await voiceMap(key))[v.voice];
    if (!voiceId) return json(400, { error: 'BAD_VOICE' });
    const blocked = await reserveOr(ws, uid, 'voice', v.estimate);
    if (blocked) return blocked;
    const res = await fetch(`${ELEVEN}/text-to-speech/${voiceId}?output_format=${TTS_FORMAT}`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text: v.text, model_id: TTS_MODEL, voice_settings: { speed: v.speed } }),
    }).catch(() => null);
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
  const res = await fetch(`${ELEVEN}/speech-to-text`, {
    method: 'POST',
    headers: { 'xi-api-key': key },
    body: form,
  }).catch(() => null);
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

/** Appel au modèle. Sonnet : repli côté serveur sur refus (« default ») ; Haiku n'en a pas. */
async function callModel(prompt: ReturnType<typeof buildPrompt>) {
  const output_config = {
    effort: prompt.model === SONNET ? ('medium' as const) : ('low' as const),
    ...(prompt.schema ? { format: { type: 'json_schema' as const, schema: prompt.schema } } : {}),
  };
  const res =
    prompt.model === SONNET
      ? await anthropic.beta.messages.create({
          model: prompt.model,
          max_tokens: prompt.maxTokens,
          system: prompt.system,
          messages: prompt.messages,
          output_config,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
        })
      : await anthropic.messages.create({
          model: prompt.model,
          max_tokens: prompt.maxTokens,
          system: prompt.system,
          messages: prompt.messages,
          output_config,
        });
  const usage = {
    input: Number(res.usage?.input_tokens ?? 0),
    output: Number(res.usage?.output_tokens ?? 0),
  };
  if (res.stop_reason === 'refusal') return { usage, error: 'REFUSED' as const };
  if (res.stop_reason === 'max_tokens') return { usage, error: 'TOO_LONG' as const };
  const text = (res.content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');
  if (!prompt.schema) return { usage, out: { text } };
  try {
    return { usage, out: JSON.parse(text) };
  } catch {
    return { usage, error: 'BAD_OUTPUT' as const };
  }
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
  const ws = String(body.ws ?? '');
  const uid = await editorOf(req, ws);
  if (!uid) return json(403, { error: 'FORBIDDEN' });

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

  const blocked = await reserveOr(ws, uid, FEATURE_OF[parsed.task]);
  if (blocked) return blocked;

  const prompt = buildPrompt(parsed);
  let result;
  try {
    result = await callModel(prompt);
  } catch (e) {
    // Aucune réponse : la demande est rendue. Seul le statut est journalisé.
    await admin.rpc('ai_commit', { p_ws: ws, p_user: uid, p_input: 0, p_output: 0, p_refund: true });
    const status = e instanceof Anthropic.APIError ? (e.status ?? 0) : 0;
    console.error('ai: provider', status || (e instanceof Error ? e.name : 'unknown'));
    return json(status === 429 || status === 529 ? 503 : 502, { error: 'PROVIDER' });
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
    });
  } catch (e) {
    return json(502, { error: e instanceof AiError ? e.code : 'BAD_OUTPUT' });
  }
});
