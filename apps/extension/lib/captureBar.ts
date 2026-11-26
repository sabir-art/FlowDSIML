import { browser } from 'wxt/browser';
import { Check, Code, Pause, Undo2, createElement, type IconNode } from 'lucide';
import { strings as s } from './i18n';

/**
 * L60 §2 : une seule barre de capture, la même forme dans les 4 modes. Capsule de 48 px, fond sombre fixe
 * (lisible sur tous les sites), contrôles de 36 px sur la même ligne. De gauche à droite : état (point,
 * nom du mode, pastille « 3 étapes »), partie propre au mode, filet, Pause, Terminer.
 * En pause : point orange, « En pause », « Vos clics ne sont pas capturés », « Reprendre » à la place de
 * Pause ; raccourci Alt + Maj + P.
 */
/**
 * Couleurs de la barre et de la carte en variables (L64 §4) : la barre claire ne change que ces variables.
 */
export const BAR_VARS = `
  :host{--fdb-bg:#16181d;--fdb-fg:#fff;--fdb-muted:#b8bcc6;--fdb-line:rgba(255,255,255,.18);
    --fdb-pill:rgba(255,255,255,.14);--fdb-ctl:rgba(255,255,255,.08);--fdb-ctl-hover:rgba(255,255,255,.16);
    --fdb-seg-on-bg:#fff;--fdb-seg-on-fg:#16181d;--fdb-fin-bg:#fff;--fdb-fin-fg:#16181d;--fdb-fin-hover:#e7e5e4;
    --fdb-thumb:#2b2f38;--fdb-shadow:0 12px 32px rgba(0,0,0,.28),0 2px 6px rgba(0,0,0,.2)}
`;

export const BAR_CSS = `
  ${BAR_VARS}
  .bar{box-sizing:border-box;height:48px;max-width:min(720px,calc(100vw - 32px));display:flex;align-items:center;
    gap:8px;padding:6px 6px 6px 16px;border-radius:999px;background:var(--fdb-bg);color:var(--fdb-fg);
    font:500 13px/1.2 system-ui,sans-serif;box-shadow:var(--fdb-shadow);cursor:grab;user-select:none;white-space:nowrap}
  .bar .st,.bar .mid{display:flex;align-items:center;gap:8px}
  .bar .st,.bar > button,.bar .sep{flex:none}
  .bar .mid{min-width:0}
  .bar .dot{width:10px;height:10px;border-radius:50%;background:#e5484d;flex:none}
  .bar.is-paused .dot{background:#f5a524}
  .bar .nm{font-weight:600}
  .bar .pill{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:999px;
    background:var(--fdb-pill);font-variant-numeric:tabular-nums}
  .bar .note{color:var(--fdb-muted)}
  /* Une seule puce à la fois, coupée au-delà de 200 px (recette l60-lot-d) */
  .bar .chip{max-width:200px;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto;min-width:0}
  .bar .sep{width:1px;height:24px;background:var(--fdb-line)}
  .bar button{box-sizing:border-box;height:36px;display:inline-flex;align-items:center;justify-content:center;gap:6px;
    padding:0 12px;border:0;border-radius:999px;background:var(--fdb-ctl);color:var(--fdb-fg);font:inherit;cursor:pointer}
  .bar button:hover{background:var(--fdb-ctl-hover)}
  .bar button:focus-visible{outline:3px solid #6cb8e6;outline-offset:2px}
  .bar button.ico{width:36px;padding:0}
  .bar .fin{background:var(--fdb-fin-bg);color:var(--fdb-fin-fg)}
  .bar .fin:hover{background:var(--fdb-fin-hover)}
  .bar svg{flex:none}
  /* L60 §3 : Terminer, la barre devient le panneau d'envoi */
  .snd{box-sizing:border-box;width:min(380px,calc(100vw - 32px));display:grid;gap:8px;padding:14px 16px;
    border-radius:16px;background:var(--fdb-bg);color:var(--fdb-fg);font:500 13px/1.35 system-ui,sans-serif;
    box-shadow:var(--fdb-shadow)}
  .snd b{font-weight:600;font-variant-numeric:tabular-nums}
  .snd .pb{height:6px;border-radius:999px;background:var(--fdb-pill);overflow:hidden}
  .snd .pb i{display:block;height:100%;width:0;border-radius:inherit;background:var(--fdb-fin-bg);
    transition:width .2s ease-out}
  @media (prefers-reduced-motion:reduce){.snd .pb i{transition:none}}
  .snd small{font-size:12px;color:var(--fdb-muted)}
`;

