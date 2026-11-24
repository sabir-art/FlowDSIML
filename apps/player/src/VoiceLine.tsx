import { createContext } from 'preact';
import type { RefObject } from 'preact';
import { useContext, useEffect, useMemo, useState } from 'preact/hooks';
import { Captions, Pause, Play } from 'lucide-preact';

/**
 * EXT-02 §6.4 : lecteur de la voix off dans la bulle (réglage « Lecteur audio : Bulle »). Sous le texte,
 * une ligne de 36 px : lecture / pause, onde, temps, bouton des sous-titres. La piste reste l'élément audio
 * du lecteur ; cette ligne le pilote. Le visiteur garde la touche C pour les sous-titres.
 */
export interface VoiceLineState {
  audio: RefObject<HTMLAudioElement>;
  /** Change avec l'étape : la ligne se rebranche sur la nouvelle piste. */
  stepId: string;
  durationMs: number;
  cc: boolean;
  onCc: () => void;
  /** Premier clic : le son est activé pour la session (règle des navigateurs). */
  onPlay: () => void;
  /** La ligne est affichée : les boutons de la barre du lecteur s'effacent. */
  onHosted: (hosted: boolean) => void;
  labels: { play: string; pause: string; captions: string };
}
export const VoiceLineContext = createContext<VoiceLineState | null>(null);

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const BARS = 18;
/** Onde dessinée, stable pour une même étape (repère de lecture, pas une analyse du son). */
function waveOf(seed: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  return Array.from({ length: BARS }, () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    return 4 + (h % 13);
  });
}

/** À placer dans une bulle : n'affiche rien si l'étape n'a pas de voix ou si le lecteur est dans la barre. */
export function VoiceLine() {
  const v = useContext(VoiceLineContext);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const levels = useMemo(() => waveOf(v?.stepId ?? ''), [v?.stepId]);
  const onHosted = v?.onHosted;
  useEffect(() => {
    if (!onHosted) return;
    onHosted(true);
    return () => onHosted(false);
  }, [onHosted]);
  const audio = v?.audio;
  const stepId = v?.stepId;
  useEffect(() => {
    const a = audio?.current;
    if (!a) return;
    const sync = () => {
      setPlaying(!a.paused && !a.ended);
      setAt(a.currentTime * 1000);
    };
    sync();
    const events = ['play', 'pause', 'ended', 'timeupdate', 'seeked', 'emptied'] as const;
    for (const e of events) a.addEventListener(e, sync);
    return () => {
      for (const e of events) a.removeEventListener(e, sync);
    };
  }, [audio, stepId]);
  if (!v) return null;
  const total = Math.max(1, v.durationMs);
  const played = Math.round(Math.min(1, at / total) * levels.length);
  return (
    <div class="p-voice-line">
      <button
        type="button"
        class="p-voice-play"
        aria-label={playing ? v.labels.pause : v.labels.play}
        onClick={() => {
          const a = v.audio.current;
          if (!a) return;
          if (a.paused) {
            v.onPlay();
            void a.play().catch(() => undefined);
          } else a.pause();
        }}
      >
        {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
      </button>
      <span class="p-voice-wave" aria-hidden="true">
        {levels.map((hh, i) => (
          <i key={i} class={i < played ? 'p' : undefined} style={{ height: `${hh}px` }} />
        ))}
      </span>
      <span class="p-voice-time">
        {clock(at)} / {clock(v.durationMs)}
      </span>
      <button
        type="button"
        class="p-voice-cc-btn"
        aria-pressed={v.cc}
        aria-label={v.labels.captions}
        aria-keyshortcuts="C"
        onClick={v.onCc}
      >
        <Captions size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
