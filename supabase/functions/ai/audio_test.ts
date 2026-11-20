import { assert, assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { AiError } from './lib.ts';
import { cuesFromWords, estimateSeconds, mp3DurationMs, parseCaptions, parseVoice } from './audio.ts';

const STEP = '0b5c1f0e-0000-4000-8000-000000000001';

Deno.test('parseVoice : texte borné, données personnelles refusées, voix par défaut', () => {
  const v = parseVoice({ stepId: STEP, text: 'Cliquez sur Ajouter.' });
  assertEquals(v.voice, 'claire');
  assertEquals(v.speed, 1);
  assertEquals(parseVoice({ stepId: STEP, text: 'Texte', voice: 'adam', speed: 'fast' }).speed, 1.15);
  assert(v.estimate >= 1);
  assertThrows(() => parseVoice({ stepId: 'x', text: 'a' }), AiError, 'BAD_STEP');
  assertThrows(
    () => parseVoice({ stepId: STEP, text: 'Écrivez à camille@acme.example' }),
    AiError,
    'PII_IN_TEXT',
  );
  assertThrows(() => parseVoice({ stepId: STEP, text: 'a'.repeat(1001) }), AiError, 'TOO_LONG_TEXT');
  assertThrows(() => parseCaptions({ stepId: '' }), AiError, 'BAD_STEP');
  assertEquals(parseCaptions({ stepId: STEP, source: 'voice' }).source, 'voice');
  assertEquals(parseCaptions({ stepId: STEP }).source, 'video');
});

Deno.test('mp3DurationMs : 128 kbit/s', () => {
  assertEquals(mp3DurationMs(16_000), 1000);
});

Deno.test('cuesFromWords : phrases, 7 s au plus, événements ignorés', () => {
  const w = (text: string, start: number, end: number, type = 'word') => ({ text, start, end, type });
  const s = (t: number) => ({ text: ' ', start: t, end: t, type: 'spacing' });
  const cues = cuesFromWords([
    w('Ouvrez', 0, 0.4),
    s(0.4),
    w('le', 0.45, 0.5),
    s(0.5),
    w('menu.', 0.55, 1),
    w('(rires)', 1, 1.5, 'audio_event'),
    w('Cliquez', 2, 2.4),
    s(2.4),
    w('ensuite', 2.5, 9.5),
  ]);
  assertEquals(cues[0], { from: 0, to: 1000, text: 'Ouvrez le menu.' });
  assertEquals(cues.length, 3);
  assert(cues.every((c) => !c.text.includes('rires')));
});

Deno.test('estimateSeconds : 14 caractères par seconde, vitesse prise en compte', () => {
  assertEquals(estimateSeconds('a'.repeat(140)), 10);
  assertEquals(estimateSeconds('a'.repeat(140), 1.15), 9);
});
