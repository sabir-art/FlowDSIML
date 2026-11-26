// L41 (docs/tech/ia-fournisseurs.md §3) : adaptateur ElevenLabs (voix et transcription). Appels déplacés
// de ai/index.ts sans changement de comportement. Toute erreur réseau rend null ; l'appelant lit le statut.
import { causeOf, type KeyTest } from './anthropic.ts';

export const ELEVEN = 'https://api.elevenlabs.io/v1';
type Fetch = typeof fetch;

const call = (f: Fetch, url: string, init: RequestInit) => f(url, init).catch(() => null);

export const voices = (key: string, f: Fetch = fetch) =>
  call(f, `${ELEVEN}/voices?show_legacy=true`, { headers: { 'xi-api-key': key } });

export const voice = (key: string, id: string, f: Fetch = fetch) =>
  call(f, `${ELEVEN}/voices/${id}`, { headers: { 'xi-api-key': key } });

/** Synthèse vocale (MP3). `body` : texte, modèle et réglages de la voix. */
export const tts = (
  key: string,
  voiceId: string,
  format: string,
  body: Record<string, unknown>,
  f: Fetch = fetch,
) =>
  call(f, `${ELEVEN}/text-to-speech/${voiceId}?output_format=${format}`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify(body),
  });

/** Transcription (formulaire : modèle, fichier, langue). */
export const stt = (key: string, form: FormData, f: Fetch = fetch) =>
  call(f, `${ELEVEN}/speech-to-text`, { method: 'POST', headers: { 'xi-api-key': key }, body: form });

/** Suppression immédiate côté fournisseur après génération (historique TTS, transcription STT). */
export async function purge(key: string, url: string, what: string, f: Fetch = fetch) {
  const res = await call(f, url, { method: 'DELETE', headers: { 'xi-api-key': key } });
  if (!res?.ok) console.error(`ai: purge ${what}`, res?.status ?? 'network');
}

/** Demande minimale (liste des modèles) : la clé est-elle acceptée ? */
export async function test(key: string, f: Fetch = fetch): Promise<KeyTest> {
  const t0 = Date.now();
  const res = await call(f, `${ELEVEN}/models`, { headers: { 'xi-api-key': key } });
  const ms = Date.now() - t0;
  if (!res) return { ok: false, ms, cause: 'NETWORK', status: 0 };
  await res.body?.cancel();
  return res.ok ? { ok: true, ms } : { ok: false, ms, cause: causeOf(res.status), status: res.status };
}
