// L30 065/066 : logique pure de la voix de synthèse et des sous-titres automatiques (ElevenLabs).
// Aucun accès réseau ici (testé par audio_test.ts).
import { AiError, redact } from './lib.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Voix proposées (spec L30b §3 : 6 au plus) : voix préenregistrées du fournisseur, lues en français par
 * le modèle multilingue. Identifiants à confirmer dans la bibliothèque du compte avant la mise en ligne.
 */
export const VOICES: Record<string, string> = {
  claire: '21m00Tcm4TlvDq8ikWAM',
  louise: 'XB0fDUnXU5powFXDhCwa',
  sarah: 'EXAVITQu4vr4xnSDxMaL',
  antoine: 'ErXwobaYiN019PkySvjV',
  adam: 'pNInz6obpgDQGcFmaJgB',
  daniel: 'onwK4e9ZLuTAKqWW03F9',
};
/** Genre attendu de chaque voix proposée (f : féminine, m : masculine). */
export const VOICE_GENDER: Record<string, 'f' | 'm'> = {
  claire: 'f',
  louise: 'f',
  sarah: 'f',
  antoine: 'm',
  adam: 'm',
  daniel: 'm',
};

/** Voix du compte du fournisseur (GET /voices), réduite à ce qui sert au choix. */
export interface AccountVoice {
  voice_id?: unknown;
  name?: unknown;
  category?: unknown;
  /** Ancienne voix du fournisseur : encore listée, mais plus garantie selon l'offre. */
  is_legacy?: unknown;
  labels?: {
    gender?: unknown;
    language?: unknown;
    accent?: unknown;
    description?: unknown;
    use_case?: unknown;
  } | null;
  verified_languages?: Array<{ language?: unknown }> | null;
}

/** L62 §8 : une voix du compte telle que le sélecteur la montre (aucun nom de fournisseur). */
export interface VoiceInfo {
  id: string;
  /** Nom réel de la voix. */
  name: string;
  /** f : féminine, m : masculine, n : neutre ou non dit. */
  gender: 'f' | 'm' | 'n';
  accent: string;
  style: string;
  /** Langues parlées (codes à deux lettres), langue native en tête. */
  langs: string[];
  /** Langue native = langue de la démo. */
  recommended: boolean;
  /** Voix propre au compte (clonée, générée, de bibliothèque), après les voix prédéfinies. */
  own: boolean;
}

const VOICE_ID = /^[A-Za-z0-9]{8,40}$/;
const label = (v: unknown, max = 40) =>
  typeof v === 'string' ? v.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
const code = (v: unknown) => {
  const m = /^([a-z]{2})\b/i.exec(String(v ?? '').trim());
  return m ? m[1]!.toLowerCase() : '';
};

/**
 * L62 §8 (retour client du 26/11) : TOUTES les voix utilisables du compte, plus les 6 emplacements fixes
 * (qui en dédoublonnaient la moitié). Anciennes voix écartées. Ordre : recommandées pour la langue de la
 * démo d'abord, puis les voix prédéfinies avant celles du compte, puis par nom.
 */
export function accountVoices(account: AccountVoice[], lang = 'fr'): VoiceInfo[] {
  const seen = new Set<string>();
  const out: VoiceInfo[] = [];
  for (const v of account) {
    if (typeof v.voice_id !== 'string' || !VOICE_ID.test(v.voice_id) || v.is_legacy === true) continue;
    if (seen.has(v.voice_id)) continue;
    seen.add(v.voice_id);
    const g = String(v.labels?.gender ?? '').toLowerCase();
    const native = code(v.labels?.language);
    const langs = [
      ...new Set([native, ...(v.verified_languages ?? []).map((l) => code(l?.language))].filter(Boolean)),
    ];
    out.push({
      id: v.voice_id,
      name: label(v.name, 60) || v.voice_id,
      gender: g.startsWith('f') ? 'f' : g.startsWith('m') ? 'm' : 'n',
      accent: label(v.labels?.accent),
      style: label(v.labels?.description) || label(v.labels?.use_case),
      langs,
      recommended: native === lang,
      own: String(v.category ?? '') !== 'premade',
    });
  }
  return out.sort(
    (a, b) =>
      Number(b.recommended) - Number(a.recommended) ||
      Number(a.own) - Number(b.own) ||
      a.name.localeCompare(b.name, 'fr'),
  );
}

