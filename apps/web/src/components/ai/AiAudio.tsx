import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Info, Play, Sparkles, WandSparkles, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  AiRequestError,
  aiBlock,
  audioLeft,
  callAi,
  formatSeconds,
  useAiStatus,
  type AiStatus,
} from '../../lib/ai';
import { DisabledEntry, useBlockText } from './AiWrite';
import './ai.css';

type AudioFeature = 'voice' | 'captions';

/** Voix proposées (mêmes identifiants que le serveur), avec nom et description (spec L30b §3). */
export const VOICE_CHOICES = ['claire', 'louise', 'sarah', 'antoine', 'adam', 'daniel'] as const;
export type VoiceChoice = (typeof VOICE_CHOICES)[number];
export const SPEED_CHOICES = ['slow', 'normal', 'fast'] as const;
export type SpeedChoice = (typeof SPEED_CHOICES)[number];
const SPEED_VALUE: Record<SpeedChoice, number> = { slow: 0.85, normal: 1, fast: 1.15 };
export const TTS_MAX_CHARS = 1000;
export const STT_MAX_S = 120;

/** Même calcul que le serveur : environ 14 caractères par seconde à vitesse normale. */
export const estimateSeconds = (text: string, speed: SpeedChoice = 'normal') =>
  Math.min(120, Math.max(1, Math.ceil(text.trim().length / 14 / SPEED_VALUE[speed])));

/** Variables lues avec leur valeur par défaut ({{company}}, ou le repli de {{company|repli}}). */
export function withDefaults(text: string, variables: Array<{ key: string; default_value: string }>): string {
  return text.replace(/\{\{\s*([\w.-]+)\s*(?:\|([^}]*))?\}\}/g, (_, k: string, fb?: string) => {
    const v = variables.find((x) => x.key === k);
    return (v?.default_value || fb || '').trim();
  });
}

/** Nom de la langue détectée (code ISO renvoyé par la transcription), dans la langue de l'interface. */
export function languageName(code: string, ui: string): string {
  if (!code) return '';
  try {
    const n = new Intl.DisplayNames([ui], { type: 'language' }).of(code);
    return n ? n.charAt(0).toLocaleUpperCase(ui) + n.slice(1) : code;
  } catch {
    return code;
  }
}

/** Messages de la spec L30b §5 : désactivé, quota atteint, demande plus longue que le reste. */
function useAudioText() {
  const { t, i18n } = useTranslation();
  const blockText = useBlockText();
  const date = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(iso));
  const quota = (f: AudioFeature, s: AiStatus | null) => {
    const q = f === 'voice' ? s?.ttsQuota : s?.sttQuota;
    return [
      t(`ai.audio.quota_${f}`, { quota: q ?? 0 }),
      s?.renewsOn ? t('ai.quotaRenews', { date: date(s.renewsOn) }) : '',
    ]
      .filter(Boolean)
      .join(' ');
  };
  return {
    disabled: (f: AudioFeature) => t(`ai.audio.disabled_${f}`),
    quota,
    /** Blocage avant envoi : quota audio de la fonction, sinon message commun (règle 4). */
    block: (f: AudioFeature, s: AiStatus | null) => {
      const b = aiBlock(s, f);
      if (b === 'quota' && audioLeft(s, f) === 0) return quota(f, s);
      return b ? blockText(b, s) : '';
    },
    over: (left: number, need: number) => t('ai.audio.over', { left, need }),
    error: (e: unknown, f: AudioFeature, s: AiStatus | null) => {
      if (e instanceof AiRequestError) {
        if (e.code === 'AI_QUOTA_AUDIO') return quota(f, s);
        if (e.code === 'AI_QUOTA_WORKSPACE') return blockText('quota', s);
        if (e.code === 'AI_QUOTA_USER') return blockText('userQuota', s);
        if (e.code === 'AI_DISABLED') return t(`ai.audio.disabled_${f}`);
        if (e.code === 'PII_IN_TEXT') return t('ai.voice.pii');
        if (e.code === 'TOO_LONG' || e.code === 'TOO_LONG_TEXT')
          return f === 'voice' ? t('ai.voice.tooLong') : t('ai.captions.tooLong');
      }
      return t('ai.error');
    },
  };
}

