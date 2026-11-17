import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { richTextToHtml } from '@flowdsiml/core';
import { Button } from '@flowdsiml/ui';

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
          <Button size="sm" onClick={() => wrap('**')} aria-label={t('editor.bold')}>
            <b>B</b>
          </Button>
          <Button size="sm" onClick={() => wrap('*')} aria-label={t('editor.italic')}>
            <i>I</i>
          </Button>
          <Button size="sm" onClick={() => wrap('[', '](https://)', t('editor.linkText'))}>
            {t('editor.link')}
          </Button>
          {variables.length > 0 && (
            <select
              className="fd-select"
              style={{ width: 'auto', padding: '3px 6px' }}
              value=""
              aria-label={t('editor.insertVariable')}
              onChange={(e) => e.target.value && wrap(`{{${e.target.value}}}`, '')}
            >
              <option value="">{`{{ }}`}</option>
              {variables.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
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
      {value && <div className="rt-preview" dangerouslySetInnerHTML={{ __html: richTextToHtml(value) }} />}
    </div>
  );
}
