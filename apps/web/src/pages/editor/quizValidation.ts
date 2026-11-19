import type { QuizAnswer } from './types';

export type QuestionError =
  'errEmpty' | 'errTwoAnswers' | 'errNoCorrect' | 'errAnswerEmpty' | 'errSurveyOnly';

/** L19 : note de 0 à 10 et réponse écrite, sans réponses proposées (mode Sondage seulement). */
export const isOpenType = (type: string | undefined) => type === 'nps' || type === 'text';

/** F2 (spec f2-quiz §2) : erreurs d'une question, dans l'ordre d'affichage. Même règle que publish_demo. */
export function questionErrors(
  q: { prompt: string; answers: QuizAnswer[]; type?: string },
  mode: 'quiz' | 'survey' = 'quiz',
): { prompt?: QuestionError; answers?: QuestionError } {
  const out: { prompt?: QuestionError; answers?: QuestionError } = {};
  if (!q.prompt.trim()) out.prompt = 'errEmpty';
  if (isOpenType(q.type)) {
    if (mode !== 'survey') out.answers = 'errSurveyOnly';
  } else if (q.answers.length < 2) out.answers = 'errTwoAnswers';
  else if (q.answers.some((a) => !a.label.trim())) out.answers = 'errAnswerEmpty';
  else if (mode === 'quiz' && !q.answers.some((a) => a.correct)) out.answers = 'errNoCorrect';
  return out;
}

/** Numéro (1-n) de la première question invalide, ou null. */
export function firstInvalid(
  qs: Array<{ prompt: string; answers: QuizAnswer[]; type?: string }>,
  mode: 'quiz' | 'survey' = 'quiz',
) {
  const i = qs.findIndex((q) => Object.keys(questionErrors(q, mode)).length > 0);
  return i >= 0 ? i + 1 : null;
}

/** Passage à un autre type : choix unique garde la première bonne réponse ; vrai/faux est fixe. */
export function convertAnswers(
  answers: QuizAnswer[],
  to: 'single' | 'multiple' | 'truefalse' | 'nps' | 'text',
  labels: { true: string; false: string },
): { answers: QuizAnswer[]; trimmed: boolean } {
  if (to === 'nps' || to === 'text') return { answers: [], trimmed: false };
  if (answers.length === 0)
    return {
      answers: [
        { id: newAnswerId(), label: '', correct: to !== 'multiple' },
        { id: newAnswerId(), label: '', correct: false },
      ],
      trimmed: false,
    };
  if (to === 'truefalse') {
    const wasTrue = answers.find((a) => a.id === 'true')?.correct ?? true;
    return {
      answers: [
        { id: 'true', label: labels.true, correct: wasTrue },
        { id: 'false', label: labels.false, correct: !wasTrue },
      ],
      trimmed: false,
    };
  }
  const base = answers.some((a) => a.id === 'true' || a.id === 'false')
    ? answers.map((a) => ({ ...a, id: newAnswerId() }))
    : answers;
  if (to === 'single') {
    const first = base.findIndex((a) => a.correct);
    const trimmed = base.filter((a) => a.correct).length > 1;
    return { answers: base.map((a, i) => ({ ...a, correct: i === first })), trimmed };
  }
  return { answers: base, trimmed: false };
}

export const newAnswerId = () => crypto.randomUUID().slice(0, 8);
