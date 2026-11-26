import '@flowdsiml/ui/tokens.css';
import '@/lib/fonts.css';
import './style.css';
import { browser } from 'wxt/browser';
import { supabase } from '@/lib/supabase';
import { APP_URL, DEBUGGER } from '@/lib/config';
import { APP_NAME, htmlCaptureVerdict, parseHtmlCapture } from '@flowdsiml/core';
import type { CaptureMode, FillTarget, PopupRequest, RecordingStatus } from '@/lib/messages';
import { lang, stepsCaptured, strings } from '@/lib/i18n';
import { ADD_KEY, attachFor, liveTarget, type AddTarget, type PendingAttach } from '@/lib/external';
import {
  ArrowLeft,
  Box,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  CircleQuestionMark,
  Code,
  Crop,
  Ellipsis,
  ExternalLink,
  EyeOff,
  Folder,
  Globe,
  Layers,
  ListPlus,
  LogIn,
  LogOut,
  Mic,
  Monitor,
  MousePointerClick,
  Pause,
  Play,
  RotateCw,
  ScrollText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  TriangleAlert,
  Video,
  Webcam,
  createIcons,
  type IconNode,
} from 'lucide';
import { viewportFor, type DeviceKey } from '@/lib/video';
import { tabSize, type TabSizeKey } from '@/lib/fullpage';
import {
  ALL_SITES,
  FULL_LATER_KEY,
  permissionNeed,
  startsWithout,
  type PermissionNeed,
} from '@/lib/permissions';
import { createSelect, createSwitch, icon, type Option } from './ui';
import { APPEARANCE_KEY, asAppearance, followAppearance, paintPage, type Appearance } from '@/lib/appearance';

/**
 * Popup de l'extension, variante B (EXT-02 §1.2) : titre, type de capture en liste décrite, espace,
 * options repliables résumées en une ligne, « Démarrer » dans le pied. Contrôles maison (COMP-01).
 */
document.documentElement.lang = lang;
document.title = APP_NAME;
for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]'))
  el.textContent = strings[el.dataset.i18n as keyof typeof strings];
const ICONS = {
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  CircleQuestionMark,
  Crop,
  Ellipsis,
  ExternalLink,
  EyeOff,
  Folder,
  Globe,
  Layers,
  ListPlus,
  LogIn,
  LogOut,
  Mic,
  Monitor,
  Pause,
  Play,
  RotateCw,
  ScrollText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  TriangleAlert,
  Webcam,
};
createIcons({ icons: ICONS, attrs: { width: 16, height: 16, 'stroke-width': 2, 'aria-hidden': 'true' } });
for (const svg of document.querySelectorAll<SVGElement>('.pph .ib svg')) {
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const show = (id: string, visible: boolean) => ($(id).hidden = !visible);
const app = APP_URL.replace(/\/$/, '');

// ===== En-tête : aide (nouvel onglet) et menu ⋯ =====
$<HTMLAnchorElement>('help').href = `${app}/#/extension`;
$<HTMLAnchorElement>('menu-help').href = `${app}/#/extension`;
$('help').setAttribute('aria-label', strings.helpTab);
$('more').setAttribute('aria-label', strings.more);
$<HTMLAnchorElement>('open-app').href = `${app}/`;
$('open-app').querySelector('span')!.textContent = strings.openApp;
const menu = $('more-menu');
const menuItems = () =>
  [...menu.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]')].filter(
    (e) => !e.closest('[hidden]'),
  );
function toggleMenu(open: boolean, focus = true) {
  menu.hidden = !open;
  $('more').setAttribute('aria-expanded', String(open));
  if (open) menuItems()[0]?.focus();
  else if (focus) $('more').focus();
}
$('more').addEventListener('click', () => toggleMenu(menu.hidden));
menu.addEventListener('keydown', (e) => {
  const items = menuItems();
  const i = items.indexOf(document.activeElement as HTMLElement);
  if (e.key === 'ArrowDown') items[(i + 1) % items.length]?.focus();
  else if (e.key === 'ArrowUp') items[(i - 1 + items.length) % items.length]?.focus();
  else if (e.key === 'Home') items[0]?.focus();
  else if (e.key === 'End') items[items.length - 1]?.focus();
  else if (e.key === 'Escape') toggleMenu(false);
  else if (e.key === 'Tab') return toggleMenu(false, false);
  else return;
  e.preventDefault();
});
menu.addEventListener('click', () => toggleMenu(false, false));
document.addEventListener('pointerdown', (e) => {
  if (!menu.hidden && !(e.target as HTMLElement).closest('#more-menu, #more')) toggleMenu(false, false);
});

// ===== L60 §1 : modes. « Sandbox » est une sortie de la capture HTML ; « Format mobile » est un réglage =====
type TypeKey = 'clicks' | 'html' | 'video' | 'sandbox';
const MODES: Array<{ key: TypeKey; icon: IconNode; name: keyof typeof strings; desc: keyof typeof strings }> =
  [
    { key: 'clicks', icon: MousePointerClick, name: 'mClicks', desc: 'mClicksD' },
    { key: 'html', icon: Code, name: 'mHtml', desc: 'mHtmlD' },
    { key: 'video', icon: Video, name: 'mVideo', desc: 'mVideoD' },
    { key: 'sandbox', icon: Box, name: 'mSandbox', desc: 'mSandboxD' },
  ];
const isMode = (v: unknown): v is TypeKey => MODES.some((m) => m.key === v);
let htmlVerdict: 'ok' | 'disabled' | 'domain' = 'ok';
let htmlHost = '';
/** Dernier mode utilisé (par personne et par navigateur) : encadré, focus à l'ouverture, Entrée le lance. */
let lastMode: TypeKey | null = null;
/** Mode mis en avant à la place du dernier : Sandbox de l'app, ajout depuis l'éditeur. */
let preferred: TypeKey | null = null;
let chosen: TypeKey = 'clicks';
let size: 'current' | '1440x900' | 'mobile' = 'current';
const typeKey = () => chosen;
const mode = (): CaptureMode =>
  chosen === 'sandbox' ? 'html' : chosen === 'clicks' && size === 'mobile' ? 'mobile' : chosen;

