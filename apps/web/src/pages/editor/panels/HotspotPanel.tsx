import { ChevronLeft, Crop, MessageSquare, Target, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { HotspotAction } from '@flowdsiml/manifest';
import type { DemoEditor } from '../useDemoEditor';
import { asAction, asCta, asSettings, type HotspotRow, type Selection } from '../types';
import { RichTextField } from '../RichTextField';
import { VariablePreview } from '../VariablePreview';
import { CtaFields } from './CtaFields';

type Side = 'top' | 'bottom' | 'left' | 'right';
/** Grille 3 × 3 de la maquette : les côtés correspondent aux placements gérés par le player ;
 * les coins n'ont pas d'équivalent et restent inactifs (Bientôt). */
// prettier-ignore
const GRID: Array<Side | 'corner' | 'center'> = [
  'corner', 'top', 'corner',
  'left', 'center', 'right',
  'corner', 'bottom', 'corner',
];

/** Panneau « Hotspot et bulle » (maquette editeur.html, contexte hotspot). */
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
  const demoSpotlight = asSettings(editor.demo!.settings).mode === 'spotlight';
  const style = demoSpotlight ? 'spotlight' : hotspot.style === 'spotlight' ? 'spotlight' : 'beacon';
  const auto = hotspot.placement === 'auto';
  const advances = action.type !== 'none';

  function setActionType(type: HotspotAction['type']) {
    const next: HotspotAction =
      type === 'goto'
        ? { type, stepId: editor.steps[0]?.id ?? '' }
        : type === 'url'
          ? { type, url: 'https://', newTab: true }
          : { type };
    set({ action: next });
  }

  const guide = [
    { key: 'beacon', icon: <Target aria-hidden="true" />, label: t('editor.hs.typeHotspot') },
    { key: 'spotlight', icon: <Crop aria-hidden="true" />, label: t('editor.hs.typeZone') },
  ] as const;

  return (
    <div className="hs-panel">
      <div className="hs-head">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelection({ kind: 'step' })}>
          <ChevronLeft aria-hidden="true" />
          {t('editor.backToStep')}
        </button>
        <span className="t-label">{t('editor.hotspotSettings')}</span>
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
        <div className="sec-title">{t('editor.hs.guideType')}</div>
        <div className="segmented" role="radiogroup" aria-label={t('editor.hs.guideType')}>
          {guide.map((g) => (
            <button
              key={g.key}
              type="button"
              role="radio"
              aria-checked={style === g.key}
              disabled={readOnly || demoSpotlight}
              onClick={() => set({ style: g.key })}
            >
              {g.icon}
              {g.label}
            </button>
          ))}
          <button type="button" role="radio" aria-checked={false} aria-disabled="true" disabled>
            <MessageSquare aria-hidden="true" />
            {t('editor.hs.typeFree')}
            <span className="badge badge-xs">{t('shell.soon')}</span>
          </button>
        </div>
        <p className="help">
          {demoSpotlight
            ? t('editor.hs.forcedByDemo')
            : style === 'spotlight'
              ? t('editor.hs.zoneHelp')
              : t('editor.hs.hotspotHelp')}
        </p>
        {style === 'beacon' && (
          <label className="check">
            <input
              type="checkbox"
              checked={hotspot.pulse}
              disabled={readOnly}
              onChange={(e) => set({ pulse: e.target.checked })}
            />
            {t('editor.pulse')}
          </label>
        )}
      </div>

      <div className="sec">
        <div className="sec-title">{t('editor.tooltipBody')}</div>
        <div className="field">
          <label htmlFor="hs-title">
            {t('editor.hs.title')} <span className="opt">{t('editor.hs.optional')}</span>
          </label>
          <input
            id="hs-title"
            className="input input-sm"
            maxLength={200}
            disabled={readOnly}
            placeholder={t('editor.hs.titlePlaceholder')}
            value={hotspot.title}
            onChange={(e) => set({ title: e.target.value })}
          />
          <VariablePreview text={hotspot.title} variables={editor.variables} />
        </div>
        <RichTextField
          mk
          id="hs-body"
          label={t('editor.hs.text')}
          value={hotspot.body}
          variables={varKeys}
          disabled={readOnly}
          onChange={(v) => set({ body: v })}
          extra={
            <>
              {' · '}
              <span className="hs-ai" aria-disabled="true">
                {t('editor.hs.improveAi')}
              </span>{' '}
              <span className="badge badge-xs">{t('editor.v2')}</span>
            </>
          }
        />
        <VariablePreview text={hotspot.body} variables={editor.variables} />
      </div>

      <div className="sec">
        <div className="sec-title">{t('editor.placement')}</div>
        <div className="row-3">
          <div className="pos-grid" role="group" aria-label={t('editor.placement')}>
            {GRID.map((cell, i) =>
              cell === 'center' ? (
                <span key={i} className="c" aria-hidden="true" />
              ) : cell === 'corner' ? (
                <button
                  key={i}
                  type="button"
                  className="is-soon"
                  disabled
                  aria-label={`${t(`editor.hs.corner${i}`)} (${t('shell.soon')})`}
                  title={t('shell.soon')}
                />
              ) : (
                <button
                  key={i}
                  type="button"
                  aria-label={t(`editor.placement_${cell}`)}
                  aria-pressed={!auto && hotspot.placement === cell}
                  disabled={readOnly}
                  onClick={() => set({ placement: cell })}
                />
              ),
            )}
          </div>
          <div className="col t-caption muted hs-auto">
            <label className="check">
              <input
                type="checkbox"
                checked={auto}
                disabled={readOnly}
                onChange={(e) => set({ placement: e.target.checked ? 'auto' : 'bottom' })}
              />
              {t('editor.hs.autoPlacement')}
            </label>
            <span>{t('editor.hs.autoHelp')}</span>
          </div>
        </div>
      </div>

      <div className="sec">
        <div className="sec-title">
          {t('editor.hs.buttons')}
          <span className="badge badge-xs">{t('shell.soon')}</span>
        </div>
        <div className="hs-btns">
          <div className="field">
            <label htmlFor="hs-prev">{t('editor.hs.prev')}</label>
            <input id="hs-prev" className="input input-sm" disabled value={t('editor.hs.prev')} readOnly />
          </div>
          <div className="field">
            <label htmlFor="hs-next">{t('editor.hs.next')}</label>
            <input id="hs-next" className="input input-sm" disabled value={t('editor.hs.next')} readOnly />
          </div>
        </div>
        <div className="setting">
          <span className="t-label" id="hs-adv">
            {t('editor.hs.advanceOnClick')}
          </span>
          <span className="switch">
            <input
              type="checkbox"
              aria-labelledby="hs-adv"
              checked={advances}
              disabled={readOnly}
              onChange={(e) => setActionType(e.target.checked ? 'next' : 'none')}
            />
            <span />
          </span>
        </div>
      </div>

      <div className="sec">
        <div className="sec-title">{t('editor.action')}</div>
        <select
          id="hs-action"
          className="select input-sm"
          aria-label={t('editor.action')}
          disabled={readOnly || !advances}
          value={advances ? action.type : 'next'}
          onChange={(e) => setActionType(e.target.value as HotspotAction['type'])}
        >
          {(['next', 'goto', 'url'] as const).map((a) => (
            <option key={a} value={a}>
              {t(`editor.action_${a}`)}
            </option>
          ))}
          <option value="demo" disabled>
            {t('editor.hs.openDemo')} ({t('shell.soon')})
          </option>
        </select>
        {!advances && <p className="help">{t('editor.hs.noAdvanceHelp')}</p>}
        {action.type === 'goto' && (
          <div className="field">
            <label htmlFor="hs-goto">{t('editor.targetStep')}</label>
            <select
              id="hs-goto"
              className="select input-sm"
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
          </div>
        )}
        {action.type === 'url' && (
          <div className="field">
            <label htmlFor="hs-url">{t('editor.ctaUrl')}</label>
            <input
              id="hs-url"
              className="input input-sm"
              type="url"
              disabled={readOnly}
              value={action.url}
              onChange={(e) => set({ action: { ...action, url: e.target.value } })}
            />
          </div>
        )}
      </div>

      <div className="sec hs-cta">
        <div className="sec-title">{t('editor.hs.cta')}</div>
        <CtaFields
          idPrefix="hs"
          value={asCta(hotspot.cta)}
          disabled={readOnly}
          onChange={(v) => set({ cta: v })}
        />
      </div>
    </div>
  );
}
