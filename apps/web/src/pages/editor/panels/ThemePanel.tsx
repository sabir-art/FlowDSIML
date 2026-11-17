import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { themeSchema, type Theme } from '@flowdsiml/manifest';
import { Alert, Button, Field } from '@flowdsiml/ui';
import { supabase } from '../../../lib/supabase';
import { SUPABASE_URL } from '../../../lib/env';
import type { DemoEditor } from '../useDemoEditor';
import { asSettings } from '../types';

const FONTS = [
  'Inter, system-ui, sans-serif',
  'system-ui, sans-serif',
  "Georgia, 'Times New Roman', serif",
  "'Helvetica Neue', Arial, sans-serif",
  "'Courier New', monospace",
];

export function ThemePanel({ editor, readOnly }: { editor: DemoEditor; readOnly: boolean }) {
  const { t } = useTranslation();
  const [uploadError, setUploadError] = useState<string | null>(null);
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

  const color = (key: 'primary' | 'background' | 'surface' | 'text', label: string) => (
    <Field label={label} htmlFor={`th-${key}`}>
      <div className="row">
        <input
          id={`th-${key}`}
          type="color"
          disabled={readOnly}
          value={theme[key]}
          onChange={(e) => set({ [key]: e.target.value })}
        />
        <code>{theme[key]}</code>
      </div>
    </Field>
  );

  return (
    <div className="stack">
      <h3 className="panel-title">{t('editor.theme')}</h3>
      {color('primary', t('editor.colorPrimary'))}
      {color('background', t('editor.colorBackground'))}
      {color('surface', t('editor.colorSurface'))}
      {color('text', t('editor.colorText'))}
      <Field label={t('editor.font')} htmlFor="th-font">
        <select
          id="th-font"
          className="fd-select"
          disabled={readOnly}
          value={theme.fontFamily}
          onChange={(e) => set({ fontFamily: e.target.value })}
        >
          {FONTS.map((f) => (
            <option key={f} value={f}>
              {f.split(',')[0]!.replace(/'/g, '')}
            </option>
          ))}
        </select>
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
      <Field label={t('editor.logo')} htmlFor="th-logo">
        {theme.logoUrl && <img src={theme.logoUrl} alt="" style={{ maxHeight: 40, maxWidth: 160 }} />}
        {!readOnly && (
          <input
            id="th-logo"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={(e) => e.target.files?.[0] && void uploadLogo(e.target.files[0])}
          />
        )}
        {theme.logoUrl && !readOnly && (
          <Button size="sm" variant="ghost" onClick={() => set({ logoUrl: null })}>
            {t('editor.removeLogo')}
          </Button>
        )}
      </Field>
      {uploadError && <Alert kind="error">{uploadError}</Alert>}
      <label className="row">
        <input
          type="checkbox"
          disabled={readOnly}
          checked={theme.showBranding}
          onChange={(e) => set({ showBranding: e.target.checked })}
        />{' '}
        {t('editor.showBranding')}
      </label>
      <p className="fd-muted" style={{ fontSize: 12 }}>
        {t('editor.brandingHint')}
      </p>
      <Field label={t('editor.locale')} htmlFor="th-locale">
        <select
          id="th-locale"
          className="fd-select"
          disabled={readOnly}
          value={settings.locale ?? 'fr'}
          onChange={(e) =>
            editor.updateDemo({ settings: { ...settings, locale: e.target.value === 'en' ? 'en' : 'fr' } })
          }
        >
          <option value="fr">Français</option>
          <option value="en">English</option>
        </select>
      </Field>
    </div>
  );
}
