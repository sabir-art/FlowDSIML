/**
 * L16 : correction locale du quiz (paquet SCORM hors ligne). Même règle que submit_quiz_attempt :
 * une question est juste si l'ensemble des réponses cochées est exactement celui des bonnes réponses ;
 * score = points obtenus / points totaux (arrondi) ; réussite au seuil, toujours pour un sondage.
 */
import type { Quiz } from '@flowdsiml/manifest';
import type { QuizResult } from './api';

export function scoreQuiz(quiz: Quiz, answers: Record<string, string[]>, attemptsUsed: number): QuizResult {
  let correct = 0;
  let points = 0;
  let total = 0;
  const questions = quiz.questions.map((q) => {
    const weight = q.points;
    total += weight;
    const given = new Set(answers[q.id] ?? []);
    const known = new Set(q.answers.map((a) => a.id));
    const ok =
      given.size > 0 &&
      [...given].every((g) => known.has(g)) &&
      q.answers.every((a) => a.correct === given.has(a.id));
    if (ok) {
      correct += 1;
      points += weight;
    }
    return { questionId: q.id, correct: ok };
  });
  const score = total > 0 ? Math.round((100 * points) / total) : 0;
  const attempts = quiz.attempts;
  return {
    score,
    correct,
    total: quiz.questions.length,
    passed: quiz.mode === 'survey' || score >= quiz.threshold,
    attemptsLeft: attempts > 0 ? Math.max(0, attempts - attemptsUsed - 1) : null,
    questions,
  };
}
