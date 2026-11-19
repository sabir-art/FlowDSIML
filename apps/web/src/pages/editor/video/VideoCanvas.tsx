import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Pause, Play, Scissors, Target } from 'lucide-react';
import { captionAt, editedDuration, normalizeCuts } from '@flowdsiml/core';
import { supabase } from '../../../lib/supabase';
import type { DemoEditor } from '../useDemoEditor';
import type { StepRow } from '../types';
import {
  MAX_CUTS,
  MAX_PAUSES,
  asVideo,
  mmss,
  newPauseId,
  setVideoEdit,
  useVideoEdit,
  videoEl,
  type VideoConfig,
} from './videoModel';
import './video.css';

/** Image de la vidéo au temps courant (WebP), pour une pause ajoutée au montage. */
async function grabFrame(v: HTMLVideoElement): Promise<Blob | null> {
  try {
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    return await new Promise((res) => c.toBlob((b) => res(b), 'image/webp', 0.85));
  } catch {
    return null; // image protégée (CORS) : la pause reste sans image
  }
}

/**
 * F7 (L21-03) : étape vidéo dans l'éditeur. Canevas (image au temps courant, pause sélectionnée et
 * sa bulle, sous-titre courant) et montage (Lire, temps, « Couper ici » C, « Ajouter une
 * pause-étape » P, pistes vidéo et sous-titres, échelle de temps ; flèches ±1 s, Maj ±5 s, Suppr).
 */
