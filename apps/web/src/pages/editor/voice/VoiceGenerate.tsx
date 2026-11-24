import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, RefreshCw } from 'lucide-react';
import { Select } from '@flowdsiml/ui';
import { supabase } from '../../../lib/supabase';
import { AiRequestError, aiBlock, audioLeft, callAi, useAiStatus } from '../../../lib/ai';
import {
  ConfirmModal,
  TTS_MAX_CHARS,
  VOICE_CHOICES,
  estimateSeconds,
  useAudioText,
  withDefaults,
  type VoiceChoice,
} from '../../../components/ai/AiAudio';
import { AudioLine } from './AudioLine';

/**
 * EXT-02 §6.4, « Générer » : voix de synthèse dans le panneau de 320 px. Texte lu (il sert aussi de
 * transcription, variables lues avec leur valeur par défaut), voix (la langue est celle de la démo),
 * aperçu, puis « Régénérer » ou « Utiliser ». Rien n'est appliqué à l'étape avant « Utiliser ».
 */
export function VoiceGenerate({
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
  const { t, i18n } = useTranslation();
  const at = useAudioText();
  const { status } = useAiStatus(ws);
  const [text, setText] = useState(initialText);
  const [voice, setVoice] = useState<VoiceChoice>(
    (VOICE_CHOICES as readonly string[]).includes(savedVoice ?? '') ? (savedVoice as VoiceChoice) : 'claire',
  );
  const [phase, setPhase] = useState<'idle' | 'busy' | 'ready' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [res, setRes] = useState<{ path: string; durationMs: number; url: string; spoken: string } | null>(
    null,
  );
  const [confirming, setConfirming] = useState(false);
  const [sample, setSample] = useState<'loading' | 'error' | null>(null);
  const sampleAudio = useRef<HTMLAudioElement | null>(null);
  // Voix prédéfinies réellement disponibles chez le fournisseur (les autres sont masquées)
  const [available, setAvailable] = useState<readonly VoiceChoice[]>(VOICE_CHOICES);
  useEffect(() => {
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
  }, [ws, lang]);
  const ctrl = useRef<AbortController | null>(null);
  // Aperçu non utilisé : le fichier est retiré en quittant « Générer »
  const pending = useRef<string | null>(null);
  useEffect(
    () => () => {
      ctrl.current?.abort();
      sampleAudio.current?.pause();
      if (pending.current) void supabase.storage.from('voices').remove([pending.current]);
    },
    [],
  );

  const spoken = withDefaults(text, variables);
  const est = estimateSeconds(spoken);
  const left = audioLeft(status, 'voice');
  const tooMuch = left != null && left > 0 && est > left;
  const firstVar = variables.find((v) => text.includes(`{{${v.key}`));
  // Quota atteint : message et date de remise à zéro dès l'ouverture, sans envoi
  const quota = aiBlock(status, 'voice') === 'quota' ? at.block('voice', status) : '';
  const busy = phase === 'busy';
  const langName = (() => {
    try {
      return new Intl.DisplayNames([i18n.language], { type: 'language' }).of(lang) ?? lang;
    } catch {
      return lang;
    }
  })();

  const run = async () => {
    const blocked = at.block('voice', status);
    if (blocked) {
      setMessage(blocked);
      return setPhase('error');
    }
    if (res) void supabase.storage.from('voices').remove([res.path]);
    pending.current = null;
    setRes(null);
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
        { stepId, text: spoken, voice, speed: 'normal' },
        c.signal,
      );
      pending.current = r.path;
      const { data } = await supabase.storage.from('voices').createSignedUrl(r.path, 3600);
      setRes({ ...r, url: data?.signedUrl ?? '', spoken });
      setPhase('ready');
    } catch (e) {
      if (e instanceof AiRequestError && e.code === 'ABORTED') return setPhase('idle');
      setMessage(at.error(e, 'voice', status));
      setPhase('error');
    }
  };
  // Exemple de la voix choisie : aucun texte de la démo n'est envoyé, aucun quota consommé
  const playSample = async () => {
    sampleAudio.current?.pause();
    setSample('loading');
    try {
      const r = await callAi<{ audio: string }>(ws, 'voice_sample', lang, { voice });
      const a = new Audio(r.audio);
      sampleAudio.current = a;
      setSample(null);
      await a.play().catch(() => undefined);
    } catch {
      setSample('error');
    }
  };
  const apply = () => {
    if (!res) return;
    pending.current = null;
    onApply({ path: res.path, durationMs: res.durationMs, transcript: res.spoken });
    setRes(null);
    setPhase('idle');
  };

  return (
    <>
      <span className="sr-only" role="status">
        {phase === 'ready' ? t('ai.ready') : ''}
      </span>
      <div>
        <label className="vo-label" htmlFor={`vo-gt-${stepId}`}>
          {t('editor.voice.readText')} <span className="vo-opt">{t('editor.voice.readTextNote')}</span>
        </label>
        <textarea
          id={`vo-gt-${stepId}`}
          className="textarea input-sm"
          rows={3}
          maxLength={TTS_MAX_CHARS}
          value={text}
          disabled={busy}
          aria-describedby={`vo-gt-h-${stepId}`}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="vo-help" id={`vo-gt-h-${stepId}`}>
          {t('editor.voice.genCount', { count: text.length })}
          {spoken.trim() ? ` · ${t('editor.voice.genAbout', { n: est })}` : ''}
          {firstVar && (
            <>
              <br />
              {t('ai.voice.varsHelp', {
                key: `{{${firstVar.key}}}`,
                value: firstVar.default_value || t('ai.voice.varsExample'),
              })}
            </>
          )}
        </p>
      </div>
      <div>
        <span className="vo-label" id={`vo-gv-${stepId}`}>
          {t('ai.voice.voice')}
        </span>
        <div className="vo-voice">
          <Select
            aria-labelledby={`vo-gv-${stepId}`}
            aria-describedby={`vo-gv-h-${stepId}`}
            value={voice}
            disabled={busy}
            onChange={(e) => {
              const v = e.target.value as VoiceChoice;
              if (available.includes(v)) setVoice(v);
            }}
            options={available.map((v) => ({
              value: v,
              label: t(`ai.voice.v.${v}.name`),
              description: t(`ai.voice.v.${v}.desc`),
            }))}
          />
          <button
            type="button"
            className="btn btn-secondary btn-icon vo-sample"
            aria-label={t('ai.voice.sample')}
            title={t('ai.voice.sample')}
            aria-busy={sample === 'loading'}
            disabled={busy}
            onClick={() => void playSample()}
          >
            <Play aria-hidden="true" />
          </button>
        </div>
        <p className="vo-help" id={`vo-gv-h-${stepId}`}>
          {t('editor.voice.genLang', { lang: langName })}
        </p>
        {sample === 'error' && (
          <p className="vo-alert" role="alert">
            {t('ai.voice.sampleError')}
          </p>
        )}
      </div>
      {phase === 'ready' && res && (
        <div>
          <span className="vo-label">{t('editor.voice.preview')}</span>
          <AudioLine
            src={res.url}
            durationMs={res.durationMs}
            label={t('editor.voice.listen')}
            pauseLabel={t('editor.voice.pause')}
          />
        </div>
      )}
      {busy && (
        <div className="vo-busy" aria-busy="true">
          <p className="vo-help" role="status">
            {t('ai.voice.busy')}
          </p>
          <div className="vo-indet" aria-hidden="true" />
        </div>
      )}
      {tooMuch && !quota && (
        <p className="vo-alert" role="alert">
          {at.over(left!, est)}
        </p>
      )}
      {(quota || phase === 'error') && (
        <p className="vo-alert" role="alert">
          {quota || message}
        </p>
      )}
      {phase !== 'ready' && !busy && !quota && <p className="vo-notice">{t('ai.voice.notice')}</p>}
      {phase === 'ready' && res ? (
        <div className="vo-two">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!spoken.trim() || tooMuch}
            onClick={() => void run()}
          >
            <RefreshCw aria-hidden="true" />
            {t('editor.voice.regenerate')}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => (hasRecording ? setConfirming(true) : apply())}
          >
            {t('editor.voice.use')}
          </button>
        </div>
      ) : busy ? (
        <button
          type="button"
          className="btn btn-secondary btn-sm vo-wide"
          onClick={() => ctrl.current?.abort()}
        >
          {t('ai.stop')}
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-primary btn-sm vo-wide"
          disabled={!spoken.trim() || tooMuch || !!quota}
          onClick={() => void run()}
        >
          {phase === 'error' ? t('ai.retry') : t('ai.voice.go')}
        </button>
      )}
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
    </>
  );
}
