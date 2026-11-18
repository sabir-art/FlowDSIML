import { describe, expect, it } from 'vitest';
import { hostOf, maskedSecret, statusKind, statusText, testAdvice, urlOk } from './webhooks';

describe('L23 : webhooks', () => {
  it('adresse : https publique seulement', () => {
    expect(urlOk('https://hooks.acme.example/tutoclick')).toBe(true);
    expect(urlOk('https://hooks.acme.example:8443/x')).toBe(true);
    for (const u of [
      'http://hooks.acme.example/x',
      'https://localhost/x',
      'https://10.0.0.1/x',
      'https://169.254.169.254/x',
      'https://[::1]/x',
      'https://u:p@hooks.acme.example/x',
      'https://api.internal/x',
      'https://hooks.acme.example:22/x',
      'https://2130706433/x',
    ])
      expect(urlOk(u), u).toBe(false);
  });
  it('pastille de statut : code toujours écrit', () => {
    expect([
      statusKind({ status: 'success', response_status: 200 }),
      statusText({ status: 'success', response_status: 200 }),
    ]).toEqual(['ok', '200']);
    expect([
      statusKind({ status: 'dead', response_status: 503 }),
      statusText({ status: 'dead', response_status: 503 }),
    ]).toEqual(['ko', '503']);
    expect([
      statusKind({ status: 'pending', response_status: 500 }),
      statusText({ status: 'pending', response_status: 500 }),
    ]).toEqual(['wait', '…']);
    expect(statusText({ status: 'failed', response_status: 0 })).toBe('—');
  });
  it('conseil selon l’échec du test', () => {
    expect(testAdvice(404, 'HTTP 404')).toBe('notFound');
    expect(testAdvice(403, null)).toBe('refused');
    expect(testAdvice(502, null)).toBe('server');
    expect(testAdvice(0, 'Délai de 10 s dépassé')).toBe('timeout');
    expect(testAdvice(0, 'Résolution DNS impossible')).toBe('unreachable');
  });
  it('secret masqué et hôte', () => {
    expect(maskedSecret('3f9a')).toBe('tcsec_••••••••••••••••3f9a');
    expect(hostOf('https://hooks.acme.example/x?y=1')).toBe('hooks.acme.example');
  });
});
