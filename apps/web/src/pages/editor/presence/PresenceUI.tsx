/** L22-08 : pile d'avatars et panneau « Sur cette démo », bandeau même étape, avatars du rail, curseurs. */
import { useEffect, useId, useRef, useState } from 'react';
import { AvatarPhoto } from '../../../components/AvatarPhoto';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { initials } from '../../../lib/initials';
import { avatarTone } from '../../../lib/avatarTone';
import { idleMinutes, isIdle, stack, type PresencePayload } from './presence';
import { usePresenceLive, type PresenceStoreT } from './usePresence';

type Names = Record<string, string>;
const firstName = (n: string) => n.split(/\s+/)[0] ?? n;

function Av({
  u,
  name,
  idle,
  className = '',
}: {
  u: string;
  name: string;
  idle?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`cm-avatar cm-avatar--${avatarTone(u)} pr-av${idle ? ' is-idle' : ''} ${className}`}
      aria-hidden="true"
    >
      {initials(name)}
      <AvatarPhoto userId={u} />
    </span>
  );
}

/** Barre de l'éditeur : 3 avatars puis « +n » ; ouvre « Sur cette démo ». */
export function PresenceStack({
  others,
  names,
  stepIndexOf,
  me,
  myStep,
  onGo,
}: {
  others: PresencePayload[];
  names: Names;
  stepIndexOf: (stepId: string | null) => number;
  me: { id: string; name: string };
  myStep: number;
  onGo: (index: number) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(i);
  }, []);
  useEffect(() => {
    if (!open) return;
    pop.current?.querySelector<HTMLElement>('button')?.focus();
    const onDoc = (e: MouseEvent) => {
      if (!pop.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  if (!others.length) return null;
  const name = (u: string) => names[u] || t('presence.someone');
  const { shown, more } = stack(others);
  const close = () => {
    setOpen(false);
    btn.current?.focus();
  };
  const where = (p: PresencePayload) => {
    const i = stepIndexOf(p.s);
    const step = i >= 0 ? t('presence.stepN', { n: i + 1 }) : t('presence.noStep');
    if (isIdle(p, now)) return `${step} · ${t('presence.idle', { count: idleMinutes(p, now) })}`;
    return p.a ? `${step} · ${t(`presence.act_${p.a}`)}` : step;
  };
  return (
    <span className="pr-wrap">
      <button
        ref={btn}
        type="button"
        className="pr-stack"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${id}-pop` : undefined}
        aria-label={t('presence.button', {
          count: others.length,
          names: others.map((p) => name(p.u)).join(', '),
        })}
        onClick={() => setOpen(!open)}
      >
        {shown.map((p) => (
          <Av key={p.u} u={p.u} name={name(p.u)} idle={isIdle(p, now)} />
        ))}
        {more > 0 && <span className="pr-more">+{more}</span>}
      </button>
      {open && (
        <div
          ref={pop}
          id={`${id}-pop`}
          className="pr-pop"
          role="dialog"
          aria-labelledby={`${id}-t`}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              close();
            }
          }}
        >
          <h3 id={`${id}-t`}>{t('presence.title')}</h3>
          <ul>
            <li>
              <button type="button" onClick={() => close()}>
                <Av u={me.id} name={me.name} />
                <span>
                  <b>{t('presence.you')}</b>
                  <small>{t('presence.stepN', { n: myStep + 1 })}</small>
                </span>
              </button>
            </li>
            {others.map((p) => (
              <li key={p.u}>
                <button
                  type="button"
                  onClick={() => {
                    const i = stepIndexOf(p.s);
                    if (i >= 0) onGo(i);
                    close();
                  }}
                >
                  <Av u={p.u} name={name(p.u)} idle={isIdle(p, now)} />
                  <span>
                    <b>{name(p.u)}</b>
                    <small>{where(p)}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="fd-help pr-help">{t('presence.help')}</p>
        </div>
      )}
    </span>
  );
}

/** Bandeau au-dessus du canevas quand une autre personne active est sur la même étape. */
export function CoBanner({
  others,
  stepId,
  names,
}: {
  others: PresencePayload[];
  stepId: string | null;
  names: Names;
}) {
  const { t } = useTranslation();
  const here = others.filter((p) => p.s === stepId && !isIdle(p));
  const first = here[0];
  // Une seule annonce : le texte ne change que si la personne ou ce qu'elle modifie change
  if (!first) return <div className="co-banner-slot" role="status" />;
  const who = names[first.u] || t('presence.someone');
  return (
    <div className="co-banner-slot" role="status">
      <div className="co-banner">
        <Av u={first.u} name={who} />
        <span>
          <b>{who}</b>{' '}
          {first.a
            ? t('presence.bannerField', { field: t(`presence.field_${first.a}`) })
            : t('presence.bannerHere')}
          {here.length > 1 ? ` ${t('presence.andMore', { count: here.length - 1 })}` : ''}{' '}
          {t('presence.merge')}
        </span>
      </div>
    </div>
  );
}

/** Avatars de 20 px sur la vignette de l'étape où se trouve chaque personne. */
export function RailWho({ people, names }: { people: PresencePayload[]; names: Names }) {
  const { t } = useTranslation();
  if (!people.length) return null;
  const label = people.map((p) => names[p.u] || t('presence.someone')).join(', ');
  return (
    <span className="rail-who" title={t('presence.railTitle', { names: label })}>
      {people.slice(0, 2).map((p) => (
        <Av key={p.u} u={p.u} name={names[p.u] || '?'} idle={isIdle(p)} />
      ))}
      <span className="sr-only">{t('presence.railTitle', { names: label })}</span>
    </span>
  );
}

/** Curseurs des autres personnes sur l'étape affichée (dans le cadre du canevas). */
export function RemoteCursors({
  store,
  stepId,
  names,
  frame,
}: {
  store: PresenceStoreT;
  stepId: string | null;
  names: Names;
  frame: HTMLElement | null;
}) {
  const others = usePresenceLive(store);
  if (!frame) return null;
  const here = others.filter((p) => p.s === stepId && p.c && !isIdle(p));
  if (!here.length) return null;
  return createPortal(
    <>
      {here.map((p) => (
        <span
          key={p.u}
          className={`rcursor rcursor--${avatarTone(p.u)}`}
          style={{ left: `${p.c![0] * 100}%`, top: `${p.c![1] * 100}%` }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24">
            <path d="M4 2l16 9-7 2-3 7z" />
          </svg>
          <b>{firstName(names[p.u] || '?')}</b>
        </span>
      ))}
    </>,
    frame,
  );
}
