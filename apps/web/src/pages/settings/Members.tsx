import { formatDate } from '../../lib/format';
import { useConfirm } from '../../components/ConfirmDialog';
import { Copy, LogOut, Send, Trash2, UserMinus } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { assignableRoles, type Role } from '@flowdsiml/core';
import type { Tables, WorkspaceRole } from '@flowdsiml/supabase-types';
import { Alert, Button, Card, Field, Select } from '@flowdsiml/ui';
import { supabase } from '../../lib/supabase';
import { APP_URL } from '../../lib/env';
import { check, useAction } from '../../lib/useAction';
import { useAuth } from '../../auth/AuthProvider';
import { useWorkspace } from '../../workspace/WorkspaceProvider';

interface MemberRow {
  user_id: string;
  email: string;
  full_name: string;
  role: WorkspaceRole;
}

export function inviteUrl(token: string) {
  return `${APP_URL}#/invite/${token}`;
}

/** Initiales pour l'avatar : « Marie Durand » → « MD », « jean@x.fr » → « J ». */
export function initials(nameOrEmail: string) {
  const base =
    nameOrEmail.includes('@') && !nameOrEmail.includes(' ') ? nameOrEmail.split('@')[0]! : nameOrEmail;
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0]![0]! + parts[parts.length - 1]![0]! : (parts[0]?.[0] ?? '?');
  return letters.toUpperCase();
}

