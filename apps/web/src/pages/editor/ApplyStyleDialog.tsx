import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Info, X } from 'lucide-react';
import type { DemoEditor } from './useDemoEditor';
import { asAction, asStepOptions, type HotspotRow, type StepRow } from './types';
import { useToast } from '../../components/Toast';

type Copy = { placement: boolean; labels: boolean; guide: boolean; advance: boolean };

/**
 * L12-03 : « Appliquer le style de l'étape n à toutes les étapes ». Copie, au choix, la position de la
 * bulle, les libellés des boutons, le type de guidage (décoché par défaut) et l'avance au clic sur le
 * hotspot principal de chaque étape à bulle. Textes, formulaire et écran de fin ne changent pas.
 * Une seule étape d'annulation (Ctrl Z).
 */
export function ApplyStyleDialog({
  editor,
  step,
  index,
  hotspot,
  onClose,
}: {
  editor: DemoEditor;
  step: StepRow;
  index: number;
  hotspot: HotspotRow;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [copy, setCopy] = useState<Copy>({ placement: true, labels: true, guide: false, advance: true });
  const opts = asStepOptions(step.options);
  const advances = asAction(hotspot.action).type !== 'none';

  // Étapes à bulle (autres que celle-ci) : premier hotspot de chaque étape image
  const targets = editor.steps
    .filter((s) => s.id !== step.id && s.kind === 'image')
    .map((s) => ({
      step: s,
      hotspot: editor.hotspots.filter((h) => h.step_id === s.id).sort((a, b) => a.position - b.position)[0],
    }))
    .filter((x): x is { step: StepRow; hotspot: HotspotRow } => !!x.hotspot);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const apply = () => {
    editor.batch(() => {
      for (const { step: s, hotspot: h } of targets) {
        const patch: Partial<HotspotRow> = {};
        if (copy.placement) patch.placement = hotspot.placement;
        if (copy.guide) patch.style = hotspot.style;
        if (copy.advance) {
          const a = asAction(h.action);
          // Seules « étape suivante » et « aucune action » basculent : un lien ou un saut est conservé
          if (advances && a.type === 'none') patch.action = { type: 'next' };
          if (!advances && a.type === 'next') patch.action = { type: 'none' };
        }
        if (Object.keys(patch).length) editor.updateHotspot(h.id, patch);
        if (copy.labels) {
          const o = asStepOptions(s.options);
          editor.updateStep(s.id, {
            options: {
              ...o,
              buttonLabel: opts.buttonLabel,
              prevLabel: opts.prevLabel,
              showPrev: opts.showPrev,
            } as unknown as StepRow['options'],
          });
        }
      }
    });
    toast(t('editor.applyStyle.done', { count: targets.length }));
    onClose();
  };

  const place =
    hotspot.placement === 'auto' ? t('editor.applyStyle.auto') : t(`editor.placement_${hotspot.placement}`);
  const labels = [opts.prevLabel || t('editor.hs.prev'), opts.buttonLabel || t('editor.hs.next')]
    .map((l) => `«\u202f${l}\u202f»`)
    .join(', ');
  const item = (k: keyof Copy, label: string, detail?: string) => (
    <label className="check">
      <input
        type="checkbox"
        checked={copy[k]}
        onChange={(e) => setCopy({ ...copy, [k]: e.target.checked })}
      />
      <span>
        {label} {detail && <span className="t-caption muted">· {detail}</span>}
      </span>
    </label>
  );
  const none = !Object.values(copy).some(Boolean);

  // Portail : la modale ne doit pas être rognée par le panneau défilant
  return createPortal(
    <div className="mk">
      <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="as-t">
          <div className="modal-head">
            <h2 id="as-t">{t('editor.applyStyle.title', { n: index + 1 })}</h2>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              aria-label={t('common.close')}
              onClick={onClose}
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <div className="modal-body">
            <fieldset className="as-copy">
              <legend className="t-label">{t('editor.applyStyle.what')}</legend>
              {item('placement', t('editor.applyStyle.placement'), place)}
              {item('labels', t('editor.applyStyle.labels'), labels)}
              {item(
                'guide',
                t('editor.applyStyle.guide'),
                hotspot.style === 'spotlight' ? t('editor.hs.typeZone') : t('editor.hs.typeHotspot'),
              )}
              {item('advance', t('editor.hs.advanceOnClick'))}
            </fieldset>
            <div className="alert as-info">
              <Info aria-hidden="true" />
              <span className="t-caption">
                {targets.length
                  ? t('editor.applyStyle.info', { count: targets.length })
                  : t('editor.applyStyle.noTarget')}
              </span>
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={none || targets.length === 0}
              aria-disabled={none || targets.length === 0 ? 'true' : undefined}
              onClick={apply}
            >
              {targets.length
                ? t('editor.applyStyle.apply', { count: targets.length })
                : t('editor.applyStyle.applyNone')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
