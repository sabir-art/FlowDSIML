import { AppWindow, GitBranch, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChoiceAction, StepOptions } from '@flowdsiml/manifest';
import { Button, Field, Select, Switch } from '@flowdsiml/ui';
import type { DemoEditor } from '../useDemoEditor';
import { asAction, asStepOptions, type StepRow } from '../types';
import { loopsWithoutExit, unreachableSteps } from '../reachability';
import { answersFromText, branchOf, branchPatch, isDead, remapRules, type BranchView } from '../branch';

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

  // L22-09 : règles de suite (seule source) ; destinations des choix recalculées
  const branch = branchOf(opts);
  const labels = opts.choices.map((c) => c.label);
  const stepIds = new Set(editor.steps.map((s) => s.id));
  const chapterIds = new Set(editor.chapters.map((c) => c.id));
  const [answersDraft, setAnswersDraft] = useState(() => labels.join('\n'));
  useEffect(() => {
    setAnswersDraft(
      asStepOptions(step.options)
        .choices.map((c) => c.label)
        .join('\n'),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);
  const saveBranch = (b: BranchView, nextLabels = labels) =>
    set({
      ...branchPatch(nextLabels, b),
      // Premier choix ajouté : la carte passe en pop-up (comportement F1)
      display: !labels.length && nextLabels.length ? 'popup' : opts.display,
    });
  const setRule = (k: number, patch: Partial<BranchView['rules'][number]>) =>
    saveBranch({ ...branch, rules: branch.rules.map((r, j) => (j === k ? { ...r, ...patch } : r)) });
  const setAnswers = (text: string) => {
    setAnswersDraft(text);
    const next = answersFromText(text);
    if (next.join('\n') !== labels.join('\n')) saveBranch(remapRules(labels, next, branch), next);
  };
  const loops = useMemo(
    () =>
      loopsWithoutExit(
        editor.steps.map((s) => ({
          id: s.id,
          chapterId: s.chapter_id,
          options: asStepOptions(s.options),
          hotspotActions: editor.hotspots.filter((h) => h.step_id === s.id).map((h) => asAction(h.action)),
        })),
      ),
    [editor.steps, editor.hotspots],
  );

  /** Liste des destinations : étape suivante, étapes, chapitres, fin, lien. */
  function destination({
    label,
    action,
    dead,
    onChange,
  }: {
    label: string;
    action: ChoiceAction;
    dead: boolean;
    onChange: (a: ChoiceAction) => void;
  }) {
    const nextStep = editor.steps[index + 1];
    return (
      <span className="br-dest">
        <Select
          aria-label={label}
          aria-invalid={dead || undefined}
          className={dead ? 'is-invalid' : undefined}
          disabled={readOnly}
          value={dead ? 'dead' : destValue(action)}
          onChange={(e) => {
            const v = e.target.value;
            onChange(
              v === 'next'
                ? { type: 'next' }
                : v.startsWith('step:')
                  ? { type: 'goto', stepId: v.slice(5) }
                  : v.startsWith('chapter:')
                    ? { type: 'chapter', chapterId: v.slice(8) }
                    : v === 'url'
                      ? { type: 'url', url: 'https://' }
                      : { type: 'end' },
            );
          }}
        >
          {dead && (
            <option value="dead" disabled>
              {t('editor.branch.deleted')}
            </option>
          )}
          <option value="next">
            {nextStep ? t('editor.branch.next', { n: index + 2 }) : t('editor.branch.nextEnd')}
          </option>
          {editor.steps.map((s, j) =>
            j === index ? null : (
              <option key={s.id} value={`step:${s.id}`}>
                {t('editor.advanced.choice.toStep', { n: j + 1, title: s.title || t('editor.untitled') })}
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
        {action.type === 'url' && (
          <input
            className="fd-input"
            type="url"
            aria-label={t('editor.branch.url', { label })}
            disabled={readOnly}
            value={action.url}
            onChange={(e) => onChange({ type: 'url', url: e.target.value })}
          />
        )}
      </span>
    );
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
              {t('editor.branch.title')}
            </h2>
          </div>
          <Field label={t('editor.branch.answers')} htmlFor={`gc-answers-${step.id}`}>
            <textarea
              id={`gc-answers-${step.id}`}
              className="fd-textarea"
              rows={3}
              disabled={readOnly}
              value={answersDraft}
              placeholder={t('editor.advanced.choice.placeholder')}
              onChange={(e) => setAnswers(e.target.value)}
            />
          </Field>
          {labels.length > 0 && (
            <>
              <h3 className="br-sub">{t('editor.branch.rules')}</h3>
              {branch.rules.map((r, k) => {
                const dead = isDead(r.goto, stepIds, chapterIds);
                return (
                  <div key={k} className="br-rule">
                    <div className="br-row">
                      <b id={`br-if-${step.id}-${k}`}>{t('editor.branch.if')}</b>
                      <Select
                        aria-label={t('editor.branch.ruleAnswer', { n: k + 1 })}
                        disabled={readOnly}
                        value={String(r.answer)}
                        onChange={(e) => setRule(k, { answer: Number(e.target.value) })}
                      >
                        {labels.map((l, i) => (
                          // Une règle par réponse : celles déjà prises par une autre règle sont grisées
                          <option
                            key={i}
                            value={i}
                            disabled={branch.rules.some((o, j) => j !== k && o.answer === i)}
                          >
                            {l}
                          </option>
                        ))}
                      </Select>
                      {!readOnly && (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Trash2 />}
                          aria-label={t('editor.branch.removeRule', { n: k + 1 })}
                          title={t('editor.branch.removeRule', { n: k + 1 })}
                          onClick={() =>
                            saveBranch({ ...branch, rules: branch.rules.filter((_, j) => j !== k) })
                          }
                        />
                      )}
                    </div>
                    <div className="br-row">
                      <b>{t('editor.branch.then')}</b>
                      {destination({
                        label: t('editor.branch.ruleDest', { n: k + 1 }),
                        action: r.goto,
                        dead: dead,
                        onChange: (goto) => setRule(k, { goto }),
                      })}
                    </div>
                  </div>
                );
              })}
              <div className="br-rule br-else">
                <div className="br-row">
                  <b>{t('editor.branch.else')}</b>
                  {destination({
                    label: t('editor.branch.elseDest'),
                    action: branch.else,
                    dead: isDead(branch.else, stepIds, chapterIds),
                    onChange: (a) => saveBranch({ ...branch, else: a }),
                  })}
                </div>
              </div>
              {!readOnly && branch.rules.length < labels.length && (
                <Button
                  size="sm"
                  variant="default"
                  icon={<Plus />}
                  onClick={() =>
                    saveBranch({
                      ...branch,
                      rules: [
                        ...branch.rules,
                        {
                          answer: labels.findIndex((_, i) => !branch.rules.some((r) => r.answer === i)),
                          goto: { type: 'end' },
                        },
                      ],
                    })
                  }
                >
                  {t('editor.branch.add')}
                </Button>
              )}
              <p className="fd-help">{t('editor.branch.help')}</p>
            </>
          )}
          {loops.includes(index) && (
            <div className="fd-alert fd-alert--warning" role="status">
              <TriangleAlert aria-hidden="true" size={16} />
              <div>{t('editor.branch.loop')}</div>
            </div>
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
