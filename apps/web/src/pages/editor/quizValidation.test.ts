import { describe, expect, it } from 'vitest';
import { convertAnswers, firstInvalid, questionErrors } from './quizValidation';

const a = (id: string, correct = false, label = id) => ({ id, label, correct });

describe('validation du quiz', () => {
  it('erreurs par question', () => {
    expect(questionErrors({ prompt: ' ', answers: [a('x', true), a('y')] })).toEqual({ prompt: 'errEmpty' });
    expect(questionErrors({ prompt: 'Q', answers: [a('x', true)] })).toEqual({ answers: 'errTwoAnswers' });
    expect(questionErrors({ prompt: 'Q', answers: [a('x'), a('y')] })).toEqual({ answers: 'errNoCorrect' });
    expect(questionErrors({ prompt: 'Q', answers: [a('x'), a('y')] }, 'survey')).toEqual({});
    expect(questionErrors({ prompt: 'Q', answers: [a('x', true), a('y', false, '')] })).toEqual({
      answers: 'errAnswerEmpty',
    });
    expect(
      firstInvalid([
        { prompt: 'Q', answers: [a('x', true), a('y')] },
        { prompt: '', answers: [] },
      ]),
    ).toBe(2);
  });
  it('changement de type', () => {
    const r = convertAnswers([a('x', true), a('y', true), a('z')], 'single', { true: 'Vrai', false: 'Faux' });
    expect(r.trimmed).toBe(true);
    expect(r.answers.map((x) => x.correct)).toEqual([true, false, false]);
    const tf = convertAnswers([a('x', true)], 'truefalse', { true: 'Vrai', false: 'Faux' });
    expect(tf.answers.map((x) => [x.id, x.label, x.correct])).toEqual([
      ['true', 'Vrai', true],
      ['false', 'Faux', false],
    ]);
  });
  it('L19 : note de 0 à 10 et réponse écrite, en mode Sondage seulement', () => {
    expect(questionErrors({ prompt: 'Recommanderiez-vous ?', answers: [], type: 'nps' }, 'survey')).toEqual(
      {},
    );
    expect(questionErrors({ prompt: 'Un avis ?', answers: [], type: 'text' }, 'quiz')).toEqual({
      answers: 'errSurveyOnly',
    });
    expect(convertAnswers([], 'single', { true: 'Vrai', false: 'Faux' }).answers).toHaveLength(2);
    expect(
      convertAnswers([{ id: 'a', label: 'A', correct: true }], 'nps', { true: 'V', false: 'F' }).answers,
    ).toEqual([]);
  });
});
