/**
 * L39 (L11-02 à 04) : configuration des accès « Sur invitation » et « Par domaine e-mail » de l'onglet Accès.
 * Les adresses autorisées (éditeur) et les domaines sont en base ; l'envoi des liens d'accès passe par
 * l'Edge Function access-email (Supabase Auth), réservé aux admins de l'espace. Plafond d'envoi : 10 par
 * heure et par espace (20 pour toute la plateforme) ; au-delà, les invités restent autorisés et
 * peuvent recevoir un lien copié.
 */
import { useCallback, useEffect, useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert, Copy, Mail, Plus, Send, Trash2, X } from 'lucide-react';
import type { Tables } from '@flowdsiml/supabase-types';
import { supabase } from '../../lib/supabase';
import { check } from '../../lib/useAction';
import { formatRelativeShort } from '../../lib/format';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { Menu } from '../../components/Menu';
import { cleanDomain } from '../learners/progress';
import { Status } from '@flowdsiml/ui';

type Invite = Pick<Tables<'demo_access_invites'>, 'email' | 'invited_at' | 'last_sent_at' | 'opened_at'>;
/** Un lien d'accès personnel vaut 1 heure (otp_expiry du projet). */
const LINK_TTL_MS = 3_600_000;
const MAX_INVITES = 50;

export function inviteStatus(i: Invite, now = Date.now()): 'opened' | 'expired' | 'invited' {
  if (i.opened_at) return 'opened';
  if (i.last_sent_at && now - Date.parse(i.last_sent_at) > LINK_TTL_MS) return 'expired';
  return 'invited';
}