/** Raison d'un mode refusé par la règle « Captures HTML » de l'espace (L49 §2.1) ; la ligne reste visible. */
function modeOff(k: TypeKey): string | null {
  // Recette UX lot E : la vidéo crée toujours une nouvelle démo ; le choix reste visible, grisé
  if (k === 'video') return destKind === 'append' && appendDemo ? strings.videoNewOnly : null;
  if (k !== 'html' && k !== 'sandbox') return null;
  if (htmlVerdict === 'disabled') return strings.offSpace;
  if (htmlVerdict === 'domain') return strings.offDomain.replace('{{domain}}', htmlHost);
  return null;
}
let focusModeOnce = true;
function renderModes() {
  const ul = $('modes');
  const had = (document.activeElement as HTMLElement | null)?.closest?.<HTMLElement>('.mode')?.dataset.mode;
  const top = preferred ?? lastMode;
  ul.replaceChildren(
    ...MODES.map((m) => {
      const off = modeOff(m.key);
      const desc = off ?? strings[m.desc];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = m.key === top ? 'mode is-last' : 'mode';
      b.dataset.mode = m.key;
      b.setAttribute(
        'aria-label',
        strings.startMode.replace('{{mode}}', strings[m.name]).replace('{{desc}}', desc),
      );
      if (blocked || off) b.setAttribute('aria-disabled', 'true');
      const tile = document.createElement('span');
      tile.className = 'tile';
      tile.append(icon(m.icon, 20));
      const tx = document.createElement('span');
      tx.className = 'tx';
      tx.append(
        Object.assign(document.createElement('b'), { textContent: strings[m.name] }),
        Object.assign(document.createElement('small'), { textContent: desc }),
      );
      const end =
        m.key === top
          ? Object.assign(document.createElement('kbd'), { textContent: strings.enterKey })
          : icon(ChevronRight, 16);
      end.setAttribute('aria-hidden', 'true');
      b.append(tile, tx, end);
      const li = document.createElement('li');
      li.append(b);
      return li;
    }),
  );
  $('modes-help').textContent = top ? strings.modesHelp : strings.modesHelpFirst;
  const again = had ? ul.querySelector<HTMLElement>(`[data-mode="${had}"]`) : null;
  if (again) again.focus();
  else if (focusModeOnce && !$('setup').hidden) {
    focusModeOnce = false;
    (ul.querySelector<HTMLElement>('.is-last') ?? ul.querySelector<HTMLElement>('.mode'))?.focus();
  }
}
$('modes').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('.mode');
  if (!b || b.getAttribute('aria-disabled') === 'true') return;
  void startMode(b.dataset.mode as TypeKey);
});
// Flèches haut et bas : d'un mode à l'autre
$('modes').addEventListener('keydown', (e) => {
  const all = [...$('modes').querySelectorAll<HTMLElement>('.mode')];
  const i = all.indexOf(document.activeElement as HTMLElement);
  if (i < 0) return;
  const to =
    e.key === 'ArrowDown'
      ? all[(i + 1) % all.length]
      : e.key === 'ArrowUp'
        ? all[(i - 1 + all.length) % all.length]
        : e.key === 'Home'
          ? all[0]
          : e.key === 'End'
            ? all[all.length - 1]
            : null;
  if (!to) return;
  e.preventDefault();
  to.focus();
});

// « Sur ExampleCRM · app.example.com » : la bonne page est visée
void browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  let host = '';
  try {
    const u = new URL(tab?.url ?? '');
    if (u.protocol === 'http:' || u.protocol === 'https:') host = u.host;
  } catch {
    /* page sans adresse */
  }
  if (!host) return;
  const title = (tab?.title ?? '').trim();
  $('page-line').querySelector('span')!.textContent = title
    ? strings.onPage.replace('{{title}}', title).replace('{{host}}', host)
    : strings.onPage.replace('{{title}} · ', '').replace('{{host}}', host);
  show('page-line', true);
});

// ===== Réglages de capture (tous mémorisés) =====
const follow = createSwitch($<HTMLButtonElement>('follow'), {
  onChange: (on) => void browser.storage.local.set({ 'fd.follow': on }),
});
const mic = createSwitch($<HTMLButtonElement>('mic'), {
  onChange: (on) => void browser.storage.local.set({ 'fd.mic': on }),
});
const webcam = createSwitch($<HTMLButtonElement>('webcam'), {
  onChange: (on) => void browser.storage.local.set({ 'fd.webcam': on }),
});
// EXT-02 §4.2 : « Flouter en direct », désactivé par défaut
const liveMask = createSwitch($<HTMLButtonElement>('live-mask'), {
  onChange: (on) => void browser.storage.local.set({ 'fd.liveMask': on }),
});
// Sans l'outil de débogage, la taille passe par la fenêtre (README §6.3)
$('size-h').textContent = DEBUGGER
  ? strings.sizeHelpMobile
  : `${strings.sizeHelp} ${strings.tabSizeHelpWindow}`;
