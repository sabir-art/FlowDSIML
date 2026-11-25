import { useState } from 'react';

export interface EmbedSize {
  fixed: boolean;
  width: number;
  height: number;
}

export const DEFAULT_EMBED_SIZE: EmbedSize = { fixed: false, width: 960, height: 644 };
const key = (demoId: string) => `tc.embed.size:${demoId}`;

export function readEmbedSize(raw: string | null): EmbedSize {
  try {
    const v = JSON.parse(raw ?? 'null') as Partial<EmbedSize> | null;
    if (!v || typeof v !== 'object') return DEFAULT_EMBED_SIZE;
    const px = (n: unknown, d: number) =>
      typeof n === 'number' && Number.isFinite(n) ? Math.min(4000, Math.max(200, Math.round(n))) : d;
    return {
      fixed: v.fixed === true,
      width: px(v.width, DEFAULT_EMBED_SIZE.width),
      height: px(v.height, DEFAULT_EMBED_SIZE.height),
    };
  } catch {
    return DEFAULT_EMBED_SIZE;
  }
}

/** Taille de l'encadré d'intégration, gardée par démo sur cet appareil (rien n'est envoyé au serveur). */
export function useEmbedSize(demoId: string): [EmbedSize, (s: EmbedSize) => void] {
  const [size, setSize] = useState<EmbedSize>(() => {
    try {
      return readEmbedSize(localStorage.getItem(key(demoId)));
    } catch {
      return DEFAULT_EMBED_SIZE;
    }
  });
  return [
    size,
    (s) => {
      setSize(s);
      try {
        localStorage.setItem(key(demoId), JSON.stringify(s));
      } catch {
        // stockage indisponible : le choix vaut pour cette ouverture
      }
    },
  ];
}
