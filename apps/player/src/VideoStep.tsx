import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Step } from '@flowdsiml/manifest';
import { Captions, Maximize, Pause, Play, RotateCw, Volume2, VolumeX, VideoOff } from 'lucide-preact';
import { fmt, type Dict } from './i18n';
import {
  captionAt,
  clock,
  editedDuration,
  normalizeCuts,
  skipCut,
  toEdited,
  toSource,
} from '@flowdsiml/core';

const ICON = { size: 18, strokeWidth: 2, 'aria-hidden': true } as const;

/**
 * F7 (L21-04) : étape vidéo. Contrôles habillés (lecture, temps, barre de position avec les
 * pauses-étapes, sous-titres, plein écran), coupes sautées, arrêt et bulle à chaque pause, départ
 * sans son avec « Activer le son », sous-titres activés par défaut s'il y a une voix.
 */
export function VideoStep({
  step,
  t,
  sub,
  nextLabel,
  onNext,
  onPause,
}: {
  step: Step;
  t: Dict;
  sub: (s: string) => string;
  nextLabel: string;
  onNext: () => void;
  /** Pause-étape affichée (statistiques). */
  onPause?: (n: number) => void;
}) {
  const v = step.video!;
  const vt = t.video as unknown as Record<string, string>;
  const ref = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const cuts = useMemo(() => normalizeCuts(v.cuts, v.durationMs), [v]);
  // Pauses hors des coupes, dans l'ordre
  const pauses = useMemo(
    () => v.pauses.filter((p) => skipCut(p.t, cuts) === null).sort((a, b) => a.t - b.t),
    [v, cuts],
  );
  const total = editedDuration(cuts, v.durationMs);
  const [now, setNow] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(v.autoplayMuted);
  const [cc, setCc] = useState(v.captionsDefault || v.hasVoice);
  const [paused, setPaused] = useState<number | null>(null);
  const [ended, setEnded] = useState(false);
  // L36 : vidéo absente (supprimée, réseau coupé) : message, nouvel essai, et l'étape suivante reste accessible
  const [failed, setFailed] = useState(false);
  const shown = useRef(new Set<string>());
  const reload = () => {
    setFailed(false);
    ref.current?.load();
  };
  useEffect(() => {
    if (!failed) return;
    addEventListener('online', reload);
    return () => removeEventListener('online', reload);
  }, [failed]);

  useEffect(() => {
    if (paused !== null) bubble.current?.focus();
  }, [paused]);

  function onTime() {
    const el = ref.current;
    if (!el) return;
    const ms = el.currentTime * 1000;
    const jump = skipCut(ms, cuts);
    if (jump !== null) {
      el.currentTime = jump / 1000;
      return;
    }
    // Pause-étape franchie : arrêt et bulle (une fois par passage)
    const i = pauses.findIndex((p) => !shown.current.has(p.id) && ms >= p.t && ms - p.t < 1500);
    if (i >= 0) {
      shown.current.add(pauses[i]!.id);
      el.pause();
      el.currentTime = pauses[i]!.t / 1000;
      setPaused(i);
      onPause?.(i + 1);
    }
    setNow(ms);
  }

  function play() {
    const el = ref.current;
    if (!el) return;
    setPaused(null);
    if (ended) {
      shown.current.clear();
      el.currentTime = 0;
      setEnded(false);
    }
    void el.play().catch(() => setPlaying(false));
  }
  function seek(edited: number) {
    const el = ref.current;
    if (!el) return;
    const src = toSource(Math.max(0, Math.min(total, edited)), cuts);
    // Les pauses déjà dépassées ne se rejouent pas ; celles d'après, oui
    shown.current = new Set(pauses.filter((p) => p.t < src).map((p) => p.id));
    el.currentTime = src / 1000;
    setNow(src);
    setPaused(null);
  }
  function fullscreen() {
    const el = box.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => undefined);
  }
  function onKey(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement).tagName;
    if (e.key === ' ' && tag !== 'BUTTON' && tag !== 'INPUT') {
      e.preventDefault();
      e.stopPropagation();
      if (playing) ref.current?.pause();
      else play();
    } else if ((e.key === 'c' || e.key === 'C') && tag !== 'INPUT') {
      e.stopPropagation();
      setCc((x) => !x);
    }
  }

  const edited = toEdited(now, cuts);
  const caption = cc ? captionAt(now, v.captions) : null;
  const p = paused !== null ? pauses[paused] : null;
  return (
    <div class="p-video" ref={box} onKeyDown={onKey}>
      <div class="p-video__stage">
        <video
          ref={ref}
          src={v.url}
          // L28 035 : une voix off remplace la piste son de la vidéo
          muted={muted || !!step.voice}
          autoPlay={v.autoplayMuted}
          playsInline
          preload="metadata"
          aria-label={sub(step.title) || vt.label}
          onTimeUpdate={onTime}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={() => {
            setPlaying(false);
            setFailed(true);
          }}
          onEnded={() => {
            setPlaying(false);
            setEnded(true);
          }}
        />
        {muted && v.hasVoice && (
          <button type="button" class="p-video__sound" onClick={() => setMuted(false)}>
            <Volume2 {...ICON} />
            {vt.unmute}
          </button>
        )}
        {caption && (
          <p class="p-video__cc" aria-live="off">
            {sub(caption)}
          </p>
        )}
        {p && (
          <div
            class="p-video__bubble"
            role="dialog"
            aria-labelledby={`pv-b-${p.id}`}
            tabIndex={-1}
            ref={bubble}
          >
            <span class="p-video__count">
              {fmt(vt, 'pauseOf', { n: (paused ?? 0) + 1, total: pauses.length })}
            </span>
            {p.title && <h2 id={`pv-b-${p.id}`}>{sub(p.title)}</h2>}
            {!p.title && (
              <h2 id={`pv-b-${p.id}`} class="sr-only">
                {fmt(vt, 'pauseOf', { n: (paused ?? 0) + 1, total: pauses.length })}
              </h2>
            )}
            {p.body && <p>{sub(p.body)}</p>}
            <button type="button" class="p-btn p-btn-primary" onClick={play}>
              {vt.continue}
            </button>
          </div>
        )}
        {failed && (
          <div class="p-video__end p-video__error" role="alert">
            <VideoOff {...ICON} />
            <p>{vt.error}</p>
            <div class="p-video__error-act">
              <button type="button" class="p-btn p-btn-secondary" onClick={reload}>
                <RotateCw size={16} aria-hidden="true" />
                {t.retry}
              </button>
              <button type="button" class="p-btn p-btn-primary" onClick={onNext}>
                {nextLabel}
              </button>
            </div>
          </div>
        )}
        {ended && !failed && (
          <div class="p-video__end">
            <button type="button" class="p-btn p-btn-primary" onClick={onNext} autoFocus>
              {nextLabel}
            </button>
          </div>
        )}
      </div>
      <div class="p-video__bar">
        <button
          type="button"
          class="p-video__btn"
          aria-label={playing ? vt.pause : vt.play}
          onClick={() => (playing ? ref.current?.pause() : play())}
        >
          {playing ? <Pause {...ICON} /> : <Play {...ICON} />}
        </button>
        <span class="p-video__time">
          {clock(edited)} / {clock(total)}
        </span>
        <span class="p-video__track">
          <input
            type="range"
            min={0}
            max={total}
            step={1000}
            value={edited}
            aria-label={vt.position}
            aria-valuetext={fmt(vt, 'valueText', { now: clock(edited), total: clock(total) })}
            onInput={(e) => seek(Number((e.target as HTMLInputElement).value))}
            onKeyDown={(e) => e.stopPropagation()}
          />
          {pauses.map((x) => (
            <i
              key={x.id}
              class="p-video__mark"
              style={{ left: `${(toEdited(x.t, cuts) / Math.max(1, total)) * 100}%` }}
              aria-hidden="true"
            />
          ))}
        </span>
        {v.captions.length > 0 && (
          <button
            type="button"
            class="p-video__btn"
            aria-pressed={cc}
            aria-label={vt.captions}
            onClick={() => setCc((x) => !x)}
          >
            <Captions {...ICON} />
          </button>
        )}
        <button
          type="button"
          class="p-video__btn"
          aria-label={muted ? vt.unmute : vt.mute}
          onClick={() => setMuted((m) => !m)}
          disabled={!v.hasVoice}
        >
          {muted ? <VolumeX {...ICON} /> : <Volume2 {...ICON} />}
        </button>
        <button type="button" class="p-video__btn" aria-label={vt.fullscreen} onClick={fullscreen}>
          <Maximize {...ICON} />
        </button>
      </div>
      {!v.hasVoice && <p class="p-video__nosound">{vt.noSound}</p>}
    </div>
  );
}
