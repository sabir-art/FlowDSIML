import { useTranslation } from 'react-i18next';
import { Button, Field } from '@flowdsiml/ui';
import type { DemoEditor } from '../useDemoEditor';
import { asCta, asRects, asZoom, type Selection, type StepRow } from '../types';
import { RichTextField } from '../RichTextField';
import { CtaFields } from './CtaFields';

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
  const zoom = asZoom(step.zoom);
  const blurs = asRects(step.blurs);
  const varKeys = editor.variables.map((v) => v.key);
  const hotspots = editor.hotspots.filter((h) => h.step_id === step.id);

  return (
    <div className="stack">
      <h3 className="panel-title">{t('editor.stepN', { n: index + 1 })}</h3>
      <Field label={t('editor.stepTitle')} htmlFor="st-title">
        <input
          id="st-title"
          className="fd-input"
          maxLength={200}
          disabled={readOnly}
          value={step.title}
          onChange={(e) => editor.updateStep(step.id, { title: e.target.value })}
        />
      </Field>
      {step.kind === 'text' && (
        <RichTextField
          id="st-body"
          label={t('editor.stepBody')}
          value={step.body}
          variables={varKeys}
          disabled={readOnly}
          onChange={(v) => editor.updateStep(step.id, { body: v })}
        />
      )}

      <Field label={t('editor.chapter')} htmlFor="st-chapter">
        <select
          id="st-chapter"
          className="fd-select"
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
      </Field>

      <Field label={t('editor.gateForm')} htmlFor="st-gate">
        <select
          id="st-gate"
          className="fd-select"
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
      </Field>

      {step.kind === 'image' && (
        <fieldset className="panel-fieldset">
          <legend>
            <label>
              <input
                type="checkbox"
                checked={!!zoom}
                disabled={readOnly}
                onChange={(e) =>
                  editor.updateStep(step.id, {
                    zoom: e.target.checked ? { x: 0.5, y: 0.5, scale: 1.5 } : null,
                  })
                }
              />{' '}
              {t('editor.zoom')}
            </label>
          </legend>
          {zoom && (
            <>
              {(['x', 'y'] as const).map((k) => (
                <Field key={k} label={t(`editor.zoom_${k}`)} htmlFor={`zoom-${k}`}>
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
                </Field>
              ))}
              <Field label={t('editor.zoomScale', { v: zoom.scale.toFixed(1) })} htmlFor="zoom-s">
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
              </Field>
            </>
          )}
        </fieldset>
      )}

      <CtaFields
        idPrefix="st"
        value={asCta(step.cta)}
        disabled={readOnly}
        onChange={(v) => editor.updateStep(step.id, { cta: v })}
      />

      {step.kind === 'image' && (
        <div>
          <div className="fd-label">{t('editor.hotspots')}</div>
          {hotspots.length === 0 && <p className="fd-muted">{t('editor.noHotspot')}</p>}
          {hotspots.map((h, i) => (
            <Button
              key={h.id}
              size="sm"
              variant="ghost"
              onClick={() => setSelection({ kind: 'hotspot', id: h.id })}
            >
              {i + 1}. {h.title || t('editor.untitled')}
            </Button>
          ))}
          <div className="fd-label" style={{ marginTop: 8 }}>
            {t('editor.blurs')} ({blurs.length})
          </div>
          {blurs.map((_, i) => (
            <Button
              key={i}
              size="sm"
              variant="ghost"
              onClick={() => setSelection({ kind: 'blur', index: i })}
            >
              {t('editor.blurN', { n: i + 1 })}
            </Button>
          ))}
        </div>
      )}

      {step.page_url && (
        <p className="fd-muted" style={{ fontSize: 12, wordBreak: 'break-all' }}>
          {t('editor.capturedOn')} {step.page_url}
        </p>
      )}

      {!readOnly && (
        <Button
          variant="ghost"
          className="btn-danger-ghost"
          onClick={() => {
            if (confirm(t('editor.confirmDeleteStep'))) void editor.deleteStep(step.id);
          }}
        >
          {t('editor.deleteStep')}
        </Button>
      )}
    </div>
  );
}
