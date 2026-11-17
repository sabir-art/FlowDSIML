import '@flowdsiml/ui/tokens.css';
import './style.css';
import { browser } from 'wxt/browser';
import {
  Cake,
  Check,
  House,
  IdCard,
  KeyRound,
  Landmark,
  Lock,
  Mail,
  Phone,
  SquareDashed,
  User,
  createElement as lucideEl,
  createIcons,
  type IconNode,
} from 'lucide';
import { APP_URL } from '@/lib/config';
import { pending, type PendingCapture, type PendingZone } from '@/lib/pending';
import type { PiiType } from '@/lib/pii';
import { sendCaptures } from '@/lib/upload';
import { rs, tr } from '@/lib/reviewStrings';

/**
 * Écran de vérification des flous avant envoi (spec f1-formation §1). Tout se passe dans le
 * navigateur : les captures restent dans IndexedDB jusqu'au clic sur « Flouter et envoyer ».
 * Les extraits viennent de pages tierces : ils ne sont jamais injectés en HTML (textContent).
 */
const ICON: Record<PiiType, IconNode> = {
  name: User,
  nir: IdCard,
  phone: Phone,
  email: Mail,
  address: House,
  birthdate: Cake,
  iban: Landmark,
  identifier: KeyRound,
  zone: SquareDashed,
};
const typeLabel = (t: PiiType) => rs.types[t];
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | undefined> = {},
  ...children: Array<Node | string | null | undefined>
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') el.className = String(v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children) if (c !== null && c !== undefined) el.append(c);
  return el;
}
const icon = (node: IconNode, size = 16) => {
  const svg = lucideEl(node);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  return svg;
};

let captures: PendingCapture[] = [];
let current = 0;
let selected: string | null = null;
let target: { workspaceId: string; title: string } | null = null;
const urls = new Map<string, string>();

const detected = (c: PendingCapture) => c.zones.filter((z) => !z.manual);
const save = (c: PendingCapture) => void pending.put(c);

async function boot() {
  document.documentElement.lang = navigator.language.toLowerCase().startsWith('en') ? 'en' : 'fr';
  document.title = tr('pageTitle');
  $('title').textContent = tr('pageTitle');
  $('rail-title').textContent = tr('captures');
  $('privacy').textContent = tr('privacy');
  $('cancel').textContent = tr('cancel');
  $('blur-all').textContent = tr('blurAll');
  $('add-hint').textContent = tr('addZone');
  $('confirm-text').textContent = tr('cancelConfirm');
  $('confirm-no').textContent = tr('back');
  $('confirm-yes').textContent = tr('cancelYes');
  $('state').textContent = tr('analyzing');
  createIcons({ icons: { Lock }, attrs: { width: 16, height: 16, 'aria-hidden': 'true' } });

  target = ((await browser.storage.local.get('fd.review'))['fd.review'] as typeof target) ?? null;
  const all = await pending.all();
  // Captures avec détections d'abord (spec), numérotation d'origine conservée
  captures = [...all].sort(
    (a, b) => Number(detected(b).length > 0) - Number(detected(a).length > 0) || a.order - b.order,
  );
  for (const c of captures) urls.set(c.id, URL.createObjectURL(c.image));
  $('main').setAttribute('aria-busy', 'false');
  $('state').textContent = tr('done');
  $('state').classList.add('is-done');
  $('subtitle').textContent = tr('subtitle', { demo: target?.title ?? '', count: captures.length });
  if (!captures.length || !target) {
    $('summary').hidden = false;
    $('summary').textContent = tr('empty');
    $('send').setAttribute('disabled', '');
    return;
  }
  const total = captures.reduce((n, c) => n + detected(c).length, 0);
  const withHits = captures.filter((c) => detected(c).length > 0).length;
  const sum = $('summary');
  sum.hidden = false;
  sum.className = `rv-alert ${total ? 'rv-alert--warning' : 'rv-alert--info'}`;
  sum.replaceChildren(
    total
      ? h(
          'p',
          {},
          h('strong', {}, tr('summary', { count: total, captures: withHits })),
          ' ',
          tr('summaryHelp'),
        )
      : h('p', {}, tr('none')),
  );
  render();
}

