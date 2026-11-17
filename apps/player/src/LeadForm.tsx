import { useState } from 'preact/hooks';
import type { LeadForm as LeadFormT } from '@flowdsiml/manifest';
import type { Dict } from './i18n';

export function LeadForm({
  form,
  privacyUrl,
  t,
  sub,
  onSubmit,
  onSkip,
}: {
  form: LeadFormT;
  privacyUrl?: string | null;
  t: Dict;
  sub: (s: string) => string;
  onSubmit: (d: { email: string; fields: Record<string, string>; consent: boolean }) => Promise<void>;
  onSkip: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const fields = form.fields.some((f) => f.type === 'email')
    ? form.fields
    : [{ key: 'email', label: 'Email', type: 'email' as const, required: true }, ...form.fields];

  async function submit(e: Event) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    try {
      const emailField = fields.find((f) => f.type === 'email')!;
      const { [emailField.key]: email = '', ...rest } = values;
      await onSubmit({ email, fields: rest, consent });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="p-overlay" role="dialog" aria-modal="true" aria-labelledby="p-form-title">
      <form class="p-form" onSubmit={submit}>
        <h2 id="p-form-title">{sub(form.title)}</h2>
        {form.description && <p>{sub(form.description)}</p>}
        {fields.map((f) => (
          <label key={f.key} class="p-field">
            <span>
              {sub(f.label)}
              {f.required ? ' *' : ''}
            </span>
            <input
              type={f.type}
              required={f.required || f.type === 'email'}
              maxLength={200}
              autoComplete={
                f.type === 'email'
                  ? 'email'
                  : f.key === 'full_name'
                    ? 'name'
                    : f.key === 'company'
                      ? 'organization'
                      : f.type === 'tel'
                        ? 'tel'
                        : 'on'
              }
              value={values[f.key] ?? ''}
              onInput={(e) => setValues({ ...values, [f.key]: (e.target as HTMLInputElement).value })}
            />
          </label>
        ))}
        {form.consentText && (
          <label class="p-consent">
            <input
              type="checkbox"
              required
              checked={consent}
              onChange={(e) => setConsent((e.target as HTMLInputElement).checked)}
            />
            <span>{sub(form.consentText)}</span>
          </label>
        )}
        {privacyUrl && (
          <p class="p-privacy">
            <a href={privacyUrl} target="_blank" rel="noopener noreferrer">
              {t.privacy}
            </a>
          </p>
        )}
        {error && <p class="p-error">{t.formError}</p>}
        <div class="p-actions">
          {form.skippable && (
            <button type="button" class="p-btn p-btn-ghost" onClick={onSkip}>
              {t.skip}
            </button>
          )}
          <button type="submit" class="p-btn p-btn-primary" disabled={busy}>
            {busy ? t.sending : sub(form.submitLabel)}
          </button>
        </div>
      </form>
    </div>
  );
}
