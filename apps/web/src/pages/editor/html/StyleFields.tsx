import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { FONT_WEIGHTS, type HtmlStyle } from '@flowdsiml/core';
import type { MultiEl } from '@flowdsiml/player-core';
import { contrastRatio } from '../../../lib/contrast';
import type { DemoEditor } from '../useDemoEditor';
import type { StepRow } from '../types';
import { commonShort } from './HtmlCanvas';
import { addStyleOp, frameSend, htmlSteps, setHtmlEdit, useHtmlEdit } from './htmlModel';
import { Select, ColorSwatch } from '@flowdsiml/ui';

const HEX = /^#[0-9A-Fa-f]{6}$/;
export const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48] as const;

/** Contraste le plus faible d'une couleur de texte sur le fond de chaque élément. */
export function weakestContrast(color: string, els: Array<Pick<MultiEl, 'bg'>>): number {
  return Math.min(...els.map((e) => contrastRatio(color, e.bg)));
}

/** Propriétés modifiées seulement (« Inchangée » = absente). */
export function stylePatch(f: {
  color: string;
  background: string;
  fontSize: string;
  fontWeight: string;
}): HtmlStyle {
  const v: HtmlStyle = {};
  if (HEX.test(f.color)) v.color = f.color.toUpperCase();
  if (HEX.test(f.background)) v.background = f.background.toUpperCase();
  if (f.fontSize) v.fontSize = Number(f.fontSize);
  if ((FONT_WEIGHTS as readonly string[]).includes(f.fontWeight))
    v.fontWeight = f.fontWeight as HtmlStyle['fontWeight'];
  return v;
}

/**
 * L25-07 : panneau « n éléments sélectionnés ». Couleur du texte (contraste le plus faible sur le
 * fond de chaque élément, alerte sous 4,5:1), Taille, Graisse, Fond (« Inchangée » par défaut).
 * « Appliquer » : une seule modification, sur cette étape ou toutes les étapes HTML.
 */
export function StyleFields({
  editor,
  step,
  readOnly,
}: {
  editor: DemoEditor;
  step: StepRow;
  readOnly: boolean;
}) {
  const { t, i18n } = useTranslation();
  const ed = useHtmlEdit(step.id);
  const els = ed.multi;
  const [f, setF] = useState({ color: '', background: '', fontSize: '', fontWeight: '' });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const patch = stylePatch(f);
  const empty = Object.keys(patch).length === 0;
  const n = htmlSteps(editor).length;
  const short = commonShort(els);
  const ratio = patch.color ? weakestContrast(patch.color, els) : null;
  const fmt = (r: number) => r.toLocaleString(i18n.language, { maximumFractionDigits: 1 });

  function apply() {
    if (readOnly || empty) return;
    addStyleOp(
      editor,
      step,
      els.map((e) => e.sel),
      patch,
      short,
      ed.scope,
    );
    setF({ color: '', background: '', fontSize: '', fontWeight: '' });
  }

  const color = (k: 'color' | 'background', label: string) => (
    <div className="field">
      <label htmlFor={`st-${k}`}>{label}</label>
      <div className="st-color">
        <ColorSwatch
          label={t('editor.data.pick', { label })}
          labels={{
            palette: t('common.colorPalette'),
            shade: t('common.colorShade'),
            hue: t('common.colorHue'),
            hex: t('common.colorHex'),
          }}
          value={
            HEX.test(f[k]) ? f[k] : k === 'color' ? (els[0]?.color ?? '#000000') : (els[0]?.bg ?? '#FFFFFF')
          }
          disabled={readOnly}
          onChange={(c) => set(k, c)}
        />
        <input
          id={`st-${k}`}
          className="input input-sm"
          value={f[k]}
          placeholder={k === 'background' ? t('editor.data.unchangedM') : t('editor.data.unchanged')}
          maxLength={7}
          disabled={readOnly}
          aria-invalid={f[k] !== '' && !HEX.test(f[k])}
          onChange={(e) => set(k, e.target.value.trim())}
        />
        {f[k] && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={readOnly}
            onClick={() => set(k, '')}
          >
            {t('editor.data.reset')}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="sec st-fields">
      <div className="sec-title">{t('editor.data.multiTitle', { count: els.length })}</div>
      <p className="help" style={{ marginTop: 0 }}>
        {t('editor.data.multiHelp')}
      </p>
      <div className="st-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => frameSend.current?.({ t: 'similar' })}
        >
          {t('editor.data.similar', { count: ed.selected?.similar ?? els.length })}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            frameSend.current?.({ t: 'multi-clear' });
            setHtmlEdit({ multi: [] });
          }}
        >
          {t('editor.data.clearMulti')}
        </button>
      </div>
      <h3 className="dt-sub">{t('editor.data.style')}</h3>
      {color('color', t('editor.data.color'))}
      {ratio !== null && (
        <p className={ratio < 4.5 ? 'st-contrast is-low' : 'st-contrast'} role="status">
          {ratio < 4.5 && <AlertTriangle size={14} aria-hidden="true" />}
          {ratio < 4.5
            ? t('editor.data.contrastLow', { ratio: fmt(ratio) })
            : t('editor.data.contrast', { ratio: fmt(ratio) })}
        </p>
      )}
      <div className="st-row">
        <div className="field">
          <label htmlFor="st-size">{t('editor.data.size')}</label>
          <Select
            id="st-size"
            size="sm"
            value={f.fontSize}
            disabled={readOnly}
            onChange={(e) => set('fontSize', e.target.value)}
          >
            <option value="">{t('editor.data.unchanged')}</option>
            {FONT_SIZES.map((s) => (
              <option key={s} value={String(s)}>
                {t('editor.data.px', { n: s })}
              </option>
            ))}
          </Select>
        </div>
        <div className="field">
          <label htmlFor="st-weight">{t('editor.data.weight')}</label>
          <Select
            id="st-weight"
            size="sm"
            value={f.fontWeight}
            disabled={readOnly}
            onChange={(e) => set('fontWeight', e.target.value)}
          >
            <option value="">{t('editor.data.unchanged')}</option>
            {FONT_WEIGHTS.map((w) => (
              <option key={w} value={w}>
                {t(`editor.data.weight_${w}`)}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {color('background', t('editor.data.background'))}
      <div className="field" style={{ marginTop: 10 }}>
        <span className="label" id="st-apply">
          {t('editor.html.apply')}
        </span>
        <div className="segmented" role="radiogroup" aria-labelledby="st-apply">
          {(['step', 'all'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={ed.scope === s}
              tabIndex={ed.scope === s ? 0 : -1}
              disabled={readOnly}
              onClick={() => setHtmlEdit({ scope: s })}
            >
              {s === 'step' ? t('editor.html.applyStep') : t('editor.html.applyAll', { n })}
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="btn btn-primary btn-sm st-apply"
        disabled={readOnly || empty}
        onClick={apply}
      >
        {t('editor.data.applyBtn')}
      </button>
      <p className="help">{t('editor.data.applyHelp')}</p>
    </div>
  );
}
