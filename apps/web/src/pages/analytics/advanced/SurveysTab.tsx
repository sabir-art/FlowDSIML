import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatDate, formatNumber } from '../../../lib/format';
import { Loading } from '../../../components/guards';
import { abOutcome, type AbCounts } from '../../editor/ab/abResult';
import { Empty, Status, Select } from '@flowdsiml/ui';
import { ListChecks } from 'lucide-react';

export interface SurveyQuestion {
  id: string;
  type: 'single' | 'multiple' | 'truefalse' | 'nps' | 'text';
  prompt: string;
  responses: number;
  nps: { histogram: number[]; score: number | null } | null;
  choices: Array<{ id: string; label: string; n: number }> | null;
}
interface ChoiceStep {
  stepId: string;
  choices: Array<{ label: string; visitors: number; completed: number }>;
}
interface AbRow {
  id: string;
  step_id: string;
  status: string;
  goal: string;
  label_b: string;
  started_at: string;
  ended_at: string | null;
  counts: AbCounts | null;
}

/** Score de recommandation affiché seulement à partir de 20 réponses (calculé en base). */
export const NPS_MIN = 20;
const pct = (n: number, d: number) => (d ? Math.round((100 * n) / d) : 0);

/**
 * L19-03 : résultats des tests A/B, des sondages (note de 0 à 10, choix, réponses écrites) et des
 * menus de choix d'une démo. Les réponses écrites ne sont lues que par les éditeurs (survey_texts).
 */
