import { avatarTone } from '../../../lib/avatarTone';
import { bodyParts, serialize, toDraft, type Mention } from '../../../lib/mentions';
import { AvatarPhoto } from '../../../components/AvatarPhoto';
import { MentionInput } from './MentionInput';
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowDown,
  ArrowUp,
  AtSign,
  CircleCheck,
  Lock,
  MessageSquare,
  Pencil,
  RotateCcw,
  Trash2,
  WifiOff,
} from 'lucide-react';
import { Button, Composer, Empty, Switch } from '@flowdsiml/ui';
import { useAuth } from '../../../auth/AuthProvider';
import { useWorkspace } from '../../../workspace/WorkspaceProvider';
import { useConfirm } from '../../../components/ConfirmDialog';
import { Menu, type MenuItem } from '../../../components/Menu';
import { formatDateTime, formatRelative } from '../../../lib/format';
import { initials } from '../../../lib/initials';
import type { StepComment, StepCommentsApi } from './useStepComments';

const MAX_LEN = 500;
const NEW_MS = 4000;
/** Dernière lecture des commentaires, par étape (ouverture sur le premier non lu). */
const SEEN_KEY = 'fd.editor.comments.seen';
export function readSeen(): Record<string, string> {
  try {
    return JSON.parse(read(SEEN_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

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

const mapDraft = (d: { text: string; mentions: Mention[] }) => ({ body: d.text, mentions: d.mentions });

/** L22-07 : message avec mentions en pastilles ; le reste en texte brut avec liens. */
function CommentBody({ body }: { body: string }) {
  return (
    <>
      {bodyParts(body).map((p, i) =>
        'text' in p ? (
          <Linkified key={i} text={p.text} />
        ) : (
          <span key={i} className="cm-mtag">
            @{p.mention}
          </span>
        ),
      )}
    </>
  );
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
      <AvatarPhoto userId={id} />
    </span>
  );
}

/**
 * Panneau « Commentaires » de l'éditeur (docs/ux/commentaires.md) : commentaires internes de
 * l'étape courante, jamais publiés. `variant="dock"` : sous le canevas (CommentsDock) ;
 * `variant="mobile"` : écran étroit, pleine hauteur, sans poignée.
 */
export function CommentsPanel({
  stepId,
  stepIndex,
  api,
  canComment = true,
  variant = 'dock',
  header,
  focusComment,
}: {
  stepId: string | null;
  stepIndex: number;
  api: StepCommentsApi;
  /** Tout membre peut commenter (viewer compris, décision du chef d'équipe). */
  canComment?: boolean;
  /** « dock » : panneau sous le canevas (retours client 21/11 §1) ; « mobile » : écran étroit. */
  variant?: 'dock' | 'mobile';
  /** Contenu inséré sous l'en-tête (sélecteur d'étape en mobile). */
  header?: ReactNode;
  /** L22-05 : commentaire à montrer (lien d'une notification) : panneau déplié, fil visible. */
  focusComment?: string | null;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { current } = useWorkspace();
  const [dialog, ask] = useConfirm();
  const mobile = variant === 'mobile';
  const dock = variant === 'dock';
  const isAdmin = current?.role === 'owner' || current?.role === 'admin';
  const isEditor = isAdmin || current?.role === 'editor';

  const [showResolved, setShowResolved] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftMentions, setDraftMentions] = useState<Mention[]>([]);
  // L43 : bouton « Mentionner » de la barre du composeur (nouveau commentaire et modification)
  const [mentionSignal, setMentionSignal] = useState(0);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [editSignal, setEditSignal] = useState(0);
  const [editMentionOpen, setEditMentionOpen] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState<{ id: string; body: string; mentions: Mention[] } | null>(null);
  const [fresh, setFresh] = useState<Record<string, true>>({});
  const [pending, setPending] = useState(0);
  /** Commentaires lus plus haut que le premier non lu (pilule « n plus anciens ↑ »). */
  const [olderAbove, setOlderAbove] = useState(0);
  const unreadDoneFor = useRef<string | null>(null);
  /** Étape dont la liste est positionnée sur le premier non lu (pas de défilement automatique en bas). */
  const anchoredFor = useRef<{ step: string; len: number } | null>(null);
  const [live, setLive] = useState('');
  const sectionRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
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
  // L22-05 : arrivée depuis une notification → panneau déplié, commentaire montré et mis en évidence
  const [highlight, setHighlight] = useState<string | null>(null);
  const scrolled = useRef<string | null>(null);
  const target = focusComment ? forStep.find((c) => c.id === focusComment) : undefined;
  useEffect(() => {
    if (!target || highlight === target.id) return;
    setHighlight(target.id);
    if (target.resolved_at) setShowResolved(true);
  }, [target, highlight]);
  useEffect(() => {
    if (!highlight || scrolled.current === highlight) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-comment="${highlight}"]`);
    if (!el) return;
    scrolled.current = highlight;
    el.scrollIntoView({ block: 'center' });
  });
  // L22-07 : membres du workspace qu'on peut mentionner (jamais soi-même)
  const mentionable = Object.values(api.authors).filter((a) => a.user_id !== user?.id);
  const unfresh = (id: string) =>
    setFresh((f) => {
      if (!f[id]) return f;
      const next = { ...f };
      delete next[id];
      return next;
    });

  useEffect(() => {
    setShowResolved(false);
    setEditing(null);
    setPending(0);
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
    const a = anchoredFor.current;
    if (a && a.step === stepId && a.len === forStep.length) return; // positionné sur le premier non lu
    if (el && !pendingRef.current) el.scrollTop = el.scrollHeight;
  }, [stepId, forStep.length]);

  // Ouverture sur le premier commentaire non lu (d'un autre membre, posté depuis la dernière lecture)
  useLayoutEffect(() => {
    if (!stepId || api.loading || unreadDoneFor.current === stepId) return;
    if (visible.length && !listRef.current?.querySelector('[data-comment]')) return; // liste pas encore rendue
    unreadDoneFor.current = stepId;
    anchoredFor.current = null;
    const seenMap = readSeen();
    const seenAt = seenMap[stepId] ? Date.parse(seenMap[stepId]!) : 0;
    const idx = visible.findIndex((c) => c.author_id !== user?.id && Date.parse(c.created_at) > seenAt);
    store(SEEN_KEY, JSON.stringify({ ...seenMap, [stepId]: new Date().toISOString() }));
    setOlderAbove(0);
    if (idx < 0 || !seenAt) return; // tout est lu, ou première visite : comportement habituel (bas de liste)
    const unread = visible.slice(idx);
    setFresh((f) => ({ ...f, ...Object.fromEntries(unread.map((c) => [c.id, true as const])) }));
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>(`[data-comment="${visible[idx]!.id}"]`);
    if (list && item) {
      anchoredFor.current = { step: stepId, len: forStep.length };
      // Le premier non lu en haut de la liste, à 8 px (la pilule des plus anciens reste au-dessus)
      list.scrollTop += item.getBoundingClientRect().top - list.getBoundingClientRect().top - 8;
    }
    if (idx > 0) setOlderAbove(idx);
  }, [stepId, api.loading, visible.length]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send() {
    const text = draft.trim();
    if (!text || !stepId || text.length > MAX_LEN || sending) return;
    const body = serialize(text, draftMentions);
    setSending(true);
    setSendError(false);
    try {
      await api.add(stepId, body);
      setDraft('');
      setDraftMentions([]);
      setPending(0);
    } catch {
      setSendError(true); // le texte reste dans le champ
    } finally {
      setSending(false);
    }
  }
  async function saveEdit() {
    if (!editing) return;
    const text = editing.body.trim();
    if (!text || text.length > MAX_LEN) return;
    const body = serialize(text, editing.mentions);
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
  const mentionTool = (expanded: boolean, onOpen: () => void, listId: string, disabled = false) => (
    <button
      type="button"
      className="fd-composer__tool"
      aria-label={t('editor.comments.mention')}
      aria-haspopup="listbox"
      aria-expanded={expanded}
      aria-controls={expanded ? listId : undefined}
      disabled={disabled}
      // Garde le focus dans le champ (la liste se ferme quand le champ perd le focus)
      onMouseDown={(e) => e.preventDefault()}
      onClick={onOpen}
    >
      <AtSign aria-hidden="true" />
    </button>
  );

  const privateNote = (
    <span className="cm-private" id="cm-private">
      <Lock aria-hidden="true" />
      {t('editor.comments.private')}
    </span>
  );

  return (
    <section ref={sectionRef} id="cm-panel" className={`cm cm--${variant}`} aria-labelledby="cm-title">
      {dialog}
      <div className="cm-card">
        <header className="cm-head">
          {!dock && (
            <span className="fd-icon-chip" aria-hidden="true">
              <MessageSquare />
            </span>
          )}
          <div className="cm-head__titles">
            <div className="cm-head__line">
              {/* Dock : la barre porte « Commentaires », l'étape et le badge (seul indicateur) ; titre gardé pour les lecteurs d'écran */}
              <h2 id="cm-title" className={dock ? 'sr-only' : 'fd-card__title'}>
                {t('editor.comments.titleStep', { n: stepIndex + 1 })}
              </h2>
              {!dock && badge}
            </div>
            {/* Dock : la mention « interne » est dans la barre du panneau (CommentsDock) */}
            {!dock && privateNote}
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
          </div>
        </header>
        {header}

        <div className="cm-scroll">
          {olderAbove > 0 && (
            <button
              type="button"
              className="cm-older"
              onClick={() => {
                listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                setOlderAbove(0);
              }}
            >
              {t('editor.comments.olderAbove', { count: olderAbove })}
              <ArrowUp aria-hidden="true" />
            </button>
          )}
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
            <Empty
              variant="compact"
              level={3}
              icon={<MessageSquare />}
              title={t('editor.comments.emptyTitle')}
              body={t('editor.comments.emptyBody')}
            />
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
                if (el.scrollTop < 8) setOlderAbove(0);
              }}
            >
              {visible.map((c) => {
                const mineC = c.author_id === user?.id;
                // L28-08 : auteur dont le compte a été supprimé
                const authorName = c.author_id ? name(c.author_id) : t('editor.comments.formerMember');
                const edited = Date.parse(c.updated_at) - Date.parse(c.created_at) > 1000 && !c.resolved_at;
                const isFresh = !!fresh[c.id];
                const canResolve = isEditor || mineC;
                const menuItems: MenuItem[] = [];
                if (mineC)
                  menuItems.push({
                    label: t('editor.comments.edit'),
                    icon: <Pencil />,
                    onSelect: () => setEditing({ id: c.id, ...mapDraft(toDraft(c.body)) }),
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
                    data-comment={c.id}
                    className={`cm-item${c.resolved_at ? ' cm-item--resolved' : ''}${isFresh ? ' cm-item--new' : ''}${c.id === highlight ? ' cm-item--focus' : ''}`}
                    onMouseEnter={() => isFresh && unfresh(c.id)}
                  >
                    <Avatar id={c.author_id ?? c.id} label={authorName} />
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
                        <Composer
                          className="cm-edit"
                          label={t('editor.comments.editLabel')}
                          placeholder={t('editor.comments.placeholderShort')}
                          maxLength={MAX_LEN}
                          value={editing.body}
                          submitLabel={t('editor.comments.saveSubmit')}
                          submitKey={t('editor.comments.enterKey')}
                          edit={{
                            cancelLabel: t('editor.comments.cancel'),
                            onCancel: () => setEditing(null),
                          }}
                          counterLabel={(count, max) => t('editor.comments.counter', { count, max })}
                          onSubmit={() => void saveEdit()}
                          tools={mentionTool(
                            editMentionOpen,
                            () => setEditSignal((n) => n + 1),
                            'cm-edit-ac',
                          )}
                          renderInput={(props) => (
                            <MentionInput
                              {...props}
                              autoFocus
                              mentions={editing.mentions}
                              members={mentionable}
                              openSignal={editSignal}
                              onOpenChange={setEditMentionOpen}
                              listId="cm-edit-ac"
                              onValueChange={(body, mentions) => setEditing({ id: c.id, body, mentions })}
                            />
                          )}
                        />
                      ) : (
                        <p className="cm-body">
                          <CommentBody body={c.body} />
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
            <Composer
              label={t('editor.comments.composeLabel')}
              // Dock : 4 lignes au plus, la barre d'actions reste dans le panneau même bas
              maxLines={dock ? 4 : 8}
              placeholder={
                !stepId
                  ? t('editor.comments.placeholderNoStep')
                  : mobile
                    ? t('editor.comments.placeholderShort')
                    : t('editor.comments.placeholder')
              }
              maxLength={MAX_LEN}
              value={draft}
              disabled={!stepId}
              sending={sending}
              submitLabel={t('editor.comments.send')}
              submitKey={t('editor.comments.enterKey')}
              describedBy="cm-private"
              counterLabel={(count, max) => t('editor.comments.counter', { count, max })}
              onSubmit={() => void send()}
              error={
                sendError && (
                  <>
                    {t('editor.comments.errorSend')}{' '}
                    <button type="button" className="link-button" onClick={() => void send()}>
                      {t('editor.comments.retry')}
                    </button>
                  </>
                )
              }
              tools={mentionTool(mentionOpen, () => setMentionSignal((n) => n + 1), 'cm-compose-ac', !stepId)}
              renderInput={(props) => (
                <MentionInput
                  {...props}
                  ref={(el) => {
                    draftRef.current = el;
                    if (typeof props.ref === 'function') props.ref(el);
                  }}
                  mentions={draftMentions}
                  members={mentionable}
                  openSignal={mentionSignal}
                  onOpenChange={setMentionOpen}
                  listId="cm-compose-ac"
                  onValueChange={(text, mentions) => {
                    setDraft(text);
                    setDraftMentions(mentions);
                    setSendError(false);
                  }}
                />
              )}
            />
          </div>
        )}
      </div>
    </section>
  );
}
