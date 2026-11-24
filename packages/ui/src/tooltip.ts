/**
 * L44 : infobulles des boutons à icône, un seul moteur pour l'app, le lecteur et l'extension (sans
 * dépendance à React ni à Preact). Délégation d'événements sur le document : tout bouton ou lien sans
 * texte visible reçoit une infobulle avec son nom accessible ; `data-tip` force une infobulle (libellé),
 * `data-tip-shortcut="Ctrl+Z"` ajoute un raccourci, `data-tip-side` (sur le bouton ou un ancêtre) choisit
 * le côté préféré. L'attribut `title` est repris par l'infobulle (jamais deux bulles).
 */

export type Side = 'top' | 'bottom' | 'left' | 'right';

const GAP = 8; // bulle ↔ bouton
const EDGE = 8; // marge avec les bords de la fenêtre
const ARROW_MIN = 10; // flèche à au moins 10 px des coins
const OPEN_DELAY = 300;
const WARM_MS = 500;
const GRACE_MS = 100;
const LONG_PRESS = 500;
const TOUCH_SHOW = 1500;

/** Boutons et liens ; tout élément qui porte `data-tip` (ex. pastille de variable : son repli). */
const TARGET = 'button, a[href], [role="button"], [data-tip]';
const HIDDEN_TEXT = '.sr-only, .visually-hidden';

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * §3 : côté préféré, sinon côté opposé, puis décalage le long du bord. La flèche reste dans l'axe du
 * centre du bouton (décalage `arrow`, depuis le bord de la bulle). Fonction pure (testée).
 */
export function place(
  anchor: Rect,
  bubble: { width: number; height: number },
  view: { width: number; height: number },
  side: Side,
): { side: Side; left: number; top: number; arrow: number } {
  const fits = (s: Side) =>
    s === 'top'
      ? anchor.top - GAP - bubble.height >= EDGE
      : s === 'bottom'
        ? anchor.top + anchor.height + GAP + bubble.height <= view.height - EDGE
        : s === 'left'
          ? anchor.left - GAP - bubble.width >= EDGE
          : anchor.left + anchor.width + GAP + bubble.width <= view.width - EDGE;
  const opposite: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
  const s = fits(side) || !fits(opposite[side]) ? side : opposite[side];
  const cx = anchor.left + anchor.width / 2;
  const cy = anchor.top + anchor.height / 2;
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, Math.max(min, max)));
  if (s === 'top' || s === 'bottom') {
    const left = clamp(cx - bubble.width / 2, EDGE, view.width - EDGE - bubble.width);
    const top = s === 'top' ? anchor.top - GAP - bubble.height : anchor.top + anchor.height + GAP;
    return { side: s, left, top, arrow: clamp(cx - left, ARROW_MIN, bubble.width - ARROW_MIN) };
  }
  const top = clamp(cy - bubble.height / 2, EDGE, view.height - EDGE - bubble.height);
  const left = s === 'left' ? anchor.left - GAP - bubble.width : anchor.left + anchor.width + GAP;
  return { side: s, left, top, arrow: clamp(cy - top, ARROW_MIN, bubble.height - ARROW_MIN) };
}

const KEY_NAMES: Record<string, string> = {
  control: 'Ctrl',
  meta: '⌘',
  arrowleft: '←',
  arrowright: '→',
  arrowup: '↑',
  arrowdown: '↓',
  escape: 'Esc',
};

/**
 * Touches du raccourci (`data-tip-shortcut`, sinon la première combinaison d'`aria-keyshortcuts`),
 * adaptées au Mac (⌘ pour Ctrl, ⌥ pour Alt).
 */
export function shortcutKeys(spec: string, mac: boolean): string[] {
  return (spec.trim().split(/\s+/)[0] ?? '')
    .split('+')
    .map((k) => k.trim())
    .filter(Boolean)
    .map((k) => KEY_NAMES[k.toLowerCase()] ?? k)
    .map((k) => (mac && /^ctrl$/i.test(k) ? '⌘' : mac && /^alt$/i.test(k) ? '⌥' : k));
}

