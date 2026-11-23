import { DropBlock } from '../../../components/DropBlock';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Layers, Pencil, Plus, Sparkles, Trash2, TriangleAlert, Upload, X } from 'lucide-react';
import { AiCaptions, languageName, type CaptionsResult } from '../../../components/ai/AiAudio';
import { useConfirm } from '../../../components/ConfirmDialog';
import { useWorkspace } from '../../../workspace/WorkspaceProvider';
import { asSettings } from '../types';
import { parseVtt } from '@flowdsiml/core';
import { useToast } from '../../../components/Toast';
import type { DemoEditor } from '../useDemoEditor';
import type { StepRow } from '../types';
import {
  MAX_CAPTIONS,
  asVideo,
  mmss,
  setVideoEdit,
  useVideoEdit,
  videoEl,
  type VideoCaption,
  type VideoConfig,
} from './videoModel';

/** « 1:02.5 » ou « 62.5 » → ms ; null si illisible. */
export function parseClock(s: string): number | null {
  const m = /^\s*(?:(\d+):)?(\d+(?:[.,]\d+)?)\s*$/.exec(s);
  if (!m) return null;
  const ms = Math.round((Number(m[1] ?? 0) * 60 + Number(m[2]!.replace(',', '.'))) * 1000);
  return Number.isFinite(ms) ? ms : null;
}
const clockText = (ms: number) =>
  `${Math.floor(ms / 60000)}:${((ms % 60000) / 1000).toFixed(1).padStart(4, '0')}`;

/**
 * F7 (L21-03) : panneau d'une étape vidéo. Pause-étape sélectionnée (texte de la bulle,
 * Précédente / Suivante, suppression), sous-titres (Modifier, Importer .vtt, transcription
 * « Bientôt », affichage par défaut), lecture, conversion en étapes captures.
 */
