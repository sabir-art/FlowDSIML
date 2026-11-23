import { describe, expect, it } from 'vitest';
import { normUrl, resolveLinks } from './draftManifest';

type StepArg = Parameters<typeof resolveLinks>[0];
const MENU = [
  { sel: '#nav > a:nth-of-type(1)', href: 'https://app.acme.example/#/', label: 'Accueil' },
  { sel: '#nav > a:nth-of-type(2)', href: 'https://app.acme.example/#/clients', label: 'Clients' },
  { sel: '#nav > a:nth-of-type(3)', href: 'https://app.acme.example/#/rapports', label: 'Rapports' },
  { sel: '#nav > a:nth-of-type(4)', href: 'https://app.acme.example/#haut', label: 'Haut de page' },
];
const page = (id: string, url: string) =>
  ({ id, kind: 'html', html_meta: { url, links: MENU } }) as unknown as StepArg;

/** Même règle que publish_demo (html_link_key) : mêmes cas que supabase/tests/liaison_ancres.test.sql. */
describe('liaison automatique du Sandbox : routes en ancre et pages de même adresse', () => {
  it('garde une ancre qui est une route, ignore les autres ancres et la barre finale', () => {
    expect(normUrl('https://app.acme.example/agenda/')).toBe('https://app.acme.example/agenda');
    expect(normUrl('https://app.acme.example/agenda#jour')).toBe('https://app.acme.example/agenda');
    expect(normUrl('https://app.acme.example/#/clients')).toBe('https://app.acme.example#/clients');
    expect(normUrl('https://app.acme.example/#/clients/')).toBe('https://app.acme.example#/clients');
    expect(normUrl('https://app.acme.example/#!/clients')).toBe('https://app.acme.example#!/clients');
    expect(normUrl('https://app.acme.example/#/')).toBe('https://app.acme.example');
    expect(normUrl('https://app.acme.example/#/clients?tri=nom')).toBe(
      'https://app.acme.example#/clients?tri=nom',
    );
    expect(normUrl('')).toBe('');
  });

  const steps = [
    page('p1', 'https://app.acme.example/'),
    page('p2', 'https://app.acme.example/#/clients'),
    page('p3', 'https://app.acme.example/#/rapports'),
    // Écran ouvert depuis « Rapports » sans changement d'adresse
    page('p4', 'https://app.acme.example/#/rapports'),
  ];

  it('relie chaque route à sa page, jamais une page à elle-même', () => {
    expect(resolveLinks(steps[0]!, steps)).toEqual([
      { sel: '#nav > a:nth-of-type(2)', step: 'p2' },
      { sel: '#nav > a:nth-of-type(3)', step: 'p3' },
    ]);
    expect(resolveLinks(steps[1]!, steps)).toEqual([
      { sel: '#nav > a:nth-of-type(1)', step: 'p1' },
      { sel: '#nav > a:nth-of-type(3)', step: 'p3' },
      { sel: '#nav > a:nth-of-type(4)', step: 'p1' },
    ]);
  });

  it('ne relie pas un lien vers sa propre adresse à une autre page de même adresse', () => {
    for (const s of [steps[2]!, steps[3]!])
      expect(resolveLinks(s, steps).map((l) => l.sel)).not.toContain('#nav > a:nth-of-type(3)');
    expect(resolveLinks(steps[3]!, steps)).toEqual([
      { sel: '#nav > a:nth-of-type(1)', step: 'p1' },
      { sel: '#nav > a:nth-of-type(2)', step: 'p2' },
      { sel: '#nav > a:nth-of-type(4)', step: 'p1' },
    ]);
  });
});
