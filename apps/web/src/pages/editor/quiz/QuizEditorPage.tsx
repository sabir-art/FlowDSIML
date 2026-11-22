import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CircleCheck,
  GraduationCap,
  GripVertical,
  ListChecks,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import { useId, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Manifest } from '@flowdsiml/manifest';
import { Alert, Button, Field, Select, Switch, Slider } from '@flowdsiml/ui';
import { errorMessage } from '../../../lib/errors';
import { Loading } from '../../../components/guards';
import { useWorkspace } from '../../../workspace/WorkspaceProvider';
import { useDemoEditor, type DemoEditor } from '../useDemoEditor';
import { buildDraftManifest } from '../draftManifest';
import { PreviewDialog } from '../PreviewDialog';
import { asAnswers, asSettings, type DemoSettings, type QuestionRow, type QuizAnswer } from '../types';
import { convertAnswers, isOpenType, newAnswerId, questionErrors } from '../quizValidation';
import { QuizStats } from './QuizStats';
import { useToast } from '../../../components/Toast';
import '../editor.css';
import './quiz.css';

type QType = 'single' | 'multiple' | 'truefalse' | 'nps' | 'text';
const TYPES: QType[] = ['single', 'multiple', 'truefalse'];
/** L19 : en mode Sondage, note de 0 à 10 et réponse écrite en plus. */
const SURVEY_TYPES: QType[] = [...TYPES, 'nps', 'text'];
const TYPE_KEY: Record<QType, string> = {
  single: 'typeSingle',
  multiple: 'typeMultiple',
  truefalse: 'typeTrueFalse',
  nps: 'typeNps',
  text: 'typeText',
};
const ATTEMPTS = [1, 2, 3, 5, 0];

/** Onglet « Quiz » du module (spec f2-quiz §2) : liste, question, validation du module. */
export function QuizEditorPage() {
  const { t } = useTranslation();
  const { demoId = '' } = useParams();
  const editor = useDemoEditor(demoId);
  const { can, current: ws } = useWorkspace();
  const readOnly = !can('demo.edit');
  const [current, setCurrent] = useState(0);
  const [previewManifest, setPreviewManifest] = useState<Manifest | null>(null);

  if (editor.loading) return <Loading />;
  if (editor.notFound || !editor.demo)
    return (
      <div className="page-center">
        <Link to="/">{t('common.back')}</Link>
      </div>
    );

  const qs = editor.questions;
  const cur = qs[Math.min(current, qs.length - 1)];
  const curIndex = cur ? qs.indexOf(cur) : -1;

  async function add() {
    const row = await editor.addQuestion({
      type: 'single',
      answers: [
        { id: newAnswerId(), label: '', correct: true },
        { id: newAnswerId(), label: '', correct: false },
      ],
    });
    if (row) setCurrent(qs.length);
    setTimeout(() => document.getElementById('qz-prompt')?.focus(), 0);
  }

  return (
    <main className="quiz-page">
      <header className="editor-bar" data-tip-side="bottom">
        <Link
          to={`/demos/${demoId}/edit`}
          className="fd-btn fd-btn--round btn-surface"
          aria-label={t('editor.quiz.back')}
          title={t('editor.quiz.back')}
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <div className="quiz-page__title">
          <h1>{t('editor.quiz.title')}</h1>
          <p className="fd-muted">
            {t('editor.quiz.subtitle', { module: editor.demo.title, count: qs.length })}
          </p>
        </div>
        <span className={`save-state save-${editor.saveState}`} role="status">
          {editor.saveState !== 'idle' && t(`editor.save_${editor.saveState}`)}
        </span>
        <div className="row" style={{ marginLeft: 'auto' }}>
          <Button
            icon={<Play />}
            disabled={!qs.length}
            onClick={async () => {
              await editor.flush();
              setPreviewManifest(buildDraftManifest(editor, ws?.name ?? ''));
            }}
          >
            {t('editor.quiz.test')}
          </Button>
        </div>
      </header>
      {editor.lastError != null && (
        <div style={{ padding: '0 16px' }}>
          <Alert kind="error">{errorMessage(t, editor.lastError)}</Alert>
        </div>
      )}
      <div className="quiz-body">
        <QuestionList
          editor={editor}
          current={curIndex}
          onSelect={setCurrent}
          onAdd={add}
          readOnly={readOnly}
        />
        <section
          className="fd-card quiz-question"
          aria-label={cur ? t('editor.quiz.question', { n: curIndex + 1 }) : undefined}
        >
          {cur ? (
            <QuestionForm key={cur.id} editor={editor} q={cur} n={curIndex + 1} readOnly={readOnly} />
          ) : (
            <div className="quiz-empty">
              <span className="fd-icon-chip" aria-hidden="true">
                <GraduationCap />
              </span>
              <p>{t('editor.quiz.noQuestion')}</p>
              {!readOnly && (
                <Button variant="primary" icon={<Plus />} onClick={() => void add()}>
                  {t('editor.quiz.addQuestion')}
                </Button>
              )}
            </div>
          )}
        </section>
        <aside className="quiz-side">
          <QuizSettings editor={editor} readOnly={readOnly} />
          {/* A2-04 : pas de réussite par question en mode Sondage */}
          {asSettings(editor.demo!.settings).quiz?.mode !== 'survey' && (
            <QuizStats demoId={demoId} questions={qs} />
          )}
        </aside>
      </div>
      <PreviewDialog manifest={previewManifest} startQuiz onClose={() => setPreviewManifest(null)} />
    </main>
  );
}