/**
 * Voix demandée → identifiant d'une voix utilisable du compte. Un ancien emplacement (« claire »…)
 * garde sa voix par la correspondance de compatibilité (resolveVoices) ; un identifiant doit être une
 * voix du compte (ou, liste illisible, avoir la forme d'un identifiant). null sinon.
 */
export function voiceIdFor(
  voice: string,
  list: VoiceInfo[] | null,
  aliases: Record<string, string>,
): string | null {
  if (aliases[voice]) return aliases[voice]!;
  // Liste du compte illisible (droit manquant, panne) : repli silencieux, un identifiant de forme valide
  // est tenté plutôt que de bloquer la génération
  if (!list) return VOICE_ID.test(voice) ? voice : null;
  return list.some((v) => v.id === voice) ? voice : null;
}

/** L62 §8 : phrase d'exemple fixe par langue (≈ 60 caractères), lue une fois par voix et par langue. */
export const SAMPLE_TEXT: Record<string, string> = {
  fr: 'Bonjour, je vais vous guider pas à pas dans cette démonstration.',
  en: 'Hello, I will guide you step by step through this demonstration.',
  es: 'Hola, voy a guiarle paso a paso en esta demostración.',
  de: 'Hallo, ich führe Sie Schritt für Schritt durch diese Vorführung.',
  it: 'Buongiorno, la guiderò passo dopo passo in questa dimostrazione.',
  pt: 'Olá, vou guiá-lo passo a passo nesta demonstração.',
  nl: 'Hallo, ik begeleid u stap voor stap door deze demonstratie.',
};
export const sampleLang = (lang: unknown) => {
  const l = code(lang);
  return SAMPLE_TEXT[l] ? l : 'en';
};
/** Exemple en cache (bucket voices, hors des dossiers des espaces) : une seule génération par voix et langue. */
export const samplePath = (voiceId: string, lang: string) => `_samples/${voiceId}/${lang}.mp3`;

/**
 * L62 : les voix proposées sont celles du COMPTE, pas des identifiants en dur (une ancienne voix ou
 * une voix de bibliothèque est refusée par le fournisseur selon l'offre). Chaque voix proposée garde
 * son identifiant prévu s'il existe sur le compte (hors anciennes voix) ; sinon elle prend une voix du compte du même genre :
 * d'abord les voix prédéfinies (toujours utilisables), puis les voix propres au compte, puis le reste,
 * et à rang égal celles qui parlent la langue demandée. Une voix sans équivalent n'est pas proposée.
 */
export function resolveVoices(account: AccountVoice[], lang = 'fr'): Record<string, string> {
  const list = account
    .filter((v): v is AccountVoice & { voice_id: string } => typeof v.voice_id === 'string' && !!v.voice_id)
    .map((v, i) => {
      const gender = String(v.labels?.gender ?? '').toLowerCase();
      const langs = [
        String(v.labels?.language ?? ''),
        ...(v.verified_languages ?? []).map((l) => String(l?.language ?? '')),
      ];
      const category = String(v.category ?? '');
      return {
        id: v.voice_id,
        g: gender.startsWith('f') ? 'f' : gender.startsWith('m') ? 'm' : '',
        legacy: v.is_legacy === true,
        rank:
          (v.is_legacy === true ? 100 : 0) +
          (category === 'premade' ? 0 : category === 'cloned' || category === 'generated' ? 1 : 2) * 2 +
          (langs.some((l) => l.toLowerCase().startsWith(lang)) ? 0 : 1),
        i,
      };
    });
  // Une voix prévue n'est gardée que si le compte l'a encore et qu'elle n'est pas une ancienne voix
  const ids = new Set(list.filter((v) => !v.legacy).map((v) => v.id));
  const out: Record<string, string> = {};
  const used = new Set<string>();
  for (const [slot, id] of Object.entries(VOICES))
    if (ids.has(id)) {
      out[slot] = id;
      used.add(id);
    }
  const pool = [...list].sort((a, b) => a.rank - b.rank || a.i - b.i);
  for (const slot of Object.keys(VOICES)) {
    if (out[slot]) continue;
    const pick = pool.find((v) => !used.has(v.id) && v.g === VOICE_GENDER[slot]);
    if (pick) {
      out[slot] = pick.id;
      used.add(pick.id);
    }
  }
  return out;
}

