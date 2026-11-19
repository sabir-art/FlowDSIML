/** Blocs de code d'intégration : coloration minimale et bouton de copie (Partager, Diffuser). */
import { Copy } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/** Bouton de copie avec retour « Copié » (annoncé). `onCopied` : L16, diffusion enregistrée. */
export function CopyButton({
  value,
  label,
  primary,
  onCopied,
}: {
  value: string;
  label?: string;
  primary?: boolean;
  onCopied?: () => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={`btn ${primary ? 'btn-primary' : 'btn-secondary'}`}
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        setCopied(true);
        onCopied?.();
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      <Copy aria-hidden="true" />
      <span aria-live="polite">{copied ? t('common.copied') : (label ?? t('common.copy'))}</span>
    </button>
  );
}

/** Coloration du code d'intégration comme la maquette : noms de balise (.k) et URL src (.s). */
export function highlightHtml(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(<\/?)([a-z]+)|(src=")([^"]*)(")/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    out.push(code.slice(last, m.index));
    if (m[2]) {
      out.push(
        m[1],
        <span key={m.index} className="k">
          {m[2]}
        </span>,
      );
    } else {
      out.push(
        m[3],
        <span key={m.index} className="s">
          {m[4]}
        </span>,
        m[5],
      );
    }
    last = re.lastIndex;
  }
  out.push(code.slice(last));
  return out;
}
