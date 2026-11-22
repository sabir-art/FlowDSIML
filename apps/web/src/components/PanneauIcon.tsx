/**
 * ICON-01 : icône maison « panneau » (bascule de la barre latérale et de la colonne Dossiers).
 * La même icône dans les deux états ; l'état est porté par `aria-pressed` ou `aria-expanded`.
 */
export function PanneauIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="lucide lucide-panneau"
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="4" />
      <path d="M9.5 3v18" />
      <path d="M6.25 8h.01M6.25 12h.01M6.25 16h.01" />
    </svg>
  );
}