/** Vitesse de lecture (voice_settings.speed). */
export const SPEEDS: Record<string, number> = { slow: 0.85, normal: 1, fast: 1.15 };
export const TTS_MODEL = 'eleven_multilingual_v2';
export const STT_MODEL = 'scribe_v1';
/** Sortie MP3 à 128 kbit/s : durée = octets × 8 / 128 000. */
export const TTS_FORMAT = 'mp3_44100_128';
export const TTS_MAX_CHARS = 1000;
/** Limites de la voix off (bucket voices) : 2 minutes, 5 Mo. */
export const VOICE_MAX_MS = 120_000;
export const VOICE_MAX_BYTES = 5 * 1024 * 1024;
/** Sous-titres automatiques : 2 minutes d'audio au plus par demande (spec L30b §4). */
export const STT_MAX_S = 120;

export interface VoiceRequest {
  stepId: string;
  text: string;
  voice: string;
  speed: number;
  /** Secondes d'audio réservées avant l'appel (estimation ~14 caractères par seconde). */
  estimate: number;
}
export interface CaptionsRequest {
  stepId: string;
  /** video : piste de l'étape vidéo ; voice : voix off enregistrée de l'étape. */
  source: 'video' | 'voice';
}

export function parseVoice(input: Record<string, unknown>): VoiceRequest {
  const stepId = String(input.stepId ?? '');
  if (!UUID.test(stepId)) throw new AiError('BAD_STEP');
  const text = typeof input.text === 'string' ? input.text.trim() : '';
  if (!text) throw new AiError('MISSING_TEXT');
  if (text.length > TTS_MAX_CHARS) throw new AiError('TOO_LONG_TEXT');
  // La transcription est lue à voix haute : une donnée personnelle détectée bloque l'envoi
  if (redact(text).count > 0) throw new AiError('PII_IN_TEXT', 422);
  // Ancien emplacement (compatibilité) ou identifiant d'une voix du compte, vérifié ensuite sur la liste
  const voice =
    typeof input.voice === 'string' && (VOICES[input.voice] || VOICE_ID.test(input.voice))
      ? input.voice
      : 'claire';
  const speed = SPEEDS[String(input.speed)] ?? 1;
  return { stepId, text, voice, speed, estimate: estimateSeconds(text, speed) };
}

export function parseCaptions(input: Record<string, unknown>): CaptionsRequest {
  const stepId = String(input.stepId ?? '');
  if (!UUID.test(stepId)) throw new AiError('BAD_STEP');
  return { stepId, source: input.source === 'voice' ? 'voice' : 'video' };
}

/** Durée estimée (même calcul que l'interface) : environ 14 caractères par seconde à vitesse normale. */
export function estimateSeconds(text: string, speed = 1): number {
  return Math.min(VOICE_MAX_MS / 1000, Math.max(1, Math.ceil(text.trim().length / 14 / speed)));
}

export const mp3DurationMs = (bytes: number) => Math.round((bytes * 8) / 128);

/**
 * Refus du fournisseur audio, nommé sans secret (L62) : le statut HTTP et le code d'erreur court du
 * fournisseur (`detail.status`, ex. quota_exceeded). Jamais son message, qui peut reprendre le texte
 * envoyé. `error` est le code rendu à l'app, `http` le statut de notre réponse.
 *  - PROVIDER_KEY : clé refusée, droits manquants, compte bloqué par le fournisseur ;
 *  - PROVIDER_QUOTA : crédits du compte du fournisseur épuisés (ce n'est pas le quota de l'espace) ;
 *  - PROVIDER_PLAN : l'offre du compte ne permet pas cette demande (voix réservée à une offre payante) ;
 *  - PROVIDER_VOICE : voix ou modèle introuvable sur le compte ;
 *  - PROVIDER : indisponibilité passagère (réseau, 429, 5xx) ou cause inconnue.
 */
