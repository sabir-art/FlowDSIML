import type { HotspotRow, StepRow } from '../types';

/** L28 035 : limites d'une voix off (contrôlées aussi par la base et le bucket voices). */
export const VOICE_MAX_MS = 120_000;
export const VOICE_MAX_BYTES = 5 * 1024 * 1024;
export const VOICE_ACCEPT =
  'audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,audio/webm,.mp3,.m4a,.wav,.webm';

/** Extension du fichier stocké selon le type MIME ; null si le format n'est pas accepté. */
export function voiceExt(mime: string): 'mp3' | 'm4a' | 'wav' | 'webm' | null {
  const m = mime.split(';')[0]!.trim().toLowerCase();
  if (m === 'audio/mpeg' || m === 'audio/mp3') return 'mp3';
  if (m === 'audio/mp4' || m === 'audio/x-m4a' || m === 'audio/m4a') return 'm4a';
  if (m === 'audio/wav' || m === 'audio/x-wav' || m === 'audio/wave') return 'wav';
  if (m === 'audio/webm') return 'webm';
  return null;
}

/** 0:12, 2:00 */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const plain = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

/** Transcription préremplie : texte des bulles de l'étape, sinon son titre et son texte. */
export function bubbleText(step: StepRow, hotspots: HotspotRow[]): string {
  const mine = hotspots
    .filter((h) => h.step_id === step.id)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((h) => plain([h.title, h.body].filter(Boolean).join('. ')))
    .filter(Boolean);
  const text = mine.length ? mine.join(' ') : plain([step.title, step.body].filter(Boolean).join('. '));
  return text.slice(0, 4000);
}
