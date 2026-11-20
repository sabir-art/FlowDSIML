import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GitBranch } from 'lucide-react';
import type { Tables } from '@flowdsiml/supabase-types';
import { supabase } from '../../../lib/supabase';
import { formatNumber } from '../../../lib/format';
import { useConfirm } from '../../../components/ConfirmDialog';
import { useToast } from '../../../components/Toast';
import type { DemoEditor } from '../useDemoEditor';
import { asCta, type StepRow } from '../types';
import { abOutcome, type AbCounts, type AbGoal } from './abResult';
import './ab.css';

export type AbTest = Tables<'ab_tests'>;
type VariantB = { title?: string; body?: string; cta?: { label: string; url: string } | null };
export const asVariantB = (v: unknown): VariantB => (v && typeof v === 'object' ? (v as VariantB) : {});

/** Test A/B en cours de la démo (un seul à la fois), ses résultats et la variante affichée au canevas. */
export function useAbTest(demoId: string) {
  const [test, setTest] = useState<AbTest | null>(null);
  const [counts, setCounts] = useState<AbCounts | null>(null);
  const [view, setView] = useState<'A' | 'B'>('A');
  const load = useCallback(async () => {
    const { data } = await supabase
      .from('ab_tests')
      .select('*')
      .eq('demo_id', demoId)
      .eq('status', 'running')
      .maybeSingle();
    setTest(data ?? null);
    if (!data) {
      setCounts(null);
      setView('A');
    }
  }, [demoId]);
  useEffect(() => {
    void load();
  }, [load]);
  const loadCounts = useCallback(async (t: AbTest, goal?: AbGoal) => {
    const { data } = await supabase.rpc('ab_results', { p_test: t.id, p_goal: goal ?? t.goal });
    setCounts((data as unknown as AbCounts) ?? null);
  }, []);
  useEffect(() => {
    if (test) void loadCounts(test);
  }, [test, loadCounts]);
  return { test, setTest, counts, loadCounts, view, setView, reload: load };
}
export type AbState = ReturnType<typeof useAbTest>;

/** L18-02 : « Test A/B · Variante A / Variante B » au-dessus du canevas. */
export function AbCanvasSwitch({ ab }: { ab: AbState }) {
  const { t } = useTranslation();
  if (!ab.test) return null;
  return (
    <div className="ab-switch">
      <span className="ab-switch-l" id="ab-switch-l">
        {t('editor.ab.switch')}
      </span>
      <div className="segmented" role="radiogroup" aria-labelledby="ab-switch-l">
        {(['A', 'B'] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={ab.view === v}
            onClick={() => ab.setView(v)}
          >
            <span className={`ab-pill ab-pill--${v}`} aria-hidden="true">
              {v}
            </span>
            {t('editor.ab.variant', { v })}
          </button>
        ))}
      </div>
    </div>
  );
}

