import { formatDate } from '../../lib/format';
import { initials } from '../../lib/initials';
import { AvatarPhoto } from '../../components/AvatarPhoto';
import { CopyField } from '../../components/CopyField';
export { initials };
import { useConfirm } from '../../components/ConfirmDialog';
import {
  CircleAlert,
  CircleHelp,
  Check,
  CircleCheck,
  Copy,
  Info,
  LogOut,
  Mail,
  MailCheck,
  Search,
  Star,
  Trash2,
  UserPlus,
  UserMinus,
} from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { assignableRoles, can as roleCan, ROLES, type Action, type Role } from '@flowdsiml/core';
import type { Tables, WorkspaceRole } from '@flowdsiml/supabase-types';
import { supabase } from '../../lib/supabase';
import { APP_URL } from '../../lib/env';
import { check, useAction } from '../../lib/useAction';
import { useAuth } from '../../auth/AuthProvider';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { Menu, type MenuItem } from '../../components/Menu';
import { SettingsShell } from './SettingsShell';
import { Button, Modal, Select, computePosition, getPortal } from '@flowdsiml/ui';
import { useToast } from '../../components/Toast';
import { EmailChips, isEmail, splitEmails } from '../../components/EmailChips';

interface MemberRow {
  user_id: string;
  email: string;
  full_name: string;
  role: WorkspaceRole;
}

export function inviteUrl(token: string) {
  return `${APP_URL}#/invite/${token}`;
}

type SendStatus = 'sent' | 'failed' | 'rate_limit' | 'budget' | 'sent_before' | 'not_found';

/**
 * E-mails P1 : envoi des invitations créées (fonction invite-email). Nouvelle adresse : e-mail Supabase
 * Auth ; compte existant : notification dans l'app, avec la même réponse (l'admin ne sait pas lequel). Réseau en échec : toutes en échec (repli sur le lien).
 */
async function sendInvitations(ids: string[]): Promise<Record<string, SendStatus>> {
  const { data, error } = await supabase.functions.invoke<{
    results: Array<{ id: string; status: SendStatus }>;
  }>('invite-email', { body: { invitations: ids, appUrl: APP_URL } });
  const by = Object.fromEntries(ids.map((id) => [id, 'failed' as SendStatus]));
  if (!error) for (const r of data?.results ?? []) by[r.id] = r.status;
  return by;
}
const delivered = (s: SendStatus | undefined) => s === 'sent';

/** Rôles du plus élevé au plus faible, comme le tableau des permissions de la maquette. */
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const ROLE_ORDER = [...ROLES].reverse() as Role[];
const PERMISSIONS: Array<{ key: string; action: Action }> = [
  { key: 'view', action: 'analytics.view' },
  { key: 'edit', action: 'demo.publish' },
  { key: 'leads', action: 'leads.view' },
  { key: 'manage', action: 'members.manage' },
  { key: 'owner', action: 'workspace.delete' },
];

