import { safeExternalUrl } from '@flowdsiml/manifest';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  ArrowRight,
  Ban,
  Building2,
  CircleCheck,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  Mail,
  Play,
  RotateCw,
  SearchX,
  WifiOff,
} from 'lucide-preact';
import { openDemo, requestAccess, type GateInfo } from './api';
import { fmt, strings, type Dict } from './i18n';
import { initials } from './Player';

/**
 * Cadre des écrans système et d'accès (PLY-06, L11) : en-tête du workspace sans actions, capture vide
 * voilée, carte centrée (feuille du bas sur mobile), « Créé avec TutoClick ».
 */
export function SysFrame({
  t,
  info,
  label,
  children,
}: {
  t: Dict;
  info?: Pick<GateInfo, 'title' | 'workspace'>;
  label: string;
  children: ComponentChildren;
}) {
  return (
    <div class="p-root p-sys">
      <header class="p-top">
        {info?.title ? (
          <div class="p-id">
            {info.workspace ? (
              <span class="p-ws" aria-hidden="true">
                {initials(info.workspace)}
              </span>
            ) : null}
            <div class="p-id-text">
              <b class="p-title">{info.title}</b>
              {info.workspace ? <small class="p-meta">{info.workspace}</small> : null}
            </div>
          </div>
        ) : null}
      </header>
      <main class="p-stage-wrap" aria-label={label}>
        <div class="p-sys-shot" aria-hidden="true" />
        {children}
      </main>
      <p class="p-branding">{t.madeWith}</p>
    </div>
  );
}

export type SysKind = 'notFound' | 'expired' | 'blocked' | 'network';

/**
 * Écran système : démo introuvable, lien expiré (L11-12 : date, workspace, site), intégration refusée,
 * L36 : connexion impossible (bouton Réessayer, nouvel essai automatique au retour du réseau).
 */
