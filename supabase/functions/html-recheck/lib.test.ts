import { assertEquals } from 'jsr:@std/assert@1';
import { recheckPlan, recheckUrls, type RecheckStep } from './lib.ts';

const BAD = 'https://testsafebrowsing.appspot.com/s/malware.html';
const step = (
  ops: RecheckStep['html_ops'],
  security: Record<string, unknown> = { safeBrowsing: 'ok' },
): RecheckStep => ({
  id: 's1',
  html_path: 'w/d/p.html',
  html_meta: {
    links: [
      { sel: '#doc', href: BAD, label: 'Guide' },
      { sel: '#ok', href: 'https://docs.globex.example/', label: 'Docs' },
    ],
    security,
  },
  html_ops: ops,
});

Deno.test('adresses : liens repérés et liens autorisés, sans doublon', () => {
  assertEquals(
    recheckUrls([step([{ op: 'extlink', sel: '#doc', value: BAD }])]).sort(),
    [BAD, 'https://docs.globex.example/'].sort(),
  );
});

Deno.test('lien autorisé devenu dangereux : bloqué, signalé à l’éditeur', () => {
  const plan = recheckPlan(
    [step([{ id: 'e1', op: 'extlink', sel: '#doc', value: BAD }])],
    new Set([BAD]),
    'T',
  );
  assertEquals(plan.length, 1);
  assertEquals(plan[0].security.blocked, [BAD]);
  assertEquals(plan[0].security.dangerousLinks, 1);
  assertEquals(plan[0].newlyBlocked, ['Guide']);
});

Deno.test(
  'rien de nouveau : aucune écriture ; vérification précédente indisponible : rapport rétabli',
  () => {
    assertEquals(recheckPlan([step([])], new Set(), 'T'), []);
    const p = recheckPlan([step([], { safeBrowsing: 'unavailable' })], new Set(), 'T');
    assertEquals(p[0].security.safeBrowsing, 'ok');
    assertEquals(p[0].security.dangerousLinks, 0);
  },
);
