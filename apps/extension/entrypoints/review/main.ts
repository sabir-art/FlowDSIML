import '@flowdsiml/ui/tokens.css';
import './style.css';
import { browser } from 'wxt/browser';
import {
  Cake,
  Check,
  Crop,
  Images,
  Info,
  Monitor,
  SquareMousePointer,
  House,
  IdCard,
  KeyRound,
  Landmark,
  Lock,
  EyeOff,
  Mail,
  Phone,
  TriangleAlert,
  ScanSearch,
  Send,
  SquareDashed,
  User,
  createElement as lucideEl,
  createIcons,
  type IconNode,
} from 'lucide';
import { APP_URL } from '@/lib/config';
import { APP_NAME } from '@flowdsiml/core';
import { pending, type PendingCapture, type PendingZone } from '@/lib/pending';
import type { PiiType } from '@/lib/pii';
import { sendCaptures } from '@/lib/upload';
import type { FillTarget } from '@/lib/messages';
import { rs, tr } from '@/lib/reviewStrings';
import { strings } from '@/lib/i18n';
import { defaultHotspotTitle } from '@/lib/geometry';
import { frameFor, type FrameMode } from '@/lib/frame';
import { ADD_KEY, type AddTarget } from '@/lib/external';
import { supabase } from '@/lib/supabase';
import { followAppearance } from '@/lib/appearance';

// L64 §4 : apparence choisie dans les réglages (Système, Clair, Sombre)
followAppearance();

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
let target: {
  workspaceId: string;
  title: string;
  device?: 'desktop' | 'mobile';
  viewport?: { w: number; h: number } | null;
  /** L26-04 : capture guidée d'une démo créée depuis un modèle. */
  fill?: FillTarget | null;
  /** EXT-02 §8 : ajout à la démo ouverte dans l'éditeur, après l'étape choisie. */
  addTo?: { demoId: string; title: string; after: { n: number; title: string } | null } | null;
} | null = null;
/** Libellé du bouton principal : « Flouter et envoyer n captures », ou « Ajouter n étapes » (§8.4). */
const sendLabel = (n: number) =>
  target?.addTo
    ? (n === 1 ? strings.addSend_one : strings.addSend_other).replace('{{count}}', String(n))
    : tr('send', { count: n });
const urls = new Map<string, string>();

const detected = (c: PendingCapture) => c.zones.filter((z) => !z.manual);
const save = (c: PendingCapture) => void pending.put(c);

async function boot() {
  document.documentElement.lang = navigator.language.toLowerCase().startsWith('en') ? 'en' : 'fr';
  document.title = `${tr('pageTitle')} · ${APP_NAME}`;
  $('title').textContent = tr('pageTitle');
  $('rail-title').textContent = tr('captures');
  $('privacy').textContent = tr('privacy');
  $('cancel').textContent = tr('cancel');
  $('blur-all-text').textContent = tr('blurAll');
  $('add-hint').textContent = tr('addZone');
  $('confirm-text').textContent = tr('cancelConfirm');
  $('confirm-no').textContent = tr('back');
  $('confirm-yes').textContent = tr('cancelYes');
  $('state-text').textContent = tr('analyzing');
  createIcons({
    icons: { Lock, Check, Send, Scan: ScanSearch, EyeOff, Images },
    attrs: { width: 16, height: 16, 'aria-hidden': 'true' },
  });

  target = ((await browser.storage.local.get('fd.review'))['fd.review'] as typeof target) ?? null;
  const all = await pending.all();
  // Captures avec détections d'abord (spec), numérotation d'origine conservée
  captures = [...all].sort(
    (a, b) => Number(detected(b).length > 0) - Number(detected(a).length > 0) || a.order - b.order,
  );
  for (const c of captures) urls.set(c.id, URL.createObjectURL(c.image));
  $('main').setAttribute('aria-busy', 'false');
  $('state-text').textContent = tr('done');
  $('state').classList.add('is-done');
  $('subtitle').textContent = target?.addTo
    ? (target.addTo.after ? strings.addDestAfter : strings.addDestStart)
        .replace('{{demo}}', target.addTo.title)
        .replace('{{n}}', String(target.addTo.after?.n ?? ''))
        .replace('{{title}}', target.addTo.after?.title ?? '')
    : tr('subtitle', { demo: target?.title ?? '', count: captures.length });
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
    ...(total ? [icon(TriangleAlert, 18)] : []),
    total
      ? h(
          'p',
          {},
          h(
            'strong',
            {},
            tr('summary', { count: total, captures: tr('capturesCount', { count: withHits }) }),
          ),
          ' ',
          tr('summaryHelp'),
        )
      : h('p', {}, tr('none')),
  );
  render();
  // L60 §3 : sans donnée repérée, pas d'écran de vérification : l'envoi part tout de suite, la barre de
  // l'onglet capturé montre l'avancement (cet onglet reste en arrière-plan)
  const auto = (await browser.storage.local.get('fd.autoSend'))['fd.autoSend'] as
    { tabId: number; at: number } | undefined;
  await browser.storage.local.remove('fd.autoSend');
  if (!total && auto && Date.now() - auto.at < 60_000 && !target.addTo) {
    autoTab = auto.tabId;
    ($('send') as HTMLButtonElement).click();
  }
}
/** L60 §3 : onglet capturé dont la barre montre l'envoi (envoi sans vérification). */
let autoTab: number | null = null;
const toBar = (m: { type: 'fd:send-progress'; done: number; total: number } | { type: 'fd:send-done' }) =>
  autoTab === null
    ? undefined
    : void browser.runtime.sendMessage({ ...m, tabId: autoTab }).catch(() => undefined);