const sizeButtons = () => [...$('size').querySelectorAll<HTMLButtonElement>('button')];
function paintSize() {
  for (const b of sizeButtons()) {
    const on = b.dataset.value === size;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
    // EXT-STORE, option B : sans l'outil de débogage, Mobile reste visible en « Bientôt »
    if (b.dataset.value === 'mobile' && !DEBUGGER) {
      b.setAttribute('aria-disabled', 'true');
      b.title = strings.soon;
    }
  }
}
function pickSize(b: HTMLButtonElement | undefined) {
  if (!b || b.getAttribute('aria-disabled') === 'true') return;
  size = b.dataset.value as typeof size;
  paintSize();
  b.focus();
  void browser.storage.local.set({ 'fd.tabSize': size });
  void refreshDenied();
}
$('size').addEventListener('click', (e) =>
  pickSize((e.target as HTMLElement).closest<HTMLButtonElement>('button') ?? undefined),
);
$('size').addEventListener('keydown', (e) => {
  const all = sizeButtons().filter((b) => b.getAttribute('aria-disabled') !== 'true');
  const i = all.indexOf(document.activeElement as HTMLButtonElement);
  const d =
    e.key === 'ArrowRight' || e.key === 'ArrowDown'
      ? 1
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
        ? -1
        : 0;
  if (!d || i < 0) return;
  e.preventDefault();
  pickSize(all[(i + d + all.length) % all.length]);
});
paintSize();
// L64 §3 : rédaction automatique, désactivée (visible) si l'espace n'autorise pas l'IA
let aiAllowed = true;
const autoDraft = createSwitch($<HTMLButtonElement>('auto-draft'), {
  onChange: (on) => {
    if (!aiAllowed) return (autoDraft.checked = false);
    void browser.storage.local.set({ 'fd.autoDraft': on });
  },
});
function paintAutoDraft() {
  $('auto-draft-h').textContent = aiAllowed ? strings.autoDraftHelp : strings.autoDraftOff;
  if (aiAllowed) $('auto-draft').removeAttribute('aria-disabled');
  else {
    $('auto-draft').setAttribute('aria-disabled', 'true');
    autoDraft.checked = false;
  }
}
async function syncAi() {
  const ws = workspace.value;
  if (!ws) return;
  const { data } = await supabase.rpc('ai_status', { p_ws: ws });
  const st = data as { enabled?: boolean; features?: Record<string, boolean> } | null;
  aiAllowed = !!st?.enabled && st.features?.write !== false;
  const saved = (await browser.storage.local.get('fd.autoDraft'))['fd.autoDraft'] === true;
  paintAutoDraft();
  if (aiAllowed) autoDraft.checked = saved;
}
paintAutoDraft();
// L64 §4 : apparence (Système, Clair, Sombre), appliquée tout de suite au popup
let look: Appearance = 'system';
const lookButtons = () => [...$('look').querySelectorAll<HTMLButtonElement>('button')];
function paintLook() {
  for (const b of lookButtons()) {
    const on = b.dataset.value === look;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  }
}
function pickLook(b: HTMLButtonElement | undefined) {
  if (!b) return;
  look = asAppearance(b.dataset.value);
  paintLook();
  b.focus();
  paintPage(look);
  void browser.storage.local.set({ [APPEARANCE_KEY]: look });
}
$('look').addEventListener('click', (e) =>
  pickLook((e.target as HTMLElement).closest<HTMLButtonElement>('button') ?? undefined),
);
$('look').addEventListener('keydown', (e) => {
  const all = lookButtons();
  const i = all.indexOf(document.activeElement as HTMLButtonElement);
  const d =
    e.key === 'ArrowRight' || e.key === 'ArrowDown'
      ? 1
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
        ? -1
        : 0;
  if (!d || i < 0) return;
  e.preventDefault();
  pickLook(all[(i + d + all.length) % all.length]);
});
paintLook();
followAppearance((a) => {
  look = a;
  paintLook();
});
void browser.storage.local
  .get(['fd.lastMode', 'fd.tabSize', 'fd.follow', 'fd.mic', 'fd.webcam', 'fd.liveMask'])
  .then((r) => {
    const saved = r['fd.lastMode'];
    // Ancien « Format mobile » : captures d'écran en taille Mobile
    lastMode = saved === 'mobile' ? 'clicks' : isMode(saved) ? saved : null;
    const t = r['fd.tabSize'] ?? (saved === 'mobile' && DEBUGGER ? 'mobile' : 'current');
    if (t === 'current' || t === '1440x900' || (t === 'mobile' && DEBUGGER)) size = t;
    follow.checked = r['fd.follow'] === true;
    mic.checked = r['fd.mic'] === true;
    webcam.checked = r['fd.webcam'] === true;
    liveMask.checked = r['fd.liveMask'] === true;
    paintSize();
    renderModes();
  });
function viewport(): { w: number; h: number } {
  return viewportFor('phone' as DeviceKey, false, { w: 390, h: 844 });
}

// ===== Bandeau d'erreur (EXT-02 §1.3) : titre, phrase, action ; « Démarrer » désactivé, jamais masqué =====
type Problem = { title?: string; text: string; retry?: boolean; blocking?: boolean };
let blocked = false;
function problem(p: Problem | null) {
  $('error-title').textContent = p?.title ?? '';
  $('error-text').textContent = p ? ` ${p.text} ` : '';
  show('error-retry', !!p?.retry);
  $('error').hidden = !p;
  blocked = !!p?.blocking;
  // Page impossible à capturer : les 4 lignes restent, désactivées ; destination et aide masquées
  show('dest-row', !blocked);
  show('modes-help', !blocked);
  renderModes();
}
const error = (msg: string | null) => problem(msg ? { text: msg } : null);
/** Page système, hors ligne : la capture ne peut pas démarrer d'ici. */
async function checkPage(): Promise<boolean> {
  if (!navigator.onLine) {
    problem({ title: strings.errOfflineTitle, text: strings.errOfflineText, retry: true, blocking: true });
    return false;
  }
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || !/^https?:/.test(tab.url)) {
    problem({ title: strings.errPageTitle, text: strings.errPageText, retry: true, blocking: true });
    return false;
  }
  if (blocked) problem(null);
  return true;
}
$('error-retry').addEventListener('click', () => void checkPage());

function send<T>(req: PopupRequest): Promise<T> {
  return browser.runtime.sendMessage(req) as Promise<T>;
}

// ===== Espace : liste seulement s'il y en a plusieurs, sinon le nom seul =====
const workspace = createSelect($<HTMLButtonElement>('workspace'), {
  options: [],
  value: '',
  lead: Building2,
  onChange: () => {
    void loadFills();
    void syncHtmlRule();
    void loadDest();
    void syncAi();
    syncDest();
  },
});
async function loadWorkspaces() {
  const { data: u } = await supabase.auth.getUser();
  // L26-01 : « Installer l'extension » se coche quand l'extension a répondu au moins une fois
  void supabase.rpc('extension_seen').then(() => undefined);
  // §7 : la page Extension de l'app affiche la version installée
  void supabase.rpc('extension_report', { p_version: browser.runtime.getManifest().version }).then(
    () => undefined,
    () => undefined,
  );
  // L64 §1 : tous les espaces de la personne (le menu ⋯ montre aussi ceux où elle est lectrice)
  const { data, error: err } = await supabase
    .from('members')
    .select('role, workspaces(id, name)')
    .eq('user_id', u.user!.id);
  if (err) return error(err.message);
  $('logout-mail').textContent = u.user?.email ?? '';
  spaces = [];
  for (const m of data ?? []) {
    const ws = m.workspaces as unknown as { id: string; name: string } | null;
    if (ws) spaces.push({ id: ws.id, name: ws.name, role: m.role as string, members: 0 });
  }
  // Nombre de membres de chaque espace (« 6 membres · Éditeur »)
  if (spaces.length) {
    const { data: rows } = await supabase
      .from('members')
      .select('workspace_id')
      .in(
        'workspace_id',
        spaces.map((w) => w.id),
      );
    for (const r of (rows ?? []) as Array<{ workspace_id: string }>) {
      const w = spaces.find((x) => x.id === r.workspace_id);
      if (w) w.members += 1;
    }
  }
  const opts: Option[] = spaces
    .filter((w) => canCapture(w.role))
    .map((w) => ({ value: w.id, label: w.name }));
  workspace.setOptions(opts);
  if (!opts.length) problem({ text: strings.noWorkspace, blocking: true });
  const saved = (await browser.storage.local.get('fd.lastWorkspace'))['fd.lastWorkspace'] as
    string | undefined;
  if (saved) workspace.set(saved);
  $('workspace-one').querySelector('span')!.textContent = opts[0]?.label ?? '';
  renderSpaces();
}

