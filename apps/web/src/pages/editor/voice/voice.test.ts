import { describe, expect, it } from 'vitest';
import { bubbleText, formatClock, voiceExt } from './voice';
import type { HotspotRow, StepRow } from '../types';

describe('voix off', () => {
  it('extension selon le type MIME', () => {
    expect(voiceExt('audio/webm;codecs=opus')).toBe('webm');
    expect(voiceExt('audio/mpeg')).toBe('mp3');
    expect(voiceExt('audio/x-m4a')).toBe('m4a');
    expect(voiceExt('audio/x-wav')).toBe('wav');
    expect(voiceExt('audio/ogg')).toBeNull();
  });
  it('minuteur', () => {
    expect(formatClock(12_400)).toBe('0:12');
    expect(formatClock(120_000)).toBe('2:00');
  });
  it('transcription préremplie : bulles, sinon texte de l’étape', () => {
    const step = { id: 's', title: 'Titre', body: '<p>Texte <b>gras</b></p>' } as StepRow;
    const hs = [
      { step_id: 's', position: 1, title: '', body: 'Deuxième' },
      { step_id: 's', position: 0, title: 'Ouvrez', body: '<p>le menu</p>' },
    ] as HotspotRow[];
    expect(bubbleText(step, hs)).toBe('Ouvrez. le menu Deuxième');
    expect(bubbleText(step, [])).toBe('Titre. Texte gras');
  });
});
