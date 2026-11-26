import type { ReactNode } from 'react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, Sparkles, Upload } from 'lucide-react';
import { AudioLine } from './AudioLine';
import { formatClock } from './voice';

/**
 * L62 §6 : nouvelle voix à écouter alors qu'une voix est en place. Une seule forme pour les trois sources
 * (recette UX l62-source-2) : en-tête (icône de la source, « Nouvelle voix », « Générée · Antoine · 0:11 »,
 * étiquette « À écouter » à droite), lecteur, puis les actions DANS la carte : à gauche le lien pour
 * refaire (Régénérer, Recommencer, Choisir un autre fichier), à droite « Garder l'actuelle » et
 * « Utiliser cette voix ».
 */
export function FreshVoice({
  source,
  voiceName,
  url,
  durationMs,
  busy,
  redo,
  onKeep,
  onUse,
}: {
  source: 'generated' | 'recorded' | 'imported';
  voiceName?: string;
  url: string | null;
  durationMs: number;
  busy?: boolean;
  redo: { label: string; icon: ReactNode; onClick: () => void };
  onKeep: () => void;
  onUse: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const line = [
    t(`editor.voice.short.${source}`),
    source === 'generated' ? voiceName : '',
    formatClock(durationMs),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="vo-fresh" role="group" aria-labelledby={`${id}-t`}>
      <div className="vo-fresh__head">
        <span className="vo-card__icon" aria-hidden="true">
          {source === 'imported' ? <Upload /> : source === 'recorded' ? <Mic /> : <Sparkles />}
        </span>
        <div className="vo-card__txt">
          <b id={`${id}-t`}>{t('editor.voice.newVoice')}</b>
          <span className="muted">{line}</span>
        </div>
        <span className="vo-fresh__tag">{t('editor.voice.toListen')}</span>
      </div>
      <AudioLine
        src={url}
        durationMs={durationMs}
        label={t('editor.voice.listen')}
        pauseLabel={t('editor.voice.pause')}
      />
      <div className="vo-fresh__acts">
        <button type="button" className="link-button vo-fresh__redo" disabled={busy} onClick={redo.onClick}>
          {redo.icon}
          {redo.label}
        </button>
        <span className="vo-fresh__main">
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={onKeep}>
            {t('editor.voice.keepCurrent')}
          </button>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={onUse}>
            {t('editor.voice.useThis')}
          </button>
        </span>
      </div>
    </div>
  );
}
