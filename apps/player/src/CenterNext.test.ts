import { describe, expect, it } from 'vitest';
import { centerModuleHref, fromCenterParams, nextInPath } from './CenterNext';
import type { CenterModule, CenterPath } from './center';

const mod = (demoId: string, extra: Partial<CenterModule> = {}): CenterModule => ({
  demoId,
  title: `Module ${demoId}`,
  required: true,
  steps: 5,
  hasQuiz: false,
  access: 'open',
  cover: null,
  ...extra,
});
const path = (modules: CenterModule[], ordered = true): CenterPath => ({
  id: '00000000-0000-4000-8000-0000000000f1',
  title: 'Logiciel métier',
  description: '',
  ordered,
  isNew: false,
  tags: [],
  modules,
});

describe('nextInPath', () => {
  it('apprenant identifié : module suivant non validé, le module en cours compté comme validé', () => {
    const p = path([mod('a', { status: 'validated' }), mod('b', { status: 'in_progress' }), mod('c')]);
    expect(nextInPath(p, 'b', true, true)).toEqual({ next: p.modules[2], finished: false });
  });
  it('dernier module validé : formation terminée (attestation)', () => {
    const p = path([mod('a', { status: 'validated' }), mod('b', { status: 'in_progress' })]);
    expect(nextInPath(p, 'b', true, true)).toEqual({ next: null, finished: true });
  });
  it('module en cours pas encore validé (quiz échoué) : pas d’attestation, il reste le module suivant à faire', () => {
    const p = path([mod('a', { status: 'validated' }), mod('b', { status: 'failed' })], false);
    expect(nextInPath(p, 'b', true, false)).toEqual({ next: null, finished: false });
  });
  it('un module plus tôt reste à faire : il est proposé, pas l’attestation', () => {
    const p = path([mod('a'), mod('b', { status: 'in_progress' })], false);
    expect(nextInPath(p, 'b', true, true)).toEqual({ next: p.modules[0], finished: false });
  });
  it('visiteur anonyme : le module qui suit dans l’ordre, en sautant les modules expirés', () => {
    const p = path([mod('a'), mod('b', { access: 'expired' }), mod('c')]);
    expect(nextInPath(p, 'a', false, true)).toEqual({ next: p.modules[2], finished: false });
    expect(nextInPath(p, 'c', false, true)).toEqual({ next: null, finished: false });
    expect(nextInPath(p, 'inconnu', false, true)).toEqual({ next: null, finished: false });
  });
});

describe('origine « centre » dans l’adresse', () => {
  const from = { slug: 'ml-exemple', pathId: '00000000-0000-4000-8000-0000000000f1' };
  it('aller-retour', () => {
    const href = centerModuleHref('0b5c1f0e-0000-4000-8000-000000000001', from);
    expect(href).toBe(
      '#/d/0b5c1f0e-0000-4000-8000-000000000001?c=ml-exemple&f=00000000-0000-4000-8000-0000000000f1',
    );
    expect(fromCenterParams(href.split('?')[1]!)).toEqual(from);
  });
  it('valeurs invalides ignorées', () => {
    expect(fromCenterParams('?c=../x&f=00000000-0000-4000-8000-0000000000f1')).toBeNull();
    expect(fromCenterParams('?c=ml-exemple&f=pas-un-id')).toBeNull();
    expect(fromCenterParams('')).toBeNull();
  });
});
