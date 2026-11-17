import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  Lock,
  MessageSquare,
  Pencil,
  RotateCcw,
  Trash2,
  WifiOff,
} from 'lucide-react';
import { Alert, Button, Switch } from '@flowdsiml/ui';
import { useAuth } from '../../../auth/AuthProvider';
import { useWorkspace } from '../../../workspace/WorkspaceProvider';
import { useConfirm } from '../../../components/ConfirmDialog';
import { Menu, type MenuItem } from '../../../components/Menu';
import { formatDateTime, formatRelative } from '../../../lib/format';
import { initials } from '../../../lib/initials';
import type { StepComment, StepCommentsApi } from './useStepComments';

/** Spec docs/ux/commentaires.md : hauteur 160–520 px (280 par défaut, 220 entre 1 024 et 1 280 px). */
const HEIGHT_KEY = 'fd.editor.comments.height';
const COLLAPSED_KEY = 'fd.editor.comments.collapsed';
const MIN_H = 160;
const MAX_H = 520;
const STEP_H = 24;
const MAX_LEN = 2000;
const COUNT_FROM = 1800;
const NEW_MS = 4000;

const defaultHeight = () => (window.innerWidth < 1280 ? 220 : 280);
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* stockage indisponible : la préférence vaut pour la session */
  }
}

/** Couleur d'avatar stable par membre, prise dans chart-1…chart-5. */
function avatarTone(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % 5) + 1;
}

/** Texte brut avec liens cliquables (pas de Markdown, jamais de HTML injecté). */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>"']*[^\s<>"'.,;:!?)\]])/g);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer">
            {p}
          </a>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

function Avatar({ id, label }: { id: string; label: string }) {
  return (
    <span className={`cm-avatar cm-avatar--${avatarTone(id)}`} aria-hidden="true">
      {initials(label)}
    </span>
  );
}

/**
 * Panneau « Commentaires » de l'éditeur (docs/ux/commentaires.md) : commentaires internes de
 * l'étape courante, jamais publiés. `variant="panel"` : sous le canevas, poignée et repli ;
 * `variant="mobile"` : écran étroit, pleine hauteur, sans poignée.
 */