function QuestionList({
  editor,
  current,
  onSelect,
  onAdd,
  readOnly,
}: {
  editor: DemoEditor;
  current: number;
  onSelect: (i: number) => void;
  onAdd: () => void;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const mode = asSettings(editor.demo!.settings).quiz?.mode === 'survey' ? 'survey' : 'quiz';
  const stepNumber = (id: string | null) => (id ? editor.steps.findIndex((s) => s.id === id) + 1 : 0);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= editor.questions.length) return;
    void editor.moveQuestion(from, to).then(() => onSelect(to));
  };
  return (
    <nav className="fd-card quiz-list" aria-labelledby="qz-list-title">
      <h2 className="fd-card__title" id="qz-list-title">
        {t('editor.quiz.questions')}
      </h2>
      <ol>
        {editor.questions.map((q, i) => {
          const invalid =
            Object.keys(
              questionErrors({ prompt: q.prompt, answers: asAnswers(q.answers), type: q.type }, mode),
            ).length > 0;
          const linked = stepNumber(q.step_id);
          return (
            <li
              key={q.id}
              draggable={!readOnly}
              onDragStart={() => setDragFrom(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragFrom !== null && dragFrom !== i) move(dragFrom, i);
                setDragFrom(null);
              }}
            >
              <button
                type="button"
                className="quiz-list__item"
                aria-current={i === current ? 'true' : undefined}
                aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                onClick={() => onSelect(i)}
                onKeyDown={(e) => {
                  if (readOnly || !e.altKey) return;
                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    move(i, e.key === 'ArrowUp' ? i - 1 : i + 1);
                  }
                }}
              >
                <span className="quiz-list__n">{i + 1}</span>
                <span className="quiz-list__text">
                  <span className="quiz-list__prompt">{q.prompt || t('editor.untitled')}</span>
                  <span className="quiz-list__caption">
                    {t(`editor.quiz.${TYPE_KEY[q.type as QType] ?? 'typeSingle'}`)}
                    {linked > 0 && ` · ${t('editor.quiz.linkedTo', { n: linked })}`}
                  </span>
                </span>
                {invalid && (
                  <span
                    className="quiz-list__dot"
                    role="img"
                    aria-label={t('editor.quiz.invalid')}
                    title={t('editor.quiz.invalid')}
                  />
                )}
              </button>
              {!readOnly && (
                <span className="quiz-list__move">
                  <button
                    type="button"
                    aria-label={t('editor.quiz.moveUp')}
                    disabled={i === 0}
                    onClick={() => move(i, i - 1)}
                  >
                    <ArrowUp size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={t('editor.quiz.moveDown')}
                    disabled={i === editor.questions.length - 1}
                    onClick={() => move(i, i + 1)}
                  >
                    <ArrowDown size={14} aria-hidden="true" />
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {editor.questions.length > 10 && <p className="fd-help">{t('editor.quiz.manyQuestions')}</p>}
      {!readOnly && (
        <>
          <Button icon={<Plus />} onClick={() => onAdd()}>
            {t('editor.quiz.addQuestion')}
          </Button>
          {editor.questions.length > 1 && <p className="fd-help">{t('editor.quiz.reorderHint')}</p>}
        </>
      )}
    </nav>
  );
}

function QuestionForm({
  editor,
  q,
  n,
  readOnly,
}: {
  editor: DemoEditor;
  q: QuestionRow;
  n: number;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  const answers = asAnswers(q.answers);
  const type = q.type as QType;
  const mode = asSettings(editor.demo!.settings).quiz?.mode === 'survey' ? 'survey' : 'quiz';
  const errs = questionErrors({ prompt: q.prompt, answers, type: q.type }, mode);
  const open = isOpenType(type);
  const toast = useToast();
  const set = (patch: Partial<QuestionRow>) => editor.updateQuestion(q.id, patch);
  const setAnswers = (next: QuizAnswer[]) => set({ answers: next as unknown as QuestionRow['answers'] });
  const fixed = type === 'truefalse';

  function setType(to: QType) {
    if (to === type) return;
    const r = convertAnswers(answers, to, { true: t('editor.quiz.true'), false: t('editor.quiz.false') });
    set({ type: to, answers: r.answers as unknown as QuestionRow['answers'] });
    // F2-01 : simple toast au passage de Choix multiples à Choix unique, pas de bandeau
    if (r.trimmed) toast(t('editor.quiz.typeTrimmed'));
  }

  function markCorrect(i: number, on: boolean) {
    setAnswers(
      answers.map((a, j) =>
        type === 'multiple' ? (j === i ? { ...a, correct: on } : a) : { ...a, correct: j === i },
      ),
    );
  }

  return (
    <div className="stack">
      <div className="quiz-question__head">
        <h2 className="fd-card__title">{t('editor.quiz.question', { n })}</h2>
        <div className="fd-segmented" role="group" aria-label={t('editor.quiz.type')}>
          {(mode === 'survey' || isOpenType(type) ? SURVEY_TYPES : TYPES).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={type === k}
              disabled={readOnly}
              onClick={() => setType(k)}
            >
              {t(`editor.quiz.${TYPE_KEY[k]}`)}
            </button>
          ))}
          {/* A2-04 : étoiles de 1 à 5, pas encore disponibles (gardées avec « Bientôt ») */}
          {(mode === 'survey' || isOpenType(type)) && (
            <button type="button" aria-pressed={false} disabled aria-disabled="true">
              {t('editor.quiz.typeStars')} <span className="soon-text">{t('shell.soon')}</span>
            </button>
          )}
        </div>
      </div>
      <Field label={t('editor.quiz.questionLabel')} htmlFor="qz-prompt">
        <textarea
          id="qz-prompt"
          className="fd-input quiz-prompt"
          rows={2}
          maxLength={200}
          disabled={readOnly}
          value={q.prompt}
          aria-invalid={errs.prompt ? true : undefined}
          aria-describedby={errs.prompt ? `${id}-perr` : undefined}
          onChange={(e) => set({ prompt: e.target.value })}
        />
        {errs.prompt && (
          <p id={`${id}-perr`} className="field-error">
            {t(`editor.quiz.${errs.prompt}`)}
          </p>
        )}
      </Field>

      {open && (
        <div className="quiz-open">
          <p className="fd-help">{t(type === 'nps' ? 'editor.quiz.npsHelp' : 'editor.quiz.textHelp')}</p>
          {errs.answers && (
            <p className="field-error" role="alert">
              {t(`editor.quiz.${errs.answers}`)}
            </p>
          )}
        </div>
      )}
      <fieldset
        className="quiz-answers"
        hidden={open}
        aria-describedby={errs.answers ? `${id}-aerr` : undefined}
      >
        <legend className="fd-label">{t('editor.quiz.answers')}</legend>
        <ul>
          {answers.map((a, i) => (
            <li key={a.id} className={`quiz-answer${a.correct && mode === 'quiz' ? ' is-correct' : ''}`}>
              {!fixed && <GripVertical className="quiz-answer__grip" size={16} aria-hidden="true" />}
              <label className="sr-only" htmlFor={`${id}-a${i}`}>
                {t('editor.quiz.answerN', { n: i + 1 })}
              </label>
              <input
                id={`${id}-a${i}`}
                className="fd-input"
                maxLength={200}
                disabled={readOnly || fixed}
                value={a.label}
                placeholder={t('editor.quiz.answerN', { n: i + 1 })}
                onChange={(e) =>
                  setAnswers(answers.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                }
              />
              {mode === 'quiz' && (
                <label className="quiz-answer__correct">
                  <input
                    type={type === 'multiple' ? 'checkbox' : 'radio'}
                    name={`${id}-correct`}
                    checked={a.correct}
                    disabled={readOnly}
                    onChange={(e) => markCorrect(i, e.target.checked)}
                  />
                  {a.correct && <CircleCheck size={16} aria-hidden="true" />}
                  <span>{t('editor.quiz.isCorrect')}</span>
                </label>
              )}
              {!readOnly && !fixed && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 />}
                  aria-label={t('editor.quiz.deleteAnswer', { n: i + 1 })}
                  title={t('editor.quiz.deleteAnswer', { n: i + 1 })}
                  onClick={() => setAnswers(answers.filter((_, j) => j !== i))}
                />
              )}
            </li>
          ))}
        </ul>
        {errs.answers && (
          <p id={`${id}-aerr`} className="field-error">
            {t(`editor.quiz.${errs.answers}`)}
          </p>
        )}
        {!readOnly && !fixed && answers.length < 6 && (
          <Button
            size="sm"
            icon={<Plus />}
            onClick={() => setAnswers([...answers, { id: newAnswerId(), label: '', correct: false }])}
          >
            {t('editor.quiz.addAnswer')}
          </Button>
        )}
      </fieldset>

      {/* A2-04 : en mode Sondage, ni explication, ni étape à revoir, ni points */}
      {mode === 'quiz' && (
        <>
          <Field label={t('editor.quiz.explanation')} htmlFor="qz-expl">
            <textarea
              id="qz-expl"
              className="fd-input"
              rows={3}
              maxLength={1000}
              disabled={readOnly}
              value={q.explanation}
              onChange={(e) => set({ explanation: e.target.value })}
            />
          </Field>
          <div className="quiz-question__row">
            <Field label={t('editor.quiz.linkedStep')} htmlFor="qz-step">
              <Select
                id="qz-step"
                disabled={readOnly}
                value={q.step_id ?? ''}
                onChange={(e) => set({ step_id: e.target.value || null })}
              >
                <option value="">{t('editor.quiz.linkedStepNone')}</option>
                {editor.steps.map((s, i) => (
                  <option key={s.id} value={s.id}>
                    {i + 1}. {s.title || t('editor.untitled')}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('editor.quiz.points')} htmlFor="qz-points">
              <input
                id="qz-points"
                className="fd-input"
                type="number"
                min={1}
                max={100}
                disabled={readOnly}
                value={q.points}
                onChange={(e) => {
                  const v = Math.round(Number(e.target.value));
                  if (v >= 1 && v <= 100) set({ points: v });
                }}
              />
            </Field>
          </div>
        </>
      )}
      {!readOnly && (
        <Button
          variant="ghost"
          className="btn-danger-ghost"
          icon={<Trash2 />}
          onClick={() => void editor.deleteQuestion(q.id)}
        >
          {t('editor.quiz.deleteQuestion')}
        </Button>
      )}
    </div>
  );
}

function QuizSettings({ editor, readOnly }: { editor: DemoEditor; readOnly: boolean }) {
  const { t } = useTranslation();
  const settings = asSettings(editor.demo!.settings);
  const quiz = {
    threshold: 70,
    attempts: 3,
    feedback: 'each' as const,
    shuffle: true,
    required: true,
    ...settings.quiz,
  };
  const set = (patch: Partial<NonNullable<DemoSettings['quiz']>>) =>
    editor.updateDemo({ settings: { ...settings, quiz: { ...settings.quiz, ...patch } } as never });
  return (
    <section className="fd-card stack" aria-labelledby="qz-val">
      <div className="fd-card__head" style={{ margin: 0 }}>
        <span className="fd-icon-chip" aria-hidden="true">
          <ListChecks />
        </span>
        <h2 className="fd-card__title" id="qz-val">
          {t('editor.quiz.validation')}
        </h2>
      </div>
      {/* A2-04 : sondage = même moteur que le quiz, sans bonne réponse ni seuil */}
      <Field label={t('editor.quiz.modeLabel')}>
        <div className="fd-segmented" role="group" aria-label={t('editor.quiz.modeLabel')}>
          {(['quiz', 'survey'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={(quiz.mode ?? 'quiz') === m}
              disabled={readOnly}
              onClick={() => set({ mode: m })}
            >
              {t(m === 'quiz' ? 'editor.quiz.modeQuiz' : 'editor.quiz.modeSurvey')}
            </button>
          ))}
        </div>
        <span className="fd-help">
          {t(quiz.mode === 'survey' ? 'editor.quiz.modeSurveyHelp' : 'editor.quiz.modeQuizHelp')}
        </span>
      </Field>
      {quiz.mode !== 'survey' && (
        <Field label={t('editor.quiz.thresholdLabel', { value: quiz.threshold })}>
          <Slider
            id="qz-th"
            className="quiz-threshold"
            min={0}
            max={100}
            step={5}
            disabled={readOnly}
            value={quiz.threshold}
            valueText={t('editor.quiz.thresholdValue', { value: quiz.threshold })}
            aria-label={t('editor.quiz.thresholdLabel', { value: quiz.threshold })}
            onChange={(v) => set({ threshold: v })}
          />
        </Field>
      )}
      {quiz.mode !== 'survey' && (
        <>
          <Field label={t('editor.quiz.attempts')} htmlFor="qz-att">
            <Select
              id="qz-att"
              disabled={readOnly}
              value={String(quiz.attempts)}
              onChange={(e) => set({ attempts: Number(e.target.value) })}
            >
              {ATTEMPTS.map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? t('editor.quiz.attemptsUnlimited') : t('editor.quiz.attemptsN', { count: n })}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('editor.quiz.showCorrection')}>
            <div className="fd-segmented" role="group" aria-label={t('editor.quiz.showCorrection')}>
              {(['each', 'end'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={quiz.feedback === f}
                  disabled={readOnly}
                  onClick={() => set({ feedback: f })}
                >
                  {t(f === 'each' ? 'editor.quiz.afterEach' : 'editor.quiz.atEnd')}
                </button>
              ))}
            </div>
          </Field>
        </>
      )}
      <Switch
        label={t('editor.quiz.shuffle')}
        checked={quiz.shuffle}
        disabled={readOnly}
        onChange={(e) => set({ shuffle: e.target.checked })}
      />
      <Switch
        label={t(quiz.mode === 'survey' ? 'editor.quiz.requiredSurvey' : 'editor.quiz.required')}
        checked={quiz.required}
        disabled={readOnly}
        onChange={(e) => set({ required: e.target.checked })}
      />
      <p className="fd-help">{t('editor.quiz.position')}</p>
    </section>
  );
}
