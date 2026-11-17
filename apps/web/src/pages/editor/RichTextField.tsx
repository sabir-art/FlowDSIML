import { Bold, Italic, Link2 } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { richTextToHtml } from '@flowdsiml/core';
import { Button, Select } from '@flowdsiml/ui';

/** Remplace {{clé|défaut}} (déjà échappé, clé contrainte) par une pastille lisible (ED6). */
function withVariablePills(html: string): string {
  return html.replace(
    /\{\{\s*([a-z][a-z0-9_]{0,39})\s*(?:\|[^}]*)?\}\}/g,
    '<span class="var-pill">$1</span>',
  );
}

/** Texte riche restreint : **gras**, *italique*, [lien](url), {{variable}}. Rendu sûr (échappé). */
export function RichTextField({
  id,
  label,
  value,
  onChange,
  variables,
  disabled,
  rows = 4,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  variables: string[];
  disabled?: boolean;
  rows?: number;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLTextAreaElement>(null);

  function wrap(before: string, after = before, placeholder = '') {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = value.slice(s, e) || placeholder;
    const next = value.slice(0, s) + before + sel + after + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + sel.length);
    });
  }

  return (
    <div className="fd-field">
      <label className="fd-label" htmlFor={id}>
        {label}
      </label>
      {!disabled && (
        <div className="row rt-toolbar">
          <Button
            size="sm"
            variant="ghost"
            icon={<Bold />}
            onClick={() => wrap('**')}
            aria-label={t('editor.bold')}
            title={t('editor.bold')}
          />
          <Button
            size="sm"
            variant="ghost"
            icon={<Italic />}
            onClick={() => wrap('*')}
            aria-label={t('editor.italic')}
            title={t('editor.italic')}
          />
          <Button
            size="sm"
            variant="ghost"
            icon={<Link2 />}
            onClick={() => wrap('[', '](https://)', t('editor.linkText'))}
            aria-label={t('editor.link')}
            title={t('editor.link')}
          />
          {variables.length > 0 && (
            <Select
              inline
              className="rt-var"
              value=""
              aria-label={t('editor.insertVariable')}
              onChange={(e) => e.target.value && wrap(`{{${e.target.value}}}`, '')}
            >
              <option value="">{t('editor.insertVariable')}</option>
              {variables.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </Select>
          )}
        </div>
      )}
      <textarea
        id={id}
        ref={ref}
        className="fd-textarea"
        rows={rows}
        value={value}
        disabled={disabled}
        maxLength={4000}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="rt-meta">
        <span className="fd-muted">{t('editor.chars', { n: value.length, max: 4000 })}</span>
      </div>
      {value && (
        <div
          className="rt-preview"
          dangerouslySetInnerHTML={{ __html: withVariablePills(richTextToHtml(value)) }}
        />
      )}
    </div>
  );
}
