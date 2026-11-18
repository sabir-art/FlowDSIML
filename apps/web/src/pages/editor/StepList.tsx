import {
  ArrowDown,
  AppWindow,
  ArrowUp,
  ClipboardList,
  EyeOff,
  GitBranch,
  ImageOff,
  ImagePlus,
  GripVertical,
  MessageSquare,
  MousePointerClick,
  Plus,
  Target,
  Type,
  ZoomIn,
} from 'lucide-react';
import { Menu } from '../../components/Menu';
import { asStepOptions, type StepRow } from './types';
import { Fragment, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DemoEditor } from './useDemoEditor';

export function StepList({
  editor,
  current,
  onSelect,
  readOnly,
  openComments = {},
  selectedFormId = null,
  onSelectForm,
}: {
  editor: DemoEditor;
  current: number;
  onSelect: (i: number) => void;
  /** EDT-08 : formulaire sélectionné dans le rail. */
  selectedFormId?: string | null;
  onSelectForm?: (stepIndex: number, formId: string) => void;
  readOnly: boolean;
  /** Nombre de commentaires ouverts par étape (badge du rail). */
  openComments?: Record<string, number>;
}) {
  const { t } = useTranslation();
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const chapterTitle = (id: string | null) => editor.chapters.find((c) => c.id === id)?.title;

  const addItems = [
    {
      label: t('editor.addTextStep'),
      icon: <Type />,
      onSelect: () =>
        void editor.addTextStep(current, t('editor.newTextStep')).then(() => onSelect(current + 1)),
    },
    {
      label: t('editor.advanced.stepTypes.popup'),
      icon: <AppWindow />,
      onSelect: () =>
        void editor
          .addTextStep(current, t('editor.advanced.stepTypes.popup'), { display: 'popup' })
          .then(() => onSelect(current + 1)),
    },
    {
      label: t('editor.advanced.stepTypes.choice'),
      icon: <GitBranch />,
      onSelect: () =>
        void editor
          .addTextStep(current, t('editor.advanced.choice.question'), {
            display: 'popup',
            choices: [1, 2].map((n) => ({
              label: t('editor.advanced.choice.option', { n }),
              action: { type: 'end' as const },
            })),
          })
          .then(() => onSelect(current + 1)),
    },
    { label: t('editor.addImageStep'), icon: <ImagePlus />, onSelect: () => file.current?.click() },
    // EDT-08 : le formulaire de lead se place avant l'étape courante (un seul formulaire par démo)
    {
      label: t('editor.leadForm'),
      icon: <ClipboardList />,
      onSelect: () =>
        void (async () => {
          const target = editor.steps[current];
          if (!target) return;
          const form = editor.forms[0] ?? (await editor.createForm());
          if (!form) return;
          await placeForm(form.id, current);
          onSelectForm?.(current, form.id);
        })(),
    },
  ];

  /** Déplacer le formulaire dans le rail = changer l'étape qu'il précède. */
  async function placeForm(formId: string, to: number) {
    const target = editor.steps[to];
    if (!target) return;
    for (const s of editor.steps)
      if (s.gate_form_id === formId && s.id !== target.id) editor.updateStep(s.id, { gate_form_id: null });
    if (target.gate_form_id !== formId) editor.updateStep(target.id, { gate_form_id: formId });
  }

  return (
    <>
      <div className="rail-head">
        <b className="t-label">
          {t('editor.steps')} <span className="subtle">· {editor.steps.length}</span>
        </b>
        {!readOnly && <Menu label={t('editor.addStep')} align="end" icon={<Plus />} items={addItems} />}
      </div>
      <ol className="rail-list" aria-label={t('editor.steps')}>
        {editor.steps.map((s, i) => {
          const url = s.image_path ? editor.imageUrls[s.image_path] : undefined;
          const chapter = chapterTitle(s.chapter_id);
          const showChapter = chapter && chapterTitle(editor.steps[i - 1]?.chapter_id ?? null) !== chapter;
          const form = s.gate_form_id ? editor.forms.find((f) => f.id === s.gate_form_id) : undefined;
          const formSelected = !!form && selectedFormId === form.id;
          return (
            <Fragment key={s.id}>
              {form && (
                <li key={`f-${form.id}`} className="rail-li rail-li--form">
                  <button
                    type="button"
                    className="step step--form"
                    aria-selected={formSelected}
                    onClick={() => onSelectForm?.(i, form.id)}
                  >
                    <span className="n" aria-hidden="true" />
                    <span className="th th--form" aria-hidden="true">
                      <ClipboardList />
                    </span>
                    <span className="meta">
                      <b>{form.title || t('editor.leadForm')}</b>
                      <span className="icons">{t('editor.form.beforeStep', { n: i + 1 })}</span>
                    </span>
                  </button>
                  {!readOnly && (
                    <span className="rail-move">
                      <button
                        type="button"
                        aria-label={t('editor.form.moveUp')}
                        disabled={i === 0}
                        onClick={() =>
                          void placeForm(form.id, i - 1).then(() => onSelectForm?.(i - 1, form.id))
                        }
                      >
                        <ArrowUp aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={t('editor.form.moveDown')}
                        disabled={i === editor.steps.length - 1}
                        onClick={() =>
                          void placeForm(form.id, i + 1).then(() => onSelectForm?.(i + 1, form.id))
                        }
                      >
                        <ArrowDown aria-hidden="true" />
                      </button>
                    </span>
                  )}
                </li>
              )}
              <li
                draggable={!readOnly}
                onDragStart={() => setDragFrom(i)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(i);
                }}
                onDragEnd={() => {
                  setDragFrom(null);
                  setOver(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragFrom !== null && dragFrom !== i) {
                    void editor.moveStep(dragFrom, i);
                    onSelect(i);
                  }
                  setDragFrom(null);
                  setOver(null);
                }}
                className="rail-li"
              >
                {showChapter && <div className="rail-chapter">{chapter}</div>}
                {over === i && dragFrom !== null && dragFrom !== i && (
                  <div className="insert" aria-hidden="true" />
                )}
                <button
                  type="button"
                  className="step"
                  aria-current={i === current && !selectedFormId ? 'step' : undefined}
                  aria-selected={i === current && !selectedFormId}
                  onClick={() => onSelect(i)}
                >
                  {!readOnly && (
                    <span className="grip" aria-hidden="true">
                      <GripVertical />
                    </span>
                  )}
                  <span className="n">{i + 1}</span>
                  <span className="th">
                    {url ? (
                      <img src={url} alt="" />
                    ) : s.kind === 'text' ? (
                      <span className="th-card fd-player-scope">{s.title || t('editor.untitled')}</span>
                    ) : (
                      <ImageOff aria-hidden="true" className="th-missing" />
                    )}
                  </span>
                  <span className="meta">
                    <b>{s.title || t('editor.untitled')}</b>
                    <span className="icons">
                      <StepBadges
                        step={s}
                        hotspots={editor.hotspots.filter((h) => h.step_id === s.id).length}
                      />
                      {(openComments[s.id] ?? 0) > 0 && (
                        <span className="rail-comments">
                          <MessageSquare aria-hidden="true" />
                          <span aria-hidden="true">
                            {openComments[s.id]! > 99 ? '99+' : openComments[s.id]}
                          </span>
                          <span className="sr-only">
                            {t('editor.comments.railBadge', { count: openComments[s.id] })}
                          </span>
                        </span>
                      )}
                    </span>
                  </span>
                </button>
                {!readOnly && (
                  <span className="rail-move">
                    <button
                      type="button"
                      aria-label={t('editor.moveUp')}
                      disabled={i === 0}
                      onClick={() => void editor.moveStep(i, i - 1).then(() => onSelect(i - 1))}
                    >
                      <ArrowUp aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={t('editor.moveDown')}
                      disabled={i === editor.steps.length - 1}
                      onClick={() => void editor.moveStep(i, i + 1).then(() => onSelect(i + 1))}
                    >
                      <ArrowDown aria-hidden="true" />
                    </button>
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
      {!readOnly && (
        <div className="rail-foot">
          <Menu
            label={t('editor.addStep')}
            align="start"
            trigger={{ icon: <Plus />, text: t('editor.addStep'), block: true }}
            items={addItems}
          />
          <input
            ref={file}
            type="file"
            hidden
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void editor.addImageStep(current, f).then(() => onSelect(current + 1));
              e.target.value = '';
            }}
          />
        </div>
      )}
    </>
  );
}

/** Icônes d'état d'une étape dans le rail (ED10). */
function StepBadges({ step, hotspots }: { step: StepRow; hotspots: number }) {
  const { t } = useTranslation();
  const blurs = Array.isArray(step.blurs) ? step.blurs.length : 0;
  const opts = asStepOptions(step.options);
  const items = [
    opts.choices.length > 0 && {
      icon: <GitBranch />,
      label: t('editor.advanced.choice.railBadge', { count: opts.choices.length }),
    },
    !opts.choices.length &&
      step.kind === 'text' &&
      opts.display === 'popup' && { icon: <AppWindow />, label: t('editor.advanced.stepTypes.popup') },
    hotspots > 0 && { icon: <Target />, label: t('editor.badgeHotspots', { count: hotspots }) },
    step.gate_form_id && { icon: <ClipboardList />, label: t('editor.badgeForm') },
    step.cta && { icon: <MousePointerClick />, label: t('editor.badgeCta') },
    step.zoom && { icon: <ZoomIn />, label: t('editor.badgeZoom') },
    blurs > 0 && { icon: <EyeOff />, label: t('editor.badgeBlurs', { count: blurs }) },
  ].filter(Boolean) as Array<{ icon: React.ReactNode; label: string }>;
  if (!items.length) return null;
  return (
    <>
      {items.map((b) => (
        <span key={b.label} title={b.label} aria-label={b.label} role="img">
          {b.icon}
        </span>
      ))}
    </>
  );
}
