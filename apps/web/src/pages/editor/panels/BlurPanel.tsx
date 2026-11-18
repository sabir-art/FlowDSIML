import { useEffect, useState } from 'react';
import { ChevronLeft, Info, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DemoEditor } from '../useDemoEditor';
import { asMasks, type MaskRect, type Selection, type StepRow } from '../types';

type Style = NonNullable<MaskRect['style']>;
const SWATCHES = [
  { key: 'slate', color: '#2A2F3A' },
  { key: 'light', color: '#E3E6EC' },
  { key: 'white', color: '#FFFFFF' },
] as const;
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Couleur moyenne d'une bande de quelques pixels autour de la zone (masque discret). */
async function detectColor(url: string, m: MaskRect): Promise<string | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const pad = 6;
    const x0 = Math.max(0, Math.floor(m.x * c.width) - pad);
    const y0 = Math.max(0, Math.floor(m.y * c.height) - pad);
    const x1 = Math.min(c.width, Math.ceil((m.x + m.w) * c.width) + pad);
    const y1 = Math.min(c.height, Math.ceil((m.y + m.h) * c.height) + pad);
    const d = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    const w = x1 - x0;
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const px = (i / 4) % w;
      const py = Math.floor(i / 4 / w);
      // Seulement la bande extérieure
      if (px >= pad && px < w - pad && py >= pad && py < y1 - y0 - pad) continue;
      r += d[i]!;
      g += d[i + 1]!;
      b += d[i + 2]!;
      n++;
    }
    if (!n) return null;
    const hex = (v: number) =>
      Math.round(v / n)
        .toString(16)
        .padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
  } catch {
    return null;
  }
}

/**
 * EDT-07 + L12-01 : panneau de la zone sélectionnée. Flou, Pixels ou Aplat (couleur pleine, texte
 * facultatif) ; « Appliquer à » copie la zone sur toutes les étapes à la même position (une seule
 * annulation). Le masque est incrusté dans l'image à la publication.
 */
