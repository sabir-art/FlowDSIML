import { useTranslation } from 'react-i18next';
import { Target } from 'lucide-react';
import type { DemoEditor } from '../useDemoEditor';
import type { Selection, StepRow } from '../types';
import { HotspotPanel } from './HotspotPanel';
import { GuideBubblePanel } from './GuideBubblePanel';

/**
 * L48-E §2 : outil « Points d'intérêt ». Un point choisi (clic sur le canevas ou dans la liste) :
 * ses réglages (HotspotPanel). Sinon, la liste des points de l'étape et « Ajouter un point », qui
 * met le canevas en mode « placer un point ».
 */
export function HotspotsTool({
  editor,
  step,
  selection,
  setSelection,
  readOnly,
  onAdd,
}: {
  editor: DemoEditor;
  step: StepRow;
  selection: Selection;
  setSelection: (s: Selection) => void;
  readOnly: boolean;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const hotspot =
    selection.kind === 'hotspot' ? editor.hotspots.find((h) => h.id === selection.id) : undefined;
  // A8 : sur une page de Sandbox, les points sont les bulles du guide (posées sur un élément de la page)
  const html = step.kind === 'html';
  if (hotspot)
    return html ? (
      <GuideBubblePanel editor={editor} hotspot={hotspot} readOnly={readOnly} setSelection={setSelection} />
    ) : (
      <HotspotPanel editor={editor} hotspot={hotspot} readOnly={readOnly} setSelection={setSelection} />
    );
  const hotspots = editor.hotspots
    .filter((h) => h.step_id === step.id)
    .sort((a, b) => a.position - b.position);
  if (html)
    return (
      <div className="sp-panel">
        <div className="sec sec--list">
          <div className="sec-title">
            {editor.demo?.kind === 'sandbox' ? t('editor.sandbox.guideListTitle') : t('editor.html.bubbles')}
          </div>
          {hotspots.length > 0 && (
            <div className="sec-list">
              {hotspots.map((h, i) => (
                <button
                  key={h.id}
                  type="button"
                  className="field-row sp-item"
                  onClick={() => setSelection({ kind: 'hotspot', id: h.id })}
                >
                  <Target aria-hidden="true" />
                  <span className="grow">
                    {i + 1}. {h.title || t('editor.sandbox.guideNoTitle')}
                  </span>
                </button>
              ))}
            </div>
          )}
          {!readOnly && editor.demo?.kind === 'sandbox' && (
            <p className="help">{t('editor.sandbox.guideListHelp')}</p>
          )}
        </div>
      </div>
    );
  return (
    <div className="sp-panel">
      {/* §18.6 : 12 px entre la liste et « Ajouter un hotspot », 4 px entre les lignes (gap du conteneur) */}
      <div className="sec sec--list">
        {hotspots.length === 0 && readOnly && <p className="help">{t('editor.noHotspot')}</p>}
        {hotspots.length > 0 && (
          <div className="sec-list">
            {hotspots.map((h, i) => (
              <button
                key={h.id}
                type="button"
                className="field-row sp-item"
                onClick={() => setSelection({ kind: 'hotspot', id: h.id })}
              >
                <Target aria-hidden="true" />
                <span className="grow">
                  {i + 1}. {h.title || t('editor.untitled')}
                </span>
              </button>
            ))}
          </div>
        )}
        {!readOnly && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onAdd}>
            <Target aria-hidden="true" />
            {t('editor.addHotspot')}
          </button>
        )}
      </div>
    </div>
  );
}