/** Adresses saisies (virgule, point-virgule, espace ou retour à la ligne), normalisées, sans doublon. */
export function parseEmails(raw: string): { list: string[]; invalid: string[] } {
  const items = [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  const ok = (e: string) => /^[^@\s]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(e);
  return { list: items.filter(ok), invalid: items.filter((e) => !ok(e)) };
}

async function sendInvites(demoId: string, emails: string[]) {
  const { data, error } = await supabase.functions.invoke<{
    sent: string[];
    limited: string[];
    failed: string[];
  }>('access-email', { body: { action: 'invite', demoId, emails } });
  if (error || !data) throw new Error(error?.message ?? 'access-email');
  return data;
}

export function InviteConfig({
  demoId,
  editable,
  canSend,
  onFirst,
}: {
  demoId: string;
  editable: boolean;
  /** Envoi des e-mails : admins de l'espace. */
  canSend: boolean;
  /** Premier invité ajouté : le mode « Sur invitation » peut s'appliquer. */
  onFirst: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [confirmDialog, confirm] = useConfirm();
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [dialog, setDialog] = useState(false);
  const load = useCallback(async () => {
    const { data } = await supabase
      .from('demo_access_invites')
      .select('email, invited_at, last_sent_at, opened_at')
      .eq('demo_id', demoId)
      .order('invited_at', { ascending: false });
    setInvites(data ?? []);
    return data ?? [];
  }, [demoId]);
  useEffect(() => {
    void load();
  }, [load]);

  const report = (r: { sent: string[]; limited: string[]; failed: string[] }) => {
    const parts = [t('access.inv.sentCount', { count: r.sent.length })];
    if (r.limited.length) parts.push(t('access.inv.limitedCount', { count: r.limited.length }));
    if (r.failed.length) parts.push(t('access.inv.failedCount', { count: r.failed.length }));
    toast(parts.join(' '));
  };
  const resend = async (email: string) => {
    try {
      report(await sendInvites(demoId, [email]));
      await load();
    } catch {
      toast(t('access.inv.sendError'));
    }
  };
  const copyLink = async (email: string) => {
    const { data, error } = await supabase.functions.invoke<{ url: string }>('access-email', {
      body: { action: 'link', demoId, email },
    });
    if (error || !data?.url) return toast(t('access.inv.linkError'));
    await navigator.clipboard?.writeText(data.url);
    toast(t('access.inv.linkCopied', { email }));
  };
  const remove = async (email: string) => {
    if (
      !(await confirm({
        title: t('access.inv.removeTitle', { email }),
        body: t('access.inv.removeBody'),
        confirmLabel: t('access.inv.remove'),
        danger: true,
      }))
    )
      return;
    try {
      check(await supabase.rpc('remove_demo_invite', { p_demo: demoId, p_email: email }));
      await load();
      toast(t('access.inv.removed', { email }));
    } catch (e) {
      toast(
        /INVITES_REQUIRED/.test((e as Error).message) ? t('access.inv.lastOne') : t('access.inv.sendError'),
      );
    }
  };

  return (
    <div className="l11-cfg l11-inv">
      <div className="row between l11-inv-head">
        <p className="t-label" role="status">
          {t('access.inv.count', { count: invites?.length ?? 0 })}
        </p>
        {editable && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setDialog(true)}>
            <Plus aria-hidden="true" />
            {t('access.inv.open')}
          </button>
        )}
      </div>
      {invites && invites.length > 0 && (
        <div className="table-wrap">
          <table className="table l11-inv-table">
            <caption className="sr-only">{t('access.inv.caption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('access.inv.col.email')}</th>
                <th scope="col">{t('access.inv.col.status')}</th>
                <th scope="col">{t('access.inv.col.visit')}</th>
                <th scope="col">
                  <span className="sr-only">{t('members.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {invites.map((i) => {
                const st = inviteStatus(i);
                return (
                  <tr key={i.email}>
                    <th scope="row" className="l11-inv-email" title={i.email}>
                      {i.email}
                    </th>
                    <td>
                      <Status
                        size="sm"
                        tone={st === 'opened' ? 'success' : st === 'expired' ? 'warning' : 'neutral'}
                      >
                        {t(`access.inv.status.${st}`)}
                      </Status>
                    </td>
                    <td className="muted">{i.opened_at ? formatRelativeShort(i.opened_at) : '—'}</td>
                    <td className="r">
                      {editable && (
                        <Menu
                          label={t('members.actionsFor', { name: i.email })}
                          items={[
                            ...(canSend
                              ? [
                                  {
                                    label: t('access.inv.resend'),
                                    icon: <Send />,
                                    onSelect: () => void resend(i.email),
                                  },
                                ]
                              : []),
                            {
                              label: t('access.inv.copyLink'),
                              icon: <Copy />,
                              onSelect: () => void copyLink(i.email),
                            },
                            'separator' as const,
                            {
                              label: t('access.inv.remove'),
                              icon: <Trash2 />,
                              danger: true,
                              onSelect: () => void remove(i.email),
                            },
                          ]}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="help">{t('access.inv.help')}</p>
      {confirmDialog}
      {dialog && (
        <InviteDialog
          canSend={canSend}
          onClose={() => setDialog(false)}
          onSubmit={async (emails, send) => {
            const added =
              check(await supabase.rpc('add_demo_invites', { p_demo: demoId, p_emails: emails })) ?? [];
            const list = await load();
            if (list.length && list.length === added.length) onFirst();
            if (send && added.length) report(await sendInvites(demoId, added));
            else toast(t('access.inv.added', { count: added.length }));
          }}
        />
      )}
    </div>
  );
}

function InviteDialog({
  canSend,
  onClose,
  onSubmit,
}: {
  canSend: boolean;
  onClose: () => void;
  onSubmit: (emails: string[], send: boolean) => Promise<void>;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [raw, setRaw] = useState('');
  const [send, setSend] = useState(canSend);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { list, invalid } = parseEmails(raw);
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (invalid.length) return setErr(t('access.inv.invalid', { email: invalid[0] }));
    if (!list.length) return setErr(t('access.inv.empty'));
    if (list.length > MAX_INVITES) return setErr(t('access.inv.tooMany', { max: MAX_INVITES }));
    setBusy(true);
    setErr(null);
    try {
      await onSubmit(list, send);
      onClose();
    } catch (x) {
      setErr(t('errors.generic', { message: (x as Error).message }));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} onSubmit={submit}>
        <div className="modal-head">
          <h2 id={`${id}-t`}>{t('access.inv.title')}</h2>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            aria-label={t('access.inv.close')}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor={`${id}-e`}>{t('access.inv.emails')}</label>
            <textarea
              id={`${id}-e`}
              className="textarea"
              rows={4}
              autoFocus
              value={raw}
              placeholder={t('access.inv.placeholder')}
              aria-invalid={err ? true : undefined}
              aria-describedby={`${id}-h${err ? ` ${id}-err` : ''}`}
              onChange={(e) => setRaw(e.target.value)}
            />
            <span className="help" id={`${id}-h`}>
              {t('access.inv.emailsHelp', { max: MAX_INVITES })}
            </span>
            {err && (
              <span className="error-msg" id={`${id}-err`} role="alert">
                <CircleAlert aria-hidden="true" />
                {err}
              </span>
            )}
          </div>
          <label className="setting l11-send">
            <span>
              <span className="t-label">{t('access.inv.sendMail')}</span>
              <span className="t-caption muted">
                {canSend ? t('access.inv.sendMailHelp') : t('access.inv.sendAdminOnly')}
              </span>
            </span>
            <span className="switch">
              <input
                type="checkbox"
                checked={send}
                disabled={!canSend}
                onChange={(e) => setSend(e.target.checked)}
              />
              <span />
            </span>
          </label>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || list.length === 0}>
            {send ? <Send aria-hidden="true" /> : <Mail aria-hidden="true" />}
            {t('access.inv.submit', { count: list.length })}
          </button>
        </div>
      </form>
    </div>
  );
}

/** L11-04 : domaines autorisés en pastilles (@domaine), ajout par Entrée, messageries grand public refusées. */
export function DomainConfig({
  demoId,
  domains,
  editable,
  onSaved,
}: {
  demoId: string;
  domains: string[];
  editable: boolean;
  onSaved: (next: string[]) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const save = async (next: string[]) => {
    try {
      const v = check(await supabase.rpc('set_demo_domains', { p_demo: demoId, p_domains: next })) ?? [];
      setErr(null);
      onSaved(v);
      return true;
    } catch (e) {
      setErr(
        /DOMAINS_REQUIRED/.test((e as Error).message) ? t('access.dom.lastOne') : t('access.dom.invalid'),
      );
      return false;
    }
  };
  const add = async () => {
    if (!value.trim()) return;
    const c = cleanDomain(value);
    if ('error' in c) return setErr(t(c.error === 'public' ? 'access.dom.public' : 'access.dom.invalid'));
    if (domains.includes(c.domain)) return setValue('');
    if (await save([...domains, c.domain])) setValue('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void add();
    }
  };
  return (
    <div className="l11-cfg l11-dom">
      <div className="field">
        <label htmlFor="acc-dom">{t('access.dom.label')}</label>
        <div className="l11-chips">
          {domains.map((d) => (
            <span key={d} className="chip l11-chip">
              <span className="t-mono">@{d}</span>
              {editable && (
                <button
                  type="button"
                  aria-label={t('access.dom.remove', { domain: d })}
                  onClick={() => void save(domains.filter((x) => x !== d))}
                >
                  <X aria-hidden="true" />
                </button>
              )}
            </span>
          ))}
          {editable && (
            <input
              id="acc-dom"
              className="input l11-chip-input"
              value={value}
              placeholder={t('access.dom.placeholder')}
              aria-invalid={err ? true : undefined}
              aria-describedby={`acc-dom-h${err ? ' acc-dom-err' : ''}`}
              onChange={(e) => {
                setValue(e.target.value);
                setErr(null);
              }}
              onKeyDown={onKey}
            />
          )}
        </div>
        {err && (
          <span className="error-msg" id="acc-dom-err" role="alert">
            <CircleAlert aria-hidden="true" />
            {err}
          </span>
        )}
        <span className="help" id="acc-dom-h">
          {t('access.dom.help')}
        </span>
      </div>
    </div>
  );
}
