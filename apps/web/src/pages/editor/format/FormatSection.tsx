import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-react';
import { themeSchema } from '@flowdsiml/manifest';
import { supabase } from '../../../lib/supabase';
import { useConfirm } from '../../../components/ConfirmDialog';
import { useToast } from '../../../components/Toast';
import { errorMessage } from '../../../lib/errors';
import type { DemoEditor } from '../useDemoEditor';
import { asSettings } from '../types';
import { OUT_WIDTHS, type FitMode, type FormatId } from './format';
import { applyFormat, formatSteps, planStep, renderPlan, type FormatChoice } from './applyFormat';
import { Select } from '@flowdsiml/ui';
import { asLayers } from '../images/layers';

const FORMATS: FormatId[] = ['original', '16:9', '16:10', '4:3', 'custom'];
const MIN = 640;
const MAX = 3840;

/**
 * L28-04 : « Format des écrans » (onglet Réglages). Constat des tailles, format, ajustement, largeur de sortie,
 * aperçu avant/après, liste de ce qui sort du cadre, application en une seule étape d'annulation, retour aux
 * images d'origine. S'applique aux captures (étapes image).
 */
export function FormatSection({ editor, readOnly }: { editor: DemoEditor; readOnly: boolean }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [dialog, ask] = useConfirm();
  const steps = useMemo(() => formatSteps(editor.steps), [editor.steps]);
  const nf = (n: number) => n.toLocaleString(i18n.language);
  // Constat : tailles trouvées, de la plus fréquente à la moins fréquente
  const sizes = useMemo(() => {
    const m = new Map<string, { w: number; h: number; n: number }>();
    for (const s of steps) {
      const k = `${s.image_width}x${s.image_height}`;
      const e = m.get(k) ?? { w: s.image_width!, h: s.image_height!, n: 0 };
      e.n += 1;
      m.set(k, e);
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [steps]);
  const defaultWidth = useMemo(() => {
    const w = sizes[0]?.w ?? 1440;
    return [...OUT_WIDTHS].sort((a, b) => Math.abs(a - w) - Math.abs(b - w))[0]!;
  }, [sizes]);
  const [choice, setChoice] = useState<FormatChoice>({
    format: 'original',
    mode: 'fit',
    outWidth: defaultWidth,
    custom: { w: 1600, h: 900 },
  });
  useEffect(() => setChoice((c) => ({ ...c, outWidth: defaultWidth })), [defaultWidth]);
  const [pi, setPi] = useState(0);
  const [preview, setPreview] = useState<{ before: string | null; after: string | null }>({
    before: null,
    after: null,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const customBad =
    choice.format === 'custom' &&
    [choice.custom.w, choice.custom.h].some((v) => !Number.isFinite(v) || v < MIN || v > MAX);
  const plans = useMemo(
    () => (customBad ? [] : steps.map((s) => planStep(s, editor.hotspots, choice))),
    [steps, editor.hotspots, choice, customBad],
  );
  const indexOf = (id: string) => editor.steps.findIndex((s) => s.id === id) + 1;
  const warnings = plans.flatMap((p) => [
    ...(p.hotspotOut ? [t('editor.format.hotspotOut', { n: indexOf(p.step.id) })] : []),
    ...(p.blurCut ? [t('editor.format.blurCut', { n: indexOf(p.step.id) })] : []),
  ]);
  const background = themeSchema.parse(asSettings(editor.demo!.settings).theme ?? {}).background;
  const hasOriginals = editor.steps.some((s) => s.original);
  const current = plans[Math.min(pi, plans.length - 1)];

  // Aperçu avant / après de l'étape choisie (vignettes légères)
  useEffect(() => {
    if (!current) return;
    let live = true;
    const urls: string[] = [];
    void (async () => {
      try {
        const sig = await supabase.storage.from('captures').createSignedUrl(current.base.image_path, 600);
        const after = await renderPlan(current, background, 480);
        const a = URL.createObjectURL(after);
        urls.push(a);
        if (live) setPreview({ before: sig.data?.signedUrl ?? null, after: a });
      } catch {
        if (live) setPreview({ before: null, after: null });
      }
    })();
    return () => {
      live = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [current, background]);

  const label = (f: FormatId) =>
    f === 'custom' ? t('editor.format.custom') : f === 'original' ? t('editor.format.original') : f;
  const formatName =
    choice.format === 'custom'
      ? `${nf(choice.custom.w)} × ${nf(choice.custom.h)}`
      : choice.format === 'original'
        ? t('editor.format.originalName', { w: nf(choice.outWidth) })
        : choice.format;

  async function apply() {
    const ok = await ask({
      title: t('editor.format.confirmTitle'),
      body: t('editor.format.confirmBody', { count: plans.length, format: formatName }),
      confirmLabel: t('editor.format.apply'),
    });
    if (!ok) return;
    setBusy(t('editor.format.applying', { done: 0, total: plans.length }));
    try {
      const n = await applyFormat(editor, plans, background, (d, tot) =>
        setBusy(t('editor.format.applying', { done: d, total: tot })),
      );
      toast(t('editor.format.applied', { count: n }), {
        label: t('editor.format.undo'),
        onClick: () => editor.undo(),
      });
      // Les images ajoutées gardent leur place en % du cadre : à vérifier après un changement de format
      if (plans.some((p) => asLayers(p.step.options).length > 0))
        toast(t('editor.format.checkImages'), undefined, { tone: 'warning' });
    } catch (e) {
      toast(errorMessage(t, e), undefined, { tone: 'warning' });
    } finally {
      setBusy(null);
    }
  }
  async function restore() {
    setBusy(t('editor.format.restoring'));
    try {
      const { data, error } = await supabase.rpc('restore_original_sizes', { p_demo: editor.demo!.id });
      if (error) throw error;
      const hadImages = editor.steps.some((s) => asLayers(s.options).length > 0);
      await editor.reload();
      toast(t('editor.format.restored', { count: data ?? 0 }));
      if (hadImages) toast(t('editor.format.checkImages'), undefined, { tone: 'warning' });
    } catch (e) {
      toast(errorMessage(t, e), undefined, { tone: 'warning' });
    } finally {
      setBusy(null);
    }
  }

  if (!steps.length) return null;
  return (
    <div className="sec fmt-sec">
      {dialog}
      <div className="sec-title">{t('editor.format.title')}</div>
      <p className="help fmt-found">
        {sizes.length === 1
          ? t('editor.format.allSame', { w: nf(sizes[0]!.w), h: nf(sizes[0]!.h) })
          : sizes.map((s) => t('editor.format.size', { w: nf(s.w), h: nf(s.h), count: s.n })).join(' · ')}
      </p>
      <fieldset className="fmt-group" disabled={readOnly || !!busy}>
        <legend className="label">{t('editor.format.format')}</legend>
        <div className="fmt-radios">
          {FORMATS.map((f) => (
            <label key={f} className="check">
              <input
                type="radio"
                name="fmt-format"
                checked={choice.format === f}
                onChange={() => setChoice({ ...choice, format: f })}
              />
              {label(f)}
            </label>
          ))}
        </div>
        {choice.format === 'custom' && (
          <div className="row fmt-custom">
            {(['w', 'h'] as const).map((k) => (
              <label key={k} className="field">
                <span className="label">
                  {k === 'w' ? t('editor.format.width') : t('editor.format.height')}
                </span>
                <input
                  type="number"
                  className="input input-sm"
                  min={MIN}
                  max={MAX}
                  value={choice.custom[k]}
                  aria-invalid={customBad || undefined}
                  aria-describedby="fmt-custom-h"
                  onChange={(e) =>
                    setChoice({ ...choice, custom: { ...choice.custom, [k]: Number(e.target.value) } })
                  }
                />
              </label>
            ))}
            <span
              className={customBad ? 'field-error' : 'help'}
              id="fmt-custom-h"
              role={customBad ? 'alert' : undefined}
            >
              {t('editor.format.customHelp', { min: nf(MIN), max: nf(MAX) })}
            </span>
          </div>
        )}
      </fieldset>
      {choice.format !== 'original' && (
        <fieldset className="fmt-group" disabled={readOnly || !!busy}>
          <legend className="label">{t('editor.format.adjust')}</legend>
          <div className="fmt-radios">
            {(['fit', 'fill'] as FitMode[]).map((m) => (
              <label key={m} className="check">
                <input
                  type="radio"
                  name="fmt-mode"
                  checked={choice.mode === m}
                  onChange={() => setChoice({ ...choice, mode: m })}
                />
                <span>
                  {t(`editor.format.mode_${m}`)}
                  <span className="help fmt-mode-help">{t(`editor.format.${m}Help`)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {choice.format !== 'custom' && (
        <div className="field">
          <label htmlFor="fmt-out">{t('editor.format.outWidth')}</label>
          <Select
            id="fmt-out"
            size="sm"
            disabled={readOnly || !!busy}
            value={choice.outWidth}
            onChange={(e) => setChoice({ ...choice, outWidth: Number(e.target.value) })}
          >
            {OUT_WIDTHS.map((w) => (
              <option key={w} value={w}>
                {t('editor.format.px', { n: nf(w) })}
              </option>
            ))}
          </Select>
        </div>
      )}
      {current && (
        <div className="fmt-preview" role="group" aria-label={t('editor.format.preview')}>
          <div className="fmt-thumbs">
            <figure>
              {preview.before ? <img src={preview.before} alt="" /> : <span className="fmt-ph" />}
              <figcaption>{t('editor.format.before')}</figcaption>
            </figure>
            <figure>
              {preview.after ? <img src={preview.after} alt="" /> : <span className="fmt-ph" />}
              <figcaption>{t('editor.format.after')}</figcaption>
            </figure>
          </div>
          <div className="row fmt-nav">
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              aria-label={t('editor.format.prev')}
              disabled={pi <= 0}
              onClick={() => setPi(pi - 1)}
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <span className="t-caption">{t('editor.format.stepOf', { n: indexOf(current.step.id) })}</span>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              aria-label={t('editor.format.next')}
              disabled={pi >= plans.length - 1}
              onClick={() => setPi(pi + 1)}
            >
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
      {warnings.length > 0 && (
        <ul className="fmt-warn" role="status">
          {warnings.map((w) => (
            <li key={w}>
              <TriangleAlert aria-hidden="true" />
              {w}
            </li>
          ))}
        </ul>
      )}
      <p className="help">{t('editor.format.scope')}</p>
      {!readOnly && (
        <div className="row wrap fmt-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!!busy || customBad || !plans.length}
            onClick={() => void apply()}
          >
            {t('editor.format.apply')}
          </button>
          {hasOriginals && (
            <button type="button" className="mk-link-inline" disabled={!!busy} onClick={() => void restore()}>
              {t('editor.format.restore')}
            </button>
          )}
        </div>
      )}
      {busy && (
        <p className="help" role="status">
          {busy}
        </p>
      )}
    </div>
  );
}