/** Barre : `middle` est la partie propre au mode (segmenté, « Ajouter cette page », micro…). */
export function barMarkup(o: { label: string; name: string; middle: string }): string {
  return `
    <div class="bar" role="toolbar" aria-label="${o.label}">
      <span class="st"><span class="dot" aria-hidden="true"></span><span class="nm">${o.name}</span
        ><span class="pill"></span></span>
      <span class="mid">${o.middle}</span>
      <span class="note pz" hidden>${s.barPausedNote}</span>
      <span class="sep" aria-hidden="true"></span>
      <button type="button" class="ico pause" title="${s.shortcutPause}"></button>
      <button type="button" class="fin" title="${s.shortcutStop}"></button>
    </div>
    <div class="snd" role="status" hidden>
      <b class="snd-t"></b>
      <span class="pb" role="progressbar" aria-valuemin="0"><i></i></span>
      <small>${s.sendingHelp}</small>
    </div>`;
}

export function barIcon(node: IconNode, size = 16): SVGElement {
  const svg = createElement(node);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  return svg;
}

export type Bar = {
  bar: HTMLElement;
  setCount(text: string): void;
  setPaused(paused: boolean): void;
  setName(name: string): void;
  /** L60 §3 : Terminer, la barre devient le panneau d'envoi (« Envoi des étapes… 5 / 8 »). */
  sending(done: number, total: number): void;
  readonly paused: boolean;
  readonly isSending: boolean;
};

/**
 * Câble la barre : Pause (et Alt + Maj + P si `shortcut`), Terminer, déplacement à la souris de `mover`.
 * `onPause` bascule la pause et rend le nouvel état.
 */
export function wireBar(
  root: ShadowRoot,
  o: {
    name: string;
    mover: HTMLElement;
    onPause: () => Promise<boolean>;
    onStop: () => void;
    shortcut?: boolean;
  },
): Bar {
  const $ = <T extends Element>(q: string) => root.querySelector(q) as T;
  const bar = $<HTMLElement>('.bar');
  const nm = $<HTMLElement>('.nm');
  const pill = $<HTMLElement>('.pill');
  const mid = $<HTMLElement>('.mid');
  const pz = $<HTMLElement>('.pz');
  const pauseBtn = $<HTMLButtonElement>('.pause');
  const fin = $<HTMLButtonElement>('.fin');
  fin.append(barIcon(Check), s.finish);
  let paused = false;
  let sendingNow = false;
  let name = o.name;
  function setPaused(p: boolean) {
    paused = p;
    bar.classList.toggle('is-paused', p);
    nm.textContent = p ? s.barPaused : name;
    mid.hidden = p;
    pz.hidden = !p;
    pauseBtn.replaceChildren(p ? s.resume : barIcon(Pause));
    pauseBtn.classList.toggle('ico', !p);
    if (p) pauseBtn.removeAttribute('aria-label');
    else pauseBtn.setAttribute('aria-label', s.pause);
  }
  setPaused(false);
  let busy = false;
  const toggle = () => {
    if (busy) return;
    busy = true;
    void o
      .onPause()
      .then(setPaused)
      .catch(() => undefined)
      .finally(() => (busy = false));
  };
  pauseBtn.addEventListener('click', toggle);
  fin.addEventListener('click', () => o.onStop());
  if (o.shortcut) {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.code === 'KeyP') {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }
    };
    document.addEventListener('keydown', onKey, true);
  }
  // Déplacement à la souris (la barre ne cache jamais le contenu en permanence)
  let drag: { x: number; y: number; left: number; top: number } | null = null;
  bar.addEventListener('pointerdown', (e) => {
    if ((e.target as Element).closest('button, [role=radiogroup]')) return;
    const r = o.mover.getBoundingClientRect();
    drag = { x: e.clientX, y: e.clientY, left: r.left, top: r.top };
    bar.setPointerCapture(e.pointerId);
  });
  bar.addEventListener('pointermove', (e) => {
    if (!drag) return;
    o.mover.style.transform = 'none';
    o.mover.style.bottom = 'auto';
    o.mover.style.left = `${Math.max(0, drag.left + e.clientX - drag.x)}px`;
    o.mover.style.top = `${Math.max(0, drag.top + e.clientY - drag.y)}px`;
  });
  bar.addEventListener('pointerup', () => (drag = null));
  return {
    bar,
    setCount: (t) => (pill.textContent = t),
    setPaused,
    setName: (n) => {
      name = n;
      if (!paused) nm.textContent = n;
    },
    get paused() {
      return paused;
    },
    get isSending() {
      return !!sendingNow;
    },
    sending(done, total) {
      sendingNow = true;
      bar.hidden = true;
      const box = $<HTMLElement>('.snd');
      box.hidden = false;
      box.querySelector('.snd-t')!.textContent = s.sendingSteps
        .replace('{{done}}', String(done))
        .replace('{{total}}', String(total));
      const pb = box.querySelector<HTMLElement>('.pb')!;
      pb.setAttribute('aria-valuemax', String(total));
      pb.setAttribute('aria-valuenow', String(done));
      pb.setAttribute(
        'aria-label',
        s.sendingSteps.replace('{{done}}', String(done)).replace('{{total}}', String(total)),
      );
      pb.querySelector('i')!.style.width = `${total ? Math.round((done / total) * 100) : 0}%`;
    },
  };
}

