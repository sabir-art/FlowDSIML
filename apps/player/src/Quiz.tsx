import { useEffect, useId, useMemo, useRef, useState } from 'preact/hooks';
import type { Quiz as QuizT, QuizQuestion } from '@flowdsiml/manifest';
import { Award, BookOpen, CircleCheck, CircleX, RefreshCw, RotateCcw } from 'lucide-preact';
import { fmt, type Dict } from './i18n';
import { isCorrect, isOpenQuestion, isPartial, scoreQuiz, shuffled } from './logic';
import type { QuizResult } from './api';
import { contrast } from './center';

const ICON = { size: 18, strokeWidth: 2, 'aria-hidden': true } as const;

type Phase =
  | { kind: 'question'; qi: number; checked: boolean }
  | { kind: 'result'; result: QuizResult; saveError: boolean };

/**
 * Quiz de validation (spec f2-quiz §3–5) : vrais fieldset/legend et input dans des label,
 * correction par texte et icône (jamais la couleur seule), explication en role=status,
 * résultat avec phrase de score lue au lecteur d'écran (l'anneau est décoratif).
 */
const HEX6 = /^#[0-9a-f]{6}$/i;
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c: number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/**
 * L42 §4 : couleurs de l'arc selon la carte (surface) et le texte du thème. La piste est le texte à 10 %
 * sur la surface ; l'arc garde au moins 3:1 contre elle, sinon le texte à 70 % (même règle que les boutons).
 */
