import { Pause, Play } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { formatClock } from './voice';

const BARS = 22;

/** Onde dessinée : hauteurs stables pour une même piste (pas d'analyse du son, c'est un repère de lecture). */
export function waveOf(seed: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  return Array.from({ length: BARS }, () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    return 4 + (h % 17);
  });
}

export function Wave({ levels, played = 0 }: { levels: number[]; played?: number }) {
  return (
    <span className="vo-wave" aria-hidden="true" data-gap-exempt="">
      {levels.map((v, i) => (
        <i
          key={i}
          className={i < Math.round(played * levels.length) ? 'p' : undefined}
          style={{ height: v }}
        />
      ))}
    </span>
  );
}

/**
 * EXT-02 §6.4 : lecteur d'une piste, dessiné (COMP-01 : pas de lecteur natif). Bouton rond lecture / pause,
 * onde, temps « 0:02 / 0:06 ». `end` : bouton à droite du temps (pause de l'enregistrement, sous-titres).
 */
export function AudioLine({
  src,
  durationMs,
  label,
  pauseLabel,
  end,
}: {
  src: string | null;
  durationMs: number;
  /** Nom du bouton de lecture (« Écouter »). */
  label: string;
  pauseLabel: string;
  end?: ReactNode;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const levels = useMemo(() => waveOf(src ?? ''), [src]);
  useEffect(() => {
    setPlaying(false);
    setAt(0);
  }, [src]);
  const total = Math.max(1, durationMs);
  return (
    <div className="vo-aud">
      <button
        type="button"
        className="vo-play"
        disabled={!src}
        aria-label={playing ? pauseLabel : label}
        onClick={() => {
          const a = audio.current;
          if (!a) return;
          if (a.paused) void a.play().catch(() => undefined);
          else a.pause();
        }}
      >
        {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
      </button>
      <Wave levels={levels} played={Math.min(1, at / total)} />
      <span className="vo-time">
        {formatClock(at)} / {formatClock(durationMs)}
      </span>
      {end}
      {src && (
        <audio
          ref={audio}
          src={src}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setAt(0);
          }}
          onTimeUpdate={(e) => setAt(e.currentTarget.currentTime * 1000)}
        />
      )}
    </div>
  );
}
