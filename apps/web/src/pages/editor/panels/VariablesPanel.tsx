import { Braces } from 'lucide-react';
import { Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Field } from '@flowdsiml/ui';
import type { DemoEditor } from '../useDemoEditor';

export function VariablesPanel({ editor, readOnly }: { editor: DemoEditor; readOnly: boolean }) {
  const { t } = useTranslation();
  const [key, setKey] = useState('');
  const valid = /^[a-z][a-z0-9_]{0,39}$/.test(key);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    await editor.addVariable(key);
    setKey('');
  }

  return (
    <div className="stack">
      <h3 className="panel-title">{t('editor.variables')}</h3>
      <p className="fd-muted" style={{ fontSize: 12 }}>
        {t('editor.variablesHint')}
      </p>
      {editor.variables.map((v) => (
        <section key={v.id} className="panel-card" aria-label={v.key}>
          <header className="panel-card-head">
            <Braces size={16} aria-hidden="true" />
            <code>{`{{${v.key}}}`}</code>
          </header>
          <Field label={t('editor.variableLabel')} htmlFor={`v-l-${v.id}`}>
            <input
              id={`v-l-${v.id}`}
              className="fd-input"
              disabled={readOnly}
              value={v.label}
              onChange={(e) => editor.updateVariable(v.id, { label: e.target.value })}
            />
          </Field>
          <Field label={t('editor.variableDefault')} htmlFor={`v-d-${v.id}`}>
            <input
              id={`v-d-${v.id}`}
              className="fd-input"
              maxLength={200}
              disabled={readOnly}
              value={v.default_value}
              onChange={(e) => editor.updateVariable(v.id, { default_value: e.target.value })}
            />
          </Field>
          {!readOnly && (
            <Button
              size="sm"
              variant="ghost"
              className="btn-danger-ghost"
              icon={<Trash2 />}
              onClick={() => void editor.deleteVariable(v.id)}
            >
              {t('common.delete')}
            </Button>
          )}
        </section>
      ))}
      {!readOnly && (
        <form onSubmit={add} className="row">
          <input
            className="fd-input"
            style={{ flex: 1 }}
            placeholder="company"
            aria-label={t('editor.variableKey')}
            value={key}
            onChange={(e) => setKey(e.target.value.toLowerCase())}
          />
          <Button icon={<Plus />} type="submit" disabled={!valid}>
            {t('editor.addVariable')}
          </Button>
        </form>
      )}
    </div>
  );
}
