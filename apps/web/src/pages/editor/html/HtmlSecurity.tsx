import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HTML_SECURITY_KEYS, type HtmlSecurityReport, htmlSecurityStatus } from '@flowdsiml/core';
import type { StepRow } from '../types';

/** Rapport enregistré par le serveur (steps.html_meta.security), ou null pour une page plus ancienne. */
export function stepSecurity(step: Pick<StepRow, 'html_meta'>): HtmlSecurityReport | null {
  const s = (step.html_meta as { security?: HtmlSecurityReport } | null)?.security;
  return s && typeof s === 'object' ? s : null;
}

/**
 * L49 §3 : section « Sécurité de la page » de l'outil Étape (page HTML). Statut écrit (point de 8 px,
 * jamais la couleur seule), une phrase, puis « Détail » qui déplie les compteurs du serveur.
 */
export function HtmlSecurity({ step }: { step: StepRow }) {
  const { t } = useTranslation();
  const id = useId();
  const [open, setOpen] = useState(false);
  const r = stepSecurity(step);
  const status = r && htmlSecurityStatus(r);
  return (
    <div className="sec hsec" role="group" aria-labelledby={`${id}-t`}>
      <div className="sec-title" id={`${id}-t`}>
        {t('htmlSecurity.title')}
      </div>
      {!r || !status ? (
        <p className="help">{t('htmlSecurity.notAnalyzed')}</p>
      ) : (
        <>
          <p className="hsec-status">
            <span className={`hsec-dot is-${status}`} aria-hidden="true" />
            <strong>{t(`htmlSecurity.${status}`)}</strong>
            <button
              type="button"
              className="link-button"
              aria-expanded={open}
              aria-controls={`${id}-d`}
              onClick={() => setOpen((o) => !o)}
            >
              {t('htmlSecurity.detail')}
            </button>
          </p>
          <p className="help">
            {t(status === 'removed' ? 'htmlSecurity.removedBody' : 'htmlSecurity.safeBody')}
          </p>
          <ul id={`${id}-d`} className="hsec-list" aria-label={t('htmlSecurity.group')} hidden={!open}>
            {HTML_SECURITY_KEYS.filter((k) => k !== 'other' || (r.other ?? 0) > 0).map((k) => (
              <li key={k}>
                <span>{t(`htmlSecurity.c.${k}`, { count: r[k] ?? 0 })}</span>
                <span className="hsec-n">{r[k] ?? 0}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
