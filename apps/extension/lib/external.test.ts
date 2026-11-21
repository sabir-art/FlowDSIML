import { describe, expect, it } from 'vitest';
import { ATTACH_TTL_MS, attachFor, parseAttach } from './external';

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
