import { useTranslation } from 'react-i18next';
import type { HotspotAction } from '@flowdsiml/manifest';
import { Button, Field } from '@flowdsiml/ui';
import type { DemoEditor } from '../useDemoEditor';
import { asAction, asCta, type HotspotRow, type Selection } from '../types';
import { RichTextField } from '../RichTextField';
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
        <h3 className="panel-title">{t('editor.hotspotSettings')}</h3>
        <Button size="sm" variant="ghost" onClick={() => setSelection({ kind: 'step' })}>
          ← {t('editor.backToStep')}
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
      </Field>
      <RichTextField
        id="hs-body"
        label={t('editor.tooltipBody')}
        value={hotspot.body}
        variables={varKeys}
        disabled={readOnly}
        onChange={(v) => set({ body: v })}
      />
      <Field label={t('editor.placement')} htmlFor="hs-place">
        <select
          id="hs-place"
          className="fd-select"
          disabled={readOnly}
          value={hotspot.placement}
          onChange={(e) => set({ placement: e.target.value })}
        >
          {['auto', 'top', 'bottom', 'left', 'right'].map((p) => (
            <option key={p} value={p}>
              {t(`editor.placement_${p}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('editor.action')} htmlFor="hs-action">
        <select
          id="hs-action"
          className="fd-select"
          disabled={readOnly}
          value={action.type}
          onChange={(e) => setActionType(e.target.value as HotspotAction['type'])}
        >
          {(['next', 'goto', 'url', 'none'] as const).map((a) => (
            <option key={a} value={a}>
              {t(`editor.action_${a}`)}
            </option>
          ))}
        </select>
      </Field>
      {action.type === 'goto' && (
        <Field label={t('editor.targetStep')} htmlFor="hs-goto">
          <select
            id="hs-goto"
            className="fd-select"
            disabled={readOnly}
            value={action.stepId}
            onChange={(e) => set({ action: { type: 'goto', stepId: e.target.value } })}
          >
            {editor.steps.map((s, i) => (
              <option key={s.id} value={s.id}>
                {i + 1}. {s.title || t('editor.untitled')}
              </option>
            ))}
          </select>
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
      <label className="row">
        <input
          type="checkbox"
          checked={hotspot.pulse}
          disabled={readOnly}
          onChange={(e) => set({ pulse: e.target.checked })}
        />{' '}
        {t('editor.pulse')}
      </label>
      {!readOnly && (
        <Button
          variant="danger"
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
