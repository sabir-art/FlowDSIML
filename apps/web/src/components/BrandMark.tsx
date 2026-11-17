import symbol from '../assets/dsi-symbole.svg';

/** Logo de l'app : symbole « circuit » de la DSI des Missions Locales + nom du produit. */
export function BrandMark({
  size = 28,
  compact = false,
  subtitle,
}: {
  size?: number;
  compact?: boolean;
  /** Ligne secondaire (« DSI des Missions Locales »). */
  subtitle?: string;
}) {
  return (
    <span className={`brand-mark${compact ? ' brand-mark--compact' : ''}`}>
      <img src={symbol} alt="" width={size} height={size} className="brand-mark__symbol" />
      <span className="brand-mark__text">
        <span className="brand-mark__name">FlowDSIML</span>
        {subtitle && <span className="brand-mark__sub">{subtitle}</span>}
      </span>
    </span>
  );
}
