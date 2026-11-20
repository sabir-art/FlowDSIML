/**
 * L22-05/06 : cloche de la barre du haut et panneau de notifications (commentaires et mentions).
 * Panneau non modal (role=dialog) : Échap ou clic à l'extérieur le ferme, le focus revient à la cloche.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HelpButton } from '../../help/HelpButton';
import {
  ArrowLeft,
  AtSign,
  Bell,
  BellRing,
  Webhook,
  CheckCheck,
  CheckCircle2,
  CornerDownRight,
  BellOff,
  MessageSquare,
  Settings,
  X,
} from 'lucide-react';
import { initials } from '../../lib/initials';
import { Menu } from '../Menu';
import { useToast } from '../Toast';
import { formatRelativeShort } from '../../lib/format';
import { avatarTone } from '../../lib/avatarTone';
import { useNotifications, type NotificationItem } from './useNotifications';
import { NOTIFICATION_KINDS, badge, bodyParts, grouped, notificationHref } from './notifications';
import './notifications.css';

type Filter = 'all' | 'mention' | 'unread';
const FILTERS: Filter[] = ['all', 'mention', 'unread'];
const MARK = '\u0001';
const KIND_ICON = {
  mention: AtSign,
  reply: CornerDownRight,
  comment: MessageSquare,
  resolved: CheckCircle2,
  alert: BellRing,
  webhook_paused: Webhook,
};

export function NotificationBell() {
  const { t } = useTranslation();
  const id = useId();
  const n = useNotifications();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'list' | 'prefs'>('list');
  const [filter, setFilter] = useState<Filter>('all');
  // Cloche placée à gauche (barre d'Analytics) : le panneau s'ouvre vers la droite, jamais sous la barre latérale
  const [toRight, setToRight] = useState(false);
  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    setToRight(r.right - Math.min(440, window.innerWidth - 32) < window.innerWidth * 0.25);
  }, [open]);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  const close = (refocus = true) => {
    setOpen(false);
    setView('list');
    if (refocus) btn.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    pop.current?.focus();
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      // Le menu ⋯ d'une notification est rendu dans le portail : il fait partie du panneau
      const inPortal = (target as Element).closest?.('#fd-portal');
      if (!pop.current?.contains(target) && !btn.current?.contains(target) && !inPortal) close(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // L28-06 : nouvelle notification annoncée (aria-live polite) au plus une fois par minute, regroupée
  const toast = useToast();
  const [announce, setAnnounce] = useState('');
  const prevUnread = useRef<number | null>(null);
  const pending = useRef(0);
  const lastAnnounce = useRef(0);
  useEffect(() => {
    if (n.loading) return;
    if (prevUnread.current !== null && n.unread > prevUnread.current)
      pending.current += n.unread - prevUnread.current;
    prevUnread.current = n.unread;
    if (!pending.current) return;
    const say = () => {
      setAnnounce(t('notifications.announce', { count: pending.current }));
      pending.current = 0;
      lastAnnounce.current = Date.now();
    };
    const wait = 60_000 - (Date.now() - lastAnnounce.current);
    if (wait <= 0) return say();
    const id = window.setTimeout(say, wait);
    return () => window.clearTimeout(id);
  }, [n.unread, n.loading, t]);
  const mutedIds = new Set(n.muted.map((m) => m.demoId));

  const mentions = n.items.filter((x) => x.kind === 'mention').length;
  const shown = n.items.filter((x) =>
    filter === 'mention' ? x.kind === 'mention' : filter === 'unread' ? !x.read_at : true,
  );
  const label = n.unread === 0 ? t('notifications.bellNone') : t('notifications.bell', { count: n.unread });

  const onTabKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (i + d + FILTERS.length) % FILTERS.length;
    setFilter(FILTERS[next] ?? 'all');
    tabs.current[next]?.focus();
  };

  return (
    <>
      {/* L26-02 : bouton « Aide » à côté de la cloche, dans toutes les barres du haut */}
      <HelpButton />
      <span className="nb" data-tip-side="bottom">
        <button
          ref={btn}
          type="button"
          className="fd-btn fd-btn--ghost fd-btn--icon nb-bell"
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? `${id}-pop` : undefined}
          onClick={() => (open ? close() : setOpen(true))}
        >
          <Bell aria-hidden="true" />
          {n.unread > 0 && (
            <span className="nb-cnt" aria-hidden="true">
              {badge(n.unread)}
            </span>
          )}
        </button>
        {open && (
          <div
            ref={pop}
            id={`${id}-pop`}
            className={`nb-pop${toRight ? ' nb-pop--right' : ''}`}
            role="dialog"
            aria-labelledby={`${id}-t`}
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                close();
              }
            }}
          >
            {view === 'list' ? (
              <>
                <header>
                  <h2 id={`${id}-t`}>{t('notifications.title')}</h2>
                  {n.unread > 0 && (
                    <button
                      type="button"
                      className="fd-btn fd-btn--ghost fd-btn--sm"
                      onClick={() => void n.markRead()}
                    >
                      <CheckCheck aria-hidden="true" />
                      {t('notifications.markAll')}
                    </button>
                  )}
                  <button
                    type="button"
                    className="fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm"
                    aria-label={t('common.close')}
                    onClick={() => close()}
                  >
                    <X aria-hidden="true" />
                  </button>
                </header>
                <div className="fd-segmented" role="tablist" aria-label={t('notifications.filter')}>
                  {FILTERS.map((f, i) => (
                    <button
                      key={f}
                      ref={(el) => {
                        tabs.current[i] = el;
                      }}
                      type="button"
                      role="tab"
                      id={`${id}-tab-${f}`}
                      aria-selected={filter === f}
                      aria-controls={`${id}-panel`}
                      tabIndex={filter === f ? 0 : -1}
                      onClick={() => setFilter(f)}
                      onKeyDown={(e) => onTabKey(e, i)}
                    >
                      {t(`notifications.f_${f}`)}
                      {f === 'mention' && mentions > 0 && ` · ${mentions}`}
                      {f === 'unread' && n.unread > 0 && ` · ${n.unread}`}
                    </button>
                  ))}
                </div>
                <div
                  className="nb-body"
                  id={`${id}-panel`}
                  role="tabpanel"
                  aria-labelledby={`${id}-tab-${filter}`}
                >
                  {n.loading ? null : shown.length === 0 ? (
                    <div className="nb-empty" role="status">
                      <span className="fd-icon-chip">
                        <Bell aria-hidden="true" />
                      </span>
                      <b>{t('notifications.emptyTitle')}</b>
                      <p>{t(filter === 'all' ? 'notifications.emptyBody' : 'notifications.emptyFilter')}</p>
                    </div>
                  ) : (
                    grouped(shown).map((g) => (
                      <section key={g.group} aria-labelledby={`${id}-g-${g.group}`}>
                        <h3 className="nb-group" id={`${id}-g-${g.group}`}>
                          {t(`notifications.g_${g.group}`)}
                        </h3>
                        <ul className="nb-list">
                          {g.rows.map((x) => (
                            <Row
                              key={x.id}
                              item={x}
                              muted={!!x.demo_id && mutedIds.has(x.demo_id)}
                              onMute={async () => {
                                if (x.demo_id && (await n.mute(x.demo_id)))
                                  toast(
                                    t('notifications.mutedToast', {
                                      demo: x.demoTitle || t('demos.untitled'),
                                    }),
                                  );
                              }}
                              onOpen={() => {
                                if (!x.read_at) void n.markRead([x.id]);
                                close(false);
                              }}
                            />
                          ))}
                        </ul>
                      </section>
                    ))
                  )}
                </div>
                <footer className="nb-foot">
                  <span className="fd-help">{t('notifications.window')}</span>
                  <button
                    type="button"
                    className="fd-btn fd-btn--ghost fd-btn--sm"
                    onClick={() => setView('prefs')}
                  >
                    <Settings aria-hidden="true" />
                    {t('notifications.prefs')}
                  </button>
                </footer>
              </>
            ) : (
              <>
                <header>
                  <button
                    type="button"
                    className="fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm"
                    aria-label={t('notifications.back')}
                    onClick={() => setView('list')}
                  >
                    <ArrowLeft aria-hidden="true" />
                  </button>
                  <h2 id={`${id}-t`}>{t('notifications.prefsTitle')}</h2>
                  <button
                    type="button"
                    className="fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm"
                    aria-label={t('common.close')}
                    onClick={() => close()}
                  >
                    <X aria-hidden="true" />
                  </button>
                </header>
                <p className="fd-help nb-prefs-help">{t('notifications.prefsHelp')}</p>
                <ul className="nb-prefs">
                  {NOTIFICATION_KINDS.map((k) => (
                    <li key={k}>
                      <label className="fd-switch">
                        <span>
                          {t(`notifications.p_${k}`)}
                          {k === 'mention' && (
                            <span className="fd-help nb-pref-help" id={`${id}-mention-h`}>
                              {t('notifications.mentionAlways')}
                            </span>
                          )}
                        </span>
                        <input
                          type="checkbox"
                          role="switch"
                          checked={k === 'mention' ? true : n.prefs[k]}
                          // L28-06 : les mentions sont toujours signalées
                          aria-disabled={k === 'mention' || undefined}
                          aria-describedby={k === 'mention' ? `${id}-mention-h` : undefined}
                          onChange={(e) => k !== 'mention' && void n.setPref(k, e.target.checked)}
                        />
                        <span className="fd-switch__track" aria-hidden="true" />
                      </label>
                    </li>
                  ))}
                  <li>
                    <label className="fd-switch is-soon">
                      <span>
                        {t('notifications.p_email')} <span className="fd-badge">{t('shell.soon')}</span>
                      </span>
                      <input type="checkbox" role="switch" checked={false} disabled />
                      <span className="fd-switch__track" aria-hidden="true" />
                    </label>
                  </li>
                  <li>
                    <label className="fd-switch is-soon">
                      <span>
                        {t('notifications.p_digest')} <span className="fd-badge">{t('shell.soon')}</span>
                      </span>
                      <input type="checkbox" role="switch" checked={false} disabled />
                      <span className="fd-switch__track" aria-hidden="true" />
                    </label>
                  </li>
                </ul>
                {/* L28-06 : démos coupées, avec « Réactiver » */}
                <h3 className="nb-group">{t('notifications.mutedTitle')}</h3>
                {n.muted.length ? (
                  <ul className="nb-muted">
                    {n.muted.map((m) => (
                      <li key={m.demoId}>
                        <BellOff aria-hidden="true" />
                        <span className="grow">{m.title || t('demos.untitled')}</span>
                        <button
                          type="button"
                          className="fd-btn fd-btn--ghost fd-btn--sm"
                          aria-label={t('notifications.unmuteLabel', {
                            demo: m.title || t('demos.untitled'),
                          })}
                          onClick={() => void n.unmute(m.demoId)}
                        >
                          {t('notifications.unmute')}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="fd-help nb-prefs-help">{t('notifications.mutedNone')}</p>
                )}
              </>
            )}
          </div>
        )}
      </span>
      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
    </>
  );
}

