import { describe, expect, it } from 'vitest';
import { deviceInfo } from './api';

describe('appareil (familles, sans empreinte)', () => {
  it('ordinateur, Chrome, Windows', () => {
    expect(
      deviceInfo(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36',
        1440,
        'fr-FR',
      ),
    ).toEqual({ type: 'desktop', browser: 'chrome', os: 'windows', lang: 'fr' });
  });
  it('iPhone, Safari', () => {
    expect(
      deviceInfo(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
        390,
        'en-GB',
      ),
    ).toEqual({ type: 'mobile', browser: 'safari', os: 'ios', lang: 'en' });
  });
  it('tablette Android, Edge, Firefox, inconnu', () => {
    expect(
      deviceInfo(
        'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/130.0 Safari/537.36',
        1200,
        '',
      ).type,
    ).toBe('tablet');
    expect(
      deviceInfo('Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36 Edg/130.0', 1440, 'de').browser,
    ).toBe('edge');
    expect(
      deviceInfo('Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0', 1440, 'es').os,
    ).toBe('linux');
    expect(deviceInfo('curl/8.0', 1440, 'x')).toEqual({
      type: 'desktop',
      browser: 'other',
      os: 'other',
      lang: null,
    });
  });
});
