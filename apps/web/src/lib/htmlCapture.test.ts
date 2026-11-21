import { describe, expect, it } from 'vitest';
import { domainOk, hostAllowed, normalizeDomain } from './htmlCapture';

describe('domaines du réglage Captures HTML (même règle que la base)', () => {
  it('accepte un domaine ou un joker de sous-domaine', () => {
    expect(domainOk('app.example.com')).toBe(true);
    expect(domainOk('*.outils.example')).toBe(true);
    expect(domainOk(normalizeDomain('  App.Example.COM '))).toBe(true);
  });
  it('refuse protocole, chemin, port, nom sans domaine et joker au milieu', () => {
    for (const d of [
      'https://app.example.com',
      'app.example.com/x',
      'app.example.com:8443',
      'localhost',
      'a.*.example',
      '',
    ])
      expect(domainOk(d)).toBe(false);
  });
  it('joker : sous-domaines seulement, jamais le domaine nu', () => {
    const list = ['app.example.com', '*.outils.example'];
    expect(hostAllowed('app.example.com', list)).toBe(true);
    expect(hostAllowed('a.b.outils.example', list)).toBe(true);
    expect(hostAllowed('outils.example', list)).toBe(false);
    expect(hostAllowed('crm.partenaire.example', list)).toBe(false);
    expect(hostAllowed('evil-outils.example', list)).toBe(false);
  });
});