export function SurveysTab({
  demo,
  demos,
  days,
  canEdit,
}: {
  demo: string;
  demos: Array<{ id: string; title: string }>;
  days: number;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const [target, setTarget] = useState(demo || demos[0]?.id || '');
  useEffect(() => setTarget(demo || demos[0]?.id || ''), [demo, demos]);
  const [res, setRes] = useState<{
    questions: SurveyQuestion[];
    choices: ChoiceStep[];
    ab: AbRow[];
    steps: Map<string, { position: number; title: string }>;
  } | null>(null);
  const [texts, setTexts] = useState<SurveyQuestion | null>(null);

  useEffect(() => {
    if (!target) return;
    setRes(null);
    const from = new Date(Date.now() - days * 86400_000).toISOString();
    const range = { p_demo: target, p_from: from, p_to: new Date().toISOString() };
    void Promise.all([
      supabase.rpc('survey_results', range),
      supabase.rpc('choice_results', range),
      supabase
        .from('ab_tests')
        .select('id, step_id, status, goal, label_b, started_at, ended_at')
        .eq('demo_id', target)
        .or(`status.eq.running,ended_at.gte.${from}`)
        .order('started_at', { ascending: false }),
      supabase.from('steps').select('id, position, title').eq('demo_id', target),
    ]).then(async ([q, c, a, s]) => {
      const ab = ((a.data ?? []) as Omit<AbRow, 'counts'>[]).slice(0, 6);
      const counts = await Promise.all(
        ab.map((x) => supabase.rpc('ab_results', { p_test: x.id, p_goal: x.goal })),
      );
      setRes({
        questions: (q.data ?? []) as unknown as SurveyQuestion[],
        choices: (c.data ?? []) as unknown as ChoiceStep[],
        ab: ab.map((x, i) => ({ ...x, counts: (counts[i]?.data as unknown as AbCounts) ?? null })),
        steps: new Map(
          ((s.data ?? []) as Array<{ id: string; position: number; title: string }>).map((x) => [x.id, x]),
        ),
      });
    });
  }, [target, days]);

  if (!target) return <div className="card empty">{t('analytics.adv.tests.empty')}</div>;
  const picker = !demo && (
    <Select
      size="sm"
      className="l19-picker"
      aria-label={t('analytics.adv.tests.demo')}
      value={target}
      onChange={(e) => setTarget(e.target.value)}
    >
      {demos.map((d) => (
        <option key={d.id} value={d.id}>
          {d.title}
        </option>
      ))}
    </Select>
  );
  if (!res)
    return (
      <>
        {picker}
        <Loading />
      </>
    );
  const stepNo = (id: string) => (res.steps.get(id)?.position ?? -1) + 1;
  const empty = !res.ab.length && !res.questions.length && !res.choices.length;

  return (
    <div className="l19">
      {picker}
      {empty && (
        <Empty
          live
          icon={<ListChecks />}
          title={t('analytics.adv.tests.emptyTitle')}
          body={t('analytics.adv.tests.empty')}
        />
      )}
      <div className="l19-grid">
        {res.ab.map((x) => (
          <AbCard key={x.id} ab={x} step={stepNo(x.step_id)} demo={target} />
        ))}
        {res.questions.map((q) =>
          q.type === 'nps' ? (
            <NpsCard key={q.id} q={q} />
          ) : q.type === 'text' ? (
            // L19-03 : réponse écrite en pleine largeur (pas de vide à droite)
            <div key={q.id} className="card chart-card l19-wide">
              <h2 className="t-h3">{q.prompt || t('analytics.adv.tests.textQuestion')}</h2>
              <p className="t-caption muted">{t('analytics.adv.tests.textCount', { count: q.responses })}</p>
              {canEdit && q.responses > 0 ? (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTexts(q)}>
                  {t('analytics.adv.tests.seeTexts', { count: q.responses })}
                </button>
              ) : (
                !canEdit && <p className="help">{t('analytics.adv.tests.textsEditors')}</p>
              )}
            </div>
          ) : (
            <div key={q.id} className="card chart-card">
              <h2 className="t-h3">{q.prompt}</h2>
              <p className="t-caption muted">{t('analytics.adv.tests.responses', { count: q.responses })}</p>
              <Bars rows={(q.choices ?? []).map((c) => ({ label: c.label, value: pct(c.n, q.responses) }))} />
            </div>
          ),
        )}
        {res.choices.map((c) => {
          const total = c.choices.reduce((s, x) => s + x.visitors, 0);
          const step = res.steps.get(c.stepId);
          return (
            <div key={c.stepId} className="card chart-card l19-wide">
              <h2 className="t-h3">
                {t('analytics.adv.tests.choiceTitle', {
                  n: (step?.position ?? -1) + 1,
                  title: step?.title || '—',
                })}
              </h2>
              <p className="t-caption muted">{t('analytics.adv.tests.visitors', { count: total })}</p>
              <Bars rows={c.choices.map((x) => ({ label: x.label, value: pct(x.visitors, total) }))} />
              <p className="t-caption muted l19-after">
                {t('analytics.adv.tests.after', {
                  values: c.choices
                    .map((x) => `${x.label}\u00a0${pct(x.completed, x.visitors)}\u202f%`)
                    .join(', '),
                })}
              </p>
            </div>
          );
        })}
      </div>
      {texts && <TextsDrawer demo={target} q={texts} onClose={() => setTexts(null)} />}
    </div>
  );
}

function Bars({ rows }: { rows: Array<{ label: string; value: number }> }) {
  return (
    <div className="col l19-bars">
      {rows.map((r, i) => (
        <div key={i} className="hbar">
          <span>{r.label}</span>
          <span className="tr" aria-hidden="true">
            <span style={{ width: `${r.value}%` }} />
          </span>
          <span className="num">{r.value}&#8239;%</span>
        </div>
      ))}
    </div>
  );
}

export function NpsCard({ q }: { q: SurveyQuestion }) {
  const { t } = useTranslation();
  const h = q.nps?.histogram ?? Array(11).fill(0);
  const max = Math.max(1, ...h);
  const score = q.nps?.score ?? null;
  return (
    <div className="card chart-card">
      <h2 className="t-h3">{t('analytics.adv.tests.npsTitle')}</h2>
      <p className="t-caption muted l19-q">
        {t('analytics.adv.tests.question', { q: q.prompt })} ·{' '}
        {t('analytics.adv.tests.responses', { count: q.responses })}
      </p>
      {score === null || q.responses < NPS_MIN ? (
        <p className="muted">{t('analytics.adv.tests.npsTooFew', { count: q.responses })}</p>
      ) : (
        <div className="row l19-score">
          <span className="l19-big">{score > 0 ? `+${score}` : score}</span>
          <span className="t-caption muted">{t('analytics.adv.tests.npsDef')}</span>
        </div>
      )}
      <div
        className="nps"
        /* §18.6 : barres empilées du NPS, accolées */ data-gap-exempt=""
        role="img"
        aria-label={t('analytics.adv.tests.npsAria', {
          values: h.map((n, i) => `${i}\u00a0: ${n}`).join(', '),
        })}
      >
        {h.map((n, i) => (
          <div key={i} className={`b${i >= 7 ? ' p' : ''}`}>
            <span style={{ height: `${Math.round((100 * n) / max)}px` }} />
            {i}
          </div>
        ))}
      </div>
    </div>
  );
}

