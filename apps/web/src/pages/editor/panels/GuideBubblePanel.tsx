import { ChevronLeft, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Json } from '@flowdsiml/supabase-types';
import type { DemoEditor } from '../useDemoEditor';
import type { HotspotRow, Selection } from '../types';
import { VarTextField } from '../vars/VarTextField';
import { useVarCatalog } from '../../../lib/varCatalog';
import { sandboxOf } from '../draftManifest';
import { ignoredOf } from '../html/sandboxGraph';
import { GUIDE_MAX, type GuideStepRef } from '../html/sandboxGuide';

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
  const sb = sandboxOf(demo.sandbox, editor.steps);
  const at = sb.guideSteps.findIndex((g) => g.hotspot === hotspot.id);
  const set = (patch: Partial<HotspotRow>) => editor.updateHotspot(hotspot.id, patch);
  const saveGuide = (guideSteps: GuideStepRef[]) =>
    editor.updateDemo({
      sandbox: { ...sb, ignoredLinks: ignoredOf(demo.sandbox), guideSteps } as unknown as Json,
    });
  const advance = at >= 0 ? sb.guideSteps[at]!.advance : 'click';
  return (
    <div className="sp-panel">
      <div className="hs-head">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelection({ kind: 'step' })}>
          <ChevronLeft aria-hidden="true" />
          {t('editor.backToStep')}
        </button>
        <span className="t-label">
          {at >= 0 ? t('editor.sandbox.guideBubbleN', { n: at + 1 }) : t('editor.html.guideBubble')}
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
        {hotspot.sel && (
          <p className="help">
            {t('editor.sandbox.guideElement')} <code>{hotspot.sel}</code>
          </p>
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
      {at >= 0 ? (
        <fieldset className="sec">
          <legend className="sec-title">{t('editor.sandbox.guideAdvance')}</legend>
          {(['click', 'next'] as const).map((a) => (
            <label key={a} className="check">
              <input
                type="radio"
                name="gd-advance"
                checked={advance === a}
                disabled={readOnly}
                onChange={() => saveGuide(sb.guideSteps.map((g, k) => (k === at ? { ...g, advance: a } : g)))}
              />
              {t(a === 'click' ? 'editor.sandbox.guideAdvClick' : 'editor.sandbox.guideAdvNext')}
            </label>
          ))}
          {!readOnly && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => saveGuide(sb.guideSteps.filter((_, k) => k !== at))}
            >
              {t('editor.sandbox.guideRemove')}
            </button>
          )}
        </fieldset>
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
