import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Sparkles, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../Toast';
import { AiRequestError, aiBlock, callAi, useAiStatus } from '../../lib/ai';
import { useBlockText } from './AiWrite';
import './ai.css';

export interface GenStep {
  title: string;
  text: string;
}
export interface GenChapter {
  title: string;
  steps: GenStep[];
}
export interface GenQuiz {
  prompt: string;
  answers: Array<{ text: string; correct: boolean }>;
}
export interface GenPlan {
  title: string;
  chapters: GenChapter[];
  quiz: GenQuiz[];
}

export const PLAN_MAX = 4000;
export const stepCount = (p: GenPlan) => p.chapters.reduce((n, c) => n + c.steps.length, 0);

/**
 * Crée la démo en brouillon : chapitres, étapes « À capturer » (comme un modèle, L26-04) avec une bulle
 * par étape, quiz éventuel. Chaque étape porte le repère `aiText` (bilan RGPD, repère « IA »).
 */
export async function createGeneratedDemo(opts: {
  ws: string;
  userId: string;
  folderId: string | null;
  lang: string;
  plan: GenPlan;
}): Promise<string> {
  const { ws, plan } = opts;
  const { data: demo, error } = await supabase
    .from('demos')
    .insert({
      workspace_id: ws,
      title: plan.title.slice(0, 160),
      created_by: opts.userId,
      folder_id: opts.folderId,
      settings: { locale: opts.lang } as never,
    })
    .select()
    .single();
  if (error || !demo) throw error ?? new Error('demo');
  const named = plan.chapters.filter((c) => c.title.trim());
  const chapters = named.map((c, i) => ({
    id: crypto.randomUUID(),
    demo_id: demo.id,
    workspace_id: ws,
    title: c.title.slice(0, 120),
    position: i,
  }));
  if (chapters.length) {
    const r = await supabase.from('chapters').insert(chapters);
    if (r.error) throw r.error;
  }
  const steps: Array<Record<string, unknown>> = [];
  const hotspots: Array<Record<string, unknown>> = [];
  let pos = 0;
  for (const c of plan.chapters) {
    const ci = named.indexOf(c);
    for (const s of c.steps) {
      const id = crypto.randomUUID();
      steps.push({
        id,
        demo_id: demo.id,
        workspace_id: ws,
        position: pos++,
        chapter_id: ci >= 0 ? chapters[ci]!.id : null,
        kind: 'image',
        title: s.title.slice(0, 200),
        to_capture: true,
        options: { aiText: true },
      });
      hotspots.push({
        step_id: id,
        demo_id: demo.id,
        workspace_id: ws,
        x: 0.45,
        y: 0.45,
        w: 0.1,
        h: 0.06,
        title: s.title.slice(0, 200),
        body: s.text.slice(0, 4000),
        position: 0,
      });
    }
  }
  const rs = await supabase.from('steps').insert(steps as never);
  if (rs.error) throw rs.error;
  const rh = await supabase.from('hotspots').insert(hotspots as never);
  if (rh.error) throw rh.error;
  if (plan.quiz.length) {
    const rq = await supabase.from('quiz_questions').insert(
      plan.quiz.map((q, i) => ({
        demo_id: demo.id,
        workspace_id: ws,
        position: i,
        type: 'single',
        prompt: q.prompt.slice(0, 200),
        answers: q.answers.map((a) => ({ id: crypto.randomUUID(), label: a.text, correct: a.correct })),
        explanation: '',
        points: 1,
      })) as never,
    );
    if (rq.error) throw rq.error;
  }
  return demo.id as string;
}

