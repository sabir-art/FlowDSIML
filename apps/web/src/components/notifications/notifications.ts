/**
 * L22-05 : logique pure du centre de notifications (groupes par date, extrait, mentions).
 * Les notifications ne portent que des références ; le texte vient de step_comments (RLS).
 */

export type NotificationKind =
  'mention' | 'comment' | 'reply' | 'resolved' | 'alert' | 'webhook_paused' | 'invite' | 'lead';
/** Notifications système : sans fil de commentaires. */
export const isSystemKind = (k: NotificationKind) =>
  k === 'alert' || k === 'webhook_paused' || k === 'invite' || k === 'lead';
export const NOTIFICATION_KINDS: NotificationKind[] = [
  'mention',
  'reply',
  'comment',
  'resolved',
  'alert',
  'lead',
];

/** L19 : contenu d'une alerte (aucune donnée personnelle). */
export interface AlertData {
  trigger?: string;
  count?: number;
  value?: number | null;
  threshold?: number | null;
  digest?: 'daily' | 'weekly';
  /** L29 : webhook en pause (hôte et nom du webhook). */
  webhookId?: string;
  host?: string;
  name?: string;
  /** E-mails P1 : invitation à rejoindre un espace (compte existant), et la réponse donnée. */
  invitation?: string;
  workspace?: string;
  actor?: string | null;
  answer?: 'accepted' | 'declined';
}

export interface NotificationRow {
  id: string;
  kind: NotificationKind;
  /** Nuls pour une alerte (L19) ; renseignés pour un commentaire. */
  demo_id: string | null;
  step_id: string | null;
  comment_id: string | null;
  alert_id?: string | null;
  data?: AlertData | null;
  actor_id: string | null;
  created_at: string;
  read_at: string | null;
}

export type NotificationGroup = 'today' | 'week' | 'older';

/** Aujourd'hui (même jour civil), Cette semaine (moins de 7 jours), Plus ancien. */
export function groupOf(iso: string, now: number = Date.now()): NotificationGroup {
  const t = new Date(iso);
  const n = new Date(now);
  if (t.getFullYear() === n.getFullYear() && t.getMonth() === n.getMonth() && t.getDate() === n.getDate())
    return 'today';
  return now - t.getTime() < 7 * 86400_000 ? 'week' : 'older';
}

export function grouped<T extends { created_at: string }>(rows: T[], now: number = Date.now()) {
  const out: Array<{ group: NotificationGroup; rows: T[] }> = [];
  for (const r of rows) {
    const g = groupOf(r.created_at, now);
    const last = out[out.length - 1];
    if (last?.group === g) last.rows.push(r);
    else out.push({ group: g, rows: [r] });
  }
  return out;
}

/** « 9+ » au-delà de 9 ; rien à 0. */
export const badge = (n: number) => (n <= 0 ? '' : n > 9 ? '9+' : String(n));

export { bodyParts, type BodyPart } from '../../lib/mentions';
import { bodyParts } from '../../lib/mentions';

/** Texte lisible d'un message (mentions réduites à « @Nom »), pour un extrait ou un libellé. */
export const plainBody = (body: string) =>
  bodyParts(body)
    .map((p) => ('text' in p ? p.text : `@${p.mention}`))
    .join('');

/** Extrait sur une ligne, coupé au mot, 140 caractères au plus. */
export function excerpt(body: string, max = 140): string {
  const flat = plainBody(body).replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}

export type NotificationPrefs = Record<NotificationKind, boolean>;

/** Préférences stockées (clés absentes = activées). */
export function readPrefs(raw: unknown): NotificationPrefs {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  // L28-06 : les mentions sont toujours signalées
  return Object.fromEntries(
    NOTIFICATION_KINDS.map((k) => [k, k === 'mention' || o[k] !== false]),
  ) as NotificationPrefs;
}

/**
 * Lien vers l'éditeur, sur l'étape, avec le fil ouvert ; une alerte mène à l'onglet Alertes, un nouveau
 * lead aux leads de la démo (Analytics de la démo ; la carte « Leads » prend le focus, LEADS_FOCUS).
 */
export const notificationHref = (n: Pick<NotificationRow, 'kind' | 'demo_id' | 'step_id' | 'comment_id'>) =>
  n.kind === 'alert'
    ? '/analytics?tab=alerts'
    : n.kind === 'webhook_paused'
      ? '/settings/integrations'
      : n.kind === 'lead'
        ? `/demos/${n.demo_id}/analytics`
        : `/demos/${n.demo_id}/edit?step=${n.step_id}${n.comment_id ? `&comment=${n.comment_id}` : ''}`;

/** Cible du focus à l'arrivée depuis une notification « Nouveau lead » (routeFocus, state.focus). */
export const LEADS_FOCUS = 'da-leads';
