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
  CircleQuestionMark,
  Code,
  Crop,
  Ellipsis,
  ExternalLink,
  EyeOff,
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
  TriangleAlert,
  Video,
  Webcam,
  X,
  createIcons,
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
import { createSelect, createSwitch, installHelps, type Option } from './ui';

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
  CircleQuestionMark,
  Crop,
  Ellipsis,
  ExternalLink,
  EyeOff,
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
  TriangleAlert,
  Webcam,
  X,
};
createIcons({ icons: ICONS, attrs: { width: 16, height: 16, 'stroke-width': 2, 'aria-hidden': 'true' } });
for (const svg of document.querySelectorAll<SVGElement>('.pph .ib svg')) {
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const show = (id: string, visible: boolean) => ($(id).hidden = !visible);
const app = APP_URL.replace(/\/$/, '');

($('title') as HTMLInputElement).placeholder = strings.demoTitlePlaceholder;
// Aides « ? » : nom accessible « Aide : <libellé de la ligne> »
for (const q of document.querySelectorAll<HTMLButtonElement>('button.q[data-help]'))
  q.setAttribute(
    'aria-label',
    strings.helpFor.replace('{{label}}', strings[q.dataset.help as keyof typeof strings]),
  );
installHelps($('opts-body'));
if (!DEBUGGER) $('tabsize-h').textContent = strings.tabSizeHelpWindow;

// ===== En-tête : aide (nouvel onglet) et menu ⋯ =====
$<HTMLAnchorElement>('help').href = `${app}/#/extension`;
$('help').setAttribute('aria-label', strings.helpTab);
$('more').setAttribute('aria-label', strings.more);
$<HTMLAnchorElement>('open-app').href = `${app}/`;
$('open-app').querySelector('span')!.textContent = strings.openApp;
const menu = $('more-menu');
const menuItems = () => [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([hidden])')];
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

// ===== Type de capture (liste décrite). « HTML guidée » et « Sandbox » sont deux sorties de la capture HTML =====
type TypeKey = 'clicks' | 'html' | 'sandbox' | 'video' | 'mobile';
let htmlVerdict: 'ok' | 'disabled' | 'domain' = 'ok';
let htmlHost = '';
const typeOptions = (): Option[] => [
  { value: 'clicks', label: strings.tClicks, desc: strings.tClicksD, icon: MousePointerClick },
  { value: 'html', label: strings.tHtml, desc: strings.tHtmlD, icon: Code, disabled: htmlVerdict !== 'ok' },
  {
    value: 'sandbox',
    label: strings.tSandbox,
    desc: strings.tSandboxD,
    icon: Box,
    disabled: htmlVerdict !== 'ok',
  },
  { value: 'video', label: strings.tVideo, desc: strings.tVideoD, icon: Video },
  // EXT-STORE, option B : sans l'outil de débogage, Format mobile reste visible en « Bientôt »
  {
    value: 'mobile',
    label: strings.typeMobile,
    desc: DEBUGGER ? strings.typeMobileHelp : strings.typeMobileSoonHelp,
    icon: Smartphone,
    disabled: !DEBUGGER,
    pill: strings.soon,
  },
];
const type = createSelect($<HTMLButtonElement>('type'), {
  options: typeOptions(),
  value: 'clicks',
  described: true,
  onChange: () => {
    syncMode();
    syncFill();
    void browser.storage.local.set({ 'fd.lastMode': type.value });
    void refreshDenied();
  },
});
const typeKey = () => type.value as TypeKey;
const mode = (): CaptureMode => (typeKey() === 'sandbox' ? 'html' : (typeKey() as CaptureMode));

// ===== Options =====
const tabsize = createSelect($<HTMLButtonElement>('tabsize'), {
  options: [
    { value: 'current', label: strings.sizeCurrentShort },
    { value: '1280x720', label: '1 280 × 720' },
    { value: '1440x900', label: '1 440 × 900' },
    { value: '1920x1080', label: '1 920 × 1 080' },
    { value: 'custom', label: strings.sizeCustomShort },
  ],
  value: 'current',
  onChange: () => syncMode(),
});
const device = createSelect($<HTMLButtonElement>('device'), {
  options: [
    { value: 'phone', label: strings.devicePhone },
    { value: 'large', label: strings.deviceLarge },
    { value: 'tablet', label: strings.deviceTablet },
    { value: 'custom', label: strings.deviceCustom },
  ],
  value: 'phone',
  onChange: () => syncMode(),
});
const orient = createSelect($<HTMLButtonElement>('orient'), {
  options: [
    { value: 'portrait', label: strings.portrait },
    { value: 'landscape', label: strings.landscape },
  ],
  value: 'portrait',
});
const follow = createSwitch($<HTMLButtonElement>('follow'), { onChange: () => syncSummary() });
const mic = createSwitch($<HTMLButtonElement>('mic'), { onChange: () => syncSummary() });
const webcam = createSwitch($<HTMLButtonElement>('webcam'), { onChange: () => syncSummary() });
// EXT-02 §4.2 : « Masquer en direct », désactivé par défaut, choix mémorisé
const liveMask = createSwitch($<HTMLButtonElement>('live-mask'), {
  onChange: (on) => {
    void browser.storage.local.set({ 'fd.liveMask': on });
    syncSummary();
  },
});
void browser.storage.local.get('fd.liveMask').then((r) => {
  liveMask.checked = r['fd.liveMask'] === true;
  syncSummary();
});
$('opts-toggle').addEventListener('click', () => {
  const open = $('opts-toggle').getAttribute('aria-expanded') !== 'true';
  $('opts-toggle').setAttribute('aria-expanded', String(open));
  show('opts-body', open);
  syncSummary();
});
for (const id of ['dw', 'dh', 'vw', 'vh'])
  $<HTMLInputElement>(id).addEventListener('input', (e) => {
    const el = e.currentTarget as HTMLInputElement;
    el.value = el.value.replace(/\D/g, '');
  });

/** Repliée, la section dit ses réglages en une ligne (« Taille actuelle, nouveaux onglets suivis »). */
function syncSummary() {
  const m = mode();
  const size = tabsize.options().find((o) => o.value === tabsize.value)?.label ?? '';
  const parts =
    m === 'video'
      ? [
          mic.checked ? strings.sumMicOn : strings.sumMicOff,
          webcam.checked ? strings.sumCamOn : strings.sumCamOff,
          ...(liveMask.checked ? [strings.sumMaskOn] : []),
        ]
      : [
          m === 'mobile'
            ? (device.options().find((o) => o.value === device.value)?.label ?? '')
            : tabsize.value === 'current'
              ? strings.sumSizeCurrent
              : tabsize.value === 'custom'
                ? strings.sumSizeCustom
                : strings.sumSize.replace('{{s}}', size),
          follow.checked ? strings.sumFollowOn : strings.sumFollowOff,
        ];
  const text = parts.join(', ');
  $('opts-sum').textContent =
    $('opts-toggle').getAttribute('aria-expanded') === 'true'
      ? ''
      : text.charAt(0).toUpperCase() + text.slice(1);
}
function syncMode() {
  const m = mode();
  const group = m === 'video' ? 'video' : m === 'mobile' ? 'mobile' : 'desk';
  for (const el of document.querySelectorAll<HTMLElement>('#opts-body [data-for]')) {
    const tags = el.dataset.for!.split(' ');
    // Format mobile suit aussi les nouveaux onglets ; la taille d'onglet ne vaut pas pour lui
    const on =
      (tags.includes(group) || (m === 'mobile' && tags.includes('desk') && !tags.includes('size'))) &&
      !(m === 'mobile' && tags.includes('size'));
    // Une aide ne s'affiche que dépliée par son bouton
    if (el.classList.contains('hlp')) {
      if (!on) el.hidden = true;
    } else el.hidden = !on;
  }
  for (const q of document.querySelectorAll<HTMLButtonElement>('#opts-body button.q'))
    if (document.getElementById(q.getAttribute('aria-controls')!)?.hidden)
      q.setAttribute('aria-expanded', 'false');
  show('desk-size', m !== 'video' && m !== 'mobile' && tabsize.value === 'custom');
  show('custom-size', m === 'mobile' && device.value === 'custom');
  show('full-row', !DEBUGGER && m === 'clicks');
  // Raison d'une capture HTML refusée par la règle de l'espace (L49 §2.1)
  const note =
    htmlVerdict === 'disabled'
      ? strings.htmlBlockedDisabled
      : htmlVerdict === 'domain'
        ? strings.htmlBlockedDomain.replace('{{domain}}', htmlHost)
        : '';
  $('type-note').textContent = note;
  show('type-note', !!note);
  syncSummary();
}
// « Actuelle · 1 512 × 862 » : taille de l'onglet courant, dans la liste
void browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  if (!tab?.width || !tab.height) return;
  const opts = tabsize.options();
  opts[0] = {
    ...opts[0]!,
    desc: `${tab.width.toLocaleString(lang)} × ${tab.height.toLocaleString(lang)}`,
  };
  tabsize.setOptions(opts);
});
function viewport(): { w: number; h: number } {
  return viewportFor(device.value as DeviceKey, orient.value === 'landscape', {
    w: +$<HTMLInputElement>('vw').value || 390,
    h: +$<HTMLInputElement>('vh').value || 844,
  });
}
void browser.storage.local.get('fd.lastMode').then((r) => {
  const saved = r['fd.lastMode'] as string | undefined;
  if (saved && type.options().some((o) => o.value === saved && !o.disabled)) type.set(saved);
  syncMode();
});
syncMode();

