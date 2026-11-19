import { describe, expect, it } from 'vitest';
import { checkRecording, elapsed, MAX_BYTES, pickMime, proposePauses, timer, viewportFor } from './video';

describe('enregistrement vidéo (F7)', () => {
  it('format WebM préféré, chronomètre, temps hors pauses', () => {
    expect(pickMime((t) => t === 'video/webm;codecs=vp8,opus' || t === 'video/webm')).toBe(
      'video/webm;codecs=vp8,opus',
    );
    expect(timer(65_400)).toBe('01:05');
    expect(elapsed({ startedAt: 0, pausedAt: null, pausedMs: 2000 }, 10_000)).toBe(8000);
    expect(elapsed({ startedAt: 0, pausedAt: 5000, pausedMs: 1000 }, 10_000)).toBe(4000);
  });
  it('pauses proposées : ordre, fusion à moins de 1,5 s, marque manuelle prioritaire', () => {
    const p = proposePauses(
      [
        { t: 5000, label: 'Valider', manual: false },
        { t: 1000, label: 'Nouveau', manual: false },
        { t: 5800, label: '', manual: true },
        { t: 99_000, label: 'hors durée', manual: false },
      ],
      60_000,
    );
    expect(p.map((x) => [x.t, x.manual])).toEqual([
      [1000, false],
      [5800, true],
    ]);
  });
  it('taille et durée : message clair au-delà de 50 Mo', () => {
    expect(checkRecording(MAX_BYTES + 1, 60_000)).toBe('tooBig');
    expect(checkRecording(1000, 0)).toBe('empty');
    expect(checkRecording(45_000_000, 600_000)).toBe('ok');
  });
  it('formats mobiles et orientation', () => {
    expect(viewportFor('phone', false)).toEqual({ w: 390, h: 844 });
    expect(viewportFor('tablet', true)).toEqual({ w: 1180, h: 820 });
    expect(viewportFor('custom', false, { w: 50, h: 5000 })).toEqual({ w: 200, h: 2000 });
  });
});
