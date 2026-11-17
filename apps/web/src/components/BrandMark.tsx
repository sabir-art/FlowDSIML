import symbol from '../assets/dsi-symbole.svg';

/** Logo de l'app : symbole « circuit » de la DSI des Missions Locales + nom du produit. */
export function BrandMark({ size = 28, compact = false }: { size?: number; compact?: boolean }) {
  return (
    <span className={`brand-mark${compact ? ' brand-mark--compact' : ''}`}>
      <img src={symbol} alt="" width={size} height={size} className="brand-mark__symbol" />
      <span className="brand-mark__name">FlowDSIML</span>
    </span>
  );
}
