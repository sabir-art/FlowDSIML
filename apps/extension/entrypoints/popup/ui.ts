/**
 * Contrôles du popup (EXT-02 §1, COMP-01) : liste déroulante (bouton + listbox), interrupteur
 * (`role="switch"`) et aide dépliée sous une ligne. Aucun contrôle natif du navigateur.
 */
import { Check, ChevronDown, createElement, type IconNode } from 'lucide';

export function icon(node: IconNode, size = 16): SVGElement {
  const svg = createElement(node);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('aria-hidden', 'true');
  return svg as unknown as SVGElement;
}

export type Option = {
  value: string;
  label: string;
  /** Ligne de description (liste décrite). */
  desc?: string;
  icon?: IconNode;
  /** Option visible mais non sélectionnable (« Bientôt », règle de l'espace). */
  disabled?: boolean;
  /** Pastille à droite d'une option désactivée (« Bientôt »). */
  pill?: string;
};

export type Select = {
  readonly value: string;
  set(value: string, notify?: boolean): void;
  setOptions(options: Option[]): void;
  options(): Option[];
  readonly button: HTMLButtonElement;
};

let seq = 0;

/**
 * Liste déroulante : le bouton porte l'option choisie ; ouverte, la liste prend le focus
 * (flèches, Début, Fin, Entrée, Échap). Une option désactivée reste lisible et focalisable.
 */
export function createSelect(
  button: HTMLButtonElement,
  cfg: {
    options: Option[];
    value: string;
    described?: boolean;
    lead?: IconNode;
    onChange?: (v: string) => void;
  },
): Select {
  let options = cfg.options;
  let value = cfg.value;
  const id = `sel-${++seq}`;
  const list = document.createElement('ul');
  list.className = `sel-list${cfg.described ? ' sel-list--desc' : ''}`;
  list.id = id;
  list.setAttribute('role', 'listbox');
  list.tabIndex = -1;
  list.hidden = true;
  const labelledBy = button.getAttribute('aria-labelledby');
  if (labelledBy) list.setAttribute('aria-labelledby', labelledBy.split(' ')[0]!);
  button.classList.add('sel');
  if (cfg.described) button.classList.add('sel--desc');
  button.type = 'button';
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', id);
  button.after(list);

  let active = -1;
  const current = () => options.find((o) => o.value === value) ?? options[0];

  function paintButton() {
    const o = current();
    const text = document.createElement('span');
    text.className = 'sel__text';
    const b = document.createElement('b');
    b.textContent = o?.label ?? '';
    text.append(b);
    if (cfg.described && o?.desc) {
      const small = document.createElement('small');
      small.textContent = o.desc;
      text.append(small);
    }
    const lead = o?.icon ?? cfg.lead;
    button.replaceChildren(...(lead ? [icon(lead, cfg.described ? 20 : 16)] : []), text, icon(ChevronDown));
  }
  function paintList() {
    list.replaceChildren(
      ...options.map((o, i) => {
        const li = document.createElement('li');
        li.id = `${id}-${i}`;
        li.dataset.value = o.value;
        li.className = 'sel-opt';
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', String(o.value === value));
        if (o.disabled) li.setAttribute('aria-disabled', 'true');
        if (o.icon) li.append(icon(o.icon, 20));
        const b = document.createElement('b');
        b.textContent = o.label;
        li.append(b);
        if (o.desc) {
          const small = document.createElement('small');
          small.textContent = o.desc;
          li.append(small);
        }
        if (o.disabled && o.pill) {
          const pill = document.createElement('span');
          pill.className = 'pill';
          pill.textContent = o.pill;
          li.append(pill);
        } else if (o.value === value) {
          const ck = icon(Check);
          ck.classList.add('ck');
          li.append(ck);
        }
        li.addEventListener('click', () => choose(i));
        li.addEventListener('pointermove', () => setActive(i));
        return li;
      }),
    );
  }
  function setActive(i: number) {
    active = i;
    for (const [k, li] of [...list.children].entries()) li.classList.toggle('is-active', k === i);
    const li = list.children[i] as HTMLElement | undefined;
    if (li) {
      list.setAttribute('aria-activedescendant', li.id);
      li.scrollIntoView({ block: 'nearest' });
    } else list.removeAttribute('aria-activedescendant');
  }
  function open() {
    paintList();
    list.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    // Le popup grandit pour montrer la liste (600 px au plus, limite de Chrome), sinon la liste défile
    const top = button.getBoundingClientRect().bottom + 4;
    const wanted = Math.min(list.scrollHeight + 2, 600 - top - 8);
    list.style.maxHeight = `${Math.max(wanted, 120)}px`;
    document.body.style.minHeight = `${Math.min(600, top + Math.max(wanted, 120) + 8)}px`;
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    list.focus();
  }
  function close(focus = true) {
    if (list.hidden) return;
    list.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    document.body.style.minHeight = '';
    if (focus) button.focus();
  }
  function choose(i: number) {
    const o = options[i];
    if (!o || o.disabled) return;
    const changed = o.value !== value;
    value = o.value;
    paintButton();
    close();
    if (changed) cfg.onChange?.(value);
  }
  button.addEventListener('click', () => (list.hidden ? open() : close()));
  button.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (list.hidden) open();
    }
  });
  list.addEventListener('keydown', (e) => {
    const n = options.length;
    if (e.key === 'ArrowDown') setActive(Math.min(n - 1, active + 1));
    else if (e.key === 'ArrowUp') setActive(Math.max(0, active - 1));
    else if (e.key === 'Home') setActive(0);
    else if (e.key === 'End') setActive(n - 1);
    else if (e.key === 'Enter' || e.key === ' ') choose(active);
    else if (e.key === 'Escape') close();
    else if (e.key === 'Tab') return close(false);
    else return;
    e.preventDefault();
    e.stopPropagation();
  });
  list.addEventListener('focusout', (e) => {
    if (e.relatedTarget !== button) close(false);
  });
  paintButton();
  return {
    get value() {
      return value;
    },
    set(v, notify = false) {
      if (!options.some((o) => o.value === v) || v === value) return;
      value = v;
      paintButton();
      if (notify) cfg.onChange?.(value);
    },
    setOptions(next) {
      options = next;
      if (!options.some((o) => o.value === value)) value = options.find((o) => !o.disabled)?.value ?? '';
      paintButton();
      if (!list.hidden) paintList();
    },
    options: () => options,
    button,
  };
}

