import '@flowdsiml/ui/tokens.css';
import '@flowdsiml/ui/select.css';
import './style.css';
import { browser } from 'wxt/browser';
import { supabase } from '@/lib/supabase';
import { APP_URL } from '@/lib/config';
import { APP_NAME } from '@flowdsiml/core';
import type { CaptureMode, FillTarget, PopupRequest, RecordingStatus } from '@/lib/messages';
import { lang, stepsCaptured, strings } from '@/lib/i18n';
import {
  Check,
  Code,
  EyeOff,
  Film,
  Layers,
  LogIn,
  LogOut,
  MousePointerClick,
  Pause,
  Play,
  Smartphone,
  Video,
  X,
  createIcons,
} from 'lucide';
import { viewportFor, type DeviceKey } from '@/lib/video';
import { tabSize, type TabSizeKey } from '@/lib/fullpage';

document.documentElement.lang = lang;
document.title = APP_NAME;
for (const el of document.querySelectorAll<HTMLElement>('[data-app-name]')) el.textContent = APP_NAME;
for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]'))
  el.textContent = strings[el.dataset.i18n as keyof typeof strings];
(document.getElementById('title') as HTMLInputElement).placeholder = strings.demoTitlePlaceholder;
const ICONS = {
  Check,
  Code,
  EyeOff,
  Film,
  Layers,
  LogIn,
  LogOut,
  MousePointerClick,
  Pause,
  Play,
  Smartphone,
  Video,
  X,
};
createIcons({ icons: ICONS, attrs: { width: 16, height: 16, 'stroke-width': 2, 'aria-hidden': 'true' } });

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const show = (id: string, visible: boolean) => ($(id).hidden = !visible);

// F7 : type de capture (clics, vidéo de l'onglet, format mobile)
const mode = (): CaptureMode =>
  (document.querySelector<HTMLInputElement>('input[name="mode"]:checked')?.value as CaptureMode) ?? 'clicks';
function syncMode() {
  const m = mode();
  show('opt-video', m === 'video');
  show('opt-mobile', m === 'mobile');
  show('opt-html', m === 'html');
  // L25-01 : multi-onglets et taille pour les captures d'écran et HTML ; taille masquée en mobile
  show('opt-desk', m !== 'video');
  show('size-field', m === 'clicks' || m === 'html');
  show('opt-full', m === 'clicks' || m === 'mobile');
  // L25-01 : l'aide de la vérification est portée par l'interrupteur « Vérifier les données »
  show('hint', false);
  for (const el of document.querySelectorAll<HTMLElement>('.start-ico')) el.hidden = el.dataset.for !== m;
  $('start-label').textContent =
    m === 'video'
      ? strings.startVideo
      : m === 'mobile'
        ? strings.startMobile
        : m === 'html'
          ? strings.startHtml
          : strings.start;
}
for (const r of document.querySelectorAll<HTMLInputElement>('input[name="mode"]'))
  r.addEventListener('change', () => {
    syncMode();
    syncFill();
    void browser.storage.local.set({ 'fd.lastMode': mode() });
  });
$<HTMLSelectElement>('tabsize').addEventListener('change', () => {
  const custom = $<HTMLSelectElement>('tabsize').value === 'custom';
  show('desk-size', custom);
  show('desk-range', custom);
});
// « Taille actuelle · 1 512 × 862 » : taille de l'onglet courant
void browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  if (tab?.width && tab.height)
    $('tabsize-current').textContent = strings.tabSizeCurrentWH
      .replace('{{w}}', tab.width.toLocaleString(lang))
      .replace('{{h}}', tab.height.toLocaleString(lang));
});
$<HTMLSelectElement>('device').addEventListener('change', () =>
  show('custom-size', $<HTMLSelectElement>('device').value === 'custom'),
);
function viewport(): { w: number; h: number } {
  const landscape =
    document.querySelector<HTMLInputElement>('input[name="orient"]:checked')?.value === 'landscape';
  return viewportFor($<HTMLSelectElement>('device').value as DeviceKey, landscape, {
    w: +$<HTMLInputElement>('vw').value || 390,
    h: +$<HTMLInputElement>('vh').value || 844,
  });
}
void browser.storage.local.get('fd.lastMode').then((r) => {
  const saved = r['fd.lastMode'] as string | undefined;
  const input = document.querySelector<HTMLInputElement>(`input[name="mode"][value="${saved}"]`);
  if (input) input.checked = true;
  syncMode();
});
syncMode();

function error(msg: string | null) {
  const el = $('error');
  el.textContent = msg ?? '';
  el.hidden = !msg;
}

function send<T>(req: PopupRequest): Promise<T> {
  return browser.runtime.sendMessage(req) as Promise<T>;
}

