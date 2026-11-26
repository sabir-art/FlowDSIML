import { useCallback, useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, Clock, Eye, Globe, Key, KeyRound, Mail } from 'lucide-react';
import type { Tables } from '@flowdsiml/supabase-types';
import { supabase } from '../../lib/supabase';
import { check } from '../../lib/useAction';
import { formatRelativeShort } from '../../lib/format';
import { useToast } from '../../components/Toast';
import { PasswordField } from './PasswordField';
import { useShareRules } from '../../lib/shareRules';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { DomainConfig, InviteConfig } from './AccessEmail';
import { DateField, TimeField } from '@flowdsiml/ui';

type Access = Pick<
  Tables<'demo_access'>,
  'mode' | 'ask_email' | 'expires_at' | 'password_changed_at' | 'updated_at' | 'domains'
>;
type Mode = 'link' | 'password' | 'invite' | 'domain' | 'token';
const DEFAULT: Access = {
  mode: 'link',
  ask_email: false,
  expires_at: null,
  password_changed_at: null,
  updated_at: '',
  domains: [],
};
/** Modes dont le choix déplie des réglages sous l'option. */
const CONFIGURED: Mode[] = ['password', 'invite', 'domain'];
const TZ = 'Europe/Paris';

/** Décalage (ms) du fuseau de Paris à un instant donné. */
function parisOffset(at: number): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(at))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    +parts.year!,
    +parts.month! - 1,
    +parts.day!,
    +parts.hour!,
    +parts.minute!,
    +parts.second!,
  );
  return asUtc - at;
}
/** « 2026-11-30 » + « 18:00 », heure de Paris → ISO UTC. */
export function parisToIso(date: string, time: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const h = /^(\d{2}):(\d{2})$/.exec(time || '00:00');
  if (!m || !h) return null;
  const guess = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +h[1]!, +h[2]!);
  return new Date(guess - parisOffset(guess)).toISOString();
}
/** ISO → { date, time } à l'heure de Paris. */
export function isoToParis(iso: string): { date: string; time: string } {
  const at = Date.parse(iso);
  const d = new Date(at + parisOffset(at));
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  };
}

