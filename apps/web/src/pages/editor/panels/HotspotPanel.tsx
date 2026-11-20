import { VoiceFields } from '../voice/VoiceFields';
import { ChevronLeft, Crop, Layers, MessageSquare, Target, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ApplyStyleDialog } from '../ApplyStyleDialog';
import { useTranslation } from 'react-i18next';
import { RectFields } from './RectFields';
import type { HotspotAction, StepOptions } from '@flowdsiml/manifest';
import type { DemoEditor } from '../useDemoEditor';
import {
  asAction,
  asCta,
  asSettings,
  asStepOptions,
  type HotspotRow,
  type Selection,
  type StepRow,
} from '../types';
import { RichTextField } from '../RichTextField';
import { VariablePreview } from '../VariablePreview';
import { CtaFields } from './CtaFields';
import { AiBadge, AiWrite, isAiApplied } from '../../../components/ai/AiWrite';
import { AiSpellAll } from '../../../components/ai/AiSpellAll';
import { useWorkspace } from '../../../workspace/WorkspaceProvider';

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
  const [applying, setApplying] = useState(false);
  const [spellAll, setSpellAll] = useState(false);
  const { current: ws } = useWorkspace();
  const action = asAction(hotspot.action);
  const varKeys = editor.variables.map((v) => v.key);
  const set = (patch: Partial<HotspotRow>) => editor.updateHotspot(hotspot.id, patch);
  const demoSpotlight = asSettings(editor.demo!.settings).mode === 'spotlight';
  const style = demoSpotlight ? 'spotlight' : hotspot.style === 'spotlight' ? 'spotlight' : 'beacon';
  const auto = hotspot.placement === 'auto';
  const advances = action.type !== 'none';
  const step = editor.steps.find((st) => st.id === hotspot.step_id);
  const opts = asStepOptions(step?.options);
  const isLast = !!step && editor.steps[editor.steps.length - 1]?.id === step.id;
  /** L30 : repère « IA » de l'étape (bilan RGPD), posé par une proposition appliquée, retiré à la saisie. */
  const aiMarked = !!(step?.options as { aiText?: boolean } | null)?.aiText;
  // force : appel depuis un toast (closure d'un rendu antérieur), écriture sans comparer l'état
  const setAiMark = (on: boolean, force = false) =>
    step &&
    (force || aiMarked !== on) &&
    editor.updateStep(step.id, {
      options: {
        ...(step.options as Record<string, unknown>),
        aiText: on || undefined,
      } as unknown as StepRow['options'],
    });
  const setOpts = (patch: Partial<StepOptions>) =>
    step && editor.updateStep(step.id, { options: { ...opts, ...patch } as unknown as StepRow['options'] });

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

      <RectFields
        id="hs-rect"
        rect={hotspot}
        disabled={readOnly}
        onChange={(r) => set({ x: r.x, y: r.y, w: r.w, h: r.h })}
      />

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
            placeholder={t('editor.newHotspot')}
            value={hotspot.title}
            onChange={(e) => {
              set({ title: e.target.value });
              // L38-9 : l'étape reprend le titre de sa première bulle tant qu'il n'a pas été saisi
              const first = editor.hotspots
                .filter((h) => h.step_id === hotspot.step_id)
                .sort((a, b) => a.position - b.position)[0];
              if (step && first?.id === hotspot.id && (!step.title.trim() || step.title === hotspot.title))
                editor.updateStep(step.id, { title: e.target.value });
              setAiMark(false);
            }}
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
          onChange={(v) => {
            set({ body: v });
            setAiMark(false);
          }}
          extra={
            // L30-02 : repère « IA » jusqu'à la prochaine modification manuelle
            isAiApplied(`hs:${hotspot.id}:body`, hotspot.body) || aiMarked ? (
              <>
                {' · '}
                <AiBadge fieldKey={`hs:${hotspot.id}:body`} text={hotspot.body} marked={aiMarked} />
              </>
            ) : undefined
          }
        />
        {ws && !readOnly && (
          <AiWrite
            ws={ws.id}
            lang={asSettings(editor.demo!.settings).locale ?? 'fr'}
            fieldKey={`hs:${hotspot.id}:body`}
            text={hotspot.body}
            title={hotspot.title || step?.title || ''}
            onApply={(next, _before, undo) =>
              editor.batch(() => {
                set({ body: next });
                setAiMark(!undo, !!undo);
              })
            }
            onAll={() => setSpellAll(true)}
          />
        )}
        {spellAll && ws && (
          <AiSpellAll
            editor={editor}
            ws={ws.id}
            lang={asSettings(editor.demo!.settings).locale ?? 'fr'}
            onClose={() => setSpellAll(false)}
          />
        )}
        <VariablePreview text={hotspot.body} variables={editor.variables} />
      </div>

      {/* L38-10 : voix off juste sous la consigne qu'elle lit (même piste que l'onglet Étape) */}
      {step && step.kind === 'image' && <VoiceFields editor={editor} step={step} readOnly={readOnly} chain />}

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
        {/* L12-05 : libellés de la bulle (vides = ceux du thème) et bouton « Précédent » facultatif */}
        <div className="sec-title">{t('editor.hs.buttons')}</div>
        <div className="hs-btns">
          <div className="field">
            <label htmlFor="hs-prev">{t('editor.hs.prev')}</label>
            <input
              id="hs-prev"
              className="input input-sm"
              maxLength={24}
              disabled={readOnly}
              value={opts.prevLabel}
              placeholder={t('editor.hs.prev')}
              aria-describedby="hs-prev-c"
              onChange={(e) => setOpts({ prevLabel: e.target.value })}
            />
            <span className="help" id="hs-prev-c">
              {opts.prevLabel.length} / 24
            </span>
          </div>
          <div className="field">
            <label htmlFor="hs-next">{t('editor.hs.next')}</label>
            <input
              id="hs-next"
              className="input input-sm"
              maxLength={24}
              disabled={readOnly}
              value={opts.buttonLabel}
              placeholder={isLast ? t('editor.hs.finish') : t('editor.hs.next')}
              aria-describedby="hs-next-c"
              onChange={(e) => setOpts({ buttonLabel: e.target.value })}
            />
            <span className="help" id="hs-next-c">
              {opts.buttonLabel.length} / 24
            </span>
          </div>
        </div>
        <div className="setting">
          <span className="t-label" id="hs-showprev">
            {t('editor.hs.showPrev')}
          </span>
          <span className="switch">
            <input
              type="checkbox"
              aria-labelledby="hs-showprev"
              checked={opts.showPrev}
              disabled={readOnly}
              onChange={(e) => setOpts({ showPrev: e.target.checked })}
            />
            <span />
          </span>
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
        <p className="help hs-btns-help">{t('editor.hs.labelsHelp')}</p>
      </div>

      {/* L12-03 : copier le style de cette étape sur toutes les étapes à bulle */}
      {!readOnly && step && (
        <div className="sec">
          <div className="sec-title">{t('editor.applyStyle.section')}</div>
          <p className="help hs-style-help">{t('editor.applyStyle.sectionHelp')}</p>
          <button
            type="button"
            className="btn btn-secondary btn-sm btn-block"
            onClick={() => setApplying(true)}
          >
            <Layers aria-hidden="true" />
            {t('editor.applyStyle.open')}
          </button>
          {applying && (
            <ApplyStyleDialog
              editor={editor}
              step={step}
              index={editor.steps.indexOf(step)}
              hotspot={hotspot}
              onClose={() => setApplying(false)}
            />
          )}
        </div>
      )}

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
