import { Ellipsis, Image as ImageIcon, Images, Replace, Trash2, TriangleAlert, Upload } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FrameFields } from '../capture/FrameFields';
import { themeSchema, type Theme } from '@flowdsiml/manifest';
import { Select, ColorSwatch } from '@flowdsiml/ui';
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
import { DropBlock, UploadBar } from '../../../components/DropBlock';
import { Menu } from '../../../components/Menu';
import { CUSTOM_FONT } from '@flowdsiml/player-core';
import { useVarCatalog } from '../../../lib/varCatalog';

type ColorKey = 'primary' | 'hotspot' | 'background' | 'surface' | 'text';

/** Onglet Design de l'éditeur (maquette editeur.html, EDT-10). */
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const LOGO_MAX = 2 * 1024 * 1024;

export function ThemePanel({ editor, readOnly }: { editor: DemoEditor; readOnly: boolean }) {
  const { t } = useTranslation();
  const catalog = useVarCatalog(editor.variables);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [logoName, setLogoName] = useState<string | null>(null);
  // L18 : médiathèque ouverte pour le logo ou la police
  const [library, setLibrary] = useState<'logo' | 'font' | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const demo = editor.demo!;
  const settings = asSettings(demo.settings);
  const theme: Theme = themeSchema.parse(settings.theme ?? {});
  const set = (patch: Partial<Theme>) =>
    editor.updateDemo({ settings: { ...settings, theme: { ...settings.theme, ...patch } } });

  async function uploadLogo(file: File) {
    setUploadError(null);
    if (!LOGO_TYPES.includes(file.type)) return setUploadError(t('editor.design.logoBadType'));
    if (file.size > LOGO_MAX) return setUploadError(t('editor.design.logoTooBig'));
    setSending(true);
    try {
      await sendLogo(file);
    } finally {
      setSending(false);
    }
  }
  async function sendLogo(file: File) {
    const path = `${demo.workspace_id}/logo-${crypto.randomUUID()}.${file.name.split('.').pop() ?? 'png'}`;
    const { error } = await supabase.storage.from('branding').upload(path, file, { contentType: file.type });
    if (error) return setUploadError(t('editor.design.logoError'));
    setLogoName(file.name);
    set({ logoUrl: `${SUPABASE_URL}/storage/v1/object/public/branding/${path}` });
  }

  const color = (key: ColorKey, label: string, extra?: ReactNode) => (
    <div className="field">
      <label htmlFor={`th-${key}-hex`}>{label}</label>
      <div className="color-row">
        <ColorSwatch
          label={t('brand.picker', { label })}
          labels={{
            palette: t('common.colorPalette'),
            shade: t('common.colorShade'),
            hue: t('common.colorHue'),
            hex: t('common.colorHex'),
          }}
          disabled={readOnly}
          value={theme[key]}
          onChange={(c) => set({ [key]: c })}
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
        <Select
          id="th-font"
          size="sm"
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
        </Select>
      </div>

      <div className="sec">
        <div className="sec-title">{t('editor.design.brand')}</div>
        {/* L45 (E12) : médiathèque → « Afficher Créé avec TutoClick » à 16 px */}
        <div className="fd-stack">
          {/* MEDIA-01 §18.3 : forme étroite (vignette de 72 px, « Importer… », dépôt sur tout le bloc, ⋯) */}
          <DropBlock
            className="logo-row logo-block"
            disabled={readOnly || sending}
            onFile={(f) => void uploadLogo(f)}
          >
            <span className="logo-preview">
              {theme.logoUrl ? (
                <img src={theme.logoUrl} alt="" />
              ) : (
                <ImageIcon size={20} aria-hidden="true" />
              )}
            </span>
            <div className="logo-block__main">
              {!readOnly && (
                <div className={`logo-block__acts${theme.logoUrl ? '' : ' logo-block__acts--stack'}`}>
                  <input
                    ref={logoInput}
                    id="th-logo"
                    type="file"
                    /* COMP-01 §5 : le champ reste dans la page, masqué à l'œil et relié à son bouton */
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden="true"
                    aria-label={t('editor.design.logo')}
                    accept={LOGO_TYPES.join(',')}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadLogo(f);
                      e.target.value = '';
                    }}
                  />
                  {theme.logoUrl ? (
                    <>
                      <span className="logo-name">{logoName ?? t('editor.design.logoSet')}</span>
                      <Menu
                        label={t('editor.design.logoMore')}
                        icon={<Ellipsis />}
                        items={[
                          {
                            label: t('dropzone.replace'),
                            icon: <Replace />,
                            onSelect: () => logoInput.current?.click(),
                          },
                          { label: t('media.choose'), icon: <Images />, onSelect: () => setLibrary('logo') },
                          'separator',
                          {
                            label: t('editor.design.logoRemove'),
                            icon: <Trash2 />,
                            danger: true,
                            onSelect: () => {
                              setLogoName(null);
                              set({ logoUrl: null });
                            },
                          },
                        ]}
                      />
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={sending}
                        aria-controls="th-logo"
                        aria-describedby="th-logo-h"
                        onClick={() => logoInput.current?.click()}
                      >
                        <Upload aria-hidden="true" />
                        {sending ? t('dropzone.sendingShort') : t('dropzone.import')}
                      </button>
                      {/* L18-03 : un logo déjà dans la médiathèque */}
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        // Panneau de 320 px : libellé court « Médiathèque », nom complet pour les lecteurs d'écran
                        aria-label={t('media.choose')}
                        onClick={() => setLibrary('logo')}
                      >
                        <Images aria-hidden="true" />
                        {t('media.open')}
                      </button>
                    </>
                  )}
                </div>
              )}
              {sending && <UploadBar label={t('editor.design.logoSending')} />}
              {uploadError ? (
                <span className="logo-block__err" role="alert">
                  {uploadError}
                </span>
              ) : (
                <span className="help" id="th-logo-h">
                  {t('editor.design.logoHelp')}
                </span>
              )}
            </div>
          </DropBlock>
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
          </div>
        </div>
      </div>

      {library && (
        <MediaLibrary
          wsId={demo.workspace_id}
          kind={library}
          destination={t(`media.dest.${library === 'font' ? 'demoFont' : 'demoLogo'}`, { title: demo.title })}
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
          catalog={catalog}
          value={settings.cta ?? null}
          disabled={readOnly}
          onChange={(v) => editor.updateDemo({ settings: { ...settings, cta: v } })}
        />
      </div>
    </div>
  );
}
