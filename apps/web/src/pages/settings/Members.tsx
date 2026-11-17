import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { assignableRoles, type Role } from '@flowdsiml/core';
import type { Tables, WorkspaceRole } from '@flowdsiml/supabase-types';
import { Alert, Button, Card, Field } from '@flowdsiml/ui';
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

export function Members() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { current, can, reload: reloadWs } = useWorkspace();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<Tables<'invitations'>[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('editor');
  const [lastLink, setLastLink] = useState<string | null>(null);
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

  async function invite(e: FormEvent) {
    e.preventDefault();
    const inv = await run(async () =>
      check(
        await supabase
          .from('invitations')
          .insert({ workspace_id: ws.id, email: email.trim().toLowerCase(), role, invited_by: user!.id })
          .select()
          .single(),
      ),
    );
    if (inv) {
      setLastLink(inviteUrl(inv.token));
      setEmail('');
      await load();
    }
  }

  const roles = assignableRoles(myRole);

  return (
    <div className="stack">
      <div className="page-head">
        <h1>{t('members.title')}</h1>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {success && <Alert kind="success">{success}</Alert>}

      {can('members.invite') && (
        <Card>
          <h2 style={{ marginTop: 0 }}>{t('members.invite')}</h2>
          <form onSubmit={invite} className="row" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 240px' }}>
              <Field label={t('auth.email')} htmlFor="inv-email">
                <input
                  id="inv-email"
                  className="fd-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
            </div>
            <Field label={t('members.role')} htmlFor="inv-role">
              <select
                id="inv-role"
                className="fd-select"
                value={role}
                onChange={(e) => setRole(e.target.value as WorkspaceRole)}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {t(`roles.${r}`)}
                  </option>
                ))}
              </select>
            </Field>
            <div className="fd-field">
              <Button type="submit" variant="primary" disabled={busy}>
                {t('members.sendInvite')}
              </Button>
            </div>
          </form>
          {lastLink && (
            <Alert kind="success">
              {t('members.inviteCreated')} <code style={{ wordBreak: 'break-all' }}>{lastLink}</code>{' '}
              <Button size="sm" onClick={() => void navigator.clipboard.writeText(lastLink)}>
                {t('common.copy')}
              </Button>
            </Alert>
          )}
          <p className="fd-muted">{t('members.inviteHint')}</p>
        </Card>
      )}

      <Card>
        <table className="fd-table">
          <thead>
            <tr>
              <th>{t('auth.fullName')}</th>
              <th>{t('auth.email')}</th>
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
                  <td>{m.full_name || '—'}</td>
                  <td>{m.email}</td>
                  <td>
                    {editable ? (
                      <select
                        className="fd-select"
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
                      </select>
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
                        onClick={() => {
                          const self = m.user_id === user?.id;
                          if (
                            !confirm(
                              self
                                ? t('members.confirmLeave')
                                : t('members.confirmRemove', { email: m.email }),
                            )
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
                  <td className="fd-muted">{new Date(i.expires_at).toLocaleDateString()}</td>
                  <td style={{ textAlign: 'right' }} className="row">
                    <Button size="sm" onClick={() => void navigator.clipboard.writeText(inviteUrl(i.token))}>
                      {t('members.copyLink')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="btn-danger-ghost"
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
