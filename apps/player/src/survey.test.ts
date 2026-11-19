import { describe, expect, it } from 'vitest';
import { quizSchema } from '@flowdsiml/manifest';
import { quizAnswerPayload, scoreQuiz } from './logic';

const quiz = quizSchema.parse({
  mode: 'survey',
  questions: [
    { id: 'n', type: 'nps', prompt: 'Recommanderiez-vous ?' },
    { id: 't', type: 'text', prompt: 'Une suggestion ?' },
    {
      id: 'c',
      type: 'single',
      prompt: 'Format',
      answers: [
        { id: 'a', label: 'Vidéo' },
        { id: 'b', label: 'Démo' },
      ],
    },
  ],
});

describe('sondage (L19) : note de 0 à 10 et réponse écrite', () => {
  it('manifeste : nps et text sans réponses proposées', () => {
    expect(quiz.questions[0]!.answers).toEqual([]);
  });
  it('réponses envoyées selon le type', () => {
    expect(quizAnswerPayload(quiz, 'n', ['9'])).toEqual({ questionId: 'n', value: 9 });
    expect(quizAnswerPayload(quiz, 't', ['  ' + 'x'.repeat(600)])).toEqual({
      questionId: 't',
      text: 'x'.repeat(500),
    });
    expect(quizAnswerPayload(quiz, 'c', ['b'])).toEqual({ questionId: 'c', answerIds: ['b'] });
  });
  it('les questions ouvertes ne sont jamais notées', () => {
    const r = scoreQuiz(quiz, { n: ['3'], t: ['ok'], c: ['a'] });
    expect(r.passed).toBe(true);
    expect(r.questions.map((q) => q.questionId)).toEqual(['c']);
  });
});
