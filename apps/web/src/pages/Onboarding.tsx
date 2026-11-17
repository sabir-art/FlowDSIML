import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Building2, Check, Chrome, MousePointerClick, Rocket } from 'lucide-react';
import { Alert, Button, Field } from '@flowdsiml/ui';
import { supabase } from '../lib/supabase';
import { check, useAction } from '../lib/useAction';
import { fieldA11y, focusFirstError, validateForm, type FieldErrors } from '../lib/validation';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { FieldError } from '../components/FieldError';
import { AuthLayout } from './auth/AuthLayout';

/** Onboarding en 2 étapes (W7) : workspace, puis extension et premiers pas. */
export function Onboarding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { reload, select, workspaces } = useWorkspace();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const { busy, error, run } = useAction();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs = validateForm(e.currentTarget, t);
    setErrors(errs);
    if (focusFirstError(e.currentTarget, errs)) return;
    const ws = await run(async () => check(await supabase.rpc('create_workspace', { p_name: name })));
    if (ws) {
      await reload();
      select(ws.id);
      setStep(2);
    }
  }

  const stepper = (
    <ol className="stepper" aria-label={t('onboarding.progress')}>
      {[t('onboarding.step1'), t('onboarding.step2')].map((label, i) => (
        <li
          key={label}
          className={i + 1 < step ? 'done' : i + 1 === step ? 'current' : ''}
          aria-current={i + 1 === step ? 'step' : undefined}
        >
          <span className="stepper-dot">{i + 1 < step ? <Check size={14} aria-hidden="true" /> : i + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );

  if (step === 2)
    return (
      <AuthLayout title={t('onboarding.extTitle')} subtitle={t('onboarding.extSubtitle')}>
        {stepper}
        <ol className="checklist">
          <li>
            <Chrome size={18} aria-hidden="true" />
            <span>{t('onboarding.ext1')}</span>
          </li>
          <li>
            <MousePointerClick size={18} aria-hidden="true" />
            <span>{t('onboarding.ext2')}</span>
          </li>
          <li>
            <Rocket size={18} aria-hidden="true" />
            <span>{t('onboarding.ext3')}</span>
          </li>
        </ol>
        <Button variant="primary" className="fd-btn--block" onClick={() => navigate('/', { replace: true })}>
          {t('onboarding.goDashboard')}
          <ArrowRight size={16} aria-hidden="true" />
        </Button>
      </AuthLayout>
    );

  return (
    <AuthLayout title={t('onboarding.title')} subtitle={t('onboarding.subtitle')}>
      {stepper}
      {error && <Alert kind="error">{error}</Alert>}
      <form onSubmit={submit} noValidate>
        <Field label={t('onboarding.name')} htmlFor="ws-name">
          <input
            id="ws-name"
            className="fd-input"
            required
            maxLength={80}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors({});
            }}
            placeholder={t('onboarding.placeholder')}
            {...fieldA11y('ws-name', errors)}
          />
          <FieldError id="ws-name" errors={errors} />
        </Field>
        <Button
          type="submit"
          variant="primary"
          icon={<Building2 />}
          disabled={busy}
          className="fd-btn--block"
        >
          {t('onboarding.create')}
        </Button>
      </form>
      {workspaces.length > 0 && (
        <p style={{ marginTop: 16, textAlign: 'center' }}>
          <Button variant="ghost" onClick={() => navigate('/')}>
            {t('common.cancel')}
          </Button>
        </p>
      )}
    </AuthLayout>
  );
}
