import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';
import { useCopied } from '../../components/useCopied';

/**
 * Bouton de copie d'une ligne : la confirmation se fait sur place (icône en coche pendant 2 s, « Copié »
 * annoncé par une région polie), jamais par un toast.
 */
export function CopyAction({
  text,
  label,
  title,
  className,
  icon,
  children,
}: {
  /** Texte à copier. */
  text: string;
  /** Nom accessible du bouton. */
  label: string;
  title?: string;
  className: string;
  /** Icône au repos (par défaut : Copier). */
  icon?: ReactNode;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const [copied, copy] = useCopied();
  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={label}
        title={title}
        onClick={() => void copy(text)}
      >
        {copied ? <Check aria-hidden="true" /> : (icon ?? <Copy aria-hidden="true" />)}
        {children}
      </button>
      <span className="sr-only" role="status">
        {copied ? t('common.copied') : ''}
      </span>
    </>
  );
}
