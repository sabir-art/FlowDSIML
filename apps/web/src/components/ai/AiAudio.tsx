import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Info, Sparkles, WandSparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AiRequestError, aiBlock, callAi, useAiStatus, type AiFeature } from '../../lib/ai';
import { DisabledEntry, useBlockText } from './AiWrite';
import './ai.css';

export const VOICE_CHOICES = ['feminine', 'masculine'] as const;
export type VoiceChoice = (typeof VOICE_CHOICES)[number];

function errorMessage(
  e: unknown,
  t: (k: string) => string,
  blockText: ReturnType<typeof useBlockText>,
  status: ReturnType<typeof useAiStatus>['status'],
) {
  if (e instanceof AiRequestError) {
    if (e.code === 'AI_QUOTA_WORKSPACE') return blockText('quota', status);
    if (e.code === 'AI_QUOTA_USER') return blockText('userQuota', status);
    if (e.code === 'AI_DISABLED') return t('ai.disabled');
    if (e.code === 'PII_IN_TEXT') return t('ai.voice.pii');
    if (e.code === 'TOO_LONG' || e.code === 'TOO_LONG_TEXT') return t('ai.voice.tooLong');
  }
  return t('ai.error');
}

/** Entrée IA d'une fonction audio : désactivée selon la règle 4 (même rendu que Rédiger). */
function useAudioEntry(ws: string, feature: AiFeature) {
  const { status } = useAiStatus(ws);
  const b = aiBlock(status, feature);
  return { status, disabled: b === 'disabled' || b === 'role' };
}

/**
 * 065 Voix de synthèse : la transcription de l'étape est lue par une voix ElevenLabs. Avertissement
 * avant l'envoi, aperçu à écouter, puis « Appliquer » (voix off de l'étape) ou « Ignorer » (fichier retiré).
 */
export function AiVoice({
  ws,
  lang,
  stepId,
  text,
  onApply,
}: {
  ws: string;
  lang: string;
  stepId: string;
  /** Transcription envoyée (texte de la voix off, sinon texte de la bulle). */
  text: string;
  onApply: (r: { path: string; durationMs: number; transcript: string }) => void;
}) {
  const { t } = useTranslation();
  const blockText = useBlockText();
  const { status, disabled } = useAudioEntry(ws, 'voice');
  const [open, setOpen] = useState(false);
  const [voice, setVoice] = useState<VoiceChoice>('feminine');
  const [phase, setPhase] = useState<'idle' | 'busy' | 'ready' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [res, setRes] = useState<{ path: string; durationMs: number; url: string } | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => () => ctrl.current?.abort(), []);

  if (disabled) return <DisabledEntry status={status} label={t('ai.voice.open')} feature="voice" />;

  const discard = (path?: string) => {
    if (path) void supabase.storage.from('voices').remove([path]);
    setRes(null);
    setPhase('idle');
  };
  const run = async () => {
    const b = aiBlock(status, 'voice');
    if (b) {
      setMessage(blockText(b, status));
      return setPhase('error');
    }
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setPhase('busy');
    try {
      const r = await callAi<{ path: string; durationMs: number }>(
        ws,
        'voice',
        lang,
        { stepId, text, voice },
        c.signal,
      );
      const { data } = await supabase.storage.from('voices').createSignedUrl(r.path, 3600);
      setRes({ ...r, url: data?.signedUrl ?? '' });
      setPhase('ready');
    } catch (e) {
      if (e instanceof AiRequestError && e.code === 'ABORTED') return setPhase('idle');
      setMessage(errorMessage(e, t, blockText, status));
      setPhase('error');
    }
  };

  if (!open)
    return (
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
        <WandSparkles aria-hidden="true" />
        {t('ai.voice.open')}
      </button>
    );
  return (
    <div className="ai-preview ai-voice" aria-busy={phase === 'busy'}>
      <span className="sr-only" role="status">
        {phase === 'ready' ? t('ai.ready') : ''}
      </span>
      <h4>{t('ai.voice.title')}</h4>
      <p className="ai-notice-line">
        <Info aria-hidden="true" />
        {t('ai.voice.notice')}
      </p>
      {phase !== 'ready' && (
        <>
          <p className="ai-before ai-voice-text">{text || t('ai.voice.noText')}</p>
          <div className="field">
            <label htmlFor={`ai-voice-${stepId}`}>{t('ai.voice.voice')}</label>
            <select
              id={`ai-voice-${stepId}`}
              className="select input-sm"
              value={voice}
              disabled={phase === 'busy'}
              onChange={(e) => setVoice(e.target.value as VoiceChoice)}
            >
              {VOICE_CHOICES.map((v) => (
                <option key={v} value={v}>
                  {t(`ai.voice.${v}`)}
                </option>
              ))}
            </select>
          </div>
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
          <p className="ai-mention">
            <Sparkles aria-hidden="true" />
            {t('ai.mention')}
          </p>
        </>
      )}
      <div className="ai-actions">
        {phase === 'ready' && res ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              onApply({ path: res.path, durationMs: res.durationMs, transcript: text });
              setRes(null);
              setPhase('idle');
              setOpen(false);
            }}
          >
            {t('ai.apply')}
          </button>
        ) : phase === 'busy' ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => ctrl.current?.abort()}>
            {t('ai.stop')}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!text.trim()}
            onClick={() => void run()}
          >
            {phase === 'error' ? t('ai.retry') : t('ai.voice.go')}
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            discard(res?.path);
            setOpen(false);
          }}
        >
          {phase === 'ready' ? t('ai.ignore') : t('common.cancel')}
        </button>
      </div>
    </div>
  );
}

