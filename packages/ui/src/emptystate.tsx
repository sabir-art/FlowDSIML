import type { ReactNode } from 'react';
import './emptystate.css';

/**
 * EMPTY-01 : état vide unique de l'app. L'action qui crée le premier élément est dans l'en-tête de la
 * page, jamais ici : `action` ne sert qu'à autre chose (« Voir un exemple », « Effacer les filtres »).
 *  - premier usage : `preview`, un aperçu atténué du résultat (décoratif : aria-hidden, inerte), posé
 *    sur un socle en léger dégradé, puis un titre et une phrase ;
 *  - aucun résultat : `icon` (Lucide, 20 px), sans aperçu ;
 *  - vide dans un panneau : `size="compact"`, une ligne de texte gris, sans aperçu ni bouton.
 */
export function EmptyState({
  preview,
  icon,
  title,
  body,
  action,
  size = 'page',
  level = 2,
  live = false,
  className = '',
}: {
  preview?: ReactNode;
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  size?: 'page' | 'compact';
  level?: 2 | 3;
  /** Annoncé quand il apparaît (résultat d'une recherche, d'un filtre). */
  live?: boolean;
  className?: string;
}) {
  const H = level === 3 ? 'h3' : 'h2';
  if (size === 'compact')
    return (
      <p className={`fd-es fd-es--compact ${className}`.trim()} role={live ? 'status' : undefined}>
        {title}
      </p>
    );
  return (
    <div className={`fd-es ${className}`.trim()} role={live ? 'status' : undefined}>
      {preview ? (
        // inert : rien n'y est focalisable ni cliquable, même si l'aperçu réutilise de vrais composants
        // data-gap-exempt : maquette réduite, ses écarts ne sont pas ceux de l'interface (§18.6)
        <div className="fd-es__base" aria-hidden="true" inert data-gap-exempt="">
          <div className="fd-es__preview">{preview}</div>
        </div>
      ) : (
        icon && (
          <span className="fd-es__icon" aria-hidden="true">
            {icon}
          </span>
        )
      )}
      <H className="fd-es__title">{title}</H>
      {body && <p className="fd-es__body">{body}</p>}
      {action && <div className="fd-es__action">{action}</div>}
    </div>
  );
}
