import { describe, expect, it, vi } from 'vitest';
import { openCenter, type CenterGate, type Deps } from '../../../../supabase/functions/open-center/logic';

/** Edge Function open-center (L14) : logique sans Deno, avec des dépendances simulées. */
function deps(gate: CenterGate | null) {
  const d = {
    gate: vi.fn(async () => gate),
    sign: vi.fn(
      async (paths: string[]) => new Map(paths.map((p) => [p, `https://signe.example/${p}?token=t`])),
    ),
    clientKey: vi.fn(async () => 'c'.repeat(64)),
    pause: vi.fn(async () => {}),
  } satisfies Deps;
  return d;
}

const OPEN: CenterGate = {
  status: 'ok',
  paths: [
    {
      id: 'p1',
      modules: [
        { demoId: 'd1', access: 'open', cover: 'assets/s1.webp' },
        { demoId: 'd2', access: 'password', cover: 'assets/s2.webp' },
        { demoId: 'd3', access: 'expired', cover: 'assets/s3.webp' },
      ],
    },
  ],
};

describe('open-center', () => {
  it('même réponse et même délai : adresse invalide, inconnue, centre non publié, liens publics désactivés', async () => {
    // center_open renvoie {status:'not_found'} pour les trois derniers cas (pgTAP centre.test.sql)
    const cases = [
      { body: { slug: 'Pas Valide' }, gate: null },
      { body: { slug: 'inconnu-xyz' }, gate: { status: 'not_found' } },
      { body: { slug: 'non-publie' }, gate: { status: 'not_found' } },
      { body: { slug: 'liens-off' }, gate: { status: 'not_found' } },
    ];
    for (const c of cases) {
      const d = deps(c.gate as CenterGate | null);
      const r = await openCenter(JSON.stringify(c.body), d);
      expect(r).toEqual({ status: 200, body: { status: 'not_found' } });
      expect(d.pause).toHaveBeenCalledTimes(1);
      expect(d.sign).not.toHaveBeenCalled();
    }
  });

  it('mot de passe requis : délai minimal, aucun contenu ni signature', async () => {
    const d = deps({ status: 'password_required', title: 'Centre' });
    const r = await openCenter('{"slug":"ml-exemple"}', d);
    expect(r.body).toEqual({ status: 'password_required', title: 'Centre' });
    expect(d.pause).toHaveBeenCalledTimes(1);
    expect(d.sign).not.toHaveBeenCalled();
  });

  it('un module en mot de passe ou expiré ne reçoit jamais d’URL signée', async () => {
    const d = deps(OPEN);
    const r = await openCenter(
      '{"slug":"ml-exemple","linkToken":"jeton-alex-0001","visitorId":"visitor-alex-01"}',
      d,
    );
    expect(d.sign).toHaveBeenCalledWith(['d1/assets/s1.webp'], 3600);
    const mods = (r.body as CenterGate).paths![0]!.modules;
    expect(mods.map((m) => m.cover)).toEqual(['https://signe.example/d1/assets/s1.webp?token=t', null, null]);
    expect(d.pause).not.toHaveBeenCalled();
    expect(d.gate).toHaveBeenCalledWith(
      expect.objectContaining({
        p_slug: 'ml-exemple',
        p_link_token: 'jeton-alex-0001',
        p_visitor: 'visitor-alex-01',
      }),
    );
  });

  it('couverture hors « assets/ » ignorée ; corps trop gros ou invalide refusé', async () => {
    const d = deps({
      status: 'ok',
      paths: [{ modules: [{ demoId: 'd1', access: 'open', cover: '../secret.json' }] }],
    });
    const r = await openCenter('{"slug":"ml-exemple"}', d);
    expect(d.sign).not.toHaveBeenCalled();
    expect((r.body as CenterGate).paths![0]!.modules[0]!.cover).toBeNull();
    expect((await openCenter('x'.repeat(5000), deps(OPEN))).status).toBe(413);
    expect((await openCenter('{', deps(OPEN))).status).toBe(400);
  });
});
