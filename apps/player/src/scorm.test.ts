import { describe, expect, it } from 'vitest';
import { quizSchema } from '@flowdsiml/manifest';
import { findApi, ScormSession, time12, time2004 } from './scorm';
import { scoreQuiz } from './quizScore';
import { sha256HexSync } from './sha256';

/** Faux LMS : mémorise les appels et les valeurs. */
function fakeApi(version: '1.2' | '2004', init: Record<string, string> = {}) {
  const data: Record<string, string> = { ...init };
  const calls: string[] = [];
  const get = (k: string) => data[k] ?? '';
  const set = (k: string, v: string) => {
    calls.push(`set ${k}=${v}`);
    data[k] = v;
    return 'true';
  };
  const api =
    version === '1.2'
      ? {
          LMSInitialize: () => (calls.push('init'), 'true'),
          LMSGetValue: get,
          LMSSetValue: set,
          LMSCommit: () => (calls.push('commit'), 'true'),
          LMSFinish: () => (calls.push('finish'), 'true'),
        }
      : {
          Initialize: () => (calls.push('init'), 'true'),
          GetValue: get,
          SetValue: set,
          Commit: () => (calls.push('commit'), 'true'),
          Terminate: () => (calls.push('finish'), 'true'),
        };
  return { api, data, calls };
}

describe('durées SCORM', () => {
  it('1.2 : HH:MM:SS.SS', () => {
    expect(time12(0)).toBe('00:00:00.00');
    expect(time12(3_723_450)).toBe('01:02:03.45');
  });
  it('2004 : ISO 8601', () => {
    expect(time2004(0)).toBe('PT0S');
    expect(time2004(45_000)).toBe('PT45S');
    expect(time2004(3_723_450)).toBe('PT1H2M3.45S');
    expect(time2004(120_000)).toBe('PT2M0S');
  });
});

describe('findApi', () => {
  it('trouve l’API dans une fenêtre parente', () => {
    const top = { API: { x: 1 } } as unknown as Window & { parent: Window };
    (top as { parent: Window }).parent = top;
    const child = { parent: top, opener: null } as unknown as Window;
    expect(findApi('1.2', child)).toEqual({ x: 1 });
    expect(findApi('2004', child)).toBeNull();
  });
});

describe('ScormSession 1.2', () => {
  it('initialise, suit les étapes, termine sans quiz', () => {
    const { api, data, calls } = fakeApi('1.2', {
      'cmi.core.lesson_status': 'not attempted',
      'cmi.core.student_id': 'etu-42',
    });
    const s = new ScormSession('1.2', api as never);
    expect(s.init()).toEqual({ learnerId: 'etu-42', resumeStep: null });
    expect(data['cmi.core.lesson_status']).toBe('incomplete');
    s.step(1, 3);
    expect(data['cmi.core.lesson_location']).toBe('1');
    expect(data['cmi.suspend_data']).toBe('{"step":1}');
    s.step(2, 3);
    expect(data['cmi.core.lesson_status']).toBe('completed');
    s.finish();
    expect(data['cmi.core.session_time']).toMatch(/^\d{2,4}:\d{2}:\d{2}\.\d{2}$/);
    expect(data['cmi.core.exit']).toBe('');
    expect(calls[0]).toBe('init');
    expect(calls.at(-1)).toBe('finish');
    s.finish();
    expect(calls.filter((c) => c === 'finish')).toHaveLength(1);
  });

  it('quiz : failed puis passed, meilleur score, jamais rétrogradé', () => {
    const { api, data } = fakeApi('1.2');
    const s = new ScormSession('1.2', api as never);
    s.init();
    s.quiz(40, false);
    expect(data['cmi.core.lesson_status']).toBe('failed');
    expect(data['cmi.core.score.raw']).toBe('40');
    s.quiz(80, true);
    s.quiz(60, false);
    expect(data['cmi.core.lesson_status']).toBe('passed');
    expect(data['cmi.core.score.raw']).toBe('80');
    expect(data['cmi.core.score.max']).toBe('100');
  });

  it('reprise : entry=resume et lesson_location', () => {
    const { api } = fakeApi('1.2', { 'cmi.core.entry': 'resume', 'cmi.core.lesson_location': '4' });
    expect(new ScormSession('1.2', api as never).init().resumeStep).toBe(4);
  });

  it('module non terminé : sortie « suspend »', () => {
    const { api, data } = fakeApi('1.2');
    const s = new ScormSession('1.2', api as never);
    s.init();
    s.step(0, 5);
    s.finish();
    expect(data['cmi.core.exit']).toBe('suspend');
  });
});

