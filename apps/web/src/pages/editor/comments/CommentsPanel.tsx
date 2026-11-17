import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Check,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Pencil,
  RotateCcw,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { richTextToHtml } from '@flowdsiml/core';
import { Alert, Button, Switch } from '@flowdsiml/ui';
import { useAuth } from '../../../auth/AuthProvider';
import { useWorkspace } from '../../../workspace/WorkspaceProvider';
import { useConfirm } from '../../../components/ConfirmDialog';
import { formatDateTime, formatRelative } from '../../../lib/format';
import { initials } from '../../../lib/initials';
import { useAction } from '../../../lib/useAction';
import type { StepCommentsApi } from './useStepComments';

const HEIGHT_KEY = 'fd.comments.height';
const OPEN_KEY = 'fd.comments.open';
const MIN_H = 120;
const DEFAULT_H = 240;
const maxH = () => Math.round(window.innerHeight * 0.6);

function readNumber(key: string, fallback: number) {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) && v > 0 ? v : fallback;
  } catch {
    return fallback;
  }
}
function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* stockage indisponible : la préférence vaut pour la session */
  }
}

/**
 * Panneau « Commentaires » sous le canevas (sur le modèle des notes de présentation) :
 * commentaires internes de l'étape courante, jamais publiés. Poignée horizontale pour
 * redimensionner (souris ou flèches du clavier, hauteur mémorisée) et pour replier / déplier.
 */
