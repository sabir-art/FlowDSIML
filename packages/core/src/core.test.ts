import { describe, expect, it } from 'vitest';
import {
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
