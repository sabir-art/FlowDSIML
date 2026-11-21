import { describe, expect, it } from 'vitest';
import { htmlCaptureVerdict, parseHtmlCapture } from './htmlCaptureRule';

describe('L49 : règle « Captures HTML »', () => {
  it('autorisées, désactivées, domaines avec joker', () => {
    expect(htmlCaptureVerdict(parseHtmlCapture(undefined), 'crm.partenaire.example')).toBe('ok');
    expect(htmlCaptureVerdict(parseHtmlCapture({ mode: 'disabled' }), 'app.example.com')).toBe('disabled');
    const r = parseHtmlCapture({ mode: 'domains', domains: ['app.example.com', '*.outils.example'] });
    expect(htmlCaptureVerdict(r, 'app.example.com')).toBe('ok');
    expect(htmlCaptureVerdict(r, 'rh.outils.example')).toBe('ok');
    expect(htmlCaptureVerdict(r, 'outils.example')).toBe('domain');
    expect(htmlCaptureVerdict(r, 'crm.partenaire.example')).toBe('domain');
  });
});
