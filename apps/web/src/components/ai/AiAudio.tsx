import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles, WandSparkles, X } from 'lucide-react';
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
export function useAudioText() {
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
  /** L62 : le service audio refuse (clé, crédits, voix) : la cause est dite, à transmettre à un admin. */
  const providerText = (code: string) =>
    code === 'PROVIDER_KEY'
      ? t('ai.audio.providerKey')
      : code === 'PROVIDER_QUOTA'
        ? t('ai.audio.providerQuota')
        : code === 'PROVIDER_PLAN'
          ? t('ai.audio.providerPlan')
          : code === 'PROVIDER_VOICE'
            ? t('ai.audio.providerVoice')
            : '';
  return {
    disabled: (f: AudioFeature) => t(`ai.audio.disabled_${f}`),
    quota,
    /** Blocage avant envoi : quota audio de la fonction, sinon message commun (règle 4). */
    provider: providerText,
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
        // L62 : refus du fournisseur audio, nommé (réessayer ne changerait rien)
        const provider = providerText(e.code);
        if (provider) return provider;
      }
      return t('ai.error');
    },
  };
}

export function ConfirmModal({
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
