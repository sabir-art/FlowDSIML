import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles, X } from 'lucide-react';
import type { DemoEditor } from '../../pages/editor/useDemoEditor';
import { useToast } from '../Toast';
import { AiRequestError, aiBlock, callAi, lostVariables, useAiStatus } from '../../lib/ai';
import { markAiApplied, useBlockText } from './AiWrite';
import './ai.css';

type Row = { id: string; n: number; before: string; after: string; done?: boolean };

/** L30-02 « Pour toutes les étapes » : corriger l'orthographe de toutes les bulles, aperçu par ligne. */
export function AiSpellAll({
  editor,
  ws,
  lang,
  onClose,
}: {
  editor: DemoEditor;
  ws: string;
  lang: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const blockText = useBlockText();
  const { status } = useAiStatus(ws);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [state, setState] = useState<'busy' | 'ready' | 'error' | 'blocked'>('busy');
  const [message, setMessage] = useState('');
  const ctrl = useRef<AbortController | null>(null);
  const started = useRef(false);

  const sources = editor.steps.flatMap((st, i) =>
    editor.hotspots
      .filter((h) => h.step_id === st.id && h.body.trim())
      .sort((a, b) => a.position - b.position)
      .map((h) => ({ id: h.id, n: i + 1, text: h.body })),
  );

  const run = async () => {
    const b = aiBlock(status, 'write');
    if (b) {
      setMessage(blockText(b, status));
      return setState('blocked');
    }
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setState('busy');
    try {
      const r = await callAi<{ items: Array<{ id: string; text: string }> }>(
        ws,
        'write_all',
        lang,
        { items: sources.slice(0, 100).map((s) => ({ id: s.id, text: s.text })) },
        c.signal,
      );
      const byId = new Map(r.items.map((i) => [i.id, i.text]));
      setRows(
        sources
          .filter((s) => byId.has(s.id) && byId.get(s.id) !== s.text)
          .map((s) => ({ id: s.id, n: s.n, before: s.text, after: byId.get(s.id)! })),
      );
      setState('ready');
    } catch (e) {
      if (e instanceof AiRequestError && e.code === 'ABORTED') return onClose();
      if (e instanceof AiRequestError && (e.code === 'AI_QUOTA_WORKSPACE' || e.code === 'AI_QUOTA_USER')) {
        setMessage(blockText(e.code === 'AI_QUOTA_USER' ? 'userQuota' : 'quota', status));
        return setState('blocked');
      }
      setState('error');
    }
  };

  useEffect(() => {
    if (!status || started.current) return;
    started.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
  useEffect(() => () => ctrl.current?.abort(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const applyRows = (list: Row[]) => {
    if (!list.length) return;
    editor.batch(() => {
      for (const r of list) {
        markAiApplied(`hs:${r.id}:body`, r.after);
        editor.updateHotspot(r.id, { body: r.after });
      }
    });
    setRows((rs) => rs?.map((r) => (list.some((l) => l.id === r.id) ? { ...r, done: true } : r)) ?? rs);
    toast(t('ai.applied'), {
      label: t('ai.undo'),
      durationMs: 8000,
      onClick: () => editor.batch(() => list.forEach((r) => editor.updateHotspot(r.id, { body: r.before }))),
    });
  };
  const pending = rows?.filter((r) => !r.done) ?? [];

  return createPortal(
    <div className="mk">
      <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal modal-lg" role="dialog" aria-modal="true" aria-labelledby="ai-all-t">
          <div className="modal-head">
            <h2 id="ai-all-t">{t('ai.write.allTitle')}</h2>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              aria-label={t('common.close')}
              onClick={onClose}
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <div className="modal-body" aria-busy={state === 'busy'}>
            <span className="sr-only" role="status">
              {state === 'ready' ? t('ai.ready') : ''}
            </span>
            {state === 'busy' && (
              <div className="ai-preview">
                <p className="ai-after">{t('ai.busy')}</p>
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
            {state === 'blocked' && (
              <p className="ai-after" role="alert">
                {message}
              </p>
            )}
            {state === 'error' && (
              <div className="ai-preview">
                <p className="ai-after" role="alert">
                  {aiBlock(status, 'write') === 'unavailable' ? t('ai.unavailable') : t('ai.error')}
                </p>
                <div className="ai-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => void run()}>
                    {t('ai.retry')}
                  </button>
                </div>
              </div>
            )}
            {state === 'ready' && rows && rows.length === 0 && <p>{t('ai.write.none')}</p>}
            {state === 'ready' &&
              rows?.map((r) => (
                <div
                  key={r.id}
                  className="ai-preview"
                  role="group"
                  aria-label={t('ai.write.step', { n: r.n })}
                >
                  <h4>{t('ai.write.step', { n: r.n })}</h4>
                  <p className="ai-before">
                    <span className="sr-only">{t('ai.beforeSr')} </span>
                    {r.before}
                  </p>
                  <p className="ai-after">
                    <span className="sr-only">{t('ai.afterSr')} </span>
                    {r.after}
                  </p>
                  {lostVariables(r.before, r.after).map((v) => (
                    <p key={v} className="alert alert-warning" role="alert">
                      {t('ai.lostVar', { name: `{{${v}}}` })}
                    </p>
                  ))}
                  <div className="ai-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={r.done}
                      onClick={() => applyRows([r])}
                    >
                      {r.done ? t('ai.applied') : t('ai.apply')}
                    </button>
                  </div>
                </div>
              ))}
          </div>
          {state === 'ready' && rows && rows.length > 0 && (
            <div className="modal-foot">
              <p className="ai-mention">
                <Sparkles aria-hidden="true" />
                {t('ai.mention')}
              </p>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                {t('ai.ignore')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!pending.length}
                onClick={() => applyRows(pending)}
              >
                {t('ai.write.applyAll')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