function ConfirmModal({
  title,
  body,
  confirm,
  onConfirm,
  onCancel,
  children,
}: {
  title: string;
  body?: string;
  confirm: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return createPortal(
    <div className="mk">
      <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onCancel()}>
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="ai-cf-t">
          <div className="modal-head">
            <h2 id="ai-cf-t">{title}</h2>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              aria-label={t('common.close')}
              onClick={onCancel}
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <div className="modal-body stack">
            {body && <p>{body}</p>}
            {children}
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-primary" autoFocus onClick={onConfirm}>
              {confirm}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * 065 Voix de synthèse (L30-10) : texte à lire modifiable (variables lues avec leur valeur par
 * défaut), 6 voix avec extrait, vitesse, durée estimée, avertissement, aperçu, Appliquer ou Ignorer.
 */
export function AiVoice({
  ws,
  lang,
  stepId,
  initialText,
  variables,
  savedVoice,
  hasRecording,
  onRememberVoice,
  onApply,
}: {
  ws: string;
  lang: string;
  stepId: string;
  /** Transcription de l'étape, sinon texte de la bulle. */
  initialText: string;
  variables: Array<{ key: string; default_value: string }>;
  /** Voix mémorisée pour la démo (demo.settings). */
  savedVoice?: string;
  /** Une voix enregistrée existe : confirmation avant de la remplacer. */
  hasRecording: boolean;
  onRememberVoice: (v: VoiceChoice) => void;
  onApply: (r: { path: string; durationMs: number; transcript: string }) => void;
}) {
  const { t } = useTranslation();
  const at = useAudioText();
  const { status } = useAiStatus(ws);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(initialText);
  const [voice, setVoice] = useState<VoiceChoice>(
    (VOICE_CHOICES as readonly string[]).includes(savedVoice ?? '') ? (savedVoice as VoiceChoice) : 'claire',
  );
  const [speed, setSpeed] = useState<SpeedChoice>('normal');
  const [phase, setPhase] = useState<'idle' | 'busy' | 'ready' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [res, setRes] = useState<{ path: string; durationMs: number; url: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sample, setSample] = useState<{ voice: VoiceChoice; state: 'loading' | 'error' } | null>(null);
  // Voix prédéfinies réellement disponibles chez le fournisseur (les autres sont masquées)
  const [available, setAvailable] = useState<readonly VoiceChoice[]>(VOICE_CHOICES);
  useEffect(() => {
    if (!open) return;
    let live = true;
    callAi<{ voices: string[] }>(ws, 'voice_list', lang, {})
      .then((r) => {
        const list = VOICE_CHOICES.filter((v) => r.voices.includes(v));
        if (!live || !list.length) return;
        setAvailable(list);
        setVoice((cur) => (list.includes(cur) ? cur : list[0]!));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [open, ws, lang]);
  const ctrl = useRef<AbortController | null>(null);
  const sampleAudio = useRef<HTMLAudioElement | null>(null);
  useEffect(
    () => () => {
      ctrl.current?.abort();
      sampleAudio.current?.pause();
    },
    [],
  );

  const b = aiBlock(status, 'voice');
  if (b === 'disabled' || b === 'role')
    return (
      <DisabledEntry status={status} label={t('ai.voice.open')} feature="voice" tip={at.disabled('voice')} />
    );

  const spoken = withDefaults(text, variables);
  const est = estimateSeconds(spoken, speed);
  const left = audioLeft(status, 'voice');
  const tooMuch = left != null && left > 0 && est > left;
  const firstVar = variables.find((v) => text.includes(`{{${v.key}`));

  const discard = (path?: string) => {
    if (path) void supabase.storage.from('voices').remove([path]);
    setRes(null);
  };
  const run = async () => {
    const blocked = at.block('voice', status);
    if (blocked) {
      setMessage(blocked);
      return setPhase('error');
    }
    discard(res?.path);
    onRememberVoice(voice);
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setPhase('busy');
    try {
      const r = await callAi<{ path: string; durationMs: number }>(
        ws,
        'voice',
        lang,
        { stepId, text: spoken, voice, speed },
        c.signal,
      );
      const { data } = await supabase.storage.from('voices').createSignedUrl(r.path, 3600);
      setRes({ ...r, url: data?.signedUrl ?? '' });
      setPhase('ready');
    } catch (e) {
      if (e instanceof AiRequestError && e.code === 'ABORTED') return setPhase('idle');
      setMessage(at.error(e, 'voice', status));
      setPhase('error');
    }
  };
  const playSample = async (v: VoiceChoice) => {
    sampleAudio.current?.pause();
    setSample({ voice: v, state: 'loading' });
    try {
      const r = await callAi<{ audio: string }>(ws, 'voice_sample', lang, { voice: v });
      const a = new Audio(r.audio);
      sampleAudio.current = a;
      setSample(null);
      await a.play().catch(() => undefined);
    } catch {
      setSample({ voice: v, state: 'error' });
    }
  };
  const apply = () => {
    if (!res) return;
    onApply({ path: res.path, durationMs: res.durationMs, transcript: spoken });
    setRes(null);
    setPhase('idle');
    setOpen(false);
  };
  const close = () => {
    ctrl.current?.abort();
    discard(res?.path);
    setPhase('idle');
    setOpen(false);
  };

  if (!open)
    return (
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => {
          setText(initialText);
          setOpen(true);
        }}
      >
        <WandSparkles aria-hidden="true" />
        {t('ai.voice.open')}
      </button>
    );
  const quotaReached = phase === 'error' && aiBlock(status, 'voice') === 'quota';
  return (
    <div className="ai-preview ai-voice" aria-busy={phase === 'busy'}>
      <span className="sr-only" role="status">
        {phase === 'ready' ? t('ai.ready') : ''}
      </span>
      <h4>{t('ai.voice.title')}</h4>
      {phase !== 'ready' && !quotaReached && (
        <>
          <div className="field">
            <label htmlFor={`ai-vt-${stepId}`}>{t('ai.voice.text')}</label>
            <textarea
              id={`ai-vt-${stepId}`}
              className="textarea input-sm"
              rows={3}
              maxLength={TTS_MAX_CHARS}
              value={text}
              disabled={phase === 'busy'}
              aria-describedby={`ai-vt-h-${stepId}`}
              onChange={(e) => setText(e.target.value)}
            />
            <span className="help" id={`ai-vt-h-${stepId}`}>
              {t('ai.voice.varsHelp', {
                key: `{{${firstVar?.key ?? 'company'}}}`,
                value: firstVar?.default_value || t('ai.voice.varsExample'),
              })}{' '}
              {t('editor.chars', { n: text.length, max: TTS_MAX_CHARS })}
            </span>
          </div>
          <fieldset className="ai-voices" disabled={phase === 'busy'}>
            <legend>{t('ai.voice.voice')}</legend>
            {available.map((v) => (
              <div key={v} className="ai-voice-row">
                <label className="check">
                  <input
                    type="radio"
                    name={`ai-voice-${stepId}`}
                    value={v}
                    checked={voice === v}
                    onChange={() => setVoice(v)}
                  />
                  <span>
                    <b>{t(`ai.voice.v.${v}.name`)}</b>
                    <span className="t-caption muted ai-voice-desc">{t(`ai.voice.v.${v}.desc`)}</span>
                  </span>
                </label>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon btn-sm"
                  aria-label={t('ai.voice.sampleOf', { name: t(`ai.voice.v.${v}.name`) })}
                  title={t('ai.voice.sample')}
                  aria-busy={sample?.voice === v && sample.state === 'loading'}
                  onClick={() => void playSample(v)}
                >
                  <Play aria-hidden="true" />
                </button>
              </div>
            ))}
            {sample?.state === 'error' && (
              <p className="t-caption" role="alert">
                {t('ai.voice.sampleError')}
              </p>
            )}
          </fieldset>
          <fieldset className="ai-speed" disabled={phase === 'busy'}>
            <legend>{t('ai.voice.speed')}</legend>
            <div className="ai-speed-row">
              {SPEED_CHOICES.map((sp) => (
                <label key={sp} className="check">
                  <input
                    type="radio"
                    name={`ai-speed-${stepId}`}
                    value={sp}
                    checked={speed === sp}
                    onChange={() => setSpeed(sp)}
                  />
                  {t(`ai.voice.speed_${sp}`)}
                </label>
              ))}
            </div>
          </fieldset>
          {spoken.trim() && <p className="t-caption">{t('ai.voice.estimate', { n: est })}</p>}
          {tooMuch && (
            <p className="ai-after" role="alert">
              {at.over(left!, est)}
            </p>
          )}
          <p className="ai-notice-line">
            <Info aria-hidden="true" />
            {t('ai.voice.notice')}
          </p>
        </>
      )}
      {phase === 'busy' && (
        <>
          <p className="ai-after">{t('ai.voice.busy')}</p>
          <div className="ai-progress" aria-hidden="true" />
        </>
      )}
      {phase === 'error' && (
        <p className="ai-after" role="alert">
          {message}
        </p>
      )}
      {phase === 'ready' && res && (
        <>
          <audio
            className="voice-player"
            controls
            preload="metadata"
            src={res.url}
            aria-label={t('ai.voice.preview')}
          />
          <p className="t-caption">
            {t('ai.voice.duration', { d: formatSeconds(Math.max(1, Math.round(res.durationMs / 1000))) })}
          </p>
          <p className="ai-mention">
            <Sparkles aria-hidden="true" />
            {t('ai.mention')}
          </p>
        </>
      )}
      <div className="ai-actions">
        {phase === 'ready' && res ? (
          <>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => (hasRecording ? setConfirming(true) : apply())}
            >
              {t('ai.apply')}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={close}>
              {t('ai.ignore')}
            </button>
            <button type="button" className="btn btn-link btn-sm" onClick={() => void run()}>
              {t('ai.voice.again')}
            </button>
          </>
        ) : phase === 'busy' ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => ctrl.current?.abort()}>
            {t('ai.stop')}
          </button>
        ) : quotaReached ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={close}>
            {t('common.close')}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!spoken.trim() || tooMuch}
              onClick={() => void run()}
            >
              {phase === 'error' ? t('ai.retry') : t('ai.voice.go')}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={close}>
              {t('common.cancel')}
            </button>
          </>
        )}
      </div>
      {confirming && (
        <ConfirmModal
          title={t('ai.voice.replaceTitle')}
          body={t('ai.voice.replaceBody')}
          confirm={t('ai.voice.replace')}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            apply();
          }}
        />
      )}
    </div>
  );
}