function render() {
  renderRail();
  renderStage();
  renderPanel();
  const n = captures.length;
  $('send').textContent = tr('send', { count: n });
}

function renderRail() {
  $('rail').replaceChildren(
    ...captures.map((c, i) => {
      const n = detected(c).length;
      const count = n ? tr('captureCount', { count: n }) : tr('captureNone');
      return h(
        'li',
        {},
        h(
          'button',
          {
            type: 'button',
            class: 'rv-thumb',
            'aria-current': i === current ? 'true' : undefined,
            'data-i': String(i),
          },
          h('img', { src: urls.get(c.id) ?? '', alt: '' }),
          h('span', { class: 'rv-thumb__title' }, tr('captureN', { n: c.order + 1 })),
          h(
            'span',
            { class: `rv-pill ${n ? 'rv-pill--danger' : 'rv-pill--ok'}`, 'aria-label': count },
            n ? String(n) : icon(Check, 12),
          ),
        ),
      );
    }),
  );
}

function zoneLabel(z: PendingZone) {
  return tr(z.blur ? 'zoneBlurred' : 'zoneNotBlurred', { type: typeLabel(z.type) });
}

function renderStage() {
  const c = captures[current]!;
  const stage = $('stage');
  stage.style.setProperty('--ratio', `${c.width} / ${c.height}`);
  const img = h('img', {
    src: urls.get(c.id) ?? '',
    alt: tr('captureN', { n: c.order + 1 }),
    draggable: 'false',
  });
  const zones = c.zones.map((z) =>
    h('button', {
      type: 'button',
      class: `rv-zone${z.blur ? ' is-blur' : ' is-off'}${selected === z.id ? ' is-selected' : ''}`,
      style: `left:${z.rect.x * 100}%;top:${z.rect.y * 100}%;width:${z.rect.w * 100}%;height:${z.rect.h * 100}%`,
      'aria-label': zoneLabel(z),
      'aria-pressed': String(z.blur),
      'data-z': z.id,
    }),
  );
  stage.replaceChildren(img, ...zones);
  $('legend').replaceChildren(
    h('li', {}, h('i', { class: 'rv-sw rv-sw--blur' }), tr('legendBlur')),
    h('li', {}, h('i', { class: 'rv-sw rv-sw--off' }), tr('legendDetected')),
    h('li', {}, h('i', { class: 'rv-sw rv-sw--sel' }), tr('legendSelected')),
  );
}

function renderPanel() {
  const c = captures[current]!;
  const n = c.zones.length;
  $('panel-title').textContent =
    `${tr('captureN', { n: c.order + 1 })} · ${n ? tr('captureCount', { count: n }) : tr('captureNone')}`;
  $('zones').replaceChildren(
    ...c.zones.map((z) =>
      h(
        'li',
        { class: `rv-row${selected === z.id ? ' is-selected' : ''}`, 'data-z': z.id, 'data-type': z.type },
        h('span', { class: 'rv-chip' }, icon(ICON[z.type])),
        h(
          'span',
          { class: 'rv-row__text' },
          h('span', { class: 'rv-row__type' }, typeLabel(z.type)),
          z.excerpt ? h('code', { class: 'rv-row__excerpt' }, z.excerpt) : null,
        ),
        h(
          'button',
          {
            type: 'button',
            role: 'switch',
            class: 'rv-switch',
            'aria-checked': String(z.blur),
            'aria-label': tr('toggle', { type: typeLabel(z.type) }),
            'data-toggle': z.id,
          },
          h('span', { class: 'rv-switch__knob' }),
        ),
      ),
    ),
  );
  const off = [...new Set(c.zones.filter((z) => !z.blur).map((z) => typeLabel(z.type)))];
  $('warning').hidden = off.length === 0;
  $('warning').textContent = off.length ? tr('notBlurredWarning', { types: off.join(', ') }) : '';
  ($('blur-all') as HTMLButtonElement).disabled = c.zones.every((z) => z.blur);
}

function toggle(id: string) {
  const c = captures[current]!;
  const z = c.zones.find((x) => x.id === id);
  if (!z) return;
  z.blur = !z.blur; // un par un : jamais de décochage par lot (spec)
  selected = id;
  save(c);
  render();
  ($(`zones`).querySelector(`[data-toggle="${id}"]`) as HTMLElement | null)?.focus();
}

