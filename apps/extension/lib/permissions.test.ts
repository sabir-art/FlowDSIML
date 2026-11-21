import { describe, expect, it } from 'vitest';
import { permissionNeed, startsWithout } from './permissions';

const base = { size: 'current', hasDebugger: false, hasSites: false, fullLater: false };

describe('permissionNeed (EXT-STORE, README §6.1)', () => {
  it('Format mobile : debugger toujours, bloquant', () => {
    expect(permissionNeed({ ...base, mode: 'mobile' }).debugger).toBe('mobile');
    expect(startsWithout('mobile')).toBe(false);
  });
  it('taille imposée : debugger, la capture démarre sans', () => {
    expect(permissionNeed({ ...base, mode: 'html', size: '1280x720' }).debugger).toBe('size');
    expect(startsWithout('size')).toBe(true);
  });
  it('captures à chaque clic : page entière, sauf après « Pas maintenant »', () => {
    expect(permissionNeed({ ...base, mode: 'clicks' }).debugger).toBe('full');
    expect(permissionNeed({ ...base, mode: 'clicks', fullLater: true }).debugger).toBeNull();
    expect(startsWithout('full')).toBe(true);
  });
  it('HTML à la taille actuelle : pas de debugger', () => {
    expect(permissionNeed({ ...base, mode: 'html' }).debugger).toBeNull();
  });
  it('déjà accordée : rien à demander', () => {
    expect(permissionNeed({ ...base, mode: 'mobile', hasDebugger: true, hasSites: true })).toEqual({
      debugger: null,
      sites: false,
    });
  });
  it('vidéo : ni debugger ni accès aux sites (tabCapture)', () => {
    expect(permissionNeed({ ...base, mode: 'video' })).toEqual({ debugger: null, sites: false });
  });
});