// ===== L64 §1 : espaces dans le menu ⋯ (menuitemradio, espace courant coché, lecteur grisé) =====
type Space = { id: string; name: string; role: string; members: number };
let spaces: Space[] = [];
const canCapture = (role: string) => role === 'editor' || role === 'admin' || role === 'owner';
const roleName = (role: string) =>
  role === 'owner'
    ? strings.roleOwner
    : role === 'admin'
      ? strings.roleAdmin
      : role === 'editor'
        ? strings.roleEditor
        : strings.roleViewer;
function renderSpaces() {
  show('ws-sec', spaces.length > 0 && $('login').hidden);
  $('ws-items').replaceChildren(
    ...spaces.map((w) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'menuitemradio');
      b.tabIndex = -1;
      b.dataset.ws = w.id;
      const on = w.id === workspace.value;
      b.setAttribute('aria-checked', String(on));
      const ok = canCapture(w.role);
      if (!ok) b.setAttribute('aria-disabled', 'true');
      const tile = Object.assign(document.createElement('span'), {
        className: 'wt',
        textContent: w.name.trim().charAt(0).toUpperCase(),
      });
      tile.setAttribute('aria-hidden', 'true');
      const two = document.createElement('span');
      two.className = 'two';
      const meta = ok
        ? (w.members === 1 ? strings.wsMembers_one : strings.wsMembers_other)
            .replace('{{n}}', String(Math.max(1, w.members)))
            .replace('{{role}}', roleName(w.role))
        : strings.wsViewer;
      two.append(
        Object.assign(document.createElement('span'), { textContent: w.name }),
        Object.assign(document.createElement('small'), { textContent: meta }),
      );
      b.append(tile, two);
      if (on) {
        const tick = icon(Check, 16);
        tick.classList.add('tick');
        b.append(tick);
      }
      return b;
    }),
  );
}
$('ws-items').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-ws]');
  if (!b || b.getAttribute('aria-disabled') === 'true') return e.stopPropagation();
  // Changer d'espace met à jour la destination et revient aux modes
  workspace.set(b.dataset.ws!, true);
  void browser.storage.local.set({ 'fd.lastWorkspace': b.dataset.ws });
  renderSpaces();
  if ($('recording').hidden && $('login').hidden) view('setup');
});

// L26-04 : démos de l'espace qui ont des étapes « À capturer » (capture guidée). Recette UX lot E : elles
// se choisissent dans « Ajouter à une démo », en tête, avec la pastille « n étapes à capturer »
let fills: FillTarget[] = [];
const fillOf = (id: string | null | undefined) => (id ? fills.find((f) => f.demoId === id) : undefined);
async function loadFills() {
  const ws = workspace.value;
  fills = [];
  if (ws) {
    const { data } = await supabase
      .from('steps')
      .select('id, title, position, demo_id, demos!inner(title, deleted_at)')
      .eq('workspace_id', ws)
      .eq('to_capture', true)
      .is('image_path', null)
      .is('demos.deleted_at', null)
      .order('position');
    const byDemo = new Map<string, FillTarget>();
    for (const r of (data ?? []) as unknown as Array<{
      id: string;
      title: string;
      demo_id: string;
      demos: { title: string } | null;
    }>) {
      const f = byDemo.get(r.demo_id) ?? { demoId: r.demo_id, title: r.demos?.title ?? '', steps: [] };
      f.steps.push({ id: r.id, title: r.title });
      byDemo.set(r.demo_id, f);
    }
    fills = [...byDemo.values()];
  }
  renderDest();
}
/** « Dans Acme · Nouvelle démo » : espace et démo de destination, en une ligne. */
let addingTitle = '';
function syncDest() {
  const ws = workspace.options().find((o) => o.value === workspace.value)?.label ?? '';
  // « Dans Acme · Ventes · Nouvelle démo », ou la démo où ajouter les étapes
  const demo =
    addingTitle ||
    (destKind === 'append' && appendDemo
      ? appendDemo.title
      : [folderId ? folderName(folderId) : '', strings.fillNew].filter(Boolean).join(' · '));
  const t = $('dest-text');
  t.replaceChildren(
    `${strings.destIn} `,
    Object.assign(document.createElement('b'), { textContent: ws }),
    ` · ${demo}`,
  );
  t.title = `${strings.destIn} ${ws} · ${demo}`;
  $('dest-ws-tile').textContent = ws.trim().charAt(0).toUpperCase();
}

// ===== L64 §2 : vue Destination (dossier d'une nouvelle démo, ou démo où ajouter à la fin) =====
type FolderRow = { id: string; name: string; parent_id: string | null };
type DemoRow = { id: string; title: string; folder_id: string | null; steps: number };
let destKind: 'new' | 'append' = 'new';
let folderId: string | null = null;
let appendDemo: { id: string; title: string } | null = null;
let folders: FolderRow[] = [];
let demosList: DemoRow[] = [];
const foldText = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const folderName = (id: string | null) => folders.find((f) => f.id === id)?.name ?? '';
$('dest-kind').setAttribute('aria-label', strings.destKindLabel);
$<HTMLInputElement>('demo-q').placeholder = strings.demoSearch;
$('demo-q').setAttribute('aria-label', strings.demoSearch);
$('demos').setAttribute('aria-label', strings.demoSearch);