export function CommentsPanel({ stepId, api }: { stepId: string | null; api: StepCommentsApi }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { current } = useWorkspace();
  const [dialog, ask] = useConfirm();
  const { error, run } = useAction();
  const [height, setHeight] = useState(() => Math.min(readNumber(HEIGHT_KEY, DEFAULT_H), maxH()));
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(OPEN_KEY) !== '0';
    } catch {
      return true;
    }
  });
  const [showResolved, setShowResolved] = useState(false);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const drag = useRef<{ y: number; h: number } | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const isAdmin = current?.role === 'owner' || current?.role === 'admin';

  const forStep = api.comments.filter((c) => c.step_id === stepId);
  const openCount = forStep.filter((c) => !c.resolved_at).length;
  const resolvedCount = forStep.length - openCount;
  const visible = showResolved ? forStep : forStep.filter((c) => !c.resolved_at);

  useEffect(() => store(HEIGHT_KEY, String(Math.round(height))), [height]);
  useEffect(() => store(OPEN_KEY, open ? '1' : '0'), [open]);
  // Nouveau commentaire : la liste défile jusqu'en bas
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visible.length, stepId]);

  function clamp(h: number) {
    return Math.max(MIN_H, Math.min(maxH(), h));
  }
  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!open) return;
    drag.current = { y: e.clientY, h: height };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setHeight(clamp(drag.current.h + (drag.current.y - e.clientY)));
  }
  function onPointerUp() {
    drag.current = null;
  }
  function onHandleKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      setHeight((h) => clamp(h + (e.key === 'ArrowUp' ? 24 : -24)));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen((o) => !o);
    }
  }

  async function send() {
    const body = draft.trim();
    if (!body || !stepId) return;
    const ok = await run(async () => {
      await api.add(stepId, body);
      return true;
    });
    if (ok) setDraft('');
  }

  async function saveEdit() {
    if (!editing) return;
    const body = editing.body.trim();
    if (!body) return;
    const ok = await run(async () => {
      await api.update(editing.id, body);
      return true;
    });
    if (ok) setEditing(null);
  }

  /** Entrée envoie, Maj+Entrée revient à la ligne. */
  const submitOnEnter = (fn: () => void) => (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      fn();
    }
  };

  const authorName = (id: string) => {
    if (id === user?.id) return t('comments.you');
    const a = api.authors[id];
    return a?.full_name || a?.email || t('comments.formerMember');
  };

  return (
    <section
      className={`comments${open ? '' : ' comments--collapsed'}`}
      style={open ? { height } : undefined}
      aria-labelledby="comments-title"
    >
      {dialog}
      <div
        className="comments__handle"
        role="separator"
        aria-orientation="horizontal"
        aria-label={t('comments.resize')}
        aria-valuemin={MIN_H}
        aria-valuemax={maxH()}
        aria-valuenow={Math.round(open ? height : 0)}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onHandleKey}
        onDoubleClick={() => setOpen((o) => !o)}
      >
        <span className="comments__grip" aria-hidden="true" />
      </div>
      <header className="comments__head">
        <span className="fd-icon-chip" aria-hidden="true">
          <MessageSquare />
        </span>
        <h2 id="comments-title" className="comments__title">
          {t('comments.title')}
          {openCount > 0 && (
            <span className="comments__count" aria-label={t('comments.openCount', { count: openCount })}>
              {openCount}
            </span>
          )}
        </h2>
        <span className="comments__internal">{t('comments.internal')}</span>
        {open && resolvedCount > 0 && (
          <Switch
            className="comments__resolved-toggle"
            label={t('comments.showResolved', { count: resolvedCount })}
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
          />
        )}
        <Button
          size="sm"
          variant="ghost"
          icon={open ? <ChevronDown /> : <ChevronUp />}
          aria-expanded={open}
          aria-controls="comments-body"
          onClick={() => setOpen(!open)}
        >
          {open ? t('comments.collapse') : t('comments.expand')}
        </Button>
      </header>

      {open && (
        <div className="comments__body" id="comments-body">
          {error && <Alert kind="error">{error}</Alert>}
          {visible.length === 0 ? (
            <p className="comments__empty fd-muted">
              {forStep.length ? t('comments.allResolved') : t('comments.empty')}
            </p>
          ) : (
            <ol className="comments__list" ref={listRef}>
              {visible.map((c) => {
                const mine = c.author_id === user?.id;
                return (
                  <li key={c.id} className={`comment${c.resolved_at ? ' comment--resolved' : ''}`}>
                    <span className="avatar avatar--brand comment__avatar" aria-hidden="true">
                      {initials(
                        api.authors[c.author_id]?.full_name || api.authors[c.author_id]?.email || '?',
                      )}
                    </span>
                    <div className="comment__main">
                      <div className="comment__meta">
                        <strong>{authorName(c.author_id)}</strong>
                        <time dateTime={c.created_at} title={formatDateTime(c.created_at)}>
                          {formatRelative(c.created_at)}
                        </time>
                        {c.updated_at !== c.created_at && !c.resolved_at && (
                          <span className="comment__edited">{t('comments.edited')}</span>
                        )}
                        {c.resolved_at && (
                          <span className="fd-badge status-published">{t('comments.resolved')}</span>
                        )}
                      </div>
                      {editing?.id === c.id ? (
                        <div className="comment__edit">
                          <textarea
                            className="fd-textarea"
                            aria-label={t('comments.editLabel')}
                            autoFocus
                            rows={2}
                            maxLength={4000}
                            value={editing.body}
                            onChange={(e) => setEditing({ id: c.id, body: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setEditing(null);
                              else submitOnEnter(() => void saveEdit())(e);
                            }}
                          />
                          <div className="row">
                            <Button
                              size="sm"
                              variant="primary"
                              icon={<Check />}
                              onClick={() => void saveEdit()}
                            >
                              {t('common.save')}
                            </Button>
                            <Button size="sm" variant="ghost" icon={<X />} onClick={() => setEditing(null)}>
                              {t('common.cancel')}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="comment__body p-rich"
                          dangerouslySetInnerHTML={{ __html: richTextToHtml(c.body) }}
                        />
                      )}
                    </div>
                    <div className="comment__actions">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={c.resolved_at ? <RotateCcw /> : <Check />}
                        onClick={() => void run(() => api.setResolved(c.id, !c.resolved_at))}
                      >
                        {c.resolved_at ? t('comments.reopen') : t('comments.resolve')}
                      </Button>
                      {mine && !editing && (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Pencil />}
                          aria-label={t('comments.edit')}
                          title={t('comments.edit')}
                          onClick={() => setEditing({ id: c.id, body: c.body })}
                        />
                      )}
                      {(mine || isAdmin) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="btn-danger-ghost"
                          icon={<Trash2 />}
                          aria-label={t('comments.delete')}
                          title={t('comments.delete')}
                          onClick={async () => {
                            if (
                              await ask({
                                title: t('comments.confirmDelete'),
                                confirmLabel: t('common.delete'),
                                danger: true,
                              })
                            )
                              void run(() => api.remove(c.id));
                          }}
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <form
            className="comments__form"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <textarea
              className="fd-textarea"
              rows={1}
              maxLength={4000}
              placeholder={t('comments.placeholder')}
              aria-label={t('comments.placeholder')}
              aria-describedby="comments-hint"
              value={draft}
              disabled={!stepId}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={submitOnEnter(() => void send())}
            />
            <Button
              type="submit"
              variant="primary"
              icon={<Send />}
              disabled={!draft.trim() || !stepId}
              aria-label={t('comments.send')}
              title={t('comments.send')}
            />
            <span id="comments-hint" className="sr-only">
              {t('comments.hint')}
            </span>
          </form>
        </div>
      )}
    </section>
  );
}