// ===== Bandeau d'erreur (EXT-02 §1.3) : titre, phrase, action ; « Démarrer » désactivé, jamais masqué =====
type Problem = { title?: string; text: string; retry?: boolean; blocking?: boolean };
let blocked = false;
function problem(p: Problem | null) {
  $('error-title').textContent = p?.title ?? '';
  $('error-text').textContent = p ? ` ${p.text} ` : '';
  show('error-retry', !!p?.retry);
  $('error').hidden = !p;
  blocked = !!p?.blocking;
  $('start').setAttribute('aria-disabled', String(blocked));
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
  const { data, error: err } = await supabase
    .from('members')
    .select('role, workspaces(id, name)')
    .eq('user_id', u.user!.id)
    .in('role', ['editor', 'admin', 'owner']);
  if (err) return error(err.message);
  const opts: Option[] = [];
  for (const m of data ?? []) {
    const ws = m.workspaces as unknown as { id: string; name: string } | null;
    if (ws) opts.push({ value: ws.id, label: ws.name });
  }
  workspace.setOptions(opts);
  if (!opts.length) problem({ text: strings.noWorkspace, blocking: true });
  const saved = (await browser.storage.local.get('fd.lastWorkspace'))['fd.lastWorkspace'] as
    string | undefined;
  if (saved) workspace.set(saved);
  show('workspace', opts.length > 1);
  show('workspace-one', opts.length === 1);
  $('workspace-one').querySelector('span')!.textContent = opts[0]?.label ?? '';
  show('workspace-field', opts.length > 0);
}

