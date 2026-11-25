import { describe, expect, it } from 'vitest';
import { ATTACH_TTL_MS, attachFor, parseAttach } from './external';
import { ADD_TTL_MS, liveTarget, parseAdd } from './external';

const APP = 'https://app.tutoclick.example';
const ok = {
  type: 'fd:sandbox-attach',
  v: 1,
  demoId: '11111111-2222-4333-8444-555555555555',
  workspaceId: '66666666-7777-4888-9999-000000000000',
  url: 'https://crm.acme.example/rapports',
};

describe('EXT-CONNECT : message de l’app vers l’extension', () => {
  it('accepte le message attendu, depuis l’origine exacte de l’app', () => {
    expect(parseAttach(ok, APP, APP)).toEqual({
      ok: true,
      req: { demoId: ok.demoId, workspaceId: ok.workspaceId, url: ok.url },
    });
  });

  it('refuse une origine étrangère, un sous-domaine, http ou une origine absente', () => {
    for (const from of [
      'https://evil.example',
      'https://x.app.tutoclick.example',
      'http://app.tutoclick.example',
      undefined,
    ])
      expect(parseAttach(ok, from, APP)).toEqual({ ok: false, error: 'origin' });
    expect(parseAttach(ok, APP, null)).toEqual({ ok: false, error: 'origin' });
  });

  it('refuse un message mal formé', () => {
    const bad: unknown[] = [
      null,
      'fd:sandbox-attach',
      [ok],
      { ...ok, type: 'fd:start' },
      { ...ok, v: 2 },
      { ...ok, demoId: 'abc' },
      { ...ok, workspaceId: undefined },
      { ...ok, url: 'javascript:alert(1)' },
      { ...ok, url: 'file:///etc/passwd' },
      { ...ok, url: 'pas une adresse' },
      { ...ok, url: `https://crm.acme.example/${'a'.repeat(2000)}` },
      // Aucune clé en plus : ni jeton ni donnée de session
      { ...ok, token: 'eyJhbGciOi' },
      { type: ok.type, v: 1, demoId: ok.demoId, url: ok.url },
    ];
    for (const m of bad) expect(parseAttach(m, APP, APP)).toEqual({ ok: false, error: 'schema' });
  });

  it('le rattachement en attente ne vaut que sur l’origine de la page, 15 minutes', () => {
    const p = { ...ok, origin: 'https://crm.acme.example', at: 1000 };
    expect(attachFor(p, 'https://crm.acme.example/autre', 2000)).toBe(p);
    expect(attachFor(p, 'https://autre.example/', 2000)).toBeNull();
    expect(attachFor(p, 'https://crm.acme.example/', 1000 + ATTACH_TTL_MS + 1)).toBeNull();
    expect(attachFor(undefined, 'https://crm.acme.example/', 2000)).toBeNull();
  });
});

describe('EXT-02 §8 : messages de l’ajout d’étapes', () => {
  const APP = 'https://app.example';
  const DEMO = '22222222-2222-2222-2222-222222222222';
  const WS = '11111111-1111-1111-1111-111111111111';
  const STEP = '44444444-4444-4444-4444-444444444444';
  const add = {
    type: 'fd:add-steps',
    v: 1,
    demoId: DEMO,
    workspaceId: WS,
    afterStepId: STEP,
    url: 'https://crm.example/clients',
  };

  it('laisse passer les autres messages (rattachement à un Sandbox)', () => {
    expect(parseAdd({ type: 'fd:sandbox-attach', v: 1 }, APP, APP)).toBeNull();
    expect(parseAdd(null, APP, APP)).toBeNull();
  });
  it('refuse une autre origine, même pour un simple ping', () => {
    expect(parseAdd({ type: 'fd:ping', v: 1 }, 'https://autre.example', APP)).toEqual({
      ok: false,
      error: 'origin',
    });
    expect(parseAdd(add, undefined, APP)).toEqual({ ok: false, error: 'origin' });
  });
  it('accepte le ping et la demande d’ajout au schéma strict', () => {
    expect(parseAdd({ type: 'fd:ping', v: 1 }, APP, APP)).toEqual({ ok: true, req: { type: 'fd:ping' } });
    expect(parseAdd(add, APP, APP)).toEqual({
      ok: true,
      req: {
        type: 'fd:add-steps',
        demoId: DEMO,
        workspaceId: WS,
        afterStepId: STEP,
        url: 'https://crm.example/clients',
        mode: 'clicks',
      },
    });
    expect(parseAdd({ ...add, afterStepId: null }, APP, APP)).toMatchObject({
      ok: true,
      req: { afterStepId: null },
    });
    // « mode » facultatif : absent, ce sont des captures d'écran ; « html » demande une capture HTML
    expect(parseAdd(add, APP, APP)).toMatchObject({ ok: true, req: { mode: 'clicks' } });
    expect(parseAdd({ ...add, mode: 'html' }, APP, APP)).toMatchObject({ ok: true, req: { mode: 'html' } });
    expect(parseAdd({ ...add, mode: 'video' }, APP, APP)).toEqual({ ok: false, error: 'schema' });
  });
  it('refuse une clé en plus, une version inconnue, un identifiant ou une adresse invalides', () => {
    for (const bad of [
      { ...add, jeton: 'x' },
      { ...add, v: 2 },
      { ...add, demoId: 'abc' },
      { ...add, afterStepId: 'abc' },
      { ...add, url: 'javascript:alert(1)' },
      { ...add, url: 'file:///etc/hosts' },
      { type: 'fd:ping', v: 1, extra: true },
      { type: 'fd:add-status', v: 1 },
    ])
      expect(parseAdd(bad, APP, APP)).toEqual({ ok: false, error: 'schema' });
  });
  it('lit l’état, le retour à la capture et l’effacement par la démo seule', () => {
    for (const type of ['fd:add-status', 'fd:add-focus', 'fd:add-clear'])
      expect(parseAdd({ type, v: 1, demoId: DEMO }, APP, APP)).toEqual({
        ok: true,
        req: { type, demoId: DEMO },
      });
  });
  it('une cible non démarrée expire après 30 minutes ; une capture en cours ne périme pas', () => {
    const t = {
      demoId: DEMO,
      workspaceId: WS,
      afterStepId: null,
      title: 'Démo',
      after: null,
      at: 0,
      state: 'pending' as const,
      editorTabId: 1,
      captureTabId: 2,
      stepIds: [],
    };
    expect(liveTarget(t, ADD_TTL_MS - 1)).toBe(t);
    expect(liveTarget(t, ADD_TTL_MS + 1)).toBeNull();
    expect(liveTarget({ ...t, state: 'recording' }, ADD_TTL_MS * 3)).not.toBeNull();
    expect(liveTarget(undefined, 0)).toBeNull();
  });
});
