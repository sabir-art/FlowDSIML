import { describe, expect, it } from 'vitest';
import { demoTexts, localChecks } from './SuggestionsPanel';

type Arg = Parameters<typeof demoTexts>[0];
const step = (id: string, patch: Record<string, unknown>) =>
  ({
    id,
    kind: 'image',
    title: '',
    body: '',
    alt_text: 'Capture',
    video: null,
    ...patch,
  }) as unknown as Arg['steps'][number];
const spot = (id: string, step_id: string, position: number, title: string, body: string) =>
  ({ id, step_id, position, title, body }) as unknown as Arg['hotspots'][number];

describe('textes lus par l’assistant (L63)', () => {
  // Démo vidéo : une étape, 29 pauses-étapes. L'assistant ne voyait que le titre de l'étape.
  const pauses = Array.from({ length: 29 }, (_, i) => ({
    id: `p${i + 1}`,
    t: (i + 1) * 1000,
    title: `Pause ${i + 1}`,
    body: i % 2 ? `Texte de la pause ${i + 1}` : '',
  }));
  const editor: Arg = {
    steps: [
      step('v1', { kind: 'video', title: 'Créer une voix', video: { pauses, cuts: [], captions: [] } }),
      step('t1', { kind: 'text', title: 'Bravo', body: 'Vous savez créer une voix.' }),
      step('i1', { title: 'div:has(> #search-text-area-floating)' }),
    ],
    hotspots: [
      spot('h2', 'i1', 1, 'Cliquez sur « Generate speechText to SpeechOpen in playground »', ''),
      spot('h1', 'i1', 0, 'Ouvrez le menu', 'Le menu est en haut à droite.'),
    ],
  };
  const texts = demoTexts(editor);

  it('lit tous les textes de toutes les étapes, dans l’ordre', () => {
    expect(texts.filter((x) => x.id.startsWith('p:v1:title:'))).toHaveLength(29);
    expect(texts.filter((x) => x.id.startsWith('p:v1:body:'))).toHaveLength(14);
    expect(texts.find((x) => x.id === 's:t1:body')?.text).toBe('Vous savez créer une voix.');
    expect(texts.map((x) => x.id).slice(0, 3)).toEqual(['s:v1:title', 'p:v1:title:p1', 'p:v1:title:p2']);
    // Bulles dans l'ordre de leur position, après le titre de leur étape
    const i1 = texts.filter((x) => x.n === 3).map((x) => x.id);
    expect(i1).toEqual(['s:i1:title', 'h:h1:title', 'h:h1:body', 'h:h2:title']);
    expect(texts.every((x) => x.text.trim())).toBe(true);
  });

  it('signale sans IA les titres techniques laissés par la capture', () => {
    const found = localChecks(editor, (k) => k).filter((s) => s.id.startsWith('tech:'));
    expect(found.map((s) => s.key)).toEqual(['s:i1:title', 'h:h2:title']);
    expect(found.every((s) => s.type === 'clarity' && s.local && s.stepId === 'i1')).toBe(true);
  });
});