/** Montre cet onglet (envoi en arrière-plan : erreur à lire, ou rien d'autre où aller). */
async function showSelf() {
  const self = await browser.tabs.getCurrent();
  if (self?.id !== undefined) await browser.tabs.update(self.id, { active: true }).catch(() => undefined);
}

function render() {
  renderRail();
  renderStage();
  renderPanel();
  renderFrames();
  $('send-text').textContent = sendLabel(captures.length);
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
          // FL-3 : « n · titre » puis la pastille du nombre de détections, à droite du libellé
          h(
            'span',
            { class: 'rv-thumb__label' },
            h('span', { class: 'rv-thumb__title' }, thumbTitle(c)),
            h(
              'span',
              { class: `rv-pill ${n ? 'rv-pill--danger' : 'rv-pill--ok'}`, 'aria-label': count },
              n ? String(n) : '0',
            ),
          ),
        ),
      );
    }),
  );
}

/** « n · titre » : titre de la page capturée (texte tiers, inséré en textContent). */
function thumbTitle(c: PendingCapture) {
  const t = (c.title || c.label || '').trim();
  return t ? `${c.order + 1} · ${t}` : tr('captureN', { n: c.order + 1 });
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
  // EXT-02 §5 : cadre gardé (le reste de l'image n'apparaîtra pas dans la démo)
  const crop = c.frame?.crop;
  const kept = crop
    ? [
        h('div', {
          class: 'rv-frame',
          style: `left:${crop.x * 100}%;top:${crop.y * 100}%;width:${crop.w * 100}%;height:${crop.h * 100}%`,
          'aria-hidden': 'true',
        }),
      ]
    : [];
  stage.replaceChildren(img, ...kept, ...zones);
  $('legend').replaceChildren(
    h('li', {}, h('i', { class: 'rv-sw rv-sw--blur' }), tr('legendBlur')),
    h('li', {}, h('i', { class: 'rv-sw rv-sw--off' }), tr('legendDetected')),
    h('li', {}, h('i', { class: 'rv-sw rv-sw--sel' }), tr('legendSelected')),
  );
}

