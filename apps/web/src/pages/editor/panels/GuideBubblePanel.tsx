import { useEffect } from 'react';
import { AlertTriangle, ChevronLeft, Crosshair, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Json } from '@flowdsiml/supabase-types';
import type { DemoEditor } from '../useDemoEditor';
import type { HotspotRow, Selection } from '../types';
import { VarTextField } from '../vars/VarTextField';
import { useVarCatalog } from '../../../lib/varCatalog';
import { sandboxOf } from '../draftManifest';
import { ignoredOf } from '../html/sandboxGraph';
import { fallbackRect, GUIDE_MAX, type GuideStepRef } from '../html/sandboxGuide';
import { frameSend, setHtmlEdit, useHtmlEdit } from '../html/htmlModel';

const PLACEMENTS = ['auto', 'top', 'bottom', 'left', 'right'] as const;

/**
 * A8 : bulle du guide d'une page de Sandbox (spec a8-guide-sandbox §3.2). Titre, texte, placement et
 * avance de l'étape (au clic dans la zone, ou bouton « Suivant ») ; « Retirer du guide » garde la
 * bulle, la corbeille la supprime (l'étape devient orpheline et reste signalée dans le plan).
 */
export function GuideBubblePanel({
  editor,
  hotspot,
  readOnly,
  setSelection,
}: {
  editor: DemoEditor;
  hotspot: HotspotRow;
  readOnly: boolean;
  setSelection: (s: Selection) => void;
}) {
  const { t } = useTranslation();
  const catalog = useVarCatalog(editor.variables);
  const demo = editor.demo!;
  // L30-05 : bulle d'une étape HTML de démo guidée (pas de guide du Sandbox)
  const isSandbox = demo.kind === 'sandbox';
  const sb = sandboxOf(demo.sandbox, editor.steps);
  const at = sb.guideSteps.findIndex((g) => g.hotspot === hotspot.id);
  const set = (patch: Partial<HotspotRow>) => editor.updateHotspot(hotspot.id, patch);
  const saveGuide = (guideSteps: GuideStepRef[]) =>
    editor.updateDemo({
      sandbox: { ...sb, ignoredLinks: ignoredOf(demo.sandbox), guideSteps } as unknown as Json,
    });
  const advance = at >= 0 ? sb.guideSteps[at]!.advance : 'click';
  // Élément visé : vérifié dans la page (sélecteur unique) ; introuvable ou ambigu → « Replacer la bulle »
  const ed = useHtmlEdit(hotspot.step_id);
  useEffect(() => {
    if (!hotspot.sel) return;
    setHtmlEdit({ probe: { sel: hotspot.sel, ok: null } });
    frameSend.current?.({ t: 'probe', sel: hotspot.sel });
  }, [hotspot.sel]);
  const lost = !hotspot.sel || (ed.probe?.sel === hotspot.sel && ed.probe.ok === false);
  function replace() {
    const el = ed.selected;
    const step = editor.steps.find((s) => s.id === hotspot.step_id);
    if (!el || !step) return;
    const vp = (step.html_meta as { viewport?: { w: number; h: number } } | null)?.viewport;
    set({ sel: el.sel, ...fallbackRect(el.rect, vp?.w ?? 1280, vp?.h ?? 800) });
  }
  return (
    <div className="sp-panel">
      <div className="hs-head">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelection({ kind: 'step' })}>
          <ChevronLeft aria-hidden="true" />
          {t('editor.backToStep')}
        </button>
        <span className="t-label">
          {!isSandbox
            ? t('editor.hotspotSettings')
            : at >= 0
              ? t('editor.sandbox.guideBubbleN', { n: at + 1 })
              : t('editor.html.guideBubble')}
        </span>
        {!readOnly && (
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            aria-label={t('editor.deleteHotspot')}
            title={t('editor.deleteHotspot')}
            onClick={() => {
              void editor.deleteHotspot(hotspot.id);
              setSelection({ kind: 'step' });
            }}
          >
            <Trash2 aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="sec">
        <div className="sec-title">{t('editor.tooltipBody')}</div>
        <VarTextField
          singleLine
          id="gd-title"
          placeholder={t('editor.newHotspot')}
          label={`${t('editor.hs.title')} ${t('editor.hs.optional')}`}
          maxLength={200}
          catalog={catalog}
          canManage={!readOnly}
          disabled={readOnly}
          value={hotspot.title}
          onChange={(v) => set({ title: v })}
        />
        <VarTextField
          id="gd-body"
          label={t('editor.hs.text')}
          value={hotspot.body}
          catalog={catalog}
          canManage={!readOnly}
          disabled={readOnly}
          onChange={(v) => set({ body: v })}
        />
        {hotspot.sel && !lost && (
          <p className="help">
            {t('editor.sandbox.guideElement')} <code>{hotspot.sel}</code>
          </p>
        )}
        {lost && (
          <div className="alert alert-warning" role="status">
            <AlertTriangle size={16} aria-hidden="true" />
            <div>
              <p>{t('editor.sandbox.guideNotFound')}</p>
              {!readOnly && (
                <>
                  <p className="help">{t('editor.sandbox.guideReplaceHelp')}</p>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    aria-disabled={!ed.selected || undefined}
                    onClick={replace}
                  >
                    <Crosshair size={16} aria-hidden="true" />
                    {t('editor.sandbox.guideReplace')}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="sec">
        <label className="sec-title" htmlFor="gd-place">
          {t('editor.placement')}
        </label>
        <select
          id="gd-place"
          className="select input-sm"
          value={hotspot.placement}
          disabled={readOnly}
          onChange={(e) => set({ placement: e.target.value })}
        >
          {PLACEMENTS.map((p) => (
            <option key={p} value={p}>
              {p === 'auto' ? t('editor.hs.autoPlacement') : t(`editor.placement_${p}`)}
            </option>
          ))}
        </select>
      </div>
      {!isSandbox ? null : at >= 0 ? (
        <div className="sec">
          <fieldset className="gd-advance">
            <legend className="sec-title">{t('editor.sandbox.guideAdvance')}</legend>
            {(['click', 'next'] as const).map((a) => (
              <label key={a} className="check">
                <input
                  type="radio"
                  name="gd-advance"
                  checked={advance === a}
                  disabled={readOnly}
                  onChange={() =>
                    saveGuide(sb.guideSteps.map((g, k) => (k === at ? { ...g, advance: a } : g)))
                  }
                />
                {t(a === 'click' ? 'editor.sandbox.guideAdvClick' : 'editor.sandbox.guideAdvNext')}
              </label>
            ))}
          </fieldset>
          {/* §18.2 : action hors du groupe de choix, 16 px dessous */}
          {!readOnly && (
            <button
              type="button"
              className="btn btn-secondary btn-sm gd-remove"
              onClick={() => saveGuide(sb.guideSteps.filter((_, k) => k !== at))}
            >
              {t('editor.sandbox.guideRemove')}
            </button>
          )}
        </div>
      ) : (
        <div className="sec">
          <p className="help">{t('editor.sandbox.guideNotInGuide')}</p>
          {!readOnly && sb.guideSteps.length < GUIDE_MAX && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() =>
                saveGuide([
                  ...sb.guideSteps,
                  { page: hotspot.step_id, hotspot: hotspot.id, advance: 'click' },
                ])
              }
            >
              {t('editor.sandbox.guideAddBack')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