export interface Cue {
  from: number;
  to: number;
  text: string;
}

/**
 * 066 Sous-titres automatiques : la piste audio de la vidéo de l'étape est envoyée à ElevenLabs
 * (dit avant l'envoi) ; les sous-titres obtenus s'ouvrent dans l'éditeur de sous-titres, modifiables
 * avant application.
 */
export function AiCaptions({
  ws,
  lang,
  stepId,
  onResult,
}: {
  ws: string;
  lang: string;
  stepId: string;
  onResult: (cues: Cue[]) => void;
}) {
  const { t } = useTranslation();
  const blockText = useBlockText();
  const { status, disabled } = useAudioEntry(ws, 'captions');
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'busy' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => () => ctrl.current?.abort(), []);

  if (disabled) return <DisabledEntry status={status} label={t('ai.captions.open')} feature="captions" />;
  const run = async () => {
    const b = aiBlock(status, 'captions');
    if (b) {
      setMessage(blockText(b, status));
      return setPhase('error');
    }
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setPhase('busy');
    try {
      const r = await callAi<{ captions: Cue[] }>(ws, 'captions', lang, { stepId }, c.signal);
      if (!r.captions.length) {
        setMessage(t('ai.captions.empty'));
        return setPhase('error');
      }
      setPhase('idle');
      setOpen(false);
      onResult(r.captions);
    } catch (e) {
      if (e instanceof AiRequestError && e.code === 'ABORTED') return setPhase('idle');
      setMessage(errorMessage(e, t, blockText, status));
      setPhase('error');
    }
  };
  if (!open)
    return (
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
        <WandSparkles aria-hidden="true" />
        {t('ai.captions.open')}
      </button>
    );
  return (
    <div className="ai-preview ai-captions" aria-busy={phase === 'busy'}>
      <h4>{t('ai.captions.title')}</h4>
      <p className="ai-notice-line">
        <Info aria-hidden="true" />
        {t('ai.captions.notice')}
      </p>
      {phase === 'busy' && (
        <>
          <p className="ai-after">{t('ai.captions.busy')}</p>
          <div className="ai-progress" aria-hidden="true" />
        </>
      )}
      {phase === 'error' && (
        <p className="ai-after" role="alert">
          {message}
        </p>
      )}
      <div className="ai-actions">
        {phase === 'busy' ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => ctrl.current?.abort()}>
            {t('ai.stop')}
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void run()}>
            {phase === 'error' ? t('ai.retry') : t('ai.captions.go')}
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
