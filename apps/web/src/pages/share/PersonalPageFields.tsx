import { CircleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { personalTitle } from '@flowdsiml/core';
import { Select } from '@flowdsiml/ui';

/** L25-13 : réglages de la page personnalisée d'un lien. */
export interface PersonalPageDraft {
  enabled: boolean;
  title: string;
  message: string;
  signedBy: string;
  datasetRow: string;
  ctaLabel: string;
  ctaUrl: string;
}

export const emptyPersonalPage = (enabled: boolean): PersonalPageDraft => ({
  enabled,
  title: '',
  message: '',
  signedBy: '',
  datasetRow: '',
  ctaLabel: '',
  ctaUrl: '',
});

/** Erreurs de la section (lien du bouton en https). */
export function personalPageErrors(d: PersonalPageDraft): Record<string, string> {
  const e: Record<string, string> = {};
  if (d.enabled && d.ctaUrl.trim() && !/^https:\/\/\S+$/.test(d.ctaUrl.trim())) e.ctaUrl = 'https';
  return e;
}

/**
 * Section « Page personnalisée » de la modale « Nouveau lien personnalisé » (fond surface-sunken).
 * Activée par défaut si la page publique (L19b) l'est ; sinon désactivée avec « Activer la page
 * publique ». Titre (90, variables, aperçu calculé), message (400), signature (membre, jamais
 * l'e-mail), ligne du jeu de données, texte et lien du bouton.
 */
export function PersonalPageFields({
  draft,
  onChange,
  publicPage,
  members,
  datasetRows,
  values,
  demoTitle,
  onEnablePublicPage,
  errors,
}: {
  draft: PersonalPageDraft;
  onChange: (d: PersonalPageDraft) => void;
  publicPage: { enabled: boolean; cta: { label: string; url: string } | null };
  members: Array<{ id: string; name: string }>;
  datasetRows: string[] | null;
  values: Record<string, string>;
  demoTitle: string;
  onEnablePublicPage: () => void;
  errors: Record<string, string>;
}) {
  const { t } = useTranslation();
  const set = (patch: Partial<PersonalPageDraft>) => onChange({ ...draft, ...patch });
  const off = !publicPage.enabled;
  const preview = personalTitle(draft.title, values, demoTitle);
  return (
    <fieldset className="sh-pp" disabled={false}>
      <legend className="sr-only">{t('share.pp.title')}</legend>
      <div className="setting">
        <span className="t-label" id="sh-pp-l">
          {t('share.pp.title')}
        </span>
        <span className="switch">
          <input
            type="checkbox"
            aria-labelledby="sh-pp-l"
            aria-describedby={off ? 'sh-pp-off' : undefined}
            checked={draft.enabled && !off}
            disabled={off}
            onChange={(e) => set({ enabled: e.target.checked })}
          />
          <span />
        </span>
      </div>
      {off ? (
        <p className="help" id="sh-pp-off">
          {t('share.pp.off')}{' '}
          <button type="button" className="link-button" onClick={onEnablePublicPage}>
            {t('share.pp.enablePublic')}
          </button>
        </p>
      ) : (
        <p className="help">{t('share.pp.help')}</p>
      )}
      {draft.enabled && !off && (
        <>
          <div className="field">
            <label htmlFor="sh-pp-title">{t('share.pp.pageTitle')}</label>
            <input
              id="sh-pp-title"
              className="input"
              maxLength={90}
              placeholder={t('share.pp.titlePlaceholder', { company: '{{company}}' })}
              value={draft.title}
              aria-describedby="sh-pp-title-h"
              onChange={(e) => set({ title: e.target.value })}
            />
            <span className="help" id="sh-pp-title-h">
              {t('share.pp.preview', { title: preview })}
            </span>
          </div>
          <div className="field">
            <label htmlFor="sh-pp-msg">
              {t('share.pp.message')} <span className="opt">{t('plans.optional')}</span>
            </label>
            <textarea
              id="sh-pp-msg"
              className="input"
              rows={3}
              maxLength={400}
              value={draft.message}
              aria-describedby="sh-pp-msg-c"
              onChange={(e) => set({ message: e.target.value })}
            />
            <span className="help" id="sh-pp-msg-c">
              {t('share.pp.count', { n: draft.message.length })}
            </span>
          </div>
          <div className="grid sh-vars">
            <div className="field">
              <label htmlFor="sh-pp-sign">{t('share.pp.signedBy')}</label>
              <Select
                id="sh-pp-sign"
                value={draft.signedBy}
                onChange={(e) => set({ signedBy: e.target.value })}
              >
                <option value="">{t('share.pp.noSignature')}</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </div>
            {datasetRows && (
              <div className="field">
                <label htmlFor="sh-pp-row">{t('share.pp.datasetRow')}</label>
                <Select
                  id="sh-pp-row"
                  value={draft.datasetRow}
                  onChange={(e) => set({ datasetRow: e.target.value })}
                >
                  <option value="">{t('share.pp.rowAuto')}</option>
                  {datasetRows.map((r, i) => (
                    <option key={i} value={String(i)}>
                      {t('share.pp.rowN', { n: i + 1, label: r })}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>
          <div className="grid sh-vars">
            <div className="field">
              <label htmlFor="sh-pp-cta">{t('share.pp.ctaLabel')}</label>
              <input
                id="sh-pp-cta"
                className="input"
                maxLength={40}
                placeholder={publicPage.cta?.label ?? ''}
                value={draft.ctaLabel}
                onChange={(e) => set({ ctaLabel: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="sh-pp-url">{t('share.pp.ctaUrl')}</label>
              <input
                id="sh-pp-url"
                className="input"
                type="url"
                inputMode="url"
                placeholder={publicPage.cta?.url ?? 'https://'}
                value={draft.ctaUrl}
                aria-invalid={errors.ctaUrl ? true : undefined}
                aria-describedby={errors.ctaUrl ? 'sh-pp-url-e' : undefined}
                onChange={(e) => set({ ctaUrl: e.target.value })}
              />
              {errors.ctaUrl && (
                <span className="error-msg" id="sh-pp-url-e">
                  <CircleAlert aria-hidden="true" />
                  {t('share.pp.httpsRequired')}
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </fieldset>
  );
}
