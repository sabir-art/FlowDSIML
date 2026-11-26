import { DropBlock, UploadBar } from '../../../components/DropBlock';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Captions,
  Download,
  Ellipsis,
  Info,
  MessageSquare,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import { Select, Switch } from '@flowdsiml/ui';
import { Menu } from '../../../components/Menu';
import { aiBlock, useAiStatus } from '../../../lib/ai';
import { VoiceGenerate } from './VoiceGenerate';
import { AudioLine, Wave } from './AudioLine';
import { AiCaptions, TranscriptPreview } from '../../../components/ai/AiAudio';
import { useToast } from '../../../components/Toast';
import { useWorkspace } from '../../../workspace/WorkspaceProvider';
import { asSettings } from '../types';
import { supabase } from '../../../lib/supabase';
import { useConfirm } from '../../../components/ConfirmDialog';
import type { DemoEditor } from '../useDemoEditor';
import type { StepRow } from '../types';
import { VOICE_ACCEPT, VOICE_MAX_BYTES, VOICE_MAX_MS, bubbleText, formatClock, voiceExt } from './voice';

type Rec = { state: 'recording' | 'paused'; ms: number };

type Source = 'generate' | 'record' | 'import';
const SOURCES: Source[] = ['generate', 'record', 'import'];
const FLAT = Array.from({ length: 22 }, () => 4);

/**
 * EXT-02 §6.4 : « Voix off » dans le panneau de 320 px. Une piste par étape, 2 min et 5 Mo au plus.
 *  - Sans voix : segmenté « Générer », « Enregistrer », « Importer ». Un enregistrement s'écoute avant d'être
 *    gardé (« Recommencer », « Garder »).
 *  - Voix en place : carte avec son lecteur, « Remplacer… » (rouvre le segmenté) et un menu (« Télécharger »,
 *    « Supprimer la voix ») ; dessous la transcription, obligatoire pour publier.
 *  - « Pour toute la démo » : lecture automatique, sous-titres affichés, lecteur audio.
 */
