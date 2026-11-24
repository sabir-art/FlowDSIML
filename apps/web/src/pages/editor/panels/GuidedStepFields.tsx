import { AppWindow, Ellipsis, GitBranch, Plus, Replace, Trash2, TriangleAlert, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { VarTextField } from '../vars/VarTextField';
import { useVarCatalog } from '../../../lib/varCatalog';
import type { ChoiceAction, StepOptions } from '@flowdsiml/manifest';
import { Button, Field, Select, Switch, ColorSwatch } from '@flowdsiml/ui';
import type { DemoEditor } from '../useDemoEditor';
import { DropBlock, UploadBar } from '../../../components/DropBlock';
import { Menu } from '../../../components/Menu';
import { useToast } from '../../../components/Toast';
import { asAction, asStepOptions, type StepRow } from '../types';
import { loopsWithoutExit, unreachableSteps } from '../reachability';
import { DestinationSelect } from './DestinationSelect';
import { answersFromText, branchOf, branchPatch, isDead, remapRules, type BranchView } from '../branch';

const WINDOW_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const WINDOW_IMAGE_MAX = 5 * 1024 * 1024;

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
  const catalog = useVarCatalog(editor.variables);
  const opts = asStepOptions(step.options);
  const set = (patch: Partial<StepOptions>) =>
    editor.updateStep(step.id, { options: { ...opts, ...patch } as unknown as StepRow['options'] });

  // EXT-02 §6.1 : image de la fenêtre (zone étroite §18.2 : bouton « Importer… », dépôt sur le bloc)
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const importImage = (f: File) => {
    if (!WINDOW_IMAGE_TYPES.includes(f.type))
      return toast(t('editor.replaceBadType'), undefined, { tone: 'warning' });
    if (f.size > WINDOW_IMAGE_MAX) return toast(t('editor.window.tooBig'), undefined, { tone: 'warning' });
    setSending(true);
    void editor.captureStep(step.id, f).finally(() => setSending(false));
  };

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
  const destination = (p: {
    label: string;
    action: ChoiceAction;
    dead: boolean;
    onChange: (a: ChoiceAction) => void;
  }) => <DestinationSelect editor={editor} index={index} readOnly={readOnly} {...p} />;

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
              {(['screen', 'popup', 'window'] as const).map((d) => (
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
                      : d === 'popup'
                        ? 'editor.advanced.popup.displayPopup'
                        : 'editor.advanced.popup.displayWindow',
                  )}
                </button>
              ))}
            </div>
            {opts.display === 'popup' && <p className="fd-help">{t('editor.advanced.popup.displayHelp')}</p>}
            {opts.display === 'window' && <p className="fd-help">{t('editor.window.displayHelp')}</p>}
          </Field>
          {opts.display === 'window' && (
            <>
              <DropBlock onFile={importImage} disabled={readOnly || sending} className="win-img">
                <span className="fd-label" id={`gw-img-${step.id}`}>
                  {t('editor.window.image')}
                </span>
                <input
                  ref={file}
                  id={`gw-file-${step.id}`}
                  type="file"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  aria-label={t('editor.window.image')}
                  accept={WINDOW_IMAGE_TYPES.join(',')}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) importImage(f);
                  }}
                />
                {step.image_path ? (
                  <div className="win-img__row" role="group" aria-labelledby={`gw-img-${step.id}`}>
                    <span className="win-img__thumb">
                      {editor.imageUrls[step.image_path] && (
                        <img src={editor.imageUrls[step.image_path]} alt="" />
                      )}
                    </span>
                    <span className="win-img__meta">
                      {step.image_width} × {step.image_height} px
                    </span>
                    {!readOnly && (
                      <Menu
                        label={t('editor.window.imageMore')}
                        icon={<Ellipsis />}
                        items={[
                          {
                            label: t('editor.window.replace'),
                            icon: <Replace />,
                            onSelect: () => file.current?.click(),
                          },
                          'separator',
                          {
                            label: t('editor.window.remove'),
                            icon: <Trash2 />,
                            danger: true,
                            onSelect: () =>
                              editor.updateStep(step.id, {
                                image_path: null,
                                image_width: null,
                                image_height: null,
                              }),
                          },
                        ]}
                      />
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={readOnly || sending}
                    aria-controls={`gw-file-${step.id}`}
                    aria-describedby={`gw-img-h-${step.id}`}
                    onClick={() => file.current?.click()}
                  >
                    <Upload aria-hidden="true" />
                    {sending ? t('dropzone.sendingShort') : t('dropzone.import')}
                  </button>
                )}
                {sending && <UploadBar label={t('editor.window.sending')} />}
                <span className="fd-help" id={`gw-img-h-${step.id}`}>
                  {t('editor.window.imageHelp')}
                </span>
              </DropBlock>
              {step.image_path && (
                <Field label={t('editor.window.alt')} htmlFor={`gw-alt-${step.id}`}>
                  <input
                    id={`gw-alt-${step.id}`}
                    className="fd-input"
                    maxLength={200}
                    disabled={readOnly}
                    value={opts.imageAlt}
                    aria-describedby={`gw-alt-h-${step.id}`}
                    onChange={(e) => set({ imageAlt: e.target.value })}
                  />
                  <p className="fd-help" id={`gw-alt-h-${step.id}`}>
                    {t('editor.window.altHelp')}
                  </p>
                </Field>
              )}
            </>
          )}
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
                <Field label={t('editor.advanced.popup.bgColor')}>
                  <div className="row">
                    <ColorSwatch
                      label={t('editor.advanced.popup.bgColor')}
                      labels={{
                        palette: t('common.colorPalette'),
                        shade: t('common.colorShade'),
                        hue: t('common.colorHue'),
                        hex: t('common.colorHex'),
                      }}
                      disabled={readOnly}
                      value={opts.bgColor}
                      onChange={(c) => set({ bgColor: c })}
                    />
                    <code>{opts.bgColor.toUpperCase()}</code>
                  </div>
                </Field>
              )}
            </>
          )}
          {!opts.choices.length && (
            <VarTextField
              singleLine
              id="gp-button"
              label={t(opts.display === 'window' ? 'editor.window.button' : 'editor.advanced.popup.button')}
              maxLength={40}
              catalog={catalog}
              canManage={!readOnly}
              disabled={readOnly}
              value={opts.buttonLabel}
              placeholder={t('editor.advanced.popup.buttonPlaceholder')}
              onChange={(v) => set({ buttonLabel: v })}
              extra={<p className="fd-help">{t('editor.advanced.popup.buttonHelp')}</p>}
            />
          )}
        </section>
      )}

      {step.kind === 'text' && opts.display !== 'window' && (
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
