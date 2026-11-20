import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles, X } from 'lucide-react';
import { Composer } from '@flowdsiml/ui';
import type { DemoEditor } from '../../pages/editor/useDemoEditor';
import { asSettings } from '../../pages/editor/types';
import { useToast } from '../Toast';
import { AiRequestError, aiBlock, callAi, useAiStatus } from '../../lib/ai';
import { markAiApplied, useBlockText } from './AiWrite';
import './ai.css';

type Change = { id: string; text: string; before: string; n: number; state?: 'applied' | 'ignored' };
type Msg =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; changes: Change[] }
  | { role: 'error'; text: string };

/** Champs envoyés : titres d'étapes, titres et textes des bulles (règle 3), avec leur id. */
export function demoFields(editor: Pick<DemoEditor, 'steps' | 'hotspots'>) {
  const out: Array<{ id: string; text: string; n: number }> = [];
  editor.steps.forEach((s, i) => {
    if (s.title?.trim()) out.push({ id: `s:${s.id}:title`, text: s.title, n: i + 1 });
    for (const h of editor.hotspots
      .filter((x) => x.step_id === s.id)
      .sort((a, b) => a.position - b.position)) {
      if (h.title.trim()) out.push({ id: `h:${h.id}:title`, text: h.title, n: i + 1 });
      if (h.body.trim()) out.push({ id: `h:${h.id}:body`, text: h.body, n: i + 1 });
    }
  });
  return out;
}

/**
 * L30-08 : panneau « Assistant » de l'éditeur. Conversation gardée en mémoire tant que le panneau
 * est ouvert, effacée à la fermeture ; aucune modification sans « Appliquer ».
 */