export function SysScreen({
  kind,
  locale,
  info,
  onRetry,
}: {
  kind: SysKind;
  locale: string;
  info?: GateInfo;
  onRetry?: () => void;
}) {
  const t = strings(locale.startsWith('en') ? 'en' : 'fr');
  const g = t.gate as unknown as Record<string, string>;
  const date = info?.expiredAt
    ? new Intl.DateTimeFormat(locale.startsWith('en') ? 'en-GB' : 'fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Europe/Paris',
      }).format(new Date(info.expiredAt))
    : null;
  const view = {
    notFound: { Icon: SearchX, title: t.notFoundTitle, text: t.notFound },
    expired: {
      Icon: Clock,
      title: t.expiredTitle,
      text: date
        ? fmt(g, info?.workspace ? 'expiredOn' : 'expiredOnNoWs', { date, ws: info?.workspace ?? '' })
        : t.expired,
    },
    blocked: { Icon: Ban, title: t.blockedTitle, text: t.embedBlocked },
    network: { Icon: WifiOff, title: t.networkTitle, text: t.network },
  }[kind];
  const retry = kind === 'network' ? onRetry : undefined;
  useEffect(() => {
    if (!retry) return;
    addEventListener('online', retry);
    return () => removeEventListener('online', retry);
  }, [retry]);
  const site = kind === 'expired' && info?.website ? info.website : null;
  return (
    <SysFrame t={t} info={info} label={view.title}>
      <div class="p-card p-sys-card" role="alert">
        <span class="p-sys-chip" aria-hidden="true">
          <view.Icon size={22} />
        </span>
        <h1>{view.title}</h1>
        <p class="p-sub">{view.text}</p>
        {retry && (
          <button type="button" class="p-btn p-btn-primary p-sys-act" onClick={retry}>
            <RotateCw size={16} aria-hidden="true" />
            {t.retry}
          </button>
        )}
        {site && (
          <a
            class="p-btn p-btn-secondary p-sys-act"
            href={safeExternalUrl(site) ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={16} aria-hidden="true" />
            {fmt(g, 'visit', { site: new URL(site).host })}
          </a>
        )}
      </div>
    </SysFrame>
  );
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * L11-06 à 08 : mot de passe. Erreur sous le champ avec les essais restants ; après 5 essais, champ
 * désactivé et compte à rebours sur le bouton (annoncé une seule fois).
 */
export function PasswordGate({
  demoId,
  locale,
  info,
  onOpen,
  submitPassword,
}: {
  demoId: string;
  locale: string;
  info: GateInfo;
  onOpen: (r: GateInfo) => void;
  /** L14 : vérification propre (centre de formation) ; par défaut, open-demo. */
  submitPassword?: (password: string) => Promise<GateInfo>;
}) {
  const t = strings(locale.startsWith('en') ? 'en' : 'fr');
  const g = t.gate as unknown as Record<string, string>;
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<GateInfo>(info);
  const [wait, setWait] = useState(info.status === 'locked' ? (info.retryIn ?? 60) : 0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);
  useEffect(() => {
    if (wait !== 0) return;
    setState((s) => (s.status === 'locked' ? { ...s, status: 'password_required' } : s));
    input.current?.focus();
  }, [wait]);

  const locked = wait > 0;
  const failed = state.status === 'error' || state.status === 'network';
  const wrong = state.status === 'password_wrong' || failed;
  const submit = async (e: Event) => {
    e.preventDefault();
    if (!value || busy || locked) return;
    setBusy(true);
    const r = await (submitPassword ? submitPassword(value) : openDemo(demoId, value));
    setBusy(false);
    if (r.status === 'ok') return onOpen(r);
    setState({ ...state, ...r });
    if (r.status === 'locked') setWait(r.retryIn ?? 60);
    else {
      setValue('');
      input.current?.focus();
    }
  };

  const title = (locked ? g.lockedTitle : g.protectedTitle) ?? '';
  return (
    <SysFrame t={t} info={info} label={title}>
      <form class="p-card p-sys-card p-gate" onSubmit={submit} aria-labelledby="p-gate-t" novalidate>
        <span class={`p-sys-chip${locked ? ' p-sys-chip--warn' : ''}`} aria-hidden="true">
          {locked ? <Clock size={22} /> : <Key size={22} />}
        </span>
        <h1 id="p-gate-t">{title}</h1>
        {locked ? (
          <p class="p-sub" role="status">
            {g.lockedText}
          </p>
        ) : (
          <p class="p-sub">
            {fmt(g, info.workspace ? 'protectedText' : 'protectedTextNoWs', {
              ws: info.workspace ?? '',
              title: info.title ?? '',
            })}
          </p>
        )}
        <div class="p-field p-gate-field">
          <label for="p-gate-pw">{g.password}</label>
          <div class="p-gate-pw">
            <input
              ref={input}
              id="p-gate-pw"
              class="p-input"
              type={show ? 'text' : 'password'}
              autocomplete="current-password"
              name="password"
              autoFocus
              required
              disabled={locked}
              value={value}
              aria-invalid={wrong && !locked ? true : undefined}
              aria-describedby={wrong && !locked ? 'p-gate-err' : undefined}
              onInput={(e) => setValue((e.target as HTMLInputElement).value)}
            />
            <button
              type="button"
              class="p-icon-btn p-gate-eye"
              aria-label={g.show}
              aria-pressed={show}
              disabled={locked}
              onClick={() => setShow((v) => !v)}
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {wrong && !locked && (
            <span class="p-gate-err" id="p-gate-err" role="alert">
              {failed ? g.error : g.wrong}
            </span>
          )}
        </div>
        <button
          type="submit"
          class="p-btn p-btn-primary p-gate-submit"
          disabled={busy || locked}
          aria-label={locked ? g.lockedText : undefined}
        >
          {locked ? (
            <span aria-hidden="true">{fmt(g, 'retryIn', { time: clock(wait) })}</span>
          ) : (
            <>
              {g.access}
              <ArrowRight size={16} aria-hidden="true" />
            </>
          )}
        </button>
        {state.status === 'password_wrong' && typeof state.remaining === 'number' && !locked && (
          <p class="p-gate-foot">{fmt(g, 'remaining', { count: state.remaining })}</p>
        )}
      </form>
    </SysFrame>
  );
}

/**
 * L39 (L11-09 à 11, L11-13) : démo « Sur invitation » ou « Par domaine e-mail ». Le visiteur saisit son
 * adresse ; s'il y a droit, il reçoit un lien d'accès personnel (valable 1 heure). La réponse est la même
 * que l'adresse soit sur la liste ou non ; seul un domaine refusé est signalé (le visiteur le connaît).
 */
export function EmailGate({ demoId, locale, info }: { demoId: string; locale: string; info: GateInfo }) {
  const t = strings(locale.startsWith('en') ? 'en' : 'fr');
  const g = t.gate as unknown as Record<string, string>;
  const domain = info.mode === 'domain';
  const [view, setView] = useState<'form' | 'sent' | 'expired'>(
    info.status === 'link_expired' ? 'expired' : 'form',
  );
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(
    info.status === 'email_not_allowed' ? ((domain ? g.domainRefused : g.notAllowed) ?? null) : null,
  );
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const allowed = (e: string) =>
    !domain || !info.domains?.length || info.domains.includes(e.split('@')[1] ?? '');
  const ask = async () => {
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
      setError(g.emailInvalid ?? '');
      input.current?.focus();
      return;
    }
    if (!allowed(e)) {
      setError(g.domainRefused ?? '');
      input.current?.focus();
      return;
    }
    setBusy(true);
    const r = await requestAccess(demoId, e).catch(() => 'error' as const);
    setBusy(false);
    if (r === 'domain_refused') {
      setError(g.domainRefused ?? '');
      input.current?.focus();
    } else if (r === 'error') {
      setError(g.error ?? '');
    } else {
      setError(null);
      setView('sent');
      setWait(60);
    }
  };

  if (view === 'sent')
    return (
      <SysFrame t={t} info={info} label={g.sentTitle ?? ''}>
        <div class="p-card p-sys-card p-gate">
          <span class="p-sys-chip p-sys-chip--ok" aria-hidden="true">
            <CircleCheck size={22} />
          </span>
          <h1 id="p-gate-t">{g.sentTitle}</h1>
          <p class="p-sub" role="status">
            {fmt(g, 'sentText', { email: email.trim().toLowerCase() })}
          </p>
          <button
            type="button"
            class="p-btn p-btn-primary p-gate-submit"
            disabled={wait > 0 || busy}
            onClick={() => void ask()}
          >
            {wait > 0 ? <span>{fmt(g, 'resendIn', { time: clock(wait) })}</span> : g.resend}
          </button>
          <button
            type="button"
            class="p-link p-link--muted"
            onClick={() => {
              setView('form');
              setTimeout(() => input.current?.focus(), 0);
            }}
          >
            {g.changeEmail}
          </button>
          <p class="p-gate-foot">{g.spam}</p>
        </div>
      </SysFrame>
    );

  if (view === 'expired')
    return (
      <SysFrame t={t} info={info} label={g.linkExpiredTitle ?? ''}>
        <div class="p-card p-sys-card p-gate">
          <span class="p-sys-chip p-sys-chip--warn" aria-hidden="true">
            <Clock size={22} />
          </span>
          <h1 id="p-gate-t">{g.linkExpiredTitle}</h1>
          <p class="p-sub">{g.linkExpiredText}</p>
          <button
            type="button"
            class="p-btn p-btn-primary p-gate-submit"
            autoFocus
            onClick={() => {
              setView('form');
              setTimeout(() => input.current?.focus(), 0);
            }}
          >
            {g.newLink}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </SysFrame>
    );

  const title = (domain ? g.domainTitle : g.inviteTitle) ?? '';
  return (
    <SysFrame t={t} info={info} label={title}>
      <form
        class="p-card p-sys-card p-gate"
        aria-labelledby="p-gate-t"
        novalidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void ask();
        }}
      >
        <span class="p-sys-chip" aria-hidden="true">
          {domain ? <Building2 size={22} /> : <Mail size={22} />}
        </span>
        <h1 id="p-gate-t">{title}</h1>
        <p class="p-sub">
          {domain && info.domains?.length
            ? fmt(g, 'domainText', { domains: info.domains.map((d) => `@${d}`).join(` ${g.or} `) })
            : domain
              ? g.domainTextNoList
              : g.inviteText}
        </p>
        <div class="p-field p-gate-field">
          <label for="p-gate-email">{domain ? g.workEmail : g.email}</label>
          <input
            ref={input}
            id="p-gate-email"
            class="p-input"
            type="email"
            autocomplete="email"
            name="email"
            autoFocus
            required
            value={email}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'p-gate-err' : undefined}
            onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
          />
          {error && (
            <span class="p-gate-err" id="p-gate-err" role="alert">
              {error}
            </span>
          )}
        </div>
        <button type="submit" class="p-btn p-btn-primary p-gate-submit" disabled={busy}>
          {g.request}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
        <p class="p-gate-foot">{g.emailUse}</p>
      </form>
    </SysFrame>
  );
}

/** L16 : écran de démarrage (intégration avec « Démarrage au clic », ?start=click). */
export function StartScreen({
  t,
  title,
  workspace,
  onStart,
}: {
  t: Dict;
  title: string;
  workspace: string;
  onStart: () => void;
}) {
  return (
    <SysFrame t={t} info={{ title, workspace }} label={title}>
      <div class="p-card p-sys-card">
        <span class="p-sys-chip" aria-hidden="true">
          <Play size={22} />
        </span>
        <h1>{title}</h1>
        <button type="button" class="p-btn p-btn-primary" onClick={onStart} autoFocus>
          {t.launch}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </SysFrame>
  );
}