export function CommentsPanel({
  stepId,
  stepIndex,
  api,
  canComment = true,
  variant = 'panel',
  header,
}: {
  stepId: string | null;
  stepIndex: number;
  api: StepCommentsApi;
  /** Tout membre peut commenter (viewer compris, décision du chef d'équipe). */
  canComment?: boolean;
  variant?: 'panel' | 'mobile';
  /** Contenu inséré sous l'en-tête (sélecteur d'étape en mobile). */
  header?: ReactNode;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { current } = useWorkspace();
  const [dialog, ask] = useConfirm();
  const mobile = variant === 'mobile';
  const isAdmin = current?.role === 'owner' || current?.role === 'admin';
  const isEditor = isAdmin || current?.role === 'editor';

  const [height, setHeight] = useState(() => {
    const v = Number(read(HEIGHT_KEY));
    return Number.isFinite(v) && v >= MIN_H ? Math.min(v, MAX_H) : defaultHeight();
  });
  const [collapsed, setCollapsed] = useState(() => !mobile && read(COLLAPSED_KEY) === '1');
  const [showResolved, setShowResolved] = useState(false);
  const [draft, setDraft] = useState('');
  const [composeFocus, setComposeFocus] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [fresh, setFresh] = useState<Record<string, true>>({});
  const [pending, setPending] = useState(0);
  const [live, setLive] = useState('');
  const sectionRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const drag = useRef<{ y: number; h: number } | null>(null);
  const openedByUser = useRef(false);
  const pendingRef = useRef(0);
  pendingRef.current = pending;

  const forStep = api.comments.filter((c) => c.step_id === stepId);
  const openList = forStep.filter((c) => !c.resolved_at);
  const resolvedCount = forStep.length - openList.length;
  const visible = showResolved ? forStep : openList;
  const name = (id: string | null | undefined) => {
    if (!id) return '';
    const a = api.authors[id];
    return a?.full_name || a?.email || '—';
  };
  const unfresh = (id: string) =>
    setFresh((f) => {
      if (!f[id]) return f;
      const next = { ...f };
      delete next[id];
      return next;
    });

  useEffect(() => {
    if (!mobile) store(HEIGHT_KEY, String(Math.round(height)));
  }, [height, mobile]);
  useEffect(() => {
    if (!mobile) store(COLLAPSED_KEY, collapsed ? '1' : '0');
  }, [collapsed, mobile]);
  useEffect(() => {
    setShowResolved(false);
    setEditing(null);
    setPending(0);
    // Focus sur la saisie à l'ouverture d'une étape, seulement si l'utilisateur a ouvert le panneau
    if (openedByUser.current) draftRef.current?.focus();
  }, [stepId]);

  // Temps réel : annonce, badge « Nouveau » 4 s, pas de défilement forcé si l'utilisateur lit plus haut
  const remote = api.remote;
  useEffect(() => {
    if (!remote) return;
    const a = remote.authorId ? api.authors[remote.authorId] : undefined;
    const who = a?.full_name || a?.email || '';
    setLive(
      remote.kind === 'added'
        ? t('editor.comments.liveAdded', { name: who })
        : remote.kind === 'resolved'
          ? t('editor.comments.liveResolved', { name: who })
          : t('editor.comments.liveDeleted'),
    );
    if (remote.kind !== 'added') return;
    setFresh((f) => ({ ...f, [remote.commentId]: true }));
    const timer = window.setTimeout(() => unfresh(remote.commentId), NEW_MS);
    const el = listRef.current;
    const atBottom = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    if (!atBottom) setPending((n) => n + 1);
    return () => window.clearTimeout(timer);
  }, [remote, api.authors, t]);

  // Nouvelle étape ou nouveau commentaire : défilement en bas, sauf si l'utilisateur lit plus haut
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && !pendingRef.current) el.scrollTop = el.scrollHeight;
  }, [stepId, forStep.length]);

  // Champ de saisie : 40 px qui grandit jusqu'à 120 px puis défile
  useLayoutEffect(() => {
    const el = draftRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(120, Math.max(40, el.scrollHeight))}px`;
  }, [draft]);

  /** Jamais plus de 60 % de la colonne : le canevas garde au moins 240 px. */
  function clamp(h: number) {
    const col = sectionRef.current?.parentElement?.clientHeight ?? window.innerHeight;
    const max = Math.max(MIN_H, Math.min(MAX_H, col * 0.6, col - 240));
    return Math.round(Math.max(MIN_H, Math.min(max, h)));
  }
  function toggle(next: boolean) {
    setCollapsed(next);
    if (!next) {
      openedByUser.current = true;
      requestAnimationFrame(() => draftRef.current?.focus());
    }
  }
  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    drag.current = { y: e.clientY, h: height };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (drag.current) setHeight(clamp(drag.current.h + (drag.current.y - e.clientY)));
  }
  function onHandleKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      setHeight((h) => clamp(h + (e.key === 'ArrowUp' ? STEP_H : -STEP_H)));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      toggle(true);
    }
  }

  async function send() {
    const body = draft.trim();
    if (!body || !stepId || body.length > MAX_LEN || sending) return;
    setSending(true);
    setSendError(false);
    try {
      await api.add(stepId, body);
      setDraft('');
      setPending(0);
    } catch {
      setSendError(true); // le texte reste dans le champ
    } finally {
      setSending(false);
    }
  }
  async function saveEdit() {
    if (!editing) return;
    const body = editing.body.trim();
    if (!body || body.length > MAX_LEN) return;
    try {
      await api.update(editing.id, body);
      setEditing(null);
    } catch {
      /* l'édition reste ouverte */
    }
  }
  async function confirmDelete(c: StepComment) {
    if (
      await ask({
        title: t('editor.comments.deleteTitle'),
        body: t('editor.comments.deleteBody'),
        confirmLabel: t('editor.comments.deleteConfirm'),
        danger: true,
      })
    )
      await api.remove(c.id).catch(() => undefined);
  }

  const badge = openList.length > 0 && (
    <span className="cm-count">{t('editor.comments.openCount', { count: openList.length })}</span>
  );
  const privateNote = (
    <span className="cm-private">
      <Lock aria-hidden="true" />
      {t('editor.comments.private')}
    </span>
  );

  if (collapsed && !mobile)
    return (
      <section ref={sectionRef} className="cm cm--collapsed" aria-label={t('editor.comments.title')}>
        <button
          type="button"
          className="cm-collapsed-bar"
          aria-expanded="false"
          aria-controls="cm-panel"
          onClick={() => toggle(false)}
        >
          <span className="fd-icon-chip" aria-hidden="true">
            <MessageSquare />
          </span>
          <span className="cm-collapsed-bar__title">{t('editor.comments.title')}</span>
          {badge}
          {privateNote}
          <span className="cm-collapsed-bar__end">
            <span className="sr-only">{t('editor.comments.expand')}</span>
            <ChevronUp aria-hidden="true" />
          </span>
        </button>
      </section>
    );

  return (
    <section
      ref={sectionRef}
      id="cm-panel"
      className={`cm${mobile ? ' cm--mobile' : ''}`}
      style={mobile ? undefined : { height }}
      aria-labelledby="cm-title"
    >
      {dialog}
      {!mobile && (
        <div
          className="cm-handle"
          role="separator"
          aria-orientation="horizontal"
          aria-label={t('editor.comments.resize')}
          aria-valuemin={MIN_H}
          aria-valuemax={MAX_H}
          aria-valuenow={height}
          aria-controls="cm-panel"
          title={t('editor.comments.resizeHint')}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onKeyDown={onHandleKey}
        >
          <span className="cm-handle__grip" aria-hidden="true" />
        </div>
      )}
      <div className="cm-card">
        <header className="cm-head">
          <span className="fd-icon-chip" aria-hidden="true">
            <MessageSquare />
          </span>
          <div className="cm-head__titles">
            <div className="cm-head__line">
              <h2 id="cm-title" className="fd-card__title">
                {t('editor.comments.titleStep', { n: stepIndex + 1 })}
              </h2>
              {badge}
            </div>
            {privateNote}
            {!api.online && (
              <span className="cm-offline" role="status">
                <WifiOff aria-hidden="true" />
                {t('editor.comments.offline')}
              </span>
            )}
          </div>
          <div className="cm-head__end">
            {resolvedCount > 0 && (
              <Switch
                label={t('editor.comments.showResolved', { count: resolvedCount })}
                checked={showResolved}
                onChange={(e) => setShowResolved(e.target.checked)}
              />
            )}
            {!mobile && (
              <Button
                size="sm"
                variant="ghost"
                icon={<ChevronDown />}
                aria-label={t('editor.comments.collapse')}
                title={t('editor.comments.collapse')}
                aria-expanded="true"
                aria-controls="cm-panel"
                onClick={() => toggle(true)}
              />
            )}
          </div>
        </header>
        {header}

        <div className="cm-scroll">
          {api.loading ? (
            <div className="cm-skeletons" aria-hidden="true">
              {[0, 1].map((i) => (
                <div key={i} className="cm-skeleton">
                  <span className="cm-skeleton__avatar" />
                  <span className="cm-skeleton__lines">
                    <span style={{ width: '40%' }} />
                    <span style={{ width: '85%' }} />
                  </span>
                </div>
              ))}
            </div>
          ) : forStep.length === 0 ? (
            <div className="cm-state">
              <span className="fd-icon-chip" aria-hidden="true">
                <MessageSquare />
              </span>
              <strong>{t('editor.comments.emptyTitle')}</strong>
              <p>{t('editor.comments.emptyBody')}</p>
            </div>
          ) : visible.length === 0 ? (
            <div className="cm-state">
              <span className="fd-icon-chip" aria-hidden="true">
                <CircleCheck />
              </span>
              <strong>{t('editor.comments.allResolvedTitle')}</strong>
              <p>{t('editor.comments.allResolvedBody', { count: resolvedCount })}</p>
              <button type="button" className="link-button" onClick={() => setShowResolved(true)}>
                {t('editor.comments.showThem')}
              </button>
            </div>
          ) : (
            <ol
              className="cm-list"
              ref={listRef}
              aria-label={t('editor.comments.titleStep', { n: stepIndex + 1 })}
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) setPending(0);
              }}
            >
              {visible.map((c) => {
                const mineC = c.author_id === user?.id;
                const authorName = name(c.author_id);
                const edited = Date.parse(c.updated_at) - Date.parse(c.created_at) > 1000 && !c.resolved_at;
                const isFresh = !!fresh[c.id];
                const canResolve = isEditor || mineC;
                const menuItems: MenuItem[] = [];
                if (mineC)
                  menuItems.push({
                    label: t('editor.comments.edit'),
                    icon: <Pencil />,
                    onSelect: () => setEditing({ id: c.id, body: c.body }),
                  });
                if (mineC || isAdmin)
                  menuItems.push({
                    label: t('editor.comments.delete'),
                    icon: <Trash2 />,
                    danger: true,
                    onSelect: () => void confirmDelete(c),
                  });
                return (
                  <li
                    key={c.id}
                    className={`cm-item${c.resolved_at ? ' cm-item--resolved' : ''}${isFresh ? ' cm-item--new' : ''}`}
                    onMouseEnter={() => isFresh && unfresh(c.id)}
                  >
                    <Avatar id={c.author_id} label={authorName} />
                    <div className="cm-item__main">
                      <div className="cm-meta">
                        <strong>{authorName}</strong>
                        {mineC && <span>{t('editor.comments.you')}</span>}
                        <time dateTime={c.created_at} title={formatDateTime(c.created_at)}>
                          {formatRelative(c.created_at)}
                        </time>
                        {edited && <span>· {t('editor.comments.edited')}</span>}
                        {isFresh && <span className="cm-new">{t('editor.comments.new')}</span>}
                      </div>
                      {editing?.id === c.id ? (
                        <div className="cm-edit">
                          <textarea
                            className="fd-textarea"
                            aria-label={t('editor.comments.editLabel')}
                            autoFocus
                            rows={2}
                            maxLength={MAX_LEN}
                            value={editing.body}
                            onChange={(e) => setEditing({ id: c.id, body: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                e.stopPropagation();
                                setEditing(null);
                              } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                e.preventDefault();
                                void saveEdit();
                              }
                            }}
                          />
                          <div className="cm-edit__actions">
                            <span className="cm-hint">{t('editor.comments.editHint')}</span>
                            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                              {t('editor.comments.cancel')}
                            </Button>
                            <Button size="sm" variant="primary" onClick={() => void saveEdit()}>
                              {t('editor.comments.save')}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="cm-body">
                          <Linkified text={c.body} />
                        </p>
                      )}
                      {c.resolved_at && (
                        <span className="cm-resolved-by">
                          <CircleCheck aria-hidden="true" />
                          {t('editor.comments.resolvedBy', { name: name(c.resolved_by) })}
                        </span>
                      )}
                    </div>
                    {editing?.id !== c.id && (canResolve || menuItems.length > 0) && (
                      <div className="cm-actions">
                        {canResolve && (
                          <Button
                            size="sm"
                            icon={c.resolved_at ? <RotateCcw /> : <CircleCheck />}
                            onClick={() => void api.setResolved(c.id, !c.resolved_at).catch(() => undefined)}
                          >
                            {c.resolved_at ? t('editor.comments.reopen') : t('editor.comments.resolve')}
                          </Button>
                        )}
                        {menuItems.length > 0 && (
                          <Menu
                            label={
                              mineC
                                ? t('editor.comments.actionsMine')
                                : t('editor.comments.actionsFor', { name: authorName })
                            }
                            items={menuItems}
                          />
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          {pending > 0 && (
            <button
              type="button"
              className="cm-pending"
              onClick={() => {
                listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
                setPending(0);
              }}
            >
              {t('editor.comments.newBelow', { count: pending })}
              <ArrowDown aria-hidden="true" />
            </button>
          )}
        </div>

        <p className="sr-only" aria-live="polite">
          {live}
        </p>

        {canComment && (
          <div className="cm-compose">
            {sendError && (
              <Alert kind="error">
                {t('editor.comments.errorSend')}{' '}
                <button type="button" className="link-button" onClick={() => void send()}>
                  {t('editor.comments.retry')}
                </button>
              </Alert>
            )}
            <form
              className="cm-compose__row"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              {user && <Avatar id={user.id} label={name(user.id) || user.email || '?'} />}
              <textarea
                ref={draftRef}
                className="fd-textarea cm-compose__input"
                rows={1}
                maxLength={MAX_LEN}
                placeholder={
                  mobile ? t('editor.comments.placeholderShort') : t('editor.comments.placeholder')
                }
                aria-label={t('editor.comments.placeholderShort')}
                aria-describedby="cm-compose-hint"
                value={draft}
                disabled={!stepId}
                onFocus={() => setComposeFocus(true)}
                onBlur={() => setComposeFocus(false)}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setSendError(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <Button
                type="submit"
                variant="primary"
                className="cm-send"
                icon={<ArrowUp />}
                disabled={!draft.trim() || !stepId || sending}
                aria-label={t('editor.comments.send')}
                title={t('editor.comments.send')}
              />
            </form>
            <div className="cm-compose__foot">
              <span id="cm-compose-hint" className={`cm-hint${composeFocus ? '' : ' cm-hint--idle'}`}>
                {t('editor.comments.composeHint')}
              </span>
              {draft.length >= COUNT_FROM && (
                <span className={`cm-counter${draft.length >= MAX_LEN ? ' is-max' : ''}`}>
                  {t('editor.comments.tooLong', { count: draft.length })}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