export function VideoCanvas({
  editor,
  step,
  readOnly,
}: {
  editor: DemoEditor;
  step: StepRow;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const v = asVideo(step.video);
  const dur = step.video_duration_ms ?? 0;
  const ed = useVideoEdit(step.id);
  const ref = useRef<HTMLVideoElement>(null);
  const [notice, setNotice] = useState('');
  const url = step.video_path ? editor.imageUrls[step.video_path] : undefined;
  const cuts = useMemo(() => normalizeCuts(v.cuts, dur || 1), [v.cuts, dur]);
  const [tlSlot, setTlSlot] = useState<HTMLElement | null>(null);
  useEffect(() => setTlSlot(document.getElementById('video-tl-slot')), [step.id]);
  const after = editedDuration(cuts, dur || 1);
  const pauseIdx = v.pauses.findIndex((p) => p.id === ed.pause);
  const pause = pauseIdx >= 0 ? v.pauses[pauseIdx] : null;
  const caption = captionAt(ed.t, v.captions);

  useEffect(() => {
    const el = ref.current;
    videoEl.current = el;
    return () => {
      if (videoEl.current === el) videoEl.current = null;
    };
  }, [url]);

  const save = (patch: Partial<VideoConfig>) =>
    editor.updateStep(step.id, { video: { ...v, ...patch } as unknown as StepRow['video'] });

  function seek(ms: number) {
    const x = Math.max(0, Math.min(dur, ms));
    if (ref.current) ref.current.currentTime = x / 1000;
    setVideoEdit({ t: x });
  }

  async function addPause() {
    if (readOnly || v.pauses.length >= MAX_PAUSES) return;
    const id = newPauseId();
    const pauses = [...v.pauses, { id, t: Math.round(ed.t), title: '', body: '' }].sort((a, b) => a.t - b.t);
    let frames = v.frames;
    const el = ref.current;
    if (el && editor.demo) {
      const blob = await grabFrame(el);
      if (blob) {
        const path = `${editor.demo.workspace_id}/${editor.demo.id}/${crypto.randomUUID()}.webp`;
        const up = await supabase.storage.from('captures').upload(path, blob, { contentType: 'image/webp' });
        if (!up.error) frames = { ...frames, [id]: path };
      }
    }
    save({ pauses, frames });
    setVideoEdit({ pause: id });
    setNotice(t('editor.video.pauseAdded', { time: mmss(ed.t) }));
  }

  function cut() {
    if (readOnly) return;
    if (ed.cutStart === null) {
      setVideoEdit({ cutStart: ed.t });
      setNotice(t('editor.video.cutStarted', { time: mmss(ed.t) }));
      return;
    }
    const from = Math.min(ed.cutStart, ed.t);
    const to = Math.max(ed.cutStart, ed.t);
    setVideoEdit({ cutStart: null });
    if (to - from < 200 || v.cuts.length >= MAX_CUTS) return setNotice(t('editor.video.cutTooShort'));
    save({ cuts: [...v.cuts, { from: Math.round(from), to: Math.round(to) }] });
    setNotice(t('editor.video.cutDone', { from: mmss(from), to: mmss(to) }));
  }

  function removeSelectedPause() {
    if (readOnly || !pause) return;
    const frames = { ...v.frames };
    delete frames[pause.id];
    save({ pauses: v.pauses.filter((p) => p.id !== pause.id), frames });
    setVideoEdit({ pause: null });
    setNotice(t('editor.video.pauseRemoved', { n: pauseIdx + 1 }));
  }

  function onKey(e: KeyboardEvent) {
    // Les raccourcis du montage ne remontent pas à l'éditeur (flèches = changement d'étape)
    if (['ArrowRight', 'ArrowLeft', 'c', 'C', 'p', 'P', 'Delete', 'Backspace', ' '].includes(e.key))
      e.stopPropagation();
    const step = e.shiftKey ? 5000 : 1000;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      seek(ed.t + (e.key === 'ArrowRight' ? step : -step));
    } else if (e.key === 'c' || e.key === 'C') {
      e.preventDefault();
      cut();
    } else if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      void addPause();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      removeSelectedPause();
    } else if (e.key === ' ') {
      e.preventDefault();
      togglePlay();
    }
  }

  function togglePlay() {
    const el = ref.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => undefined);
    else el.pause();
  }

  const pct = (ms: number) => `${(Math.max(0, Math.min(dur, ms)) / Math.max(1, dur)) * 100}%`;
  // Segments conservés (entre les coupes), titrés par la pause qui y tombe
  const segs: Array<{ from: number; to: number }> = [];
  let at = 0;
  for (const c of cuts) {
    if (c.from > at) segs.push({ from: at, to: c.from });
    at = c.to;
  }
  if (at < dur) segs.push({ from: at, to: dur });
  const ticks = Array.from({ length: 5 }, (_, i) => (dur * i) / 4);

  const timeline = (
    <div className="vd-tl card" aria-label={t('editor.video.montage')}>
      <div className="vd-bar">
        <button type="button" className="btn btn-secondary btn-sm" onClick={togglePlay} disabled={!url}>
          {ed.playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          {ed.playing ? t('editor.video.pause') : t('editor.video.play')}
        </button>
        <span className="vd-time">
          {t('editor.video.time', { now: mmss(ed.t), total: mmss(dur), after: mmss(after) })}
        </span>
        <span className="grow" />
        {!readOnly && (
          <>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={cut}
              aria-pressed={ed.cutStart !== null}
            >
              <Scissors aria-hidden="true" />
              {ed.cutStart !== null ? t('editor.video.cutEnd') : t('editor.video.cut')}{' '}
              <span className="kbd">C</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void addPause()}
              disabled={v.pauses.length >= MAX_PAUSES}
            >
              <Target aria-hidden="true" />
              {t('editor.video.addPause')} <span className="kbd">P</span>
            </button>
          </>
        )}
      </div>
      <div
        className="vd-tracks"
        tabIndex={0}
        role="group"
        aria-label={t('editor.video.tracksLabel')}
        aria-describedby="vd-keys"
        onKeyDown={onKey}
      >
        <div
          className="vd-track"
          role="img"
          aria-label={t('editor.video.trackSummary', {
            total: mmss(dur),
            segs: segs.length,
            cuts: cuts.length
              ? cuts.map((c) => `${mmss(c.from)}–${mmss(c.to)}`).join(', ')
              : t('editor.video.none'),
            pauses: v.pauses.length ? v.pauses.map((p) => mmss(p.t)).join(', ') : t('editor.video.none'),
          })}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            seek(((e.clientX - r.left) / r.width) * dur);
          }}
        >
          {segs.map((s, i) => {
            const inSeg = v.pauses.find((p) => p.t >= s.from && p.t < s.to);
            return (
              <span
                key={i}
                className="vd-seg"
                style={{ left: pct(s.from), width: `calc(${pct(s.to)} - ${pct(s.from)})` }}
              >
                {inSeg?.title}
              </span>
            );
          })}
          {cuts.map((c, i) => (
            <span
              key={`c${i}`}
              className="vd-cut"
              style={{ left: pct(c.from), width: `calc(${pct(c.to)} - ${pct(c.from)})` }}
            />
          ))}
          {ed.cutStart !== null && <span className="vd-cutmark" style={{ left: pct(ed.cutStart) }} />}
          {v.pauses.map((p, i) => (
            <button
              key={p.id}
              type="button"
              tabIndex={-1}
              // L21-03 : une pause placée dans une coupe est ignorée à la lecture (contour warning)
              className={`vd-pin${p.id === ed.pause ? ' sel' : ''}${(v.cuts ?? []).some((c) => p.t >= c.from && p.t < c.to) ? ' in-cut' : ''}`}
              style={{ left: pct(p.t) }}
              aria-hidden="true"
              onClick={(e) => {
                e.stopPropagation();
                setVideoEdit({ pause: p.id });
                seek(p.t);
              }}
            >
              {i + 1}
            </button>
          ))}
          <span className="vd-head" style={{ left: pct(ed.t) }} />
        </div>
        <div
          className="vd-subtrack"
          role="img"
          aria-label={t('editor.video.subSummary', { count: v.captions.length })}
        >
          {v.captions.map((c, i) => (
            <span
              key={i}
              className="vd-subblock"
              style={{ left: pct(c.from), width: `calc(${pct(c.to)} - ${pct(c.from)})` }}
            >
              {c.text}
            </span>
          ))}
        </div>
        <div className="vd-scale" aria-hidden="true">
          {ticks.map((x, i) => (
            <span key={i}>{mmss(x)}</span>
          ))}
        </div>
      </div>
      <p className="help" id="vd-keys">
        {t('editor.video.keys')}
      </p>
      <span className="sr-only" role="status">
        {notice}
      </span>
    </div>
  );
  return (
    <div className="vd">
      <div className="vd-stage">
        {url ? (
          <video
            ref={ref}
            src={url}
            crossOrigin="anonymous"
            preload="auto"
            playsInline
            muted
            aria-label={t('editor.video.frameAt', {
              time: mmss(ed.t),
              pause: pause ? t('editor.video.pauseN', { n: pauseIdx + 1 }) : '',
            })}
            onTimeUpdate={(e) => setVideoEdit({ t: e.currentTarget.currentTime * 1000 })}
            onPlay={() => setVideoEdit({ playing: true })}
            onPause={() => setVideoEdit({ playing: false })}
          />
        ) : (
          <p className="vd-missing">{t('editor.video.missing')}</p>
        )}
        {pause && (
          <>
            <span className="vd-pause">
              {t('editor.video.pauseLabel', { n: pauseIdx + 1, time: mmss(pause.t) })}
            </span>
            <div className="vd-bubble">
              <span className="vd-cnt">
                {t('editor.video.pauseOf', { n: pauseIdx + 1, total: v.pauses.length })}
              </span>
              {pause.title && <b>{pause.title}</b>}
              <p>{pause.body || t('editor.video.bubbleEmpty')}</p>
            </div>
          </>
        )}
        {caption && <span className="vd-sub">{caption}</span>}
      </div>

      {/* L21-03 : carte Montage sous le canevas, hors du cadre navigateur (thème de l'app) */}
      {tlSlot ? createPortal(timeline, tlSlot) : timeline}
    </div>
  );
}
