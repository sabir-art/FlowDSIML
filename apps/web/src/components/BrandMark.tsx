import { APP_NAME } from '@flowdsiml/core';
import logo from '../assets/logo-tutoclick-compact.svg';
import logoDark from '../assets/logo-tutoclick-compact-sombre.svg';
import logoFull from '../assets/logo-tutoclick.svg';
import logoFullDark from '../assets/logo-tutoclick-sombre.svg';

/** Proportions du logo complet du client (viewBox 803,5 × 260). */
const FULL_RATIO = 260 / 803.5;
/** Nom accessible du logo complet : la signature est lue même là où elle est trop petite pour l'œil. */
export const FULL_ALT = `${APP_NAME}, porté par la DSIML`;

/**
 * Logo de l'app (LOGO-01, composants.md §16 et §16.5, décision client du 21/11).
 * - `full` : logo complet du client, tel quel (SVG avec la signature « Porté par la DSIML » et les
 *   cinq points), jamais recomposé en HTML ni complété par un sous-titre en texte. `width` en pixels :
 *   224 dans la barre latérale dépliée, 400 au moins ailleurs (connexion, inscription, onboarding).
 * - sinon : logo compact (sans la signature), `size` = hauteur en pixels.
 * Le thème choisit le fichier (versions « -sombre »), jamais un filtre CSS.
 */
export function BrandMark({
  size = 36,
  full = false,
  width = 224,
}: {
  /** Hauteur du logo compact en pixels. */
  size?: number;
  /** Logo complet du client (avec la signature). */
  full?: boolean;
  /** Largeur du logo complet en pixels. */
  width?: number;
}) {
  const img = (src: string, cls: string, w: number, h: number, alt: string) => (
    <img src={src} alt={alt} width={w} height={h} className={`brand-mark__logo ${cls}`} />
  );
  if (full) {
    const h = Math.round(width * FULL_RATIO);
    return (
      <span className="brand-mark brand-mark--full" /* §18.6 : logo, un seul bloc */ data-gap-exempt="">
        {img(logoFull, 'brand-mark__logo--light', width, h, FULL_ALT)}
        {img(logoFullDark, 'brand-mark__logo--dark', width, h, FULL_ALT)}
      </span>
    );
  }
  const w = Math.round((size * 742) / 204);
  return (
    <span className="brand-mark" /* §18.6 : logo, un seul bloc */ data-gap-exempt="">
      {img(logo, 'brand-mark__logo--light', w, size, APP_NAME)}
      {img(logoDark, 'brand-mark__logo--dark', w, size, APP_NAME)}
    </span>
  );
}
