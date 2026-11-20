import { useTranslation } from 'react-i18next';
import { Target } from 'lucide-react';
import type { DemoEditor } from '../useDemoEditor';
import type { Selection, StepRow } from '../types';
import { HotspotPanel } from './HotspotPanel';

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
  if (hotspot)
    return <HotspotPanel editor={editor} hotspot={hotspot} readOnly={readOnly} setSelection={setSelection} />;
  const hotspots = editor.hotspots
    .filter((h) => h.step_id === step.id)
    .sort((a, b) => a.position - b.position);
  return (
    <div className="sp-panel">
      <div className="sec">
        {hotspots.length === 0 && readOnly && <p className="help">{t('editor.noHotspot')}</p>}
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
