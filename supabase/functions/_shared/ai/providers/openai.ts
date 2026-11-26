// L41 (docs/tech/ia-fournisseurs.md §3, réponse du chef §12.1) : adaptateur OpenAI. Étape 2 : test de la
// clé seulement (liste des modèles). La transcription OpenAI, proposée dès qu'une clé existe, viendra avec
// le modèle par fonction (étape 3). Rien n'est envoyé à OpenAI sans clé enregistrée.
import { causeOf, type KeyTest } from './anthropic.ts';

export const OPENAI = 'https://api.openai.com/v1';
type Fetch = typeof fetch;

export async function test(key: string, f: Fetch = fetch): Promise<KeyTest> {
  const t0 = Date.now();
  const res = await f(`${OPENAI}/models`, { headers: { authorization: `Bearer ${key}` } }).catch(() => null);
  const ms = Date.now() - t0;
  if (!res) return { ok: false, ms, cause: 'NETWORK', status: 0 };
  await res.body?.cancel();
  return res.ok ? { ok: true, ms } : { ok: false, ms, cause: causeOf(res.status), status: res.status };
}
