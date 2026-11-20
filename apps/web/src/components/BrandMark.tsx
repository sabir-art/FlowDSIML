import { APP_NAME } from '@flowdsiml/core';
import logo from '../assets/logo-tutoclick-compact.svg';
import logoDark from '../assets/logo-tutoclick-compact-sombre.svg';
import full from '../assets/logo-tutoclick.svg';
import fullDark from '../assets/logo-tutoclick-sombre.svg';

/**
 * Logo de l'app (LOGO-01 : TutoClick, version compacte claire ou sombre selon le thème, par fichier,
 * jamais par filtre CSS). `full` : logo complet avec « Porté par la DSIML », seulement à partir de
 * 480 px de large (en dessous, la version compacte). En option, une ligne de texte sous le logo.
 */
export function BrandMark({
  size = 36,
  subtitle,
  full: withFull = false,
}: {
  /** Hauteur du logo compact en pixels. */
  size?: number;
  /** Ligne secondaire sous le logo. */
  subtitle?: string;
  /** Logo complet (connexion sur grand écran). */
  full?: boolean;
}) {
  const width = Math.round((size * 742) / 204);
  const fullH = Math.round(size * 1.6);
  const fullW = Math.round((fullH * 803.5) / 260);
  const img = (src: string, cls: string, w: number, h: number) => (
    <img src={src} alt={APP_NAME} width={w} height={h} className={`brand-mark__logo ${cls}`} />
  );
  return (
    <span className={`brand-mark${withFull ? ' brand-mark--full' : ''}`}>
      {img(logo, 'brand-mark__logo--light brand-mark__compact', width, size)}
      {img(logoDark, 'brand-mark__logo--dark brand-mark__compact', width, size)}
      {withFull && img(full, 'brand-mark__logo--light brand-mark__wide', fullW, fullH)}
      {withFull && img(fullDark, 'brand-mark__logo--dark brand-mark__wide', fullW, fullH)}
      {subtitle && <span className="brand-mark__sub">{subtitle}</span>}
    </span>
  );
}
