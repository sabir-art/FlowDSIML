import { parseManifest, type EventType, type Manifest } from '@flowdsiml/manifest';
import {
  ACCESS_URL,
  CENTER_URL,
  OPEN_URL,
  publishedBase,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  TRACK_URL,
} from './config';
import { resolveAssets, randomId } from './logic';
import { visitorIdFor } from './visitor';

const rpcHeaders = () => ({
  'content-type': 'application/json',
  apikey: SUPABASE_ANON_KEY,
  authorization: `Bearer ${SUPABASE_ANON_KEY}`,
});

/** L36 : réseau coupé, trop lent (délai dépassé) ou serveur indisponible (5xx) : on peut réessayer. */
export class NetworkError extends Error {}

/** L36 : délai maximal d'une requête du lecteur, au-delà l'écran « Connexion impossible » propose de réessayer. */
const TIMEOUT_MS = 20_000;

async function send(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(() => null);
  if (!res || res.status >= 500) throw new NetworkError(url);
  return res;
}

async function rpc<T>(fn: string, args: Record<string, unknown>, keepalive = false): Promise<T> {
  const res = await send(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: rpcHeaders(),
    body: JSON.stringify(args),
    keepalive,
  });
  if (!res.ok) throw new Error(`${fn}: ${res.status}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Réponse de l'Edge Function open-demo (L11). */
export type GateInfo = {
  status:
    | 'ok'
    | 'not_found'
    | 'unavailable'
    | 'expired'
    | 'password_required'
    | 'password_wrong'
    | 'locked'
    | 'email_required'
    | 'email_not_allowed'
    | 'link_expired'
    | 'network'
    | 'error';
  /** L39 : accès par e-mail (« Sur invitation » ou « Par domaine e-mail ») et domaines autorisés. */
  mode?: 'invite' | 'domain';
  domains?: string[];
  grantDays?: number;
  title?: string;
  workspace?: string;
  website?: string | null;
  expiredAt?: string;
  remaining?: number;
  retryIn?: number;
  grant?: string;
  manifest?: Manifest;
  /** L26-08 : mesure des visites de l'espace (false : aucun identifiant créé). */
  visitMeasure?: boolean;
};

const grantKey = (demoId: string) => `fd.grant.${demoId}`;

/** Accès remis par open-demo : session (mot de passe), ou 7 jours sur cet appareil (accès par e-mail). */
function readGrant(demoId: string): string | null {
  try {
    return sessionStorage.getItem(grantKey(demoId)) ?? localStorage.getItem(grantKey(demoId));
  } catch {
    return null;
  }
}
function keepGrant(demoId: string, grant: string, days?: number) {
  try {
    if (days) localStorage.setItem(grantKey(demoId), grant);
    else sessionStorage.setItem(grantKey(demoId), grant);
  } catch {
    /* stockage indisponible */
  }
}

/**
 * Ouvre une démo publiée via open-demo : le serveur applique l'accès (expiration, mot de passe, adresse
 * vérifiée) et renvoie le manifeste avec des URL d'images signées. L39 : `accessToken` (retour d'un lien
 * d'accès) n'est envoyé qu'une fois et n'est jamais conservé ; seul l'accès rendu (grant) est gardé.
 */
export async function openDemo(demoId: string, password?: string, accessToken?: string): Promise<GateInfo> {
  const grant = readGrant(demoId);
  const res = await send(OPEN_URL, {
    method: 'POST',
    headers: rpcHeaders(),
    body: JSON.stringify({
      demoId,
      password: password || undefined,
      grant: grant || undefined,
      accessToken: accessToken || undefined,
    }),
  }).catch(() => null);
  if (!res) return { status: 'network' };
  if (!res.ok && res.status !== 429) return { status: 'error' };
  const body = (await res.json().catch(() => null)) as (GateInfo & { manifest?: unknown }) | null;
  if (!body) return { status: 'error' };
  if (res.status === 429) return { status: 'locked', retryIn: 60 };
  if (body.status === 'ok') {
    if (body.grant) keepGrant(demoId, body.grant, body.grantDays);
    try {
      return { ...body, manifest: resolveAssets(parseManifest(body.manifest), publishedBase(demoId)) };
    } catch {
      return { status: 'not_found' };
    }
  }
  return body as GateInfo;
}

/**
 * L39 : demande d'un lien d'accès (invitation, domaine). Réponse identique que l'adresse soit autorisée
 * ou non (« sent »), sauf pour un domaine refusé, que le visiteur connaît déjà.
 */
export async function requestAccess(
  demoId: string,
  email: string,
): Promise<'sent' | 'domain_refused' | 'error'> {
  const res = await send(ACCESS_URL, {
    method: 'POST',
    headers: rpcHeaders(),
    body: JSON.stringify({ action: 'request', demoId, email }),
  }).catch(() => null);
  if (!res?.ok) return 'error';
  const body = (await res.json().catch(() => null)) as { status?: string } | null;
  return body?.status === 'domain_refused' ? 'domain_refused' : body?.status === 'sent' ? 'sent' : 'error';
}

/**
 * L39 : retour d'un lien d'accès (?acces=<démo>, jeton ou erreur dans le fragment). Lit le jeton, réécrit
 * aussitôt l'adresse (#/d/<démo>, sans jeton) et le rend une seule fois ; null si l'adresse n'en vient pas.
 */
export function takeAccessReturn(
  loc: Location,
  history: History,
): { demoId: string; token: string | null } | null {
  const id = new URLSearchParams(loc.search).get('acces');
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const frag = new URLSearchParams(loc.hash.replace(/^#/, ''));
  const token = frag.get('access_token');
  history.replaceState(null, '', `${loc.pathname}#/d/${id}`);
  return { demoId: id, token: token && token.length <= 4096 ? token : null };
}

