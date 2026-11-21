import type { ReactNode } from 'react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Vague B : carte « à venir » (docs/ux/specs/vague-b.md §1). Bordure pointillée, badge « Bientôt
 * disponible » neutre, liste de ce que fera la fonction, contrôle désactivé à l'endroit prévu, puis
 * l'encadré « Pourquoi et en attendant ». Jamais présentée comme active.
 */
export function SoonCard({
  k,
  icon,
  control,
  after,
  headingLevel = 2,
}: {
  /** Clé de la fonction dans soon.* (title, body, items, why). */
  k: string;
  icon: ReactNode;
  /** Contrôle désactivé (ou lien vers l'alternative active). */
  control?: ReactNode;
  /** Lien vers l'alternative disponible, sous l'encadré. */
  after?: ReactNode;
  headingLevel?: 2 | 3;
}) {
  const { t } = useTranslation();
  const id = useId();
  const items = t(`soon.${k}.items`, { returnObjects: true }) as unknown;
  const H = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <article className="soon-card" aria-labelledby={`${id}-t`}>
      <div className="soon-head">
        <span className="soon-chip" aria-hidden="true">
          {icon}
        </span>
        <H className="soon-title" id={`${id}-t`}>
          {t(`soon.${k}.title`)}
        </H>
        {/* Retours client 21/11 §5 : « Bientôt » en texte gris, sans pastille ni point */}
        <span className="soon-text soon-badge">{t('soon.badge')}</span>
      </div>
      <p className="soon-body">{t(`soon.${k}.body`)}</p>
      {Array.isArray(items) && (
        <ul className="soon-list">
          {items.map((it) => (
            <li key={String(it)}>{String(it)}</li>
          ))}
        </ul>
      )}
      {control}
      <p className="soon-why">
        <span className="sr-only">{t('soon.why')} : </span>
        {t(`soon.${k}.why`)}
        {after && <> {after}</>}
      </p>
    </article>
  );
}