/** Paramètres › Membres (PRM-01), à l'identique de la maquette parametres.html. */
export function Members() {
  const { t } = useTranslation();
  const [dialog, ask] = useConfirm();
  const { user } = useAuth();
  const { current, can, reload: reloadWs } = useWorkspace();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<Tables<'invitations'>[]>([]);
  const [usage, setUsage] = useState<{ limits: { members: number | null } } | null>(null);
  const [q, setQ] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  // L26-01 : « Inviter » de la prise en main ouvre directement la création d'invitation
  const [inviting, setInviting] = useState(
    () => new URLSearchParams(location.hash.split('?')[1] ?? '').get('invite') === '1',
  );
  const toast = useToast();
  const { error, success, run } = useAction();
  const ws = current!;
  const myRole = ws.role as Role;
  const canManage = can('members.manage');

  const load = useCallback(async () => {
    // Tout est chargé avant l'affichage : membres et invitations arrivent ensemble (pas de saut)
    const [m, u, i] = await Promise.all([
      supabase.rpc('list_members', { p_workspace: ws.id }),
      supabase.rpc('workspace_usage', { p_workspace: ws.id }),
      canManage
        ? supabase
            .from('invitations')
            .select('*')
            .eq('workspace_id', ws.id)
            .is('accepted_at', null)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] as Tables<'invitations'>[] }),
    ]);
    const us = u.data as unknown as { limits: { members: number | null } } | null;
    setMembers((m.data ?? []) as MemberRow[]);
    setInvites(i.data ?? []);
    setUsage(us);
  }, [ws.id, canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  const roles = assignableRoles(myRole);
  const soon = <span className="stg-soon">{t('shell.soon')}</span>;
  const needle = q.trim().toLowerCase();
  const match = (name: string, email: string) =>
    !needle || name.toLowerCase().includes(needle) || email.toLowerCase().includes(needle);

  // §11.8 : ⌘K (ou Ctrl K) place le focus dans la recherche
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const limit = usage?.limits?.members;

  async function remove(m: MemberRow) {
    const self = m.user_id === user?.id;
    const label = m.full_name || m.email;
    // PRM-05 : nombre de démos créées par ce membre (elles restent dans le workspace)
    const demos = self
      ? null
      : (
          await supabase
            .from('demos')
            .select('id', { count: 'exact', head: true })
            .eq('workspace_id', ws.id)
            .eq('created_by', m.user_id)
            .is('deleted_at', null)
        ).count;
    const first = (m.full_name || '').trim().split(/\s+/)[0] || m.email;
    if (
      !(await ask({
        title: self ? t('members.confirmLeave') : t('members.confirmRemove', { email: label }),
        body: self
          ? undefined
          : `${t('members.removeLoses', { name: first })} ${
              demos ? t('members.removeDemos', { count: demos }) : t('members.removeNoDemos')
            }`,
        confirmLabel: self ? t('members.leave') : t('members.removeMember'),
        danger: true,
      }))
    )
      return;
    void run(async () => {
      check(await supabase.from('members').delete().eq('workspace_id', ws.id).eq('user_id', m.user_id));
      if (self) await reloadWs();
      else await load();
    });
  }

  const shown = members.filter((m) => match(m.full_name, m.email));
  const shownInvites = canManage ? invites.filter((i) => match('', i.email)) : [];
  // Décision UX du 22/11 : le rôle change tout de suite, un toast le confirme (« Rôle de Bob Martin : Admin. »)
  const setRoleOf = (m: MemberRow, role: WorkspaceRole) =>
    void run(async () => {
      check(
        await supabase.from('members').update({ role }).eq('workspace_id', ws.id).eq('user_id', m.user_id),
      );
      toast(t('members.roleChanged', { name: m.full_name || m.email, role: t(`roles.${role}`) }));
      await load();
    });

  return (
    <SettingsShell
      legacy={false}
      actions={
        can('members.invite') ? (
          <Button variant="primary" icon={<UserPlus aria-hidden="true" />} onClick={() => setInviting(true)}>
            {t('members.inviteShort')}
          </Button>
        ) : undefined
      }
    >
      {dialog}
      <section className="stg-sec st-team" aria-labelledby="team-title">
        <div className="stg-sec__head">
          <div>
            <h2 id="team-title">{t('members.title')}</h2>
            <p>
              {limit === null || limit === undefined
                ? t('members.subUnlimited', { count: members.length })
                : t('members.subOf', { count: members.length, limit })}
            </p>
          </div>
          <div className="stg-sec__acts">
            <label className="stg-search">
              <span className="sr-only">{t('members.search')}</span>
              <Search size={16} aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                placeholder={t('members.search')}
                aria-keyshortcuts="Control+K Meta+K"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <kbd aria-hidden="true">{IS_MAC ? '⌘K' : 'Ctrl K'}</kbd>
            </label>
          </div>
        </div>
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
        {success && (
          <div className="alert alert-success" role="status">
            {success}
          </div>
        )}
        <p className="sr-only" role="status">
          {t('members.resultCount', { count: shown.length + shownInvites.length })}
        </p>
        <table className="stg-table">
          <caption className="sr-only">{t('members.tableCaption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('members.colName')}</th>
              <th scope="col" className="stg-table__m-hide">
                {t('members.colEmail')}
              </th>
              <th scope="col" className="stg-table__m-hide">
                {t('members.role')} <RolesInfo />
              </th>
              <th scope="col">{t('members.colStatus')}</th>
              <th scope="col" className="stg-table__act">
                <span className="sr-only">{t('members.actions')}</span>
              </th>
            </tr>
          </thead>
          {/* §18.6 : lignes à filets de 56 px, l'écart est porté par la hauteur des lignes */}
          <tbody data-gap-exempt="">
            {shown.map((m) => {
              const me = m.user_id === user?.id;
              const editable = canManage && !me && (m.role !== 'owner' || myRole === 'owner');
              const label = m.full_name || m.email;
              const items: Array<MenuItem | 'separator'> = editable
                ? [
                    // Admin, Éditeur, Lecteur ; le rôle Propriétaire ne se donne pas ici (transfert de propriété à part)
                    ...[...roles]
                      .reverse()
                      .filter((r) => r !== 'owner')
                      .map((r) => ({
                        label: t(`roles.${r}`),
                        group: t('members.changeRole'),
                        icon: m.role === r ? <Check /> : <span />,
                        current: m.role === r,
                        radio: true,
                        onSelect: () => (m.role === r ? undefined : setRoleOf(m, r as WorkspaceRole)),
                      })),
                    'separator' as const,
                    {
                      // Transfert de propriété : pas encore disponible (« Bientôt »)
                      label: t('members.transfer'),
                      icon: <Star />,
                      disabled: true,
                      end: soon,
                      onSelect: () => undefined,
                    },
                    {
                      label: t('members.removeFromWs'),
                      icon: <UserMinus />,
                      danger: true,
                      onSelect: () => void remove(m),
                    },
                  ]
                : me && myRole !== 'owner'
                  ? [
                      {
                        label: t('members.leave'),
                        icon: <LogOut />,
                        danger: true,
                        onSelect: () => void remove(m),
                      },
                    ]
                  : [];
              return (
                <tr key={m.user_id}>
                  <td>
                    <span className="stg-who">
                      <span className="avatar" aria-hidden="true">
                        {initials(label)}
                        <AvatarPhoto userId={m.user_id} />
                      </span>
                      <span className="stg-who__name">{label}</span>
                      {me && <span className="stg-muted">{t('members.you')}</span>}
                    </span>
                  </td>
                  <td className="stg-table__m-hide">
                    <span className="stg-muted">{m.email}</span>
                  </td>
                  <td className="stg-table__m-hide">{t(`roles.${m.role}`)}</td>
                  <td>
                    <span className="stg-pill">{t('members.statusActive')}</span>
                  </td>
                  <td className="stg-table__act">
                    {items.length > 0 && (
                      <Menu label={t('members.actionsFor', { name: label })} items={items} />
                    )}
                  </td>
                </tr>
              );
            })}
            {shownInvites.map((i) => (
              <tr key={i.id}>
                <td>
                  <span className="stg-who">
                    <span className="avatar st-pending-av" aria-hidden="true">
                      {i.email.slice(0, 1).toUpperCase()}
                    </span>
                    {/* Date d'envoi en 2e ligne (lisible au toucher), pas en infobulle */}
                    <span className="st-invite-who">
                      <span className="stg-who__name stg-muted">{i.email}</span>
                      <span className="stg-table__sub">
                        {t('members.invitedShort', {
                          date: formatDate(i.created_at, { day: 'numeric', month: 'short' }),
                        })}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="stg-table__m-hide">
                  <span className="stg-muted">{i.email}</span>
                </td>
                <td className="stg-table__m-hide">{t(`roles.${i.role}`)}</td>
                <td>
                  <span className="stg-pill">{t('members.statusInvited')}</span>
                </td>
                <td className="stg-table__act">
                  <Menu
                    label={t('members.actionsFor', { name: i.email })}
                    items={[
                      {
                        label: t('members.copyInviteLink'),
                        icon: <Copy />,
                        onSelect: () =>
                          void navigator.clipboard
                            .writeText(inviteUrl(i.token))
                            .then(() => run(async () => undefined, t('members.linkCopied'))),
                      },
                      {
                        // Une invitation pas encore envoyée (échec, plafond) part ici
                        label: t('members.resend'),
                        icon: <Mail />,
                        disabled: !!i.sent_at,
                        onSelect: () =>
                          void run(
                            async () => {
                              const ok = delivered((await sendInvitations([i.id]))[i.id]);
                              await load();
                              if (!ok) throw new Error(t('members.emailFailed'));
                            },
                            t('members.sent', { count: 1 }),
                          ),
                      },
                      'separator',
                      {
                        label: t('members.revoke'),
                        icon: <Trash2 />,
                        danger: true,
                        onSelect: () =>
                          void run(async () => {
                            check(await supabase.from('invitations').delete().eq('id', i.id));
                            await load();
                          }),
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}
            {shown.length + shownInvites.length === 0 && needle && (
              <tr>
                <td colSpan={5} className="stg-table__empty">
                  {t('members.noMatch')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {inviting && (
        <InviteDialog
          roles={roles}
          limit={limit ?? null}
          onClose={() => setInviting(false)}
          onDone={() => void load()}
        />
      )}
    </SettingsShell>
  );
}

/**
 * §11.8 : « Ce que chaque rôle peut faire » dans un popover d'information de 360 px (bouton
 * CircleQuestionMark de 20 px à côté de « Rôle »). Fermé par Échap ou un clic à l'extérieur.
 */
export function RolesInfo() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const id = useId();
  useLayoutEffect(() => {
    if (!open || !btn.current || !pop.current) return;
    const r = computePosition(
      btn.current.getBoundingClientRect(),
      { width: 360, height: pop.current.offsetHeight },
      'bottom-start',
      window.innerWidth,
      window.innerHeight,
    );
    setPos({ top: r.top, left: r.left });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (focus: boolean) => {
      setOpen(false);
      setPos(null);
      if (focus) btn.current?.focus();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close(true);
    };
    const onDown = (e: PointerEvent) => {
      const n = e.target as Node;
      if (!pop.current?.contains(n) && !btn.current?.contains(n)) close(false);
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [open]);
  return (
    <>
      <button
        ref={btn}
        type="button"
        className="stg-info-btn"
        aria-label={t('members.permsTitle')}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <CircleHelp size={16} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={pop}
            id={id}
            role="dialog"
            aria-label={t('members.permsTitle')}
            className="fd-pop stg-info-pop"
            style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: 'hidden' }}
            data-ready={pos ? '' : undefined}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('members.permission')}</th>
                  {ROLE_ORDER.map((r) => (
                    <th key={r} scope="col">
                      {t(`roles.${r}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((p) => (
                  <tr key={p.key}>
                    <th scope="row">{t(`members.perm.${p.key}`)}</th>
                    {ROLE_ORDER.map((r) =>
                      roleCan(r, p.action) ? (
                        <td key={r}>
                          <Check size={16} role="img" aria-label={t('common.yes')} />
                        </td>
                      ) : (
                        <td key={r} className="stg-muted">
                          <span className="sr-only">{t('common.no')}</span>
                          <span aria-hidden="true">—</span>
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
          getPortal(btn.current),
        )}
    </>
  );
}

/**
 * Modale « Inviter des membres » (PRM-04). Retour client du 21/11 (emails-notifications-invitations.md
 * §4) : plus de case « Envoyer l'invitation par e-mail », l'e-mail part toujours (invite-email : Brevo,
 * ou repli Supabase). La confirmation reste dans la modale : pour chaque adresse, son état et
 * « Copier le lien » (pour qui préfère l'envoyer par Teams ou Slack). Envoi en échec, budget du jour
 * ou plafond horaire atteint : c'est écrit, et le lien reste à copier.
 */
function InviteDialog({
  roles,
  limit,
  onClose,
  onDone,
}: {
  roles: Role[];
  limit: number | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { current } = useWorkspace();
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('editor');
  const [err, setErr] = useState<string | null>(null);
  const [results, setResults] = useState<Array<{ email: string; url: string; status: SendStatus }>>([]);
  const [quota, setQuota] = useState<{ left: number; next_at: string | null } | null>(null);
  const { busy, error, run } = useAction();
  useEffect(() => {
    void supabase
      .rpc('invite_quota', { p_workspace: current!.id })
      .then(({ data }) => setQuota(data as { left: number; next_at: string | null } | null));
  }, [current]);
  const limited = !!quota && quota.left <= 0;
  const nextAt = quota?.next_at
    ? new Date(quota.next_at).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })
    : '';
  // Le texte en cours compte aussi : rien de tapé n'est perdu à l'envoi
  const list = [...new Set([...emails, ...splitEmails(draft)])];
  async function submit(e: FormEvent) {
    e.preventDefault();
    const invalid = list.filter((x) => !isEmail(x));
    if (!list.length || invalid.length) {
      setErr(
        list.length ? t('members.invalidEmails', { list: invalid.join(', ') }) : t('validation.required'),
      );
      document.getElementById('inv-email')?.focus();
      return;
    }
    setErr(null);
    const rows = await run(async () =>
      check(
        await supabase
          .from('invitations')
          .insert(
            list.map((addr) => ({ workspace_id: current!.id, email: addr, role, invited_by: user!.id })),
          )
          .select(),
      ),
    );
    if (!rows) return;
    // Plafond horaire atteint : rien ne part, les liens restent à copier
    const status: Record<string, SendStatus> = limited
      ? Object.fromEntries(rows.map((r) => [r.id, 'rate_limit' as SendStatus]))
      : await sendInvitations(rows.map((r) => r.id));
    onDone();
    setResults(rows.map((r) => ({ email: r.email, url: inviteUrl(r.token), status: status[r.id]! })));
  }

  const undelivered = results.filter((r) => !delivered(r.status));
  const statusText = (s: SendStatus) =>
    delivered(s)
      ? t('members.inviteStatus.sent')
      : s === 'rate_limit'
        ? t('members.inviteStatus.rateLimit')
        : s === 'budget'
          ? t('members.inviteStatus.budget')
          : t('members.inviteStatus.failed');

  const sent = results.length > 0;
  return (
    <Modal
      open
      onClose={onClose}
      icon={sent ? <MailCheck /> : <UserPlus />}
      title={sent ? t('members.sentTitle') : t('members.inviteMany')}
      closeLabel={t('common.close')}
      className="st-invite"
      footer={
        sent ? (
          <Button variant="primary" onClick={onClose}>
            {t('members.done')}
          </Button>
        ) : (
          <>
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button variant="primary" type="submit" form="inv-form" aria-disabled={busy || undefined}>
              {list.length ? t('members.sendN', { count: list.length }) : t('members.sendNone')}
            </Button>
          </>
        )
      }
    >
      {sent ? (
        <>
          {undelivered.length ? (
            <div className="alert alert-warning" role="alert">
              <Info aria-hidden="true" />
              <span>
                {undelivered.every((r) => r.status === 'rate_limit')
                  ? t('members.rateLimit', { time: nextAt })
                  : t('members.emailFailed')}
              </span>
            </div>
          ) : (
            <p role="status">{t('members.sentBody', { count: results.length })}</p>
          )}
          {/* Retours client du 24/11 §4 : une rangée par adresse, puis son lien dans un CopyField */}
          <ul className="inv-results">
            {results.map((r, n) => (
              <li key={r.url}>
                <div className="inv-results__row">
                  <b className="inv-results__email">{r.email}</b>
                  <span className={`inv-results__status${delivered(r.status) ? ' is-sent' : ' is-failed'}`}>
                    {delivered(r.status) ? <CircleCheck aria-hidden="true" /> : <Info aria-hidden="true" />}
                    {statusText(r.status)}
                  </span>
                </div>
                <CopyField
                  id={`inv-link-${n}`}
                  label={t('members.inviteLinkFor', { email: r.email })}
                  value={r.url}
                  copyLabel={t('members.copyLinkFor', { email: r.email })}
                  copiedText={t('members.linkCopiedShort')}
                />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <form id="inv-form" className="st-invite__form" onSubmit={submit} noValidate>
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
          <div className="fd-modal__field">
            <label htmlFor="inv-email">{t('members.emails')}</label>
            <EmailChips
              id="inv-email"
              autoFocus
              values={emails}
              draft={draft}
              onChange={(v) => {
                setEmails(v);
                setErr(null);
              }}
              onDraft={(v) => {
                setDraft(v);
                setErr(null);
              }}
              placeholder={t('members.emailsPlaceholder')}
              invalid={!!err}
              describedBy={err ? 'inv-email-error' : undefined}
            />
            {err && (
              <span className="stg-error" id="inv-email-error">
                <CircleAlert size={16} aria-hidden="true" />
                {err}
              </span>
            )}
          </div>
          <div className="fd-modal__field">
            <span className="fd-modal__label">
              <label htmlFor="inv-role">{t('members.role')}</label>
              <RolesInfo />
            </span>
            <Select
              id="inv-role"
              value={role}
              onChange={(e) => setRole(e.target.value as WorkspaceRole)}
              options={(['viewer', 'editor', 'admin'] as Role[])
                .filter((r) => roles.includes(r))
                .map((r) => ({ value: r, label: t(`roles.${r}`), description: t(`members.roleHelp.${r}`) }))}
            />
          </div>
          {limited && (
            <p className="stg-help" id="inv-limit">
              {t('members.rateLimit', { time: nextAt })}
            </p>
          )}
          {/* Pas de vocabulaire d'abonnement ; rien sans limite de membres */}
          {list.length > 0 && limit !== null && (
            <p className="stg-help st-seats">{t('members.membersMore', { count: list.length, limit })}</p>
          )}
        </form>
      )}
    </Modal>
  );
}