async function loadDest() {
  const ws = workspace.value;
  if (!ws) return;
  const [f, d, saved] = await Promise.all([
    supabase.from('folders').select('id, name, parent_id').eq('workspace_id', ws).order('name'),
    supabase
      .from('demos')
      .select('id, title, folder_id, steps(count)')
      .eq('workspace_id', ws)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(200),
    browser.storage.local.get(['fd.destKind', `fd.folder.${ws}`, `fd.appendDemo.${ws}`]),
  ]);
  folders = (f.data ?? []) as FolderRow[];
  demosList = (
    (d.data ?? []) as unknown as Array<{
      id: string;
      title: string | null;
      folder_id: string | null;
      steps: Array<{ count: number }> | null;
    }>
  ).map((r) => ({ id: r.id, title: r.title || '', folder_id: r.folder_id, steps: r.steps?.[0]?.count ?? 0 }));
  destKind = saved['fd.destKind'] === 'append' ? 'append' : 'new';
  const sf = saved[`fd.folder.${ws}`] as string | undefined;
  folderId = sf && folders.some((x) => x.id === sf) ? sf : null;
  const sa = saved[`fd.appendDemo.${ws}`] as { id: string; title: string } | undefined;
  appendDemo = sa && (demosList.some((x) => x.id === sa.id) || fillOf(sa.id)) ? sa : null;
  renderDest();
}

function renderDest(focus?: string) {
  for (const b of $('dest-kind').querySelectorAll<HTMLButtonElement>('button')) {
    const on = b.dataset.value === destKind;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  }
  show('folder-field', destKind === 'new');
  show('append-field', destKind === 'append');
  // Une démo à compléter : chaque clic remplit son étape « À capturer » suivante
  $('demos-h').textContent = fillOf(appendDemo?.id) ? strings.fillHelp : strings.appendHelp;
  // L'ajout à une démo existante ne vaut pas pour la vidéo : la ligne Vidéo le dit (grisée)
  renderModes();
  // Arbre des dossiers : « Toutes les démos », puis les dossiers et sous-dossiers (décalés de 24 px)
  const items: HTMLElement[] = [];
  const node = (id: string | null, name: string, count: number, level: number) => {
    const li = document.createElement('li');
    li.setAttribute('role', 'treeitem');
    li.setAttribute('aria-level', String(level));
    li.setAttribute('aria-selected', String(id === folderId));
    li.tabIndex = id === folderId ? 0 : -1;
    li.dataset.folder = id ?? '';
    li.style.paddingLeft = `${10 + (level - 1) * 24}px`;
    li.append(
      icon(Folder, 16),
      Object.assign(document.createElement('span'), { className: 'nm', textContent: name }),
      Object.assign(document.createElement('span'), { className: 'ct', textContent: String(count) }),
    );
    items.push(li);
  };
  node(null, strings.folderAll, demosList.length, 1);
  const walk = (parent: string | null, level: number) => {
    for (const f of folders.filter((x) => x.parent_id === parent)) {
      node(f.id, f.name, demosList.filter((x) => x.folder_id === f.id).length, level);
      walk(f.id, level + 1);
    }
  };
  walk(null, 2);
  $('folders').replaceChildren(...items);
  // Démos modifiables, filtrées par la recherche (sans tenir compte des accents)
  const q = foldText($<HTMLInputElement>('demo-q').value.trim());
  // Démos à compléter en tête (même absentes des 200 plus récentes), puis les autres
  const all = [
    ...fills.map(
      (f) =>
        demosList.find((x) => x.id === f.demoId) ?? {
          id: f.demoId,
          title: f.title,
          folder_id: null,
          steps: f.steps.length,
        },
    ),
    ...demosList.filter((x) => !fillOf(x.id)),
  ];
  const shown = all.filter((x) => !q || foldText(x.title).includes(q));
  $('demos').replaceChildren(
    ...(shown.length
      ? shown.map((x) => {
          const li = document.createElement('li');
          li.setAttribute('role', 'option');
          const on = x.id === appendDemo?.id;
          li.setAttribute('aria-selected', String(on));
          li.tabIndex = on || (!appendDemo && x === shown[0]) ? 0 : -1;
          li.dataset.demo = x.id;
          const two = document.createElement('span');
          two.className = 'two';
          two.append(
            Object.assign(document.createElement('span'), { textContent: x.title }),
            Object.assign(document.createElement('small'), {
              textContent: (x.steps === 1 ? strings.demoMeta_one : strings.demoMeta_other)
                .replace('{{folder}}', folderName(x.folder_id) || strings.folderAll)
                .replace('{{n}}', String(x.steps)),
            }),
          );
          li.append(two);
          const todo = fillOf(x.id)?.steps.length ?? 0;
          if (todo)
            li.append(
              Object.assign(document.createElement('span'), {
                className: 'todo',
                textContent: (todo === 1 ? strings.toCapture_one : strings.toCapture_other).replace(
                  '{{n}}',
                  String(todo),
                ),
              }),
            );
          if (on) li.append(icon(Check, 16));
          return li;
        })
      : [Object.assign(document.createElement('li'), { className: 'none', textContent: strings.demoNone })]),
  );
  syncDest();
  if (focus) document.querySelector<HTMLElement>(focus)?.focus();
}
const saveDest = () => {
  const ws = workspace.value;
  void browser.storage.local.set({
    'fd.destKind': destKind,
    [`fd.folder.${ws}`]: folderId,
    [`fd.appendDemo.${ws}`]: appendDemo,
  });
};
$('dest-kind').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!b) return;
  destKind = b.dataset.value === 'append' ? 'append' : 'new';
  saveDest();
  renderDest(`#dest-kind [data-value="${destKind}"]`);
});
$('dest-kind').addEventListener('keydown', (e) => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
  e.preventDefault();
  destKind = destKind === 'new' ? 'append' : 'new';
  saveDest();
  renderDest(`#dest-kind [data-value="${destKind}"]`);
});
const pickFolder = (li: HTMLElement) => {
  folderId = li.dataset.folder || null;
  saveDest();
  renderDest(`#folders [data-folder="${li.dataset.folder}"]`);
};
$('folders').addEventListener('click', (e) => {
  const li = (e.target as HTMLElement).closest<HTMLElement>('[role=treeitem]');
  if (li) pickFolder(li);
});
const pickDemo = (li: HTMLElement) => {
  const d = demosList.find((x) => x.id === li.dataset.demo);
  const f = fillOf(li.dataset.demo);
  if (!d && !f) return;
  appendDemo = d ? { id: d.id, title: d.title } : { id: f!.demoId, title: f!.title };
  saveDest();
  renderDest(`#demos [data-demo="${appendDemo.id}"]`);
};
$('demos').addEventListener('click', (e) => {
  const li = (e.target as HTMLElement).closest<HTMLElement>('[role=option]');
  if (li) pickDemo(li);
});
// Clavier : flèches haut et bas d'une ligne à l'autre, Entrée ou Espace choisit
for (const [id, sel, pick] of [
  ['folders', '[role=treeitem]', pickFolder],
  ['demos', '[role=option]', pickDemo],
] as const)
  $(id).addEventListener('keydown', (e) => {
    const all = [...$(id).querySelectorAll<HTMLElement>(sel)];
    const i = all.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      return pick(all[i]!);
    }
    const to = e.key === 'ArrowDown' ? all[i + 1] : e.key === 'ArrowUp' ? all[i - 1] : null;
    if (!to) return;
    e.preventDefault();
    all[i]!.tabIndex = -1;
    to.tabIndex = 0;
    to.focus();
  });
