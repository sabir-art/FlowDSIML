import { randomId } from './logic';

/**
 * L26-06 à 08 : identifiant de visiteur pour reconnaître les visiteurs qui reviennent.
 *  - aléatoire, propre à l'espace (clé fd.vid.<espace>), sans donnée personnelle ;
 *  - gardé 13 mois au plus dans le localStorage, puis renouvelé ;
 *  - refus (« Ne pas mesurer mes visites ») ou signal Global Privacy Control : identifiant supprimé,
 *    drapeau de refus gardé, et un identifiant propre à la session est utilisé ;
 *  - mesure désactivée par l'espace : aucun identifiant n'est créé (identifiant de session).
 */
export const VISITOR_MAX_AGE_MS = 395 * 86_400_000; // 13 mois
const OPT_OUT = 'fd.nomeasure';
const PREFIX = 'fd.vid.';

function local(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Identifiant de la session (onglet), aussi utilisé quand la mesure est refusée ou désactivée. */
export function sessionVisitorId(): string {
  try {
    const s = globalThis.sessionStorage;
    const v = s?.getItem('fd.svid');
    if (v) return v;
    const id = randomId();
    s?.setItem('fd.svid', id);
    return id;
  } catch {
    return randomId();
  }
}

/** Signal Global Privacy Control du navigateur. */
export function gpcEnabled(): boolean {
  return (
    (globalThis.navigator as Navigator & { globalPrivacyControl?: boolean })?.globalPrivacyControl === true
  );
}

/** Refus enregistré dans ce navigateur, ou signal GPC. */
export function measureRefused(): boolean {
  if (gpcEnabled()) return true;
  try {
    return local()?.getItem(OPT_OUT) === '1';
  } catch {
    return false;
  }
}

/** Supprime tous les identifiants de visiteur gardés par le lecteur. */
function forgetIds(store: Storage) {
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k && (k.startsWith(PREFIX) || k === 'fd.vid')) keys.push(k);
  }
  keys.forEach((k) => store.removeItem(k));
}

/** « Ne pas mesurer mes visites » (true) ou « Mesurer à nouveau » (false). */
export function setMeasureRefused(refused: boolean) {
  const s = local();
  if (!s) return;
  try {
    if (refused) {
      forgetIds(s);
      s.setItem(OPT_OUT, '1');
    } else s.removeItem(OPT_OUT);
  } catch {
    /* stockage indisponible : rien à garder */
  }
}

/**
 * Identifiant à envoyer pour l'espace. `scope` : id de l'espace (ou « c.<slug> » pour un centre de
 * formation, qui appartient à un seul espace). Sans mesure possible : identifiant de session.
 */
export function visitorIdFor(scope: string, measure = true, now = Date.now()): string {
  if (!measure || !scope || measureRefused()) return sessionVisitorId();
  const s = local();
  if (!s) return sessionVisitorId();
  const key = PREFIX + scope;
  try {
    const raw = s.getItem(key);
    if (raw) {
      const v = JSON.parse(raw) as { id?: unknown; at?: unknown };
      if (
        typeof v.id === 'string' &&
        typeof v.at === 'number' &&
        now - v.at < VISITOR_MAX_AGE_MS &&
        v.at <= now
      )
        return v.id;
    }
    const id = randomId();
    s.setItem(key, JSON.stringify({ id, at: now }));
    return id;
  } catch {
    return sessionVisitorId();
  }
}