export function BlurPanel({
  editor,
  step,
  index,
  readOnly,
  setSelection,
}: {
  editor: DemoEditor;
  step: StepRow;
  index: number;
  readOnly: boolean;
  setSelection: (s: Selection) => void;
}) {
  const { t } = useTranslation();
  const masks = asMasks(step.blurs);
  const m = masks[index];
  const [detected, setDetected] = useState<string | null>(null);
  const [hex, setHex] = useState(m?.color ?? '#2A2F3A');
  const url = step.image_path ? editor.imageUrls[step.image_path] : undefined;

  useEffect(() => setHex(m?.color ?? '#2A2F3A'), [m?.color]);
  useEffect(() => {
    if (!m || m.style !== 'solid' || !url) return;
    let alive = true;
    void detectColor(url, m).then((c) => alive && setDetected(c));
    return () => {
      alive = false;
    };
    // Recalcul quand la zone bouge
  }, [url, m?.style, m?.x, m?.y, m?.w, m?.h]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!m) return null;
  const style: Style = m.style ?? 'blur';
  const grouped =
    !!m.group &&
    editor.steps.some((s) => s.id !== step.id && asMasks(s.blurs).some((x) => x.group === m.group));

  /** Modifie la zone ; si elle est copiée sur toutes les étapes, ses copies suivent (une annulation). */
  const patch = (p: Partial<MaskRect>) =>
    editor.batch(() => {
      for (const s of editor.steps) {
        const list = asMasks(s.blurs);
        const isThis = s.id === step.id;
        if (!isThis && !(m.group && list.some((x) => x.group === m.group))) continue;
        const next = list.map((x, i) =>
          (isThis && i === index) || (!isThis && m.group && x.group === m.group) ? { ...x, ...p } : x,
        );
        editor.updateStep(s.id, { blurs: next });
      }
    });

  const setScope = (all: boolean) =>
    editor.batch(() => {
      if (all) {
        const group = m.group ?? `g${Date.now().toString(36)}`;
        const copy: MaskRect = { ...m, group };
        editor.updateStep(step.id, { blurs: masks.map((x, i) => (i === index ? copy : x)) });
        for (const s of editor.steps) {
          if (s.id === step.id || s.kind !== 'image') continue;
          const list = asMasks(s.blurs);
          if (!list.some((x) => x.group === group)) editor.updateStep(s.id, { blurs: [...list, copy] });
        }
      } else if (m.group) {
        for (const s of editor.steps) {
          if (s.id === step.id) continue;
          const list = asMasks(s.blurs);
          if (list.some((x) => x.group === m.group))
            editor.updateStep(s.id, { blurs: list.filter((x) => x.group !== m.group) });
        }
        editor.updateStep(step.id, {
          blurs: masks.map((x, i) => (i === index ? { ...x, group: undefined } : x)),
        });
      }
    });

  const styles: Style[] = ['blur', 'pixels', 'solid'];
  return (
    <div className="hs-panel blur-panel">
      <div className="hs-head">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelection({ kind: 'step' })}>
          <ChevronLeft aria-hidden="true" />
          {t('editor.backToStep')}
        </button>
        <span className="t-label">{t('editor.blurN', { n: index + 1 })}</span>
        <span className="hs-head__sp" />
      </div>

      <div className="sec">
        <div className="sec-title">
          {style === 'solid' ? t('editor.blur.maskTitle') : t('editor.blur.title')}
          {!readOnly && (
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon"
              aria-label={t('editor.deleteBlur')}
              title={t('editor.deleteBlur')}
              onClick={() => {
                editor.updateStep(step.id, { blurs: masks.filter((_, i) => i !== index) });
                setSelection({ kind: 'step' });
              }}
            >
              <Trash2 aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="segmented blur-styles" role="radiogroup" aria-label={t('editor.blur.style')}>
          {styles.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={style === s}
              disabled={readOnly}
              onClick={() => patch({ style: s })}
            >
              {t(`editor.blur.${s === 'solid' ? 'solid' : s === 'pixels' ? 'pixels' : 'blur'}`)}
            </button>
          ))}
        </div>
        <p className="help blur-help">{t(`editor.blur.help_${style}`)}</p>

        {style === 'solid' && (
          <>
            <div className="field blur-field">
              <span className="label" id="mk-l">
                {t('editor.blur.color')}
              </span>
              <div className="swatches" role="group" aria-labelledby="mk-l">
                {SWATCHES.map((sw) => (
                  <button
                    key={sw.key}
                    type="button"
                    aria-label={t(`editor.blur.sw.${sw.key}`)}
                    aria-pressed={(m.color ?? '#2A2F3A').toUpperCase() === sw.color}
                    disabled={readOnly}
                    style={{ background: sw.color }}
                    onClick={() => patch({ color: sw.color })}
                  />
                ))}
                <button
                  type="button"
                  aria-label={t('editor.blur.sw.detected')}
                  aria-pressed={!!detected && (m.color ?? '').toUpperCase() === detected}
                  disabled={readOnly || !detected}
                  className="sw-detected"
                  style={detected ? { background: detected } : undefined}
                  onClick={() => detected && patch({ color: detected })}
                />
              </div>
              <div className="color-row">
                <span
                  className="swatch"
                  style={{ background: HEX.test(hex) ? hex : m.color }}
                  aria-hidden="true"
                />
                <input
                  className="input input-sm t-mono"
                  value={hex}
                  maxLength={7}
                  disabled={readOnly}
                  aria-label={t('editor.blur.hex')}
                  onChange={(e) => {
                    setHex(e.target.value);
                    if (HEX.test(e.target.value)) patch({ color: e.target.value.toUpperCase() });
                  }}
                />
              </div>
              <span className="help">{t('editor.blur.detectedHelp')}</span>
            </div>
            <div className="field blur-field">
              <label htmlFor="mk-t">
                {t('editor.blur.text')} <span className="opt">{t('editor.hs.optional')}</span>
              </label>
              <input
                id="mk-t"
                className="input input-sm"
                maxLength={60}
                disabled={readOnly}
                value={m.text ?? ''}
                placeholder={t('editor.blur.textPlaceholder')}
                onChange={(e) => patch({ text: e.target.value })}
              />
            </div>
          </>
        )}
      </div>

      <div className="sec">
        <div className="sec-title">{t('editor.blur.applyTo')}</div>
        <div role="radiogroup" aria-label={t('editor.blur.applyTo')} className="blur-scope">
          <label className="check">
            <input
              type="radio"
              name="mscope"
              checked={!grouped}
              disabled={readOnly}
              onChange={() => setScope(false)}
            />
            {t('editor.blur.thisStep')}
          </label>
          <label className="check">
            <input
              type="radio"
              name="mscope"
              checked={grouped}
              disabled={readOnly}
              onChange={() => setScope(true)}
            />
            {t('editor.blur.allStepsSame')}
          </label>
        </div>
      </div>
      <div className="alert alert-info blur-info">
        <Info aria-hidden="true" />
        <span className="t-caption">{t('editor.blur.burnInfo')}</span>
      </div>
    </div>
  );
}
