import { describe, expect, it } from 'vitest';
import type { StepRow } from '../types';
import { deadLinks, sandboxGraph } from './sandboxGraph';

const page = (id: string, url: string, links: Array<[string, string]>, ops: unknown[] = []) =>
  ({
    id,
    kind: 'html',
    title: id,
    html_ops: ops,
    html_meta: { url, links: links.map(([sel, href]) => ({ sel, href })) },
  }) as unknown as StepRow;
const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const C = '00000000-0000-0000-0000-00000000000c';
const D = '00000000-0000-0000-0000-00000000000d';

describe('sandboxGraph', () => {
  const steps = [
    page(A, 'https://app.acme.example/', [['#m > a:nth-of-type(2)', 'https://app.acme.example/agenda#jour']]),
    page(
      B,
      'https://app.acme.example/agenda/',
      [['#m > a:nth-of-type(1)', 'https://app.acme.example/']],
      [{ id: 'l', sel: 'button', op: 'link', value: C, scope: 'step' }],
    ),
    page(C, 'https://app.acme.example/fiche', []),
    page(D, 'https://app.acme.example/parametres', []),
  ];
  it('liens automatiques et explicites, colonnes depuis le départ, page à relier', () => {
    const g = sandboxGraph(steps, { start: A, autoLink: true });
    const by = Object.fromEntries(g.nodes.map((n) => [n.id, n]));
    expect(by[A]!.to).toEqual([B]);
    expect(by[B]!.to.sort()).toEqual([A, C].sort());
    expect([by[A]!.col, by[B]!.col, by[C]!.col]).toEqual([0, 1, 2]);
    expect(by[A]!.start).toBe(true);
    expect(g.nodes.filter((n) => n.orphan).map((n) => n.id)).toEqual([D]);
    expect(by[D]!.col).toBe(3);
  });
  it('sans liaison automatique : seuls les liens explicites', () => {
    const g = sandboxGraph(steps, { start: A, autoLink: false });
    const by = Object.fromEntries(g.nodes.map((n) => [n.id, n]));
    expect(by[A]!.to).toEqual([]);
    expect(by[B]!.orphan).toBe(true);
  });
});

describe('deadLinks (L48-G)', () => {
  const pg = (id: string, url: string, links: Array<[string, string, string?]>, ops: unknown[] = []) =>
    ({
      id,
      kind: 'html',
      title: id,
      html_ops: ops,
      html_meta: { url, links: links.map(([sel, href, label]) => ({ sel, href, label })) },
    }) as unknown as StepRow;
  const steps = [
    pg(
      A,
      'https://app.acme.example/',
      [
        ['#m a.agenda', 'https://app.acme.example/agenda'],
        ['#m a.factures', '/factures', 'Factures'],
        ['#m a.ext', 'https://autre.example/doc'],
        ['#m a.ancre', '#haut'],
        ['#m a.moi', 'https://app.acme.example/#top'],
        ['#m a.mail', 'mailto:dsi@acme.example'],
        ['#m a.relie', '/aide'],
      ],
      [{ id: 'o1', sel: '#m a.relie', op: 'link', value: B, scope: 'step' }],
    ),
    pg(B, 'https://app.acme.example/agenda', [['nav a.factures', 'https://app.acme.example/factures/']]),
  ];
  it('même site, non capturé, non relié : compté une fois par page d’origine', () => {
    const { dead } = deadLinks(steps, null);
    expect(dead.map((d) => [d.from, d.url, d.label])).toEqual([
      [A, 'https://app.acme.example/factures', 'Factures'],
      [B, 'https://app.acme.example/factures', 'https://app.acme.example/factures'],
    ]);
  });
  it('liens externes, ancres, la page elle-même, mailto et liens reliés à la main : ignorés', () => {
    const urls = deadLinks(steps, null).dead.map((d) => d.url);
    expect(urls.some((u) => u.includes('autre.example') || u.includes('/aide') || u.includes('mailto'))).toBe(
      false,
    );
  });
  it('liens laissés volontairement : hors de la liste, dans « ignored »', () => {
    const r = deadLinks(steps, { ignoredLinks: [{ url: 'https://app.acme.example/factures', from: A }] });
    expect(r.dead.map((d) => d.from)).toEqual([B]);
    expect(r.ignored.map((d) => d.from)).toEqual([A]);
  });
});
