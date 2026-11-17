import { browser } from 'wxt/browser';
import { supabase } from '@/lib/supabase';
import { APP_URL } from '@/lib/config';
import type { PopupRequest, RecordingStatus } from '@/lib/messages';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const show = (id: string, visible: boolean) => ($(id).hidden = !visible);

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
  if (!select.options.length) error("Aucun workspace où vous êtes éditeur. Créez-en un dans l'application.");
  const saved = (await browser.storage.local.get('fd.lastWorkspace'))['fd.lastWorkspace'] as
    string | undefined;
  if (saved && [...select.options].some((o) => o.value === saved)) select.value = saved;
}

async function render() {
  const status = await send<RecordingStatus>({ type: 'fd:status' });
  error(status.lastError);
  if (status.recording) {
    show('login', false);
    show('setup', false);
    show('recording', true);
    $('count').textContent = String(status.steps);
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
}

$<HTMLAnchorElement>('signup-link').href = `${APP_URL.replace(/\/$/, '')}/#/signup`;

$('login').addEventListener('submit', async (e) => {
  e.preventDefault();
  error(null);
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
    await send({
      type: 'fd:start',
      workspaceId,
      title: $<HTMLInputElement>('title').value.trim(),
      tabId: tab.id,
    });
    await render();
  } catch (err) {
    error((err as Error).message);
  } finally {
    btn.disabled = false;
  }
});

$('stop').addEventListener('click', async () => {
  await send({ type: 'fd:stop' });
  window.close();
});

void render();
setInterval(() => {
  if (!$('recording').hidden) void render();
}, 1000);
