import { describe, expect, it } from 'vitest';
import { ASSET_MAX_BYTES, assetDecision, assetTooLong, assetTypeAllowed, isPrivateHost } from './assetPolicy';

const PAGE = 'https://app.exemple.test/fiches/12';

describe('ressources d’une capture HTML', () => {
  it('accepte une ressource http(s) de la page capturée', () => {
    expect(assetDecision('https://app.exemple.test/logo.png', 'image', PAGE)).toEqual({
      url: 'https://app.exemple.test/logo.png',
      credentials: 'include',
    });
  });
  it('n’envoie pas de cookies vers un autre site', () => {
    expect(assetDecision('https://cdn.exemple.test/a.woff2', 'font', PAGE)?.credentials).toBe('omit');
    expect(assetDecision('https://app.exemple.test:8443/a.css', 'css', PAGE)?.credentials).toBe('omit');
  });
  it('refuse tout autre schéma, les identifiants dans l’adresse et les genres inconnus', () => {
    for (const url of [
      'file:///etc/hosts',
      'data:text/html,x',
      'data:image/png;base64,AAAA',
      'blob:https://app.exemple.test/1',
      'chrome-extension://abc/x.png',
      'javascript:alert(1)',
      'ftp://app.exemple.test/a.png',
      'https://user:secret@app.exemple.test/a.png',
      '/relatif.png',
      '',
    ])
      expect(assetDecision(url, 'image', PAGE)).toBeNull();
    expect(assetDecision('https://app.exemple.test/a', 'script', PAGE)).toBeNull();
    expect(assetDecision(42, 'image', PAGE)).toBeNull();
    expect(assetDecision('https://app.exemple.test/a.png', 'image', undefined)).toBeNull();
    expect(assetDecision('https://app.exemple.test/a.png', 'image', 'chrome://newtab/')).toBeNull();
  });
  it('refuse une ressource en clair pour une page en https', () => {
    expect(assetDecision('http://app.exemple.test/a.png', 'image', PAGE)).toBeNull();
    expect(
      assetDecision('http://app.exemple.test/a.png', 'image', 'http://app.exemple.test/'),
    ).not.toBeNull();
  });
  it('refuse le réseau interne depuis une page qui n’y est pas', () => {
    for (const host of [
      'localhost',
      '127.0.0.1',
      '10.0.0.5',
      '172.16.4.1',
      '192.168.1.10',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '[::1]',
      '[fd00::1]',
      '[fe80::1]',
      '[::ffff:10.0.0.1]',
      'intranet',
      'serveur.local',
      'outil.internal',
    ])
      expect(assetDecision(`https://${host}/a.png`, 'image', PAGE), host).toBeNull();
  });
  it('accepte l’hôte interne de la page capturée elle-même, et lui seul', () => {
    const intranet = 'http://outil.intranet/accueil';
    expect(assetDecision('http://outil.intranet/logo.png', 'image', intranet)?.credentials).toBe('include');
    expect(assetDecision('http://autre.intranet/logo.png', 'image', intranet)).toBeNull();
    expect(assetDecision('http://10.0.0.5/logo.png', 'image', intranet)).toBeNull();
    expect(assetDecision('https://cdn.exemple.test/a.png', 'image', intranet)?.credentials).toBe('omit');
  });
  it('reconnaît les hôtes publics', () => {
    for (const h of ['exemple.test', 'app.exemple.test', '8.8.8.8', '172.32.0.1', '[2001:db8::1]'])
      expect(isPrivateHost(h), h).toBe(false);
  });
  it('n’accepte que le type attendu', () => {
    expect(assetTypeAllowed('image', 'image/png')).toBe(true);
    expect(assetTypeAllowed('image', 'image/svg+xml; charset=utf-8')).toBe(true);
    expect(assetTypeAllowed('image', 'text/html')).toBe(false);
    expect(assetTypeAllowed('image', 'application/json')).toBe(false);
    expect(assetTypeAllowed('image', null)).toBe(false);
    expect(assetTypeAllowed('css', 'text/css; charset=utf-8')).toBe(true);
    expect(assetTypeAllowed('css', 'text/html')).toBe(false);
    expect(assetTypeAllowed('font', 'font/woff2')).toBe(true);
    expect(assetTypeAllowed('font', 'application/font-woff')).toBe(true);
    expect(assetTypeAllowed('font', 'application/octet-stream')).toBe(true);
    expect(assetTypeAllowed('font', 'text/html')).toBe(false);
  });
  it('Sandbox v2 : scripts et réponses rejouées, jamais une page', () => {
    expect(assetDecision('https://app.exemple.test/app.js', 'js', PAGE)).not.toBeNull();
    expect(assetDecision('https://app.exemple.test/api/x', 'data', PAGE)?.credentials).toBe('include');
    expect(assetDecision('https://api.autre.test/x', 'data', PAGE)?.credentials).toBe('omit');
    expect(assetTypeAllowed('js', 'text/javascript; charset=utf-8')).toBe(true);
    expect(assetTypeAllowed('js', 'application/javascript')).toBe(true);
    expect(assetTypeAllowed('js', 'text/html')).toBe(false);
    expect(assetTypeAllowed('data', 'application/json')).toBe(true);
    expect(assetTypeAllowed('data', 'application/vnd.api+json')).toBe(true);
    expect(assetTypeAllowed('data', 'text/plain')).toBe(true);
    expect(assetTypeAllowed('data', 'text/html')).toBe(false);
    expect(assetTypeAllowed('data', 'image/png')).toBe(false);
  });
  it('écarte une ressource annoncée trop lourde', () => {
    expect(assetTooLong(String(ASSET_MAX_BYTES + 1))).toBe(true);
    expect(assetTooLong(String(ASSET_MAX_BYTES))).toBe(false);
    expect(assetTooLong(null)).toBe(false);
  });
});
