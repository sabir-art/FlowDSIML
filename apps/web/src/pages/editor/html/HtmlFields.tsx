import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  BarChart3,
  Droplet,
  EyeOff,
  Image,
  Link2,
  Paintbrush,
  PenLine,
  Trash2,
  Undo2,
} from 'lucide-react';
import type { HtmlOp } from '@flowdsiml/core';
import type { DemoEditor } from '../useDemoEditor';
import type { StepRow } from '../types';
import { ChartFields } from './ChartFields';
import { StyleFields } from './StyleFields';
import {
  asOps,
  frameSend,
  htmlSteps,
  opOn,
  removeOp,
  setHtmlEdit,
  shortTrail,
  upsertOp,
  useHtmlEdit,
} from './htmlModel';

const ICON = { size: 16, 'aria-hidden': true } as const;
const OP_ICON: Record<HtmlOp['op'], typeof PenLine> = {
  text: PenLine,
  hide: EyeOff,
  blur: Droplet,
  link: Link2,
  image: Image,
  remove: Trash2,
  style: Paintbrush,
  chart: BarChart3,
};

/**
 * A8 (L20-01) : panneau « Élément · {{sélecteur}} » (texte avec variables, portée « Cette étape » /
 * « Toutes les étapes (n) »), « Modifications de l'étape · n » (une ligne par opération, avec son
 * bouton d'annulation nommé ; élément introuvable signalé sans bloquer) et rappel de sécurité.
 */
export function HtmlFields({
  editor,
  step,
  readOnly,
}: {
  editor: DemoEditor;
  step: StepRow;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const ed = useHtmlEdit(step.id);
  const multi = ed.multi.length > 1;
  const sel = multi ? null : ed.selected;
  const ops = asOps(step.html_ops);
  const textOp = sel ? opOn(step, sel.sel, 'text') : undefined;
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const n = htmlSteps(editor).length;

  useEffect(() => {
    setText(typeof textOp?.value === 'string' ? textOp.value : (sel?.text.trim() ?? ''));
  }, [sel?.sel, textOp?.value]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (ed.focusText) input.current?.focus();
  }, [ed.focusText]);

  function commit() {
    if (!sel || readOnly) return;
    const original = textOp?.before ?? sel.text.trim();
    if (text === (typeof textOp?.value === 'string' ? textOp.value : original)) return;
    if (text === original && textOp) return removeOp(editor, step, textOp.id);
    upsertOp(
      editor,
      step,
      { sel: sel.sel, op: 'text', value: text, before: original.slice(0, 200) },
      ed.scope,
    );
  }

  const stepNumber = (id?: string) => editor.steps.findIndex((s) => s.id === id) + 1;
  function describe(o: HtmlOp): string {
    switch (o.op) {
      case 'text':
        return t('editor.html.modText', {
          before: o.before ?? '',
          after: typeof o.value === 'string' ? o.value : '',
        });
      case 'hide':
        return o.before ? t('editor.html.modHidden', { before: o.before }) : t('editor.html.modHiddenEmpty');
      case 'blur':
        return t('editor.html.modBlur');
      case 'link':
        return t('editor.html.modLink', { n: stepNumber(typeof o.value === 'string' ? o.value : '') });
      case 'style':
        return t('editor.data.modStyle', { count: o.sels?.length ?? 1 });
      case 'chart':
        return t('editor.data.modChart', {
          title:
            (o.value && typeof o.value === 'object' && 'rows' in o.value && o.value.title) || o.before || '',
        });
      case 'remove':
        return t('editor.html.modRemove');
      default:
        return '';
    }
  }

  return (
    <>
      {multi && <StyleFields editor={editor} step={step} readOnly={readOnly} />}
      {sel?.chart && <ChartFields editor={editor} step={step} chart={sel.chart} readOnly={readOnly} />}
      {sel && !sel.chart && (
        <div className="sec">
          <div className="sec-title">{t('editor.html.element', { sel: sel.short })}</div>
          <div className="field">
            <label htmlFor="html-text">{t('editor.html.text')}</label>
            <input
              id="html-text"
              ref={input}
              className="input input-sm"
              value={text}
              disabled={readOnly || sel.canvas || sel.img}
              aria-describedby="html-text-help"
              onChange={(e) => setText(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commit();
                }
                e.stopPropagation();
              }}
            />
            <span className="help" id="html-text-help">
              {sel.canvas ? (
                t('editor.html.canvasHelp')
              ) : (
                <>
                  {t('editor.html.textHelp')} <span className="chip-var">{'{{company}}'}</span>.
                </>
              )}
            </span>
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <span className="label" id="html-apply">
              {t('editor.html.apply')}
            </span>
            <div className="segmented" role="radiogroup" aria-labelledby="html-apply">
              {(['step', 'all'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={ed.scope === s}
                  disabled={readOnly}
                  onClick={() => setHtmlEdit({ scope: s })}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                      e.preventDefault();
                      e.stopPropagation();
                      setHtmlEdit({ scope: ed.scope === 'step' ? 'all' : 'step' });
                    }
                  }}
                  tabIndex={ed.scope === s ? 0 : -1}
                >
                  {s === 'step' ? t('editor.html.applyStep') : t('editor.html.applyAll', { n })}
                </button>
              ))}
            </div>
            <span className="help">{t('editor.html.applyHelp')}</span>
          </div>
          {/* L25-07 : sélection multiple (Maj + clic ou les semblables) */}
          {sel.similar > 1 && !readOnly && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ marginTop: 10 }}
              onClick={() => frameSend.current?.({ t: 'similar' })}
            >
              {t('editor.data.similar', { count: sel.similar })}
            </button>
          )}
          <p className="help">{t('editor.data.shiftHelp')}</p>
        </div>
      )}
      <div className="sec">
        <div className="sec-title">{t('editor.html.mods', { count: ops.length })}</div>
        {!ops.length && <p className="muted">{t('editor.html.noMods')}</p>}
        <ul className="mods">
          {ops.map((o) => {
            const nf = ed.notFound.includes(o.id);
            const Icon = nf ? AlertTriangle : OP_ICON[o.op];
            const short = o.op === 'style' ? (o.before ?? shortTrail(o.sel)) : shortTrail(o.sel);
            return (
              <li key={o.id} className={`mod${nf ? ' nf' : ''}`}>
                <Icon {...ICON} />
                <span>
                  <code>{short}</code>
                  {nf ? t('editor.html.notFound') : describe(o)}
                  {o.group && <span className="badge">{t('editor.html.badgeAll')}</span>}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-icon"
                  disabled={readOnly}
                  aria-label={
                    nf
                      ? t('editor.html.deleteMod', { sel: short })
                      : t(`editor.html.undo_${o.op}`, { sel: short })
                  }
                  onClick={() => removeOp(editor, step, o.id)}
                >
                  {nf ? <Trash2 {...ICON} /> : <Undo2 {...ICON} />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="sec">
        <p className="help" style={{ margin: 0 }}>
          {t('editor.html.reminder')}
        </p>
      </div>
    </>
  );
}
