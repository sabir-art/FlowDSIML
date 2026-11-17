import { PanelTitle } from './PanelTitle';
import { ChevronLeft, Target, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { HotspotAction } from '@flowdsiml/manifest';
import { Button, Checkbox, Field, Select } from '@flowdsiml/ui';
import type { DemoEditor } from '../useDemoEditor';
import { asAction, asCta, type HotspotRow, type Selection } from '../types';
import { RichTextField } from '../RichTextField';
import { VariablePreview } from '../VariablePreview';
import { CtaFields } from './CtaFields';

export function HotspotPanel({
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
  const action = asAction(hotspot.action);
  const varKeys = editor.variables.map((v) => v.key);
  const set = (patch: Partial<HotspotRow>) => editor.updateHotspot(hotspot.id, patch);

  function setActionType(type: HotspotAction['type']) {
    const next: HotspotAction =
      type === 'goto'
        ? { type, stepId: editor.steps[0]?.id ?? '' }
        : type === 'url'
          ? { type, url: 'https://', newTab: true }
          : { type };
    set({ action: next });
  }

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <PanelTitle icon={<Target />}>{t('editor.hotspotSettings')}</PanelTitle>
        <Button
          size="sm"
          variant="ghost"
          icon={<ChevronLeft />}
          onClick={() => setSelection({ kind: 'step' })}
        >
          {t('editor.backToStep')}
        </Button>
      </div>
      <Field label={t('editor.tooltipTitle')} htmlFor="hs-title">
        <input
          id="hs-title"
          className="fd-input"
          maxLength={200}
          disabled={readOnly}
          value={hotspot.title}
          onChange={(e) => set({ title: e.target.value })}
        />
        <VariablePreview text={hotspot.title} variables={editor.variables} />
      </Field>
      <RichTextField
        id="hs-body"
        label={t('editor.tooltipBody')}
        value={hotspot.body}
        variables={varKeys}
        disabled={readOnly}
        onChange={(v) => set({ body: v })}
      />
      <VariablePreview text={hotspot.body} variables={editor.variables} />
      <Field label={t('editor.placement')} htmlFor="hs-place">
        <Select
          id="hs-place"
          disabled={readOnly}
          value={hotspot.placement}
          onChange={(e) => set({ placement: e.target.value })}
        >
          {['auto', 'top', 'bottom', 'left', 'right'].map((p) => (
            <option key={p} value={p}>
              {t(`editor.placement_${p}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('editor.action')} htmlFor="hs-action">
        <Select
          id="hs-action"
          disabled={readOnly}
          value={action.type}
          onChange={(e) => setActionType(e.target.value as HotspotAction['type'])}
        >
          {(['next', 'goto', 'url', 'none'] as const).map((a) => (
            <option key={a} value={a}>
              {t(`editor.action_${a}`)}
            </option>
          ))}
        </Select>
      </Field>
      {action.type === 'goto' && (
        <Field label={t('editor.targetStep')} htmlFor="hs-goto">
          <Select
            id="hs-goto"
            disabled={readOnly}
            value={action.stepId}
            onChange={(e) => set({ action: { type: 'goto', stepId: e.target.value } })}
          >
            {editor.steps.map((s, i) => (
              <option key={s.id} value={s.id}>
                {i + 1}. {s.title || t('editor.untitled')}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {action.type === 'url' && (
        <Field label={t('editor.ctaUrl')} htmlFor="hs-url">
          <input
            id="hs-url"
            className="fd-input"
            type="url"
            disabled={readOnly}
            value={action.url}
            onChange={(e) => set({ action: { ...action, url: e.target.value } })}
          />
        </Field>
      )}
      <CtaFields
        idPrefix="hs"
        value={asCta(hotspot.cta)}
        disabled={readOnly}
        onChange={(v) => set({ cta: v })}
      />
      <Checkbox
        checked={hotspot.pulse}
        disabled={readOnly}
        onChange={(e) => set({ pulse: e.target.checked })}
        label={t('editor.pulse')}
      />
      {!readOnly && (
        <Button
          variant="ghost"
          className="btn-danger-ghost"
          icon={<Trash2 />}
          onClick={() => {
            void editor.deleteHotspot(hotspot.id);
            setSelection({ kind: 'step' });
          }}
        >
          {t('editor.deleteHotspot')}
        </Button>
      )}
    </div>
  );
}