/** L30-05 : « Générer avec l'IA » (Nouvelle démo). Plan texte, aperçu modifiable, création en brouillon. */
export function GenerateDialog({
  ws,
  userId,
  folderId,
  lang,
  onClose,
}: {
  ws: string;
  userId: string;
  folderId: string | null;
  lang: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const blockText = useBlockText();
  const { status } = useAiStatus(ws);
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState('');
  const [withQuiz, setWithQuiz] = useState(false);
  const [phase, setPhase] = useState<'input' | 'busy' | 'ready' | 'error' | 'blocked' | 'saving'>('input');
  const [message, setMessage] = useState('');
  const [plan, setPlan] = useState<GenPlan | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    ref.current?.showModal();
    return () => ctrl.current?.abort();
  }, []);

  const generate = async () => {
    const b = aiBlock(status, 'generate');
    if (b) {
      setMessage(blockText(b, status));
      return setPhase('blocked');
    }
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setPhase('busy');
    try {
      const r = await callAi<GenPlan>(ws, 'generate', lang, { plan: text, withQuiz }, c.signal);
      setPlan(r);
      setPhase('ready');
    } catch (e) {
      if (e instanceof AiRequestError && e.code === 'ABORTED') return setPhase('input');
      if (e instanceof AiRequestError && (e.code === 'AI_QUOTA_WORKSPACE' || e.code === 'AI_QUOTA_USER')) {
        setMessage(blockText(e.code === 'AI_QUOTA_USER' ? 'userQuota' : 'quota', status));
        return setPhase('blocked');
      }
      setPhase('error');
    }
  };

  const create = async () => {
    if (!plan) return;
    setPhase('saving');
    try {
      const id = await createGeneratedDemo({ ws, userId, folderId, lang, plan });
      onClose();
      toast(t('ai.generate.created'));
      navigate(`/demos/${id}/edit`);
    } catch {
      setMessage(t('ai.generate.createError'));
      setPhase('ready');
    }
  };

  const setStep = (ci: number, si: number, patch: Partial<GenStep>) =>
    setPlan(
      (p) =>
        p && {
          ...p,
          chapters: p.chapters.map((c, i) =>
            i === ci ? { ...c, steps: c.steps.map((s, j) => (j === si ? { ...s, ...patch } : s)) } : c,
          ),
        },
    );
  const removeStep = (ci: number, si: number) =>
    setPlan(
      (p) =>
        p && {
          ...p,
          chapters: p.chapters
            .map((c, i) => (i === ci ? { ...c, steps: c.steps.filter((_, j) => j !== si) } : c))
            .filter((c) => c.steps.length),
        },
    );
  const addStep = (ci: number) =>
    setPlan(
      (p) =>
        p && {
          ...p,
          chapters: p.chapters.map((c, i) =>
            i === ci ? { ...c, steps: [...c.steps, { title: '', text: '' }] } : c,
          ),
        },
    );

  let n = 0;
  const editing = phase === 'ready' || phase === 'saving';
  return (
    <dialog ref={ref} className="dialog ai-generate" onClose={onClose} aria-labelledby="ai-gen-t">
      <div className="nd-head">
        <h2 id="ai-gen-t">{t('ai.generate.title')}</h2>
        <button
          type="button"
          className="fd-btn fd-btn--ghost fd-btn--sm fd-btn--icon"
          aria-label={t('common.close')}
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      </div>
      <div className="dialog-body stack" aria-busy={phase === 'busy' || phase === 'saving'}>
        <span className="sr-only" role="status">
          {phase === 'ready' ? t('ai.ready') : ''}
        </span>
        {!editing && (
          <>
            <div className="tabs ai-gen-tabs" role="tablist" aria-label={t('ai.generate.source')}>
              <button
                type="button"
                role="tab"
                aria-selected="true"
                id="ai-gen-tab-text"
                aria-controls="ai-gen-panel"
              >
                {t('ai.generate.fromText')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected="false"
                aria-disabled="true"
                tabIndex={-1}
                title={t('ai.generate.fromHtmlSoon')}
              >
                {t('ai.generate.fromHtml')} <span className="fd-badge">{t('shell.soon')}</span>
              </button>
            </div>
            <div role="tabpanel" id="ai-gen-panel" aria-labelledby="ai-gen-tab-text" className="stack">
              <label className="fd-field">
                <span className="fd-label">{t('ai.generate.planLabel')}</span>
                <textarea
                  className="fd-input ai-gen-plan"
                  rows={8}
                  maxLength={PLAN_MAX}
                  placeholder={t('ai.generate.planPlaceholder')}
                  value={text}
                  disabled={phase === 'busy'}
                  aria-describedby="ai-gen-count"
                  onChange={(e) => setText(e.target.value)}
                />
                <span className="fd-help" id="ai-gen-count">
                  {t('editor.chars', { n: text.length, max: PLAN_MAX })}
                </span>
              </label>
              <label className="fd-check">
                <input
                  type="checkbox"
                  checked={withQuiz}
                  disabled={phase === 'busy'}
                  onChange={(e) => setWithQuiz(e.target.checked)}
                />
                {t('ai.generate.withQuiz')}
              </label>
            </div>
          </>
        )}
        {phase === 'busy' && (
          <div className="ai-preview">
            <p className="ai-after">{t('ai.generate.busy')}</p>
            <div className="ai-progress" aria-hidden="true" />
            <div className="ai-actions">
              <button type="button" className="fd-btn fd-btn--sm" onClick={() => ctrl.current?.abort()}>
                {t('ai.stop')}
              </button>
            </div>
          </div>
        )}
        {phase === 'blocked' && (
          <p className="ai-after" role="alert">
            {message}
          </p>
        )}
        {phase === 'error' && (
          <p className="ai-after" role="alert">
            {t('ai.error')}
          </p>
        )}
        {editing && plan && (
          <>
            {message && (
              <p className="fd-alert fd-alert--danger" role="alert">
                {message}
              </p>
            )}
            <label className="fd-field">
              <span className="fd-label">{t('ai.generate.demoTitle')}</span>
              <input
                className="fd-input"
                value={plan.title}
                maxLength={160}
                onChange={(e) => setPlan({ ...plan, title: e.target.value })}
              />
            </label>
            <p className="ai-gen-count">{t('ai.generate.count', { count: stepCount(plan) })}</p>
            <div className="ai-gen-list">
              {plan.chapters.map((c, ci) => (
                <section key={ci} aria-label={c.title || t('ai.generate.noChapter')}>
                  {(c.title || plan.chapters.length > 1) && (
                    <label className="fd-field">
                      <span className="fd-label">{t('ai.generate.chapter', { n: ci + 1 })}</span>
                      <input
                        className="fd-input fd-input--sm"
                        value={c.title}
                        maxLength={120}
                        onChange={(e) =>
                          setPlan({
                            ...plan,
                            chapters: plan.chapters.map((x, i) =>
                              i === ci ? { ...x, title: e.target.value } : x,
                            ),
                          })
                        }
                      />
                    </label>
                  )}
                  <ol className="ai-gen-steps">
                    {c.steps.map((s, si) => {
                      n += 1;
                      const k = n;
                      return (
                        <li key={si} className="ai-gen-step">
                          <span className="ai-gen-n" aria-hidden="true">
                            {k}
                          </span>
                          <div className="stack">
                            <input
                              className="fd-input fd-input--sm"
                              aria-label={t('ai.generate.stepTitle', { n: k })}
                              value={s.title}
                              maxLength={200}
                              onChange={(e) => setStep(ci, si, { title: e.target.value })}
                            />
                            <textarea
                              className="fd-input fd-input--sm"
                              rows={2}
                              aria-label={t('ai.generate.stepText', { n: k })}
                              value={s.text}
                              maxLength={4000}
                              onChange={(e) => setStep(ci, si, { text: e.target.value })}
                            />
                          </div>
                          <button
                            type="button"
                            className="fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm"
                            aria-label={t('ai.generate.removeStep', { n: k })}
                            onClick={() => removeStep(ci, si)}
                          >
                            <Trash2 aria-hidden="true" />
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                  <button
                    type="button"
                    className="fd-btn fd-btn--ghost fd-btn--sm"
                    onClick={() => addStep(ci)}
                  >
                    <Plus aria-hidden="true" />
                    {t('ai.generate.addStep')}
                  </button>
                </section>
              ))}
              {plan.quiz.length > 0 && (
                <section aria-labelledby="ai-gen-quiz">
                  <h3 id="ai-gen-quiz" className="ai-sg-step">
                    {t('ai.generate.quiz', { count: plan.quiz.length })}
                  </h3>
                  <ol className="ai-gen-quiz">
                    {plan.quiz.map((q, i) => (
                      <li key={i}>
                        <b>{q.prompt}</b>
                        <ul>
                          {q.answers.map((a, j) => (
                            <li key={j}>
                              {a.text}
                              {a.correct && <span className="sr-only"> ({t('ai.generate.correct')})</span>}
                              {a.correct && (
                                <span className="fd-badge ai-gen-ok" aria-hidden="true">
                                  {t('ai.generate.correct')}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </div>
          </>
        )}
      </div>
      <div className="dialog-actions">
        {editing && (
          <p className="ai-mention">
            <Sparkles aria-hidden="true" />
            {t('ai.mention')}
          </p>
        )}
        <span className="grow" />
        <button type="button" className="fd-btn" onClick={onClose}>
          {editing ? t('ai.ignore') : t('common.cancel')}
        </button>
        {editing ? (
          <button
            type="button"
            className="fd-btn fd-btn--primary"
            disabled={phase === 'saving' || !plan || !stepCount(plan) || !plan.title.trim()}
            onClick={() => void create()}
          >
            {t('ai.generate.create')}
          </button>
        ) : (
          <button
            type="button"
            className="fd-btn fd-btn--primary"
            disabled={phase === 'busy' || !text.trim()}
            onClick={() => void generate()}
          >
            {phase === 'error' ? t('ai.retry') : t('ai.generate.go')}
          </button>
        )}
      </div>
    </dialog>
  );
}
