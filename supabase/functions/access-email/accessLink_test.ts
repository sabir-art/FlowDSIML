import { assert, assertEquals } from 'jsr:@std/assert@1';
import { ACCESS_LINK_TTL_S, isAccessLink, signAccessLink, verifyAccessLink } from '../_shared/accessLink.ts';

const SECRET = 'cle-factice';
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const OTHER = '0b5c1f0e-0000-4000-8000-000000000002';
const NOW = 1_800_000_000;

Deno.test('lien copié : valable pour sa démo et son adresse', async () => {
  const t = await signAccessLink(SECRET, DEMO, 'Sami@Nord.example', NOW);
  assert(isAccessLink(t));
  assertEquals(await verifyAccessLink(SECRET, DEMO, t, NOW + 60), 'sami@nord.example');
});

Deno.test('lien copié : refusé pour une autre démo', async () => {
  const t = await signAccessLink(SECRET, DEMO, 'sami@nord.example', NOW);
  assertEquals(await verifyAccessLink(SECRET, OTHER, t, NOW + 60), null);
});

Deno.test('lien copié : refusé après expiration', async () => {
  const t = await signAccessLink(SECRET, DEMO, 'sami@nord.example', NOW);
  assertEquals(await verifyAccessLink(SECRET, DEMO, t, NOW + ACCESS_LINK_TTL_S), null);
});

Deno.test('lien copié : adresse, échéance ou signature modifiées, refusé', async () => {
  const t = await signAccessLink(SECRET, DEMO, 'sami@nord.example', NOW);
  const [p, , exp, sig] = t.split('.');
  const autre = btoa('admin@nord.example').replace(/=+$/, '');
  assertEquals(await verifyAccessLink(SECRET, DEMO, `${p}.${autre}.${exp}.${sig}`, NOW), null);
  assertEquals(
    await verifyAccessLink(SECRET, DEMO, t.replace(`.${exp}.`, `.${Number(exp) + 1}.`), NOW),
    null,
  );
  assertEquals(await verifyAccessLink(SECRET, DEMO, t.slice(0, -2) + 'AA', NOW), null);
  assertEquals(await verifyAccessLink('autre-cle-factice', DEMO, t, NOW), null);
  assertEquals(await verifyAccessLink(SECRET, DEMO, 'tcl1.x.y.z', NOW), null);
});
