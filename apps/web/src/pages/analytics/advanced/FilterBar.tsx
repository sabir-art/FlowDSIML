import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
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
  tooSmall,
  onChange,
  onSegment,
  onSave,
}: {
  def: SegmentDef | null;
  segment: Segment | null;
  segments: Segment[];
  demos: Array<{ id: string; title: string }>;
  canEdit: boolean;
  tooSmall: boolean;
  onChange: (d: SegmentDef | null) => void;
  onSegment: (s: Segment | null) => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  const chip = useChipLabel(demos);
  const [adding, setAdding] = useState(false);
  const conds = def?.conditions ?? [];
  const add = (c: Condition) => onChange({ match: def?.match ?? 'all', conditions: [...conds, c] });
  return (
    <div className="l19-filterbar" role="group" aria-label={t('analytics.adv.seg.filters')}>
      <div className="chips">
        {segment && (
          <span className="chip">
            {t('analytics.adv.seg.segmentChip')}&#8239;: <b>{segment.name}</b>
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
            <span key={i} className="chip">
              {l.name}&#8239;: <b>{l.value}</b>
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
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" />
            {t('analytics.adv.seg.addFilter')}
          </button>
        )}
        {canEdit && conds.length > 0 && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onSave}>
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
      </div>
      {tooSmall && (
        <p className="help l19-small" role="status">
          {t('analytics.adv.seg.tooSmall')}
        </p>
      )}
      {adding && <AddFilterDialog demos={demos} onAdd={add} onClose={() => setAdding(false)} />}
    </div>
  );
}
