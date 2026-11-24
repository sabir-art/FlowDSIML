import { Box, Code, Image, Images, Map as MapIcon, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ContentType } from '@flowdsiml/core';
import './TypeBadge.css';

/** L48-G §2, EXT-02 §4.1 : icône Lucide de chaque type de contenu (image, code, map, video). */
export const TYPE_ICON = { captures: Image, html: Code, sandbox: MapIcon, video: Video } as const;

/** Retours client du 24/11 §5 : icônes des pastilles colorées des cartes Démos. */
const TONE_ICON = { captures: Images, html: Code, sandbox: Box, video: Video } as const;

/**
 * Badge de type (« Captures », « HTML », « Sandbox », « Vidéo ») : icône et libellé court. `cover` : posé
 * dans le coin haut gauche de la vignette d'une carte. Le nom complet est donné aux lecteurs d'écran.
 * `tone` : pastille colorée par type (cartes de la grille et colonne Type de la liste des démos), aux
 * jetons `--fd-type-*` ; sans `tone`, le badge neutre des menus et des listes.
 */
export function TypeBadge({
  type,
  cover = false,
  tone = false,
}: {
  type: ContentType;
  cover?: boolean;
  tone?: boolean;
}) {
  const { t } = useTranslation();
  const Icon = tone ? TONE_ICON[type] : TYPE_ICON[type];
  return (
    <span
      className={`ct-badge${cover ? ' ct-badge--cover' : ''}${tone ? ` ct-badge--tone ct-badge--${type}` : ''}`}
      title={t(`ctype.name.${type}`)}
    >
      <Icon aria-hidden="true" />
      <span aria-hidden="true">{t(tone ? `ctype.tone.${type}` : `ctype.short.${type}`)}</span>
      <span className="sr-only">{t(`ctype.name.${type}`)}</span>
    </span>
  );
}
