import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import { EXTLINK_RE, isExternalLink } from '@flowdsiml/core';
import { Switch } from '@flowdsiml/ui';
import type { DemoEditor } from '../useDemoEditor';
import type { StepRow } from '../types';
import { opOn, removeOp, upsertOp } from './htmlModel';
import { stepSecurity } from './HtmlSecurity';

interface MetaLink {
  sel: string;
  href: string;
  label?: string;
}

/**
 * Liens de la page vers un autre domaine (L49 §4), d'après les liens repérés à la capture, et liens
 * signalés par Google Safe Browsing même internes (L49 §4.1).
 */
export function externalLinks(step: Pick<StepRow, 'html_meta'>): MetaLink[] {
  const meta = (step.html_meta ?? {}) as { url?: string; links?: MetaLink[] };
  const blocked = new Set(stepSecurity(step)?.blocked ?? []);
  const seen = new Set<string>();
  return (meta.links ?? []).filter((l) => {
    if (!l?.sel || !l.href || seen.has(l.sel)) return false;
    if (!isExternalLink(l.href, meta.url) && !blocked.has(l.href)) return false;
    seen.add(l.sel);
    return true;
  });
}

/**
 * L49 §4 : « Liens externes · n ». Désactivés par défaut (serveur) ; un lien https peut être autorisé
 * (opération extlink, sur cette étape) ; une autre adresse reste désactivée avec sa raison.
 */
export function ExternalLinks({
  editor,
  step,
  readOnly,
}: {
  editor: DemoEditor;
  step: StepRow;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const links = externalLinks(step);
  if (!links.length) return null;
  const report = stepSecurity(step);
  const blocked = new Set(report?.blocked ?? []);
  const gsbDown = report?.safeBrowsing === 'unavailable';
  return (
    <div className="sec xlinks">
      <div className="sec-title">{t('extLinks.title', { count: links.length })}</div>
      <ul className="xlinks-list">
        {links.map((l) => {
          const text = (l.label ?? '').trim() || t('extLinks.untitled');
          const op = opOn(step, l.sel, 'extlink');
          const secure = EXTLINK_RE.test(l.href) && l.href.length <= 2000;
          return (
            <li key={l.sel}>
              <div className="xlinks-text">
                <b>{text}</b>
                <code>{l.href}</code>
              </div>
              {blocked.has(l.href) ? (
                // L49 §4.1 : interrupteur retiré (pas grisé), texte danger sans badge ni fond
                <span className="xlinks-blocked">
                  <ShieldAlert size={16} aria-hidden="true" />
                  {t('extLinks.blocked')}
                </span>
              ) : !secure ? (
                <span className="xlinks-reason">{t('extLinks.insecure')}</span>
              ) : gsbDown && !op ? (
                // Nouveau lien : autorisation refusée tant que la vérification n'a pas répondu
                <span className="xlinks-reason">{t('extLinks.gsbRetry')}</span>
              ) : (
                <Switch
                  className="xlinks-switch"
                  label={op ? t('extLinks.on') : t('extLinks.off')}
                  aria-label={t('extLinks.allow', { text })}
                  checked={!!op}
                  disabled={readOnly}
                  onChange={() =>
                    op
                      ? removeOp(editor, step, op.id)
                      : upsertOp(editor, step, { sel: l.sel, op: 'extlink', value: l.href }, 'step')
                  }
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