export function Members() {
  const { t } = useTranslation();
  const [dialog, ask] = useConfirm();
  const { user } = useAuth();
  const { current, can, reload: reloadWs } = useWorkspace();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<Tables<'invitations'>[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('editor');
  const [lastLinks, setLastLinks] = useState<Array<{ email: string; url: string }>>([]);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const { busy, error, success, run } = useAction();
  const ws = current!;
  const myRole = ws.role as Role;
  const canManage = can('members.manage');

  const load = useCallback(async () => {
    const m = await supabase.rpc('list_members', { p_workspace: ws.id });
    setMembers((m.data ?? []) as MemberRow[]);
    if (canManage) {
      const i = await supabase
        .from('invitations')
        .select('*')
        .eq('workspace_id', ws.id)
        .is('accepted_at', null)
        .order('created_at', { ascending: false });
      setInvites(i.data ?? []);
    }
  }, [ws.id, canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Invitations multiples (W9) : emails séparés par virgule, point-virgule, espace ou retour à la ligne. */
  async function invite(e: FormEvent) {
    e.preventDefault();
    const list = [
      ...new Set(
        email
          .split(/[\s,;]+/)
          .map((x) => x.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    const invalid = list.filter((x) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
    if (!list.length || invalid.length) {
      setInviteError(
        list.length ? t('members.invalidEmails', { list: invalid.join(', ') }) : t('validation.required'),
      );
      document.getElementById('inv-email')?.focus();
      return;
    }
    setInviteError(null);
    const rows = await run(async () =>
      check(
        await supabase
          .from('invitations')
          .insert(list.map((addr) => ({ workspace_id: ws.id, email: addr, role, invited_by: user!.id })))
          .select(),
      ),
    );
    if (rows) {
      setLastLinks(rows.map((r) => ({ email: r.email, url: inviteUrl(r.token) })));
      setEmail('');
      await load();
    }
  }

  const roles = assignableRoles(myRole);

  return (
    <div className="stack">
      {dialog}
      <div className="page-head">
        <h1>{t('members.title')}</h1>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {success && <Alert kind="success">{success}</Alert>}

      {can('members.invite') && (
        <Card>
          <h2 style={{ marginTop: 0 }}>{t('members.invite')}</h2>
          <form onSubmit={invite} className="row" style={{ alignItems: 'flex-start' }} noValidate>
            <div style={{ flex: '1 1 240px' }}>
              <Field label={t('members.emails')} htmlFor="inv-email">
                <textarea
                  id="inv-email"
                  className="fd-textarea"
                  rows={2}
                  placeholder={t('members.emailsPlaceholder')}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setInviteError(null);
                  }}
                  aria-invalid={inviteError ? true : undefined}
                  aria-describedby={inviteError ? 'inv-email-error' : undefined}
                />
                {inviteError && (
                  <p id="inv-email-error" className="field-error">
                    {inviteError}
                  </p>
                )}
              </Field>
            </div>
            <Field label={t('members.role')} htmlFor="inv-role">
              <Select id="inv-role" value={role} onChange={(e) => setRole(e.target.value as WorkspaceRole)}>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {t(`roles.${r}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="fd-field">
              <span className="fd-label" aria-hidden="true">
                &nbsp;
              </span>
              <Button icon={<Send />} type="submit" variant="primary" disabled={busy}>
                {t('members.sendInvite')}
              </Button>
            </div>
          </form>
          {lastLinks.length > 0 && (
            <Alert kind="success">
              <p style={{ margin: '0 0 8px' }}>{t('members.invitesCreated', { count: lastLinks.length })}</p>
              <ul className="invite-links">
                {lastLinks.map((l) => (
                  <li key={l.url}>
                    <span>{l.email}</span>
                    <Button
                      icon={<Copy />}
                      size="sm"
                      onClick={() => void navigator.clipboard.writeText(l.url)}
                    >
                      {t('members.copyLink')}
                    </Button>
                  </li>
                ))}
              </ul>
            </Alert>
          )}
          <p className="fd-muted">{t('members.inviteHint')}</p>
        </Card>
      )}

      <Card>
        <table className="fd-table">
          <thead>
            <tr>
              <th>{t('members.member')}</th>
              <th>{t('members.role')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const editable =
                canManage && m.user_id !== user?.id && (m.role !== 'owner' || myRole === 'owner');
              return (
                <tr key={m.user_id}>
                  <td>
                    <div className="member-cell">
                      <span className="avatar" aria-hidden="true">
                        {initials(m.full_name || m.email)}
                      </span>
                      <span className="member-cell__text">
                        <span className="member-cell__name">{m.full_name || m.email}</span>
                        {m.full_name && <span className="member-cell__email">{m.email}</span>}
                      </span>
                    </div>
                  </td>
                  <td>
                    {editable ? (
                      <Select
                        value={m.role}
                        aria-label={t('members.role')}
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
                      </Select>
                    ) : (
                      <span className="fd-badge">{t(`roles.${m.role}`)}</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {(editable || m.user_id === user?.id) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="btn-danger-ghost"
                        icon={m.user_id === user?.id ? <LogOut /> : <UserMinus />}
                        onClick={async () => {
                          const self = m.user_id === user?.id;
                          if (
                            !(await ask({
                              title: self
                                ? t('members.confirmLeave')
                                : t('members.confirmRemove', { email: m.email }),
                              confirmLabel: self ? t('members.leave') : t('members.remove'),
                              danger: true,
                            }))
                          )
                            return;
                          void run(async () => {
                            check(
                              await supabase
                                .from('members')
                                .delete()
                                .eq('workspace_id', ws.id)
                                .eq('user_id', m.user_id),
                            );
                            if (self) await reloadWs();
                            else await load();
                          });
                        }}
                      >
                        {m.user_id === user?.id ? t('members.leave') : t('members.remove')}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {canManage && invites.length > 0 && (
        <Card>
          <h2 style={{ marginTop: 0 }}>{t('members.pending')}</h2>
          <table className="fd-table">
            <tbody>
              {invites.map((i) => (
                <tr key={i.id}>
                  <td>{i.email}</td>
                  <td>
                    <span className="fd-badge">{t(`roles.${i.role}`)}</span>
                  </td>
                  <td className="fd-muted">{formatDate(i.expires_at)}</td>
                  <td style={{ textAlign: 'right' }} className="row">
                    <Button
                      icon={<Copy />}
                      size="sm"
                      onClick={() => void navigator.clipboard.writeText(inviteUrl(i.token))}
                    >
                      {t('members.copyLink')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="btn-danger-ghost"
                      icon={<Trash2 />}
                      onClick={() =>
                        void run(async () => {
                          check(await supabase.from('invitations').delete().eq('id', i.id));
                          await load();
                        })
                      }
                    >
                      {t('members.revoke')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
