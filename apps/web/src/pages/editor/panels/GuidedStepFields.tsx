import { AppWindow, ArrowRight, GitBranch, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChoiceAction, StepOptions } from '@flowdsiml/manifest';
import { Button, Field, Select, Switch } from '@flowdsiml/ui';
import type { DemoEditor } from '../useDemoEditor';
import { asAction, asStepOptions, type StepRow } from '../types';
import { unreachableSteps } from '../reachability';

const MAX_CHOICES = 6;

/** Valeur du select de destination : « step:<id> », « chapter:<id> », « end » ou « url ». */
const destValue = (a: ChoiceAction) =>
  a.type === 'goto' ? `step:${a.stepId}` : a.type === 'chapter' ? `chapter:${a.chapterId}` : a.type;

/**
 * F1 : réglages « parcours guidé » d'une étape texte (spec a2 §2 et §5) : affichage plein écran ou
 * pop-up, type de message, fond, bouton, et menu de choix (destination étape, chapitre, fin, lien).
 */
export function GuidedStepFields({
  editor,
  step,
  index,
  readOnly,
}: {
  editor: DemoEditor;
  step: StepRow;
  index: number;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const opts = asStepOptions(step.options);
  const set = (patch: Partial<StepOptions>) =>
    editor.updateStep(step.id, { options: { ...opts, ...patch } as unknown as StepRow['options'] });
  const setChoice = (i: number, patch: Partial<StepOptions['choices'][number]>) =>
    set({ choices: opts.choices.map((c, j) => (j === i ? { ...c, ...patch } : c)) });

  const unreachable = useMemo(
    () =>
      unreachableSteps(
        editor.steps.map((s) => ({
          id: s.id,
          chapterId: s.chapter_id,
          options: asStepOptions(s.options),
          hotspotActions: editor.hotspots.filter((h) => h.step_id === s.id).map((h) => asAction(h.action)),
        })),
      ),
    [editor.steps, editor.hotspots],
  );

  function setDestination(i: number, value: string) {
    const action: ChoiceAction = value.startsWith('step:')
      ? { type: 'goto', stepId: value.slice(5) }
      : value.startsWith('chapter:')
        ? { type: 'chapter', chapterId: value.slice(8) }
        : value === 'url'
          ? { type: 'url', url: 'https://' }
          : { type: 'end' };
    setChoice(i, { action });
  }

  return (
    <>
      {step.kind === 'text' && (
        <section className="panel-group stack" aria-labelledby={`gp-${step.id}`}>
          <div className="fd-card__head" style={{ margin: 0 }}>
            <span className="fd-icon-chip" aria-hidden="true">
              <AppWindow />
            </span>
            <h2 className="fd-card__title" id={`gp-${step.id}`}>
              {t('editor.advanced.popup.title')}
            </h2>
          </div>
          <Field label={t('editor.advanced.popup.display')}>
            <div className="fd-segmented" role="group" aria-label={t('editor.advanced.popup.display')}>
              {(['screen', 'popup'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={readOnly}
                  aria-pressed={opts.display === d}
                  onClick={() => set({ display: d })}
                >
                  {t(
                    d === 'screen'
                      ? 'editor.advanced.popup.displayScreen'
                      : 'editor.advanced.popup.displayPopup',
                  )}
                </button>
              ))}
            </div>
            {opts.display === 'popup' && <p className="fd-help">{t('editor.advanced.popup.displayHelp')}</p>}
          </Field>
          {opts.display === 'popup' && (
            <>
              <Field label={t('editor.advanced.popup.variant')} htmlFor="gp-variant">
                <Select
                  id="gp-variant"
                  disabled={readOnly}
                  value={opts.variant}
                  onChange={(e) => set({ variant: e.target.value as StepOptions['variant'] })}
                >
                  <option value="info">{t('editor.advanced.popup.variantInfo')}</option>
                  <option value="instruction">{t('editor.advanced.popup.variantInstruction')}</option>
                </Select>
              </Field>
              <Switch
                label={t('editor.advanced.popup.showIcon')}
                checked={opts.showIcon}
                disabled={readOnly}
                onChange={(e) => set({ showIcon: e.target.checked })}
              />
              <Field label={t('editor.advanced.popup.background')}>
                <div className="fd-segmented" role="group" aria-label={t('editor.advanced.popup.background')}>
                  {(['blur', 'color'] as const).map((b) => (
                    <button
                      key={b}
                      type="button"
                      disabled={readOnly}
                      aria-pressed={opts.background === b}
                      onClick={() => set({ background: b })}
                    >
                      {t(b === 'blur' ? 'editor.advanced.popup.bgBlur' : 'editor.advanced.popup.bgColor')}
                    </button>
                  ))}
                </div>
              </Field>
              {opts.background === 'color' && (
                <Field label={t('editor.advanced.popup.bgColor')} htmlFor="gp-bg">
                  <div className="row">
                    <input
                      id="gp-bg"
                      type="color"
                      disabled={readOnly}
                      value={opts.bgColor}
                      onChange={(e) => set({ bgColor: e.target.value.toUpperCase() })}
                    />
                    <code>{opts.bgColor.toUpperCase()}</code>
                  </div>
                </Field>
              )}
            </>
          )}
          {!opts.choices.length && (
            <Field label={t('editor.advanced.popup.button')} htmlFor="gp-button">
              <input
                id="gp-button"
                className="fd-input"
                maxLength={40}
                disabled={readOnly}
                value={opts.buttonLabel}
                placeholder={t('editor.advanced.popup.buttonPlaceholder')}
                onChange={(e) => set({ buttonLabel: e.target.value })}
              />
              <p className="fd-help">{t('editor.advanced.popup.buttonHelp')}</p>
            </Field>
          )}
        </section>
      )}

      {step.kind === 'text' && (
        <section className="panel-group stack" aria-labelledby={`gc-${step.id}`}>
          <div className="fd-card__head" style={{ margin: 0 }}>
            <span className="fd-icon-chip" aria-hidden="true">
              <GitBranch />
            </span>
            <h2 className="fd-card__title" id={`gc-${step.id}`}>
              {t('editor.advanced.choice.title')}
            </h2>
          </div>
          <p className="fd-help">{t('editor.advanced.choice.help')}</p>
          {opts.choices.map((c, i) => (
            <div key={i} className="choice-block">
              <label className="sr-only" htmlFor={`gc-label-${i}`}>
                {t('editor.advanced.choice.option', { n: i + 1 })}
              </label>
              <input
                id={`gc-label-${i}`}
                className="fd-input"
                maxLength={80}
                disabled={readOnly}
                value={c.label}
                placeholder={t('editor.advanced.choice.placeholder')}
                onChange={(e) => setChoice(i, { label: e.target.value })}
              />
              <div className="choice-block__dest">
                <ArrowRight aria-hidden="true" size={16} />
                <Select
                  aria-label={t('editor.advanced.choice.destination', { n: i + 1 })}
                  disabled={readOnly}
                  value={destValue(c.action)}
                  onChange={(e) => setDestination(i, e.target.value)}
                >
                  {editor.steps.map((s, j) =>
                    j === index ? null : (
                      <option key={s.id} value={`step:${s.id}`}>
                        {t('editor.advanced.choice.toStep', {
                          n: j + 1,
                          title: s.title || t('editor.untitled'),
                        })}
                      </option>
                    ),
                  )}
                  {editor.chapters.map((ch) => (
                    <option key={ch.id} value={`chapter:${ch.id}`}>
                      {t('editor.advanced.choice.toChapter', { title: ch.title || t('editor.untitled') })}
                    </option>
                  ))}
                  <option value="end">{t('editor.advanced.choice.toEnd')}</option>
                  <option value="url">{t('editor.advanced.choice.toUrl')}</option>
                </Select>
                {!readOnly && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 />}
                    aria-label={t('editor.advanced.choice.remove', { n: i + 1 })}
                    title={t('editor.advanced.choice.remove', { n: i + 1 })}
                    onClick={() => set({ choices: opts.choices.filter((_, j) => j !== i) })}
                  />
                )}
              </div>
              {c.action.type === 'url' && (
                <>
                  <label className="sr-only" htmlFor={`gc-url-${i}`}>
                    {t('editor.advanced.choice.url', { n: i + 1 })}
                  </label>
                  <input
                    id={`gc-url-${i}`}
                    className="fd-input"
                    type="url"
                    disabled={readOnly}
                    value={c.action.url}
                    onChange={(e) => setChoice(i, { action: { type: 'url', url: e.target.value } })}
                  />
                </>
              )}
            </div>
          ))}
          {!readOnly && opts.choices.length < MAX_CHOICES && (
            <Button
              size="sm"
              variant="default"
              icon={<Plus />}
              onClick={() =>
                set({
                  display: opts.choices.length ? opts.display : 'popup',
                  choices: [
                    ...opts.choices,
                    {
                      label: t('editor.advanced.choice.option', { n: opts.choices.length + 1 }),
                      action: { type: 'end' },
                    },
                  ],
                })
              }
            >
              {t('editor.advanced.choice.add')}
            </Button>
          )}
        </section>
      )}

      {unreachable.length > 0 && (
        <div className="fd-alert fd-alert--warning" role="status">
          <TriangleAlert aria-hidden="true" size={16} />
          <div>
            {unreachable.map((i) => (
              <p key={i} style={{ margin: 0 }}>
                {t('editor.advanced.choice.unreachable', { n: i + 1 })}
              </p>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
