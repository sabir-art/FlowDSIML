import { Play, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { maxScroll } from '@flowdsiml/player-core';
import type { StepAnimation } from '@flowdsiml/manifest';
import type { DemoEditor } from '../useDemoEditor';
import { asStepOptions, type StepRow } from '../types';
import { defaultAnimation, typedPii } from './animation';

/** Demande au canevas de rejouer l'animation de l'étape (« Prévisualiser l'animation »). */
export const previewAnimation = (stepId: string) =>
  window.dispatchEvent(new CustomEvent('fd:anim-preview', { detail: stepId }));
/** Demande à l'éditeur l'outil « Choisir un champ » (clic sur le canevas). */
export const pickField = () => window.dispatchEvent(new CustomEvent('fd:pick-field'));

const SPEEDS = ['slow', 'normal', 'fast'] as const;
const DURATIONS = [0.6, 1.2, 2] as const;

/** L25-04/05 : section « Animation de l'étape » (Aucune, Saisie, Défilement). */
export function AnimationFields({
  editor,
  step,
  readOnly,
}: {
  editor: DemoEditor;
  step: StepRow;
  readOnly: boolean;
}) {
  const { t, i18n } = useTranslation();
  const opts = asStepOptions(step.options);
  const anim = opts.animation;
  const fp = opts.fullPage ?? null;
  const raw = (step.options ?? {}) as Record<string, unknown>;
  const write = (a: StepAnimation | undefined) => {
    const next = { ...raw };
    if (a) next.animation = a;
    else delete next.animation;
    editor.updateStep(step.id, { options: next as unknown as StepRow['options'] });
  };
  const patch = (p: Partial<StepAnimation>) => anim && write({ ...anim, ...p } as StepAnimation);
  const type = anim?.type ?? 'none';
  const pii = anim?.type === 'typing' ? typedPii(anim.text) : [];
  const nf = (n: number) => n.toLocaleString(i18n.language);

  return (
    <div className="sec cap-anim">
      <div className="sec-title">{t('editor.capture.anim')}</div>
      <div className="segmented" role="radiogroup" aria-label={t('editor.capture.anim')}>
        {(['none', 'typing', 'scroll'] as const).map((k) => {
          const off = k === 'scroll' && !fp;
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={type === k}
              disabled={readOnly || off}
              aria-describedby={off ? 'cap-anim-recap' : undefined}
              onClick={() => write(k === 'none' ? undefined : defaultAnimation(k, step.element_meta, fp))}
            >
              {t(`editor.capture.anim_${k}`)}
            </button>
          );
        })}
      </div>
      <p className="help">{t('editor.capture.animHelp')}</p>
      {!fp && (
        <p className="help" id="cap-anim-recap">
          {t('editor.capture.scrollRecapture')}
        </p>
      )}

      {anim?.type === 'typing' && (
        <>
          <div className="field">
            <label className="t-label" htmlFor="cap-typed">
              {t('editor.capture.typed')}
            </label>
            <input
              id="cap-typed"
              className="input input-sm"
              value={anim.text}
              maxLength={200}
              disabled={readOnly}
              aria-describedby="cap-typed-h"
              aria-invalid={pii.length > 0 || undefined}
              onChange={(e) => patch({ text: e.target.value })}
            />
            <span className="help" id="cap-typed-h">
              {t('editor.capture.typedHelp')}
            </span>
            {pii.length > 0 && (
              // Vérification des données (F1 §1) : signalée comme sur une capture
              <div className="alert alert-warning cap-pii" role="alert">
                <TriangleAlert aria-hidden="true" />
                <span>
                  {t('editor.capture.typedPii', {
                    types: pii.map((p) => t(`editor.capture.pii_${p}`)).join(', '),
                  })}
                </span>
              </div>
            )}
          </div>
          <div className="field cap-field">
            <span className="help">
              {anim.field
                ? anim.fieldLabel
                  ? t('editor.capture.fieldFound', { label: anim.fieldLabel })
                  : t('editor.capture.fieldChosen')
                : t('editor.capture.fieldNone')}
            </span>
            {!readOnly && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={pickField}>
                {anim.field ? t('editor.capture.fieldOther') : t('editor.capture.fieldPick')}
              </button>
            )}
          </div>
          <span className="t-label" id="cap-speed">
            {t('editor.capture.speed')}
          </span>
          <div className="segmented" role="radiogroup" aria-labelledby="cap-speed">
            {SPEEDS.map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={anim.speed === v}
                disabled={readOnly}
                onClick={() => patch({ speed: v })}
              >
                {t(`editor.capture.speed_${v}`)}
              </button>
            ))}
          </div>
        </>
      )}

      {anim?.type === 'scroll' && fp && (
        <>
          <span className="t-label" id="cap-dir">
            {t('editor.capture.direction')}
          </span>
          <div className="segmented" role="radiogroup" aria-labelledby="cap-dir">
            {(['down', 'up'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={anim.direction === v}
                disabled={readOnly || maxScroll(fp, v) === 0}
                onClick={() =>
                  patch({
                    direction: v,
                    distance: Math.min(anim.distance, maxScroll(fp, v)) || maxScroll(fp, v),
                  })
                }
              >
                {t(`editor.capture.dir_${v}`)}
              </button>
            ))}
          </div>
          <div className="field">
            <label className="t-label" htmlFor="cap-dist">
              {t('editor.capture.distance')}
            </label>
            <input
              id="cap-dist"
              className="input input-sm num"
              type="number"
              min={0}
              max={maxScroll(fp, anim.direction)}
              value={Math.round(anim.distance)}
              disabled={readOnly}
              aria-describedby="cap-dist-h"
              onChange={(e) =>
                patch({
                  distance: Math.min(maxScroll(fp, anim.direction), Math.max(0, Number(e.target.value) || 0)),
                })
              }
            />
            <span className="help" id="cap-dist-h">
              {t('editor.capture.distanceHelp', { max: nf(maxScroll(fp, anim.direction)) })}
            </span>
          </div>
          <span className="t-label" id="cap-dur">
            {t('editor.capture.duration')}
          </span>
          <div className="segmented" role="radiogroup" aria-labelledby="cap-dur">
            {DURATIONS.map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={anim.duration === v}
                disabled={readOnly}
                onClick={() => patch({ duration: v })}
              >
                {`${nf(v)}\u202fs`}
              </button>
            ))}
          </div>
        </>
      )}

      {anim && (
        <button
          type="button"
          className="btn btn-secondary btn-sm cap-preview"
          onClick={() => previewAnimation(step.id)}
        >
          <Play aria-hidden="true" />
          {t('editor.capture.preview')}
        </button>
      )}
    </div>
  );
}