// ===== EXT-02 §5 : cadre de chaque capture =====
const FRAMES: Array<{ mode: FrameMode; label: string; icon: IconNode }> = [
  { mode: 'page', label: strings.framePage, icon: Monitor },
  { mode: 'element', label: strings.frameElement, icon: SquareMousePointer },
  { mode: 'zone', label: strings.frameZone, icon: Crop },
];
/** Nature du cadre, ou la raison pour laquelle la page entière est gardée. */
function frameNature(c: PendingCapture): { text: string; info: boolean } {
  const f = c.frame ?? { mode: 'page' as FrameMode, crop: null };
  if (f.mode === 'zone')
    return f.crop
      ? { text: strings.fnZone, info: false }
      : { text: c.zone ? strings.fnOutside : strings.fnNoZone, info: true };
  if (f.mode === 'element')
    return f.crop ? { text: strings.fnElement, info: false } : { text: strings.fnWide, info: true };
  return { text: strings.fnPage, info: false };
}
function setFrame(c: PendingCapture, mode: FrameMode) {
  c.frame = frameFor(mode, { element: c.element, click: c.click, viewport: c.viewport, zone: c.zone });
  save(c);
  renderFrames();
  if (captures[current] === c) renderStage();
}
function renderFrames() {
  const ordered = [...captures].sort((a, b) => a.order - b.order);
  $('caps').hidden = !ordered.length;
  $('caps-title').textContent = strings.capsTitle.replace('{{n}}', String(ordered.length));
  $('caps-help').textContent = strings.capsHelp;
  const focused = (document.activeElement as HTMLElement | null)?.dataset;
  $('caps-list').replaceChildren(
    ...ordered.map((c) => {
      const mode = c.frame?.mode ?? 'page';
      const crop = c.frame?.crop ?? { x: 0, y: 0, w: 1, h: 1 };
      const nature = frameNature(c);
      const n = c.order + 1;
      return h(
        'li',
        { class: 'rv-cap' },
        h('span', { class: 'rv-cap__n', 'aria-hidden': 'true' }, String(n)),
        h(
          'span',
          { class: 'rv-cap__thumb', style: `aspect-ratio:${c.width} / ${c.height}` },
          h('img', { src: urls.get(c.id) ?? '', alt: '' }),
          h('i', {
            style: `left:${crop.x * 100}%;top:${crop.y * 100}%;width:${crop.w * 100}%;height:${crop.h * 100}%`,
          }),
        ),
        h(
          'span',
          { class: 'rv-cap__text' },
          h(
            'b',
            {},
            c.label
              ? defaultHotspotTitle(c.label, document.documentElement.lang === 'en' ? 'en' : 'fr')
              : thumbTitle(c),
          ),
          h(
            'span',
            { class: `rv-cap__nature${nature.info ? ' is-info' : ''}` },
            ...(nature.info ? [icon(Info, 16)] : []),
            nature.text,
          ),
        ),
        h(
          'span',
          { class: 'rv-seg', role: 'radiogroup', 'aria-label': strings.frameOf.replace('{{n}}', String(n)) },
          ...FRAMES.map((f) => {
            // « Zone » n'a de sens que si une zone était tracée au moment du clic
            const off = f.mode === 'zone' && !c.zone;
            return h(
              'button',
              {
                type: 'button',
                role: 'radio',
                'aria-checked': String(mode === f.mode),
                'aria-label': f.label,
                'aria-disabled': off ? 'true' : undefined,
                title: off ? strings.fnNoZone : undefined,
                tabindex: mode === f.mode ? '0' : '-1',
                'data-cap': c.id,
                'data-frame': f.mode,
              },
              icon(f.icon, 16),
              h('span', {}, f.label),
            );
          }),
        ),
      );
    }),
  );
  // Le focus reste sur le segment qui vient d'être actionné
  if (focused?.cap)
    document.querySelector<HTMLElement>(`[data-cap="${focused.cap}"][aria-checked="true"]`)?.focus();
}
$('caps-list').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-frame]');
  if (!b || b.getAttribute('aria-disabled') === 'true') return;
  const c = captures.find((x) => x.id === b.dataset.cap);
  if (c) setFrame(c, b.dataset.frame as FrameMode);
});
$('caps-list').addEventListener('keydown', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-frame]');
  const d =
    e.key === 'ArrowRight' || e.key === 'ArrowDown'
      ? 1
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
        ? -1
        : 0;
  if (!b || !d) return;
  e.preventDefault();
  const all = [...b.parentElement!.querySelectorAll<HTMLElement>('[data-frame]:not([aria-disabled="true"])')];
  const next = all[(all.indexOf(b) + d + all.length) % all.length];
  const c = captures.find((x) => x.id === b.dataset.cap);
  if (c && next) {
    next.focus();
    setFrame(c, next.dataset.frame as FrameMode);
  }
});

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
  // FL-5 : phrase qui nomme les détections non floutées (« ne seront pas floutées », « pas » en gras)
  $('warning').hidden = off.length === 0;
  const list = new Intl.ListFormat(document.documentElement.lang, { type: 'conjunction' }).format(off);
  const [before, after] = (
    off.length
      ? tr('notBlurredWarning', { types: list, not: '{{not}}', count: c.zones.filter((z) => !z.blur).length })
      : ''
  ).split('{{not}}');
  $('warning').replaceChildren(before ?? '', ...(after !== undefined ? [h('b', {}, tr('not')), after] : []));
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
    const created: string[] = [];
    const demoId = await sendCaptures(
      ordered,
      { ...target, appendTo: target.addTo?.demoId ?? null },
      (done) => {
        $('send-text').textContent = tr('sending', { done, total: ordered.length });
        toBar({ type: 'fd:send-progress', done, total: ordered.length });
      },
      created,
    );
    await pending.clear();
    await browser.storage.local.remove('fd.review');
    // L'app lit l'état de l'extension (version, dernière capture, dernière démo)
    void supabase
      .rpc('extension_report', { p_version: browser.runtime.getManifest().version, p_demo: demoId })
      .then(
        () => undefined,
        () => undefined,
      );
    // L60 §3 : « ready » : l'éditeur dit « Démo prête : n étapes capturées » et marque les étapes « Nouvelle »
    const editor = `${APP_URL.replace(/\/$/, '')}/#/demos/${demoId}/edit${target.addTo ? '' : `?ready=${ordered.length}`}`;
    if (target.addTo) {
      // EXT-02 §8.4 : l'extension rend la main à l'onglet de l'éditeur, qui insère les étapes
      const t = (await browser.storage.local.get(ADD_KEY))[ADD_KEY] as AddTarget | undefined;
      if (t && t.demoId === demoId) {
        await browser.storage.local.set({ [ADD_KEY]: { ...t, state: 'sent', stepIds: created } });
        const back =
          t.editorTabId !== null
            ? await browser.tabs.update(t.editorTabId, { active: true }).catch(() => null)
            : null;
        if (back) {
          if (back.windowId !== undefined)
            await browser.windows.update(back.windowId, { focused: true }).catch(() => undefined);
          const self = await browser.tabs.getCurrent();
          if (self?.id !== undefined) return void browser.tabs.remove(self.id);
        }
      }
    }
    toBar({ type: 'fd:send-done' });
    // L60 §3 : l'éditeur s'ouvre dans l'onglet TutoClick déjà ouvert, sinon dans celui-ci
    const origin = new URL(APP_URL).origin;
    // Onglet de l'app : routes en #/ (une page capturée du même hôte n'est pas l'app)
    const app = (await browser.tabs.query({}).catch(() => [])).find((t) => t.url?.startsWith(`${origin}/#/`));
    const self = await browser.tabs.getCurrent();
    if (app?.id !== undefined && app.id !== self?.id) {
      await browser.tabs.update(app.id, { url: editor, active: true }).catch(() => undefined);
      if (app.windowId !== undefined)
        await browser.windows.update(app.windowId, { focused: true }).catch(() => undefined);
      if (self?.id !== undefined) return void browser.tabs.remove(self.id);
    }
    await showSelf();
    location.href = editor;
  } catch (err) {
    toBar({ type: 'fd:send-done' });
    await showSelf();
    $('error').hidden = false;
    // §8.5 : démo supprimée ou droits retirés entre-temps : message clair, les captures restent ici
    $('error').textContent = target.addTo ? strings.addGone : ((err as Error).message ?? String(err));
    send.disabled = false;
    $('cancel').removeAttribute('disabled');
    $('send-text').textContent = sendLabel(ordered.length);
  }
});

void boot();
