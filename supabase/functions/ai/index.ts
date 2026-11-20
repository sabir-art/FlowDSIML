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

  let parsed;
  try {
    parsed = parseRequest(body);
  } catch (e) {
    return json(400, { error: e instanceof AiError ? e.code : 'BAD_REQUEST' });
  }

  const reserve = await admin.rpc('ai_reserve', {
    p_ws: ws,
    p_user: uid,
    p_feature: FEATURE_OF[parsed.task],
  });
  if (reserve.error) {
    const code = ['AI_DISABLED', 'AI_QUOTA_WORKSPACE', 'AI_QUOTA_USER', 'FORBIDDEN'].find((c) =>
      reserve.error!.message.includes(c),
    );
    if (code === 'AI_DISABLED' || code === 'FORBIDDEN') return json(403, { error: code });
    if (code) return json(429, { error: code, renewsOn: renewsOn() });
    console.error('ai: reserve', reserve.error.code);
    return json(500, { error: 'SERVER' });
  }

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
