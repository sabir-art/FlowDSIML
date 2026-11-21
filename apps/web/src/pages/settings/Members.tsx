import { formatDate } from '../../lib/format';
import { initials } from '../../lib/initials';
export { initials };
import { useConfirm } from '../../components/ConfirmDialog';
import { Check, Copy, Info, LogOut, Mail, Plus, Search, Star, Trash2, UserCog, X } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { assignableRoles, can as roleCan, ROLES, type Action, type Role } from '@flowdsiml/core';
import type { Tables, WorkspaceRole } from '@flowdsiml/supabase-types';
import { supabase } from '../../lib/supabase';
import { APP_URL } from '../../lib/env';
import { check, useAction } from '../../lib/useAction';
import { useAuth } from '../../auth/AuthProvider';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { FilterMenu, ListToolbar } from '../../components/toolbar/ListToolbar';
import { Menu, type MenuItem } from '../../components/Menu';
import { SettingsShell } from './SettingsShell';
import { Status } from '@flowdsiml/ui';
import { useToast } from '../../components/Toast';

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
  const [roleFilter, setRoleFilter] = useState<WorkspaceRole | ''>('');
  // L26-01 : « Inviter » de la prise en main ouvre directement la création d'invitation
  const [inviting, setInviting] = useState(
    () => new URLSearchParams(location.hash.split('?')[1] ?? '').get('invite') === '1',
  );
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
  const soon = <Status size="sm">{t('shell.soon')}</Status>;
  const needle = q.trim().toLowerCase();
  const match = (name: string, email: string, role: WorkspaceRole) =>
    (!needle || name.toLowerCase().includes(needle) || email.toLowerCase().includes(needle)) &&
    (!roleFilter || role === roleFilter);
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

  return (
    <SettingsShell>
      {dialog}
      <section aria-labelledby="st-title">
        <div className="row between wrap st-head">
          <div>
            <p className="muted st-sub">
              {limit === null || limit === undefined
                ? t('members.countUnlimited', { count: members.length })
                : t('members.countOf', { count: members.length, limit })}
            </p>
          </div>
          {can('members.invite') && (
            <button type="button" className="btn btn-primary" onClick={() => setInviting(true)}>
              <Plus aria-hidden="true" />
              {t('members.inviteMany')}
            </button>
          )}
        </div>
        {error && (
          <div className="alert alert-danger st-alert" role="alert">
            {error}
          </div>
        )}
        {success && (
          <div className="alert alert-success st-alert" role="status">
            {success}
          </div>
        )}
        <div className="card">
          {/* L40 : recherche et filtre Rôle en barre de liste (40 px) */}
          <ListToolbar
            className="st-toolbar"
            activeCount={(q.trim() ? 1 : 0) + (roleFilter ? 1 : 0)}
            onReset={() => {
              setQ('');
              setRoleFilter('');
            }}
            status={t('members.resultCount', {
              count:
                members.filter((m) => match(m.full_name, m.email, m.role)).length +
                invites.filter((i) => match('', i.email, i.role)).length,
            })}
            lead={
              <label className="fd-toolbar__search">
                <span className="sr-only">{t('members.search')}</span>
                <Search aria-hidden="true" />
                <input
                  className="fd-input"
                  type="search"
                  placeholder={t('members.search')}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </label>
            }
            filters={
              <FilterMenu
                icon={<UserCog />}
                label={t('members.roleLabel')}
                value={roleFilter ? t(`roles.${roleFilter}`) : t('toolbar.all')}
                active={!!roleFilter}
                items={[
                  {
                    label: t('members.allRoles'),
                    icon: roleFilter ? <span /> : <Check />,
                    onSelect: () => setRoleFilter(''),
                  },
                  ...ROLE_ORDER.map((r) => ({
                    label: t(`roles.${r}`),
                    icon: roleFilter === r ? <Check /> : <span />,
                    onSelect: () => setRoleFilter(r),
                  })),
                ]}
              />
            }
          />
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">{t('members.tableCaption')}</caption>
              <thead>
                <tr>
                  <th>{t('members.member')}</th>
                  <th>{t('members.role')}</th>
                  <th>{t('members.lastActivity')}</th>
                  <th>
                    <span className="sr-only">{t('members.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {members
                  .filter((m) => match(m.full_name, m.email, m.role))
                  .map((m) => {
                    const me = m.user_id === user?.id;
                    const editable = canManage && !me && (m.role !== 'owner' || myRole === 'owner');
                    const items: Array<MenuItem | 'separator'> = [
                      {
                        // PRM-03 : transfert de propriété pas encore disponible (badge Bientôt)
                        label: t('members.transfer'),
                        icon: <Star />,
                        disabled: true,
                        end: soon,
                        onSelect: () => undefined,
                      },
                      'separator',
                      {
                        label: t('members.removeFromWs'),
                        icon: <Trash2 />,
                        danger: true,
                        onSelect: () => void remove(m),
                      },
                    ];
                    return (
                      <tr key={m.user_id}>
                        <td>
                          <div className="row">
                            <span className="avatar" aria-hidden="true">
                              {initials(m.full_name || m.email)}
                            </span>
                            <div>
                              <b>{m.full_name || m.email}</b>
                              {me && <span className="st-you">{t('members.you')}</span>}
                              {m.full_name && <div className="t-caption subtle">{m.email}</div>}
                            </div>
                          </div>
                        </td>
                        <td>
                          {editable ? (
                            <select
                              className="select role-select input-sm"
                              aria-label={t('members.roleOf', { name: m.full_name || m.email })}
                              value={m.role}
                              onChange={(e) =>
                                void run(async () => {
                                  check(
                                    await supabase
                                      .from('members')
                                      .update({ role: e.target.value as WorkspaceRole })
                                      .eq('workspace_id', ws.id)
                                      .eq('user_id', m.user_id),
                                  );
                                  await load();
                                }, t('common.saved'))
                              }
                            >
                              {roles.map((r) => (
                                <option key={r} value={r}>
                                  {t(`roles.${r}`)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span>{t(`roles.${m.role}`)}</span>
                          )}
                        </td>
                        {/* La dernière activité n'est pas encore enregistrée */}
                        <td className="muted">—</td>
                        <td className="r">
                          {me ? (
                            myRole !== 'owner' && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => void remove(m)}
                              >
                                <LogOut aria-hidden="true" />
                                {t('members.leave')}
                              </button>
                            )
                          ) : editable ? (
                            <Menu
                              label={t('members.actionsFor', { name: m.full_name || m.email })}
                              items={items}
                            />
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                {canManage &&
                  invites
                    .filter((i) => match('', i.email, i.role))
                    .map((i) => (
                      <tr key={i.id}>
                        <td>
                          <div className="row">
                            <span className="avatar st-pending-av" aria-hidden="true">
                              {i.email.slice(0, 1).toUpperCase()}
                            </span>
                            <div>
                              <b>{i.email}</b>
                              <div className="t-caption subtle">
                                {t('members.invitedOn', {
                                  date: formatDate(i.created_at, { day: 'numeric', month: 'short' }),
                                })}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span>{t(`roles.${i.role}`)}</span>
                        </td>
                        <td>
                          <Status size="sm" tone="warning">
                            {t('members.pendingBadge')}
                          </Status>
                        </td>
                        <td className="r">
                          <Menu
                            label={t('members.actionsFor', { name: i.email })}
                            items={[
                              {
                                label: t('members.copyLink'),
                                icon: <Copy />,
                                onSelect: () =>
                                  void navigator.clipboard
                                    .writeText(inviteUrl(i.token))
                                    .then(() => run(async () => undefined, t('members.linkCopied'))),
                              },
                              {
                                // E-mails P1 : une invitation pas encore envoyée (case décochée, échec) part ici
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
              </tbody>
            </table>
          </div>
        </div>

        <div className="card card-pad st-perms">
          <h3 className="t-h3">{t('members.permsTitle')}</h3>
          <div className="table-wrap st-perms-table">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('members.permission')}</th>
                  {ROLE_ORDER.map((r) => (
                    <th key={r} className="r">
                      {t(`roles.${r}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((p) => (
                  <tr key={p.key}>
                    <td>{t(`members.perm.${p.key}`)}</td>
                    {ROLE_ORDER.map((r) =>
                      roleCan(r, p.action) ? (
                        <td key={r} className="r">
                          <Check className="st-ok" role="img" aria-label={t('common.yes')} />
                        </td>
                      ) : (
                        <td key={r} className="r subtle">
                          <span className="sr-only">{t('common.no')}</span>
                          <span aria-hidden="true">—</span>
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="help st-perms-help">{t('members.permsHelp')}</p>
        </div>
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

/** Modale « Inviter des membres » (PRM-04) : crée les invitations et donne leurs liens à transmettre. */
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
  const [emails, setEmails] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('editor');
  const [err, setErr] = useState<string | null>(null);
  const [links, setLinks] = useState<Array<{ email: string; url: string }>>([]);
  // E-mails P1 : case cochée par défaut ; repli (« L'e-mail n'a pas pu partir ») si un envoi échoue
  const [byEmail, setByEmail] = useState(true);
  const [failed, setFailed] = useState(false);
  const [quota, setQuota] = useState<{ left: number; next_at: string | null } | null>(null);
  const toast = useToast();
  const { busy, error, run } = useAction();
  useEffect(() => {
    void supabase.rpc('invite_quota', { p_workspace: current!.id }).then(({ data }) => {
      const q = data as { left: number; next_at: string | null } | null;
      setQuota(q);
      if (q && q.left <= 0) setByEmail(false);
    });
  }, [current]);
  const limited = !!quota && quota.left <= 0;
  const list = [
    ...new Set(
      emails
        .split(/[\s,;]+/)
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const invalid = list.filter((x) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
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
    if (!byEmail) {
      setLinks(rows.map((r) => ({ email: r.email, url: inviteUrl(r.token) })));
      onDone();
      return;
    }
    const status = await sendInvitations(rows.map((r) => r.id));
    const ok = rows.filter((r) => delivered(status[r.id]));
    const rest = rows.filter((r) => !delivered(status[r.id]));
    onDone();
    if (ok.length) toast(t('members.sent', { count: ok.length }));
    if (!rest.length) return onClose();
    setFailed(true);
    setLinks(rest.map((r) => ({ email: r.email, url: inviteUrl(r.token) })));
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inv-t"
        onSubmit={submit}
        noValidate
      >
        <div className="modal-head">
          <h2 id="inv-t">{t('members.inviteMany')}</h2>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            aria-label={t('common.close')}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body">
          {links.length > 0 ? (
            <>
              {failed ? (
                <div className="alert alert-warning" role="alert">
                  <Info aria-hidden="true" />
                  <span>{t('members.emailFailed')}</span>
                </div>
              ) : (
                <p>{t('members.invitesCreated', { count: links.length })}</p>
              )}
              <ul className="st-links">
                {links.map((l) => (
                  <li key={l.url} className="row between">
                    <span>{l.email}</span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => void navigator.clipboard.writeText(l.url)}
                    >
                      <Copy aria-hidden="true" />
                      {t('members.copyLink')}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="help">{t('members.inviteHint')}</p>
            </>
          ) : (
            <>
              {error && (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              )}
              <div className="field">
                <label htmlFor="inv-email">{t('members.emails')}</label>
                <textarea
                  id="inv-email"
                  className="textarea"
                  autoFocus
                  placeholder={t('members.emailsPlaceholder')}
                  value={emails}
                  onChange={(e) => {
                    setEmails(e.target.value);
                    setErr(null);
                  }}
                  aria-invalid={err ? true : undefined}
                  aria-describedby={err ? 'inv-email-error inv-help' : 'inv-help'}
                />
                {err && (
                  <span className="error-msg" id="inv-email-error">
                    {err}
                  </span>
                )}
                <span className="help" id="inv-help">
                  {t('members.emailsHelp')}
                </span>
              </div>
              <div className="field">
                <label htmlFor="inv-role">{t('members.role')}</label>
                <select
                  id="inv-role"
                  className="select"
                  value={role}
                  onChange={(e) => setRole(e.target.value as WorkspaceRole)}
                >
                  {(['editor', 'viewer', 'admin', 'owner'] as Role[])
                    .filter((r) => roles.includes(r))
                    .map((r) => (
                      <option key={r} value={r}>
                        {t(`members.roleDesc.${r}`)}
                      </option>
                    ))}
                </select>
              </div>
              <div className="field">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={byEmail}
                    disabled={limited}
                    aria-describedby={limited ? 'inv-limit' : undefined}
                    onChange={(e) => setByEmail(e.target.checked)}
                  />
                  {t('members.sendByEmail')}
                </label>
                {limited && (
                  <span className="help" id="inv-limit">
                    {t('members.rateLimit', {
                      time: quota.next_at
                        ? new Date(quota.next_at).toLocaleTimeString(i18n.language, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '',
                    })}
                  </span>
                )}
                {!byEmail && !limited && <span className="help">{t('members.inviteHint')}</span>}
              </div>
              {/* Retour UX : pas de vocabulaire d'abonnement ; rien sans limite de membres */}
              {list.length > 0 && limit !== null && (
                <p className="st-seats">{t('members.membersMore', { count: list.length, limit })}</p>
              )}
            </>
          )}
        </div>
        <div className="modal-foot">
          {links.length > 0 ? (
            <button type="button" className="btn btn-primary" onClick={onClose}>
              {t('common.close')}
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {t(byEmail ? 'members.sendInvites' : 'members.createInvites')}
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
