import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Save } from 'lucide-react';
import type { Tables } from '@flowdsiml/supabase-types';
import { supabase } from '../../../lib/supabase';
import { formatNumber } from '../../../lib/format';
import { useToast } from '../../../components/Toast';
import { useConfirm } from '../../../components/ConfirmDialog';
import { Menu } from '../../../components/Menu';
import { ConditionRow } from './segmentUi';
import { MAX_CONDITIONS, NAME_MAX, defValid, defaultCondition, type SegmentDef } from './segmentModel';

export type Segment = Tables<'segments'>;
type Demos = Array<{ id: string; title: string }>;

/** Nombre de visiteurs du segment sur la période (segment_count, viewer). */
export async function countSegment(wsId: string, seg: unknown, days: number): Promise<number | null> {
  const { data, error } = await supabase.rpc('segment_count', {
    p_workspace: wsId,
    p_segment: seg as never,
    p_from: new Date(Date.now() - days * 86400_000).toISOString(),
    p_to: new Date().toISOString(),
  });
  return error ? null : Number((data as { visitors?: number } | null)?.visitors ?? 0);
}

/**
 * L19-04 : constructeur de segments (8 conditions, ET / OU, compteur en direct au plus toutes les
 * 500 ms) et segments enregistrés du workspace (Renommer, Dupliquer, Supprimer : éditeurs).
 */
