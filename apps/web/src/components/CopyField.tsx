/**
 * CopyField (FIELD-01 §11.3, retours client du 24/11 §4) : une valeur en lecture seule avec son bouton de
 * copie intégré, à droite dans le champ. Le clic dans le champ sélectionne tout ; après la copie, l'icône
 * devient une coche pendant 2 s et « copié » est annoncé (région polie, toujours présente).
 */
import { useEffect, useId, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

/** Durée de la confirmation de copie (ms). */
const COPIED_MS = 2000;

export function CopyField({
  id,
  label,
  value,
  copyLabel,
  copiedText,
  className,
}: {
  id?: string;
  /** Libellé du champ, masqué à l'œil (« Lien d'invitation pour … »). */
  label: string;
  value: string;
  /** Nom du bouton (« Copier le lien de … »). */
  copyLabel: string;
  /** Annonce après la copie (« Lien copié »). */
  copiedText: string;
  className?: string;
}) {
  const auto = useId();
  const fieldId = id ?? `${auto}-copy`;
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const input = useRef<HTMLInputElement>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Presse-papiers refusé (permission, page sans focus) : copie de la sélection du champ ; si elle
      // échoue aussi, le lien reste sélectionné, prêt pour Ctrl + C, et rien n'est annoncé
      input.current?.select();
      if (!document.execCommand('copy')) return;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
  };
  return (
    <div className={`fd-copy${className ? ` ${className}` : ''}`}>
      <div className="fd-copy__field" data-align-zone="">
        <label className="sr-only" htmlFor={fieldId}>
          {label}
        </label>
        <input
          id={fieldId}
          ref={input}
          className="fd-copy__input"
          readOnly
          value={value}
          onClick={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          className={`fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm fd-copy__btn${copied ? ' is-ok' : ''}`}
          aria-label={copyLabel}
          onClick={() => void copy()}
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </button>
      </div>
      <span className="fd-copy__ok" role="status">
        {copied ? copiedText : ''}
      </span>
    </div>
  );
}
