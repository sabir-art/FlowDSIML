import { APP_NAME } from '@flowdsiml/core';
import logo from '../assets/logo-tutoclick-compact.svg';
import logoDark from '../assets/logo-tutoclick-compact-sombre.svg';

/**
 * Logo de l'app (TutoClick, version compacte claire ou sombre selon le thème) et, en option,
 * la mention « DSI des Missions Locales » en texte sous le logo.
 */
export function BrandMark({
  size = 36,
  subtitle,
}: {
  /** Hauteur du logo en pixels. */
  size?: number;
  /** Ligne secondaire (« DSI des Missions Locales »). */
  subtitle?: string;
}) {
  const width = Math.round((size * 696) / 220);
  return (
    <span className="brand-mark">
      <img
        src={logo}
        alt={APP_NAME}
        width={width}
        height={size}
        className="brand-mark__logo brand-mark__logo--light"
      />
      <img
        src={logoDark}
        alt={APP_NAME}
        width={width}
        height={size}
        className="brand-mark__logo brand-mark__logo--dark"
      />
      {subtitle && <span className="brand-mark__sub">{subtitle}</span>}
    </span>
  );
}