export function SegmentsTab({
  wsId,
  days,
  demos,
  canEdit,
  initial,
  segments,
  reload,
  onApply,
}: {
  wsId: string;
  days: number;
  demos: Demos;
  canEdit: boolean;
  /** Préremplissage depuis « Enregistrer comme segment ». */
  initial: SegmentDef | null;
  segments: Segment[];
  reload: () => Promise<void>;
  onApply: (s: Segment) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const id = useId();
  const [dialog, ask] = useConfirm();
  const blank = (): SegmentDef => ({ match: 'all', conditions: [defaultCondition('device')] });
  const [def, setDef] = useState<SegmentDef>(initial ?? blank());
  const [name, setName] = useState('');
  // undefined : calcul en cours ; null : définition incomplète
  const [count, setCount] = useState<number | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [renaming, setRenaming] = useState<Segment | null>(null);

  useEffect(() => {
    if (initial) setDef(initial);
  }, [initial]);

  // Compteur en direct : au plus toutes les 500 ms, seulement pour une définition valide
  useEffect(() => {
    if (!defValid(def)) return setCount(null);
    setCount(undefined);
    const timer = window.setTimeout(() => {
      void countSegment(wsId, def, days).then(setCount);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [wsId, def, days]);

  useEffect(() => {
    let off = false;
    void Promise.all(segments.map((s) => countSegment(wsId, { id: s.id }, days))).then(
      (n) => !off && setCounts(Object.fromEntries(segments.map((s, i) => [s.id, n[i] ?? null]))),
    );
    return () => {
      off = true;
    };
  }, [wsId, segments, days]);

  const conn = (i: number) =>
    i === 0
      ? t('analytics.adv.seg.if')
      : def.match === 'any'
        ? t('analytics.adv.seg.or')
        : t('analytics.adv.seg.and');

  async function save() {
    setErr(null);
    const n = name.trim();
    if (!n) return setErr(t('analytics.adv.seg.nameRequired'));
    if (!defValid(def)) return setErr(t('analytics.adv.seg.invalid'));
    const { error } = await supabase
      .from('segments')
      .insert({ workspace_id: wsId, name: n, match: def.match, conditions: def.conditions as never });
    if (error)
      return setErr(error.code === '23505' ? t('analytics.adv.seg.nameTaken') : t('analytics.adv.seg.error'));
    toast(t('analytics.adv.seg.saved', { name: n }));
    setName('');
    setDef(blank());
    await reload();
  }

  async function duplicate(s: Segment) {
    const base = `${s.name} (${t('analytics.adv.seg.copy')})`.slice(0, NAME_MAX);
    const { error } = await supabase
      .from('segments')
      .insert({ workspace_id: wsId, name: base, match: s.match, conditions: s.conditions });
    if (error) return toast(t('analytics.adv.seg.error'));
    await reload();
  }

  async function remove(s: Segment) {
    const yes = await ask({
      title: t('analytics.adv.seg.deleteTitle', { name: s.name }),
      body: t('analytics.adv.seg.deleteBody'),
      confirmLabel: t('common.delete'),
      danger: true,
    });
    if (!yes) return;
    await supabase.from('segments').delete().eq('id', s.id);
    await reload();
  }

  return (
    <div className="two-1 l19">
      {dialog}
      <div className="card card-pad col l19-builder">
        <h2 className="t-h3">{t('analytics.adv.seg.new')}</h2>
        {!canEdit && <p className="help">{t('analytics.adv.seg.viewerHelp')}</p>}
        <div className="field">
          <label htmlFor={`${id}-n`}>{t('analytics.adv.seg.name')}</label>
          <input
            id={`${id}-n`}
            className="input"
            maxLength={NAME_MAX}
            value={name}
            disabled={!canEdit}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="segmented l19-match" role="radiogroup" aria-label={t('analytics.adv.seg.match')}>
          {(['all', 'any'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={def.match === m}
              onClick={() => setDef({ ...def, match: m })}
            >
              {t(`analytics.adv.seg.match_${m}`)}
            </button>
          ))}
        </div>
        {def.conditions.map((c, i) => (
          <ConditionRow
            key={i}
            c={c}
            i={i}
            connector={conn(i)}
            demos={demos}
            onChange={(nc) =>
              setDef({ ...def, conditions: def.conditions.map((x, j) => (j === i ? nc : x)) })
            }
            onRemove={
              def.conditions.length > 1
                ? () => setDef({ ...def, conditions: def.conditions.filter((_, j) => j !== i) })
                : undefined
            }
          />
        ))}
        <div className="row between wrap">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-disabled={def.conditions.length >= MAX_CONDITIONS || undefined}
            onClick={() =>
              def.conditions.length < MAX_CONDITIONS &&
              setDef({ ...def, conditions: [...def.conditions, defaultCondition('completed')] })
            }
          >
            <Plus aria-hidden="true" />
            {t('analytics.adv.seg.addCondition')}
          </button>
          <span className="badge badge-primary seg-count" aria-live="polite">
            {count === undefined
              ? '…'
              : count === null
                ? t('analytics.adv.seg.countUnknown')
                : t('analytics.adv.seg.matching', { count, n: formatNumber(count) })}
          </span>
        </div>
        {err && (
          <p className="help is-error" role="alert">
            {err}
          </p>
        )}
        {canEdit && (
          <div className="row l19-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setDef(blank());
                setName('');
                setErr(null);
              }}
            >
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void save()}>
              <Save aria-hidden="true" />
              {t('analytics.adv.seg.save')}
            </button>
          </div>
        )}
      </div>
      <aside className="card card-pad col l19-saved">
        <h2 className="t-h3">{t('analytics.adv.seg.savedTitle')}</h2>
        {segments.length === 0 && <p className="muted">{t('analytics.adv.seg.none')}</p>}
        <ul className="l19-seglist">
          {segments.map((s) => (
            <li key={s.id} className="row between">
              <button type="button" className="l19-link" onClick={() => onApply(s)}>
                {s.name}
              </button>
              <span className="row">
                <span className="t-caption muted num">
                  {counts[s.id] === undefined || counts[s.id] === null ? '…' : formatNumber(counts[s.id]!)}
                </span>
                {canEdit && (
                  <Menu
                    label={t('analytics.adv.seg.actions', { name: s.name })}
                    items={[
                      { label: t('analytics.adv.seg.rename'), onSelect: () => setRenaming(s) },
                      { label: t('analytics.adv.seg.duplicate'), onSelect: () => void duplicate(s) },
                      { label: t('common.delete'), danger: true, onSelect: () => void remove(s) },
                    ]}
                  />
                )}
              </span>
            </li>
          ))}
        </ul>
        <hr className="divider" />
        <p className="t-caption muted">{t('analytics.adv.seg.shared')}</p>
      </aside>
      {renaming && (
        <RenameDialog
          seg={renaming}
          onClose={() => setRenaming(null)}
          onDone={async () => {
            setRenaming(null);
            await reload();
          }}
        />
      )}
    </div>
  );
}

function RenameDialog({
  seg,
  onClose,
  onDone,
}: {
  seg: Segment;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(seg.name);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog ref={ref} className="mk l19-filter" aria-labelledby={`${id}-t`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim();
          if (!n) return setErr(t('analytics.adv.seg.nameRequired'));
          void supabase
            .from('segments')
            .update({ name: n })
            .eq('id', seg.id)
            .then(({ error }) =>
              error
                ? setErr(
                    error.code === '23505' ? t('analytics.adv.seg.nameTaken') : t('analytics.adv.seg.error'),
                  )
                : void onDone(),
            );
        }}
      >
        <div className="modal-head">
          <h2 id={`${id}-t`}>{t('analytics.adv.seg.renameTitle')}</h2>
        </div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor={`${id}-n`}>{t('analytics.adv.seg.name')}</label>
            <input
              id={`${id}-n`}
              className="input"
              maxLength={NAME_MAX}
              value={name}
              aria-describedby={err ? `${id}-e` : undefined}
              onChange={(e) => setName(e.target.value)}
            />
            {err && (
              <p className="help is-error" id={`${id}-e`} role="alert">
                {err}
              </p>
            )}
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={() => ref.current?.close()}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary">
            {t('common.save')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
