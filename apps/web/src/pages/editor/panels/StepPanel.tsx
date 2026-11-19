import { useConfirm } from '../../../components/ConfirmDialog';
import { EyeOff, Lock, Presentation, Target, Trash2, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DemoEditor } from '../useDemoEditor';
import { asCta, asRects, asStepOptions, asZoom, type Selection, type StepRow } from '../types';
import { RichTextField } from '../RichTextField';
import { VariablePreview } from '../VariablePreview';
import { CtaFields } from './CtaFields';
import { GuidedStepFields } from './GuidedStepFields';
import { NextRulesFields } from './NextRulesFields';
import { BeforeAfterFields } from '../BeforeAfterEditor';
import { AbSection, type AbState } from '../ab/AbTest';
import { usePlan } from '../../../lib/plan';
import { VideoFields } from '../video/VideoFields';
import { HtmlFields } from '../html/HtmlFields';
import { CaptureTabFields } from '../capture/CaptureFields';
import { AnimationFields } from '../capture/AnimationFields';

export function StepPanel({
  editor,
  step,
  index,
  readOnly,
  setSelection,
  ab,
}: {
  editor: DemoEditor;
  step: StepRow;
  index: number;
  readOnly: boolean;
  setSelection: (s: Selection) => void;
  /** L18 : test A/B de la démo (section « Test A/B » des étapes à bulle). */
  ab?: AbState;
}) {
  const { t } = useTranslation();
  const [dialog, ask] = useConfirm();
  const zoom = asZoom(step.zoom);
  const zoomExtra = (step.zoom ?? {}) as { transition?: 'smooth' | 'instant'; keep?: boolean };
  const setZoom = (p: Record<string, unknown>) =>
    editor.updateStep(step.id, {
      zoom: { ...(step.zoom as Record<string, unknown>), ...p } as StepRow['zoom'],
    });
  /** Centre borné : le cadre de zoom reste dans l'image. */
  const center = (x: number, y: number, scale: number) => {
    const half = 0.5 / scale;
    const c = (v: number) => Math.round(Math.min(1 - half, Math.max(half, v)) * 10000) / 10000;
    return { x: c(x), y: c(y) };
  };
  const firstHotspot = editor.hotspots
    .filter((h) => h.step_id === step.id)
    .sort((a, b) => a.position - b.position)[0];
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

      {step.kind === 'before_after' && <BeforeAfterFields editor={editor} step={step} readOnly={readOnly} />}
      {step.kind === 'video' && <VideoFields editor={editor} step={step} readOnly={readOnly} />}
      {step.kind === 'html' && <HtmlFields editor={editor} step={step} readOnly={readOnly} />}

      {step.kind !== 'before_after' && step.kind !== 'video' && (
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
      )}

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
                    zoom: e.target.checked
                      ? { x: 0.5, y: 0.5, scale: 2, transition: 'smooth', keep: false }
                      : null,
                  })
                }
              />
              <span />
            </span>
          </div>
          {zoom && (
            <>
              {/* L12-02 : niveau, position en %, centrage sur le hotspot, mouvement */}
              <span className="label" id="zl">
                {t('editor.zoomLevel')}
              </span>
              <div className="segmented zoom-levels" role="radiogroup" aria-labelledby="zl">
                {[1.5, 2, 3].map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={Math.abs(zoom.scale - v) < 0.05}
                    disabled={readOnly}
                    onClick={() => setZoom({ scale: v, ...center(zoom.x, zoom.y, v) })}
                  >
                    {Math.round(v * 100)}&nbsp;%
                  </button>
                ))}
              </div>
              <p className="help zoom-help">{t('editor.zoomHelp')}</p>
              <div className="zoom-pos">
                {(['x', 'y'] as const).map((k) => (
                  <div key={k} className="field">
                    <label htmlFor={`zoom-${k}`}>{t(`editor.zoom_${k}`)}</label>
                    <div className="input-affix-r">
                      <input
                        id={`zoom-${k}`}
                        className="input input-sm"
                        type="number"
                        min={0}
                        max={100}
                        disabled={readOnly}
                        value={Math.round(zoom[k] * 100)}
                        onChange={(e) => {
                          const v = Number(e.target.value) / 100;
                          const p = { x: zoom.x, y: zoom.y, [k]: v };
                          setZoom(center(p.x, p.y, zoom.scale));
                        }}
                      />
                      <span aria-hidden="true">%</span>
                    </div>
                  </div>
                ))}
              </div>
              {firstHotspot && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm zoom-center"
                  disabled={readOnly}
                  onClick={() =>
                    setZoom(
                      center(
                        firstHotspot.x + firstHotspot.w / 2,
                        firstHotspot.y + firstHotspot.h / 2,
                        zoom.scale,
                      ),
                    )
                  }
                >
                  <Target aria-hidden="true" />
                  {t('editor.zoomCenter')}
                </button>
              )}
              <div className="sec-sub">{t('editor.zoomMotion')}</div>
              <span className="label" id="zt">
                {t('editor.zoomTransition')}
              </span>
              <div className="segmented zoom-levels" role="radiogroup" aria-labelledby="zt">
                {(['smooth', 'instant'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={(zoomExtra.transition ?? 'smooth') === v}
                    disabled={readOnly}
                    onClick={() => setZoom({ transition: v })}
                  >
                    {t(`editor.zoomTr.${v}`)}
                  </button>
                ))}
              </div>
              <div className="setting">
                <span className="t-label" id="zoom-keep">
                  {t('editor.zoomKeep')}
                </span>
                <span className="switch">
                  <input
                    type="checkbox"
                    aria-labelledby="zoom-keep"
                    checked={!!zoomExtra.keep}
                    disabled={readOnly}
                    onChange={(e) => setZoom({ keep: e.target.checked })}
                  />
                  <span />
                </span>
              </div>
              <p className="help zoom-help">{t('editor.zoomMotionHelp')}</p>
            </>
          )}
        </div>
      )}

      {step.kind === 'image' && <AnimationFields editor={editor} step={step} readOnly={readOnly} />}
      {step.kind === 'image' && <CaptureTabFields editor={editor} step={step} readOnly={readOnly} />}

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
            <option value="">{editor.forms.length ? t('common.none') : t('editor.noFormShort')}</option>
            {editor.forms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
          </select>
          {/* L18-01 : libellé court dans le select, explication en aide */}
          {!editor.forms.length && <p className="help">{t('editor.noForm')}</p>}
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

      {/* L25-10 : « Suite de l'étape » (un menu de choix a ses propres règles, L22-09) */}
      {!asStepOptions(step.options).choices.length && (
        <div className="sec">
          <NextRulesFields editor={editor} step={step} index={index} readOnly={readOnly} />
        </div>
      )}

      {ab && <AbSection editor={editor} step={step} index={index} readOnly={readOnly} ab={ab} />}

      {/* L22-01 : notes du présentateur, jamais publiées ni exportées */}
      <div className="sec notes-sec">
        <div className="sec-title">
          <Presentation aria-hidden="true" />
          {t('editor.notes.title')}
          <span className="lock">
            <Lock aria-hidden="true" />
            {t('editor.notes.private')}
          </span>
        </div>
        <div className="field">
          <label className="sr-only" htmlFor="st-notes">
            {t('editor.notes.label')}
          </label>
          <textarea
            id="st-notes"
            className="textarea"
            maxLength={1000}
            aria-describedby="st-notes-h"
            readOnly={readOnly}
            value={step.presenter_notes ?? ''}
            onChange={(e) => editor.updateStep(step.id, { presenter_notes: e.target.value.slice(0, 1000) })}
          />
        </div>
        <p className="help" id="st-notes-h">
          {t('editor.notes.help')}
        </p>
      </div>
    </div>
  );
}