/** Texte visible du bouton (hors texte réservé aux lecteurs d'écran et icônes). */
function visibleText(el: Element): string {
  let out = '';
  const walk = (n: Node) => {
    if (n.nodeType === 3) out += n.textContent ?? '';
    else if (n.nodeType === 1 && !(n as Element).matches(HIDDEN_TEXT)) n.childNodes.forEach(walk);
  };
  el.childNodes.forEach(walk);
  return out.trim();
}

/** Libellé de l'infobulle d'un élément (vide : pas d'infobulle). Reprend `title` des boutons à icône. */
export function tipLabel(el: HTMLElement): string {
  // Pas d'infobulle quand le nom est déjà visible à côté (ex. pastilles de couleur et leur légende)
  if (el.hasAttribute('data-no-tip')) return '';
  if (el.dataset.tip) return el.dataset.tip;
  const text = visibleText(el);
  const title = el.getAttribute('title');
  // Bouton avec texte : son `title` éventuel reste une précision du navigateur (pas d'infobulle)
  if (text) return '';
  if (title !== null) {
    el.removeAttribute('title');
    if (title.trim()) el.dataset.tipTitle = title.trim();
  }
  const label = el.getAttribute('aria-label')?.trim() || el.dataset.tipTitle || '';
  // Nom accessible conservé quand il ne venait que de `title`
  if (label && !el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby'))
    el.setAttribute('aria-label', label);
  return label;
}

/** Retire les `title` des boutons à icône d'un sous-arbre (repris par l'infobulle). */
function sweep(root: ParentNode) {
  if (root instanceof Element && root.matches(`:is(${TARGET})[title]`)) tipLabel(root as HTMLElement);
  root.querySelectorAll<HTMLElement>(`:is(${TARGET})[title]`).forEach((el) => tipLabel(el));
}

export interface TooltipOptions {
  /** Document observé (celui de l'iframe du lecteur, de la popup…). */
  doc?: Document;
  /** Conteneur du portail (par défaut le corps du document). */
  container?: HTMLElement;
}

let seq = 0;

/** Installe les infobulles sur un document ; renvoie la fonction de désinstallation. */
export function installTooltips({ doc = document, container }: TooltipOptions = {}): () => void {
  const win = doc.defaultView ?? window;
  const mac = /Mac|iPhone|iPad/.test(win.navigator.platform || win.navigator.userAgent);
  let bubble: HTMLDivElement | null = null;
  let anchor: HTMLElement | null = null;
  let openTimer = 0;
  /** Élément cliqué : pas d'infobulle au survol tant que le pointeur ne l'a pas quitté. */
  let pressed: HTMLElement | null = null;
  let closeTimer = 0;
  let pressTimer = 0;
  let lastClosed = 0;
  let suppressClick = false;
  // Focus donné par la navigation au clavier (Tab, flèches) : seule une tabulation ouvre l'infobulle,
  // jamais un focus posé par le code (ouverture ou fermeture d'une modale, retour au bouton d'origine)
  let navKeyAt = -Infinity;

  const clearTimers = () => {
    win.clearTimeout(openTimer);
    win.clearTimeout(closeTimer);
  };

  function close() {
    clearTimers();
    if (!bubble || !anchor) return;
    if (anchor.getAttribute('aria-describedby') === bubble.id) anchor.removeAttribute('aria-describedby');
    bubble.remove();
    bubble = null;
    anchor = null;
    lastClosed = Date.now();
  }

  function position() {
    if (!bubble || !anchor) return;
    const r = anchor.getBoundingClientRect();
    const vw = doc.documentElement.clientWidth;
    const vh = doc.documentElement.clientHeight;
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw || !anchor.isConnected) return close();
    const side = (anchor.closest('[data-tip-side]')?.getAttribute('data-tip-side') as Side) || 'top';
    const p = place(
      r,
      { width: bubble.offsetWidth, height: bubble.offsetHeight },
      { width: vw, height: vh },
      side,
    );
    bubble.dataset.side = p.side;
    bubble.style.left = `${Math.round(p.left)}px`;
    bubble.style.top = `${Math.round(p.top)}px`;
    bubble.style.setProperty('--fd-tip-arrow', `${Math.round(p.arrow)}px`);
  }

  function open(el: HTMLElement) {
    clearTimers();
    // Ouverture différée : le déclencheur a pu disparaître entre-temps
    if (!el.isConnected) return;
    const label = tipLabel(el);
    if (!label) return;
    if (anchor === el && bubble) return;
    close();
    const b = doc.createElement('div');
    b.className = 'fd-tooltip';
    b.id = `fd-tip-${++seq}`;
    b.setAttribute('role', 'tooltip');
    if (el.closest('.is-dark, [data-theme="dark"]') || doc.documentElement.dataset.theme === 'dark')
      b.classList.add('fd-tooltip--dark');
    const text = doc.createElement('span');
    text.textContent = label;
    b.append(text);
    const spec = el.dataset.tipShortcut ?? el.getAttribute('aria-keyshortcuts');
    if (spec) {
      const keys = shortcutKeys(spec, mac);
      const kbd = doc.createElement('span');
      kbd.className = 'fd-tooltip__keys';
      // Pastilles des touches nommées par l'énoncé du raccourci (role img : aria-label permis)
      kbd.setAttribute('role', 'img');
      kbd.setAttribute(
        'aria-label',
        `${/^en/.test(doc.documentElement.lang) ? 'shortcut' : 'raccourci'} ${keys.join(' ')}`,
      );
      for (const k of keys) {
        const key = doc.createElement('kbd');
        key.textContent = k;
        key.setAttribute('aria-hidden', 'true');
        kbd.append(key);
      }
      b.append(kbd);
      // Le raccourci ajoute une information : lue comme description
      el.setAttribute('aria-describedby', b.id);
    } else {
      // Libellé seul : déjà le nom du bouton, jamais lu deux fois
      b.setAttribute('aria-hidden', 'true');
    }
    b.addEventListener('pointerenter', () => win.clearTimeout(closeTimer));
    b.addEventListener('pointerleave', () => scheduleClose());
    (container ?? doc.body).append(b);
    bubble = b;
    anchor = el;
    position();
  }

  function scheduleClose() {
    win.clearTimeout(closeTimer);
    closeTimer = win.setTimeout(() => {
      if (anchor && anchor === doc.activeElement && anchor.matches(':focus-visible')) return;
      close();
    }, GRACE_MS);
  }

  const targetOf = (e: Event): HTMLElement | null => {
    const t = e.target;
    if (!(t instanceof win.Element)) return null;
    const el = t.closest(TARGET) as HTMLElement | null;
    if (!el || (el as HTMLButtonElement).disabled) return null;
    return el;
  };

  const onOver = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const el = targetOf(e);
    if (!el) return;
    if (el === anchor) return win.clearTimeout(closeTimer);
    if (el === pressed || !tipLabel(el)) return;
    win.clearTimeout(openTimer);
    const warm = bubble !== null || Date.now() - lastClosed < WARM_MS;
    if (warm) open(el);
    else openTimer = win.setTimeout(() => open(el), OPEN_DELAY);
  };
  const onOut = (e: PointerEvent) => {
    const el = targetOf(e);
    if (!el) return;
    const to = e.relatedTarget as Node | null;
    if (to && el.contains(to)) return;
    if (el === pressed) pressed = null;
    win.clearTimeout(openTimer);
    if (el === anchor) scheduleClose();
  };
  const onFocusIn = (e: FocusEvent) => {
    const el = targetOf(e);
    if (el && el.matches(':focus-visible') && win.performance.now() - navKeyAt < 300) open(el);
  };
  const onFocusOut = (e: FocusEvent) => {
    if (targetOf(e) === anchor) close();
  };
  const onKey = (e: KeyboardEvent) => {
    if (/^(Tab|Arrow(Up|Down|Left|Right)|Home|End)$/.test(e.key)) navKeyAt = win.performance.now();
    if (e.key === 'Escape' && bubble) {
      // Infobulle du bouton qui a le focus : Échap ne ferme qu'elle (pas la modale ou le panneau parent).
      // Infobulle ouverte au survol alors que le focus est ailleurs : elle se ferme, mais la touche
      // continue son chemin. Sinon un pointeur resté sur un bouton à icône empêchait Échap d'atteindre la
      // fenêtre (pas de demande de confirmation pendant un envoi).
      const own = anchor === doc.activeElement;
      close();
      if (own) {
        e.stopPropagation();
        e.preventDefault();
      }
    }
  };
  const onDown = (e: PointerEvent) => {
    // Un clic annule l'ouverture en attente et tient l'infobulle du bouton cliqué fermée jusqu'à ce que
    // le pointeur le quitte : sinon elle réapparaît (le bouton change de libellé ou de place) et absorbe
    // le premier Échap (ex. tiroir Dossiers, retours client 21/11 §2)
    win.clearTimeout(openTimer);
    if (e.pointerType !== 'touch') pressed = targetOf(e);
    if (bubble && targetOf(e) === anchor) close();
    if (e.pointerType !== 'touch') return;
    const el = targetOf(e);
    if (!el || !tipLabel(el)) return;
    win.clearTimeout(pressTimer);
    pressTimer = win.setTimeout(() => {
      suppressClick = true;
      open(el);
      closeTimer = win.setTimeout(close, TOUCH_SHOW);
    }, LONG_PRESS);
  };
  const onUp = () => win.clearTimeout(pressTimer);
  const onClick = (e: MouseEvent) => {
    // Appui long : infobulle sans déclencher l'action
    if (suppressClick) {
      suppressClick = false;
      e.preventDefault();
      e.stopPropagation();
    }
  };
  const onContext = (e: Event) => {
    if (suppressClick) e.preventDefault();
  };
  const onScroll = () => close();
  const onResize = () => position();

  sweep(doc);
  const observer = new win.MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'attributes') sweep(r.target as Element);
      else r.addedNodes.forEach((n) => n.nodeType === 1 && sweep(n as Element));
    }
    // Déclencheur retiré de la page (toast fermé, menu démonté) : aucun pointerout n'arrive, l'infobulle
    // part avec lui au lieu de rester orpheline
    if (anchor && !anchor.isConnected) close();
    if (pressed && !pressed.isConnected) pressed = null;
  });
  observer.observe(doc.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['title'],
  });
  doc.addEventListener('pointerover', onOver, true);
  doc.addEventListener('pointerout', onOut, true);
  doc.addEventListener('focusin', onFocusIn, true);
  doc.addEventListener('focusout', onFocusOut, true);
  doc.addEventListener('keydown', onKey, true);
  doc.addEventListener('pointerdown', onDown, true);
  doc.addEventListener('pointerup', onUp, true);
  doc.addEventListener('pointercancel', onUp, true);
  doc.addEventListener('click', onClick, true);
  doc.addEventListener('contextmenu', onContext, true);
  win.addEventListener('scroll', onScroll, true);
  win.addEventListener('resize', onResize);
  return () => {
    observer.disconnect();
    close();
    win.clearTimeout(pressTimer);
    doc.removeEventListener('pointerover', onOver, true);
    doc.removeEventListener('pointerout', onOut, true);
    doc.removeEventListener('focusin', onFocusIn, true);
    doc.removeEventListener('focusout', onFocusOut, true);
    doc.removeEventListener('keydown', onKey, true);
    doc.removeEventListener('pointerdown', onDown, true);
    doc.removeEventListener('pointerup', onUp, true);
    doc.removeEventListener('pointercancel', onUp, true);
    doc.removeEventListener('click', onClick, true);
    doc.removeEventListener('contextmenu', onContext, true);
    win.removeEventListener('scroll', onScroll, true);
    win.removeEventListener('resize', onResize);
  };
}
