import { useConfirm } from '../../../components/ConfirmDialog';
import { EyeOff, Target, Trash2, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DemoEditor } from '../useDemoEditor';
import { asCta, asRects, asZoom, type Selection, type StepRow } from '../types';
import { RichTextField } from '../RichTextField';
import { VariablePreview } from '../VariablePreview';
import { CtaFields } from './CtaFields';
import { GuidedStepFields } from './GuidedStepFields';
import { usePlan } from '../../../lib/plan';

export function StepPanel({
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
  const [dialog, ask] = useConfirm();
  const zoom = asZoom(step.zoom);
  const blurs = asRects(step.blurs);
  const varKeys = editor.variables.map((v) => v.key);
  const plan = usePlan();
  const hotspots = editor.hotspots.filter((h) => h.step_id === step.id);

  const last = index === editor.steps.length - 1;
  const textTitle = last ? t('editor.end.title') : t('editor.end.textTitle');
  const soon = <span className="badge badge-xs">{t('shell.soon')}</span>;

  return (
    <div className="sp-panel">
      {dialog}
      <div className="sec">
        <div className="sec-title">
          {step.kind === 'text' ? textTitle : t('editor.stepN', { n: index + 1 })}
          {!readOnly && (
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon"
              aria-label={t('editor.deleteStep')}
              title={t('editor.deleteStep')}
              onClick={() => {
                void ask({
                  title: t('editor.confirmDeleteStep'),
                  confirmLabel: t('common.delete'),
                  danger: true,
                }).then((yes) => yes && void editor.deleteStep(step.id));
              }}
            >
              <Trash2 aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="field">
          <label htmlFor="st-title">
            {step.kind === 'text' ? t('editor.hs.title') : t('editor.stepTitle')}
          </label>
          <input
            id="st-title"
            className="input input-sm"
            maxLength={200}
            disabled={readOnly}
            value={step.title}
            onChange={(e) => editor.updateStep(step.id, { title: e.target.value })}
          />
          <VariablePreview text={step.title} variables={editor.variables} />
        </div>
        {step.kind === 'text' && (
          <>
            <RichTextField
              mk
              id="st-body"
              label={t('editor.hs.text')}
              value={step.body}
              variables={varKeys}
              disabled={readOnly}
              onChange={(v) => editor.updateStep(step.id, { body: v })}
            />
            <VariablePreview text={step.body} variables={editor.variables} />
          </>
        )}
        {step.page_url && (
          <p className="help sp-url">
            {t('editor.capturedOn')} {step.page_url}
          </p>
        )}
      </div>

      <div className="sec">
        <div className="sec-title">
          {step.kind === 'text' ? t('editor.end.primary') : t('editor.end.stepCta')}
        </div>
        <CtaFields
          idPrefix="st"
          label={t('editor.end.showButton')}
          value={asCta(step.cta)}
          disabled={readOnly}
          onChange={(v) => editor.updateStep(step.id, { cta: v })}
        />
      </div>

      {step.kind === 'text' && last && (
        <div className="sec">
          <div className="sec-title">
            {t('editor.end.secondary')}
            {soon}
          </div>
          <div className="field">
            <label htmlFor="st-sec">{t('editor.ctaLabel')}</label>
            <input id="st-sec" className="input input-sm" disabled readOnly value={t('editor.end.restart')} />
          </div>
        </div>
      )}

      {step.kind === 'image' && (
        <div className="sec">
          <div className="sec-title">{t('editor.end.elements')}</div>
          {hotspots.length === 0 && blurs.length === 0 && <p className="help">{t('editor.noHotspot')}</p>}
          {hotspots.map((h, i) => (
            <button
              key={h.id}
              type="button"
              className="field-row sp-item"
              onClick={() => setSelection({ kind: 'hotspot', id: h.id })}
            >
              <Target aria-hidden="true" />
              <span className="grow">
                {i + 1}. {h.title || t('editor.untitled')}
              </span>
            </button>
          ))}
          {blurs.map((_, i) => (
            <button
              key={i}
              type="button"
              className="field-row sp-item"
              onClick={() => setSelection({ kind: 'blur', index: i })}
            >
              <EyeOff aria-hidden="true" />
              <span className="grow">{t('editor.blurN', { n: i + 1 })}</span>
            </button>
          ))}
        </div>
      )}

      {step.kind === 'image' && (
        <div className="sec">
          <div className="sec-title">{t('editor.zoom')}</div>
          <div className="setting">
            <label className="t-label" htmlFor="zoom-on">
              {t('editor.end.zoomOn')}
            </label>
            <span className="switch">
              <input
                id="zoom-on"
                type="checkbox"
                checked={!!zoom}
                disabled={readOnly}
                onChange={(e) =>
                  editor.updateStep(step.id, {
                    zoom: e.target.checked ? { x: 0.5, y: 0.5, scale: 1.5 } : null,
                  })
                }
              />
              <span />
            </span>
          </div>
          {zoom && (
            <>
              {(['x', 'y'] as const).map((k) => (
                <div key={k} className="field">
                  <label htmlFor={`zoom-${k}`}>{t(`editor.zoom_${k}`)}</label>
                  <input
                    id={`zoom-${k}`}
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    disabled={readOnly}
                    value={zoom[k]}
                    onChange={(e) =>
                      editor.updateStep(step.id, { zoom: { ...zoom, [k]: Number(e.target.value) } })
                    }
                  />
                </div>
              ))}
              <div className="field">
                <label htmlFor="zoom-s">{t('editor.zoomScale', { v: zoom.scale.toFixed(1) })}</label>
                <input
                  id="zoom-s"
                  type="range"
                  min={1}
                  max={4}
                  step={0.1}
                  disabled={readOnly}
                  value={zoom.scale}
                  onChange={(e) =>
                    editor.updateStep(step.id, { zoom: { ...zoom, scale: Number(e.target.value) } })
                  }
                />
              </div>
            </>
          )}
        </div>
      )}

      <div className="sec">
        <div className="sec-title">{t('editor.end.organisation')}</div>
        <div className="field">
          <label htmlFor="st-chapter">{t('editor.chapter')}</label>
          <select
            id="st-chapter"
            className="select input-sm"
            disabled={readOnly}
            value={step.chapter_id ?? ''}
            onChange={(e) => editor.updateStep(step.id, { chapter_id: e.target.value || null })}
          >
            <option value="">{t('common.none')}</option>
            {editor.chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title || t('editor.untitled')}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="st-gate">{t('editor.gateForm')}</label>
          <select
            id="st-gate"
            className="select input-sm"
            disabled={readOnly || !editor.forms.length}
            value={step.gate_form_id ?? ''}
            onChange={(e) => editor.updateStep(step.id, { gate_form_id: e.target.value || null })}
          >
            <option value="">{editor.forms.length ? t('common.none') : t('editor.noForm')}</option>
            {editor.forms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
          </select>
          {step.gate_form_id && !plan.leadForms && (
            <p className="help help-warning">
              <TriangleAlert size={16} aria-hidden="true" />
              {t('planForms.stepHelp')}
            </p>
          )}
        </div>
      </div>

      <div className="sec">
        <GuidedStepFields editor={editor} step={step} index={index} readOnly={readOnly} />
      </div>
    </div>
  );
}