describe('ScormSession 2004', () => {
  it('completion_status, success_status, score.scaled, session_time ISO', () => {
    const { api, data } = fakeApi('2004', { 'cmi.completion_status': 'unknown', 'cmi.learner_id': 'L1' });
    const s = new ScormSession('2004', api as never);
    expect(s.init().learnerId).toBe('L1');
    expect(data['cmi.completion_status']).toBe('incomplete');
    s.step(2, 3);
    expect(data['cmi.completion_status']).toBe('completed');
    expect(data['cmi.location']).toBe('2');
    s.quiz(75, true);
    expect(data['cmi.success_status']).toBe('passed');
    expect(data['cmi.score.scaled']).toBe('0.75');
    expect(data['cmi.score.raw']).toBe('75');
    s.finish();
    expect(data['cmi.session_time']).toMatch(/^PT/);
    expect(data['cmi.core.lesson_status']).toBeUndefined();
  });
});

describe('sans LMS', () => {
  it('ne fait rien', () => {
    const s = new ScormSession('1.2', null);
    expect(s.active).toBe(false);
    expect(s.init()).toEqual({ learnerId: '', resumeStep: null });
    s.step(0, 1);
    s.quiz(10, false);
    s.finish();
  });
});

describe('scoreQuiz (même règle que submit_quiz_attempt)', () => {
  const quiz = quizSchema.parse({
    threshold: 70,
    attempts: 3,
    questions: [
      {
        id: 'q1',
        type: 'single',
        prompt: 'Un',
        answers: [
          { id: 'a', label: 'A', correct: true },
          { id: 'b', label: 'B' },
        ],
      },
      {
        id: 'q2',
        type: 'multiple',
        prompt: 'Deux',
        points: 2,
        answers: [
          { id: 'a', label: 'A', correct: true },
          { id: 'b', label: 'B', correct: true },
          { id: 'c', label: 'C' },
        ],
      },
    ],
  });
  it('toutes justes : 100, réussi', () => {
    const r = scoreQuiz(quiz, { q1: ['a'], q2: ['a', 'b'] }, 0);
    expect(r).toMatchObject({ score: 100, correct: 2, total: 2, passed: true, attemptsLeft: 2 });
  });
  it('réponse multiple incomplète : fausse ; points pondérés', () => {
    const r = scoreQuiz(quiz, { q1: ['a'], q2: ['a'] }, 1);
    expect(r).toMatchObject({ score: 33, correct: 1, passed: false, attemptsLeft: 1 });
  });
  it('réponse inconnue ou vide : fausse', () => {
    expect(scoreQuiz(quiz, { q1: ['z'], q2: [] }, 0).score).toBe(0);
  });
  it('sondage : toujours réussi', () => {
    expect(scoreQuiz({ ...quiz, mode: 'survey' }, {}, 0).passed).toBe(true);
  });
});

describe('sha256HexSync (repli sans Web Crypto)', () => {
  it('vecteurs de la norme', () => {
    expect(sha256HexSync('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256HexSync('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256HexSync('a'.repeat(1000))).toBe(
      '41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3',
    );
    expect(sha256HexSync('élève-0042')).toHaveLength(64);
  });
});
