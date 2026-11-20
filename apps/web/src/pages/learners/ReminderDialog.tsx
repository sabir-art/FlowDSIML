/**
 * L46-bis §3 : « Préparer la relance » avant d'ouvrir la messagerie. Un seul e-mail part à tous en copie
 * cachée : seules les variables communes à tous sont possibles (nom de l'espace, date du jour, variables
 * de l'espace). Les variables par personne restent visibles mais désactivées, avec leur raison.
 * Le message par défaut est gardé dans workspaces.settings.reminder (JSON existant).
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { applyVariables, computedVariables } from '@flowdsiml/core';
import type { Tables } from '@flowdsiml/supabase-types';
import { supabase } from '../../lib/supabase';
import { useVarCatalog, type CatalogItem } from '../../lib/varCatalog';
import { VarTextField } from '../editor/vars/VarTextField';

type VarRow = Pick<
  Tables<'variables'>,
  'key' | 'label' | 'default_value' | 'description' | 'example' | 'value'
>;
export interface Reminder {
  subject: string;
  body: string;
}

/** Message par défaut de l'espace, sinon les textes de l'app. */
export function savedReminder(settings: unknown): Partial<Reminder> {
  const r = (settings as { reminder?: Partial<Reminder> } | null)?.reminder;
  return r && typeof r === 'object' ? r : {};
}

export function ReminderDialog({
  ws,
  count,
  canSave,
  onClose,
  onSend,
}: {
  ws: { id: string; name: string; settings: unknown };
  count: number;
  canSave: boolean;
  onClose: () => void;
  /** Textes avec variables remplacées, et textes bruts à garder comme message par défaut. */
  onSend: (resolved: Reminder, raw: Reminder | null) => void;
}) {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState<VarRow[]>([]);
  useEffect(() => {
    void supabase
      .from('variables')
      .select('key, label, default_value, description, example, value')
      .eq('workspace_id', ws.id)
      .then(({ data }) => setRows(data ?? []));
  }, [ws.id]);
  const base = useVarCatalog(rows);
  const catalog = useMemo<CatalogItem[]>(() => {
    const common = (key: string, group: CatalogItem['group'], example: string): CatalogItem => ({
      key,
      group,
      label: t(`learners.reminder.vars.${key}`),
      description: '',
      example,
      fallback: '',
      computed: true,
      emailOnly: false,
    });
    const perPerson = (key: string): CatalogItem => ({
      ...common(key, 'visitor', ''),
      disabledReason: t('learners.reminder.perPerson'),
    });
    return [
      perPerson('learner_first_name'),
      perPerson('personal_link'),
      ...base.filter((c) => c.key === 'today'),
      common('workspace_name', 'workspace', ws.name),
      ...base.filter((c) => c.group === 'workspace'),
    ];
  }, [base, t, ws.name]);
  const saved = savedReminder(ws.settings);
  const [subject, setSubject] = useState(saved.subject ?? t('learners.remind.subject'));
  const [body, setBody] = useState(saved.body ?? t('learners.remind.body'));
  const [keep, setKeep] = useState(true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const send = () => {
    const values = {
      ...Object.fromEntries(rows.map((r) => [r.key, r.value || r.default_value])),
      workspace_name: ws.name,
      today: computedVariables({ title: '', stepCount: 0 }, i18n.language, new Date()).today,
    };
    onSend(
      { subject: applyVariables(subject, values), body: applyVariables(body, values) },
      canSave && keep ? { subject, body } : null,
    );
  };
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="modal rm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rm-t"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <div className="modal-head">
          <h2 id="rm-t">{t('learners.reminder.title')}</h2>
        </div>
        <div className="modal-body fd-stack fd-stack--group">
          <p className="help">{t('learners.reminder.intro', { count })}</p>
          <VarTextField
            singleLine
            id="rm-subject"
            label={t('learners.reminder.subject')}
            maxLength={200}
            catalog={catalog}
            value={subject}
            onChange={setSubject}
          />
          <VarTextField
            plain
            id="rm-body"
            label={t('learners.reminder.message')}
            maxLength={2000}
            rows={6}
            catalog={catalog}
            value={body}
            onChange={setBody}
          />
          {canSave && (
            <label className="check">
              <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
              {t('learners.reminder.keep')}
            </label>
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="fd-btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="fd-btn fd-btn--primary" disabled={!subject.trim() || !body.trim()}>
            {t('learners.reminder.open')}
          </button>
        </div>
      </form>
    </div>
  );
}