$('demo-q').addEventListener('input', () => renderDest());
// « Changer » de la ligne Espace : la liste des espaces du menu ⋯
$('dest-ws-change').addEventListener('click', (e) => {
  e.stopPropagation();
  toggleMenu(true);
});

/**
 * L49 §2.1 : réglage « Captures HTML » de l'espace. Hors réglage, « HTML guidée » et « Sandbox » restent
 * visibles et désactivées, avec la raison ; la capture d'écran reste proposée. Le serveur refuse de toute façon.
 */
async function syncHtmlRule() {
  const ws = workspace.value;
  const [{ data }, [tab]] = await Promise.all([
    ws
      ? supabase.from('workspaces').select('settings').eq('id', ws).maybeSingle()
      : Promise.resolve({ data: null }),
    browser.tabs.query({ active: true, currentWindow: true }),
  ]);
  const rule = parseHtmlCapture((data?.settings as Record<string, unknown> | null)?.htmlCapture);
  htmlHost = '';
  try {
    const u = new URL(tab?.url ?? '');
    if (u.protocol === 'http:' || u.protocol === 'https:') htmlHost = u.hostname;
  } catch {
    /* onglet sans adresse : seul le mode « désactivées » s'applique ici */
  }
  htmlVerdict = rule.mode === 'disabled' || htmlHost ? htmlCaptureVerdict(rule, htmlHost) : 'ok';
  renderModes();
}

// ===== Vues : connexion, réglage de la capture, réglages de l'extension, capture en cours =====
type View = 'login' | 'setup' | 'dest' | 'settings' | 'recording';
function view(v: View) {
  for (const id of ['login', 'setup', 'dest', 'settings', 'recording']) show(id, id === v);
  show('foot-login', v === 'login');
  // Pied commun aux vues de la capture : Réglages, « Données vérifiées »
  show('foot-setup', v === 'setup' || v === 'dest' || v === 'settings');
  show('open-prefs', v !== 'settings');
  show('foot-recording', v === 'recording');
  // Hors session : ni réglages ni déconnexion dans le menu
  show('open-settings', v !== 'login');
  show('logout', v !== 'login');
  show('logout-sep', v !== 'login');
  show('ws-sec', v !== 'login' && spaces.length > 0);
}

async function render() {
  const status = await send<RecordingStatus>({ type: 'fd:status' });
  error(status.lastError);
  if (status.recording) {
    view('recording');
    $('count').textContent = stepsCaptured(status.steps);
    $('rec-label').textContent = status.paused ? strings.paused : strings.recording;
    $('rec-label').classList.toggle('paused', status.paused);
    $('pause-label').textContent = status.paused ? strings.resume : strings.pause;
    // EXT-02 §8.3 : capture lancée depuis l'éditeur : carte de cible, « Annuler l'ajout »
    const add = status.addTo;
    show('target', !!add);
    if (add) {
      $('target-title').textContent = (add.after ? strings.addCardAfter : strings.addCardStart)
        .replace('{{demo}}', add.title)
        .replace('{{n}}', String(add.after?.n ?? ''));
      $('target-after').textContent = add.after?.title ?? '';
    }
    $('cancel-label').textContent = add ? strings.addCancel : strings.cancel;
    const ico = $('pause').querySelector('svg');
    if (ico && ico.dataset.state !== String(status.paused)) {
      const fresh = document.createElement('i');
      fresh.setAttribute('data-lucide', status.paused ? 'play' : 'pause');
      ico.replaceWith(fresh);
      createIcons({
        icons: ICONS,
        attrs: {
          width: 16,
          height: 16,
          'stroke-width': 2,
          'aria-hidden': 'true',
          'data-state': String(status.paused),
        },
      });
    }
    return;
  }
  const { data } = await supabase.auth.getSession();
  if (!data.session) return view('login');
  if ($('settings').hidden && $('dest').hidden) view('setup');
  await loadWorkspaces();
  await Promise.all([loadFills(), syncHtmlRule(), loadDest(), syncAi()]);
  await syncAttach();
  await checkPage();
}

/** EXT-CONNECT : onglet ouvert depuis un Sandbox de l'app : capture HTML et espace du Sandbox présélectionnés. */
async function syncAttach() {
  const pendingAttach = (await browser.storage.local.get('fd.attach'))['fd.attach'] as
    PendingAttach | undefined;
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const a = attachFor(pendingAttach, tab?.url, Date.now());
  // EXT-02 §8 : cible posée par l'éditeur, en attente du démarrage (accès au site à accorder)
  const add = liveTarget(
    (await browser.storage.local.get(ADD_KEY))[ADD_KEY] as AddTarget | undefined,
    Date.now(),
  );
  const adding = add?.state === 'pending' ? add : null;
  $('attach-note').textContent = adding
    ? strings.addNote.replace('{{demo}}', adding.title)
    : strings.attachNote;
  show('attach-note', !!a || !!adding);
  addingTitle = adding?.title ?? '';
  preferred = null;
  if (adding) {
    if (workspace.options().some((o) => o.value === adding.workspaceId))
      workspace.set(adding.workspaceId, true);
    // La cible de l'éditeur vaut pour les captures d'écran
    preferred = 'clicks';
  }
  if (a) {
    if (workspace.options().some((o) => o.value === a.workspaceId)) workspace.set(a.workspaceId, true);
    if (htmlVerdict === 'ok') preferred = 'sandbox';
  }
  syncDest();
  renderModes();
}