export function VideoFields({
  editor,
  step,
  readOnly,
}: {
  editor: DemoEditor;
  step: StepRow;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const id = useId();
  const v = asVideo(step.video);
  const ed = useVideoEdit(step.id);
  const file = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [aiCues, setAiCues] = useState<CaptionsResult | null>(null);
  const [dialog, ask] = useConfirm();
  // « Annuler » du toast : toujours l'éditeur courant
  const live = useRef(editor);
  live.current = editor;
  const { current: ws } = useWorkspace();
  const idx = v.pauses.findIndex((p) => p.id === ed.pause);
  const pause = idx >= 0 ? v.pauses[idx] : null;
  const save = (patch: Partial<VideoConfig>) =>
    editor.updateStep(step.id, { video: { ...v, ...patch } as unknown as StepRow['video'] });

  const select = (i: number) => {
    const p = v.pauses[i];
    if (!p) return;
    setVideoEdit({ pause: p.id, t: p.t });
    if (videoEl.current) {
      videoEl.current.pause();
      videoEl.current.currentTime = p.t / 1000;
    }
  };

  /** MEDIA-01 §18.2 : fichier refusé, dit sous le bouton (role=alert). */
  const [vttError, setVttError] = useState('');
  async function importVtt(f: File) {
    setVttError('');
    const cues = parseVtt(await f.text());
    if (!cues) return setVttError(t('editor.video.vttInvalid'));
    save({ captions: cues.slice(0, MAX_CAPTIONS), captionsDefault: v.captionsDefault || cues.length > 0 });
    toast(t('editor.video.vttImported', { count: cues.length }));
  }

  return (
    <>
      <div className="sec">
        {pause ? (
          <>
            <div className="sec-title">
              {t('editor.video.pauseLabel', { n: idx + 1, time: mmss(pause.t) })}
            </div>
            <div className="field">
              <label htmlFor={`${id}-pt`}>{t('editor.video.bubbleTitle')}</label>
              <input
                id={`${id}-pt`}
                className="input"
                maxLength={200}
                disabled={readOnly}
                value={pause.title}
                onChange={(e) =>
                  save({
                    pauses: v.pauses.map((p) => (p.id === pause.id ? { ...p, title: e.target.value } : p)),
                  })
                }
              />
            </div>
            <div className="field">
              <label htmlFor={`${id}-pb`}>{t('editor.video.bubbleText')}</label>
              <textarea
                id={`${id}-pb`}
                className="textarea"
                rows={3}
                maxLength={2000}
                disabled={readOnly}
                value={pause.body}
                onChange={(e) =>
                  save({
                    pauses: v.pauses.map((p) => (p.id === pause.id ? { ...p, body: e.target.value } : p)),
                  })
                }
              />
            </div>
            <p className="help">{t('editor.video.pauseHelp')}</p>
            {/* L21-03 : une pause placée dans une coupe est ignorée à la lecture */}
            {v.cuts.some((c) => pause.t >= c.from && pause.t < c.to) && (
              <p className="help help-warning">
                <TriangleAlert size={16} aria-hidden="true" />
                {t('editor.video.pauseInCut')}
              </p>
            )}
            <div className="row vd-pnav">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={idx <= 0}
                onClick={() => select(idx - 1)}
              >
                {t('editor.video.prevPause')}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={idx >= v.pauses.length - 1}
                onClick={() => select(idx + 1)}
              >
                {t('editor.video.nextPause')}
              </button>
              <span className="grow" />
              {!readOnly && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-icon"
                  aria-label={t('editor.video.deletePause', { n: idx + 1 })}
                  onClick={() => {
                    const frames = { ...v.frames };
                    delete frames[pause.id];
                    save({ pauses: v.pauses.filter((p) => p.id !== pause.id), frames });
                    setVideoEdit({ pause: null });
                  }}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="sec-title">{t('editor.video.pausesTitle', { count: v.pauses.length })}</div>
            {v.pauses.length ? (
              <ol className="vd-plist">
                {v.pauses.map((p, i) => (
                  <li key={p.id}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => select(i)}>
                      {t('editor.video.pauseLabel', { n: i + 1, time: mmss(p.t) })}
                      {p.title && ` · ${p.title}`}
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="help">{t('editor.video.noPause')}</p>
            )}
          </>
        )}
      </div>
      {v.cuts.length > 0 && (
        <div className="sec">
          <div className="sec-title">{t('editor.video.cutsTitle', { count: v.cuts.length })}</div>
          <ul className="vd-plist">
            {v.cuts.map((c, i) => (
              <li key={i} className="row vd-pnav">
                <span>
                  {mmss(c.from)} – {mmss(c.to)}
                </span>
                <span className="grow" />
                {/* L21-03 : action nommée, alignée sur « Précédente / Suivante » */}
                {!readOnly && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    aria-label={t('editor.video.deleteCut', { from: mmss(c.from), to: mmss(c.to) })}
                    onClick={() => save({ cuts: v.cuts.filter((_, j) => j !== i) })}
                  >
                    <X aria-hidden="true" />
                    {t('editor.video.deleteCutShort')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* MEDIA-01 §18.2 : un fichier .vtt déposé n'importe où sur le bloc est importé */}
      <DropBlock className="sec" disabled={readOnly} onFile={(f) => void importVtt(f)}>
        <div className="sec-title">{t('editor.video.captions')}</div>
        <div className="row vd-pnav">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
            <Pencil aria-hidden="true" />
            {t('editor.video.editCaptions', { count: v.captions.length })}
          </button>
          {!readOnly && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              aria-controls="videofields-file"
              onClick={() => file.current?.click()}
            >
              <Upload aria-hidden="true" />
              {t('dropzone.import')}
            </button>
          )}
          <input
            ref={file}
            type="file"
            /* COMP-01 §5 : le champ reste dans la page, masqué à l'œil et relié à son bouton */
            id="videofields-file"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            accept=".vtt,text/vtt"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void importVtt(f);
            }}
          />
        </div>
        {!readOnly && <p className="help">{t('editor.video.vttFormat')}</p>}
        {vttError && (
          <p className="field-error" role="alert">
            {vttError}
          </p>
        )}
        {/* 066 : sous-titres automatiques (ElevenLabs), remplace l'entrée « Bientôt » */}
        {!readOnly && ws && step.video_path && (
          <AiCaptions
            ws={ws.id}
            lang={asSettings(editor.demo!.settings).locale ?? 'fr'}
            demoId={step.demo_id}
            stepId={step.id}
            source="video"
            durationMs={step.video_duration_ms ?? 0}
            label={t('ai.captions.open')}
            onResult={setAiCues}
          />
        )}
        <div className="setting">
          <span className="t-label" id={`${id}-cd`}>
            {t('editor.video.captionsDefault')}
          </span>
          <span className="switch">
            <input
              type="checkbox"
              role="switch"
              aria-labelledby={`${id}-cd`}
              disabled={readOnly}
              checked={v.captionsDefault}
              onChange={(e) => save({ captionsDefault: e.target.checked })}
            />
            <span />
          </span>
        </div>
      </DropBlock>
      <div className="sec">
        <div className="sec-title">{t('editor.video.playback')}</div>
        <div className="setting">
          <span className="t-label" id={`${id}-am`}>
            {t('editor.video.autoplayMuted')}
          </span>
          <span className="switch">
            <input
              type="checkbox"
              role="switch"
              aria-labelledby={`${id}-am`}
              disabled={readOnly}
              checked={v.autoplayMuted}
              onChange={(e) => save({ autoplayMuted: e.target.checked })}
            />
            <span />
          </span>
        </div>
        <div className="setting">
          <span className="t-label">{t('editor.video.voice')}</span>
          <span className="t-caption muted">
            {v.hasVoice
              ? t('editor.video.voiceYes', { time: mmss(step.video_duration_ms ?? 0) })
              : t('editor.video.voiceNo')}
          </span>
        </div>
      </div>
      {!readOnly && v.pauses.length > 0 && (
        <div className="sec">
          <div className="sec-title">{t('editor.video.convert')}</div>
          <button
            type="button"
            className="btn btn-secondary btn-sm btn-block"
            onClick={() =>
              void editor
                .convertVideo(step.id)
                .then((n) => n && toast(t('editor.video.converted', { count: n })))
            }
          >
            <Layers aria-hidden="true" />
            {t('editor.video.convertBtn', { count: v.pauses.length })}
          </button>
          <p className="help">{t('editor.video.convertHelp')}</p>
        </div>
      )}
      {dialog}
      {aiCues && (
        <CaptionsDialog
          ai
          language={aiCues.language}
          captions={aiCues.captions.slice(0, MAX_CAPTIONS)}
          readOnly={readOnly}
          onClose={() => setAiCues(null)}
          onSave={async (captions) => {
            // L30-11 : confirmation si la vidéo a déjà des sous-titres, puis « Annuler » dans le toast
            const before = v;
            if (
              v.captions.length &&
              !(await ask({
                title: t('ai.captions.replaceTitle'),
                body: t('ai.captions.replaceBody', { count: v.captions.length }),
                confirmLabel: t('ai.captions.replace'),
              }))
            )
              return false;
            save({ captions, captionsDefault: true });
            toast(t('ai.captions.applied'), {
              label: t('ai.undo'),
              durationMs: 8000,
              onClick: () =>
                live.current.updateStep(step.id, { video: before as unknown as StepRow['video'] }),
            });
          }}
        />
      )}
      {editing && (
        <CaptionsDialog
          captions={v.captions}
          readOnly={readOnly}
          onClose={() => setEditing(false)}
          onSave={(captions) => save({ captions })}
        />
      )}
    </>
  );
}

/** « Modifier (n) » : liste éditable des sous-titres (début, fin, texte), équivalent de la piste. */
function CaptionsDialog({
  captions,
  readOnly,
  onClose,
  onSave,
  ai = false,
  language,
}: {
  captions: VideoCaption[];
  readOnly: boolean;
  /** 066 : sous-titres proposés par l'Assistance IA, à relire avant l'enregistrement. */
  ai?: boolean;
  /** 066 : langue détectée par la transcription. */
  language?: string;
  onClose: () => void;
  /** false : enregistrement abandonné (la fenêtre reste ouverte). */
  onSave: (c: VideoCaption[]) => void | boolean | Promise<void | boolean>;
}) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const [rows, setRows] = useState(() =>
    captions.map((c) => ({ from: clockText(c.from), to: clockText(c.to), text: c.text })),
  );
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const set = (i: number, k: 'from' | 'to' | 'text', val: string) =>
    setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: val } : x)));
  async function submit() {
    const out: VideoCaption[] = [];
    for (const [i, r] of rows.entries()) {
      const from = parseClock(r.from);
      const to = parseClock(r.to);
      if (from === null || to === null || to <= from || !r.text.trim())
        return setErr(t('editor.video.captionInvalid', { n: i + 1 }));
      out.push({ from, to, text: r.text.trim().slice(0, 200) });
    }
    if ((await onSave(out.sort((a, b) => a.from - b.from))) === false) return;
    ref.current?.close();
  }
  return (
    <dialog ref={ref} className="mk vd-dialog" aria-labelledby={`${id}-t`} onClose={onClose}>
      <div className="modal-head">
        <h2 id={`${id}-t`}>{t('editor.video.captionsTitle')}</h2>
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-sm"
          aria-label={t('common.close')}
          onClick={() => ref.current?.close()}
        >
          <X aria-hidden="true" />
        </button>
      </div>
      <div className="modal-body">
        {ai && (
          <p className="ai-mention">
            <Sparkles aria-hidden="true" />
            {t('ai.mention')}
          </p>
        )}
        {ai && language && (
          <p className="t-caption muted">
            {t('ai.captions.language', { lang: languageName(language, i18n.language) })}
          </p>
        )}
        {rows.length === 0 && <p className="muted">{t('editor.video.noCaption')}</p>}
        <ol className="vd-caps">
          {rows.map((r, i) => (
            <li key={i}>
              <input
                className="input input-sm"
                aria-label={t('editor.video.capFrom', { n: i + 1 })}
                value={r.from}
                disabled={readOnly}
                onChange={(e) => set(i, 'from', e.target.value)}
              />
              <input
                className="input input-sm"
                aria-label={t('editor.video.capTo', { n: i + 1 })}
                value={r.to}
                disabled={readOnly}
                onChange={(e) => set(i, 'to', e.target.value)}
              />
              <input
                className="input input-sm"
                aria-label={t('editor.video.capText', { n: i + 1 })}
                maxLength={200}
                value={r.text}
                disabled={readOnly}
                onChange={(e) => set(i, 'text', e.target.value)}
              />
              {!readOnly && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-icon"
                  aria-label={t('editor.video.capDelete', { n: i + 1 })}
                  onClick={() => setRows((x) => x.filter((_, j) => j !== i))}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ol>
        {!readOnly && rows.length < MAX_CAPTIONS && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              const last = rows[rows.length - 1];
              const start = last ? (parseClock(last.to) ?? 0) : 0;
              setRows((x) => [...x, { from: clockText(start), to: clockText(start + 2000), text: '' }]);
            }}
          >
            <Plus aria-hidden="true" />
            {t('editor.video.addCaption')}
          </button>
        )}
        {err && (
          <p className="help is-error" role="alert">
            {err}
          </p>
        )}
      </div>
      <div className="modal-foot">
        <button type="button" className="btn btn-secondary" onClick={() => ref.current?.close()}>
          {ai ? t('ai.ignore') : t('common.cancel')}
        </button>
        {!readOnly && (
          <button type="button" className="btn btn-primary" onClick={() => void submit()}>
            {ai ? t('ai.apply') : t('common.save')}
          </button>
        )}
      </div>
    </dialog>
  );
}
