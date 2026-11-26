import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Sparkles } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { AiRequestError, aiBlock, audioLeft, callAi, useAiStatus } from '../../../lib/ai';
import { TTS_MAX_CHARS, estimateSeconds, useAudioText, withDefaults } from '../../../components/ai/AiAudio';
import { AudioLine } from './AudioLine';
import { VoicePicker } from './VoicePicker';
import { FreshVoice } from './FreshVoice';
import { langLabel, pickVoice, useVoiceList } from './useVoiceList';

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
  hasVoice,
  fromTranscript,
  bound,
  auto,
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
  /** L62 §6 : une voix est en place ; la nouvelle attend « Utiliser cette voix » ou « Garder l'actuelle ». */
  hasVoice: boolean;
  /** Le texte lu est repris de la transcription de l'étape (sinon du texte de la bulle). */
  fromTranscript?: boolean;
  /**
   * Recette l62-source-3 : voix générée en place. Le texte lu EST la transcription de l'étape (un seul
   * champ, variables gardées) et le seul bouton est « Régénérer la voix ».
   */
  bound?: { text: string; invalid: boolean; onChange: (v: string) => void };
  /**
   * L62 §6 (commit 3) : « Générer la voix depuis ce texte », sous la transcription. Chaque nouveau `n`
   * lance la génération avec ce texte et cette voix, sans autre clic.
   */
  auto?: { n: number; text: string; voice: string };
  onRememberVoice: (v: string) => void;
  onApply: (r: { path: string; durationMs: number; transcript: string; voiceName?: string }) => void;
}) {
  const { t, i18n } = useTranslation();
  const at = useAudioText();
  const { status } = useAiStatus(ws);
  const [text, setText] = useState(initialText);
  // L62 §8 : toutes les voix du compte ; une démo qui garde un ancien emplacement (« claire »…) retrouve
  // sa voix par la correspondance renvoyée par le serveur
  const [voice, setVoice] = useState<string>(auto?.voice || savedVoice || 'claire');
  const [phase, setPhase] = useState<'idle' | 'busy' | 'ready' | 'error'>('idle');
  const [message, setMessage] = useState('');
  // raw : texte avec ses variables ({{company}}), gardé tel quel comme transcription (sous-titres du visiteur)
  const [res, setRes] = useState<{ path: string; durationMs: number; url: string; raw: string } | null>(null);
  const { voices, aliases, ready } = useVoiceList(ws, lang);
  useEffect(() => {
    if (ready) setVoice((cur) => pickVoice(voices, aliases, cur)?.id ?? cur);
  }, [ready, voices, aliases]);
  const ctrl = useRef<AbortController | null>(null);
  // Aperçu non utilisé : le fichier est retiré en quittant « Générer »
  const pending = useRef<string | null>(null);
  useEffect(
    () => () => {
      ctrl.current?.abort();
      if (pending.current) void supabase.storage.from('voices').remove([pending.current]);
    },
    [],
  );

  const txt = bound ? bound.text : text;
  const spoken = withDefaults(txt, variables);
  const est = estimateSeconds(spoken);
  const left = audioLeft(status, 'voice');
  const tooMuch = left != null && left > 0 && est > left;
  const firstVar = variables.find((v) => txt.includes(`{{${v.key}`));
  // Quota atteint : message et date de remise à zéro dès l'ouverture, sans envoi
  const quota = aiBlock(status, 'voice') === 'quota' ? at.block('voice', status) : '';
  const busy = phase === 'busy';
  const langName = langLabel(lang, i18n.language);

  const run = async (req?: { text: string; voice: string }) => {
    const raw = req?.text ?? txt;
    const said = withDefaults(raw, variables);
    const who = req?.voice ?? voice;
    const blocked = at.block('voice', status);
    if (blocked) {
      setMessage(blocked);
      return setPhase('error');
    }
    if (res) void supabase.storage.from('voices').remove([res.path]);
    pending.current = null;
    setRes(null);
    onRememberVoice(who);
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setPhase('busy');
    try {
      const r = await callAi<{ path: string; durationMs: number }>(
        ws,
        'voice',
        lang,
        { stepId, text: said, voice: who, speed: 'normal' },
        c.signal,
      );
      pending.current = r.path;
      const { data } = await supabase.storage.from('voices').createSignedUrl(r.path, 3600);
      setRes({ ...r, url: data?.signedUrl ?? '', raw });
      setPhase('ready');
    } catch (e) {
      if (e instanceof AiRequestError && e.code === 'ABORTED') return setPhase('idle');
      setMessage(at.error(e, 'voice', status));
      setPhase('error');
    }
  };
  // Demande venue de la transcription : texte et voix repris, génération lancée tout de suite
  // (une fois l'état de l'assistance connu, sinon la demande serait refusée d'office)
  const autoN = auto?.n;
  const autoDone = useRef(0);
  const known = !!status;
  useEffect(() => {
    if (!autoN || !auto || !known || autoDone.current === autoN) return;
    autoDone.current = autoN;
    setText(auto.text);
    setVoice(auto.voice);
    void run({ text: auto.text, voice: auto.voice });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une génération par demande
  }, [autoN, known]);
  const apply = () => {
    if (!res) return;
    pending.current = null;
    onApply({
      path: res.path,
      durationMs: res.durationMs,
      transcript: res.raw,
      voiceName: voices.find((v) => v.id === voice)?.name,
    });
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
          {t('editor.voice.readText')}{' '}
          <span className="vo-opt">
            {hasVoice && fromTranscript && !bound
              ? t('editor.voice.fromTranscript')
              : t('editor.voice.readTextNote')}
          </span>
        </label>
        <textarea
          id={`vo-gt-${stepId}`}
          className="textarea input-sm"
          rows={3}
          maxLength={TTS_MAX_CHARS}
          value={txt}
          disabled={busy}
          aria-describedby={`vo-gt-h-${stepId}`}
          aria-invalid={bound?.invalid || undefined}
          onChange={(e) => (bound ? bound.onChange(e.target.value) : setText(e.target.value))}
        />
        <p className="vo-help" id={`vo-gt-h-${stepId}`}>
          {t('editor.voice.genCount', { count: txt.length })}
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
        {bound?.invalid && (
          <p className="field-error" role="alert">
            {t('editor.voice.transcriptMissing')}
          </p>
        )}
      </div>
      <div>
        <span className="vo-label" id={`vo-gv-${stepId}`}>
          {t('ai.voice.voice')}
        </span>
        <VoicePicker
          ws={ws}
          lang={lang}
          voices={voices}
          value={voice}
          disabled={busy}
          labelledBy={`vo-gv-${stepId}`}
          describedBy={`vo-gv-h-${stepId}`}
          onChange={setVoice}
        />
        <p className="vo-help" id={`vo-gv-h-${stepId}`}>
          {t('editor.voice.genLang', { lang: langName })}
        </p>
      </div>
      {phase === 'ready' && res && hasVoice && (
        // L62 §6 : une voix est en place ; la voix générée attend le choix (carte commune aux 3 sources)
        <FreshVoice
          source="generated"
          voiceName={voices.find((v) => v.id === voice)?.name}
          url={res.url}
          durationMs={res.durationMs}
          redo={{
            label: t('editor.voice.regenerate'),
            icon: <RefreshCw aria-hidden="true" />,
            onClick: () => void run(),
          }}
          onKeep={() => {
            // Garder l'actuelle : la voix générée est retirée, la voix en place ne bouge pas
            void supabase.storage.from('voices').remove([res.path]);
            pending.current = null;
            setRes(null);
            setPhase('idle');
          }}
          onUse={apply}
        />
      )}
      {phase === 'ready' && res && !hasVoice && (
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
      {hasVoice && !bound && phase !== 'ready' && <p className="vo-help">{t('editor.voice.keepsVoice')}</p>}
      {phase !== 'ready' && !busy && !quota && <p className="vo-notice">{t('ai.voice.notice')}</p>}
      {phase === 'ready' && res && hasVoice ? null : phase === 'ready' && res ? (
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
          <button type="button" className="btn btn-primary btn-sm" onClick={apply}>
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
      ) : bound && phase !== 'error' ? (
        <div className="vo-fromtext">
          <button
            type="button"
            className="btn btn-secondary vo-wide"
            disabled={!spoken.trim() || tooMuch || !!quota}
            aria-describedby={`vo-rg-h-${stepId}`}
            onClick={() => void run()}
          >
            <Sparkles aria-hidden="true" />
            {t('editor.voice.regenVoice')}
          </button>
          <p className="vo-help" id={`vo-rg-h-${stepId}`}>
            {t('editor.voice.regenVoiceHelp')}
          </p>
        </div>
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
    </>
  );
}
