import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, Pause, Play, Square, Upload } from 'lucide-react';
import { AiVoice } from '../../../components/ai/AiAudio';
import { useWorkspace } from '../../../workspace/WorkspaceProvider';
import { asSettings } from '../types';
import { supabase } from '../../../lib/supabase';
import { useConfirm } from '../../../components/ConfirmDialog';
import type { DemoEditor } from '../useDemoEditor';
import type { StepRow } from '../types';
import { VOICE_ACCEPT, VOICE_MAX_BYTES, VOICE_MAX_MS, bubbleText, formatClock, voiceExt } from './voice';

type Rec = { state: 'recording' | 'paused'; ms: number };

/**
 * L28-02 : section « Voix off » de l'onglet Étape. Une piste par étape (micro ou fichier), 2 min et 5 Mo au
 * plus ; transcription obligatoire pour publier (préremplie avec le texte de la bulle) ; « Générer à partir
 * du texte » reste en « Bientôt ».
 */
export function VoiceFields({
  editor,
  step,
  readOnly,
}: {
  editor: DemoEditor;
  step: StepRow;
  readOnly: boolean;
}) {
  const { current: ws } = useWorkspace();
  const { t } = useTranslation();
  const [dialog, ask] = useConfirm();
  const [url, setUrl] = useState<string | null>(null);
  const [rec, setRec] = useState<Rec | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [announce, setAnnounce] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const media = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const clock = useRef<{ started: number; acc: number; timer: number | null }>({
    started: 0,
    acc: 0,
    timer: null,
  });

  useEffect(() => {
    let live = true;
    setUrl(null);
    if (step.voice_path)
      void supabase.storage
        .from('voices')
        .createSignedUrl(step.voice_path, 3600)
        .then(({ data }) => live && setUrl(data?.signedUrl ?? null));
    return () => {
      live = false;
    };
  }, [step.voice_path]);
  // Arrêt propre si l'étape change pendant un enregistrement
  useEffect(() => () => stopTracks(), [step.id]);

  function stopTracks() {
    if (clock.current.timer) window.clearInterval(clock.current.timer);
    clock.current.timer = null;
    media.current?.stream.getTracks().forEach((tr) => tr.stop());
  }

  async function store(blob: Blob, durationMs: number) {
    const ext = voiceExt(blob.type);
    if (!ext) return setErr(t('editor.voice.badType'));
    if (blob.size > VOICE_MAX_BYTES) return setErr(t('editor.voice.tooBig'));
    if (durationMs > VOICE_MAX_MS) return setErr(t('editor.voice.tooLong'));
    setBusy(true);
    setErr(null);
    try {
      const path = `${step.workspace_id}/${step.demo_id}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from('voices').upload(path, blob, { contentType: blob.type });
      if (up.error) throw up.error;
      const old = step.voice_path;
      editor.updateStep(step.id, {
        voice_path: path,
        voice_duration_ms: Math.max(1, Math.round(durationMs)),
        voice_transcript: step.voice_transcript?.trim()
          ? step.voice_transcript
          : bubbleText(step, editor.hotspots),
      });
      if (old) void supabase.storage.from('voices').remove([old]);
    } catch {
      setErr(t('editor.voice.uploadError'));
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    setErr(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return setErr(t('editor.voice.micBlocked'));
    }
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    const mr = new MediaRecorder(stream, { mimeType: mime });
    media.current = mr;
    chunks.current = [];
    mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    mr.onstop = () => {
      const ms = elapsed();
      stopTracks();
      setRec(null);
      void store(new Blob(chunks.current, { type: 'audio/webm' }), Math.min(ms, VOICE_MAX_MS));
    };
    clock.current = { started: Date.now(), acc: 0, timer: null };
    mr.start(250);
    setRec({ state: 'recording', ms: 0 });
    clock.current.timer = window.setInterval(tick, 250);
  }
  const elapsed = () =>
    clock.current.acc + (media.current?.state === 'recording' ? Date.now() - clock.current.started : 0);
  function tick() {
    const ms = elapsed();
    setRec((r) => (r ? { ...r, ms } : r));
    // Minuteur annoncé toutes les 30 s, sans plus
    const s = Math.floor(ms / 1000);
    if (s > 0 && s % 30 === 0) setAnnounce(t('editor.voice.elapsed', { time: formatClock(s * 1000) }));
    if (ms >= VOICE_MAX_MS) finish();
  }
  function pause() {
    const mr = media.current;
    if (!mr) return;
    if (mr.state === 'recording') {
      clock.current.acc += Date.now() - clock.current.started;
      mr.pause();
      setRec((r) => (r ? { ...r, state: 'paused' } : r));
    } else if (mr.state === 'paused') {
      clock.current.started = Date.now();
      mr.resume();
      setRec((r) => (r ? { ...r, state: 'recording' } : r));
    }
  }
  function finish() {
    const mr = media.current;
    if (mr && mr.state !== 'inactive') {
      if (mr.state === 'recording') clock.current.acc += Date.now() - clock.current.started;
      clock.current.started = Date.now();
      mr.stop();
    }
  }

  async function importFile(f: File) {
    const ms = await new Promise<number>((resolve) => {
      const a = new Audio();
      a.preload = 'metadata';
      a.onloadedmetadata = () => resolve(Number.isFinite(a.duration) ? a.duration * 1000 : NaN);
      a.onerror = () => resolve(NaN);
      a.src = URL.createObjectURL(f);
    });
    if (!Number.isFinite(ms)) return setErr(t('editor.voice.badType'));
    await store(f, ms);
  }

  async function remove() {
    const ok = await ask({
      title: t('editor.voice.removeTitle'),
      body: t('editor.voice.removeBody'),
      confirmLabel: t('editor.voice.remove'),
      danger: true,
    });
    if (!ok || !step.voice_path) return;
    const old = step.voice_path;
    editor.updateStep(step.id, { voice_path: null, voice_duration_ms: null });
    void supabase.storage.from('voices').remove([old]);
  }

  // 065 : voix de synthèse (ElevenLabs) à partir de la transcription, sinon du texte de la bulle
  const aiVoice =
    ws && !readOnly ? (
      <AiVoice
        ws={ws.id}
        lang={asSettings(editor.demo!.settings).locale ?? 'fr'}
        stepId={step.id}
        text={step.voice_transcript?.trim() || bubbleText(step, editor.hotspots)}
        onApply={(r) => {
          const old = step.voice_path;
          editor.updateStep(step.id, {
            voice_path: r.path,
            voice_duration_ms: Math.max(1, Math.round(r.durationMs)),
            voice_transcript: r.transcript,
          });
          if (old) void supabase.storage.from('voices').remove([old]);
        }}
      />
    ) : null;
  const has = !!step.voice_path;
  const missing = has && !step.voice_transcript?.trim();
  return (
    <div className="sec voice-sec">
      {dialog}
      <div className="sec-title">{t('editor.voice.title')}</div>
      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
      {rec ? (
        <div className="voice-rec" role="group" aria-label={t('editor.voice.recording')}>
          <span className={`voice-dot${rec.state === 'paused' ? ' is-paused' : ''}`} aria-hidden="true" />
          <span className="t-mono voice-clock">
            {formatClock(rec.ms)} / {formatClock(VOICE_MAX_MS)}
          </span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={pause}>
            {rec.state === 'paused' ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
            {rec.state === 'paused' ? t('editor.voice.resume') : t('editor.voice.pause')}
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={finish}>
            <Square aria-hidden="true" />
            {t('editor.voice.finish')}
          </button>
        </div>
      ) : has ? (
        <>
          {url ? (
            <audio
              className="voice-player"
              controls
              preload="metadata"
              src={url}
              aria-label={t('editor.voice.player')}
            />
          ) : (
            <div className="voice-player is-loading" />
          )}
          {!readOnly && (
            <div className="row wrap voice-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy}
                onClick={() => void start()}
              >
                <Mic aria-hidden="true" />
                {t('editor.voice.rerecord')}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy}
                onClick={() => file.current?.click()}
              >
                <Upload aria-hidden="true" />
                {t('editor.voice.replace')}
              </button>
              {aiVoice}
              <button
                type="button"
                className="btn btn-ghost btn-sm voice-del"
                disabled={busy}
                onClick={() => void remove()}
              >
                {t('editor.voice.remove')}
              </button>
            </div>
          )}
          <label className="check voice-auto">
            <input
              type="checkbox"
              checked={step.voice_autoplay !== false}
              disabled={readOnly}
              onChange={(e) => editor.updateStep(step.id, { voice_autoplay: e.target.checked })}
            />
            {t('editor.voice.autoplay')}
          </label>
          <div className="field">
            <label htmlFor={`voice-tr-${step.id}`}>{t('editor.voice.transcript')}</label>
            <textarea
              id={`voice-tr-${step.id}`}
              className="textarea"
              rows={3}
              maxLength={4000}
              readOnly={readOnly}
              value={step.voice_transcript ?? ''}
              aria-describedby={`voice-tr-h-${step.id}`}
              aria-invalid={missing || undefined}
              onChange={(e) => editor.updateStep(step.id, { voice_transcript: e.target.value })}
            />
            <span className="help" id={`voice-tr-h-${step.id}`}>
              {t('editor.voice.transcriptHelp')}
            </span>
            {missing && (
              <span className="field-error" role="alert">
                {t('editor.voice.transcriptMissing')}
              </span>
            )}
          </div>
        </>
      ) : (
        !readOnly && (
          <>
            <div className="row wrap voice-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy}
                onClick={() => void start()}
              >
                <Mic aria-hidden="true" />
                {t('editor.voice.record')}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy}
                onClick={() => file.current?.click()}
              >
                <Upload aria-hidden="true" />
                {t('editor.voice.import')}
              </button>
            </div>
            {aiVoice}
            <p className="help">{t('editor.voice.help')}</p>
          </>
        )
      )}
      {err && (
        <p className="field-error" role="alert">
          {err}
        </p>
      )}
      <input
        ref={file}
        type="file"
        hidden
        accept={VOICE_ACCEPT}
        aria-label={t('editor.voice.import')}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void importFile(f);
        }}
      />
    </div>
  );
}
