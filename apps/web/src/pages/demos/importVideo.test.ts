import { describe, expect, it } from 'vitest';
import { VIDEO_MAX_BYTES, checkVideoFile, titleFromFile, videoExt } from './importVideo';

const f = (name: string, type: string, size = 1000) => ({ name, type, size });

describe('import d’une vidéo', () => {
  it('garde MP4 et WebM, par le type puis par le nom', () => {
    expect(videoExt(f('a.mp4', 'video/mp4'))).toBe('mp4');
    expect(videoExt(f('a.bin', 'video/webm'))).toBe('webm');
    expect(videoExt(f('Demo.MP4', ''))).toBe('mp4');
    expect(videoExt(f('a.mp4', 'video/quicktime'))).toBeNull();
    expect(videoExt(f('a.mov', ''))).toBeNull();
  });
  it('refuse dans l’ordre : format, poids, durée', () => {
    expect(checkVideoFile(f('a.mov', 'video/quicktime', VIDEO_MAX_BYTES + 1), 1000)).toBe('badType');
    expect(checkVideoFile(f('a.mp4', 'video/mp4', VIDEO_MAX_BYTES + 1), 1000)).toBe('tooBig');
    expect(checkVideoFile(f('a.mp4', 'video/mp4', VIDEO_MAX_BYTES), null)).toBe('unreadable');
    expect(checkVideoFile(f('a.mp4', 'video/mp4'), 600_001)).toBe('tooLong');
    expect(checkVideoFile(f('a.mp4', 'video/mp4', VIDEO_MAX_BYTES), 600_000)).toBeNull();
  });
  it('propose un titre lisible', () => {
    expect(titleFromFile('saisie_fiche-jeune.v2.mp4')).toBe('saisie fiche jeune.v2');
    expect(titleFromFile('  Accueil.webm')).toBe('Accueil');
  });
});
