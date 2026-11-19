/**
 * L26-11 : télécommande sur le téléphone (#/t, sans compte). Appairage par le QR code (#/t?r=…&c=…)
 * ou par le code à 8 chiffres. Le téléphone affiche les notes et commande les étapes ; il n'accède à rien
 * d'autre de l'espace. L'écran reste allumé (Wake Lock) ; réseau perdu : commandes désactivées.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, EyeOff, WifiOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { clock, noteLines } from './present';
import { openRemote, type RemoteLink, type RemoteMessage } from './remote';
import './present.css';

interface Payload {
  title: string;
  notes: string;
  steps: Array<{ title: string; notes: string }>;
}
interface Live {
  index: number;
  total: number;
  black: boolean;
  startedAt: number;
  minutes: number | null;
}
const TOKEN_KEY = 'fd.remote';

export function RemotePhone() {
  const { t } = useTranslation();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const [phase, setPhase] = useState<'code' | 'pairing' | 'on' | 'ended'>('code');
  const [code, setCode] = useState(params.get('c') ?? '');
  const [err, setErr] = useState<'invalid' | 'expired' | 'busy' | null>(null);
  const [data, setData] = useState<Payload | null>(null);
  const [channel, setChannel] = useState<string | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [online, setOnline] = useState(true);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [now, setNow] = useState(Date.now());
  const link = useRef<RemoteLink | null>(null);

  useEffect(() => {
    document.documentElement.dataset.remote = '1';
    return () => {
      delete document.documentElement.dataset.remote;
    };
  }, []);

  // Un seul appairage à la fois (le code est à usage unique)
  const pairing = useRef(false);
  const pair = async (id: string | null, c: string) => {
    if (pairing.current) return;
    pairing.current = true;
    setPhase('pairing');
    setErr(null);
    const { data: r } = await supabase.rpc('present_remote_pair', { p_id: id, p_code: c });
    const res = r as ({ status: string; token: string; channel: string } & Payload) | null;
    pairing.current = false;
    if (!res || res.status !== 'ok') {
      setErr(res?.status === 'expired' ? 'expired' : res?.status === 'busy' ? 'busy' : 'invalid');
      setPhase('code');
      return;
    }
    try {
      sessionStorage.setItem(TOKEN_KEY, res.token);
    } catch {
      /* stockage indisponible : pas de reprise au rechargement */
    }
    setData({ title: res.title, notes: res.notes, steps: res.steps });
    setChannel(res.channel);
    setPhase('on');
  };
  // Ouverture : jeton de la session (rechargement), sinon QR code (r + c)
  useEffect(() => {
    let tok: string | null = null;
    try {
      tok = sessionStorage.getItem(TOKEN_KEY);
    } catch {
      tok = null;
    }
    if (tok) {
      void supabase.rpc('present_remote_state', { p_token: tok }).then(({ data: r }) => {
        const res = r as ({ status: string; channel: string } & Payload) | null;
        if (res?.status === 'ok') {
          setData({ title: res.title, notes: res.notes, steps: res.steps });
          setChannel(res.channel);
          setPhase('on');
        } else {
          try {
            sessionStorage.removeItem(TOKEN_KEY);
          } catch {
            /* rien */
          }
          const r0 = params.get('r');
          const c0 = params.get('c');
          if (r0 && c0 && /^\d{8}$/.test(c0)) void pair(r0, c0);
        }
      });
      return;
    }
    const r0 = params.get('r');
    const c0 = params.get('c');
    if (r0 && c0 && /^\d{8}$/.test(c0)) void pair(r0, c0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Canal : état et notes venant du présentateur ; « hello » pour recevoir l'état courant
  useEffect(() => {
    if (!channel) return;
    const l = openRemote(
      channel,
      (m: RemoteMessage) => {
        if (m.type === 'state') {
          setLive({
            index: m.index,
            total: m.total,
            black: m.black,
            startedAt: m.startedAt,
            minutes: m.minutes,
          });
          setOnline(true);
        } else if (m.type === 'notes')
          setData((d) =>
            d
              ? m.index < 0
                ? { ...d, notes: m.text }
                : { ...d, steps: d.steps.map((s, i) => (i === m.index ? { ...s, notes: m.text } : s)) }
              : d,
          );
        else if (m.type === 'end') {
          setPhase('ended');
          try {
            sessionStorage.removeItem(TOKEN_KEY);
          } catch {
            /* rien */
          }
        }
      },
      (ok) => setOnline(ok || typeof BroadcastChannel !== 'undefined'),
    );
    link.current = l;
    l.send({ type: 'cmd', cmd: 'hello' });
    const id = window.setInterval(() => !liveRef.current && l.send({ type: 'cmd', cmd: 'hello' }), 2000);
    return () => {
      clearInterval(id);
      l.close();
      link.current = null;
    };
  }, [channel]);
  const liveRef = useRef(live);
  liveRef.current = live;

  // Réseau du téléphone
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    addEventListener('online', on);
    addEventListener('offline', off);
    return () => {
      removeEventListener('online', on);
      removeEventListener('offline', off);
    };
  }, []);
  // Écran allumé pendant la présentation
  useEffect(() => {
    if (phase !== 'on') return;
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (k: 'screen') => Promise<{ release: () => Promise<void> }> };
    };
    void nav.wakeLock
      ?.request('screen')
      .then((l) => (lock = l))
      .catch(() => undefined);
    return () => void lock?.release().catch(() => undefined);
  }, [phase]);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const cmd = (c: 'next' | 'prev' | 'black' | 'end') => link.current?.send({ type: 'cmd', cmd: c });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (/^\d{8}$/.test(code)) void pair(params.get('r'), code);
    else setErr('invalid');
  };

  if (phase === 'ended')
    return (
      <main className="rmp rmp-center" id="main">
        <h1>{t('present.t.title')}</h1>
        <p role="status">{t('present.t.ended')}</p>
      </main>
    );
  if (phase !== 'on' || !data)
    return (
      <main className="rmp rmp-center" id="main">
        <h1>{t('present.t.title')}</h1>
        <form onSubmit={submit} className="rmp-form" noValidate>
          <label htmlFor="rmp-code">{t('present.t.code')}</label>
          <p className="rmp-help" id="rmp-code-h">
            {t('present.t.enter')}
          </p>
          <input
            id="rmp-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={8}
            value={code}
            aria-describedby={err ? 'rmp-code-e' : 'rmp-code-h'}
            aria-invalid={err ? true : undefined}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
          />
          {err && (
            <p className="rmp-err" id="rmp-code-e" role="alert">
              {t(
                err === 'expired'
                  ? 'present.t.expired'
                  : err === 'busy'
                    ? 'present.t.busy'
                    : 'present.t.invalid',
              )}
            </p>
          )}
          <button type="submit" className="rmp-next" disabled={phase === 'pairing'}>
            {phase === 'pairing' ? t('present.t.connecting') : t('present.t.connect')}
          </button>
        </form>
      </main>
    );

  const i = live?.index ?? 0;
  const total = live?.total ?? data.steps.length;
  const showDemo = i === 0 || i === total - 1;
  const notes = noteLines(showDemo && data.notes.trim() ? data.notes : data.steps[i]?.notes);
  const next = data.steps[i + 1];
  const elapsed = live ? Math.floor((now - live.startedAt) / 1000) : 0;
  const disabled = !online || !live;

  return (
    <main className="rmp" id="main">
      {!online && (
        <p className="rmp-lost" role="alert">
          <WifiOff aria-hidden="true" />
          {t('present.t.lost')}
        </p>
      )}
      <header className="rmp-head">
        <h1>{data.title}</h1>
        <span>{t('present.t.of', { n: i + 1, total })}</span>
      </header>
      <p className="rmp-timer" role="timer" aria-label={t('present.t.timer')}>
        {clock(elapsed)}
        {live?.minutes ? <small> / {clock(live.minutes * 60)}</small> : null}
      </p>
      <section className="rmp-notes" aria-labelledby="rmp-n">
        <h2 id="rmp-n">
          {showDemo && data.notes.trim() ? t('present.t.notesDemo') : t('present.t.notes', { n: i + 1 })}
        </h2>
        {notes.length ? (
          <ul>
            {notes.map((l, k) => (
              <li key={k}>{l}</li>
            ))}
          </ul>
        ) : (
          <p className="rmp-muted">{t('present.t.noNotes')}</p>
        )}
        <p className="rmp-nextis">
          {next ? t('present.t.nextIs', { title: next.title }) : t('present.t.last')}
        </p>
      </section>
      <div className="rmp-ctl">
        <div className="rmp-row">
          <button
            type="button"
            className="rmp-prev"
            disabled={disabled || i === 0}
            onClick={() => cmd('prev')}
          >
            <ArrowLeft aria-hidden="true" />
            {t('present.t.prev')}
          </button>
          <button
            type="button"
            className="rmp-next"
            disabled={disabled || i >= total - 1}
            onClick={() => cmd('next')}
          >
            {t('present.t.next')}
            <ArrowRight aria-hidden="true" />
          </button>
        </div>
        <div className="rmp-row">
          <button type="button" aria-pressed={!!live?.black} disabled={disabled} onClick={() => cmd('black')}>
            <EyeOff aria-hidden="true" />
            {t('present.t.black')}
          </button>
          {confirmEnd ? (
            <span className="rmp-confirm" role="group" aria-label={t('present.t.endConfirm')}>
              <button type="button" className="rmp-danger" disabled={disabled} onClick={() => cmd('end')}>
                {t('present.t.endYes')}
              </button>
              <button type="button" onClick={() => setConfirmEnd(false)} autoFocus>
                {t('present.t.endNo')}
              </button>
            </span>
          ) : (
            <button type="button" disabled={disabled} onClick={() => setConfirmEnd(true)}>
              {t('present.t.end')}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