function Row({
  item: x,
  onOpen,
  muted,
  onMute,
}: {
  item: NotificationItem;
  onOpen: () => void;
  muted: boolean;
  onMute: () => void;
}) {
  const { t } = useTranslation();
  const Icon = KIND_ICON[x.kind];
  if (x.kind === 'alert' || x.kind === 'webhook_paused')
    return <AlertRow item={x} icon={Icon} onOpen={onOpen} />;
  const actor = x.actorName || t('notifications.someone');
  const step = x.stepNumber ?? '?';
  const quote = (x.kind === 'mention' || x.kind === 'reply') && x.body;
  // L28-06 : commentaire supprimé : la notification reste lisible
  // Nom en gras sans analyser de balises : le titre de la démo reste du texte brut
  const [before, after = ''] = t(`notifications.k_${x.kind}`, {
    actor: MARK,
    demo: x.demoTitle || t('demos.untitled'),
    step,
  }).split(MARK);
  return (
    <li className={x.read_at ? undefined : 'unread'}>
      <span className={`nb-avatar nb-avatar--${avatarTone(x.actor_id ?? x.id)}`} aria-hidden="true">
        {initials(actor)}
      </span>
      <span className="nb-text">
        {before}
        <b>{actor}</b>
        {after}
        {quote && (
          <span className="nb-q">
            {bodyParts(x.body!).map((p, i) =>
              'text' in p ? (
                <span key={i}>{p.text}</span>
              ) : (
                <span key={i} className="nb-mtag">
                  @{p.mention}
                </span>
              ),
            )}
          </span>
        )}
        {x.deleted && <span className="nb-q nb-deleted">{t('notifications.deleted')}</span>}
        <small>
          <Icon aria-hidden="true" />
          {formatRelativeShort(x.created_at)}
        </small>
      </span>
      <span className={x.read_at ? undefined : 'nb-dot'}>
        {!x.read_at && <span className="sr-only">{t('notifications.unread')}</span>}
      </span>
      <Link
        className="nb-cover"
        to={notificationHref(x)}
        aria-label={t(`notifications.open_${x.kind}`, { actor, step })}
        onClick={onOpen}
      />
      {!muted && x.demo_id && (
        <span className="nb-more">
          <Menu
            label={t('notifications.more', { demo: x.demoTitle || t('demos.untitled') })}
            items={[{ label: t('notifications.mute'), icon: <BellOff />, onSelect: onMute }]}
          />
        </span>
      )}
    </li>
  );
}

