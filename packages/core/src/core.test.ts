import { describe, expect, it } from 'vitest';
import {
  applyUrlVariables,
  applyVariables,
  assignableRoles,
  can,
  computeFunnel,
  csvCell,
  extractVariableKeys,
  moveItem,
  richTextToHtml,
  slugify,
  variablesFromSearch,
  withinLimit,
} from './index';

describe('variables', () => {
  it('remplace avec valeurs, défauts et défaut inline', () => {
    expect(applyVariables('Bonjour {{first_name|ami}} de {{company}}', { company: 'Acme' })).toBe(
      'Bonjour ami de Acme',
    );
    expect(applyVariables('{{company}}', {}, { company: 'Votre société' })).toBe('Votre société');
  });
  it('ordre des valeurs : valeur connue, repli de la pastille, défaut de l’espace, disparition (L46)', () => {
    const text = 'Bienvenue chez {{company|vous}}';
    const defaults = { company: 'votre entreprise' };
    // Sans valeur : le repli de la pastille passe avant le défaut de l'espace
    expect(applyVariables(text, {}, defaults)).toBe('Bienvenue chez vous');
    // Avec une valeur : elle passe avant tout
    expect(applyVariables(text, { company: 'Acme' }, defaults)).toBe('Bienvenue chez Acme');
    // Sans repli dans la pastille : le défaut de l'espace
    expect(applyVariables('Bienvenue chez {{company}}', {}, defaults)).toBe(
      'Bienvenue chez votre entreprise',
    );
    // Rien du tout : la variable disparaît avec l'espace qui la précède
    expect(applyVariables('Bienvenue chez {{company}}', {})).toBe('Bienvenue chez');
    // Même ordre dans une adresse (valeur encodée)
    expect(applyUrlVariables('https://x.example/?c={{company|vous}}', {}, defaults)).toBe(
      'https://x.example/?c=vous',
    );
    expect(applyUrlVariables('https://x.example/?c={{company|vous}}', { company: 'A & B' }, defaults)).toBe(
      'https://x.example/?c=A%20%26%20B',
    );
  });
  it('variable vide : pas de double espace ni d’espace orpheline (PL3)', () => {
    expect(applyVariables('Bienvenue {{first_name}}', {})).toBe('Bienvenue');
    expect(applyVariables('Merci {{first_name}} !', { first_name: '' })).toBe('Merci !');
    expect(applyVariables('Merci {{first_name}}\u202f!', { first_name: '  ' })).toBe('Merci\u202f!');
    expect(applyVariables('Merci {{first_name}} !', { first_name: 'Léa' })).toBe('Merci Léa !');
  });
  it('extrait les clés', () => {
    expect(extractVariableKeys('{{a}} {{ b_2 | x }} {{a}}')).toEqual(['a', 'b_2']);
  });
  it('lit la query string avec ou sans préfixe', () => {
    expect(variablesFromSearch('?company=Acme&v_first_name=Lea&other=x', ['company', 'first_name'])).toEqual({
      company: 'Acme',
      first_name: 'Lea',
    });
  });
});

