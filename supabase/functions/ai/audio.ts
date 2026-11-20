// L30 065/066 : logique pure de la voix de synthèse et des sous-titres automatiques (ElevenLabs).
// Aucun accès réseau ici (testé par audio_test.ts).
import { AiError, redact } from './lib.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Voix proposées (voix préenregistrées du fournisseur, modèle multilingue). */
export const VOICES: Record<string, string> = {
  feminine: '21m00Tcm4TlvDq8ikWAM',
  masculine: 'pNInz6obpgDQGcFmaJgB',
};
export const TTS_MODEL = 'eleven_multilingual_v2';
export const STT_MODEL = 'scribe_v1';
/** Sortie MP3 à 128 kbit/s : durée = octets × 8 / 128 000. */
export const TTS_FORMAT = 'mp3_44100_128';
export const TTS_MAX_CHARS = 2500;
/** Limites de la voix off (bucket voices) : 2 minutes, 5 Mo. */
export const VOICE_MAX_MS = 120_000;
export const VOICE_MAX_BYTES = 5 * 1024 * 1024;
/** Vidéo d'une étape : 10 minutes au plus (F7). */
export const VIDEO_MAX_S = 600;

export interface VoiceRequest {
  stepId: string;
  text: string;
  voice: string;
  /** Secondes d'audio réservées avant l'appel (estimation ~14 caractères par seconde). */
  estimate: number;
}
export interface CaptionsRequest {
  stepId: string;
}

export function parseVoice(input: Record<string, unknown>): VoiceRequest {
  const stepId = String(input.stepId ?? '');
  if (!UUID.test(stepId)) throw new AiError('BAD_STEP');
  const text = typeof input.text === 'string' ? input.text.trim() : '';
  if (!text) throw new AiError('MISSING_TEXT');
  if (text.length > TTS_MAX_CHARS) throw new AiError('TOO_LONG_TEXT');
  // La transcription est lue à voix haute : une donnée personnelle détectée bloque l'envoi
  if (redact(text).count > 0) throw new AiError('PII_IN_TEXT', 422);
  const voice = typeof input.voice === 'string' && VOICES[input.voice] ? input.voice : 'feminine';
  return { stepId, text, voice, estimate: Math.min(VOICE_MAX_MS / 1000, Math.ceil(text.length / 14) + 1) };
}

export function parseCaptions(input: Record<string, unknown>): CaptionsRequest {
  const stepId = String(input.stepId ?? '');
  if (!UUID.test(stepId)) throw new AiError('BAD_STEP');
  return { stepId };
}

export const mp3DurationMs = (bytes: number) => Math.round((bytes * 8) / 128);

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
