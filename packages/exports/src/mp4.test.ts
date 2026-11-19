import { describe, expect, it } from 'vitest';
import { MP4_MAX_SECONDS, buildVtt, mp4Duration, planVideo, vttTime, type Mp4Options } from './mp4';
import type { ExportStep } from './model';

const step = (x: Partial<ExportStep> = {}): ExportStep => ({
  title: 'Créer une opportunité',
  text: 'Cliquez sur « + Nouvelle opportunité ».',
  imageUrl: 'a.png',
  width: 1100,
  height: 750,
  target: { x: 0.2, y: 0.3, w: 0.2, h: 0.07 },
  ...x,
});
const o = (x: Partial<Mp4Options> = {}): Mp4Options => ({
  seconds: 2.5,
  format: '1920x1080',
  from: 0,
  to: 2,
  bubble: true,
  cursor: true,
  zoom: true,
  title: true,
  subtitles: 'vtt',
  ...x,
});

describe('L25-11 : vidéo MP4', () => {
  it('durée calculée : étapes × vitesse + écran de titre (3 s)', () => {
    expect(mp4Duration(o())).toBe(10.5);
    expect(mp4Duration(o({ title: false, seconds: 4 }))).toBe(12);
    expect(MP4_MAX_SECONDS).toBe(600);
  });
  it('images : la somme des durées vaut la durée calculée', () => {
    const steps = [
      step(),
      step({ target: null, title: 'Fin', text: '' }),
      step({ animation: { type: 'typing', text: 'Acme', field: null } }),
    ];
    const frames = planVideo(steps, o());
    const total = frames.reduce((a, f) => a + f.ms, 0);
    expect(Math.round(total)).toBe(10500);
    expect(frames[0]).toMatchObject({ kind: 'title', ms: 3000 });
    // Étape sans mouvement : une seule image immobile
    expect(frames.filter((f) => f.step === 1 && f.kind === 'step')).toHaveLength(1);
    // Horodatage croissant
    expect(frames.every((f, i) => i === 0 || f.at >= frames[i - 1]!.at)).toBe(true);
  });
  it('sous-titres .vtt : une réplique par étape avec texte, décalées après le titre', () => {
    const v = buildVtt([step(), step({ title: '', text: '' }), step({ text: 'a --> b' })], o());
    expect(v.cues).toBe(2);
    expect(v.text.startsWith('WEBVTT')).toBe(true);
    expect(v.text).toContain('00:00:03.000 --> 00:00:05.500');
    expect(v.text).not.toContain('a --> b');
    expect(vttTime(3723456)).toBe('01:02:03.456');
  });
});