export interface Cue {
  from: number;
  to: number;
  text: string;
}
export interface CaptionsResult {
  captions: Cue[];
  text: string;
  language: string;
}

const skipKey = (demoId: string) => `fd.ai.sttNoAsk.${demoId}`;
function readSkip(demoId: string) {
  try {
    return localStorage.getItem(skipKey(demoId)) === '1';
  } catch {
    return false;
  }
}
function writeSkip(demoId: string) {
  try {
    localStorage.setItem(skipKey(demoId), '1');
  } catch {
    /* stockage indisponible : la question sera reposée */
  }
}

/**
 * 066 Sous-titres automatiques (L30-11) : avertissement avant chaque envoi d'audio (sauf « Ne plus
 * demander pour cette démo »), 2 minutes au plus ; le résultat s'ouvre dans l'aperçu éditable.
 */
export function AiCaptions({
  ws,
  lang,
  demoId,
  stepId,
  source,
  durationMs,
  label,
  onResult,
}: {
  ws: string;
  lang: string;
  demoId: string;
  stepId: string;
  source: 'video' | 'voice';
  durationMs: number;
  label: string;
  onResult: (r: CaptionsResult) => void;
}) {
  const { t } = useTranslation();
  const at = useAudioText();
  const { status } = useAiStatus(ws);
  const [asking, setAsking] = useState(false);
  const [noAsk, setNoAsk] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'busy' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => () => ctrl.current?.abort(), []);

  const b = aiBlock(status, 'captions');
  if (b === 'disabled' || b === 'role')
    return <DisabledEntry status={status} label={label} feature="captions" tip={at.disabled('captions')} />;

  const seconds = Math.max(1, Math.ceil(durationMs / 1000));
  const run = async () => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setPhase('busy');
    try {
      const r = await callAi<CaptionsResult>(ws, 'captions', lang, { stepId, source }, c.signal);
      if (!r.captions.length && !r.text.trim()) {
        setMessage(t('ai.captions.empty'));
        return setPhase('error');
      }
      setPhase('idle');
      onResult(r);
    } catch (e) {
      if (e instanceof AiRequestError && e.code === 'ABORTED') return setPhase('idle');
      setMessage(at.error(e, 'captions', status));
      setPhase('error');
    }
  };
  const fail = (m: string) => {
    setMessage(m);
    setPhase('error');
  };
  const start = () => {
    if (seconds > STT_MAX_S)
      return fail(t(source === 'video' ? 'ai.captions.videoTooLong' : 'ai.captions.tooLong'));
    const blocked = at.block('captions', status);
    if (blocked) return fail(blocked);
    const left = audioLeft(status, 'captions');
    if (left != null && seconds > left) return fail(at.over(left, seconds));
    if (readSkip(demoId)) return void run();
    setNoAsk(false);
    setAsking(true);
  };

  return (
    <div className="ai-captions" aria-busy={phase === 'busy'}>
      <button type="button" className="btn btn-secondary btn-sm" disabled={phase === 'busy'} onClick={start}>
        <WandSparkles aria-hidden="true" />
        {label}
      </button>
      {phase === 'busy' && (
        <div className="ai-preview">
          <p className="ai-after">{t('ai.captions.busy')}</p>
          <div className="ai-progress" aria-hidden="true" />
          <div className="ai-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => ctrl.current?.abort()}>
              {t('ai.stop')}
            </button>
          </div>
        </div>
      )}
      {phase === 'error' && (
        <div className="ai-preview">
          <p className="ai-after" role="alert">
            {message}
          </p>
          <div className="ai-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPhase('idle')}>
              {t('common.close')}
            </button>
          </div>
        </div>
      )}
      {asking && (
        <ConfirmModal
          title={t('ai.captions.askTitle')}
          body={t(`ai.captions.askBody_${source}`, { d: formatSeconds(seconds) })}
          confirm={t('ai.captions.send')}
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            if (noAsk) writeSkip(demoId);
            setAsking(false);
            void run();
          }}
        >
          <label className="check">
            <input type="checkbox" checked={noAsk} onChange={(e) => setNoAsk(e.target.checked)} />
            {t('ai.captions.noAsk')}
          </label>
        </ConfirmModal>
      )}
    </div>
  );
}

/** Aperçu de la transcription d'une voix off (066 depuis la section Voix off). */
export function TranscriptPreview({
  text,
  language,
  onApply,
  onIgnore,
}: {
  text: string;
  language: string;
  onApply: () => void;
  onIgnore: () => void;
}) {
  const { t, i18n } = useTranslation();
  return (
    <div className="ai-preview" role="group" aria-label={t('ai.proposal')}>
      <h4>{t('ai.proposal')}</h4>
      <p className="ai-after">{text}</p>
      {language && (
        <p className="t-caption muted">
          {t('ai.captions.language', { lang: languageName(language, i18n.language) })}
        </p>
      )}
      <p className="ai-mention">
        <Sparkles aria-hidden="true" />
        {t('ai.mention')}
      </p>
      <div className="ai-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={onApply}>
          {t('ai.apply')}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onIgnore}>
          {t('ai.ignore')}
        </button>
      </div>
    </div>
  );
}
