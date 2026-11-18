import { ChevronLeft, Info, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DemoEditor } from '../useDemoEditor';
import { asRects, type Selection, type StepRow } from '../types';

/**
 * EDT-07 : panneau « Zone de flou » de la maquette. Seul le flou est réglable aujourd'hui (le lecteur
 * l'applique par-dessus la capture) ; Pixels / Aplat, l'intensité et « Appliquer à » sont annoncés Bientôt.
 */
export function BlurPanel({
  editor,
  step,
  index,
  readOnly,
  setSelection,
}: {
  editor: DemoEditor;
  step: StepRow;
  index: number;
  readOnly: boolean;
  setSelection: (s: Selection) => void;
}) {
  const { t } = useTranslation();
  const soon = <span className="badge badge-xs">{t('shell.soon')}</span>;
  return (
    <div className="hs-panel blur-panel">
      <div className="hs-head">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelection({ kind: 'step' })}>
          <ChevronLeft aria-hidden="true" />
          {t('editor.backToStep')}
        </button>
        <span className="t-label">{t('editor.blurN', { n: index + 1 })}</span>
        <span className="hs-head__sp" />
      </div>

      <div className="sec">
        <div className="sec-title">
          {t('editor.blur.title')}
          {!readOnly && (
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon"
              aria-label={t('editor.deleteBlur')}
              title={t('editor.deleteBlur')}
              onClick={() => {
                editor.updateStep(step.id, { blurs: asRects(step.blurs).filter((_, i) => i !== index) });
                setSelection({ kind: 'step' });
              }}
            >
              <Trash2 aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="segmented" role="radiogroup" aria-label={t('editor.blur.style')}>
          <button type="button" role="radio" aria-checked="true">
            {t('editor.blur.blur')}
          </button>
          <button type="button" role="radio" aria-checked="false" disabled>
            {t('editor.blur.pixels')} {soon}
          </button>
          <button type="button" role="radio" aria-checked="false" disabled>
            {t('editor.blur.solid')} {soon}
          </button>
        </div>
        <div className="field blur-intensity">
          <label htmlFor="blur-int">
            {t('editor.blur.intensity')} {soon}
          </label>
          <div className="row-3">
            <input
              id="blur-int"
              type="range"
              min={2}
              max={20}
              value={10}
              disabled
              readOnly
              className="grow"
            />
            <input
              className="input input-sm num"
              value="10"
              disabled
              readOnly
              aria-label={t('editor.blur.intensityValue')}
            />
          </div>
        </div>
      </div>

      <div className="sec">
        <div className="sec-title">
          {t('editor.blur.applyTo')}
          {soon}
        </div>
        <div className="segmented" role="radiogroup" aria-label={t('editor.blur.applyTo')}>
          <button type="button" role="radio" aria-checked="true" disabled>
            {t('editor.blur.thisStep')}
          </button>
          <button type="button" role="radio" aria-checked="false" disabled>
            {t('editor.blur.allSteps')}
          </button>
        </div>
        <div className="alert alert-info blur-info">
          <Info aria-hidden="true" />
          <span className="t-caption">{t('editor.blur.info')}</span>
        </div>
      </div>
    </div>
  );
}