/** L28 082 : adresse personnalisée → identifiant de la démo publiée (null si inconnue ou expirée). */
export function resolveAddress(address: string) {
  return rpc<string | null>('resolve_demo_address', { p_address: address });
}

export function resolveLink(token: string) {
  return rpc<{
    demoId: string;
    linkId: string;
    variables: Record<string, string>;
    /** L25-13 : ligne du jeu de données choisie pour ce lien. */
    datasetRow?: number | null;
  } | null>('resolve_share_link', { p_token: token });
}

/** L13 : reprise « Bon retour » (lien personnalisé valide sur une démo publiée) ; {} sinon. */
export interface ResumeInfo {
  firstName?: string;
  module?: { demoId: string; seen: number; total: number; status: string } | null;
  path?: {
    title: string;
    ordered: boolean;
    modules: Array<{
      title: string;
      status: string | null;
      seen: number | null;
      total: number | null;
      current: boolean;
    }>;
  } | null;
}

export function learnerResume(token: string, demoId: string) {
  return rpc<ResumeInfo>('learner_resume', { p_link_token: token, p_demo: demoId });
}

export function submitLead(args: {
  demoId: string;
  versionId: string;
  email: string;
  fields: Record<string, string>;
  consent: boolean;
  visitorId: string;
  linkToken: string | null;
}) {
  return rpc<string>('submit_lead', {
    p_demo: args.demoId,
    p_version: args.versionId,
    p_email: args.email,
    p_fields: args.fields,
    p_consent: args.consent,
    p_visitor: args.visitorId,
    p_link_token: args.linkToken,
  });
}

function storageGet(store: Storage | undefined, key: string): string {
  try {
    const v = store?.getItem(key);
    if (v) return v;
    const id = randomId();
    store?.setItem(key, id);
    return id;
  } catch {
    return randomId();
  }
}

/** L16 : ce que le lecteur attend d'un traceur (en ligne : Tracker ; paquet SCORM : traceur hors ligne). */
export interface TrackerLike {
  readonly visitorId: string;
  readonly sessionId: string;
  readonly linkToken: string | null;
  track(type: EventType, data?: Parameters<Tracker['track']>[1]): void;
  /** L18 : propriétés ajoutées à chaque événement (variante A/B). */
  setBaseProps?(props: Record<string, string>): void;
}

/**
 * L19 : description grossière de l'appareil, envoyée avec chaque lot. Familles en liste fermée, sans
 * version ni empreinte (pas de résolution exacte, pas de polices, pas de canvas) ; l'IP n'est jamais
 * conservée.
 */
export function deviceInfo(
  ua: string = navigator.userAgent,
  width: number = Math.min(screen.width || innerWidth, innerWidth || screen.width),
  language: string = navigator.language || '',
): { type: 'mobile' | 'tablet' | 'desktop'; browser: string; os: string; lang: string | null } {
  const tablet = /iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
  const mobile = !tablet && (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua) || width < 640);
  const browser = /Edg\//.test(ua)
    ? 'edge'
    : /OPR\/|Opera/.test(ua)
      ? 'opera'
      : /Firefox\//.test(ua)
        ? 'firefox'
        : /SamsungBrowser\//.test(ua)
          ? 'samsung'
          : /Chrome\/|CriOS\//.test(ua)
            ? 'chrome'
            : /Safari\//.test(ua)
              ? 'safari'
              : 'other';
  const os = /Windows/.test(ua)
    ? 'windows'
    : /iPhone|iPad|iPod/.test(ua)
      ? 'ios'
      : /Mac OS X|Macintosh/.test(ua)
        ? 'macos'
        : /Android/.test(ua)
          ? 'android'
          : /CrOS/.test(ua)
            ? 'chromeos'
            : /Linux/.test(ua)
              ? 'linux'
              : 'other';
  const lang = /^[a-z]{2}/i.exec(language)?.[0]?.toLowerCase() ?? null;
  return { type: tablet ? 'tablet' : mobile ? 'mobile' : 'desktop', browser, os, lang };
}