/** Règle d'accès d'une démo (table demo_access, sans le mot de passe) et ses modifications. */
export function useDemoAccess(demoId: string) {
  const { t } = useTranslation();
  const toast = useToast();
  const [access, setAccess] = useState<Access>(DEFAULT);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase
      .from('demo_access')
      .select('mode, ask_email, expires_at, password_changed_at, updated_at, domains')
      .eq('demo_id', demoId)
      .maybeSingle();
    setAccess(data ? { ...data, domains: data.domains ?? [] } : DEFAULT);
  }, [demoId]);
  useEffect(() => {
    void load();
  }, [load]);

  const fail = (e: unknown) => {
    const msg = (e as { message?: string })?.message ?? '';
    setError(
      /PASSWORD_LENGTH/.test(msg)
        ? t('access.pwTooShort')
        : /PASSWORD_REQUIRED/.test(msg)
          ? t('access.pwRequired')
          : /INVITES_REQUIRED/.test(msg)
            ? t('access.inv.required')
            : /DOMAINS_REQUIRED/.test(msg)
              ? t('access.dom.required')
              : t('errors.generic', { message: msg }),
    );
  };
  const setRule = async (patch: Partial<Pick<Access, 'mode' | 'expires_at'>>, done: string) => {
    setError(null);
    const next = { ...access, ...patch };
    try {
      check(
        await supabase.rpc('set_demo_access', {
          p_demo: demoId,
          p_mode: next.mode,
          p_ask_email: next.ask_email,
          p_expires_at: next.expires_at,
        }),
      );
      await load();
      toast(done);
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  };
  const setPassword = async (password: string, done: string) => {
    setError(null);
    try {
      check(await supabase.rpc('set_demo_password', { p_demo: demoId, p_password: password }));
      await load();
      toast(done);
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  };
  return { access, error, setRule, setPassword, reload: load };
}

type AccessState = ReturnType<typeof useDemoAccess>;

/**
 * L11-01 à 05 : onglet Accès. « Qui peut voir la démo ? » en cartes radio (lien, mot de passe, invitation,
 * domaine e-mail : L39), date d'expiration à l'heure de Paris.
 * Règles appliquées côté serveur (open-demo), sans republier.
 */
export function AccessPanel({
  demoId,
  state,
  editable,
}: {
  demoId: string;
  state: AccessState;
  editable: boolean;
}) {
  const { t } = useTranslation();
  const { access, error, setRule, setPassword, reload } = state;
  // L27-08 : règles de partage de l'espace (mode interdit visible mais désactivé, durée maximale)
  const { current, can } = useWorkspace();
  const rules = useShareRules(current?.id);
  const forbidden = (m: Mode) => m !== 'token' && !rules.modes.includes(m);
  const maxDays = rules.max_link_days;
  const maxDate = maxDays ? new Date(Date.now() + maxDays * 86_400_000) : null;
  const [choice, setChoice] = useState<Mode>(access.mode as Mode);
  // L39 : nombre d'invités (le mode « Sur invitation » en exige au moins un)
  const [invites, setInvites] = useState(0);
  useEffect(() => {
    void supabase
      .from('demo_access_invites')
      .select('email', { count: 'exact', head: true })
      .eq('demo_id', demoId)
      .then(({ count }) => setInvites(count ?? 0));
  }, [demoId]);
  const [pw, setPw] = useState('');
  const exp = access.expires_at ? isoToParis(access.expires_at) : null;
  const [expOn, setExpOn] = useState(!!access.expires_at);
  const [date, setDate] = useState(exp?.date ?? '');
  const [time, setTime] = useState(exp?.time ?? '18:00');

  useEffect(() => {
    setChoice(access.mode as Mode);
    setExpOn(!!access.expires_at);
    if (access.expires_at) {
      const p = isoToParis(access.expires_at);
      setDate(p.date);
      setTime(p.time);
    }
  }, [access.mode, access.expires_at]);

  const soon = <span className="soon-text">{t('shell.soon')}</span>;
  const modes: Array<{ id: Mode; icon: ReactNode; available: boolean }> = [
    { id: 'link', icon: <Globe aria-hidden="true" />, available: true },
    { id: 'password', icon: <Key aria-hidden="true" />, available: true },
    { id: 'invite', icon: <Mail aria-hidden="true" />, available: true },
    { id: 'domain', icon: <Building2 aria-hidden="true" />, available: true },
    // A1-11 (bloque_client) : jeton signé par le site du client, visible et désactivé
    { id: 'token', icon: <KeyRound aria-hidden="true" />, available: false },
  ];

  const pick = (m: Mode) => {
    if (!editable || forbidden(m)) return;
    setChoice(m);
    if (m === 'link' && access.mode !== 'link') void setRule({ mode: 'link' }, t('access.savedLink'));
    // Mot de passe déjà défini : le mode s'applique tout de suite ; sinon, à l'enregistrement du mot de passe
    if (m === 'password' && access.mode !== 'password' && access.password_changed_at)
      void setRule({ mode: 'password' }, t('access.savedPassword'));
    // L39 : invitation et domaine s'appliquent dès qu'il y a un invité ou un domaine
    if (m === 'invite' && access.mode !== 'invite' && invites > 0)
      void setRule({ mode: 'invite' }, t('access.savedInvite'));
    if (m === 'domain' && access.mode !== 'domain' && access.domains.length)
      void setRule({ mode: 'domain' }, t('access.savedDomain'));
  };
  // Cartes radio au clavier : flèches entre les modes disponibles
  const onKey = (e: KeyboardEvent<HTMLFieldSetElement>) => {
    const dir =
      e.key === 'ArrowDown' || e.key === 'ArrowRight'
        ? 1
        : e.key === 'ArrowUp' || e.key === 'ArrowLeft'
          ? -1
          : 0;
    if (!dir) return;
    e.preventDefault();
    const avail = modes.filter((m) => m.available && !forbidden(m.id)).map((m) => m.id);
    const next = avail[(avail.indexOf(choice) + dir + avail.length) % avail.length]!;
    pick(next);
    requestAnimationFrame(() => document.getElementById(`acc-${next}`)?.focus());
  };

  const saveExpiration = (on: boolean, d = date, h = time) => {
    if (!on) return void setRule({ expires_at: null }, t('access.expRemoved'));
    const iso = parisToIso(d, h);
    if (iso) void setRule({ expires_at: iso }, t('access.expSaved'));
  };
  const shortcut = (kind: '7' | '30' | 'month') => {
    const now = new Date();
    const target =
      kind === 'month'
        ? new Date(now.getFullYear(), now.getMonth() + 1, 0)
        : new Date(now.getTime() + Number(kind) * 86_400_000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const d = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
    const h = kind === 'month' ? '23:59' : time;
    setDate(d);
    setTime(h);
    saveExpiration(true, d, h);
  };

  return (
    <section id="sh-panel-access" aria-labelledby="shd-mode">
      <fieldset className="l11-modes" onKeyDown={onKey} disabled={!editable}>
        <legend className="t-label l11-legend">{t('access.who')}</legend>
        {modes.map((m) => (
          // Retours client : le contenu déplié fait partie de l'option, dans la même carte (sous l'en-tête, après un filet)
          <div
            key={m.id}
            className={`l11-item${choice === m.id && CONFIGURED.includes(m.id) ? ' is-open' : ''}`}
          >
            <label
              className={`opt-card l11-opt${m.available ? '' : ' is-soon'}${forbidden(m.id) ? ' is-ruled' : ''}`}
            >
              <input
                id={`acc-${m.id}`}
                type="radio"
                name="acc"
                value={m.id}
                checked={choice === m.id}
                disabled={!m.available}
                aria-disabled={forbidden(m.id) || undefined}
                aria-describedby={forbidden(m.id) ? `acc-${m.id}-rule` : undefined}
                tabIndex={choice === m.id || (forbidden(m.id) && forbidden(choice)) ? 0 : -1}
                onChange={() => pick(m.id)}
              />
              <span className="l11-ic">{m.icon}</span>
              <span className="grow">
                <b>
                  {t(`access.mode.${m.id}`)} {!m.available && soon}
                </b>
                <span className="t-caption muted">{t(`access.modeHelp.${m.id}`)}</span>
                {forbidden(m.id) && (
                  <span className="t-caption l11-rule" id={`acc-${m.id}-rule`}>
                    {choice === m.id ? t('rules.keptMode') : t('rules.disabledByRules')}
                  </span>
                )}
              </span>
            </label>
            {forbidden(m.id) && can('workspace.settings') && (
              <Link className="mk-link l11-rule-link" to="/settings/security">
                {t('rules.seeRules')}
              </Link>
            )}
            {m.id === 'invite' && choice === 'invite' && (
              <InviteConfig
                demoId={demoId}
                editable={editable}
                canSend={can('members.manage')}
                onFirst={() => {
                  setInvites(1);
                  if (access.mode !== 'invite') void setRule({ mode: 'invite' }, t('access.savedInvite'));
                }}
              />
            )}
            {m.id === 'domain' && choice === 'domain' && (
              <DomainConfig
                demoId={demoId}
                domains={access.domains}
                editable={editable}
                onSaved={(next) => {
                  if (next.length && access.mode !== 'domain')
                    void setRule({ mode: 'domain' }, t('access.savedDomain'));
                  else void reload();
                }}
              />
            )}
            {m.id === 'password' && choice === 'password' && (
              <div className="l11-cfg">
                <form
                  className="field l11-field"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void setPassword(pw, t('access.pwSaved')).then((ok) => ok && setPw(''));
                  }}
                >
                  <label htmlFor="acc-pw">{t('access.password')}</label>
                  <PasswordField
                    value={pw}
                    onChange={setPw}
                    placeholder={access.password_changed_at ? t('access.pwKeep') : ''}
                    describedBy="acc-pw-h"
                  />
                  <span className="help" id="acc-pw-h">
                    {t('access.pwHelp')}
                    {access.password_changed_at &&
                      ` ${t('access.pwChanged', { when: formatRelativeShort(access.password_changed_at) })}`}
                  </span>
                  <div className="pwf-save">
                    <button type="submit" className="btn btn-primary btn-sm" disabled={pw.length < 8}>
                      {access.password_changed_at ? t('access.pwUpdate') : t('access.pwSave')}
                    </button>
                  </div>
                </form>
                <div className="setting">
                  <span className="t-label">
                    {t('access.askEmail')} {soon}
                  </span>
                  <span className="switch">
                    <input type="checkbox" disabled aria-label={t('access.askEmail')} />
                    <span />
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </fieldset>
      {error && (
        <p className="error-msg l11-err" role="alert">
          {error}
        </p>
      )}

      <hr className="divider l11-hr" />
      <div className="setting">
        <div>
          <b id="acc-exp-l">{t('access.expiration')}</b>
          <p className="t-caption muted">{t('access.expirationHelp')}</p>
          {maxDays && (
            <p className="t-caption l11-rule" id="acc-exp-max">
              {t('rules.maxFixed', { n: maxDays })}
            </p>
          )}
        </div>
        <span className="switch">
          <input
            type="checkbox"
            aria-labelledby="acc-exp-l"
            aria-controls={expOn || maxDays ? 'acc-exp' : undefined}
            checked={expOn || !!maxDays}
            disabled={!editable}
            aria-disabled={maxDays ? true : undefined}
            aria-describedby={maxDays ? 'acc-exp-max' : undefined}
            onChange={(e) => {
              // Durée maximale fixée par l'espace : « Jamais » n'est pas proposé
              if (maxDays) return;
              setExpOn(e.target.checked);
              if (!e.target.checked) saveExpiration(false);
            }}
          />
          <span />
        </span>
      </div>
      {(expOn || !!maxDays) && (
        <div className="l11-exp" id="acc-exp">
          <div className="l11-exp-grid">
            <div className="field">
              <label htmlFor="acc-exp-d">{t('access.expDate')}</label>
              <DateField
                id="acc-exp-d"
                value={date || (maxDate ? isoToParis(maxDate.toISOString()).date : '')}
                max={maxDate ? isoToParis(maxDate.toISOString()).date : undefined}
                disabled={!editable}
                labels={{
                  open: t('common.openCalendar'),
                  previous: t('common.prevMonth'),
                  next: t('common.nextMonth'),
                }}
                onChange={(v) => {
                  setDate(v);
                  saveExpiration(true, v, time);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="acc-exp-h">{t('access.expTime')}</label>
              <TimeField
                id="acc-exp-h"
                value={time}
                disabled={!editable}
                labels={{ open: t('common.openTimes') }}
                onChange={(v) => {
                  setTime(v);
                  if (date) saveExpiration(true, date, v);
                }}
              />
            </div>
          </div>
          {editable && (
            <div className="row wrap l11-short">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => shortcut('7')}>
                {t('access.in7')}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={!!maxDays && maxDays < 30}
                onClick={() => shortcut('30')}
              >
                {t('access.in30')}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={
                  !!maxDate &&
                  new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59).getTime() >
                    maxDate.getTime() + 60_000
                }
                onClick={() => shortcut('month')}
              >
                {t('access.endOfMonth')}
              </button>
            </div>
          )}
          <p className="help l11-help">{t('access.expHelp')}</p>
        </div>
      )}
      <div className="setting">
        <div>
          <b>{t('share.formFirst')}</b>
          <p className="t-caption muted">{t('share.formFirstHelp')}</p>
        </div>
        <Link className="btn btn-secondary btn-sm" to={`/demos/${demoId}/edit?tab=settings`}>
          {t('share.configure')}
        </Link>
      </div>
    </section>
  );
}

/** Carte « Accès à la démo » de la colonne de droite. */
export function AccessSummary({ state, url }: { state: AccessState; url: string }) {
  const { t, i18n } = useTranslation();
  const formatDateTime = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language === 'en' ? 'en-GB' : 'fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: TZ,
    }).format(new Date(iso));
  const { access } = state;
  const expired = access.expires_at ? Date.parse(access.expires_at) <= Date.now() : false;
  return (
    <div className="card card-pad l11-sum">
      <h2 className="t-label">{t('access.summary')}</h2>
      <div className="l11-sum__line">
        <span className="l11-ic">
          {access.mode === 'password' ? (
            <Key aria-hidden="true" />
          ) : access.mode === 'invite' ? (
            <Mail aria-hidden="true" />
          ) : access.mode === 'domain' ? (
            <Building2 aria-hidden="true" />
          ) : (
            <Globe aria-hidden="true" />
          )}
        </span>
        <span>
          <b>{t(`access.mode.${access.mode}`)}</b>
          <span className="t-caption muted">
            {access.mode === 'password' && access.password_changed_at
              ? t('access.pwChangedCap', { when: formatRelativeShort(access.password_changed_at) })
              : access.mode === 'domain' && access.domains.length
                ? access.domains.map((d) => `@${d}`).join(', ')
                : t(`access.modeHelp.${access.mode}`)}
          </span>
        </span>
      </div>
      {access.expires_at && (
        <div className="l11-sum__line">
          <span className="l11-ic">
            <Clock aria-hidden="true" />
          </span>
          <span>
            <b>
              {t(expired ? 'access.expiredOn' : 'access.expiresOn', {
                date: formatDateTime(access.expires_at),
              })}
            </b>
            <span className="t-caption muted">{t('access.parisTime')}</span>
          </span>
        </div>
      )}
      <a className="btn btn-secondary btn-sm" href={url} target="_blank" rel="noopener noreferrer">
        <Eye aria-hidden="true" />
        {t('access.seeScreen')}
      </a>
    </div>
  );
}