export interface ProviderRefusal {
  error: 'PROVIDER_KEY' | 'PROVIDER_QUOTA' | 'PROVIDER_PLAN' | 'PROVIDER_VOICE' | 'PROVIDER';
  /**
   * 424 pour un refus nommé : une réponse 502 ou 503 peut être remplacée en chemin par la passerelle,
   * et l'app ne recevrait plus le code (constaté en production : message générique).
   */
  http: 424 | 502 | 503;
  /** Pour le journal : « 401 quota_exceeded », « network »… */
  log: string;
}
export function providerRefusal(status: number | null, body: unknown): ProviderRefusal {
  if (status === null) return { error: 'PROVIDER', http: 502, log: 'network' };
  const detail = (body as { detail?: unknown } | null)?.detail;
  const raw = (detail as { status?: unknown } | null)?.status;
  const short = (x: unknown) => (typeof x === 'string' && /^[a-z0-9_]{1,48}$/.test(x) ? x : '');
  const code = short(raw);
  // Sans code : le nom de la première clé de `detail` aide au diagnostic (jamais une valeur)
  const firstKey =
    !code && detail && typeof detail === 'object' && !Array.isArray(detail)
      ? short(Object.keys(detail)[0])
      : '';
  const log = code ? `${status} ${code}` : firstKey ? `${status} (${firstKey})` : String(status);
  // Le fournisseur répond 401 aussi pour un quota épuisé : le code passe avant le statut
  if (/quota|credit|limit_reached/.test(code)) return { error: 'PROVIDER_QUOTA', http: 424, log };
  // Offre du compte insuffisante (voix de bibliothèque avec l'offre gratuite, etc.) : 402
  if (/paid_plan|plan_required|payment|subscription|free_users|upgrade/.test(code) || status === 402)
    return { error: 'PROVIDER_PLAN', http: 424, log };
  if (/voice|model/.test(code) || status === 404) return { error: 'PROVIDER_VOICE', http: 424, log };
  if (status === 401 || status === 403 || /api_key|permission|unusual_activity|unauthorized/.test(code))
    return { error: 'PROVIDER_KEY', http: 424, log };
  return { error: 'PROVIDER', http: status === 429 || status >= 500 ? 503 : 502, log };
}

export interface Word {
  text: string;
  start: number;
  end: number;
  type?: string;
}
export interface Cue {
  from: number;
  to: number;
  text: string;
}

/**
 * Mots horodatés (secondes) → sous-titres (ms) : 7 s et 84 caractères au plus par sous-titre,
 * coupure après une fin de phrase. Les événements sonores (« (rires) ») sont ignorés.
 */
export function cuesFromWords(words: Word[], max = 300): Cue[] {
  const out: Cue[] = [];
  let cur: { from: number; to: number; parts: string[] } | null = null;
  const flush = () => {
    if (!cur) return;
    const text = cur.parts.join('').replace(/\s+/g, ' ').trim();
    if (text)
      out.push({
        from: Math.round(cur.from * 1000),
        to: Math.round(cur.to * 1000),
        text: text.slice(0, 200),
      });
    cur = null;
  };
  for (const w of words) {
    if (w.type === 'audio_event') continue;
    if (w.type === 'spacing') {
      if (cur) cur.parts.push(' ');
      continue;
    }
    if (!Number.isFinite(w.start) || !Number.isFinite(w.end)) continue;
    if (cur && (w.end - cur.from > 7 || cur.parts.join('').length + w.text.length > 84)) flush();
    if (!cur) cur = { from: w.start, to: w.end, parts: [] };
    cur.parts.push(w.text);
    cur.to = Math.max(cur.to, w.end);
    if (/[.!?…]$/.test(w.text)) flush();
  }
  flush();
  return out.filter((c) => c.to > c.from).slice(0, max);
}