/** L18-01 et 02 : section « Test A/B » du panneau Étape (étape à bulle). */
export function AbSection({
  editor,
  step,
  index,
  readOnly,
  ab,
}: {
  editor: DemoEditor;
  step: StepRow;
  index: number;
  readOnly: boolean;
  ab: AbState;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [dialog, ask] = useConfirm();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const hotspot = editor.hotspots
    .filter((h) => h.step_id === step.id)
    .sort((a, b) => a.position - b.position)[0];
  const test = ab.test;
  const here = !!test && test.step_id === step.id;
  const otherN = test && !here ? editor.steps.findIndex((s) => s.id === test.step_id) + 1 : 0;

  // Saisie de B : enregistrée après une courte pause (horodatée dans l'historique du test)
  const [b, setB] = useState<VariantB>(() => asVariantB(test?.variant_b));
  useEffect(() => setB(asVariantB(test?.variant_b)), [test?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const timer = useRef<number | undefined>(undefined);
  const pending = useRef<VariantB>({});
  function editB(change: VariantB) {
    if (!test) return;
    const next = { ...b, ...change };
    setB(next);
    ab.setTest({ ...test, variant_b: next as AbTest['variant_b'] });
    pending.current = { ...pending.current, ...change };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const patch = pending.current;
      pending.current = {};
      // Le constructeur de requête ne part qu'une fois attendu
      void supabase
        .rpc('ab_update', { p_test: test.id, p_b: patch as AbTest['variant_b'] })
        .then(() => editor.markDirty());
    }, 700);
  }

  if (step.kind !== 'image' || !hotspot) return null;

  async function start() {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.rpc('ab_start', {
      p_hotspot: hotspot!.id,
      p_label: t('editor.ab.defaultLabel'),
    });
    setBusy(false);
    if (error) {
      const m = /AB_ALREADY_RUNNING:(\d+)/.exec(error.message);
      return setErr(m ? t('editor.ab.already', { n: m[1] }) : error.message);
    }
    editor.markDirty();
    await ab.reload();
    ab.setView('B');
  }

  async function setOpt(p: { p_split?: number; p_goal?: AbGoal; p_label?: string }) {
    if (!test) return;
    ab.setTest({
      ...test,
      split_b: p.p_split ?? test.split_b,
      goal: p.p_goal ?? test.goal,
      label_b: p.p_label ?? test.label_b,
    });
    await supabase.rpc('ab_update', { p_test: test.id, ...p });
    if (p.p_goal) await ab.loadCounts(test, p.p_goal);
    if (p.p_split) editor.markDirty();
  }

  async function end(keep: 'A' | 'B' | null) {
    if (!test) return;
    if (keep === null) {
      const yes = await ask({
        title: t('editor.ab.stopTitle'),
        body: t('editor.ab.stopBody'),
        confirmLabel: t('editor.ab.stop'),
        danger: true,
      });
      if (!yes) return;
    }
    const { error } = await supabase.rpc('ab_end', { p_test: test.id, ...(keep ? { p_keep: keep } : {}) });
    if (error) return setErr(error.message);
    if (keep === 'B') await editor.reload();
    editor.markDirty();
    toast(t(keep === 'B' ? 'editor.ab.keptB' : keep === 'A' ? 'editor.ab.keptA' : 'editor.ab.stopped'));
    await ab.reload();
  }

  if (!here) {
    return (
      <div className="sec ab-sec">
        {dialog}
        <div className="sec-title">{t('editor.ab.title')}</div>
        {/* L45 (E7) : texte → son bouton à 12 px */}
        <div className="fd-stack fd-stack--action">
          <p className="help">{t('editor.ab.intro')}</p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={readOnly || busy || !!test}
            aria-describedby={test ? 'ab-busy' : undefined}
            onClick={() => void start()}
          >
            <GitBranch aria-hidden="true" />
            {t('editor.ab.create')}
          </button>
        </div>
        {test && (
          <p className="help" id="ab-busy">
            {t('editor.ab.already', { n: otherN })}
          </p>
        )}
        {err && (
          <p className="field-error" role="alert">
            {err}
          </p>
        )}
      </div>
    );
  }

  const goal = test!.goal as AbGoal;
  const out = ab.counts ? abOutcome(ab.counts) : null;
  const day = Math.max(1, Math.ceil((Date.now() - new Date(test!.started_at).getTime()) / 86_400_000));
  const card = (v: 'A' | 'B') => {
    const c = ab.counts?.[v];
    const rate = c && c.visitors ? Math.round((100 * c.reached) / c.visitors) : null;
    return (
      <div className={`ab-card${out?.leader === v ? ` ab-card--lead ab-card--lead-${v}` : ''}`}>
        <span className="ab-card-head">
          <span className={`ab-pill ab-pill--${v}`} aria-hidden="true">
            {v}
          </span>
          <span className="ab-card-name">{v === 'A' ? t('editor.ab.original') : test!.label_b}</span>
        </span>
        <span className="ab-card-value">{rate === null ? '—' : `${rate}\u202f%`}</span>
        <span className="help">
          {t(`editor.ab.of_${goal}`)} ·{' '}
          {t('editor.ab.visitors', { count: c?.visitors ?? 0, n: formatNumber(c?.visitors ?? 0) })}
        </span>
      </div>
    );
  };

  return (
    <div className="sec ab-sec">
      {dialog}
      <div className="sec-title">
        {t('editor.ab.title')}
        <span className="badge badge-success">{t('editor.ab.running', { n: day })}</span>
      </div>
      <div className="ab-cards">
        {card('A')}
        {card('B')}
      </div>
      <p className="ab-result" role="status">
        {!out || out.tooFew
          ? t('editor.ab.tooFew')
          : out.leader
            ? t('editor.ab.leads', { v: out.leader, points: out.points, n: formatNumber(out.total) })
            : t('editor.ab.tie', { n: formatNumber(out.total) })}
        {out && !out.tooFew && out.total < 1000 && <> {t('editor.ab.reliable')}</>}
      </p>
      <div className="field">
        <label htmlFor="ab-goal">{t('editor.ab.goal')}</label>
        <select
          id="ab-goal"
          className="select input-sm"
          disabled={readOnly}
          value={goal}
          onChange={(e) => void setOpt({ p_goal: e.target.value as AbGoal })}
        >
          {(['completion', 'cta', 'lead'] as const).map((g) => (
            <option key={g} value={g}>
              {t(`editor.ab.goal_${g}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="ab-split">{t('editor.ab.split')}</label>
        <input
          id="ab-split"
          type="range"
          min={10}
          max={90}
          step={10}
          disabled={readOnly}
          value={100 - test!.split_b}
          aria-valuetext={t('editor.ab.splitValue', { a: 100 - test!.split_b, b: test!.split_b })}
          aria-describedby="ab-split-h"
          onChange={(e) => void setOpt({ p_split: 100 - Number(e.target.value) })}
        />
        <span className="ab-split-v" aria-hidden="true">
          A {100 - test!.split_b}&#8239;% · B {test!.split_b}&#8239;%
        </span>
        <span className="help" id="ab-split-h">
          {t('editor.ab.splitHelp')}
        </span>
      </div>
      <div className="field">
        <label htmlFor="ab-label">{t('editor.ab.label')}</label>
        <input
          id="ab-label"
          className="input input-sm"
          maxLength={40}
          disabled={readOnly}
          defaultValue={test!.label_b}
          onBlur={(e) => e.target.value.trim() && void setOpt({ p_label: e.target.value.trim() })}
        />
      </div>
      <div className="ab-b">
        <div className="sec-sub">{t('editor.ab.bText')}</div>
        <div className="field">
          <label htmlFor="ab-b-title">{t('editor.ab.bTitle')}</label>
          <input
            id="ab-b-title"
            className="input input-sm"
            maxLength={200}
            disabled={readOnly}
            value={b.title ?? ''}
            onChange={(e) => editB({ title: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="ab-b-body">{t('editor.ab.bBody')}</label>
          <textarea
            id="ab-b-body"
            className="textarea"
            rows={3}
            maxLength={4000}
            disabled={readOnly}
            value={b.body ?? ''}
            onChange={(e) => editB({ body: e.target.value })}
          />
        </div>
        {asCta(b.cta) && (
          <div className="field">
            <label htmlFor="ab-b-cta">{t('editor.ab.bCta')}</label>
            <input
              id="ab-b-cta"
              className="input input-sm"
              maxLength={40}
              disabled={readOnly}
              value={asCta(b.cta)!.label}
              onChange={(e) => editB({ cta: { ...asCta(b.cta)!, label: e.target.value } })}
            />
          </div>
        )}
      </div>
      {err && (
        <p className="field-error" role="alert">
          {err}
        </p>
      )}
      {!readOnly && (
        <div className="ab-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void end(out?.leader === 'A' ? 'A' : 'B')}
          >
            {t(out?.leader === 'A' ? 'editor.ab.keepA' : 'editor.ab.keepB')}
          </button>
          <button type="button" className="btn btn-ghost btn-sm ab-stop" onClick={() => void end(null)}>
            {t('editor.ab.stop')}
          </button>
        </div>
      )}
      <p className="help">{t('editor.ab.publishNote', { index: index + 1 })}</p>
    </div>
  );
}
