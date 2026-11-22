import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EyeOff, Minus, Plus } from 'lucide-react';
import { useConfirm } from '../../components/ConfirmDialog';
import { Canvas, type Tool } from './Canvas';
import { BlurPanel } from './panels/BlurPanel';
import { asMasks, type Selection, type StepRow } from './types';
import type { DemoEditor } from './useDemoEditor';

const ZOOMS = [0.5, 0.75, 1, 1.5, 2] as const;

/**
 * L48-E §4 : « Flouter des zones », en modale plein écran. La capture au centre (zoom − / + et
 * « Ajuster »), on dessine les zones au glisser ; à droite la liste des zones (« Retirer ») et les
 * réglages de BlurPanel pour la zone choisie (style, intensité, « Appliquer à »). « Annuler » ou Échap
 * demandent confirmation si des zones ont changé et rétablissent l'état d'ouverture (toutes les étapes :
 * « Appliquer à toutes les étapes » en modifie d'autres) ; « Appliquer le flou » garde les zones.
 */
export function BlurModal({
  editor,
  step,
  readOnly,
  initial,
  onClose,
}: {
  editor: DemoEditor;
  step: StepRow;
  readOnly: boolean;
  /** Zone choisie à l'ouverture (clic sur une zone du canevas). */
  initial?: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const [dialog, ask] = useConfirm();
  // On dessine zone après zone : l'outil reste « flou » (le canevas repasse sinon en sélection)
  const tool: Tool = readOnly ? 'select' : 'blur';
  const [selection, setSelection] = useState<Selection>(
    initial !== undefined ? { kind: 'blur', index: initial } : { kind: 'step' },
  );
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  // État de toutes les étapes à l'ouverture (« Appliquer à toutes les étapes » en modifie d'autres)
  const snapshot = useRef(new Map(editor.steps.map((s) => [s.id, JSON.stringify(s.blurs ?? null)])));
  const live = editor.steps.find((s) => s.id === step.id) ?? step;
  const masks = asMasks(live.blurs);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const changed = () =>
    editor.steps.filter((s) => snapshot.current.get(s.id) !== JSON.stringify(s.blurs ?? null));
  async function cancel() {
    const diff = changed();
    if (
      diff.length &&
      !(await ask({
        title: t('editor.blurModal.discardTitle'),
        body: t('editor.blurModal.discardBody'),
        confirmLabel: t('editor.blurModal.discard'),
        danger: true,
      }))
    )
      return;
    editor.batch(() => {
      for (const s of diff)
        editor.updateStep(s.id, {
          blurs: JSON.parse(snapshot.current.get(s.id) ?? 'null') as StepRow['blurs'],
        });
    });
    onClose();
  }
  const step2 = (dir: 1 | -1) => {
    const cur = zoom === 'fit' ? 1 : zoom;
    const i = ZOOMS.findIndex((z) => z >= cur);
    setZoom(ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, (i < 0 ? ZOOMS.length - 1 : i) + dir))]!);
  };
  const sel = selection.kind === 'blur' ? selection.index : -1;

  return (
    <dialog
      ref={ref}
      className="dialog blurm"
      aria-labelledby="blurm-title"
      onCancel={(e) => {
        e.preventDefault();
        void cancel();
      }}
    >
      {dialog}
      <header className="blurm-head">
        <h2 id="blurm-title">{t('editor.blurModal.title')}</h2>
        <span className="grow" />
        <button type="button" className="fd-btn fd-btn--ghost" onClick={() => void cancel()}>
          {t('common.cancel')}
        </button>
        {!readOnly && (
          <button type="button" className="fd-btn fd-btn--primary" onClick={onClose}>
            {t('editor.blurModal.apply')}
          </button>
        )}
      </header>
      <div className="blurm-body">
        <div className="blurm-stage">
          <div className="blurm-zoom" role="group" aria-label={t('editor.zoom')}>
            <button
              type="button"
              className="fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm"
              aria-label={t('editor.blurModal.zoomOut')}
              onClick={() => step2(-1)}
            >
              <Minus aria-hidden="true" />
            </button>
            {/* E2 : le pourcentage entre − et +, « Ajuster » une seule fois (après) */}
            {zoom !== 'fit' && (
              <span className="blurm-zoom__v" aria-live="polite">
                {`${Math.round(zoom * 100)}\u00a0%`}
              </span>
            )}
            <button
              type="button"
              className="fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm"
              aria-label={t('editor.blurModal.zoomIn')}
              onClick={() => step2(1)}
            >
              <Plus aria-hidden="true" />
            </button>
            <button
              type="button"
              className="fd-btn fd-btn--ghost fd-btn--sm"
              aria-pressed={zoom === 'fit'}
              onClick={() => setZoom('fit')}
            >
              {t('editor.zoomFit')}
            </button>
          </div>
          <div className="blurm-scroll">
            <div
              className="frame fd-player-scope blurm-frame"
              style={zoom === 'fit' ? undefined : { width: `${zoom * 100}%`, maxWidth: 'none' }}
            >
              <div className="shot">
                <Canvas
                  editor={editor}
                  step={live}
                  tool={tool}
                  setTool={() => undefined}
                  selection={selection}
                  setSelection={setSelection}
                  readOnly={readOnly}
                  hideFormChip
                  hideHotspots
                />
              </div>
            </div>
          </div>
          {!readOnly && <p className="muted blurm-hint">{t('editor.hint_blur')}</p>}
        </div>
        <aside className="blurm-side fd-dense" aria-labelledby="blurm-list">
          {/* E3 : casse normale, 13 px 600 */}
          <h3 id="blurm-list" className="blurm-side__title">
            {masks.length
              ? t('editor.blurModal.zones', { count: masks.length })
              : t('editor.blurModal.noZone')}
          </h3>
          {masks.length === 0 && <p className="help">{t('editor.blurModal.none')}</p>}
          <ul className="blurm-zones">
            {masks.map((_, i) => (
              <li key={i} className={i === sel ? 'is-selected' : undefined}>
                <button
                  type="button"
                  className="field-row sp-item"
                  aria-pressed={i === sel}
                  onClick={() => setSelection({ kind: 'blur', index: i })}
                >
                  <EyeOff aria-hidden="true" />
                  <span className="grow">{t('editor.blurN', { n: i + 1 })}</span>
                </button>
                {!readOnly && (
                  <button
                    type="button"
                    className="link-button"
                    aria-label={t('editor.blurModal.removeN', { n: i + 1 })}
                    onClick={() => {
                      editor.updateStep(live.id, {
                        blurs: masks.filter((_, k) => k !== i) as unknown as StepRow['blurs'],
                      });
                      setSelection({ kind: 'step' });
                    }}
                  >
                    {t('editor.blurModal.remove')}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {sel >= 0 && masks[sel] && (
            <BlurPanel
              editor={editor}
              step={live}
              index={sel}
              readOnly={readOnly}
              setSelection={setSelection}
            />
          )}
        </aside>
      </div>
    </dialog>
  );
}
