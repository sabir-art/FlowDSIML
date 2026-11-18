import { useCallback, useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, Clock, Eye, EyeOff, Globe, Info, Key, Mail, RefreshCw } from 'lucide-react';
import type { Tables } from '@flowdsiml/supabase-types';
import { supabase } from '../../lib/supabase';
import { check } from '../../lib/useAction';
import { formatRelativeShort } from '../../lib/format';
import { useToast } from '../../components/Toast';

type Access = Pick<
  Tables<'demo_access'>,
  'mode' | 'ask_email' | 'expires_at' | 'password_changed_at' | 'updated_at'
>;
type Mode = 'link' | 'password' | 'invite' | 'domain';
const DEFAULT: Access = {
  mode: 'link',
  ask_email: false,
  expires_at: null,
  password_changed_at: null,
  updated_at: '',
};
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
      .select('mode, ask_email, expires_at, password_changed_at, updated_at')
      .eq('demo_id', demoId)
      .maybeSingle();
    setAccess(data ?? DEFAULT);
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
  return { access, error, setRule, setPassword };
}

type AccessState = ReturnType<typeof useDemoAccess>;

/** Mot de passe aléatoire lisible (12 caractères, sans caractères ambigus). */
function generatePassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

/**
 * L11-01 à 05 : onglet Accès. « Qui peut voir la démo ? » en cartes radio (lien, mot de passe ; invitation
 * et domaine e-mail en Bientôt : ils exigent l'envoi d'e-mails), date d'expiration à l'heure de Paris.
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
  const { access, error, setRule, setPassword } = state;
  const [choice, setChoice] = useState<Mode>(access.mode as Mode);
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
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

  const soon = <span className="badge">{t('shell.soon')}</span>;
  const modes: Array<{ id: Mode; icon: ReactNode; available: boolean }> = [
    { id: 'link', icon: <Globe aria-hidden="true" />, available: true },
    { id: 'password', icon: <Key aria-hidden="true" />, available: true },
    { id: 'invite', icon: <Mail aria-hidden="true" />, available: false },
    { id: 'domain', icon: <Building2 aria-hidden="true" />, available: false },
  ];

  const pick = (m: Mode) => {
    if (!editable) return;
    setChoice(m);
    if (m === 'link' && access.mode !== 'link') void setRule({ mode: 'link' }, t('access.savedLink'));
    // Mot de passe déjà défini : le mode s'applique tout de suite ; sinon, à l'enregistrement du mot de passe
    if (m === 'password' && access.mode !== 'password' && access.password_changed_at)
      void setRule({ mode: 'password' }, t('access.savedPassword'));
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
    const avail = modes.filter((m) => m.available).map((m) => m.id);
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
    <section role="tabpanel" id="sh-panel-access" aria-labelledby="sh-tab-access">
      <fieldset className="l11-modes" onKeyDown={onKey} disabled={!editable}>
        <legend className="t-label l11-legend">{t('access.who')}</legend>
        {modes.map((m) => (
          <div key={m.id}>
            <label className={`opt-card l11-opt${m.available ? '' : ' is-soon'}`}>
              <input
                id={`acc-${m.id}`}
                type="radio"
                name="acc"
                value={m.id}
                checked={choice === m.id}
                disabled={!m.available}
                tabIndex={choice === m.id ? 0 : -1}
                onChange={() => pick(m.id)}
              />
              <span className="l11-ic">{m.icon}</span>
              <span className="grow">
                <b>
                  {t(`access.mode.${m.id}`)} {!m.available && soon}
                </b>
                <span className="t-caption muted">{t(`access.modeHelp.${m.id}`)}</span>
              </span>
            </label>
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
                  <div className="input-group l11-pw">
                    <input
                      id="acc-pw"
                      className="input"
                      type={show ? 'text' : 'password'}
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={200}
                      value={pw}
                      placeholder={access.password_changed_at ? t('access.pwKeep') : ''}
                      aria-describedby="acc-pw-h"
                      onChange={(e) => setPw(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-icon"
                      aria-label={t('access.showPw')}
                      aria-pressed={show}
                      onClick={() => setShow((v) => !v)}
                    >
                      {show ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setPw(generatePassword());
                        setShow(true);
                      }}
                    >
                      <RefreshCw aria-hidden="true" />
                      {t('access.generate')}
                    </button>
                  </div>
                  <span className="help" id="acc-pw-h">
                    {t('access.pwHelp')}
                    {access.password_changed_at &&
                      ` ${t('access.pwChanged', { when: formatRelativeShort(access.password_changed_at) })}`}
                  </span>
                  <div>
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
        </div>
        <span className="switch">
          <input
            type="checkbox"
            aria-labelledby="acc-exp-l"
            aria-controls={expOn ? 'acc-exp' : undefined}
            checked={expOn}
            disabled={!editable}
            onChange={(e) => {
              setExpOn(e.target.checked);
              if (!e.target.checked) saveExpiration(false);
            }}
          />
          <span />
        </span>
      </div>
      {expOn && (
        <div className="l11-exp" id="acc-exp">
          <div className="l11-exp-grid">
            <div className="field">
              <label htmlFor="acc-exp-d">{t('access.expDate')}</label>
              <input
                id="acc-exp-d"
                className="input"
                type="date"
                value={date}
                disabled={!editable}
                onChange={(e) => {
                  setDate(e.target.value);
                  saveExpiration(true, e.target.value, time);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="acc-exp-h">{t('access.expTime')}</label>
              <input
                id="acc-exp-h"
                className="input"
                type="time"
                value={time}
                disabled={!editable}
                onChange={(e) => {
                  setTime(e.target.value);
                  if (date) saveExpiration(true, date, e.target.value);
                }}
              />
            </div>
          </div>
          {editable && (
            <div className="row wrap l11-short">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => shortcut('7')}>
                {t('access.in7')}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => shortcut('30')}>
                {t('access.in30')}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => shortcut('month')}>
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
      <div className="alert l11-info">
        <Info aria-hidden="true" />
        <span className="t-caption">{t('access.rulesInfo')}</span>
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
      <h3 className="t-label">{t('access.summary')}</h3>
      <div className="l11-sum__line">
        <span className="l11-ic">
          {access.mode === 'password' ? <Key aria-hidden="true" /> : <Globe aria-hidden="true" />}
        </span>
        <span>
          <b>{t(`access.mode.${access.mode}`)}</b>
          <span className="t-caption muted">
            {access.mode === 'password' && access.password_changed_at
              ? t('access.pwChangedCap', { when: formatRelativeShort(access.password_changed_at) })
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