describe('richText', () => {
  it('échappe le HTML', () => {
    expect(richTextToHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
  });
  it('gère gras, italique, liens sûrs', () => {
    expect(richTextToHtml('**a** *b* [c](https://x.io/?a=1&b=2)')).toBe(
      '<strong>a</strong> <em>b</em> <a href="https://x.io/?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">c</a>',
    );
  });
  it('neutralise javascript:', () => {
    expect(richTextToHtml('[x](javascript:alert(1))')).not.toContain('href');
  });
});

describe('rôles', () => {
  it('respecte la hiérarchie', () => {
    expect(can('viewer', 'demo.edit')).toBe(false);
    expect(can('editor', 'demo.publish')).toBe(true);
    expect(can('admin', 'billing.manage')).toBe(false);
    expect(can('owner', 'workspace.delete')).toBe(true);
    expect(can(null, 'demo.view')).toBe(false);
  });
  it('limite les rôles attribuables', () => {
    expect(assignableRoles('admin')).not.toContain('owner');
    expect(assignableRoles('editor')).toEqual([]);
  });
});

describe('analytics', () => {
  it('calcule l’entonnoir', () => {
    const f = computeFunnel(
      [
        { stepIndex: 0, visitors: 100 },
        { stepIndex: 1, visitors: 50 },
      ],
      3,
      100,
    );
    expect(f.map((r) => r.reach)).toEqual([1, 0.5, 0]);
    expect(f[1]?.dropOff).toBe(0.5);
    expect(f[2]?.dropOff).toBe(1);
  });
});

describe('divers', () => {
  it('protège le CSV', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell('-5+cmd')).toBe("'-5+cmd");
  });
  it('slugify', () => {
    expect(slugify('Démo CRM — Été 2026 !')).toBe('demo-crm-ete-2026');
  });
  it('moveItem', () => {
    expect(moveItem([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
  });
  it('withinLimit', () => {
    expect(withinLimit(null, 1000)).toBe(true);
    expect(withinLimit(3, 3)).toBe(false);
  });
});

describe('texte riche et variables', () => {
  const html = (src: string, values: Record<string, string>, defaults: Record<string, string> = {}) =>
    richTextToHtml(src, { values, defaults });
  it('garde la valeur d’une variable comme du texte', () => {
    const out = html('Bonjour {{first_name}} !', { first_name: '[ici](https://exemple.test) **x** *y*' });
    expect(out).not.toContain('<a ');
    expect(out).not.toContain('<strong>');
    expect(out).not.toContain('<em>');
    expect(out).toBe('Bonjour [ici](https://exemple.test) **x** *y* !');
  });
  it('échappe le HTML d’une valeur', () => {
    expect(html('{{company}}', { company: '<img src=x onerror=1>' })).toBe('&lt;img src=x onerror=1&gt;');
  });
  it('encode une valeur qui complète une adresse', () => {
    const out = html('[Ouvrir](https://exemple.test/fiche?nom={{first_name}})', {
      first_name: 'a/b?c=d&e #f',
    });
    expect(out).toBe(
      '<a href="https://exemple.test/fiche?nom=a%2Fb%3Fc%3Dd%26e%20%23f" target="_blank" rel="noopener noreferrer">Ouvrir</a>',
    );
  });
  it('n’accepte une adresse faite d’une seule variable qu’en http, https ou mailto', () => {
    const link = '[Suite]({{lien}})';
    expect(html(link, { lien: 'https://exemple.test/a?b=1' })).toContain('href="https://exemple.test/a?b=1"');
    expect(html(link, { lien: 'mailto:contact@exemple.test' })).toContain(
      'href="mailto:contact@exemple.test"',
    );
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/hosts', '//exemple.test', ''])
      expect(html(link, { lien: bad })).toBe('Suite');
  });
  it('ne laisse pas une valeur changer l’hôte d’un lien', () => {
    const out = html('[Aide](https://exemple.test/{{page}})', { page: '@autre.test/x' });
    expect(out).toContain('href="https://exemple.test/%40autre.test%2Fx"');
  });
  it('place les bornes du glossaire autour des valeurs du texte, pas dans les adresses', () => {
    const out = richTextToHtml('{{company}} [x](https://exemple.test/?c={{company}})', {
      values: { company: 'Acme' },
      wrap: ['‹', '›'],
    });
    expect(out).toBe(
      '‹Acme› <a href="https://exemple.test/?c=Acme" target="_blank" rel="noopener noreferrer">x</a>',
    );
  });
});

describe('texte riche : liens et mise en forme', () => {
  it('ne retouche jamais l’adresse d’un lien (astérisques dans l’adresse)', () => {
    const out = richTextToHtml('[doc](https://exemple.test/**a**/*b*) et **gras**');
    expect(out).toBe(
      '<a href="https://exemple.test/**a**/*b*" target="_blank" rel="noopener noreferrer">doc</a> et <strong>gras</strong>',
    );
  });
  it('garde un lien entier dans du gras, et le gras dans le libellé d’un lien', () => {
    expect(richTextToHtml('**voir [la page](https://exemple.test/a) ici**')).toBe(
      '<strong>voir <a href="https://exemple.test/a" target="_blank" rel="noopener noreferrer">la page</a> ici</strong>',
    );
    expect(richTextToHtml('[**important**](https://exemple.test/a)')).toBe(
      '<a href="https://exemple.test/a" target="_blank" rel="noopener noreferrer"><strong>important</strong></a>',
    );
  });
  it('deux liens autour de gras restent deux liens', () => {
    const out = richTextToHtml('[a](https://exemple.test/1*) **b** [c](https://exemple.test/2*)');
    expect(out.match(/<a /g)?.length).toBe(2);
    expect(out).toContain('<strong>b</strong>');
    expect(out).not.toContain('<em>');
  });
  it('ignore des caractères privés glissés dans la saisie', () => {
    expect(richTextToHtml('a\uE1000\uE101b')).toBe('a0b');
  });
});