$('rail').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
  if (!b) return;
  current = Number(b.dataset.i);
  selected = null;
  render();
});
$('zones').addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-toggle]');
  if (t) return toggle(t.dataset.toggle!);
  const row = (e.target as HTMLElement).closest<HTMLElement>('[data-z]');
  if (row) {
    selected = row.dataset.z!;
    render();
  }
});
$('zones').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const sw = [...$('zones').querySelectorAll<HTMLElement>('[data-toggle]')];
  const i = sw.indexOf(document.activeElement as HTMLElement);
  const next = sw[Math.min(sw.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))];
  if (next) {
    e.preventDefault();
    next.focus();
    selected = next.dataset.toggle!;
    $('stage')
      .querySelectorAll('.rv-zone')
      .forEach((el) => el.classList.toggle('is-selected', (el as HTMLElement).dataset.z === selected));
  }
});
$('blur-all').addEventListener('click', () => {
  const c = captures[current]!;
  c.zones.forEach((z) => (z.blur = true));
  save(c);
  render();
});

// Zone sur la capture : clic = basculer ; glisser sur l'image = ajouter une zone
let draw: { x0: number; y0: number; el: HTMLElement } | null = null;
const rel = (e: PointerEvent) => {
  const r = $('stage').getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
    y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
  };
};
$('stage').addEventListener('click', (e) => {
  const z = (e.target as HTMLElement).closest<HTMLElement>('[data-z]');
  if (z) toggle(z.dataset.z!);
});
$('stage').addEventListener('pointerdown', (e) => {
  if ((e.target as HTMLElement).closest('[data-z]') || e.button !== 0) return;
  const p = rel(e);
  const el = h('div', { class: 'rv-draft' });
  $('stage').append(el);
  draw = { x0: p.x, y0: p.y, el };
  $('stage').setPointerCapture(e.pointerId);
});
$('stage').addEventListener('pointermove', (e) => {
  if (!draw) return;
  const p = rel(e);
  Object.assign(draw.el.style, {
    left: `${Math.min(p.x, draw.x0) * 100}%`,
    top: `${Math.min(p.y, draw.y0) * 100}%`,
    width: `${Math.abs(p.x - draw.x0) * 100}%`,
    height: `${Math.abs(p.y - draw.y0) * 100}%`,
  });
});
$('stage').addEventListener('pointerup', (e) => {
  if (!draw) return;
  const p = rel(e);
  const rect = {
    x: Math.min(p.x, draw.x0),
    y: Math.min(p.y, draw.y0),
    w: Math.abs(p.x - draw.x0),
    h: Math.abs(p.y - draw.y0),
  };
  draw.el.remove();
  draw = null;
  if (rect.w < 0.01 || rect.h < 0.01) return;
  const c = captures[current]!;
  const z: PendingZone = {
    id: crypto.randomUUID(),
    type: 'zone',
    rect,
    excerpt: '',
    blur: true,
    manual: true,
  };
  c.zones.push(z);
  selected = z.id;
  save(c);
  render();
});

$('cancel').addEventListener('click', () => ($('confirm') as HTMLDialogElement).showModal());
$('confirm-no').addEventListener('click', () => ($('confirm') as HTMLDialogElement).close());
$('confirm-yes').addEventListener('click', async () => {
  await pending.clear();
  await browser.storage.local.remove('fd.review');
  window.close();
});

$('send').addEventListener('click', async () => {
  if (!target) return;
  const send = $('send') as HTMLButtonElement;
  send.disabled = true;
  $('cancel').setAttribute('disabled', '');
  $('error').hidden = true;
  const ordered = [...captures].sort((a, b) => a.order - b.order);
  try {
    const demoId = await sendCaptures(ordered, target, (done) => {
      send.textContent = tr('sending', { done, total: ordered.length });
    });
    await pending.clear();
    await browser.storage.local.remove('fd.review');
    location.href = `${APP_URL.replace(/\/$/, '')}/#/demos/${demoId}/edit`;
  } catch (err) {
    $('error').hidden = false;
    $('error').textContent = (err as Error).message ?? String(err);
    send.disabled = false;
    $('cancel').removeAttribute('disabled');
    send.textContent = tr('send', { count: ordered.length });
  }
});

void boot();
