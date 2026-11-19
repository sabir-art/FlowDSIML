import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({ supabase: {} }));
const { embedUrl, hostOf, iframeCode, mailtoHref, MAIL_MAX, originAllowed, parseRecipients, popupCode } =
  await import('./distribute');

describe('codes pour l’intranet', () => {
  it('iframe : title, lazy, plein écran, 16:10 ou taille fixe', () => {
    const fluid = iframeCode('https://l.example/#/d/x', 'Démo : <b>"Fiche"</b>', { kind: 'fluid' });
    expect(fluid).toContain('title="Démo : bFiche/b"');
    expect(fluid).toContain('loading="lazy" allow="fullscreen"');
    expect(fluid).toContain('aspect-ratio:16/10');
    expect(iframeCode('u', 't', { kind: 'fixed', width: 960, height: 600 })).toContain(
      'width:960px;height:600px',
    );
  });
  it('réglages : démarrage au clic et langue dans l’adresse', () => {
    expect(embedUrl('https://l.example/#/d/x', { clickToStart: true, lang: 'en' })).toBe(
      'https://l.example/#/d/x?start=click&lang=en',
    );
    expect(embedUrl('https://l.example/#/d/x', { clickToStart: false, lang: null })).toBe(
      'https://l.example/#/d/x',
    );
  });
  it('bouton + pop-up : bouton de la page, script popup.js', () => {
    const c = popupCode('https://l.example/', 'id-1', {
      label: 'Lancer <le> tutoriel',
      float: true,
      clickToStart: true,
      lang: null,
    });
    expect(c).toContain(
      '<button\n  type="button"\n  data-tutoclick="id-1"\n  data-tutoclick-float\n  data-tutoclick-start="click">',
    );
    expect(c).toContain('>Lancer le tutoriel</button>');
    expect(c).toContain('<script src="https://l.example/popup.js" defer></script>');
  });
});

describe('sites autorisés', () => {
  it('domaine saisi', () => {
    expect(hostOf('https://Intranet.Exemple.fr/outils')).toBe('intranet.exemple.fr');
    expect(hostOf('intranet')).toBeNull();
    expect(hostOf('')).toBeNull();
  });
  it('même règle que le lecteur', () => {
    expect(originAllowed('intranet.exemple.fr', [])).toBe(true);
    expect(originAllowed('intranet.exemple.fr', ['www.exemple.org'])).toBe(false);
    expect(originAllowed('intranet.exemple.fr', ['*.exemple.fr'])).toBe(true);
    expect(originAllowed('intranet.exemple.fr', ['https://intranet.exemple.fr'])).toBe(true);
  });
});

describe('e-mail', () => {
  it('destinataires : valides et invalides', () => {
    expect(parseRecipients(' a@acme.example, b@acme ; ,c@acme.example')).toEqual({
      valid: ['a@acme.example', 'c@acme.example'],
      invalid: ['b@acme'],
    });
  });
  it('mailto encodé', () => {
    expect(mailtoHref(['a@acme.example'], 'Tutoriel : x & y', 'Ligne 1\nLigne 2')).toBe(
      'mailto:a%40acme.example?subject=Tutoriel%20%3A%20x%20%26%20y&body=Ligne%201%0ALigne%202',
    );
    expect(MAIL_MAX).toBe(1500);
  });
});
