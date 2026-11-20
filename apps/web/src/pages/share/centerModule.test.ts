import { describe, expect, it } from 'vitest';
import { centerLinkUrl, centerModuleOf } from './centerModule';

const paths = [
  { id: 'p1', title: 'Logiciel métier' },
  { id: 'p2', title: 'Agenda' },
];
const modules = [
  { path_id: 'p1', demo_id: 'd1', position: 0 },
  { path_id: 'p1', demo_id: 'd2', position: 1 },
  { path_id: 'p2', demo_id: 'd2', position: 0 },
];
const center = (published: unknown) => ({ slug: 'ml-exemple', published: published as never });

describe('centerModuleOf', () => {
  it('formation visible du centre publié qui contient la démo, avec sa position', () => {
    const c = center({ paths: [{ id: 'p1', visible: true }] });
    expect(centerModuleOf(c, paths, modules, 'd2')).toEqual({
      slug: 'ml-exemple',
      pathTitle: 'Logiciel métier',
      position: 2,
    });
  });
  it('ordre du centre : la première formation visible l’emporte', () => {
    const c = center({
      paths: [
        { id: 'p2', visible: true },
        { id: 'p1', visible: true },
      ],
    });
    expect(centerModuleOf(c, paths, modules, 'd2')?.pathTitle).toBe('Agenda');
  });
  it('rien si le centre n’est pas publié, est un Demo Center, ou si la formation est masquée', () => {
    expect(centerModuleOf(null, paths, modules, 'd1')).toBeNull();
    expect(centerModuleOf(center(null), paths, modules, 'd1')).toBeNull();
    expect(
      centerModuleOf(center({ kind: 'demo', paths: [{ id: 'p1', visible: true }] }), paths, modules, 'd1'),
    ).toBeNull();
    expect(
      centerModuleOf(center({ paths: [{ id: 'p1', visible: false }] }), paths, modules, 'd1'),
    ).toBeNull();
    expect(
      centerModuleOf(center({ paths: [{ id: 'p1', visible: true }] }), paths, modules, 'autre'),
    ).toBeNull();
  });
});

describe('centerLinkUrl', () => {
  it('adresse du centre avec le jeton du lien personnalisé', () => {
    expect(centerLinkUrl('https://demos.tutoclick.example/', 'ml-exemple', 'jeton-alex-0001')).toBe(
      'https://demos.tutoclick.example/#/c/ml-exemple?l=jeton-alex-0001',
    );
  });
});