// L26-04 : démos de l'espace qui ont des étapes « À capturer » (capture guidée)
let fills: FillTarget[] = [];
const fill = createSelect($<HTMLButtonElement>('fill'), {
  options: [{ value: '', label: strings.fillNew }],
  value: '',
  onChange: () => syncFill(),
});
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
  fill.setOptions([
    { value: '', label: strings.fillNew },
    ...fills.map((f) => ({
      value: f.demoId,
      label: strings.fillOption.replace('{{title}}', f.title).replace('{{count}}', String(f.steps.length)),
    })),
  ]);
  syncFill();
}
function syncFill() {
  show('fill-field', fills.length > 0 && mode() === 'clicks');
  show('title-field', !(fill.value && mode() === 'clicks'));
}

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
  type.setOptions(typeOptions());
  syncMode();
}

// ===== Vues : connexion, réglage de la capture, réglages de l'extension, capture en cours =====
type View = 'login' | 'setup' | 'settings' | 'recording';
function view(v: View) {
  for (const id of ['login', 'setup', 'settings', 'recording']) show(id, id === v);
  show('foot-login', v === 'login');
  show('foot-setup', v === 'setup');
  show('foot-recording', v === 'recording');
  // Hors session : ni réglages ni déconnexion dans le menu
  show('open-settings', v !== 'login');
  show('logout', v !== 'login');
  menu.querySelector('hr')!.hidden = v === 'login';
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
  if ($('settings').hidden) view('setup');
  await loadWorkspaces();
  await Promise.all([loadFills(), syncHtmlRule()]);
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
  show('title-field', !adding && !(fill.value && mode() === 'clicks'));
  if (adding) {
    if (workspace.options().some((o) => o.value === adding.workspaceId))
      workspace.set(adding.workspaceId, true);
    if (mode() !== 'clicks') type.set('clicks', true);
  }
  if (!a) return;
  if (workspace.options().some((o) => o.value === a.workspaceId)) workspace.set(a.workspaceId, true);
  if (htmlVerdict === 'ok' && mode() !== 'html') type.set('sandbox', true);
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
$('open-settings').addEventListener('click', () => {
  view('settings');
  $('settings-back').focus();
});
$('settings-back').addEventListener('click', () => {
  view('setup');
  $('more').focus();
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
  await supabase.auth.signOut();
  await render();
});

// ===== EXT-STORE §6 : autorisations facultatives (debugger, accès aux sites), demandées au démarrage =====
let need: PermissionNeed = { debugger: null, sites: false };
const sizeKey = () => tabsize.value;
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

$('start').addEventListener('click', async () => {
  const btn = $<HTMLButtonElement>('start');
  if (btn.getAttribute('aria-disabled') === 'true' || btn.dataset.busy) return;
  btn.dataset.busy = '1';
  try {
    if (!(await checkPage())) return;
    error(null);
    need = await currentNeed();
    if (need.debugger || need.sites) return showPanel(need);
    await startCapture(true);
  } catch (err) {
    error((err as Error).message);
  } finally {
    delete btn.dataset.busy;
  }
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
      title: $<HTMLInputElement>('title').value.trim(),
      tabId: tab.id,
      mode: m,
      streamId,
      mic: m === 'video' && mic.checked,
      webcam: m === 'video' && webcam.checked,
      liveMask: m === 'video' && liveMask.checked,
      viewport: m === 'mobile' ? viewport() : undefined,
      followTabs: m !== 'video' && follow.checked,
      fill: m === 'clicks' ? (fills.find((f) => f.demoId === fill.value) ?? null) : null,
      size:
        (m === 'clicks' || m === 'html') && hasDebugger
          ? tabSize(tabsize.value as TabSizeKey, {
              w: +$<HTMLInputElement>('dw').value,
              h: +$<HTMLInputElement>('dh').value,
            })
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