/** File d'événements : envoi groupé toutes les 2 s et à la fermeture de la page. */
export class Tracker {
  private queue: Array<{
    type: EventType;
    stepId?: string | null;
    hotspotId?: string | null;
    stepIndex?: number;
    props?: Record<string, string | number | boolean>;
    at: string;
  }> = [];
  private timer: number | undefined;
  private baseProps: Record<string, string> = {};
  /** L19b : canal de diffusion (page publique) ; la base n'accepte que 'page'. */
  channel: 'page' | null = null;
  /** L26 : identifiant propre à l'espace, 13 mois au plus ; de session si la mesure est refusée. */
  readonly visitorId: string;
  readonly sessionId = storageGet(globalThis.sessionStorage, 'fd.sid');

  constructor(
    private readonly demoId: string,
    private readonly versionId: string,
    readonly linkToken: string | null,
    private readonly enabled: boolean,
    visit: { workspaceId: string; measure: boolean } = { workspaceId: '', measure: true },
  ) {
    this.visitorId = visitorIdFor(visit.workspaceId, visit.measure);
    addEventListener('pagehide', () => this.flush(true));
    addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && this.flush(true));
  }

  track(
    type: EventType,
    data: {
      stepId?: string | null;
      hotspotId?: string | null;
      stepIndex?: number;
      props?: Record<string, string | number | boolean>;
    } = {},
  ) {
    // Relais vers la page hôte (GA4, Segment…) : le site client peut écouter ces messages.
    if (parent !== window)
      parent.postMessage({ type: 'flowdsiml:event', event: type, demoId: this.demoId, ...data }, '*');
    if (!this.enabled) return;
    const props = { ...this.baseProps, ...data.props };
    this.queue.push({
      type,
      ...data,
      ...(Object.keys(props).length ? { props } : {}),
      at: new Date().toISOString(),
    });
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.flush(false), 2000);
  }

  /** L18 : variante A/B portée par chaque événement (props.abt, props.abv). */
  setBaseProps(props: Record<string, string>) {
    this.baseProps = props;
  }

  flush(unloading: boolean) {
    if (!this.queue.length) return;
    const events = this.queue.splice(0, 50);
    const batch = {
      demoId: this.demoId,
      versionId: this.versionId,
      linkToken: this.linkToken,
      visitorId: this.visitorId,
      sessionId: this.sessionId,
      referrer: document.referrer || null,
      embedOrigin: parent !== window ? (location.ancestorOrigins?.[0] ?? null) : null,
      device: deviceInfo(),
      ...(this.channel ? { channel: this.channel } : {}),
      events,
    };
    const body = JSON.stringify(batch);
    // 1) Edge Function (text/plain : pas de pré-requête CORS, compatible sendBeacon)
    if (TRACK_URL) {
      const sent = unloading && navigator.sendBeacon?.(TRACK_URL, new Blob([body], { type: 'text/plain' }));
      if (sent) return;
      void fetch(TRACK_URL, {
        method: 'POST',
        body,
        keepalive: true,
        headers: { 'content-type': 'text/plain' },
      })
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
        })
        .catch(() => rpc('track_events', { p_batch: batch }, true).catch(() => undefined));
      return;
    }
    // 2) Repli : RPC directe
    void rpc('track_events', { p_batch: batch }, true).catch(() => undefined);
  }
}

export interface QuizResult {
  score: number;
  correct: number;
  total: number;
  passed: boolean;
  attemptsLeft: number | null;
  questions: Array<{ questionId: string; correct: boolean }>;
}

/** F2 : enregistre une tentative ; le score fait foi côté serveur (recalculé à partir du manifeste). */
export function submitQuizAttempt(batch: {
  demoId: string;
  versionId: string;
  visitorId: string;
  sessionId: string;
  linkToken: string | null;
  /** L19 : note de 0 à 10 (value) ou réponse écrite (text, 500 caractères) pour un sondage. */
  answers: Array<{ questionId: string; answerIds?: string[]; value?: number; text?: string }>;
}) {
  return rpc<QuizResult>('submit_quiz_attempt', { p_batch: batch });
}

