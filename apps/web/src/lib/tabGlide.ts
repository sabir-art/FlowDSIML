/**
 * MOTION-01 §3 « Onglets » : quand l'onglet actif change, son soulignement glisse depuis l'ancien onglet,
 * sur un seul élément, par `transform: translateX() scaleX()` (200 ms, courbe standard).
 *
 * Au repos rien ne change : chaque onglet garde son soulignement en `border-bottom`. Pendant le
 * glissement seulement, un trait temporaire posé sous le nouvel onglet part de la place de l'ancien,
 * et le soulignement propre de l'onglet reste transparent ; à la fin le trait est retiré.
 * Ne joue que sur un changement d'`aria-selected` (jamais au premier affichage), seulement pour les
 * onglets soulignés (bordure basse d'au moins 2 px), et jamais en mouvement réduit.
 */

const GLIDING = 'data-tab-gliding';

type Box = { left: number; top: number; width: number; height: number };

function underline(tab: HTMLElement): { box: Box; color: string } | null {
  const cs = getComputedStyle(tab);
  const h = parseFloat(cs.borderBottomWidth) || 0;
  if (h < 2 || cs.borderBottomStyle === 'none') return null;
  const r = tab.getBoundingClientRect();
  if (!r.width) return null;
  return { box: { left: r.left, top: r.bottom - h, width: r.width, height: h }, color: cs.borderBottomColor };
}

function duration(): number {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--fd-motion-duration-base').trim();
  const n = parseFloat(v);
  return v.endsWith('ms') ? n : v.endsWith('s') ? n * 1000 : 0;
}

function glide(list: HTMLElement, from: HTMLElement, to: HTMLElement): void {
  const a = from.isConnected ? from.getBoundingClientRect() : null;
  // Le nouvel onglet porte déjà son soulignement final : on lit sa couleur et son épaisseur
  const end = underline(to);
  const ms = duration();
  if (!a || !a.width || !end || ms <= 0) return;
  list.querySelectorAll(':scope > .fd-tab-glide').forEach((n) => n.remove());
  const bar = document.createElement('span');
  bar.className = 'fd-tab-glide';
  bar.setAttribute('aria-hidden', 'true');
  Object.assign(bar.style, {
    position: 'absolute',
    left: '0px',
    top: '0px',
    width: `${end.box.width}px`,
    height: `${end.box.height}px`,
    background: end.color,
    pointerEvents: 'none',
    transformOrigin: 'left center',
  });
  list.appendChild(bar);
  // Repère réel du trait (quel que soit le bloc conteneur), puis placement sous le nouvel onglet
  const o = bar.getBoundingClientRect();
  bar.style.left = `${end.box.left - o.left}px`;
  bar.style.top = `${end.box.top - o.top}px`;
  list.setAttribute(GLIDING, '');
  const dx = a.left - end.box.left;
  const sx = a.width / end.box.width;
  const anim = bar.animate([{ transform: `translateX(${dx}px) scaleX(${sx})` }, { transform: 'none' }], {
    duration: ms,
    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  });
  const done = () => {
    bar.remove();
    if (!list.querySelector(':scope > .fd-tab-glide')) list.removeAttribute(GLIDING);
  };
  anim.onfinish = done;
  anim.oncancel = done;
}

export function installTabGlide(): void {
  if (typeof MutationObserver === 'undefined') return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  new MutationObserver((records) => {
    if (reduce?.matches) return;
    let from: HTMLElement | null = null;
    let to: HTMLElement | null = null;
    for (const r of records) {
      const el = r.target as HTMLElement;
      if (el.getAttribute('role') !== 'tab') continue;
      const now = el.getAttribute('aria-selected');
      if (r.oldValue === 'true' && now !== 'true') from = el;
      if (r.oldValue !== 'true' && now === 'true') to = el;
    }
    if (!from || !to) return;
    const list = to.closest<HTMLElement>('[role="tablist"]');
    if (!list || from.closest('[role="tablist"]') !== list) return;
    glide(list, from, to);
  }).observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-selected'],
    attributeOldValue: true,
  });
}
