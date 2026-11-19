import { describe, expect, it } from 'vitest';
import { capturedField, defaultAnimation, fieldAt, typedPii } from './animation';

const meta = {
  tag: 'input',
  label: 'Nom du rapport',
  element: { left: 100, top: 200, width: 300, height: 40 },
  viewport: { width: 1000, height: 800 },
};

describe('L25-04/05 : réglages de l’animation', () => {
  it('champ repéré à la capture', () => {
    expect(capturedField(meta)).toEqual({
      field: { x: 0.1, y: 0.25, w: 0.3, h: 0.05 },
      label: 'Nom du rapport',
    });
    expect(capturedField({ ...meta, tag: 'button' })).toBeNull();
    expect(capturedField(null)).toBeNull();
  });
  it('champ choisi sur le canevas, borné', () => {
    expect(fieldAt(0.5, 0.5)).toEqual({ x: 0.38, y: 0.475, w: 0.24, h: 0.05 });
    expect(fieldAt(0.99, 0.01)).toEqual({ x: 0.76, y: 0, w: 0.24, h: 0.05 });
  });
  it('animation par défaut', () => {
    expect(defaultAnimation('typing', meta, null)).toMatchObject({
      type: 'typing',
      fieldLabel: 'Nom du rapport',
    });
    expect(defaultAnimation('scroll', meta, null)).toBeUndefined();
    expect(
      defaultAnimation('scroll', meta, { width: 1280, height: 2400, top: 600, viewportHeight: 720 }),
    ).toEqual({ type: 'scroll', direction: 'down', distance: 600, duration: 1.2 });
  });
  it('données personnelles dans le texte saisi (variables exclues)', () => {
    expect(typedPii('Rapport mensuel de {{company}}')).toEqual([]);
    expect(typedPii('lea.martin@acme.example')).toEqual(['email']);
  });
});
