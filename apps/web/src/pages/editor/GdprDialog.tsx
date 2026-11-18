import { EyeOff, MessageSquareLock, Shield, TriangleAlert } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Button } from '@flowdsiml/ui';
import type { StepRow } from './types';

/** Bilan RGPD d'une démo (même calcul que publish_demo côté serveur). Pur, testé. */
export function gdprSummary(steps: Pick<StepRow, 'blurs' | 'element_meta'>[]) {
  let blurred = 0;
  let pending = 0;
  const pendingSteps: number[] = [];
  steps.forEach((s, i) => {
    if (Array.isArray(s.blurs)) blurred += s.blurs.length;
    const pii = (s.element_meta as { pii?: Array<{ blurred?: boolean }> } | null)?.pii;
    if (!Array.isArray(pii)) return;
    const off = pii.filter((p) => !p.blurred).length;
    blurred += pii.length - off;
    if (off) {
      pending += off;
      pendingSteps.push(i + 1);
    }
  });
  return { blurred, pending, pendingSteps };
}

export type GdprAck = { reviewed: true; fictional: true };

/**
 * Avertissement avant publication publique (spec f1-formation §2) : bilan, deux cases obligatoires,
 * confirmation demandée à chaque publication (pas de « ne plus afficher »). Si les liens publics
 * sont désactivés pour le workspace, la modale l'explique au lieu de proposer la publication.
 */
export function GdprDialog({
  open,
  steps,
  publicEnabled,
  onConfirm,
  onReview,
  onSettings,
  onRestrict,
  onClose,
  branchWarnings = [],
}: {
  open: boolean;
  steps: Pick<StepRow, 'blurs' | 'element_meta'>[];
  publicEnabled: boolean;
  onConfirm: (ack: GdprAck) => void;
  onReview: (stepIndex: number) => void;
  onSettings: () => void;
  /** RP-2 : ouvre l'onglet Accès du partage. */
  onRestrict: () => void;
  onClose: () => void;
  /** L22-09 : avertissements de branchement (non bloquants), rappelés avant publication. */
  branchWarnings?: string[];
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const [reviewed, setReviewed] = useState(false);
  const [fictional, setFictional] = useState(false);
  const id = useId();
  const sum = gdprSummary(steps);
  const ready = reviewed && fictional;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setReviewed(false);
      setFictional(false);
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="dialog gdpr-dialog" onClose={onClose} aria-labelledby={`${id}-t`}>
      <div className="gdpr-head">
        <span className="gdpr-chip" aria-hidden="true">
          <Shield />
        </span>
        <h2 id={`${id}-t`}>{publicEnabled ? t('editor.gdpr.title') : t('editor.gdpr.disabledTitle')}</h2>
      </div>
      {!publicEnabled ? (
        <>
          <div className="dialog-body">
            <p>{t('editor.gdpr.disabledBody')}</p>
          </div>
          <div className="dialog-actions">
            <Button onClick={onClose}>{t('editor.gdpr.close')}</Button>
            <Button variant="primary" onClick={onSettings}>
              {t('editor.gdpr.openSettings')}
            </Button>
          </div>
        </>
      ) : (
        <form
          method="dialog"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) onConfirm({ reviewed: true, fictional: true });
          }}
        >
          <div className="dialog-body stack">
            <p>{t('editor.gdpr.body')}</p>
            <ul className="gdpr-summary">
              <li>
                <EyeOff aria-hidden="true" />
                {t('editor.gdpr.blurred', { count: sum.blurred })}
              </li>
              <li className={sum.pending ? 'is-warning' : undefined}>
                <TriangleAlert aria-hidden="true" />
                {sum.pending ? (
                  <span>
                    <Trans
                      i18nKey="editor.gdpr.pending"
                      count={sum.pending}
                      values={{ count: sum.pending, steps: sum.pendingSteps.join(', ') }}
                      components={{ strong: <strong /> }}
                    />
                  </span>
                ) : (
                  t('editor.gdpr.none')
                )}
              </li>
              {branchWarnings.length > 0 && (
                <li className="is-warning">
                  <TriangleAlert aria-hidden="true" />
                  <span>
                    {t('editor.branch.publishWarn')} {branchWarnings.join(' ')}
                  </span>
                </li>
              )}
              <li>
                <MessageSquareLock aria-hidden="true" />
                {t('editor.gdpr.commentsNote')}
              </li>
            </ul>
            <p className="gdpr-restrict">
              <Trans
                i18nKey="editor.gdpr.restrict"
                components={{
                  a: <button type="button" className="mk-link-inline" onClick={onRestrict} />,
                  b: <button type="button" className="mk-link-inline" onClick={onRestrict} />,
                  c: <button type="button" className="mk-link-inline" onClick={onRestrict} />,
                }}
              />
            </p>
            <label className="gdpr-check">
              <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />
              <span>{t('editor.gdpr.checkReviewed')}</span>
            </label>
            <label className="gdpr-check">
              <input type="checkbox" checked={fictional} onChange={(e) => setFictional(e.target.checked)} />
              <span>{t('editor.gdpr.checkFictional')}</span>
            </label>
          </div>
          <div className="dialog-actions">
            {sum.pendingSteps.length > 0 && (
              <Button type="button" variant="ghost" onClick={() => onReview(sum.pendingSteps[0]! - 1)}>
                {t('editor.gdpr.review', { n: sum.pendingSteps[0] })}
              </Button>
            )}
            <Button type="button" onClick={onClose}>
              {t('editor.gdpr.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!ready}
              aria-describedby={ready ? undefined : `${id}-why`}
            >
              {t('editor.gdpr.publish')}
            </Button>
          </div>
          {/* RP-3 : aide sous les boutons, alignée à droite */}
          {!ready && (
            <p id={`${id}-why`} className="fd-help gdpr-why">
              {t('editor.gdpr.why')}
            </p>
          )}
        </form>
      )}
    </dialog>
  );
}