async function loadWorkspaces() {
  const { data: u } = await supabase.auth.getUser();
  // L26-01 : « Installer l'extension » se coche quand l'extension a répondu au moins une fois
  void supabase.rpc('extension_seen').then(() => undefined);
  const { data, error: err } = await supabase
    .from('members')
    .select('role, workspaces(id, name)')
    .eq('user_id', u.user!.id)
    .in('role', ['editor', 'admin', 'owner']);
  if (err) return error(err.message);
  const select = $<HTMLSelectElement>('workspace');
  select.innerHTML = '';
  for (const m of data ?? []) {
    const ws = m.workspaces as unknown as { id: string; name: string } | null;
    if (!ws) continue;
    const o = document.createElement('option');
    o.value = ws.id;
    o.textContent = ws.name;
    select.appendChild(o);
  }
  if (!select.options.length) error(strings.noWorkspace);
  const saved = (await browser.storage.local.get('fd.lastWorkspace'))['fd.lastWorkspace'] as
    string | undefined;
  if (saved && [...select.options].some((o) => o.value === saved)) select.value = saved;
}

// L26-04 : démos de l'espace qui ont des étapes « À capturer » (capture guidée)
let fills: FillTarget[] = [];
async function loadFills() {
  const ws = $<HTMLSelectElement>('workspace').value;
  const select = $<HTMLSelectElement>('fill');
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
  select.innerHTML = '';
  const none = document.createElement('option');
  none.value = '';
  none.textContent = strings.fillNew;
  select.appendChild(none);
  for (const f of fills) {
    const o = document.createElement('option');
    o.value = f.demoId;
    o.textContent = strings.fillOption
      .replace('{{title}}', f.title)
      .replace('{{count}}', String(f.steps.length));
    select.appendChild(o);
  }
  show('fill-field', fills.length > 0);
  syncFill();
}
function syncFill() {
  const filling = !!$<HTMLSelectElement>('fill').value && mode() === 'clicks';
  show('title-field', !filling);
}
$<HTMLSelectElement>('workspace').addEventListener('change', () => void loadFills());
$<HTMLSelectElement>('fill').addEventListener('change', syncFill);

async function render() {
  const status = await send<RecordingStatus>({ type: 'fd:status' });
  error(status.lastError);
  if (status.recording) {
    show('login', false);
    show('setup', false);
    show('recording', true);
    $('count').textContent = stepsCaptured(status.steps);
    $('rec-label').textContent = status.paused ? strings.paused : strings.recording;
    $('rec-label').classList.toggle('paused', status.paused);
    $('pause-label').textContent = status.paused ? strings.resume : strings.pause;
    const icon = $('pause').querySelector('svg');
    if (icon && icon.dataset.state !== String(status.paused)) {
      const fresh = document.createElement('i');
      fresh.setAttribute('data-lucide', status.paused ? 'play' : 'pause');
      icon.replaceWith(fresh);
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
  show('recording', false);
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    show('setup', false);
    show('login', true);
    return;
  }
  show('login', false);
  show('setup', true);
  await loadWorkspaces();
  await loadFills();
}

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
  if (err)
    return error(
      err.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect.' : err.message,
    );
  await render();
});

$('logout').addEventListener('click', async (e) => {
  e.preventDefault();
  await supabase.auth.signOut();
  await render();
});

$('start').addEventListener('click', async () => {
  const btn = $<HTMLButtonElement>('start');
  btn.disabled = true;
  error(null);
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url || !/^https?:/.test(tab.url))
      throw new Error('Ouvrez une page web (http/https) à enregistrer.');
    const workspaceId = $<HTMLSelectElement>('workspace').value;
    await browser.storage.local.set({ 'fd.lastWorkspace': workspaceId });
    const m = mode();
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
      mic: m === 'video' && $<HTMLInputElement>('mic').checked,
      webcam: m === 'video' && $<HTMLInputElement>('webcam').checked,
      viewport: m === 'mobile' ? viewport() : undefined,
      followTabs: m !== 'video' && $<HTMLInputElement>('follow').checked,
      fill:
        m === 'clicks' ? (fills.find((f) => f.demoId === $<HTMLSelectElement>('fill').value) ?? null) : null,
      size:
        m === 'clicks' || m === 'html'
          ? tabSize($<HTMLSelectElement>('tabsize').value as TabSizeKey, {
              w: +$<HTMLInputElement>('dw').value,
              h: +$<HTMLInputElement>('dh').value,
            })
          : null,
    });
    await render();
  } catch (err) {
    error((err as Error).message);
  } finally {
    btn.disabled = false;
  }
});

$('pause').addEventListener('click', async () => {
  await send({ type: 'fd:pause' });
  await render();
});

$('cancel').addEventListener('click', async () => {
  if (!confirm(strings.confirmCancel)) return;
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