// ===== Réglages de l'extension (EXT-02 §5) : cadre par défaut des captures, réglé par chaque personne =====
const frame = createSelect($<HTMLButtonElement>('frame'), {
  options: [
    { value: 'page', label: strings.framePage },
    { value: 'element', label: strings.frameElement },
    { value: 'zone', label: strings.frameZone },
  ],
  value: 'page',
  onChange: (v) => void browser.storage.local.set({ 'fd.frame': v }),
});
void browser.storage.local.get('fd.frame').then((r) => {
  const v = r['fd.frame'] as string | undefined;
  if (v) frame.set(v);
});
$('version').textContent = strings.versionLine.replace('{{v}}', browser.runtime.getManifest().version);
$('settings-back').setAttribute('aria-label', strings.back);
$('dest-back').setAttribute('aria-label', strings.back);
$('dest-change').setAttribute('aria-label', strings.destChangeLabel);
let prefsFrom: HTMLElement = $('open-prefs');
const openPrefs = (from: HTMLElement) => {
  prefsFrom = from;
  view('settings');
  $('settings-back').focus();
};
$('open-settings').addEventListener('click', () => openPrefs($('more')));
$('open-prefs').addEventListener('click', () => openPrefs($('open-prefs')));
$('settings-back').addEventListener('click', () => {
  view('setup');
  prefsFrom.focus();
});
$('dest-change').addEventListener('click', () => {
  view('dest');
  $('dest-back').focus();
});
$('dest-back').addEventListener('click', () => {
  view('setup');
  $('dest-change').focus();
});

$<HTMLAnchorElement>('signup-link').href = `${APP_URL.replace(/\/$/, '')}/#/signup`;

$('login').addEventListener('submit', async (e) => {
  e.preventDefault();
  error(null);
  const form = e.currentTarget as HTMLFormElement;
  const invalid = [...form.querySelectorAll<HTMLInputElement>('input')].find((i) => !i.checkValidity());
  if (invalid) {
    invalid.focus();
    return error(invalid.type === 'email' ? strings.email + ' ?' : strings.password + ' ?');
  }
  const { error: err } = await supabase.auth.signInWithPassword({
    email: $<HTMLInputElement>('email').value,
    password: $<HTMLInputElement>('password').value,
  });
  if (err) return error(err.message === 'Invalid login credentials' ? strings.badCredentials : err.message);
  await render();
});

$('logout').addEventListener('click', async () => {
  // L64 §1 : pendant une capture, la déconnexion demande une confirmation
  if (!$('recording').hidden) {
    show('logout-ask', true);
    $('logout-no').focus();
    return;
  }
  await supabase.auth.signOut();
  await render();
});
$('logout-no').addEventListener('click', () => show('logout-ask', false));
$('logout-yes').addEventListener('click', async () => {
  show('logout-ask', false);
  await send({ type: 'fd:cancel' });
  await supabase.auth.signOut();
  await render();
});

// ===== EXT-STORE §6 : autorisations facultatives (debugger, accès aux sites), demandées au démarrage =====
let need: PermissionNeed = { debugger: null, sites: false };
// Mobile passe par le mode « mobile » (captures d'écran) ; ailleurs, la taille actuelle
const sizeKey = () => (size === '1440x900' ? '1440x900' : 'current');
async function currentNeed(): Promise<PermissionNeed> {
  const [hasDebugger, hasSites, later] = await Promise.all([
    browser.permissions.contains({ permissions: ['debugger'] }),
    browser.permissions.contains({ origins: [ALL_SITES] }),
    browser.storage.local.get(FULL_LATER_KEY),
  ]);
  return permissionNeed({
    mode: mode(),
    size: sizeKey(),
    // Option B : rien à demander pour debugger (absent du manifeste ; taille par la fenêtre)
    hasDebugger: !DEBUGGER || hasDebugger,
    hasSites,
    fullLater: !!later[FULL_LATER_KEY],
  });
}
function denied(text: string | null, again: string | null = null) {
  show('perm-denied', !!text);
  $('perm-denied-text').textContent = text ?? '';
  show('perm-again', !!again);
  $('perm-again').textContent = again ?? '';
}
function showPanel(n: PermissionNeed) {
  const why = n.debugger
    ? strings[n.debugger === 'mobile' ? 'dbgWhyMobile' : n.debugger === 'size' ? 'dbgWhySize' : 'dbgWhyFull']
    : '';
  $('perm-why').textContent = [why, n.sites ? strings.dbgWhySites : ''].filter(Boolean).join(' ');
  const lines = [
    ...(n.debugger ? [strings.dbgWhat1, strings.dbgWhat2, strings.dbgWhat3] : []),
    ...(n.sites ? [strings.dbgWhatSites] : []),
  ];
  $('perm-what').replaceChildren(
    ...lines.map((l) => Object.assign(document.createElement('li'), { textContent: l })),
  );
  show('perm', true);
  show('foot-setup', false);
  $<HTMLButtonElement>('perm-allow').focus();
}
function hidePanel() {
  show('perm', false);
  show('foot-setup', true);
}
/** Après la réponse (fenêtre de Chrome ou « Pas maintenant ») : démarre, ou explique pourquoi pas. */
async function afterAnswer(n: PermissionNeed) {
  hidePanel();
  const [hasDebugger, hasSites] = await Promise.all([
    browser.permissions.contains({ permissions: ['debugger'] }),
    browser.permissions.contains({ origins: [ALL_SITES] }),
  ]);
  if (n.debugger && !hasDebugger) {
    if (!startsWithout(n.debugger)) return denied(strings.dbgDeniedMobile, strings.dbgAllow);
    if (n.debugger === 'full') await browser.storage.local.set({ [FULL_LATER_KEY]: true });
    denied(
      n.debugger === 'size' ? strings.dbgDeniedSize : strings.dbgDeniedFull,
      n.debugger === 'full' ? strings.dbgAllowFull : null,
    );
  } else if (n.sites && !hasSites) denied(strings.dbgDeniedSites);
  else denied(null);
  await startCapture(!DEBUGGER || hasDebugger);
}
// La demande doit partir du clic (geste de l'utilisateur) : aucun appel asynchrone avant elle
$('perm-allow').addEventListener('click', () => {
  const n = need;
  void browser.permissions
    .request({ permissions: n.debugger ? ['debugger'] : [], origins: n.sites ? [ALL_SITES] : [] })
    .catch(() => false)
    .then(() => afterAnswer(n));
});
$('perm-later').addEventListener('click', () => void afterAnswer(need));
/** Sous le type : « Format mobile » ou page entière déjà refusés (le choix de la personne reste intact). */
async function refreshDenied() {
  const n = await currentNeed();
  const later = !!(await browser.storage.local.get(FULL_LATER_KEY))[FULL_LATER_KEY];
  const hasDebugger = await browser.permissions.contains({ permissions: ['debugger'] });
  if (mode() === 'clicks' && later && !hasDebugger) denied(strings.dbgDeniedFull, strings.dbgAllowFull);
  else if (!n.debugger) denied(null);
}
void refreshDenied();
// « Autoriser » (Format mobile refusé) ou « Autoriser la page entière » : relance la demande
$('perm-again').addEventListener('click', () => {
  void browser.permissions
    .request({ permissions: ['debugger'] })
    .catch(() => false)
    .then(async (ok) => {
      if (!ok) return;
      await browser.storage.local.remove(FULL_LATER_KEY);
      denied(null);
    });
});