/** L19 : alerte (« 3 nouveaux leads », « Vues au-dessus de 500 »…), vers l'onglet Alertes. */
function AlertRow({
  item: x,
  icon: Icon,
  onOpen,
}: {
  item: NotificationItem;
  icon: typeof Bell;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const d = x.data ?? {};
  // L29 : webhook en pause automatique après 6 échecs (propriétaires et admins)
  const text =
    x.kind === 'webhook_paused'
      ? t('notifications.webhookPaused', { name: d.name || d.host || '?', host: d.host || '?' })
      : t(`notifications.alert_${d.trigger ?? 'lead'}`, {
          count: d.count ?? 0,
          value: d.value ?? '?',
          threshold: d.threshold ?? '?',
          demo: x.demoTitle || t('notifications.allDemos'),
        });
  const digest = d.digest ? t(`notifications.digest_${d.digest}`) : null;
  return (
    <li className={x.read_at ? undefined : 'unread'}>
      <span className="nb-avatar nb-avatar--alert" aria-hidden="true">
        <Icon />
      </span>
      <span className="nb-text">
        {text}
        <small>
          <Icon aria-hidden="true" />
          {digest ? `${digest} · ` : ''}
          {formatRelativeShort(x.created_at)}
        </small>
      </span>
      <span className={x.read_at ? undefined : 'nb-dot'}>
        {!x.read_at && <span className="sr-only">{t('notifications.unread')}</span>}
      </span>
      <Link
        className="nb-cover"
        to={notificationHref(x)}
        aria-label={
          x.kind === 'webhook_paused'
            ? t('notifications.open_webhook', { text })
            : t('notifications.open_alert', { text })
        }
        onClick={onOpen}
      />
    </li>
  );
}
