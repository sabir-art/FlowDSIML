import { Code, Image, Map as MapIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ContentType } from '@flowdsiml/core';
import './TypeBadge.css';

/** L48-G §2 : icône Lucide de chaque type de contenu (image, code, map). */
export const TYPE_ICON = { captures: Image, html: Code, sandbox: MapIcon } as const;

/**
 * Badge de type (« Captures », « HTML », « Sandbox ») : icône de 13 px et libellé court. `cover` : posé
 * dans le coin haut gauche de la vignette d'une carte. Le nom complet est donné aux lecteurs d'écran.
 */
export function TypeBadge({ type, cover = false }: { type: ContentType; cover?: boolean }) {
  const { t } = useTranslation();
  const Icon = TYPE_ICON[type];
  return (
    <span className={`ct-badge${cover ? ' ct-badge--cover' : ''}`} title={t(`ctype.name.${type}`)}>
      <Icon aria-hidden="true" />
      <span aria-hidden="true">{t(`ctype.short.${type}`)}</span>
      <span className="sr-only">{t(`ctype.name.${type}`)}</span>
    </span>
  );
}