// ===== Démarrage : un clic sur un mode =====
let starting = false;
async function startMode(k: TypeKey) {
  if (starting) return;
  chosen = k;
  // Avertissement HTML (L49) : une seule fois, dans le popup, avant la première capture HTML ou Sandbox
  if ((k === 'html' || k === 'sandbox') && !(await browser.storage.local.get(NOTICE_KEY))[NOTICE_KEY]) {
    pendingNotice = k;
    show('notice', true);
    $('notice-ok').setAttribute('aria-checked', 'false');
    $('notice-ok').focus();
    return;
  }
  starting = true;
  try {
    if (!(await checkPage())) return;
    error(null);
    need = await currentNeed();
    if (need.debugger || need.sites) return showPanel(need);
    await startCapture(true);
  } catch (err) {
    error((err as Error).message);
  } finally {
    starting = false;
  }
}
const NOTICE_KEY = 'fd.htmlNoticeOk';
let pendingNotice: TypeKey | null = null;
$('notice-ok').addEventListener('click', () => {
  $('notice-ok').setAttribute('aria-checked', 'true');
  if (!pendingNotice) return;
  const k = pendingNotice;
  pendingNotice = null;
  show('notice', false);
  void browser.storage.local.set({ [NOTICE_KEY]: true }).then(() => startMode(k));
});

/** Démarre la capture ; sans `debugger`, la taille d'onglet reste celle de l'onglet (README §6.3). */
async function startCapture(hasDebugger: boolean) {
  error(null);
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url || !/^https?:/.test(tab.url)) return void (await checkPage());
    const workspaceId = workspace.value;
    const m = mode();
    // « HTML guidée » ou « Sandbox » : la vérification présélectionne cette sortie
    await browser.storage.local.set({
      'fd.lastWorkspace': workspaceId,
      'fd.lastMode': chosen,
      'fd.htmlKind': typeKey() === 'sandbox' ? 'sandbox' : typeKey() === 'html' ? 'guided' : null,
    });
    let streamId: string | undefined;
    if (m === 'video') {
      // L'identifiant du flux s'obtient depuis un geste dans la popup (onglet courant uniquement)
      streamId = await (
        browser as unknown as {
          tabCapture: { getMediaStreamId(o: { targetTabId: number }): Promise<string> };
        }
      ).tabCapture.getMediaStreamId({ targetTabId: tab.id });
    }
    await send({
      type: 'fd:start',
      workspaceId,
      // La démo prend le titre de l'onglet ; elle se renomme dans l'éditeur
      title: (tab.title ?? '').trim().slice(0, 160),
      tabId: tab.id,
      mode: m,
      streamId,
      mic: m === 'video' && mic.checked,
      webcam: m === 'video' && webcam.checked,
      liveMask: m === 'video' && liveMask.checked,
      viewport: m === 'mobile' ? viewport() : undefined,
      followTabs: m !== 'video' && follow.checked,
      // Démo à compléter choisie dans « Ajouter à une démo » : capture guidée de ses étapes « À capturer »
      fill: m === 'clicks' && destKind === 'append' ? (fillOf(appendDemo?.id) ?? null) : null,
      // L64 §2 : dossier de la nouvelle démo, ou démo existante (étapes à la fin)
      folderId: destKind === 'new' ? folderId : null,
      appendDemo: destKind === 'append' ? appendDemo : null,
      autoDraft: aiAllowed && autoDraft.checked && (m === 'clicks' || m === 'mobile'),
      size:
        (m === 'clicks' || m === 'html') && hasDebugger
          ? tabSize(sizeKey() as TabSizeKey, { w: 0, h: 0 })
          : null,
    });
    await render();
  } catch (err) {
    error((err as Error).message);
  }
}

$('pause').addEventListener('click', async () => {
  await send({ type: 'fd:pause' });
  await render();
});

// Annuler la capture : confirmation dans le popup (pas de fenêtre du navigateur)
$('cancel').addEventListener('click', () => {
  show('cancel-ask', true);
  $('cancel-no').focus();
});
$('cancel-no').addEventListener('click', () => {
  show('cancel-ask', false);
  $('cancel').focus();
});
$('cancel-yes').addEventListener('click', async () => {
  show('cancel-ask', false);
  await send({ type: 'fd:cancel' });
  await render();
});

$('stop').addEventListener('click', async () => {
  await send({ type: 'fd:stop' });
  window.close();
});

void render();
setInterval(() => {
  if (!$('recording').hidden) void render();
}, 1000);
