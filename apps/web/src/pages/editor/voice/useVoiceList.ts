import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { callAi } from '../../../lib/ai';
import { VOICE_CHOICES } from '../../../components/ai/AiAudio';
import type { VoiceInfo } from './VoicePicker';

type List = { voices: VoiceInfo[]; aliases: Record<string, string> };

// Une seule demande par espace et par langue, partagée entre l'onglet Générée et le bouton
// « Générer la voix depuis ce texte » (L62 §6, commit 3)
const cache = new Map<string, Promise<List>>();

/**
 * L62 §8 : voix du compte pour la langue de la démo. Repli (liste illisible) : les anciennes voix
 * proposées, sous leur nom d'interface. `ready` passe à vrai quand la liste du compte est arrivée.
 */
export function useVoiceList(ws: string, lang: string, on = true) {
  const { t } = useTranslation();
  const fallback: VoiceInfo[] = VOICE_CHOICES.map((v, i) => ({
    id: v,
    name: t(`ai.voice.v.${v}.name`),
    gender: i < 3 ? 'f' : 'm',
    accent: '',
    style: t(`ai.voice.v.${v}.desc`),
    langs: [lang],
    recommended: false,
    own: false,
  }));
  const [list, setList] = useState<List | null>(null);
  useEffect(() => {
    if (!on || !ws) return;
    let live = true;
    const key = `${ws}|${lang}`;
    let p = cache.get(key);
    if (!p) {
      p = callAi<List>(ws, 'voice_list', lang, {}).then((r) => {
        if (!Array.isArray(r.voices) || !r.voices.length) throw new Error('EMPTY');
        return { voices: r.voices, aliases: r.aliases ?? {} };
      });
      // Échec : on réessaiera à la prochaine ouverture
      p.catch(() => cache.delete(key));
      cache.set(key, p);
    }
    p.then((r) => live && setList(r)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [ws, lang, on]);
  return { voices: list?.voices ?? fallback, aliases: list?.aliases ?? {}, ready: !!list };
}

/**
 * Voix retenue pour la démo (un ancien emplacement « claire »… retrouve sa voix par la correspondance
 * du serveur), sinon la voix recommandée pour la langue, sinon la première.
 */
export function pickVoice(
  voices: VoiceInfo[],
  aliases: Record<string, string>,
  saved: string | undefined,
): VoiceInfo | undefined {
  const id = saved ? (aliases[saved] ?? saved) : '';
  return voices.find((v) => v.id === id) ?? voices.find((v) => v.recommended) ?? voices[0];
}

/** Nom de la langue dans la langue de l'interface (« français »). */
export function langLabel(lang: string, uiLang: string): string {
  try {
    return new Intl.DisplayNames([uiLang], { type: 'language' }).of(lang) ?? lang;
  } catch {
    return lang;
  }
}
