import { useEffect, useId, useMemo, useRef, useState } from 'preact/hooks';
import type { Quiz as QuizT, QuizQuestion } from '@flowdsiml/manifest';
import { Award, CircleCheck, CircleX, RefreshCw, RotateCcw } from 'lucide-preact';
import { fmt, type Dict } from './i18n';
import { isCorrect, isPartial, scoreQuiz, shuffled } from './logic';
import type { QuizResult } from './api';

const ICON = { size: 18, strokeWidth: 2, 'aria-hidden': true } as const;

type Phase =
  | { kind: 'question'; qi: number; checked: boolean }
  | { kind: 'result'; result: QuizResult; saveError: boolean };

/**
 * Quiz de validation (spec f2-quiz §3–5) : vrais fieldset/legend et input dans des label,
 * correction par texte et icône (jamais la couleur seule), explication en role=status,
 * résultat avec phrase de score lue au lecteur d'écran (l'anneau est décoratif).
 */
export function Quiz({
  quiz,
  module,
  t,
  sub,
  stepNumber,
  attemptsUsed,
  onSubmit,
  onReviewStep,
  onRestartModule,
  onFinish,
}: {
  quiz: QuizT;
  module: string;
  t: Dict;
  sub: (s: string) => string;
  /** Numéro (1-n) de l'étape liée, ou null si elle n'existe plus. */
  stepNumber: (stepId: string | null) => number | null;
  attemptsUsed: number;
  /** Envoi de la tentative ; null = non enregistrée (aperçu). Le résultat serveur fait foi. */
  onSubmit: (answers: Record<string, string[]>) => Promise<QuizResult | null>;
  onReviewStep: (stepId: string) => void;
  onRestartModule: () => void;
  onFinish: (passed: boolean) => void;
}) {
  const q = t.quiz as unknown as Record<string, string>;
  const survey = quiz.mode === 'survey';
  const [attempt, setAttempt] = useState(0);
  const order = useMemo(
    () =>
      (quiz.shuffle ? shuffled(quiz.questions) : quiz.questions).map((x) => ({
        ...x,
        answers: quiz.shuffle && x.type !== 'truefalse' ? shuffled(x.answers) : x.answers,
      })),
    // Nouvel ordre à chaque tentative
    [quiz, attempt], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [phase, setPhase] = useState<Phase>({ kind: 'question', qi: 0, checked: false });
  const [alert, setAlert] = useState(false);
  const [busy, setBusy] = useState(false);
  const [used, setUsed] = useState(attemptsUsed);
  const id = useId();
  const firstInput = useRef<HTMLInputElement>(null);
  const statusTitle = useRef<HTMLHeadingElement>(null);
  const resultTitle = useRef<HTMLHeadingElement>(null);
  const legendRef = useRef<HTMLLegendElement>(null);
  const each = quiz.feedback === 'each' && !survey;

  useEffect(() => {
    if (phase.kind === 'result') resultTitle.current?.focus();
    else if (phase.checked) statusTitle.current?.focus();
  }, [phase]);

  async function finish() {
    setBusy(true);
    const local = scoreQuiz(quiz, answers);
    let result: QuizResult = { ...local, attemptsLeft: null };
    let saveError = false;
    try {
      const server = await onSubmit(answers);
      if (server) result = server;
    } catch {
      saveError = true;
    }
    setBusy(false);
    setUsed((n) => n + 1);
    setPhase({ kind: 'result', result, saveError });
  }

  function restart() {
    setAnswers({});
    setAttempt((n) => n + 1);
    setPhase({ kind: 'question', qi: 0, checked: false });
  }

  if (phase.kind === 'result') {
    const { result } = phase;
    const left =
      result.attemptsLeft ??
      (quiz.attempts > 0 ? Math.max(0, quiz.attempts - used) : Number.POSITIVE_INFINITY);
    const canRetry = left > 0;
    const passed = result.passed;
    const R = 70;
    const C = 2 * Math.PI * R;
    const angle = (quiz.threshold / 100) * 2 * Math.PI - Math.PI / 2;
    return (
      <section class="p-quiz fd-player-scope" aria-label={fmt(q, 'region', { module: sub(module) })}>
        <div class="p-quiz-card p-quiz-result">
          {!survey && (
            <svg
              class={`p-ring${passed ? ' is-pass' : ''}`}
              viewBox="0 0 180 180"
              width="160"
              height="160"
              aria-hidden="true"
            >
              <circle cx="90" cy="90" r={R} class="p-ring__track" />
              <circle
                cx="90"
                cy="90"
                r={R}
                class="p-ring__arc"
                style={{ strokeDasharray: `${(result.score / 100) * C} ${C}` }}
                transform="rotate(-90 90 90)"
              />
              <line
                class="p-ring__threshold"
                x1={90 + (R - 14) * Math.cos(angle)}
                y1={90 + (R - 14) * Math.sin(angle)}
                x2={90 + (R + 14) * Math.cos(angle)}
                y2={90 + (R + 14) * Math.sin(angle)}
              />
              <text x="90" y="92" class="p-ring__score">
                {fmt(q, 'scoreRing', { score: result.score })}
              </text>
              <text x="90" y="116" class="p-ring__label">
                {fmt(q, 'scoreThreshold', { value: quiz.threshold })}
              </text>
            </svg>
          )}
          {!survey && (
            <span class={`p-quiz-badge ${passed ? 'is-pass' : 'is-fail'}`}>
              {passed ? <Award {...ICON} size={16} /> : <RefreshCw {...ICON} size={16} />}
              {passed ? q.passBadge : q.failBadge}
            </span>
          )}
          <h2 tabIndex={-1} ref={resultTitle}>
            {survey ? q.surveyTitle : passed ? fmt(q, 'passTitle', { module: sub(module) }) : q.failTitle}
          </h2>
          <p role="status" class="p-quiz-line">
            {survey
              ? q.surveyLine
              : passed
                ? fmt(q, 'scoreLine', {
                    correct: result.correct,
                    total: result.total,
                    score: result.score,
                    threshold: quiz.threshold,
                  })
                : canRetry && Number.isFinite(left)
                  ? fmt(q, 'failLine', {
                      correct: result.correct,
                      total: result.total,
                      score: result.score,
                      threshold: quiz.threshold,
                      count: left,
                    })
                  : fmt(q, 'scoreLine', {
                      correct: result.correct,
                      total: result.total,
                      score: result.score,
                      threshold: quiz.threshold,
                    })}
          </p>
          {phase.saveError && <p class="p-quiz-note">{q.sendError}</p>}
          {!survey && (
            <ol class="p-quiz-recap" aria-label={q.recapLabel}>
              {quiz.questions.map((qq, i) => {
                const ok = result.questions.find((x) => x.questionId === qq.id)?.correct ?? false;
                const n = stepNumber(qq.stepId);
                return (
                  <li key={qq.id} class={ok ? 'is-ok' : 'is-ko'}>
                    {ok ? <CircleCheck {...ICON} /> : <CircleX {...ICON} />}
                    <span class="sr-only">{ok ? q.recapCorrect : q.recapWrong} :</span>
                    <span class="p-quiz-recap__text">
                      {i + 1}. {sub(qq.prompt)}
                    </span>
                    {!ok && n && qq.stepId && (
                      <button type="button" class="p-link" onClick={() => onReviewStep(qq.stepId!)}>
                        {q.review}
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          {!passed && !canRetry && <p class="p-quiz-note">{q.noAttemptsLeft}</p>}
          <div class="p-actions">
            {passed ? (
              <>
                {canRetry && !survey && (
                  <button type="button" class="p-btn p-btn-ghost" onClick={restart}>
                    <RotateCcw {...ICON} size={16} />
                    {q.retake}
                  </button>
                )}
                <button type="button" class="p-btn p-btn-primary" onClick={() => onFinish(true)}>
                  {q.finish}
                </button>
              </>
            ) : (
              <>
                <button type="button" class="p-btn p-btn-ghost" onClick={onRestartModule}>
                  {q.reviewModule}
                </button>
                {canRetry && (
                  <button type="button" class="p-btn p-btn-primary" onClick={restart}>
                    <RotateCcw {...ICON} size={16} />
                    {q.retry}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    );
  }

  const qi = phase.qi;
  const cur: QuizQuestion = order[qi]!;
  const chosen = answers[cur.id] ?? [];
  const multiple = cur.type === 'multiple';
  const checked = phase.checked;
  const ok = isCorrect(cur, chosen);
  const partial = !ok && isPartial(cur, chosen);
  const last = qi === order.length - 1;
  const answered = Object.keys(answers).filter((k) => (answers[k] ?? []).length > 0).length;
  const linked = stepNumber(cur.stepId);

  function toggle(answerId: string) {
    if (checked) return;
    setAlert(false);
    setAnswers((a) => {
      const prev = a[cur.id] ?? [];
      const next = multiple
        ? prev.includes(answerId)
          ? prev.filter((x) => x !== answerId)
          : [...prev, answerId]
        : [answerId];
      return { ...a, [cur.id]: next };
    });
  }

  function validate(e: Event) {
    e.preventDefault();
    if (!chosen.length) {
      setAlert(true);
      firstInput.current?.focus();
      return;
    }
    if (each && !checked) return setPhase({ kind: 'question', qi, checked: true });
    next();
  }

  function next() {
    if (last) return void finish();
    setPhase({ kind: 'question', qi: qi + 1, checked: false });
    setTimeout(() => legendRef.current?.focus(), 0);
  }

  const hint = cur.type === 'truefalse' ? q.hintTrueFalse : multiple ? q.hintMultiple : q.hintSingle;
  return (
    <section class="p-quiz fd-player-scope" aria-label={fmt(q, 'region', { module: sub(module) })}>
      <form class="p-quiz-card" onSubmit={validate} noValidate>
        <div class="p-quiz-head">
          <span class="p-quiz-count">{fmt(q, 'progress', { n: qi + 1, total: order.length })}</span>
          {!survey && <span class="p-quiz-threshold">{fmt(q, 'threshold', { value: quiz.threshold })}</span>}
        </div>
        <div
          class="p-quiz-progress"
          role="progressbar"
          aria-label={q.progressLabel}
          aria-valuemin={0}
          aria-valuemax={order.length}
          aria-valuenow={answered}
        >
          <div style={{ width: `${(answered / order.length) * 100}%` }} />
        </div>
        <fieldset class="p-quiz-fieldset" aria-describedby={`${id}-hint`}>
          <legend tabIndex={-1} ref={legendRef}>
            {sub(cur.prompt)}
          </legend>
          <p id={`${id}-hint`} class="p-quiz-hint">
            {hint}
          </p>
          <div class={`p-quiz-options${cur.type === 'truefalse' ? ' is-tf' : ''}`}>
            {cur.answers.map((a, ai) => {
              const sel = chosen.includes(a.id);
              const mark = !checked ? null : a.correct ? 'good' : sel ? 'bad' : null;
              const missed = checked && multiple && a.correct && !sel;
              const label =
                cur.type === 'truefalse'
                  ? a.id === 'true'
                    ? q.true
                    : a.id === 'false'
                      ? q.false
                      : a.label
                  : a.label;
              return (
                <label
                  key={a.id}
                  class={`p-quiz-option${sel ? ' is-selected' : ''}${mark ? ` is-${mark}` : ''}`}
                  aria-disabled={checked ? 'true' : undefined}
                >
                  <input
                    ref={ai === 0 ? firstInput : undefined}
                    type={multiple ? 'checkbox' : 'radio'}
                    name={`${id}-q${qi}`}
                    value={a.id}
                    checked={sel}
                    disabled={checked}
                    onChange={() => toggle(a.id)}
                  />
                  <span class="p-quiz-option__label">{sub(label ?? a.label)}</span>
                  {mark === 'good' && (
                    <span class="p-quiz-mark">
                      <CircleCheck {...ICON} size={16} />
                      {missed ? q.markMissed : q.markCorrect}
                    </span>
                  )}
                  {mark === 'bad' && (
                    <span class="p-quiz-mark">
                      <CircleX {...ICON} size={16} />
                      {q.markYours}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </fieldset>
        {alert && (
          <p role="alert" class="p-quiz-alert">
            {q.selectFirst}
          </p>
        )}
        <div role="status" class="p-quiz-status-wrap">
          {checked && (
            <div class={`p-quiz-status ${ok ? 'is-ok' : 'is-ko'}`}>
              <h3 tabIndex={-1} ref={statusTitle}>
                {ok ? q.correctTitle : partial ? q.partialTitle : q.incorrectTitle}
              </h3>
              {cur.explanation && <p>{sub(cur.explanation)}</p>}
              {!ok && linked && cur.stepId && (
                <button type="button" class="p-link" onClick={() => onReviewStep(cur.stepId!)}>
                  {fmt(q, 'reviewStep', { n: linked })}
                </button>
              )}
            </div>
          )}
        </div>
        <div class="p-actions p-quiz-actions">
          {qi > 0 && !each && (
            <button
              type="button"
              class="p-btn p-btn-ghost"
              aria-label={q.previousLabel}
              onClick={() => setPhase({ kind: 'question', qi: qi - 1, checked: false })}
            >
              {q.previous}
            </button>
          )}
          {checked ? (
            <button type="button" class="p-btn p-btn-primary" onClick={next} disabled={busy}>
              {busy ? q.sending : last ? q.seeResult : q.next}
            </button>
          ) : (
            <button type="submit" class="p-btn p-btn-primary" disabled={busy}>
              {busy ? q.sending : !each && last ? q.seeResult : q.validate}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