export function VoiceFields({
  editor,
  step,
  readOnly,
  chain = false,
}: {
  editor: DemoEditor;
  step: StepRow;
  readOnly: boolean;
  /** L38-10 : après un enregistrement, « Étape suivante » pour enregistrer à la suite. */
  chain?: boolean;
}) {
  const { current: ws } = useWorkspace();
  const { t } = useTranslation();
  const demoVoice = asSettings(editor.demo?.settings).voice ?? {};
  const [dialog, ask] = useConfirm();
  const [url, setUrl] = useState<string | null>(null);
  const [rec, setRec] = useState<Rec | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** MEDIA-01 §18.2 : envoi d'un fichier importé (bouton « Envoi… » et barre). */
  const [sending, setSending] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [source, setSource] = useState<Source | null>(null);
  /** Enregistrement terminé, à écouter avant de le garder */
  const [take, setTake] = useState<{ blob: Blob; ms: number; url: string } | null>(null);
  /** Onde de l'enregistrement en cours (niveaux du micro) */
  const [levels, setLevels] = useState<number[]>(FLAT);
  const meter = useRef<{ ctx: AudioContext; raf: number } | null>(null);
  const { status: ai } = useAiStatus(ws?.id);
  const toast = useToast();
  // Les « Annuler » des toasts agissent après d'autres rendus : toujours l'éditeur courant
  const live = useRef(editor);
  live.current = editor;
  const [heard, setHeard] = useState<{ text: string; language: string } | null>(null);
  useEffect(() => {
    setHeard(null);
    setSource(null);
    setTake((k) => {
      if (k) URL.revokeObjectURL(k.url);
      return null;
    });
  }, [step.id]);
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
    if (meter.current) {
      cancelAnimationFrame(meter.current.raf);
      void meter.current.ctx.close().catch(() => undefined);
      meter.current = null;
    }
    setLevels(FLAT);
  }

  /** Onde en direct : niveau du micro, une barre toutes les 120 ms (figée si l'animation est réduite). */
  function watch(stream: MediaStream) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try {
      const ctx = new AudioContext();
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      let last = 0;
      const loop = (now: number) => {
        if (!meter.current) return;
        if (now - last > 120 && media.current?.state === 'recording') {
          last = now;
          an.getByteTimeDomainData(buf);
          let peak = 0;
          for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
          setLevels((l) => [...l.slice(1), 4 + Math.min(16, Math.round((peak / 128) * 40))]);
        }
        meter.current.raf = requestAnimationFrame(loop);
      };
      meter.current = { ctx, raf: requestAnimationFrame(loop) };
    } catch {
      /* pas d'analyse du son : l'onde reste plate */
    }
  }

  async function store(blob: Blob, durationMs: number, from: 'record' | 'import') {
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
        // Voix enregistrée ou importée : plus de repère « IA »
        // Nouvelle voix : elle suit le réglage « Lecture automatique » de la démo
        voice_autoplay: demoVoice.autoplay !== false,
        options: {
          ...((step.options ?? {}) as Record<string, unknown>),
          aiVoice: undefined,
          voiceSource: from,
        },
      });
      if (old) void supabase.storage.from('voices').remove([old]);
      setSource(null);
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
      // EXT-02 §6.4 : on écoute avant de garder
      const blob = new Blob(chunks.current, { type: 'audio/webm' });
      setTake({ blob, ms: Math.min(ms, VOICE_MAX_MS), url: URL.createObjectURL(blob) });
    };
    clock.current = { started: Date.now(), acc: 0, timer: null };
    mr.start(250);
    watch(stream);
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
    setSending(true);
    try {
      await store(f, ms, 'import');
    } finally {
      setSending(false);
    }
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
    editor.updateStep(step.id, {
      voice_path: null,
      voice_duration_ms: null,
      options: { ...((step.options ?? {}) as Record<string, unknown>), aiVoice: undefined },
    });
    void supabase.storage.from('voices').remove([old]);
  }

  const settings = asSettings(editor.demo!.settings);
  const lang = settings.locale ?? 'fr';
  const opts = (step.options ?? {}) as Record<string, unknown>;
  const generated = !!opts.aiVoice;
  // Assistance IA coupée pour l'espace (ou rôle sans droit) : « Générer » reste visible, grisé, avec la raison
  const aiOff = aiBlock(ai, 'voice');
  const genOff = aiOff === 'disabled' || aiOff === 'role';
  // 065 (L30-10) : voix de synthèse (ElevenLabs) à partir de la transcription, sinon du texte de la bulle
  const aiVoice =
    ws && !readOnly ? (
      <VoiceGenerate
        key={step.id}
        ws={ws.id}
        lang={lang}
        stepId={step.id}
        initialText={step.voice_transcript?.trim() || bubbleText(step, editor.hotspots)}
        variables={editor.variables.map((v) => ({ key: v.key, default_value: v.default_value ?? '' }))}
        savedVoice={settings.aiVoice}
        hasRecording={!!step.voice_path && !generated}
        onRememberVoice={(v) =>
          v !== settings.aiVoice && editor.updateDemo({ settings: { ...settings, aiVoice: v } })
        }
        onApply={(r) => {
          const before = {
            voice_path: step.voice_path,
            voice_duration_ms: step.voice_duration_ms,
            voice_transcript: step.voice_transcript,
            options: { ...opts, aiVoice: opts.aiVoice || undefined } as StepRow['options'],
          };
          editor.updateStep(step.id, {
            voice_path: r.path,
            voice_duration_ms: Math.max(1, Math.round(r.durationMs)),
            voice_transcript: r.transcript,
            voice_autoplay: demoVoice.autoplay !== false,
            // L62 §6 : nom de la voix, pour la carte « Voix en place » (« Générée · Antoine · 0:11 »)
            options: { ...opts, aiVoice: true, aiVoiceName: r.voiceName, voiceSource: undefined },
          });
          setSource(null);
          // L'ancien fichier n'est retiré qu'une fois l'annulation impossible
          let undone = false;
          toast(t('ai.voice.applied'), {
            label: t('ai.undo'),
            durationMs: 8000,
            onClick: () => {
              undone = true;
              live.current.updateStep(step.id, before);
              void supabase.storage.from('voices').remove([r.path]);
            },
          });
          if (before.voice_path)
            window.setTimeout(() => {
              if (!undone) void supabase.storage.from('voices').remove([before.voice_path!]);
            }, 9000);
        }}
      />
    ) : null;
  const has = !!step.voice_path;
  const missing = has && !step.voice_transcript?.trim();
  // L62 §6 : la source est toujours visible (hors lecture seule) ; changer d'onglet ne supprime rien
  const choosing = !readOnly;
  const kind = generated
    ? 'generated'
    : opts.voiceSource === 'import' ||
        (opts.voiceSource !== 'record' && !/\.webm$/.test(step.voice_path ?? ''))
      ? 'imported'
      : 'recorded';
  /** Onglet de la voix en place (point vert), et onglet ouvert : celui de la voix en place par défaut. */
  const placed: Source | null = has
    ? kind === 'generated'
      ? 'generate'
      : kind === 'recorded'
        ? 'record'
        : 'import'
    : null;
  const tab: Source = source ?? placed ?? (genOff ? 'record' : 'generate');
  const discardTake = () =>
    setTake((k) => {
      if (k) URL.revokeObjectURL(k.url);
      return null;
    });

  /** Réglage de la démo ; « Lecture automatique » s'applique aussi aux voix déjà en place. */
  const setDemoVoice = (patch: NonNullable<typeof settings.voice>) => {
    editor.updateDemo({ settings: { ...settings, voice: { ...demoVoice, ...patch } } });
    if (patch.autoplay !== undefined)
      for (const st of editor.steps)
        if (st.voice_path && (st.voice_autoplay !== false) !== patch.autoplay)
          editor.updateStep(st.id, { voice_autoplay: patch.autoplay });
  };
  const autoplay = demoVoice.autoplay ?? step.voice_autoplay !== false;

  async function download() {
    if (!url || !step.voice_path) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `voix-etape.${step.voice_path.split('.').pop()}`;
    a.rel = 'noopener';
    document.body.append(a);
    a.click();
    a.remove();
  }

  // L62 §6 : « Enregistrée · 0:12 », « Générée · Antoine · 0:11 », « Fichier · 0:20 »
  const placedLine = [
    t(`editor.voice.short.${kind}`),
    generated && typeof opts.aiVoiceName === 'string' ? opts.aiVoiceName : '',
    formatClock(step.voice_duration_ms ?? 0),
  ]
    .filter(Boolean)
    .join(' · ');
  const fullCard = (
    <div className="vo-card">
      <div className="vo-card__head">
        {/* L62 §6 : icône de la source (Fichier, Enregistrée, Générée) */}
        <span className="vo-card__icon" aria-hidden="true">
          {kind === 'imported' ? <Upload /> : kind === 'recorded' ? <Mic /> : <Sparkles />}
        </span>
        <div className="vo-card__txt">
          <b>{t('editor.voice.inPlace')}</b>
          <span className="muted">{placedLine}</span>
        </div>
        {!readOnly && (
          <Menu
            label={t('editor.voice.more')}
            icon={<Ellipsis />}
            items={[
              { label: t('editor.voice.download'), icon: <Download />, onSelect: () => void download() },
              'separator',
              {
                label: t('editor.voice.removeLabel'),
                icon: <Trash2 />,
                danger: true,
                onSelect: () => void remove(),
              },
            ]}
          />
        )}
      </div>
      <AudioLine
        src={url}
        durationMs={step.voice_duration_ms ?? 0}
        label={t('editor.voice.listen')}
        pauseLabel={t('editor.voice.pause')}
      />
    </div>
  );
  // Dans un autre onglet : une ligne de 44 px, Lecture en tête, « Voix en place » et sa source sur deux
  // lignes, durée à droite (le point vert reste sur l'onglet)
  const miniCard = (
    <div className="vo-mini" aria-label={t('editor.voice.inPlace')} role="group">
      <AudioLine
        src={url}
        durationMs={step.voice_duration_ms ?? 0}
        label={t('editor.voice.listen')}
        pauseLabel={t('editor.voice.pause')}
        middle={
          <span className="vo-mini__txt">
            <b>{t('editor.voice.inPlace')}</b>
            <span>{placedLine.replace(/ · \d+:\d{2}$/, '')}</span>
          </span>
        }
      />
    </div>
  );

  return (
    // MEDIA-01 §18.2 : un fichier audio déposé n'importe où sur le bloc est importé
    <DropBlock
      className="sec voice-sec"
      disabled={readOnly || busy || !!rec || !!take}
      onFile={(f) => void importFile(f)}
    >
      {dialog}
      <div className="sec-title">{t('editor.voice.title')}</div>
      <span className="sr-only" aria-live="polite">
        {announce}
      </span>

      {has && !choosing && fullCard}
      {choosing && (
        <>
          <span className="vo-label vo-src-label" id={`vo-src-${step.id}`}>
            {t('editor.voice.source')}
          </span>
          <div className="fd-segmented vo-tabs" role="tablist" aria-labelledby={`vo-src-${step.id}`}>
            {SOURCES.map((k) => {
              const off = k === 'generate' && genOff;
              return (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  id={`vo-tab-${k}`}
                  aria-selected={tab === k}
                  aria-controls="vo-panel"
                  aria-disabled={off || undefined}
                  aria-describedby={off ? 'vo-gen-off' : undefined}
                  // Recette UX : la raison en infobulle de l'onglet grisé, plus une ligne sous le segmenté
                  data-tip={off ? t('editor.voice.generateOff') : undefined}
                  tabIndex={tab === k ? 0 : -1}
                  disabled={!!rec || busy}
                  onClick={() => !off && setSource(k)}
                  onKeyDown={(e) => {
                    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                    e.preventDefault();
                    // Les flèches changent d'onglet, pas d'étape (raccourci de l'éditeur)
                    e.stopPropagation();
                    const list = SOURCES.filter((x) => !(x === 'generate' && genOff));
                    const n =
                      list[
                        (list.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length
                      ]!;
                    setSource(n);
                    document.getElementById(`vo-tab-${n}`)?.focus();
                  }}
                >
                  {t(`editor.voice.tab.${k}`)}
                  {placed === k && (
                    <span className="vo-dot" title={t('editor.voice.inPlace')}>
                      <span className="sr-only">{` (${t('editor.voice.inPlace')})`}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {genOff && (
            <p className="sr-only" id="vo-gen-off">
              {t('editor.voice.generateOff')}
            </p>
          )}
          {has && (tab === placed ? fullCard : miniCard)}
          <div id="vo-panel" role="tabpanel" aria-labelledby={`vo-tab-${tab}`} className="vo-panel">
            {tab === 'generate' && aiVoice}
            {tab === 'record' &&
              (take ? (
                <>
                  <div>
                    <span className="vo-label" id="vo-take">
                      {t('editor.voice.listenFirst')}
                    </span>
                    <AudioLine
                      src={take.url}
                      durationMs={take.ms}
                      label={t('editor.voice.listen')}
                      pauseLabel={t('editor.voice.pause')}
                    />
                  </div>
                  <div className="vo-two">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={busy}
                      onClick={() => {
                        discardTake();
                        void start();
                      }}
                    >
                      <RotateCcw aria-hidden="true" />
                      {t('editor.voice.again')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busy}
                      onClick={() => {
                        const k = take;
                        void store(k.blob, k.ms, 'record').then(discardTake);
                      }}
                    >
                      {t('editor.voice.keep')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className="vo-aud vo-aud--rec"
                    role="group"
                    aria-label={rec ? t('editor.voice.recording') : t('editor.voice.tab.record')}
                  >
                    {rec ? (
                      <button
                        type="button"
                        className="vo-play is-stop"
                        aria-label={t('editor.voice.stop')}
                        onClick={finish}
                      >
                        <Square aria-hidden="true" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="vo-play"
                        aria-label={t('editor.voice.startRec')}
                        disabled={busy}
                        onClick={() => void start()}
                      >
                        <Mic aria-hidden="true" />
                      </button>
                    )}
                    <Wave levels={levels} played={rec ? 1 : 0} />
                    <span className="vo-time">{formatClock(rec?.ms ?? 0)}</span>
                    {rec && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-icon"
                        aria-label={
                          rec.state === 'paused' ? t('editor.voice.resume') : t('editor.voice.pause')
                        }
                        onClick={pause}
                      >
                        {rec.state === 'paused' ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
                      </button>
                    )}
                  </div>
                  <p className="help">{t('editor.voice.recHelp')}</p>
                </>
              ))}
            {tab === 'import' && (
              <div className="vo-import">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={busy}
                  aria-controls="voicefields-file"
                  onClick={() => file.current?.click()}
                >
                  <Upload aria-hidden="true" />
                  {sending ? t('dropzone.sendingShort') : t('dropzone.import')}
                </button>
                {sending && <UploadBar label={t('editor.voice.sending')} />}
                <span className="help">{t('editor.voice.importHelp')}</span>
              </div>
            )}
          </div>
        </>
      )}
      {err && (
        <p className="field-error" role="alert">
          {err}
        </p>
      )}

      {has && (
        <div className="field">
          <label htmlFor={`voice-tr-${step.id}`}>
            {generated ? t('editor.voice.readText') : t('editor.voice.transcript')}{' '}
            <span className="vo-opt">
              {generated ? t('editor.voice.readTextNote') : t('editor.voice.transcriptNote')}
            </span>
          </label>
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
          {/* 066 (L30-11) : transcription automatique d'une voix enregistrée */}
          {ws && !readOnly && !generated && !heard && (
            <AiCaptions
              ws={ws.id}
              lang={lang}
              demoId={step.demo_id}
              stepId={step.id}
              source="voice"
              durationMs={step.voice_duration_ms ?? 0}
              label={t('ai.captions.voiceOpen')}
              onResult={(r) => setHeard({ text: r.text, language: r.language })}
            />
          )}
          {heard && (
            <TranscriptPreview
              text={heard.text}
              language={heard.language}
              onIgnore={() => setHeard(null)}
              onApply={() => {
                const before = step.voice_transcript;
                editor.updateStep(step.id, { voice_transcript: heard.text.slice(0, 4000) });
                setHeard(null);
                toast(t('ai.captions.transcriptApplied'), {
                  label: t('ai.undo'),
                  durationMs: 8000,
                  onClick: () => live.current.updateStep(step.id, { voice_transcript: before }),
                });
              }}
            />
          )}
          {missing && (
            <span className="field-error" role="alert">
              {t('editor.voice.transcriptMissing')}
            </span>
          )}
        </div>
      )}

      {/* Réglages de la voix pour toute la démo (pas seulement cette étape) */}
      <div className="vo-demo" role="group" aria-labelledby="vo-demo-t">
        <p className="vo-demo__t" id="vo-demo-t">
          {t('editor.voice.forDemo')}
        </p>
        <div className="vo-rows">
          <Switch
            className="vo-row"
            label={
              <span className="vo-row__k">
                <Volume2 aria-hidden="true" />
                {t('editor.voice.autoplayDemo')}
              </span>
            }
            checked={autoplay}
            disabled={readOnly}
            onChange={(e) => setDemoVoice({ autoplay: e.target.checked })}
          />
          <Switch
            className="vo-row"
            label={
              <span className="vo-row__k">
                <Captions aria-hidden="true" />
                {t('editor.voice.captionsDemo')}
              </span>
            }
            checked={demoVoice.captions !== false}
            disabled={readOnly}
            onChange={(e) => setDemoVoice({ captions: e.target.checked })}
          />
          <div className="vo-row">
            <span className="vo-row__k" id="vo-player-l">
              <MessageSquare aria-hidden="true" />
              {t('editor.voice.playerDemo')}
            </span>
            <span className="vo-row__v">
              <Select
                size="sm"
                aria-labelledby="vo-player-l"
                value={demoVoice.player ?? 'bubble'}
                disabled={readOnly}
                onChange={(e) => setDemoVoice({ player: e.target.value === 'bar' ? 'bar' : 'bubble' })}
                options={[
                  { value: 'bubble', label: t('editor.voice.playerBubble') },
                  { value: 'bar', label: t('editor.voice.playerBar') },
                ]}
              />
            </span>
          </div>
        </div>
      </div>
      <div className="vo-info" role="note">
        <Info aria-hidden="true" />
        <span>{t('editor.voice.soundNote')}</span>
      </div>

      {chain && has && !rec && !readOnly && editor.steps[editor.steps.length - 1]?.id !== step.id && (
        <button
          type="button"
          className="btn btn-ghost btn-sm voice-next"
          onClick={() => window.dispatchEvent(new Event('fd:next-step'))}
        >
          {t('editor.voice.nextStep')}
          <ArrowRight aria-hidden="true" />
        </button>
      )}
      <input
        ref={file}
        type="file"
        /* COMP-01 §5 : le champ reste dans la page, masqué à l'œil et relié à son bouton */
        id="voicefields-file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        accept={VOICE_ACCEPT}
        aria-label={t('dropzone.import')}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void importFile(f);
        }}
      />
    </DropBlock>
  );
}
