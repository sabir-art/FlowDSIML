import { useEffect, useRef, useState } from 'preact/hooks';
import { Info, ShieldCheck, X } from 'lucide-preact';
import type { Dict } from './i18n';
import { gpcEnabled, measureRefused, setMeasureRefused } from './visitor';

const ICON = { size: 18, strokeWidth: 2, 'aria-hidden': true } as const;

/**
 * L26-08 : informations du lecteur. « Ne pas mesurer mes visites » supprime l'identifiant de visiteur
 * et garde un drapeau de refus ; le signal Global Privacy Control est respecté de la même façon.
 */
export function InfoDialog({
  t,
  privacyUrl,
  onClose,
}: {
  t: Dict;
  privacyUrl?: string | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const gpc = gpcEnabled();
  const [refused, setRefused] = useState(measureRefused());
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const toggle = () => {
    setMeasureRefused(!refused);
    setRefused(!refused);
    setSaved(true);
  };
  return (
    <dialog
      ref={ref}
      class="p-gloss-drawer p-info-dialog"
      aria-labelledby="p-info-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      <div class="p-gloss-inner">
        <header>
          <Info {...ICON} size={20} />
          <h2 id="p-info-title">{t.infoTitle}</h2>
          <button class="p-icon-btn" aria-label={t.infoClose} onClick={() => ref.current?.close()}>
            <X {...ICON} />
          </button>
        </header>
        <section class="p-info-sec" aria-labelledby="p-measure-title">
          <h3 id="p-measure-title">
            <ShieldCheck {...ICON} size={16} />
            {t.measureTitle}
          </h3>
          <p>{gpc ? t.measureGpc : refused ? t.measureOff : t.measureOn}</p>
          {!gpc && (
            <button class="p-btn p-btn-ghost p-btn-sm" onClick={toggle}>
              {refused ? t.measureAccept : t.measureRefuse}
            </button>
          )}
          <p class="p-info-saved" role="status">
            {saved ? t.measureSaved : ''}
          </p>
          {privacyUrl && (
            <a href={privacyUrl} target="_blank" rel="noopener noreferrer">
              {t.privacy}
            </a>
          )}
        </section>
      </div>
    </dialog>
  );
}