// ---------------------------------------------------------------------------
// L14 : centre de formation
// ---------------------------------------------------------------------------
const centerGrantKey = (slug: string) => `fd.cgrant.${slug}`;
const centerLinkKey = (slug: string) => `fd.clink.${slug}`;

function sessionGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function sessionSet(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* stockage indisponible */
  }
}

/** Jeton du lien personnel : pris dans l'adresse (?l=) puis gardé pour la session. */
export function centerLinkToken(slug: string, fromUrl: string | null): string | null {
  if (fromUrl && /^[A-Za-z0-9_-]{8,128}$/.test(fromUrl)) {
    sessionSet(centerLinkKey(slug), fromUrl);
    return fromUrl;
  }
  return sessionGet(centerLinkKey(slug));
}

export type CenterGateInfo = Omit<GateInfo, 'manifest'> & Partial<import('./center').CenterData>;

/** Ouvre le centre via open-center (accès décidé côté serveur, couvertures signées). */
export async function openCenter(
  slug: string,
  linkToken: string | null,
  password?: string,
): Promise<CenterGateInfo> {
  const res = await fetch(CENTER_URL, {
    method: 'POST',
    headers: rpcHeaders(),
    body: JSON.stringify({
      slug,
      password: password || undefined,
      grant: sessionGet(centerGrantKey(slug)) || undefined,
      linkToken: linkToken || undefined,
      // L26 : centre d'un seul espace ; identifiant propre au centre (de session si refus)
      visitorId: visitorIdFor(`c.${slug}`),
    }),
  }).catch(() => null);
  if (!res || (!res.ok && res.status !== 429)) return { status: 'error' };
  if (res.status === 429) return { status: 'locked', retryIn: 60 };
  const body = (await res.json().catch(() => null)) as CenterGateInfo | null;
  if (!body) return { status: 'error' };
  if (body.status === 'ok' && body.grant) sessionSet(centerGrantKey(slug), body.grant);
  return body;
}

/** L15-07 : attestation de suivi, délivrée par le serveur si la formation est validée ('{}' sinon). */
export interface CertificateInfo {
  certificateId?: string;
  issuedAt?: string;
  learner?: string;
  path?: string;
  workspace?: string;
  validatedAt?: string | null;
  modules?: Array<{ title: string; best: number | null }>;
  error?: 'name_missing';
}
export function issueCertificate(token: string, pathId: string) {
  return rpc<CertificateInfo>('issue_certificate', { p_link_token: token, p_path: pathId });
}

// ---------------------------------------------------------------------------
// L19b : page publique d'une démo
// ---------------------------------------------------------------------------
export interface PublicPageInfo {
  demoId: string;
  title: string;
  description: string;
  cta: { label: string; url: string } | null;
  endTitle: string;
  endBody: string;
  style: 'demo' | 'light' | 'dark';
  indexable: boolean;
  steps: number;
  updatedAt: string;
  workspace: string;
  /** F7 : logo du workspace (bucket public branding), absent sinon. */
  logoPath?: string | null;
  privacyUrl: string | null;
  a11y: 'non_evalue' | 'partiel' | 'total';
  a11yUrl: string | null;
  related: Array<{ demoId: string; title: string; description: string }>;
}

/** URL publique d'un logo du bucket branding (chemin validé côté base). */
export function brandingUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/branding/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** L25-14 / 15 : page personnalisée d'un lien. Jamais d'e-mail ni d'id du signataire. */
export type PersonalPageInfo =
  | { status: 'not_found' }
  | { status: 'inactive'; publicPage: boolean; demoId: string }
  | {
      status: 'ok';
      page: PublicPageInfo;
      personal: {
        title: string;
        message: string;
        signer: { name: string; initials: string } | null;
        cta: { label: string; url: string } | null;
        variables: Record<string, string>;
        datasetRow: number | null;
        /** Absent si la démo est protégée : le lecteur passe par l'écran habituel. */
        token: string | null;
      };
    };
export function personalPage(demoId: string, code: string) {
  return rpc<PersonalPageInfo>('personal_page', { p_demo: demoId, p_code: code });
}

/** Page publique (null : indisponible, quelle qu'en soit la raison). */
export function publicPage(demoId: string) {
  return rpc<PublicPageInfo | null>('public_page', { p_demo: demoId });
}
