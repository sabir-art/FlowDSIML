/**
 * L22-08 : présence sur une démo. Canal Realtime privé « demo:<uuid> » (policies de la migration
 * 20261118150000 : extension presence seulement, sujet vérifié par regex puis has_role viewer).
 * Rien de sensible dans la charge utile : identifiants, étape, clé d'activité, instants, curseur.
 */

export type Activity =
  'step' | 'title' | 'text' | 'bubble' | 'buttons' | 'action' | 'notes' | 'design' | 'settings';
export type EditTable = 'steps' | 'hotspots';

export interface PresencePayload {
  /** Utilisateur. */
  u: string;
  /** Étape affichée. */
  s: string | null;
  /** Ce que la personne modifie. */
  a: Activity | null;
  /** Dernière action (ms epoch) : inactif au-delà de 2 minutes. */
  t: number;
  /** Curseur sur le canevas, en fractions (0 à 1), ou null hors du canevas. */
  c: [number, number] | null;
  /** Dernière modification enregistrée : ligne et champ, jamais la valeur. */
  e: { tb: EditTable; id: string; f: string; at: number } | null;
}

export const IDLE_MS = 2 * 60_000;
export const topic = (demoId: string) => `demo:${demoId}`;

/** Une entrée par personne (la plus récente), sans soi-même. */
export function othersFrom(state: Record<string, PresencePayload[]>, me: string): PresencePayload[] {
  const best = new Map<string, PresencePayload>();
  for (const list of Object.values(state))
    for (const p of list) {
      if (!p?.u || p.u === me) continue;
      const cur = best.get(p.u);
      if (!cur || p.t > cur.t) best.set(p.u, p);
    }
  return [...best.values()].sort((a, b) => a.u.localeCompare(b.u));
}

export const isIdle = (p: Pick<PresencePayload, 't'>, now = Date.now()) => now - p.t > IDLE_MS;
export const idleMinutes = (p: Pick<PresencePayload, 't'>, now = Date.now()) =>
  Math.max(1, Math.floor((now - p.t) / 60_000));

/** Champ du panneau qui a le focus → activité affichée aux autres. */
export function activityOf(id: string | null | undefined): Activity | null {
  if (!id) return null;
  if (id === 'hs-title' || id === 'hs-body') return 'bubble';
  if (id === 'hs-prev' || id === 'hs-next' || id === 'hs-showprev') return 'buttons';
  if (id === 'hs-action' || id === 'hs-goto' || id === 'hs-url' || id === 'hs-adv') return 'action';
  if (id === 'st-title') return 'title';
  if (id === 'st-body') return 'text';
  if (id === 'st-notes') return 'notes';
  if (id.startsWith('st-') || id.startsWith('hs-') || id.startsWith('zoom-')) return 'step';
  return null;
}

/** Champ modifié → activité (pour dire « modifie le texte de la bulle » sur un même champ). */
export function activityOfField(tb: EditTable, f: string): Activity {
  if (tb === 'hotspots') {
    if (f === 'title' || f === 'body') return 'bubble';
    if (f === 'action') return 'action';
    return 'step';
  }
  if (f === 'title') return 'title';
  if (f === 'body') return 'text';
  if (f === 'presenter_notes') return 'notes';
  if (f === 'options') return 'buttons';
  return 'step';
}

/** Jusqu'à 3 avatars, puis « +n ». */
export function stack<T>(list: T[], max = 3): { shown: T[]; more: number } {
  return { shown: list.slice(0, max), more: Math.max(0, list.length - max) };
}