function AbCard({ ab, step, demo }: { ab: AbRow; step: number; demo: string }) {
  const { t } = useTranslation();
  const c = ab.counts;
  const out = c ? abOutcome(c) : null;
  const rate = (v: { visitors: number; reached: number }) => pct(v.reached, v.visitors);
  const day = Math.max(1, Math.ceil((Date.now() - new Date(ab.started_at).getTime()) / 86400_000));
  return (
    <div className="card chart-card">
      <div className="row between">
        <h2 className="t-h3">{t('analytics.adv.tests.abTitle', { n: step })}</h2>
        {ab.status === 'running' ? (
          <Status size="sm" tone="success">
            {t('editor.ab.running', { n: day })}
          </Status>
        ) : (
          <Status size="sm">{t('analytics.adv.tests.abEnded')}</Status>
        )}
      </div>
      <p className="t-caption muted l19-q">
        {t('editor.ab.goal')}&#8239;: {t(`editor.ab.goal_${ab.goal}`)}
      </p>
      {c && (
        <div className="l19-ab">
          {(['A', 'B'] as const).map((v) => (
            <div key={v} className={`vc${out?.leader === v ? ' best' : ''}`}>
              <span className="row">
                <span className={`abv ${v.toLowerCase()}`} aria-hidden="true">
                  {v}
                </span>
                <b>{v === 'A' ? t('editor.ab.original') : ab.label_b || t('editor.ab.defaultLabel')}</b>
              </span>
              <span className="l19-rate">{rate(c[v])}&#8239;%</span>
              <span className="t-caption muted">
                {t('editor.ab.visitors', { count: c[v].visitors, n: formatNumber(c[v].visitors) })}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="l19-ab-lead">
        <b>
          {!out || out.tooFew
            ? t('editor.ab.tooFew')
            : out.leader
              ? t('editor.ab.leads', { v: out.leader, points: out.points, n: formatNumber(out.total) })
              : t('editor.ab.tie', { n: formatNumber(out.total) })}
        </b>
      </p>
      <p className="t-caption muted">{t('editor.ab.reliable')}</p>
      <Link className="btn btn-secondary btn-sm" to={`/demos/${demo}/edit`}>
        {t('analytics.openInEditor')}
      </Link>
    </div>
  );
}

/** Réponses écrites (tiroir) : date et texte, identité d'un apprenant identifié seulement. */
function TextsDrawer({ demo, q, onClose }: { demo: string; q: SurveyQuestion; onClose: () => void }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const [rows, setRows] = useState<Array<{ at: string; text: string; learner: string | null }> | null>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    void supabase
      .rpc('survey_texts', { p_demo: demo, p_question: q.id })
      .then(({ data }) =>
        setRows((data ?? []) as unknown as Array<{ at: string; text: string; learner: string | null }>),
      );
  }, [demo, q.id]);
  return (
    <dialog ref={ref} className="mk l19-drawer" aria-labelledby="l19-tx" onClose={onClose}>
      <div className="modal-head">
        <h2 id="l19-tx">{t('analytics.adv.tests.textsTitle')}</h2>
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
        <p className="t-caption muted">{q.prompt}</p>
        {!rows ? (
          <Loading />
        ) : (
          <ul className="l19-texts">
            {rows.map((r, i) => (
              <li key={i}>
                <p>{r.text}</p>
                <span className="t-caption muted">
                  {formatDate(r.at)}
                  {r.learner ? ` · ${r.learner}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </dialog>
  );
}
