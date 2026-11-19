import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import {
  FIELDS,
  FIELD_ORDER,
  conditionValid,
  defaultCondition,
  normCode,
  opsFor,
  type Condition,
  type Field,
} from './segmentModel';
import { regionName } from './LiveTab';

type Demos = Array<{ id: string; title: string }>;
const GROUPS = ['visit', 'device', 'path', 'actions'] as const;

export function languageName(code: string): string {
  try {
    return (
      new Intl.DisplayNames([document.documentElement.lang || 'fr'], { type: 'language' }).of(code) ?? code
    );
  } catch {
    return code;
  }
}

/** Libellé lisible d'une valeur (« Mobile », « Oui », titre de la démo, « France »…). */
export function useValueLabel(demos: Demos) {
  const { t } = useTranslation();
  return (c: Condition): string => {
    const f = FIELDS[c.field];
    if (f.kind === 'bool') return c.value ? t('common.yes') : t('common.no');
    if (f.kind === 'list') return t(`analytics.adv.seg.v_${c.field}_${String(c.value)}`);
    if (f.kind === 'demo') return demos.find((d) => d.id === c.value)?.title ?? '—';
    if (c.field === 'country') return regionName(String(c.value));
    if (c.field === 'lang') return languageName(String(c.value));
    return String(c.value);
  };
}

/** Puce « Critère : valeur » (avec l'opérateur s'il n'est pas « est »). */
export function useChipLabel(demos: Demos) {
  const { t } = useTranslation();
  const value = useValueLabel(demos);
  return (c: Condition) => ({
    name: t(`analytics.adv.seg.f_${c.field}`),
    value: c.op === 'is' ? value(c) : `${t(`analytics.adv.seg.op_${c.op}`)} ${value(c)}`,
  });
}

/** Sélecteur de critère (groupes Visite, Appareil, Parcours, Actions). */
function FieldSelect({
  value,
  onChange,
  label,
}: {
  value: Field;
  onChange: (f: Field) => void;
  label: string;
}) {
  const { t } = useTranslation();
  return (
    <select
      className="select input-sm"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as Field)}
    >
      {GROUPS.map((g) => (
        <optgroup key={g} label={t(`analytics.adv.seg.g_${g}`)}>
          {FIELD_ORDER.filter((f) => FIELDS[f].group === g).map((f) => (
            <option key={f} value={f}>
              {t(`analytics.adv.seg.f_${f}`)}
            </option>
          ))}
          {/* L19-04 : critères à venir, visibles mais désactivés (jamais retirés) */}
          {(SOON[g] ?? []).map((k) => (
            <option key={k} value="" disabled>
              {t(`analytics.adv.seg.soon_${k}`)} · {t('shell.soon')}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/** Critères annoncés par la spec, pas encore calculés : affichés désactivés avec « Bientôt ». */
const SOON: Partial<Record<string, string[]>> = {
  visit: ['returning', 'utm'],
  device: ['city'],
};

function ValueInput({
  c,
  onChange,
  label,
  demos,
}: {
  c: Condition;
  onChange: (v: Condition['value']) => void;
  label: string;
  demos: Demos;
}) {
  const { t } = useTranslation();
  const f = FIELDS[c.field];
  const bad = !conditionValid(c);
  if (f.kind === 'bool')
    return (
      <select
        className="select input-sm"
        aria-label={label}
        value={String(c.value)}
        onChange={(e) => onChange(e.target.value === 'true')}
      >
        <option value="true">{t('common.yes')}</option>
        <option value="false">{t('common.no')}</option>
      </select>
    );
  if (f.kind === 'list' || f.kind === 'demo')
    return (
      <select
        className="select input-sm"
        aria-label={label}
        value={String(c.value)}
        onChange={(e) => onChange(e.target.value)}
      >
        {f.kind === 'demo'
          ? demos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))
          : f.values!.map((v) => (
              <option key={v} value={v}>
                {t(`analytics.adv.seg.v_${c.field}_${v}`)}
              </option>
            ))}
      </select>
    );
  if (f.kind === 'number')
    return (
      <input
        className="input input-sm num"
        type="number"
        min={0}
        max={999}
        aria-label={label}
        aria-invalid={bad || undefined}
        value={String(c.value)}
        onChange={(e) => onChange(Math.max(0, Math.min(999, Math.trunc(Number(e.target.value) || 0))))}
      />
    );
  return (
    <input
      className="input input-sm"
      aria-label={label}
      aria-invalid={bad || undefined}
      maxLength={f.kind === 'code' ? 2 : 100}
      placeholder={f.kind === 'code' ? (c.field === 'country' ? 'FR' : 'fr') : undefined}
      value={String(c.value)}
      onChange={(e) => onChange(f.kind === 'code' ? normCode(c.field, e.target.value) : e.target.value)}
    />
  );
}

/** Ligne du constructeur : connecteur, critère, opérateur, valeur, ×. */
export function ConditionRow({
  c,
  i,
  connector,
  demos,
  onChange,
  onRemove,
  disabled,
}: {
  c: Condition;
  i: number;
  connector: string;
  demos: Demos;
  onChange: (c: Condition) => void;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const n = i + 1;
  return (
    <fieldset className="cond" disabled={disabled}>
      <legend className="sr-only">{t('analytics.adv.seg.condition', { n })}</legend>
      <span className="cn" aria-hidden="true">
        {connector}
      </span>
      <FieldSelect
        label={t('analytics.adv.seg.criterionN', { n })}
        value={c.field}
        onChange={(f) => onChange(defaultCondition(f, demos[0]?.id))}
      />
      <select
        className="select input-sm"
        aria-label={t('analytics.adv.seg.operatorN', { n })}
        value={c.op}
        onChange={(e) => onChange({ ...c, op: e.target.value as Condition['op'] })}
      >
        {opsFor(c.field).map((o) => (
          <option key={o} value={o}>
            {t(`analytics.adv.seg.op_${o}`)}
          </option>
        ))}
      </select>
      <ValueInput
        c={c}
        demos={demos}
        label={t('analytics.adv.seg.valueN', { n })}
        onChange={(value) => onChange({ ...c, value })}
      />
      {onRemove ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-icon"
          aria-label={t('analytics.adv.seg.removeN', { n })}
          onClick={onRemove}
        >
          <X aria-hidden="true" />
        </button>
      ) : (
        <span />
      )}
    </fieldset>
  );
}

/** « Ajouter un filtre » : une condition (critère, opérateur, valeur). */
export function AddFilterDialog({
  demos,
  onAdd,
  onClose,
}: {
  demos: Demos;
  onAdd: (c: Condition) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const [c, setC] = useState<Condition>(() => defaultCondition('device'));
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const ok = conditionValid(c);
  return (
    <dialog ref={ref} className="mk l19-filter" aria-labelledby={`${id}-t`} onClose={onClose}>
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ok) return;
          onAdd(c);
          ref.current?.close();
        }}
      >
        <div className="modal-head">
          <h2 id={`${id}-t`}>{t('analytics.adv.seg.addFilter')}</h2>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            aria-label={t('common.close')}
            onClick={() => ref.current?.close()}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body">
          <ConditionRow c={c} i={0} connector={t('analytics.adv.seg.if')} demos={demos} onChange={setC} />
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={() => ref.current?.close()}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" aria-disabled={!ok || undefined}>
            {t('analytics.adv.seg.apply')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
