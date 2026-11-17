import { describe, expect, it } from 'vitest';
import i18n from '../i18n';
import { validateForm } from './validation';

function form(html: string) {
  const f = document.createElement('form');
  f.innerHTML = html;
  return f;
}

describe('validateForm', () => {
  it('case à cocher obligatoire : erreur seulement si elle n’est pas cochée', async () => {
    await i18n.changeLanguage('fr');
    const f = form('<input id="consent" type="checkbox" required>');
    expect(validateForm(f, i18n.t)).toEqual({ consent: 'Cochez la case pour continuer.' });
    (f.querySelector('#consent') as HTMLInputElement).checked = true;
    expect(validateForm(f, i18n.t)).toEqual({});
  });

  it('champ texte obligatoire vide', async () => {
    await i18n.changeLanguage('fr');
    expect(Object.keys(validateForm(form('<input id="name" required>'), i18n.t))).toEqual(['name']);
  });
});
