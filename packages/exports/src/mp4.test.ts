import { describe, expect, it } from 'vitest';
import {
  AUDIO_RATE,
  MP4_MAX_SECONDS,
  audioTimeline,
  buildVtt,
  keptSegments,
  mp4Duration,
  planVideo,
  vttTime,
  type Mp4Options,
} from './mp4';
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
  it('étape vidéo : passages coupés retirés, durée gardée, son à sa place', () => {
    expect(
      keptSegments(10000, [
        { from: 2000, to: 3000 },
        { from: 8000, to: 12000 },
        { from: 2500, to: 4000 },
      ]),
    ).toEqual([
      { from: 0, to: 2000 },
      { from: 4000, to: 8000 },
    ]);
    const video = { url: 'v.webm', durationMs: 4000, cuts: [{ from: 1000, to: 2000 }] };
    const steps = [step(), step({ video, target: null, imageUrl: null })];
    const oo = o({ to: 1 });
    expect(mp4Duration(oo, steps)).toBe(8.5);
    const frames = planVideo(steps, oo);
    expect(Math.round(frames.reduce((a, f) => a + f.ms, 0))).toBe(8500);
    const vf = frames.filter((f) => f.src !== undefined);
    expect(vf[0]!.src).toBe(0);
    expect(vf.some((f) => f.src! >= 1000 && f.src! < 2000)).toBe(false);
    // Son : 1 s de silence (titre 3 s + étape 2,5 s), puis le son gardé de la vidéo
    const ch = new Float32Array(4 * AUDIO_RATE).fill(0.5);
    const a = audioTimeline(steps, oo, new Map([[1, [ch]]]))!;
    expect(a[0]!.length).toBe(8.5 * AUDIO_RATE);
    expect(a[0]![Math.round(5.4 * AUDIO_RATE)]).toBe(0);
    expect(a[1]![Math.round(5.6 * AUDIO_RATE)]).toBe(0.5);
    expect(audioTimeline(steps, oo, new Map())).toBeNull();
  });
});
