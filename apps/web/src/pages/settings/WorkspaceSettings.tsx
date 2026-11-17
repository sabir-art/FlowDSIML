import { Check, Trash2 } from 'lucide-react';
import { useConfirm } from '../../components/ConfirmDialog';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, Field } from '@flowdsiml/ui';
import { supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { PlanUsage } from './PlanUsage';

export function WorkspaceSettings() {
  const { t } = useTranslation();
  const [dialog, ask] = useConfirm();
  const navigate = useNavigate();
  const { current, can, reload } = useWorkspace();
  const ws = current!;
  const [name, setName] = useState(ws.name);
  const [slug, setSlug] = useState(ws.slug);
  const { busy, error, success, run } = useAction();
  const editable = can('workspace.settings');

  useEffect(() => {
    setName(ws.name);
    setSlug(ws.slug);
  }, [ws.name, ws.slug]);

  async function save(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      check(await supabase.from('workspaces').update({ name, slug }).eq('id', ws.id));
      await reload();
    }, t('common.saved'));
  }

  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      {dialog}
      <div className="page-head">
        <h1>{t('workspace.title')}</h1>
      </div>
      <Card>
        <form onSubmit={save}>
          {error && <Alert kind="error">{error}</Alert>}
          {success && <Alert kind="success">{success}</Alert>}
          <Field label={t('workspace.name')} htmlFor="ws-name">
            <input
              id="ws-name"
              className="fd-input"
              required
              maxLength={80}
              disabled={!editable}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label={t('workspace.slug')} htmlFor="ws-slug">
            <input
              id="ws-slug"
              className="fd-input"
              required
              pattern="[a-z0-9][a-z0-9-]{1,59}"
              disabled={!editable}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </Field>
          {editable && (
            <Button icon={<Check />} type="submit" variant="primary" disabled={busy}>
              {t('common.save')}
            </Button>
          )}
        </form>
      </Card>
      <PlanUsage />
      {can('workspace.delete') && (
        <Card>
          <h2 style={{ marginTop: 0 }}>{t('workspace.danger')}</h2>
          <p className="fd-muted">{t('workspace.deleteHint')}</p>
          <Button
            icon={<Trash2 />}
            variant="danger"
            onClick={async () => {
              if (
                !(await ask({
                  title: t('workspace.delete'),
                  body: t('workspace.deleteHint'),
                  confirmLabel: t('workspace.delete'),
                  danger: true,
                  requireText: ws.slug,
                }))
              )
                return;
              void run(async () => {
                check(await supabase.from('workspaces').delete().eq('id', ws.id));
                await reload();
                navigate('/', { replace: true });
              });
            }}
          >
            {t('workspace.delete')}
          </Button>
        </Card>
      )}
    </div>
  );
}
