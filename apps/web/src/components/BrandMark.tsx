import { APP_NAME } from '@flowdsiml/core';
import logo from '../assets/logo-tutoclick-compact.svg';
import logoDark from '../assets/logo-tutoclick-compact-sombre.svg';

/**
 * Logo de l'app (LOGO-01 : TutoClick, version compacte claire ou sombre selon le thème, par fichier,
 * jamais par filtre CSS). Le logo complet (« Porté par la DSIML ») n'est utilisé que dans les documents et
 * les grands formats, à partir de 480 px de large de logo (audit L50 C2) : jamais dans l'app. En option,
 * une ligne de texte sous le logo.
 */
export function BrandMark({
  size = 36,
  subtitle,
}: {
  /** Hauteur du logo compact en pixels. */
  size?: number;
  /** Ligne secondaire sous le logo. */
  subtitle?: string;
}) {
  const width = Math.round((size * 742) / 204);
  const img = (src: string, cls: string, w: number, h: number) => (
    <img src={src} alt={APP_NAME} width={w} height={h} className={`brand-mark__logo ${cls}`} />
  );
  return (
    <span className="brand-mark">
      {img(logo, 'brand-mark__logo--light', width, size)}
      {img(logoDark, 'brand-mark__logo--dark', width, size)}
      {subtitle && <span className="brand-mark__sub">{subtitle}</span>}
    </span>
  );
}
