import { assert, assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { AiError } from './lib.ts';
import {
  cuesFromWords,
  estimateSeconds,
  mp3DurationMs,
  parseCaptions,
  parseVoice,
  providerRefusal,
  resolveVoices,
  VOICES,
} from './audio.ts';

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

Deno.test('providerRefusal : la cause est nommée sans secret, le message du fournisseur est ignoré', () => {
  const d = (status: string, message = 'texte libre du fournisseur') => ({ detail: { status, message } });
  // Quota épuisé : le fournisseur répond 401, le code passe avant le statut
  assertEquals(providerRefusal(401, d('quota_exceeded')), {
    error: 'PROVIDER_QUOTA',
    http: 503,
    log: '401 quota_exceeded',
  });
  // 402 : l'offre du compte ne permet pas la demande (ce n'est pas un quota épuisé)
  assertEquals(providerRefusal(402, null), { error: 'PROVIDER_PLAN', http: 502, log: '402' });
  assertEquals(providerRefusal(402, d('paid_plan_required')).error, 'PROVIDER_PLAN');
  // Sans code : le nom de la première clé de detail, jamais une valeur
  assertEquals(providerRefusal(402, { detail: { message: 'texte libre cle-factice' } }).log, '402 (message)');
  assertEquals(providerRefusal(422, { detail: [{ loc: ['body'] }] }).log, '422');
  assertEquals(providerRefusal(401, d('invalid_api_key')).error, 'PROVIDER_KEY');
  assertEquals(providerRefusal(401, d('missing_permissions')).error, 'PROVIDER_KEY');
  assertEquals(providerRefusal(401, d('detected_unusual_activity')), {
    error: 'PROVIDER_KEY',
    http: 502,
    log: '401 detected_unusual_activity',
  });
  assertEquals(providerRefusal(403, 'pas du JSON').error, 'PROVIDER_KEY');
  assertEquals(providerRefusal(404, d('voice_not_found')).error, 'PROVIDER_VOICE');
  assertEquals(providerRefusal(400, d('model_not_found')).error, 'PROVIDER_VOICE');
  assertEquals(providerRefusal(429, d('too_many_concurrent_requests')), {
    error: 'PROVIDER',
    http: 503,
    log: '429 too_many_concurrent_requests',
  });
  assertEquals(providerRefusal(500, null), { error: 'PROVIDER', http: 503, log: '500' });
  assertEquals(providerRefusal(null, null), { error: 'PROVIDER', http: 502, log: 'network' });
  // Un code hors format (phrase, majuscules, trop long) n'est jamais journalisé
  for (const bad of ['Clé sk_secret refusée', 'QUOTA', 'a'.repeat(60), 42 as unknown as string])
    assertEquals(providerRefusal(400, { detail: { status: bad } }).log, '400');
  assert(
    !providerRefusal(401, d('quota_exceeded', 'cle-factice dans le message')).log.includes('cle-factice'),
  );
});

Deno.test('resolveVoices : les voix proposées sont celles du compte', () => {
  const v = (voice_id: string, gender: string, category = 'premade', language = 'en') => ({
    voice_id,
    category,
    labels: { gender, language },
  });
  // Les identifiants prévus présents sur le compte sont gardés tels quels
  const all = Object.values(VOICES).map((id, i) => v(id, i < 3 ? 'female' : 'male'));
  assertEquals(resolveVoices(all), VOICES);
  // Compte sans aucune des voix prévues : même genre, prédéfinies d'abord, puis la langue
  const account = [
    v('lib-f-1', 'female', 'professional', 'fr'),
    v('pre-f-en', 'female', 'premade', 'en'),
    v('pre-f-fr', 'female', 'premade', 'fr'),
    v('pre-m-1', 'male', 'premade', 'en'),
    v('own-m-1', 'male', 'cloned', 'fr'),
    { voice_id: 42 },
  ];
  assertEquals(resolveVoices(account), {
    claire: 'pre-f-fr',
    louise: 'pre-f-en',
    sarah: 'lib-f-1',
    antoine: 'pre-m-1',
    adam: 'own-m-1',
  });
  // Une voix prévue présente garde sa place, les autres se partagent le reste sans doublon
  const mixed = resolveVoices([v(VOICES.adam!, 'male'), v('pre-m-2', 'male')]);
  assertEquals(mixed, { adam: VOICES.adam!, antoine: 'pre-m-2' });
  // Une ancienne voix (is_legacy) cède sa place à une voix actuelle, et ne sert qu'en dernier recours
  const legacy = { ...v(VOICES.claire!, 'female'), is_legacy: true };
  assertEquals(resolveVoices([legacy, v('pre-f-2', 'female')]), {
    claire: 'pre-f-2',
    louise: VOICES.claire!,
  });
  assertEquals(resolveVoices([]), {});
});
