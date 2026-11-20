import { describe, expect, it } from 'vitest';
import { publishTodo, todoLines } from './publishTodo';

const base = {
  title: 'Créer un rendez-vous',
  defaultTitle: 'Nouvelle démo',
  steps: [] as Array<{ id: string; kind: string; title: string }>,
  hotspots: [] as Array<{ step_id: string; title: string; body: string | null }>,
  quizOpened: false,
  questions: 0,
};

describe('publishTodo', () => {
  it('démo complète : rien à signaler', () => {
    expect(
      publishTodo({
        ...base,
        steps: [{ id: 's1', kind: 'image', title: 'Ouvrir l’agenda' }],
        hotspots: [{ step_id: 's1', title: 'Cliquez sur Agenda', body: '' }],
      }),
    ).toEqual([]);
  });
  it('titre par défaut ou vide', () => {
    expect(publishTodo({ ...base, title: 'Nouvelle démo' })).toEqual([{ kind: 'demoTitle' }]);
    expect(publishTodo({ ...base, title: '  ' })).toEqual([{ kind: 'demoTitle' }]);
  });
  it('étapes sans titre, sans bulle, bulle vide (balises et espaces ignorés) ; étapes de texte ignorées', () => {
    const r = publishTodo({
      ...base,
      steps: [
        { id: 's1', kind: 'image', title: '' },
        { id: 's2', kind: 'image', title: 'Étape 2' },
        { id: 's3', kind: 'text', title: '' },
        { id: 's4', kind: 'image', title: 'Étape 4' },
      ],
      hotspots: [
        { step_id: 's2', title: ' ', body: '<p>&nbsp;</p>' },
        { step_id: 's4', title: '', body: '<p>Cliquez sur Enregistrer</p>' },
      ],
    });
    expect(r).toEqual([
      { kind: 'untitled', index: 0 },
      { kind: 'noBubble', index: 0 },
      { kind: 'emptyBubble', index: 1 },
    ]);
  });
  it('quiz ouvert sans question', () => {
    expect(publishTodo({ ...base, quizOpened: true })).toEqual([{ kind: 'quizEmpty' }]);
    expect(publishTodo({ ...base, quizOpened: true, questions: 2 })).toEqual([]);
  });
  it('lignes regroupées par étape, titre de la démo en premier, quiz en dernier', () => {
    expect(
      todoLines([
        { kind: 'untitled', index: 2 },
        { kind: 'quizEmpty' },
        { kind: 'noBubble', index: 2 },
        { kind: 'emptyBubble', index: 0 },
        { kind: 'demoTitle' },
      ]),
    ).toEqual([
      { key: 'demoTitle', kinds: ['demoTitle'] },
      { key: 's0', index: 0, kinds: ['emptyBubble'] },
      { key: 's2', index: 2, kinds: ['untitled', 'noBubble'] },
      { key: 'quizEmpty', kinds: ['quizEmpty'] },
    ]);
  });
});
