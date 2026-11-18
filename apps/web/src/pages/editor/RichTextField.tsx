import type React from 'react';
import { Bold, Braces, Italic, Link2 } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { richTextToHtml } from '@flowdsiml/core';
import { Button, Select } from '@flowdsiml/ui';
import { Menu } from '../../components/Menu';

/** Remplace {{clé|défaut}} (déjà échappé, clé contrainte) par une pastille lisible (ED6). */
export function withVariablePills(html: string): string {
  return html.replace(
    /\{\{\s*([a-z][a-z0-9_]{0,39})\s*(?:\|[^}]*)?\}\}/g,
    '<span class="var-pill">{{$1}}</span>',
  );
}

/** Calque sous le champ : même texte, variables en pastilles, **gras** et *italique* rendus
 * (gras simulé et italique synthétisé : même chasse que le texte, le curseur reste aligné). */
const TOKEN_RE = /(\*\*)([^*\n]+)(\*\*)|(\*)([^*\n]+)(\*)|(\{\{\s*[a-z][a-z0-9_]{0,39}\s*(?:\|[^}]*)?\}\})/g;

function highlightVariables(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    out.push(text.slice(last, m.index));
    const k = m.index!;
    if (m[2] !== undefined)
      out.push(
        <span key={k} className="rte-b">
          <span className="rte-mk">{m[1]}</span>
          {m[2]}
          <span className="rte-mk">{m[3]}</span>
        </span>,
      );
    else if (m[5] !== undefined)
      out.push(
        <span key={k} className="rte-i">
          <span className="rte-mk">{m[4]}</span>
          {m[5]}
          <span className="rte-mk">{m[6]}</span>
        </span>,
      );
    else
      out.push(
        <span key={k} className="rte-var">
          {m[7]}
        </span>,
      );
    last = k + m[0].length;
  }
  out.push(text.slice(last) + '\n');
  return out;
}

export function RichTextField({
  id,
  label,
  value,
  onChange,
  variables,
  disabled,
  rows = 4,
  mk = false,
  extra,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  variables: string[];
  disabled?: boolean;
  rows?: number;
  /** Habillage maquette (éditeur .mk) : cadre .rte, barre d'outils compacte, menu « Variable ». */
  mk?: boolean;
  /** Contenu ajouté après le compteur (ex. lien IA en V2). */
  extra?: ReactNode;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLTextAreaElement>(null);
  const hl = useRef<HTMLDivElement>(null);

  /** L12-06 : Ctrl B (gras) et Ctrl I (italique), ⌘ sur Mac. */
  function onFormatKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    const k = e.key.toLowerCase();
    if (k === 'b' || k === 'i') {
      e.preventDefault();
      wrap(k === 'b' ? '**' : '*');
    }
  }

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

  if (mk) {
    const toolBtn = (icon: ReactNode, label: string, onClick: () => void) => (
      <button type="button" aria-label={label} title={label} onClick={onClick}>
        {icon}
      </button>
    );
    return (
      <div className="field">
        <label className="label" htmlFor={id}>
          {label}
        </label>
        <div className={`rte${disabled ? ' is-disabled' : ''}`}>
          {!disabled && (
            <div className="rte-tools">
              {toolBtn(<Bold aria-hidden="true" />, t('editor.bold'), () => wrap('**'))}
              {toolBtn(<Italic aria-hidden="true" />, t('editor.italic'), () => wrap('*'))}
              {toolBtn(<Link2 aria-hidden="true" />, t('editor.link'), () =>
                wrap('[', '](https://)', t('editor.linkText')),
              )}
              <span className="grow" />
              {variables.length > 0 && (
                <Menu
                  label={t('editor.insertVariable')}
                  trigger={{ icon: <Braces />, text: t('editor.variable') }}
                  items={variables.map((v) => ({ label: v, onSelect: () => wrap(`{{${v}}}`, '') }))}
                />
              )}
            </div>
          )}
          <div className="rte-area">
            <div className="rte-hl" ref={hl} aria-hidden="true">
              {highlightVariables(value)}
            </div>
            <textarea
              id={id}
              ref={ref}
              className="rte-text"
              rows={rows}
              value={value}
              disabled={disabled}
              maxLength={4000}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onFormatKey}
              onScroll={(e) => {
                if (hl.current) hl.current.scrollTop = e.currentTarget.scrollTop;
              }}
            />
          </div>
        </div>
        <span className="help">
          {t('editor.chars', { n: value.length, max: 4000 })}
          {extra}
        </span>
      </div>
    );
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
        onKeyDown={onFormatKey}
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
