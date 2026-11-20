import { assert, assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { AiError, buildPrompt, checkOutput, HAIKU, looksReal, parseRequest, redact, SONNET } from './lib.ts';

Deno.test('redact : e-mail, téléphone, NIR, nom masqués ; variables gardées', () => {
  const r = redact(
    'Écrire à camille.durand@acme.example ou au 06 12 34 56 78, NIR 1 85 05 78 006 084 36, {{prenom}} Camille DURAND',
  );
  assertEquals(r.count, 4);
  assert(!r.text.includes('camille.durand'));
  assert(!r.text.includes('06 12'));
  assert(!r.text.includes('DURAND'));
  assert(r.text.includes('{{prenom}}'));
  assert(r.text.includes('[email]'));
});

Deno.test('parseRequest : tâche, action, tailles bornées', () => {
  assertThrows(() => parseRequest({ task: 'image' }), AiError, 'BAD_TASK');
  assertThrows(
    () => parseRequest({ task: 'write', input: { action: 'poem', text: 'x' } }),
    AiError,
    'BAD_ACTION',
  );
  assertThrows(
    () => parseRequest({ task: 'write', input: { action: 'shorten', text: 'x'.repeat(2001) } }),
    AiError,
  );
  assertThrows(
    () => parseRequest({ task: 'generate', input: { plan: 'x'.repeat(4001) } }),
    AiError,
    'TOO_LONG_PLAN',
  );
  assertThrows(
    () =>
      parseRequest({
        task: 'translate',
        lang: 'fr',
        input: { target: 'fr', items: [{ id: 'a', text: 'b' }] },
      }),
    AiError,
    'BAD_TARGET',
  );
  assertThrows(
    () => parseRequest({ task: 'dataset', input: { rows: 1000, columns: ['Nom'] } }),
    AiError,
    'BAD_ROWS',
  );
  const p = parseRequest({
    task: 'write',
    lang: 'en',
    input: { action: 'tone', tone: 'warm', text: 'Cliquez ici, Camille DURAND' },
  });
  assertEquals(p.lang, 'en');
  assertEquals(p.redacted, 1);
});

Deno.test('buildPrompt : modèles par tâche, langue de la démo', () => {
  const w = buildPrompt(
    parseRequest({ task: 'write', lang: 'de', input: { action: 'spelling', text: 'Klik hier' } }),
  );
  assertEquals(w.model, HAIKU);
  assert(w.system.includes('allemand'));
  const t = buildPrompt(
    parseRequest({
      task: 'translate',
      input: { target: 'ar', items: [{ id: 's1', text: 'Ouvrir' }], glossary: [{ term: 'TutoClick' }] },
    }),
  );
  assertEquals(t.model, SONNET);
  assert(t.system.includes('ne pas traduire'));
  const a = buildPrompt(
    parseRequest({ task: 'assistant', input: { messages: [{ role: 'user', text: 'Combien d’étapes ?' }] } }),
  );
  assertEquals(a.schema, null);
});

Deno.test('checkOutput : ids inconnus écartés, jeu de données sans valeur réaliste', () => {
  const payload = parseRequest({
    task: 'translate',
    input: { target: 'en', items: [{ id: 's1', text: 'Ouvrir' }] },
  }).payload;
  assertEquals(
    checkOutput(
      'translate',
      {
        items: [
          { id: 's1', text: 'Open' },
          { id: 'zz', text: 'x' },
        ],
      },
      payload,
    ),
    {
      items: [{ id: 's1', text: 'Open' }],
    },
  );
  const d = parseRequest({ task: 'dataset', input: { rows: 10, columns: ['Nom', 'E-mail'] } }).payload;
  const out = checkOutput(
    'dataset',
    { rows: [['Léa Martin', 'lea@acme.example'], ['Paul Roy', 'paul@gmail.com'], ['x']] },
    d,
  ) as { rows: string[][] };
  assertEquals(out.rows, [
    ['Léa Martin', 'lea@acme.example'],
    ['Paul Roy', ''],
  ]);
  assert(!looksReal('01 99 00 12 34'));
  assert(looksReal('06 12 34 56 78'));
});

Deno.test('generate : chapitres bornés, quiz à une bonne réponse', () => {
  const payload = parseRequest({
    task: 'generate',
    input: { plan: 'Ouvrir\nCliquer', withQuiz: true },
  }).payload;
  const out = checkOutput(
    'generate',
    {
      title: 'Créer un usager',
      chapters: [{ title: '', steps: Array.from({ length: 40 }, (_, i) => ({ title: `É${i}`, text: 'T' })) }],
      quiz: [
        {
          prompt: 'Q1',
          answers: [
            { text: 'a', correct: true },
            { text: 'b', correct: false },
          ],
        },
        {
          prompt: 'Q2',
          answers: [
            { text: 'a', correct: true },
            { text: 'b', correct: true },
          ],
        },
      ],
    },
    payload,
  ) as { chapters: Array<{ steps: unknown[] }>; quiz: unknown[] };
  assertEquals(out.chapters[0]!.steps.length, 30);
  assertEquals(out.quiz.length, 1);
});
