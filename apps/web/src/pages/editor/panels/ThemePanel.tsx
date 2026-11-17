import { Image as ImageIcon, ImageUp, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { themeSchema, type Theme } from '@flowdsiml/manifest';
import { Alert, Button, Checkbox, Field, Select } from '@flowdsiml/ui';
import { supabase } from '../../../lib/supabase';
import { SUPABASE_URL } from '../../../lib/env';
import type { DemoEditor } from '../useDemoEditor';
import { CtaFields } from './CtaFields';
import { asSettings } from '../types';

const FONTS = [
  "'Instrument Sans', system-ui, sans-serif",
  'Inter, system-ui, sans-serif',
  'system-ui, sans-serif',
  "Georgia, 'Times New Roman', serif",
  "'Helvetica Neue', Arial, sans-serif",
  "'Courier New', monospace",
];

export function ThemePanel({ editor, readOnly }: { editor: DemoEditor; readOnly: boolean }) {
  const { t } = useTranslation();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [logoName, setLogoName] = useState<string | null>(null);
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

  const color = (key: 'primary' | 'hotspot' | 'background' | 'surface' | 'text', label: string) => (
    <Field label={label} htmlFor={`th-${key}`}>
      <div className="row">
        <input
          id={`th-${key}`}
          type="color"
          disabled={readOnly}
          value={theme[key]}
          onChange={(e) => set({ [key]: e.target.value.toUpperCase() })}
        />
        <code>{theme[key].toUpperCase()}</code>
      </div>
    </Field>
  );

  return (
    <div className="stack">
      <h3 className="panel-title">{t('editor.theme')}</h3>
      {color('primary', t('editor.colorPrimary'))}
      {color('hotspot', t('editor.colorHotspot'))}
      {color('background', t('editor.colorBackground'))}
      {color('surface', t('editor.colorSurface'))}
      {color('text', t('editor.colorText'))}
      <Field label={t('editor.font')} htmlFor="th-font">
        <Select
          id="th-font"
          disabled={readOnly}
          value={theme.fontFamily}
          onChange={(e) => set({ fontFamily: e.target.value })}
        >
          {FONTS.map((f) => (
            <option key={f} value={f}>
              {f.split(',')[0]!.replace(/'/g, '')}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('editor.radius', { v: theme.radius })} htmlFor="th-radius">
        <input
          id="th-radius"
          type="range"
          min={0}
          max={24}
          disabled={readOnly}
          value={theme.radius}
          onChange={(e) => set({ radius: Number(e.target.value) })}
        />
      </Field>
      <div className="fd-field">
        <span className="fd-label">{t('editor.logo')}</span>
        <div className="logo-row">
          <span className="logo-preview">
            {theme.logoUrl ? <img src={theme.logoUrl} alt="" /> : <ImageIcon size={18} aria-hidden="true" />}
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
              <Button size="sm" icon={<ImageUp />} onClick={() => logoInput.current?.click()}>
                {theme.logoUrl ? t('editor.changeLogo') : t('editor.chooseLogo')}
              </Button>
              {theme.logoUrl && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<X />}
                  aria-label={t('editor.removeLogo')}
                  onClick={() => set({ logoUrl: null })}
                />
              )}
            </>
          )}
        </div>
        {logoName && <span className="fd-muted logo-name">{logoName}</span>}
      </div>
      {uploadError && <Alert kind="error">{uploadError}</Alert>}
      <Checkbox
        disabled={readOnly}
        checked={theme.showBranding}
        onChange={(e) => set({ showBranding: e.target.checked })}
        label={t('editor.showBranding')}
      />
      <p className="fd-muted" style={{ fontSize: 12 }}>
        {t('editor.brandingHint')}
      </p>
      <div className="panel-group">
        <span className="fd-label">{t('editor.pageCta')}</span>
        <p className="fd-muted" style={{ fontSize: 12, margin: 0 }}>
          {t('editor.pageCtaHint')}
        </p>
        <CtaFields
          idPrefix="page"
          value={settings.cta ?? null}
          disabled={readOnly}
          onChange={(v) => editor.updateDemo({ settings: { ...settings, cta: v } })}
        />
      </div>
      <Field label={t('editor.locale')} htmlFor="th-locale">
        <Select
          id="th-locale"
          disabled={readOnly}
          value={settings.locale ?? 'fr'}
          onChange={(e) =>
            editor.updateDemo({ settings: { ...settings, locale: e.target.value === 'en' ? 'en' : 'fr' } })
          }
        >
          <option value="fr">Français</option>
          <option value="en">English</option>
        </Select>
      </Field>
    </div>
  );
}