export function ringVars(primary: string, surface: string, text: string): Record<string, string> {
  if (![primary, surface, text].every((c) => HEX6.test(c))) return {};
  const s = rgb(surface);
  const tx = rgb(text);
  const track = hex(s.map((v, i) => v * 0.9 + tx[i]! * 0.1));
  const darkCard = contrast(surface, '#000000') < contrast(surface, '#FFFFFF');
  const fallback = hex(s.map((v, i) => v * 0.3 + tx[i]! * 0.7));
  const brand = darkCard && primary.toUpperCase() === '#A3195B' ? '#CF86A9' : primary;
  return {
    '--p-ring-pass': contrast(brand, track) >= 3 ? brand : fallback,
    '--p-ring-fail': darkCard ? '#A9B3BF' : '#5b6675',
  };
}

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
    // L42 : anneau 168 px, rayon 74 ; encoche du seuil coupée dans la piste, arc arrondi par-dessus
    const R = 74;
    const C = 2 * Math.PI * R;
    const t = (quiz.threshold / 100) * C;
    const arc = (result.score / 100) * C;
    return (
      <section class="p-quiz fd-player-scope" aria-label={fmt(q, 'region', { module: sub(module) })}>
        <div class="p-quiz-card p-quiz-result">
          {!survey && (
            <div class={`p-ring${passed ? ' is-pass' : ''}`}>
              <svg viewBox="0 0 168 168" aria-hidden="true">
                <circle
                  cx="84"
                  cy="84"
                  r={R}
                  class="p-ring__track"
                  stroke-dasharray={
                    quiz.threshold > 0 && quiz.threshold < 100 ? `${t - 3} 6 ${C}` : undefined
                  }
                />
                {result.score > 0 && (
                  <circle
                    cx="84"
                    cy="84"
                    r={R}
                    class="p-ring__arc"
                    style={{ strokeDasharray: `${arc} ${C}` }}
                  />
                )}
              </svg>
              <p class="p-ring__score">
                <span class="sr-only">{q.scoreLead} </span>
                {result.score}
                <span class="p-ring__pct">{q.scorePct}</span>
              </p>
              <p class="p-ring__threshold-text">{fmt(q, 'scoreThreshold', { value: quiz.threshold })}</p>
            </div>
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
                    correctText: fmt(q, 'correctCount', { count: result.correct }),
                    total: result.total,
                    score: result.score,
                    threshold: quiz.threshold,
                  })
                : canRetry && Number.isFinite(left)
                  ? fmt(q, 'failLine', {
                      correctText: fmt(q, 'correctCount', { count: result.correct }),
                      total: result.total,
                      score: result.score,
                      threshold: quiz.threshold,
                      count: left,
                    })
                  : fmt(q, 'scoreLine', {
                      correctText: fmt(q, 'correctCount', { count: result.correct }),
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
          <div class={`p-actions${passed ? ' p-actions--pass' : ''}`}>
            {passed ? (
              <>
                <button type="button" class="p-btn p-btn-primary" onClick={() => onFinish(true)}>
                  {q.finish}
                </button>
                {/* L38-14 : après une réussite, repasser le quiz n'est qu'un lien secondaire */}
                {canRetry && !survey && (
                  <button type="button" class="p-link p-quiz-retake" onClick={restart}>
                    {q.retake}
                  </button>
                )}
              </>
            ) : (
              <>
                <button type="button" class="p-btn p-btn-ghost" onClick={onRestartModule}>
                  <BookOpen {...ICON} size={16} />
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
  // L19 : note de 0 à 10 (obligatoire) et réponse écrite (facultative), en mode Sondage
  const open = isOpenQuestion(cur);
  const textValue = cur.type === 'text' ? (chosen[0] ?? '') : '';
  const checked = phase.checked;
  const ok = isCorrect(cur, chosen);
  const partial = !ok && isPartial(cur, chosen);
  const last = qi === order.length - 1;
  const answered = Object.keys(answers).filter((k) => (answers[k] ?? []).some((v) => v !== '')).length;
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
    if (!chosen.length && cur.type !== 'text') {
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

  const hint =
    cur.type === 'nps'
      ? q.hintNps
      : cur.type === 'text'
        ? q.hintText
        : cur.type === 'truefalse'
          ? q.hintTrueFalse
          : multiple
            ? q.hintMultiple
            : q.hintSingle;
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
          aria-valuenow={Math.max(answered, qi + 1)}
        >
          {/* F2-03 : la question en cours compte (1 sur 3 : environ 33 %) */}
          <div style={{ width: `${(Math.max(answered, qi + 1) / order.length) * 100}%` }} />
        </div>
        <fieldset class="p-quiz-fieldset" aria-describedby={`${id}-hint`}>
          <legend tabIndex={-1} ref={legendRef}>
            {sub(cur.prompt)}
          </legend>
          <p id={`${id}-hint`} class="p-quiz-hint">
            {hint}
          </p>
          {cur.type === 'nps' && (
            <>
              <div class="p-quiz-nps">
                {Array.from({ length: 11 }, (_, n) => (
                  <label key={n} class={`p-quiz-nps__opt${chosen[0] === String(n) ? ' is-selected' : ''}`}>
                    <input
                      ref={n === 0 ? firstInput : undefined}
                      type="radio"
                      name={`${id}-q${qi}`}
                      value={String(n)}
                      checked={chosen[0] === String(n)}
                      onChange={() => {
                        setAlert(false);
                        setAnswers((a) => ({ ...a, [cur.id]: [String(n)] }));
                      }}
                    />
                    <span>{n}</span>
                  </label>
                ))}
              </div>
              <p class="p-quiz-nps__ends" aria-hidden="true">
                <span>{q.npsLow}</span>
                <span>{q.npsHigh}</span>
              </p>
            </>
          )}
          {cur.type === 'text' && (
            <>
              <textarea
                class="p-quiz-text"
                rows={4}
                maxLength={500}
                aria-label={sub(cur.prompt)}
                aria-describedby={`${id}-hint ${id}-count`}
                value={textValue}
                onInput={(e) =>
                  setAnswers((a) => ({
                    ...a,
                    [cur.id]: [(e.target as HTMLTextAreaElement).value.slice(0, 500)],
                  }))
                }
              />
              <p id={`${id}-count`} class="p-quiz-count-chars">
                {fmt(q, 'textCount', { n: textValue.length })}
              </p>
            </>
          )}
          <div class={`p-quiz-options${cur.type === 'truefalse' ? ' is-tf' : ''}`} hidden={open}>
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
