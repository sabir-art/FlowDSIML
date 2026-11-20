import { Image as ImageIcon, ImageUp, Images, TriangleAlert, X } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FrameFields } from '../capture/FrameFields';
import { themeSchema, type Theme } from '@flowdsiml/manifest';
import { Alert } from '@flowdsiml/ui';
import { supabase } from '../../../lib/supabase';
import { SUPABASE_URL } from '../../../lib/env';
import { contrastRatio, darkenToContrast } from '../../../lib/contrast';
import type { DemoEditor } from '../useDemoEditor';
import { CtaFields } from './CtaFields';
import { ReadingModePanel } from './GuidedDemoPanels';
import { asSettings } from '../types';
import { StylesSection } from '../styles/StylesSection';
import { FONTS, SHAPES } from '../styles/presets';
import { MediaLibrary, mediaUrl } from '../../../components/media/MediaLibrary';
import { CUSTOM_FONT } from '@flowdsiml/player-core';

type ColorKey = 'primary' | 'hotspot' | 'background' | 'surface' | 'text';

/** Onglet Design de l'éditeur (maquette editeur.html, EDT-10). */
export function ThemePanel({ editor, readOnly }: { editor: DemoEditor; readOnly: boolean }) {
  const { t } = useTranslation();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [logoName, setLogoName] = useState<string | null>(null);
  // L18 : médiathèque ouverte pour le logo ou la police
  const [library, setLibrary] = useState<'logo' | 'font' | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const demo = editor.demo!;
  const settings = asSettings(demo.settings);
  const theme: Theme = themeSchema.parse(settings.theme ?? {});
  const set = (patch: Partial<Theme>) =>
    editor.updateDemo({ settings: { ...settings, theme: { ...settings.theme, ...patch } } });

  async function uploadLogo(file: File) {
    setUploadError(null);
    const path = `${demo.workspace_id}/logo-${crypto.randomUUID()}.${file.name.split('.').pop() ?? 'png'}`;
    const { error } = await supabase.storage.from('branding').upload(path, file, { contentType: file.type });
    if (error) return setUploadError(error.message);
    set({ logoUrl: `${SUPABASE_URL}/storage/v1/object/public/branding/${path}` });
  }

  const color = (key: ColorKey, label: string, extra?: ReactNode) => (
    <div className="field">
      <label htmlFor={`th-${key}-hex`}>{label}</label>
      <div className="color-row">
        <input
          id={`th-${key}`}
          className="swatch"
          type="color"
          aria-label={label}
          disabled={readOnly}
          value={theme[key]}
          onChange={(e) => set({ [key]: e.target.value.toUpperCase() })}
        />
        <input
          id={`th-${key}-hex`}
          className="input input-sm t-mono"
          maxLength={7}
          disabled={readOnly}
          defaultValue={theme[key].toUpperCase()}
          key={theme[key]}
          onBlur={(e) => {
            const v = e.target.value.trim().toUpperCase();
            if (/^#[0-9A-F]{6}$/.test(v) && v !== theme[key]) set({ [key]: v });
            else e.target.value = theme[key].toUpperCase();
          }}
        />
      </div>
      {extra}
    </div>
  );

  // Texte des boutons sur la couleur principale (AA : 4,5:1) ; correction proposée pour un texte blanc
  const ratio = contrastRatio(theme.primary, theme.onPrimary);
  const fix =
    ratio < 4.5 && theme.onPrimary.toUpperCase() === '#FFFFFF' ? darkenToContrast(theme.primary) : null;
  const ratioText = ratio.toFixed(1).replace('.', ',');

  return (
    <div className="th-panel">
      {/* L18-05 : styles prédéfinis (remplacent le select « Thème ») */}
      <StylesSection
        wsId={demo.workspace_id}
        theme={theme}
        readOnly={readOnly}
        onApply={(tokens) => set(tokens)}
      />

      <div className="sec">
        <div className="sec-title">{t('editor.design.colors')}</div>
        {color(
          'primary',
          t('editor.colorPrimary'),
          ratio < 4.5 && (
            <div className="alert alert-warning th-warn" role="status">
              <TriangleAlert aria-hidden="true" />
              <span className="t-caption">
                {t('editor.design.lowContrast', { ratio: ratioText })}{' '}
                {fix && !readOnly && (
                  <button type="button" className="mk-link" onClick={() => set({ primary: fix })}>
                    {t('editor.design.useColor', { color: fix })}
                  </button>
                )}
              </span>
            </div>
          ),
        )}
        {color('hotspot', t('editor.colorHotspot'))}
        {color('surface', t('editor.colorSurface'))}
        {color('text', t('editor.colorText'))}
      </div>

      <div className="sec">
        <div className="sec-title">{t('editor.design.shape')}</div>
        <div className="segmented" role="radiogroup" aria-label={t('editor.design.shape')}>
          {SHAPES.map((s) => (
            <button
              key={s.key}
              type="button"
              role="radio"
              aria-checked={theme.radius === s.radius}
              disabled={readOnly}
              onClick={() => set({ radius: s.radius })}
            >
              {t(`editor.design.shape_${s.key}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="sec">
        {/* L25-03 : cadre du navigateur (toute la démo), remplace la bascule d'A2-01 */}
        <div className="sec-title">{t('editor.frame.title')}</div>
        <div className="fd-stack fd-stack--group">
          <FrameFields editor={editor} readOnly={readOnly} />
          {color('background', t('editor.frame.background'))}
          <div className="setting">
            <span className="t-label" id="th-grad-l">
              {t('editor.design.gradient')}
            </span>
            <span className="switch">
              <input
                id="th-grad"
                type="checkbox"
                aria-labelledby="th-grad-l"
                checked={theme.backgroundGradient}
                disabled={readOnly}
                onChange={(e) => set({ backgroundGradient: e.target.checked })}
              />
              <span />
            </span>
          </div>
        </div>
      </div>

      <div className="sec">
        <ReadingModePanel editor={editor} readOnly={readOnly} />
      </div>

      <div className="sec">
        <div className="sec-title">{t('editor.design.typography')}</div>
        <select
          id="th-font"
          className="select input-sm"
          aria-label={t('editor.font')}
          disabled={readOnly}
          value={theme.fontUrl ? 'media' : theme.fontFamily}
          onChange={(e) =>
            e.target.value === 'media'
              ? setLibrary('font')
              : set({ fontFamily: e.target.value, fontUrl: null })
          }
        >
          {FONTS.map((f) => (
            <option key={f} value={f}>
              {f.split(',')[0]!.replace(/'/g, '')}
            </option>
          ))}
          <option value="media">{theme.fontUrl ? t('editor.design.fontMedia') : t('media.choose')}</option>
        </select>
      </div>

      <div className="sec">
        <div className="sec-title">{t('editor.design.brand')}</div>
        {/* L45 (E12) : médiathèque → « Afficher Créé avec TutoClick » à 16 px */}
        <div className="fd-stack">
          <div className="logo-row">
            <span className="logo-preview">
              {theme.logoUrl ? (
                <img src={theme.logoUrl} alt="" />
              ) : (
                <ImageIcon size={18} aria-hidden="true" />
              )}
            </span>
            {!readOnly && (
              <>
                <input
                  ref={logoInput}
                  id="th-logo"
                  type="file"
                  hidden
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setLogoName(f.name);
                      void uploadLogo(f);
                    }
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => logoInput.current?.click()}
                >
                  <ImageUp aria-hidden="true" />
                  {theme.logoUrl ? t('editor.changeLogo') : t('editor.chooseLogo')}
                </button>
                {/* L18-03 : action stylée et alignée avec « Choisir un logo » */}
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLibrary('logo')}>
                  <Images aria-hidden="true" />
                  {t('media.choose')}
                </button>
                {theme.logoUrl && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-icon"
                    aria-label={t('editor.removeLogo')}
                    onClick={() => set({ logoUrl: null })}
                  >
                    <X aria-hidden="true" />
                  </button>
                )}
              </>
            )}
          </div>
          {logoName && <span className="help">{logoName}</span>}
          {uploadError && <Alert kind="error">{uploadError}</Alert>}
          <div className="fd-stack fd-stack--help">
            <label className="check">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={theme.showBranding}
                onChange={(e) => set({ showBranding: e.target.checked })}
              />
              {t('editor.showBranding')}
            </label>
            <p className="help">{t('editor.brandingHint')}</p>
          </div>
        </div>
      </div>

      {library && (
        <MediaLibrary
          wsId={demo.workspace_id}
          kind={library}
          onClose={() => setLibrary(null)}
          onPick={(f) => {
            if (library === 'font' && f.kind === 'font')
              set({ fontUrl: mediaUrl(f.path), fontFamily: `'${CUSTOM_FONT}', system-ui, sans-serif` });
            else if (library === 'logo' && f.kind !== 'font') set({ logoUrl: mediaUrl(f.path) });
          }}
        />
      )}

      <div className="sec">
        <div className="sec-title">{t('editor.pageCta')}</div>
        <p className="help th-help-top">{t('editor.pageCtaHint')}</p>
        <CtaFields
          idPrefix="page"
          value={settings.cta ?? null}
          disabled={readOnly}
          onChange={(v) => editor.updateDemo({ settings: { ...settings, cta: v } })}
        />
      </div>
    </div>
  );
}
