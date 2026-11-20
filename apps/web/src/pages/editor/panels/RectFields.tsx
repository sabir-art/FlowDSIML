import { useTranslation } from 'react-i18next';

type Rect = { x: number; y: number; w: number; h: number };

const KEYS = ['x', 'y', 'w', 'h'] as const;
const MIN = 0.01;

/** Zone ajustée pour rester dans la capture (0 à 100 %), taille minimale 1 %. */
export function clampRect(r: Rect): Rect {
  const w = Math.min(1, Math.max(MIN, r.w));
  const h = Math.min(1, Math.max(MIN, r.h));
  return { x: Math.min(1 - w, Math.max(0, r.x)), y: Math.min(1 - h, Math.max(0, r.y)), w, h };
}

/**
 * L34 (WCAG 2.5.7) : position et taille d'une zone en pourcentage de la capture, alternative au glisser sur le
 * canevas (un clic sur les flèches du champ ou une saisie suffit).
 */
export function RectFields({
  id,
  rect,
  disabled,
  onChange,
}: {
  id: string;
  rect: Rect;
  disabled?: boolean;
  onChange: (r: Rect) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="sec">
      <div className="sec-title" id={`${id}-t`}>
        {t('editor.rect.title')}
      </div>
      <div className="zoom-pos" role="group" aria-labelledby={`${id}-t`}>
        {KEYS.map((k) => (
          <div key={k} className="field">
            <label htmlFor={`${id}-${k}`}>{t(`editor.rect.${k}`)}</label>
            <div className="input-affix-r">
              <input
                id={`${id}-${k}`}
                className="input input-sm"
                type="number"
                min={k === 'w' || k === 'h' ? 1 : 0}
                max={100}
                step={1}
                disabled={disabled}
                value={Math.round(rect[k] * 1000) / 10}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isFinite(v)) return;
                  onChange(clampRect({ ...rect, [k]: v / 100 }));
                }}
              />
              <span aria-hidden="true">%</span>
            </div>
          </div>
        ))}
      </div>
      <p className="help">{t('editor.rect.help')}</p>
    </div>
  );
}