export type Switch = { checked: boolean; readonly button: HTMLButtonElement };

/** Interrupteur : `<button role="switch">`, Espace et Entrée basculent. */
export function createSwitch(
  button: HTMLButtonElement,
  cfg: { checked?: boolean; onChange?: (on: boolean) => void },
): Switch {
  button.type = 'button';
  button.classList.add('sw');
  button.setAttribute('role', 'switch');
  const paint = (on: boolean) => button.setAttribute('aria-checked', String(on));
  paint(!!cfg.checked);
  button.addEventListener('click', () => {
    const on = button.getAttribute('aria-checked') !== 'true';
    paint(on);
    cfg.onChange?.(on);
  });
  return {
    get checked() {
      return button.getAttribute('aria-checked') === 'true';
    },
    set checked(on: boolean) {
      paint(on);
    },
    button,
  };
}

/**
 * Aides des lignes (« ? ») : la phrase se déplie sous la ligne, dans le flux. Une seule aide ouverte
 * à la fois : en ouvrir une ferme l'autre.
 */
export function installHelps(root: HTMLElement): void {
  const buttons = () => [...root.querySelectorAll<HTMLButtonElement>('button.q[aria-controls]')];
  const set = (b: HTMLButtonElement, on: boolean) => {
    b.setAttribute('aria-expanded', String(on));
    const p = document.getElementById(b.getAttribute('aria-controls')!);
    if (p) p.hidden = !on;
  };
  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button.q[aria-controls]');
    if (!b) return;
    const on = b.getAttribute('aria-expanded') !== 'true';
    for (const other of buttons()) set(other, other === b && on);
  });
}