export function AssistantPanel({
  editor,
  ws,
  stepIndex,
  onClose,
}: {
  editor: DemoEditor;
  ws: string;
  stepIndex: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const blockText = useBlockText();
  const { status } = useAiStatus(ws);
  const lang = asSettings(editor.demo!.settings).locale ?? 'fr';
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    input.current?.focus();
    return () => ctrl.current?.abort();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [msgs, busy]);

  const current = (key: string) => {
    const [kind, id, field] = key.split(':');
    if (kind === 's') return editor.steps.find((s) => s.id === id)?.title ?? '';
    const h = editor.hotspots.find((x) => x.id === id);
    return (field === 'title' ? h?.title : h?.body) ?? '';
  };
  const write = (key: string, text: string) => {
    const [kind, id, field] = key.split(':');
    if (kind === 's') editor.updateStep(id!, { title: text });
    else editor.updateHotspot(id!, field === 'title' ? { title: text } : { body: text });
  };
  const setChange = (mi: number, ci: number, state: Change['state']) =>
    setMsgs((ms) =>
      ms.map((m, i) =>
        i === mi && m.role === 'assistant'
          ? { ...m, changes: m.changes.map((c, j) => (j === ci ? { ...c, state } : c)) }
          : m,
      ),
    );

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const b = aiBlock(status, 'assistant');
    const history = [...msgs, { role: 'user', text: q } as Msg];
    setMsgs(history);
    setDraft('');
    input.current?.focus();
    if (b) return setMsgs((m) => [...m, { role: 'error', text: blockText(b, status) }]);
    const fields = demoFields(editor);
    const nOf = new Map(fields.map((f) => [f.id, f.n]));
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setBusy(true);
    try {
      const r = await callAi<{ text: string; changes: Array<{ id: string; text: string }> }>(
        ws,
        'assistant',
        lang,
        {
          title: editor.demo!.title,
          step: stepIndex + 1,
          items: fields.slice(0, 100).map(({ id, text: tx }) => ({ id, text: tx })),
          messages: history
            .filter((m): m is Exclude<Msg, { role: 'error' }> => m.role !== 'error')
            .slice(-20)
            .map((m) => ({ role: m.role, text: m.text })),
        },
        c.signal,
      );
      setMsgs((m) => [
        ...m,
        {
          role: 'assistant',
          text: r.text,
          changes: r.changes.map((ch) => ({ ...ch, before: current(ch.id), n: nOf.get(ch.id) ?? 0 })),
        },
      ]);
    } catch (e) {
      if (e instanceof AiRequestError && e.code === 'ABORTED') return;
      const msg =
        e instanceof AiRequestError && (e.code === 'AI_QUOTA_WORKSPACE' || e.code === 'AI_QUOTA_USER')
          ? blockText(e.code === 'AI_QUOTA_USER' ? 'userQuota' : 'quota', status)
          : t('ai.error');
      setMsgs((m) => [...m, { role: 'error', text: msg }]);
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  };

  const starters = [t('ai.assistant.s1'), t('ai.assistant.s2'), t('ai.assistant.s3')];
  return createPortal(
    <div className="mk">
      <aside className="ai-suggest ai-assistant" role="dialog" aria-modal="false" aria-labelledby="ai-as-t">
        <div className="ai-suggest-head">
          <h2 id="ai-as-t">{t('ai.assistant.title')}</h2>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            aria-label={t('common.close')}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <p className="t-caption muted ai-as-context">
          {t('ai.assistant.context', { title: editor.demo!.title || t('demos.untitled'), n: stepIndex + 1 })}
        </p>
        <p className="fd-composer__context ai-as-cleared" id="ai-as-cleared">
          {t('ai.assistant.cleared')}
        </p>
        <div className="ai-suggest-body ai-as-log" ref={log} role="log" aria-live="polite" aria-busy={busy}>
          {msgs.length === 0 && (
            <div className="ai-as-starters">
              {starters.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => void send(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {msgs.map((m, mi) => (
            <div key={mi} className={`ai-as-msg is-${m.role}`}>
              <p className="ai-as-author">
                {m.role === 'user' ? t('ai.assistant.you') : t('ai.assistant.name')}
              </p>
              <p
                className={m.role === 'error' ? 'ai-after' : 'ai-as-text'}
                role={m.role === 'error' ? 'alert' : undefined}
              >
                {m.text}
              </p>
              {m.role === 'assistant' &&
                m.changes.map((c, ci) => (
                  <div
                    key={ci}
                    className="ai-preview"
                    role="group"
                    aria-label={t('ai.write.step', { n: c.n })}
                  >
                    <h4>{t('ai.write.step', { n: c.n })}</h4>
                    {c.before && (
                      <p className="ai-before">
                        <span className="sr-only">{t('ai.beforeSr')} </span>
                        {c.before}
                      </p>
                    )}
                    <p className="ai-after">
                      <span className="sr-only">{t('ai.afterSr')} </span>
                      {c.text}
                    </p>
                    {c.state ? (
                      <p className="t-caption muted">
                        {c.state === 'applied' ? t('ai.applied') : t('ai.assistant.ignored')}
                      </p>
                    ) : (
                      <div className="ai-actions">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            const before = current(c.id);
                            markAiApplied(c.id, c.text);
                            write(c.id, c.text);
                            setChange(mi, ci, 'applied');
                            toast(t('ai.applied'), {
                              label: t('ai.undo'),
                              durationMs: 8000,
                              onClick: () => write(c.id, before),
                            });
                          }}
                        >
                          {t('ai.apply')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setChange(mi, ci, 'ignored')}
                        >
                          {t('ai.ignore')}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              {m.role === 'assistant' && (
                <p className="ai-mention">
                  <Sparkles aria-hidden="true" />
                  {t('ai.mention')}
                </p>
              )}
            </div>
          ))}
          {busy && (
            <div className="ai-as-msg is-assistant">
              <p className="ai-as-author">{t('ai.assistant.name')}</p>
              <p className="ai-after">{t('ai.assistant.busy')}</p>
              <div className="ai-progress" aria-hidden="true" />
            </div>
          )}
        </div>
        <Composer
          className="ai-as-form"
          label={t('ai.assistant.label')}
          placeholder={t('ai.assistant.placeholder')}
          maxLength={2000}
          value={draft}
          onValueChange={setDraft}
          submitLabel={t('ai.assistant.send')}
          submitKey={t('ai.assistant.enterKey')}
          describedBy="ai-as-cleared"
          stop={busy ? { label: t('ai.assistant.stop'), onStop: () => ctrl.current?.abort() } : undefined}
          onSubmit={() => void send(draft)}
          renderInput={(props) => (
            <textarea
              {...props}
              ref={(el) => {
                input.current = el;
                if (typeof props.ref === 'function') props.ref(el);
              }}
              onChange={(e) => setDraft(e.target.value)}
            />
          )}
        />
      </aside>
    </div>,
    document.body,
  );
}
