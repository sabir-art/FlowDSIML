import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Filter, Layers, Plus, X } from 'lucide-react';
import { AddFilterDialog, useChipLabel } from './segmentUi';
import { MAX_CONDITIONS, type Condition, type SegmentDef } from './segmentModel';
import type { Segment } from './SegmentsTab';

/**
 * L19-04 : barre de filtres (puces « Critère : valeur » avec ×, « Ajouter un filtre », « Enregistrer
 * comme segment », segments enregistrés). Les filtres sont gardés dans l'URL (?f= ou ?seg=).
 */
export function FilterBar({
  def,
  segment,
  segments,
  demos,
  canEdit,
  onChange,
  onSegment,
  onSave,
}: {
  def: SegmentDef | null;
  segment: Segment | null;
  segments: Segment[];
  demos: Array<{ id: string; title: string }>;
  canEdit: boolean;
  onChange: (d: SegmentDef | null) => void;
  onSegment: (s: Segment | null) => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  const chip = useChipLabel(demos);
  const [adding, setAdding] = useState(false);
  const conds = def?.conditions ?? [];
  const add = (c: Condition) => onChange({ match: def?.match ?? 'all', conditions: [...conds, c] });
  // L48-D D1 : critères et « Ajouter un filtre » dans la ligne des filtres de la page, après Source
  return (
    <>
      {segment && (
        <span className="fd-btn fd-filter fd-filter--active l19-cond">
          <Layers aria-hidden="true" />
          <span className="fd-filter__label">{t('analytics.adv.seg.segmentChip')}&#8239;: </span>
          <span className="fd-filter__value" title={segment.name}>
            {segment.name}
          </span>
          <button
            type="button"
            aria-label={t('analytics.adv.seg.removeFilter', { name: segment.name })}
            onClick={() => onSegment(null)}
          >
            <X aria-hidden="true" />
          </button>
        </span>
      )}
      {conds.map((c, i) => {
        const l = chip(c);
        return (
          <span key={i} className="fd-btn fd-filter fd-filter--active l19-cond">
            <Filter aria-hidden="true" />
            <span className="fd-filter__label">{l.name}&#8239;: </span>
            <span className="fd-filter__value" title={l.value}>
              {l.value}
            </span>
            <button
              type="button"
              aria-label={t('analytics.adv.seg.removeFilter', { name: l.name })}
              onClick={() => {
                const rest = conds.filter((_, j) => j !== i);
                onChange(rest.length ? { match: def!.match, conditions: rest } : null);
              }}
            >
              <X aria-hidden="true" />
            </button>
          </span>
        );
      })}
      {!segment && conds.length < MAX_CONDITIONS && (
        <button
          type="button"
          className="fd-btn fd-filter"
          aria-haspopup="dialog"
          onClick={() => setAdding(true)}
        >
          <Plus aria-hidden="true" />
          <span className="fd-filter__value">{t('analytics.adv.seg.addFilter')}</span>
        </button>
      )}
      {canEdit && conds.length > 0 && (
        <button type="button" className="fd-btn" onClick={onSave}>
          {t('analytics.adv.seg.saveAs')}
        </button>
      )}
      {segments.length > 0 && (
        <span className="t-caption muted l19-seglinks">
          {t('analytics.adv.seg.segmentsLine')}{' '}
          {segments.slice(0, 4).map((s, i) => (
            <span key={s.id}>
              {i > 0 && ' · '}
              <button
                type="button"
                className="l19-link"
                aria-pressed={segment?.id === s.id}
                onClick={() => onSegment(s)}
              >
                {s.name}
              </button>
            </span>
          ))}
        </span>
      )}
      {adding && <AddFilterDialog demos={demos} onAdd={add} onClose={() => setAdding(false)} />}
    </>
  );
}