/** Pause des captures (clics, HTML) : bascule dans le service worker, nouvel état relu. */
export async function togglePause(): Promise<boolean> {
  await browser.runtime.sendMessage({ type: 'fd:pause' });
  const st = (await browser.runtime.sendMessage({ type: 'fd:status' })) as { paused?: boolean } | null;
  return !!st?.paused;
}

/**
 * L60 §2 : retour à chaque capture. Carte sombre 8 px au-dessus de la barre pendant 2 s : miniature
 * (72 × 45), « Étape 3 capturée », libellé du clic, « Annuler » (retire l'étape). Annoncée poliment.
 */
export const CARD_CSS = `
  .card{box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:8px;border-radius:12px;
    background:var(--fdb-bg);color:var(--fdb-fg);font:500 13px/1.3 system-ui,sans-serif;
    max-width:min(440px,calc(100vw - 32px));box-shadow:var(--fdb-shadow);white-space:nowrap}
  .card .th{width:72px;height:45px;flex:none;display:grid;place-items:center;border-radius:6px;object-fit:cover;
    background:var(--fdb-thumb);color:var(--fdb-muted)}
  .card .tx{min-width:0;display:grid;gap:2px}
  .card b{font-weight:600}
  .card small{font-size:12px;color:var(--fdb-muted);overflow:hidden;text-overflow:ellipsis}
  .card button{box-sizing:border-box;height:32px;display:inline-flex;align-items:center;gap:6px;padding:0 12px;
    margin-left:auto;border:0;border-radius:999px;background:var(--fdb-ctl);color:var(--fdb-fg);font:inherit;
    cursor:pointer}
  .card button:hover{background:var(--fdb-ctl-hover)}
  .card button:focus-visible{outline:3px solid #6cb8e6;outline-offset:2px}
`;

export function cardMarkup(): string {
  return `
    <div class="card" role="status" hidden>
      <span class="th" aria-hidden="true"></span>
      <span class="tx"><b></b><small></small></span>
      <button type="button" class="undo"></button>
    </div>`;
}

export type StepCard = { n: number; label: string; thumb?: string; id?: string };

export function wireCard(root: ShadowRoot, o: { onUndo: (c: StepCard) => Promise<unknown> }) {
  const card = root.querySelector<HTMLElement>('.card')!;
  const title = card.querySelector('b')!;
  const sub = card.querySelector('small')!;
  const undo = card.querySelector<HTMLButtonElement>('.undo')!;
  undo.append(barIcon(Undo2), s.cardUndo);
  let cur: StepCard | null = null;
  let timer = 0;
  let hold = false;
  const hide = () => {
    clearTimeout(timer);
    card.hidden = true;
    cur = null;
  };
  const arm = () => {
    clearTimeout(timer);
    if (!hold) timer = window.setTimeout(hide, 2000);
  };
  // Survol ou focus : la carte reste le temps de viser « Annuler »
  card.addEventListener('pointerenter', () => ((hold = true), clearTimeout(timer)));
  card.addEventListener('pointerleave', () => ((hold = false), arm()));
  card.addEventListener('focusin', () => ((hold = true), clearTimeout(timer)));
  card.addEventListener('focusout', () => ((hold = false), arm()));
  undo.addEventListener('click', () => {
    if (!cur) return;
    const c = cur;
    hide();
    void o.onUndo(c);
  });
  return {
    show(c: StepCard) {
      cur = c;
      // Miniature de la capture ; une page HTML n'a pas d'image : icône Code
      let next: HTMLElement;
      if (c.thumb) {
        const img = document.createElement('img');
        img.alt = '';
        img.src = c.thumb;
        next = img;
      } else {
        next = document.createElement('span');
        next.append(barIcon(Code, 20));
      }
      next.className = 'th';
      next.setAttribute('aria-hidden', 'true');
      card.querySelector('.th')!.replaceWith(next);
      title.textContent = s.cardCaptured.replace('{{n}}', String(c.n));
      sub.textContent = c.label;
      sub.hidden = !c.label;
      card.hidden = false;
      arm();
    },
    hide,
  };
}

/** Anneau rouge sur le point cliqué pendant 400 ms (rien en mouvement réduit). Hors des captures. */
export function ring(x: number, y: number): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const el = document.createElement('div');
  el.setAttribute('data-fd-ui', '');
  el.setAttribute('data-fd-ring', '');
  el.style.cssText =
    `position:fixed;left:${x - 18}px;top:${y - 18}px;width:36px;height:36px;box-sizing:border-box;` +
    'border:3px solid #e5484d;border-radius:50%;pointer-events:none;z-index:2147483647;' +
    'transition:transform .4s ease-out,opacity .4s ease-out';
  document.documentElement.append(el);
  requestAnimationFrame(() => {
    el.style.transform = 'scale(1.6)';
    el.style.opacity = '0';
  });
  setTimeout(() => el.remove(), 450);
}
