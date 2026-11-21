import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles, TriangleAlert, X } from 'lucide-react';
import type { DemoEditor } from '../../pages/editor/useDemoEditor';
import { asSettings } from '../../pages/editor/types';
import { supabase } from '../../lib/supabase';
import { useToast } from '../Toast';
import { AiRequestError, aiBlock, callAi, useAiStatus } from '../../lib/ai';
import { useBlockText } from './AiWrite';
import './ai.css';

/** Langues proposées (spec L30 §4). */
export const TRANSLATE_LANGS = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ar'] as const;
export type TranslateLang = (typeof TRANSLATE_LANGS)[number];

type Field = { key: string; n: number; label: string; text: string };
type Row = Field & { out: string; glossary: string[] };

/** Termes du glossaire présents dans l'original et absents de la traduction (gardés tels quels). */
export function missingTerms(terms: string[], source: string, out: string): string[] {
  const low = (s: string) => s.toLocaleLowerCase();
  return terms.filter((t) => low(source).includes(low(t)) && !low(out).includes(low(t)));
}

/**
 * L30-03 : « Traduire la démo… ». Choix de la langue, aperçu par étape modifiable, puis création
 * d'une copie traduite en brouillon. Rien n'est créé avant « Créer la copie » (règles communes §0).
 */
