import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  MousePointerClick,
  PenLine,
  Plus,
  StepForward,
  X,
} from 'lucide-react';
import { Menu } from '../../../components/Menu';
import { dropGuideStep, GUIDE_MAX, moveGuideStep, type GuideRow, type GuideStepRef } from './sandboxGuide';

const ICON = { size: 16, 'aria-hidden': true } as const;

/**
 * A8 : liste « Étapes du guide » du plan du Sandbox (spec a8-guide-sandbox §3.2-3.3). Une ligne par
 * étape (numéro, bulle, page, avance, menu « Plus d'actions ») ; ordre par glisser-déposer ou au
 * clavier (Monter, Descendre, annoncés) ; étape orpheline signalée ; 30 étapes au plus.
 */
export function GuideList({
  rows,
  readOnly,
  onChange,
  onEdit,
  onAdd,
}: {
  rows: GuideRow[];
  readOnly: boolean;
  onChange: (list: GuideStepRef[]) => void;
  onEdit: (row: GuideRow) => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const [drag, setDrag] = useState<number | null>(null);
  const [said, setSaid] = useState('');
  const list: GuideStepRef[] = rows.map(({ page, hotspot, advance }) => ({ page, hotspot, advance }));
  const full = rows.length >= GUIDE_MAX;
  const move = (i: number, d: -1 | 1) => {
    onChange(moveGuideStep(list, i, d));
    setSaid(t('editor.sandbox.guideMoved', { n: i + 1, to: i + 1 + d }));
  };
  return (
    <section className="sb-guide" aria-labelledby="sb-guide-h">
      <h3 id="sb-guide-h" className="sec-title">
        {t('editor.sandbox.guideSteps', { count: rows.length })}
      </h3>
      {rows.length === 0 ? (
        <p className="help">{t('editor.sandbox.guideEmpty')}</p>
      ) : (
        <ol className="sb-guide__list">
          {rows.map((r, i) => (
            <li
              key={`${r.hotspot}-${i}`}
              className={`sb-guide__row${r.orphan ? ' is-orphan' : ''}${drag === i ? ' is-drag' : ''}`}
              draggable={!readOnly}
              onDragStart={(e) => {
                setDrag(i);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => drag !== null && e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (drag !== null) onChange(dropGuideStep(list, drag, i));
                setDrag(null);
              }}
              onDragEnd={() => setDrag(null)}
            >
              <span className="sb-guide__n">{r.n}</span>
              <span className="sb-guide__body">
                <span className="sb-guide__title">
                  {r.orphan && <AlertTriangle {...ICON} className="sb-guide__warn" />}
                  {r.title || t('editor.sandbox.guideNoTitle')}
                </span>
                {r.orphan ? (
                  <span className="sb-guide__meta sb-guide__orphan">{t('editor.sandbox.guideOrphan')}</span>
                ) : (
                  <span className="sb-guide__meta">
                    {r.pageTitle} ·{' '}
                    {t(r.advance === 'next' ? 'editor.sandbox.guideOnNext' : 'editor.sandbox.guideOnClick')}
                  </span>
                )}
              </span>
              {!readOnly && (
                <Menu
                  label={t('editor.sandbox.guideMore', { n: r.n })}
                  items={[
                    ...(r.orphan && !r.pageTitle
                      ? []
                      : [
                          {
                            label: t('editor.sandbox.guideEdit'),
                            icon: <PenLine />,
                            onSelect: () => onEdit(r),
                          },
                        ]),
                    {
                      label: t('editor.sandbox.guideUp'),
                      icon: <ArrowUp />,
                      disabled: i === 0,
                      onSelect: () => move(i, -1),
                    },
                    {
                      label: t('editor.sandbox.guideDown'),
                      icon: <ArrowDown />,
                      disabled: i === rows.length - 1,
                      onSelect: () => move(i, 1),
                    },
                    r.advance === 'next'
                      ? {
                          label: t('editor.sandbox.guideAdvClick'),
                          icon: <MousePointerClick />,
                          onSelect: () =>
                            onChange(list.map((g, k) => (k === i ? { ...g, advance: 'click' } : g))),
                        }
                      : {
                          label: t('editor.sandbox.guideAdvNext'),
                          icon: <StepForward />,
                          onSelect: () =>
                            onChange(list.map((g, k) => (k === i ? { ...g, advance: 'next' } : g))),
                        },
                    'separator' as const,
                    {
                      label: t('editor.sandbox.guideRemove'),
                      icon: <X />,
                      danger: true,
                      onSelect: () => onChange(list.filter((_, k) => k !== i)),
                    },
                  ]}
                />
              )}
            </li>
          ))}
        </ol>
      )}
      <p className="sr-only" aria-live="polite">
        {said}
      </p>
      {!readOnly && (
        <>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            aria-disabled={full || undefined}
            aria-describedby={full ? 'sb-guide-max' : undefined}
            onClick={() => !full && onAdd()}
          >
            <Plus {...ICON} />
            {t('editor.sandbox.guideAdd')}
          </button>
          {full && (
            <p id="sb-guide-max" className="help">
              {t('editor.sandbox.guideMax')}
            </p>
          )}
        </>
      )}
    </section>
  );
}
