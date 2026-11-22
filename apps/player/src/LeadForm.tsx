import { safeExternalUrl } from '@flowdsiml/manifest';
import { useState } from 'preact/hooks';
import { useModalFocus } from './modalFocus';
import type { LeadForm as LeadFormT } from '@flowdsiml/manifest';
import { ArrowRight } from 'lucide-preact';
import { fmt, type Dict } from './i18n';

export function LeadForm({
  form,
  privacyUrl,
  workspaceName,
  t,
  sub,
  onSubmit,
  onSkip,
  rich,
}: {
  form: LeadFormT;
  privacyUrl?: string | null;
  /** PY-5 : « Données traitées par … » (toujours affiché). */
  workspaceName?: string;
  t: Dict;
  sub: (s: string) => string;
  onSubmit: (d: { email: string; fields: Record<string, string>; consent: boolean }) => Promise<void>;
  onSkip: () => void;
  /** Texte riche avec variables, en HTML sûr (richTextToHtml). */
  rich: (s: string) => string;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const fields = form.fields.some((f) => f.type === 'email')
    ? form.fields
    : [{ key: 'email', label: t.emailPro, type: 'email' as const, required: true }, ...form.fields];

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

  const modal = useModalFocus<HTMLDivElement>();
  return (
    <div ref={modal} class="p-overlay" role="dialog" aria-modal="true" aria-labelledby="p-form-title">
      <form class="p-form" onSubmit={submit}>
        <h2 id="p-form-title">{sub(form.title)}</h2>
        {/* L46-bis : introduction en texte riche (variables remplacées, HTML sûr par construction) */}
        {form.description && <p dangerouslySetInnerHTML={{ __html: rich(form.description) }} />}
        {fields.map((f) => (
          <label key={f.key} class="p-field">
            <span>
              {f.type === 'email' && /^e-?mail( professionnel)?$/i.test(f.label.trim())
                ? t.emailPro
                : sub(f.label)}
              {(f.required || f.type === 'email') && <span aria-hidden="true"> *</span>}
            </span>
            <input
              type={f.type}
              name={f.key}
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
        <p class="p-privacy">
          {workspaceName
            ? fmt(t as unknown as Record<string, string>, 'processedBy', { ws: workspaceName })
            : t.processedByUnknown}
          {privacyUrl && (
            <>
              {' '}
              <a href={safeExternalUrl(privacyUrl) ?? undefined} target="_blank" rel="noopener noreferrer">
                {t.privacy}
              </a>
            </>
          )}
        </p>
        {error && <p class="p-error">{t.formError}</p>}
        <div class="p-actions">
          {form.skippable && (
            <button type="button" class="p-btn p-btn-ghost" onClick={onSkip}>
              {t.skip}
            </button>
          )}
          <button type="submit" class="p-btn p-btn-primary" disabled={busy}>
            {busy ? t.sending : sub(form.submitLabel)}
            {!busy && <ArrowRight size={16} aria-hidden="true" />}
          </button>
        </div>
      </form>
    </div>
  );
}
