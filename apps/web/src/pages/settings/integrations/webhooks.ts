/**
 * L23 : webhooks sortants (Paramètres > Intégrations). Accès admin seulement (RLS) ; création, secret,
 * test et rejeu par RPC. Le test et le rejeu partent tout de suite : la fonction webhooks-dispatch est
 * appelée avec le JWT de l'admin (une livraison, 10 par minute au plus).
 */
import { supabase } from '../../../lib/supabase';
import { check } from '../../../lib/useAction';

/** Événements abonnables (arbitrage du chef d'équipe). alert.triggered : actif depuis L19 (alertes). */
export const WEBHOOK_EVENTS = [
  'lead.created',
  'demo.completed',
  'demo.published',
  'learner.quiz_passed',
  'learner.quiz_failed',
  'learner.module_validated',
  'alert.triggered',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface Webhook {
  id: string;
  workspace_id: string;
  url: string;
  name: string;
  events: string[];
  state: 'active' | 'paused' | 'paused_auto';
  failures: number;
  secret_hint: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Delivery {
  id: string;
  webhook_id: string;
  event_id: string;
  event_type: string;
  payload: unknown;
  status: 'pending' | 'sending' | 'success' | 'failed' | 'dead';
  attempt: number;
  next_attempt_at: string;
  response_status: number | null;
  response_body: string | null;
  duration_ms: number | null;
  error: string | null;
  replay_of: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface SendResult {
  status: number;
  duration_ms: number;
  error: string | null;
  outcome: string | null;
}

// ===== Règles pures (testées) =====

/** Même contrôle que la base (webhook_url_ok), pour un message immédiat ; la base et l'envoi revérifient. */
export function urlOk(raw: string): boolean {
  const v = raw.trim();
  if (v.length > 2048 || !/^https:\/\/[^/?#\s]+([/?#]\S*)?$/.test(v)) return false;
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return false;
  }
  if (u.username || u.password) return false;
  if (u.port && u.port !== '443' && u.port !== '8443') return false;
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (host.startsWith('[') || !host.includes('.')) return false;
  if (host === 'localhost' || /\.(localhost|local|internal|intranet|lan|home\.arpa|corp)$/.test(host))
    return false;
  const ip = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
  if (ip) {
    const [a, b, c] = ip.slice(1).map(Number) as [number, number, number];
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    )
      return false;
  }
  return true;
}

export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

/** Pastille de statut : vert 2xx, framboise 4xx/5xx ou échec réseau, orange en attente. */
export function statusKind(d: Pick<Delivery, 'status' | 'response_status'>): 'ok' | 'ko' | 'wait' {
  if (d.status === 'success') return 'ok';
  if (d.status === 'pending' || d.status === 'sending') return 'wait';
  return 'ko';
}
export const statusText = (d: Pick<Delivery, 'status' | 'response_status'>) =>
  d.status === 'success' || d.status === 'failed' || d.status === 'dead'
    ? String(d.response_status || '—')
    : '…';

/** Conseil après un test en échec (spec L23 §7). */
export function testAdvice(status: number, error: string | null): string {
  if (status === 404 || status === 410) return 'notFound';
  if (status === 401 || status === 403) return 'refused';
  if (status >= 500) return 'server';
  if (error && /10 s|délai/i.test(error)) return 'timeout';
  if (status === 0) return 'unreachable';
  return 'other';
}

/** « tcsec_••••…3f9a » : 4 derniers caractères seulement (jamais le secret). */
export const maskedSecret = (hint: string) => `tcsec_${'•'.repeat(16)}${hint}`;

// ===== Accès aux données =====

export async function listWebhooks(ws: string): Promise<Webhook[]> {
  const { data } = await supabase
    .from('webhooks')
    .select('*')
    .eq('workspace_id', ws)
    .order('created_at', { ascending: false });
  return (data ?? []) as Webhook[];
}

export async function lastDeliveries(ids: string[]): Promise<Record<string, Delivery>> {
  if (!ids.length) return {};
  const { data } = await supabase
    .from('webhook_deliveries')
    .select('*')
    .in('webhook_id', ids)
    .order('created_at', { ascending: false })
    .limit(200);
  const out: Record<string, Delivery> = {};
  for (const d of (data ?? []) as Delivery[]) out[d.webhook_id] ??= d;
  return out;
}

export async function listDeliveries(webhookId: string): Promise<Delivery[]> {
  const { data } = await supabase
    .from('webhook_deliveries')
    .select('*')
    .eq('webhook_id', webhookId)
    .order('created_at', { ascending: false })
    .limit(100);
  return (data ?? []) as Delivery[];
}

export async function createWebhook(ws: string, url: string, events: string[], name: string) {
  return check(
    await supabase.rpc('webhook_create', {
      p_ws: ws,
      p_url: url.trim(),
      p_events: events,
      p_name: name.trim(),
    }),
  ) as unknown as { id: string; secret: string };
}

export async function updateWebhook(id: string, patch: { url: string; events: string[]; name: string }) {
  check(await supabase.from('webhooks').update(patch).eq('id', id));
}

export async function deleteWebhook(id: string) {
  check(await supabase.from('webhooks').delete().eq('id', id));
}

export async function setState(id: string, state: 'active' | 'paused') {
  check(await supabase.rpc('webhook_set_state', { p_id: id, p_state: state }));
}

export async function rotateSecret(id: string): Promise<string> {
  return check(await supabase.rpc('webhook_rotate_secret', { p_id: id })) as string;
}

/** Envoi immédiat d'une livraison en attente (test ou rejeu). */
export async function sendNow(deliveryId: string): Promise<SendResult> {
  const { data, error } = await supabase.functions.invoke('webhooks-dispatch', {
    body: { delivery_id: deliveryId },
  });
  if (error) throw error;
  return data as SendResult;
}

export async function sendTest(id: string): Promise<SendResult> {
  const delivery = check(await supabase.rpc('webhook_send_test', { p_id: id })) as string;
  return sendNow(delivery);
}

export async function replay(deliveryId: string): Promise<SendResult> {
  const delivery = check(await supabase.rpc('webhook_replay', { p_delivery: deliveryId })) as string;
  return sendNow(delivery);
}
