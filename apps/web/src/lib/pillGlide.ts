/**
 * MOTION-01 §3 « Onglets » : dans un contrôle segmenté (ou des onglets en pilules), la pastille de
 * l'option choisie glisse depuis l'ancienne option, sur un seul élément, par `transform` seul
 * (200 ms, courbe standard).
 *
 * Au repos rien ne change : l'option choisie garde son propre fond. Pendant le glissement seulement,
 * une pastille temporaire posée derrière la nouvelle option part de la place de l'ancienne, et les
 * options laissent voir à travers elles ; à la fin la pastille est retirée.
 * Ne joue que sur un changement d'option (jamais au premier affichage) et jamais en mouvement réduit.
 */
import { motionMs } from './flip';

const GROUPS = '.fd-segmented, .fd-tabs, .segmented';
const ATTRS = ['aria-selected', 'aria-checked', 'aria-pressed'];
const GLIDING = 'data-pill-gliding';
const TARGET = 'data-pill-to';

const clear = (c: string) => c === 'transparent' || /,\s*0\)$/.test(c);

function glide(group: HTMLElement, from: HTMLElement, to: HTMLElement): void {
  const ms = motionMs();
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const end = getComputedStyle(to);
  if (ms <= 0 || !a.width || !b.width || clear(end.backgroundColor)) return;
  finish(group);
  const pill = document.createElement('span');
  pill.className = 'fd-pill-glide';
  pill.setAttribute('aria-hidden', 'true');
  Object.assign(pill.style, {
    position: 'absolute',
    left: '0px',
    top: '0px',
    width: `${b.width}px`,
    height: `${b.height}px`,
    background: end.backgroundColor,
    borderRadius: end.borderRadius,
    // Au clavier l'ombre de l'option est son trait de focus : il reste sur l'option
    boxShadow: to.matches(':focus-visible') ? 'none' : end.boxShadow,
    pointerEvents: 'none',
    zIndex: '-1',
    transformOrigin: '0 0',
  });
  // Les options non choisies opaques (contrôle carré) : leur fond passe au contrôle le temps du trajet
  const rest = getComputedStyle(from).backgroundColor;
  const own = getComputedStyle(group);
  const inline = {
    position: group.style.position,
    isolation: group.style.isolation,
    bg: group.style.backgroundColor,
  };
  if (own.position === 'static') group.style.position = 'relative';
  group.style.isolation = 'isolate';
  if (clear(own.backgroundColor) && !clear(rest)) group.style.backgroundColor = rest;
  group.appendChild(pill);
  group.setAttribute(GLIDING, '');
  to.setAttribute(TARGET, '');
  const o = pill.getBoundingClientRect();
  pill.style.left = `${b.left - o.left}px`;
  pill.style.top = `${b.top - o.top}px`;
  const anim = pill.animate(
    [
      {
        transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})`,
      },
      { transform: 'none' },
    ],
    { duration: ms, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
  );
  const done = () => {
    if (!pill.isConnected) return;
    pill.remove();
    group.removeAttribute(GLIDING);
    group.querySelectorAll(`[${TARGET}]`).forEach((n) => n.removeAttribute(TARGET));
    group.style.position = inline.position;
    group.style.isolation = inline.isolation;
    group.style.backgroundColor = inline.bg;
  };
  pills.set(group, done);
  anim.onfinish = done;
  anim.oncancel = done;
}

const pills = new WeakMap<HTMLElement, () => void>();
/** Un nouveau choix pendant le trajet : la pastille en cours est retirée, le contrôle retrouve son état. */
function finish(group: HTMLElement): void {
  pills.get(group)?.();
  pills.delete(group);
}

export function installPillGlide(): void {
  if (typeof MutationObserver === 'undefined') return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  new MutationObserver((records) => {
    if (reduce?.matches) return;
    const moves = new Map<HTMLElement, { from: HTMLElement[]; to: HTMLElement[] }>();
    for (const r of records) {
      const el = r.target as HTMLElement;
      const group = el.parentElement;
      if (!group || !group.matches(GROUPS) || !r.attributeName) continue;
      const now = el.getAttribute(r.attributeName);
      const m = moves.get(group) ?? { from: [], to: [] };
      if (r.oldValue === 'true' && now !== 'true') m.from.push(el);
      if (r.oldValue !== 'true' && now === 'true') m.to.push(el);
      moves.set(group, m);
    }
    // Un seul choix quitté et un seul pris : c'est un déplacement (pas une bascule indépendante)
    for (const [group, m] of moves) {
      const [from] = m.from;
      const [to] = m.to;
      if (m.from.length === 1 && m.to.length === 1 && from && to && from !== to && from.isConnected) {
        glide(group, from, to);
      }
    }
  }).observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ATTRS,
    attributeOldValue: true,
  });
}
