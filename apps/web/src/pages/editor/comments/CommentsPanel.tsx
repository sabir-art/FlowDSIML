import { avatarTone } from '../../../lib/avatarTone';
import { bodyParts, serialize, toDraft, type Mention } from '../../../lib/mentions';
import { MentionInput } from './MentionInput';
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
  AtSign,
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
import { Button, Composer, Switch } from '@flowdsiml/ui';
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
const MAX_LEN = 500;
const NEW_MS = 4000;
/** Dernière lecture des commentaires, par étape (ouverture sur le premier non lu). */
const SEEN_KEY = 'fd.editor.comments.seen';
function readSeen(): Record<string, string> {
  try {
    return JSON.parse(read(SEEN_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

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
  focusComment,
}: {
  stepId: string | null;
  stepIndex: number;
  api: StepCommentsApi;
  /** Tout membre peut commenter (viewer compris, décision du chef d'équipe). */
  canComment?: boolean;
  variant?: 'panel' | 'mobile';
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
  const isAdmin = current?.role === 'owner' || current?.role === 'admin';
  const isEditor = isAdmin || current?.role === 'editor';

  const [height, setHeight] = useState(() => {
    const v = Number(read(HEIGHT_KEY));
    return Number.isFinite(v) && v >= MIN_H ? Math.min(v, MAX_H) : defaultHeight();
  });
  // Replié par défaut (absent de la maquette d'origine de l'éditeur) ; l'état choisi est mémorisé
  const [collapsed, setCollapsed] = useState(() => !mobile && read(COLLAPSED_KEY) !== '0');
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
  const drag = useRef<{ y: number; h: number; moved: boolean } | null>(null);
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
  // L22-05 : arrivée depuis une notification → panneau déplié, commentaire montré et mis en évidence
  const [highlight, setHighlight] = useState<string | null>(null);
  const scrolled = useRef<string | null>(null);
  const target = focusComment ? forStep.find((c) => c.id === focusComment) : undefined;
  useEffect(() => {
    if (!target || highlight === target.id) return;
    setHighlight(target.id);
    setCollapsed(false);
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
      if (mobile) item.scrollIntoView({ block: 'center' });
      else list.scrollTop = Math.max(0, item.offsetTop - 8);
    }
    if (idx > 0) setOlderAbove(idx);
  }, [stepId, api.loading, visible.length]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Jamais plus de 60 % de la colonne : le canevas garde au moins 240 px. */
  function clamp(h: number) {
    // Hauteur de la colonne centrale (.stage) : le parent direct (.stage-comments) épouse le panneau.
    const el = sectionRef.current;
    const col = (el?.closest('.stage') ?? el?.parentElement)?.clientHeight ?? window.innerHeight;
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
    drag.current = { y: e.clientY, h: height, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    if (Math.abs(drag.current.y - e.clientY) > 3) drag.current.moved = true;
    setHeight(clamp(drag.current.h + (drag.current.y - e.clientY)));
  }
  /** L34 (WCAG 2.5.7) : un clic sans glisser fait passer la hauteur à la taille suivante (petite, moyenne, grande). */
  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    const sizes = [MIN_H, clamp((MIN_H + MAX_H) / 2), clamp(MAX_H)];
    const next = sizes.find((x) => x > height + 1) ?? sizes[0]!;
    setHeight(next);
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

  if (collapsed && !mobile)
    return (
      <section ref={sectionRef} className="cm cm--collapsed" aria-label={t('editor.comments.title')}>
        <button
          type="button"
          className="cm-collapsed-bar"
          aria-expanded="false"
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
          onPointerUp={onPointerUp}
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
              // Panneau bas : la barre d'actions reste visible (en-tête, barre et une ligne de fil gardés)
              maxLines={mobile ? 8 : Math.floor((height - 200) / 22)}
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
