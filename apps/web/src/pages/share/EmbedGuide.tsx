import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Info } from 'lucide-react';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../auth/AuthProvider';
import { highlightHtml } from './codeBlock';
import { STEP_COUNT, TARGETS, addressOnly, hasLimit, readTarget, writeTarget, type Target } from './snippets';

/** Outil choisi, mémorisé par utilisateur. */
export function useEmbedTarget(): [Target, (t: Target) => void] {
  const { user } = useAuth();
  const [target, setTarget] = useState<Target>(() => readTarget(user?.id));
  return [
    target,
    (t) => {
      setTarget(t);
      writeTarget(user?.id, t);
    },
  ];
}

/** L29-01 : sélecteur « Où intégrer ? » (radiogroup, flèches gauche et droite). */
export function TargetPicker({ value, onChange }: { value: Target; onChange: (t: Target) => void }) {
  const { t } = useTranslation();
  const id = useId();
  const move = (from: Target, d: number) => {
    const i = TARGETS.indexOf(from);
    const next = TARGETS[(i + d + TARGETS.length) % TARGETS.length]!;
    onChange(next);
    document.getElementById(`${id}-${next}`)?.focus();
  };
  return (
    <div className="snip-where">
      <span className="t-label" id={`${id}-l`}>
        {t('snippets.where')}
      </span>
      <div className="segmented" role="radiogroup" aria-labelledby={`${id}-l`}>
        {TARGETS.map((x) => (
          <button
            key={x}
            id={`${id}-${x}`}
            type="button"
            role="radio"
            aria-checked={value === x}
            tabIndex={value === x ? 0 : -1}
            onClick={() => onChange(x)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                move(x, e.key === 'ArrowRight' ? 1 : -1);
              }
            }}
          >
            {t(`snippets.${x}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * L29-01 / L29-02 : code (ou adresse) à copier pour l'outil, consignes numérotées et limite connue.
 * `limitId` relie l'aide au choix « Bouton + pop-up » désactivé.
 */
export function TargetGuide({
  target,
  code,
  address,
  published,
  limitId,
  playerHost,
  onScorm,
  codeless,
}: {
  target: Target;
  code: string;
  address: string;
  published: boolean;
  limitId: string;
  playerHost: string;
  onScorm?: () => void;
  /** Diffuser > Intranet : le bloc de code et sa copie restent ceux du panneau (diffusion enregistrée) */
  codeless?: boolean;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const id = useId();
  const onlyAddress = addressOnly(target);
  const value = onlyAddress ? address : code;
  const tool = t(`snippets.${target}`);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast(onlyAddress ? t('snippets.addressCopied') : t('snippets.codeCopied'));
    } catch {
      toast(t('distribute.copyFailed'));
    }
  };
  return (
    <div className="snip-guide">
      {!codeless && (
        <>
          <span className="t-label" id={`${id}-code`}>
            {onlyAddress ? t('snippets.addressLabel') : t('snippets.codeLabel')}
          </span>
          <pre className="code sh-code" aria-labelledby={`${id}-code`} tabIndex={0}>
            {onlyAddress ? value : highlightHtml(value)}
          </pre>
          <div className="row sh-embed-actions">
            <button
              type="button"
              className="btn btn-primary"
              aria-disabled={!published || undefined}
              onClick={() => published && void copy()}
            >
              <Copy aria-hidden="true" />
              {onlyAddress ? t('snippets.copyAddress') : t('snippets.copyCode')}
            </button>
          </div>
        </>
      )}
      <span className="t-label" id={`${id}-steps`}>
        {t('snippets.stepsLabel', { tool })}
      </span>
      <ol className="snip-steps" aria-labelledby={`${id}-steps`}>
        {Array.from({ length: STEP_COUNT[target] }, (_, i) => (
          <li key={i}>{t(`snippets.${target}_${i + 1}`)}</li>
        ))}
      </ol>
      {hasLimit(target) && (
        <p className="alert snip-limit" id={limitId}>
          <Info aria-hidden="true" />
          <span className="t-caption">
            {t(`snippets.limit_${target}`, { host: playerHost })}
            {target === 'moodle' && onScorm && (
              <>
                {' '}
                <button type="button" className="mk-link-inline" onClick={onScorm}>
                  {t('snippets.openScorm')}
                </button>
              </>
            )}
          </span>
        </p>
      )}
    </div>
  );
}