export function TranslateDialog({
  editor,
  ws,
  onClose,
}: {
  editor: DemoEditor;
  ws: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const blockText = useBlockText();
  const { status } = useAiStatus(ws);
  const demo = editor.demo!;
  const from = asSettings(demo.settings).locale ?? 'fr';
  const targets = TRANSLATE_LANGS.filter((l) => l !== from);
  const [target, setTarget] = useState<TranslateLang>(targets[0]!);
  const [phase, setPhase] = useState<'choose' | 'busy' | 'ready' | 'error' | 'blocked' | 'saving'>('choose');
  const [message, setMessage] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [terms, setTerms] = useState<string[]>([]);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    void supabase
      .from('glossary_terms')
      .select('term')
      .eq('workspace_id', ws)
      .then(({ data }) => setTerms((data ?? []).map((g) => g.term)));
  }, [ws]);
  useEffect(() => () => ctrl.current?.abort(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Textes envoyés : titre de la démo, titres et textes des étapes, titres et textes des bulles
  const fields = useMemo<Field[]>(() => {
    const out: Field[] = [];
    const add = (key: string, n: number, label: string, text: string | null | undefined) => {
      if (text && text.trim()) out.push({ key, n, label, text });
    };
    add('demo:title', 0, t('ai.translate.demoTitle'), demo.title);
    editor.steps.forEach((s, i) => {
      add(`s:${s.id}:title`, i + 1, t('ai.translate.stepTitle'), s.title);
      add(`s:${s.id}:body`, i + 1, t('ai.translate.stepBody'), s.body);
      editor.hotspots
        .filter((h) => h.step_id === s.id)
        .sort((a, b) => a.position - b.position)
        .forEach((h) => {
          add(`h:${h.id}:title`, i + 1, t('ai.translate.bubbleTitle'), h.title);
          add(`h:${h.id}:body`, i + 1, t('ai.translate.bubbleBody'), h.body);
        });
    });
    return out;
  }, [demo.title, editor.steps, editor.hotspots, t]);

  const prepare = async () => {
    const b = aiBlock(status, 'translate');
    if (b) {
      setMessage(blockText(b, status));
      return setPhase('blocked');
    }
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setPhase('busy');
    try {
      const r = await callAi<{ items: Array<{ id: string; text: string }> }>(
        ws,
        'translate',
        from,
        {
          target,
          items: fields.slice(0, 200).map((f) => ({ id: f.key, text: f.text })),
          glossary: terms.map((term) => ({ term })),
        },
        c.signal,
      );
      const byId = new Map(r.items.map((i) => [i.id, i.text]));
      setRows(
        fields.map((f) => {
          const out = byId.get(f.key) ?? f.text;
          return { ...f, out, glossary: missingTerms(terms, f.text, out) };
        }),
      );
      setPhase('ready');
    } catch (e) {
      if (e instanceof AiRequestError && e.code === 'ABORTED') return setPhase('choose');
      if (e instanceof AiRequestError && (e.code === 'AI_QUOTA_WORKSPACE' || e.code === 'AI_QUOTA_USER')) {
        setMessage(
          blockText(e.code === 'AI_QUOTA_USER' ? 'userQuota' : 'quota', {
            ...status!,
            renewsOn: e.renewsOn ?? status?.renewsOn ?? null,
          }),
        );
        return setPhase('blocked');
      }
      setPhase('error');
    }
  };

  /** Copie (duplicate_demo), puis textes traduits écrits sur la copie, appariés par position. */
  const create = async () => {
    setPhase('saving');
    try {
      const { data: newId, error } = await supabase.rpc('duplicate_demo', { p_demo: demo.id });
      if (error || !newId) throw error ?? new Error('duplicate');
      const id = newId as string;
      const [{ data: nSteps }, { data: nHs }] = await Promise.all([
        supabase.from('steps').select('id, position').eq('demo_id', id),
        supabase.from('hotspots').select('id, step_id, position').eq('demo_id', id),
      ]);
      const stepAt = new Map((nSteps ?? []).map((s) => [s.position, s.id]));
      const out = new Map(rows.map((r) => [r.key, r.out]));
      const langName = t(`ai.lang.${target}`);
      const ops: Array<PromiseLike<{ error: unknown }>> = [
        supabase
          .from('demos')
          .update({
            title: `${out.get('demo:title') ?? demo.title} (${langName})`.slice(0, 160),
            settings: { ...asSettings(demo.settings), locale: target } as never,
          })
          .eq('id', id),
      ];
      for (const s of editor.steps) {
        const ns = stepAt.get(s.position);
        if (!ns) continue;
        const patch: { title?: string; body?: string } = {};
        if (out.has(`s:${s.id}:title`)) patch.title = out.get(`s:${s.id}:title`)!;
        if (out.has(`s:${s.id}:body`)) patch.body = out.get(`s:${s.id}:body`)!;
        if (Object.keys(patch).length) ops.push(supabase.from('steps').update(patch).eq('id', ns));
        for (const h of editor.hotspots.filter((x) => x.step_id === s.id)) {
          const nh = (nHs ?? []).find((x) => x.step_id === ns && x.position === h.position);
          if (!nh) continue;
          const hp: { title?: string; body?: string } = {};
          if (out.has(`h:${h.id}:title`)) hp.title = out.get(`h:${h.id}:title`)!;
          if (out.has(`h:${h.id}:body`)) hp.body = out.get(`h:${h.id}:body`)!;
          if (Object.keys(hp).length) ops.push(supabase.from('hotspots').update(hp).eq('id', nh.id));
        }
      }
      const res = await Promise.all(ops);
      if (res.some((r) => r.error)) throw new Error('update');
      onClose();
      toast(t('ai.translate.created'), {
        label: t('ai.translate.open'),
        onClick: () => navigate(`/demos/${id}/edit`),
      });
    } catch {
      setMessage(t('ai.translate.createError'));
      setPhase('ready');
    }
  };

  const flagged = rows.filter((r) => r.glossary.length).length;

  return createPortal(
    <div className="mk">
      <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div
          className="modal modal-lg ai-translate"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-tr-t"
        >
          <div className="modal-head">
            <h2 id="ai-tr-t">{t('ai.translate.title')}</h2>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              aria-label={t('common.close')}
              onClick={onClose}
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <div className="modal-body" aria-busy={phase === 'busy' || phase === 'saving'}>
            <span className="sr-only" role="status">
              {phase === 'ready' ? t('ai.ready') : ''}
            </span>
            {(phase === 'choose' || phase === 'busy' || phase === 'error' || phase === 'blocked') && (
              <>
                <div className="field">
                  <label htmlFor="ai-tr-lang">{t('ai.translate.target')}</label>
                  <select
                    id="ai-tr-lang"
                    className="select"
                    value={target}
                    disabled={phase === 'busy'}
                    onChange={(e) => setTarget(e.target.value as TranslateLang)}
                  >
                    {targets.map((l) => (
                      <option key={l} value={l}>
                        {t(`ai.lang.${l}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="help">{t('ai.translate.copyHelp')}</p>
              </>
            )}
            {phase === 'busy' && (
              <div className="ai-preview">
                <p className="ai-after">{t('ai.translate.busy')}</p>
                <div className="ai-progress" aria-hidden="true" />
                <div className="ai-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => ctrl.current?.abort()}
                  >
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
            {(phase === 'ready' || phase === 'saving') && (
              <>
                {message && (
                  <p className="alert alert-danger" role="alert">
                    {message}
                  </p>
                )}
                {flagged > 0 && (
                  <p className="alert alert-warning" role="status">
                    <TriangleAlert aria-hidden="true" />
                    {t('ai.translate.glossaryWarn', { count: flagged })}
                  </p>
                )}
                <div className="ai-tr-table-wrap">
                  <table className="table ai-tr-table">
                    <caption className="sr-only">
                      {t('ai.translate.tableCaption', { lang: t(`ai.lang.${target}`) })}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('ai.translate.colStep')}</th>
                        <th scope="col">{t('ai.translate.colSource')}</th>
                        <th scope="col">{t('ai.translate.colTarget')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={r.key}>
                          <th scope="row">
                            {r.n ? t('ai.write.step', { n: r.n }) : t('ai.translate.demo')}
                            <span className="t-caption muted ai-tr-kind">{r.label}</span>
                          </th>
                          <td lang={from}>{r.text}</td>
                          <td>
                            <textarea
                              className={`textarea input-sm${r.glossary.length ? ' ai-tr-flag' : ''}`}
                              lang={target}
                              dir={target === 'ar' ? 'rtl' : undefined}
                              rows={Math.min(5, Math.max(1, Math.ceil(r.out.length / 32)))}
                              aria-label={t('ai.translate.edit', { n: i + 1 })}
                              aria-describedby={r.glossary.length ? `ai-tr-g-${i}` : undefined}
                              title={r.glossary.length ? t('ai.translate.glossaryTerm') : undefined}
                              value={r.out}
                              disabled={phase === 'saving'}
                              onChange={(e) =>
                                setRows((rs) =>
                                  rs.map((x) =>
                                    x.key === r.key
                                      ? {
                                          ...x,
                                          out: e.target.value,
                                          glossary: missingTerms(terms, x.text, e.target.value),
                                        }
                                      : x,
                                  ),
                                )
                              }
                            />
                            {r.glossary.length > 0 && (
                              <span className="t-caption ai-tr-term" id={`ai-tr-g-${i}`}>
                                {t('ai.translate.glossaryList', { terms: r.glossary.join(', ') })}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
          <div className="modal-foot">
            {(phase === 'ready' || phase === 'saving') && (
              <p className="ai-mention">
                <Sparkles aria-hidden="true" />
                {t('ai.mention')}
              </p>
            )}
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {phase === 'ready' || phase === 'saving' ? t('ai.ignore') : t('common.cancel')}
            </button>
            {phase === 'ready' || phase === 'saving' ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={phase === 'saving'}
                onClick={() => void create()}
              >
                {t('ai.translate.create')}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={phase === 'busy' || !fields.length}
                onClick={() => void prepare()}
              >
                {phase === 'error' ? t('ai.retry') : t('ai.translate.prepare')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
