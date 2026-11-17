import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Field } from '@flowdsiml/ui';
import { supabase } from '../lib/supabase';
import { check, useAction } from '../lib/useAction';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { AuthLayout } from './auth/AuthLayout';

export function Onboarding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { reload, select, workspaces } = useWorkspace();
  const [name, setName] = useState('');
  const { busy, error, run } = useAction();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const ws = await run(async () => check(await supabase.rpc('create_workspace', { p_name: name })));
    if (ws) {
      await reload();
      select(ws.id);
      navigate('/', { replace: true });
    }
  }

  return (
    <AuthLayout title={t('onboarding.title')} subtitle={t('onboarding.subtitle')}>
      {error && <Alert kind="error">{error}</Alert>}
      <form onSubmit={submit}>
        <Field label={t('onboarding.name')} htmlFor="ws-name">
          <input
            id="ws-name"
            className="fd-input"
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('onboarding.placeholder')}
          />
        </Field>
        <Button type="submit" variant="primary" disabled={busy} style={{ width: '100%' }}>
          {t('onboarding.create')}
        </Button>
      </form>
      {workspaces.length > 0 && (
        <p style={{ marginTop: 16 }}>
          <Button variant="ghost" onClick={() => navigate('/')}>
            {t('common.cancel')}
          </Button>
        </p>
      )}
    </AuthLayout>
  );
}
