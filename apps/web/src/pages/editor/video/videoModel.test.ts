import { describe, expect, it } from 'vitest';
import { asVideo, mmss } from './videoModel';

describe('étape vidéo (F7) : réglages', () => {
  it('lecture prudente, valeurs invalides écartées, pauses triées', () => {
    const v = asVideo({
      cuts: [
        { from: 5000, to: 1000 },
        { from: 1000, to: 2000 },
      ],
      pauses: [
        { id: 'b', t: 9000, title: 'Deux' },
        { id: 'a', t: 1000, title: 'Un', body: 'Texte' },
        { id: '', t: 3 },
      ],
      captions: [{ from: 0, to: 1000, text: '' }],
      autoplayMuted: false,
      frames: { a: 'ws/x.webp', b: 3 },
    });
    expect(v.cuts).toEqual([{ from: 1000, to: 2000 }]);
    expect(v.pauses.map((p) => p.id)).toEqual(['a', 'b']);
    expect(v.captions).toEqual([]);
    expect(v.autoplayMuted).toBe(false);
    expect(v.frames).toEqual({ a: 'ws/x.webp' });
    expect(asVideo(null).autoplayMuted).toBe(true);
    expect(mmss(62000)).toBe('01:02');
  });
});
