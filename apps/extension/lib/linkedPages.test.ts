import { describe, expect, it } from 'vitest';
import { isRisky, linkedPages, nextBatch, normUrl } from './linkedPages';

const S = 'https://crm.exemple.test';

describe('pages liées (Sandbox v2, étape 4)', () => {
  const pages = [
    {
      url: `${S}/`,
      links: [
        { href: `${S}/clients`, label: 'Clients' },
        { href: '/agenda/', label: 'Agenda' },
        { href: '/agenda', label: 'Agenda (pied)' },
        { href: '#haut', label: 'Haut de page' },
        { href: 'https://autre.exemple.test/', label: 'Partenaire' },
        { href: 'mailto:contact@exemple.test', label: 'Écrire' },
        { href: '/deconnexion', label: 'Se déconnecter' },
        { href: '/factures/export.pdf', label: 'Export' },
      ],
    },
    { url: `${S}/clients`, links: [{ href: `${S}/agenda`, label: 'Agenda' }] },
  ];

  it('destinations du même site, une fois chacune, avec leur état', () => {
    const l = linkedPages(pages);
    const by = Object.fromEntries(l.map((x) => [x.url.replace(S, ''), x]));
    expect(Object.keys(by).sort()).toEqual([
      '',
      '/agenda',
      '/clients',
      '/deconnexion',
      '/factures/export.pdf',
    ]);
    expect(by['/clients']!.state).toBe('captured');
    expect(by['']!.state).toBe('captured');
    expect(by['/agenda']).toMatchObject({ state: 'todo', label: 'Agenda', from: 2 });
    expect(by['/deconnexion']!.state).toBe('risky');
    expect(by['/factures/export.pdf']!.state).toBe('risky');
  });

  it('routes d’une application à page unique : des pages', () => {
    const l = linkedPages(
      [{ url: `${S}/app#/accueil`, links: [{ href: '#/clients', label: 'Clients' }] }],
      [`${S}/app#/clients/42`],
    );
    expect(l.map((x) => [x.url.replace(S, ''), x.state])).toEqual([
      ['/app#/clients', 'todo'],
      ['/app#/clients/42', 'todo'],
      ['/app#/accueil', 'captured'],
    ]);
  });

  it('adresses dangereuses : déconnexion, suppression, désabonnement, fichiers', () => {
    for (const [u, label] of [
      [`${S}/logout`, ''],
      [`${S}/account/sign-out`, ''],
      [`${S}/clients/42/delete`, ''],
      [`${S}/clients/42`, 'Supprimer'],
      [`${S}/newsletter?action=unsubscribe`, ''],
      [`${S}/rapport.xlsx`, ''],
    ])
      expect(isRisky(u!, label), u).toBe(true);
    for (const u of [`${S}/clients/42`, `${S}/parametres/profil`, `${S}/deletion-policy-faq`])
      expect(isRisky(u), u).toBe(false);
  });

  it('passe de capture en série : 20 au plus, seulement « à capturer »', () => {
    const many = [
      {
        url: `${S}/`,
        links: Array.from({ length: 30 }, (_, i) => ({ href: `/p${i}`, label: `Page ${i}` })).concat({
          href: '/logout',
          label: 'Quitter',
        }),
      },
    ];
    const b = nextBatch(linkedPages(many));
    expect(b).toHaveLength(20);
    expect(b.every((x) => x.state === 'todo')).toBe(true);
    expect(b[0]!.url).toBe(`${S}/p0`);
  });

  it('normalisation identique à l’éditeur', () => {
    expect(normUrl(`${S}/a/#section`)).toBe(`${S}/a`);
    expect(normUrl(`${S}/app#/x/`)).toBe(`${S}/app#/x`);
  });
});
