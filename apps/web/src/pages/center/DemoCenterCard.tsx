import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutGrid } from 'lucide-react';
import { ctaValid, type CenterDraft } from './centerDraft';

const ICON = { size: 18, 'aria-hidden': true } as const;

/**
 * A8 (L20-03) : type de centre (Centre de formation / Demo Center). Demo Center : titre et
 * sous-titre du héros (valeurs par défaut affichées en exemple), bouton « Nous contacter » (lien
 * https ; formulaire de lead « Bientôt » tant que l'envoi d'e-mails n'est pas arbitré).
 */
export function DemoCenterCard({
  draft,
  update,
}: {
  draft: CenterDraft;
  update: (patch: Partial<CenterDraft>) => void;
}) {
  const { t } = useTranslation();
  const demo = draft.kind === 'demo';
  const [label, setLabel] = useState(draft.cta?.label ?? t('center.demo.ctaDefault'));
  const [url, setUrl] = useState(draft.cta?.url ?? '');
  useEffect(() => {
    setLabel(draft.cta?.label ?? t('center.demo.ctaDefault'));
    setUrl(draft.cta?.url ?? '');
  }, [draft.cta]); // eslint-disable-line react-hooks/exhaustive-deps
  const cta = url.trim() ? { label: label.trim(), url: url.trim() } : null;
  const invalid = !!cta && !ctaValid(cta);
  const saveCta = () => {
    if (!invalid && JSON.stringify(cta) !== JSON.stringify(draft.cta ?? null)) update({ cta });
  };

  return (
    <section className="fd-card" aria-labelledby="c-kind">
      <div className="fd-card__head">
        <span className="fd-icon-chip">
          <LayoutGrid {...ICON} />
        </span>
        <h2 className="fd-card__title" id="c-kind">
          {t('center.demo.kind')}
        </h2>
      </div>
      <div className="seg14" role="radiogroup" aria-labelledby="c-kind">
        {(['training', 'demo'] as const).map((k) => (
          <label key={k} className="kind14">
            <input
              type="radio"
              name="center-kind"
              value={k}
              checked={(draft.kind ?? 'training') === k}
              onChange={() => update({ kind: k })}
            />
            <span>
              <b>{t(`center.demo.kind_${k}`)}</b>
              <small>{t(`center.demo.kindHelp_${k}`)}</small>
            </span>
          </label>
        ))}
      </div>
      {demo && (
        <>
          <div className="fd-field">
            <label className="fd-label" htmlFor="c-hero">
              {t('center.demo.heroTitle')}
            </label>
            <input
              id="c-hero"
              className="fd-input"
              maxLength={120}
              placeholder={t('center.demo.heroTitleDefault')}
              value={draft.heroTitle ?? ''}
              onChange={(e) => update({ heroTitle: e.target.value })}
            />
          </div>
          <div className="fd-field">
            <label className="fd-label" htmlFor="c-hero-sub">
              {t('center.demo.heroSubtitle')}
            </label>
            <input
              id="c-hero-sub"
              className="fd-input"
              maxLength={240}
              placeholder={t('center.demo.heroSubtitleDefault')}
              value={draft.heroSubtitle ?? ''}
              onChange={(e) => update({ heroSubtitle: e.target.value })}
            />
          </div>
          <fieldset className="fd-field cta14">
            <legend className="fd-label">{t('center.demo.cta')}</legend>
            <div className="row14">
              <label className="fd-label" htmlFor="c-cta-label">
                {t('center.demo.ctaLabel')}
              </label>
              <input
                id="c-cta-label"
                className="fd-input"
                maxLength={40}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onBlur={saveCta}
              />
            </div>
            <div className="row14">
              <label className="fd-label" htmlFor="c-cta-url">
                {t('center.demo.ctaUrl')}
              </label>
              <input
                id="c-cta-url"
                className="fd-input"
                type="url"
                inputMode="url"
                placeholder="https://"
                value={url}
                aria-invalid={invalid || undefined}
                aria-describedby="c-cta-h"
                onChange={(e) => setUrl(e.target.value)}
                onBlur={saveCta}
              />
              <span
                className={invalid ? 'err-line' : 'fd-help'}
                id="c-cta-h"
                role={invalid ? 'alert' : undefined}
              >
                {invalid ? t('center.demo.ctaInvalid') : t('center.demo.ctaHelp')}
              </span>
            </div>
            <p className="fd-help">
              {t('center.demo.ctaForm')} <span className="soon-text">{t('center.demo.soon')}</span>
            </p>
          </fieldset>
        </>
      )}
    </section>
  );
}
