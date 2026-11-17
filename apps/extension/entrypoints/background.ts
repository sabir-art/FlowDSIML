import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { supabase } from '@/lib/supabase';
import { APP_URL } from '@/lib/config';
import { defaultHotspotTitle, hotspotRect, toRelRect } from '@/lib/geometry';
import { pngDataUrlToWebp } from '@/lib/image';
import type { Json } from '@flowdsiml/supabase-types';
import type { ClickPayload, PopupRequest, RecordingStatus } from '@/lib/messages';

/**
 * Service worker MV3. L'état d'enregistrement vit dans storage.session (le worker peut être arrêté).
 * Chaque clic → capture → WebP → upload Storage (captures/<ws>/<demo>/<id>.webp) → insertion step + hotspot.
 * Rien n'est gardé en mémoire : un arrêt du worker ne perd pas les étapes déjà envoyées.
 */
const KEY = 'fd.recording';
const EMPTY: RecordingStatus = {
  recording: false,
  paused: false,
  demoId: null,
  workspaceId: null,
  tabId: null,
  steps: 0,
  lastError: null,
};

async function getState(): Promise<RecordingStatus> {
  const r = await browser.storage.session.get(KEY);
  return { ...EMPTY, ...((r[KEY] as RecordingStatus | undefined) ?? {}) };
}
async function setState(patch: Partial<RecordingStatus>): Promise<RecordingStatus> {
  const next = { ...(await getState()), ...patch };
  await browser.storage.session.set({ [KEY]: next });
  await browser.action.setBadgeText({ text: next.recording ? String(next.steps) : '' });
  await browser.action.setBadgeBackgroundColor({ color: '#d93f4c' });
  return next;
}

async function inject(tabId: number) {
  try {
    await browser.scripting.executeScript({ target: { tabId }, files: ['/content-scripts/recorder.js'] });
  } catch {
    /* pages internes (chrome://, Web Store) : capture impossible */
  }
}

// File d'attente : Chrome limite captureVisibleTab à ~2 appels/seconde.
let chain: Promise<unknown> = Promise.resolve();
let lastCapture = 0;
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const p = chain.then(async () => {
    const wait = 550 - (Date.now() - lastCapture);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCapture = Date.now();
    return fn();
  });
  chain = p.catch(() => undefined);
  return p;
}

async function handleClick(msg: ClickPayload, windowId: number) {
  const state = await getState();
  if (!state.recording || state.paused || !state.demoId || !state.workspaceId) return;
  try {
    const dataUrl = await enqueue(() => browser.tabs.captureVisibleTab(windowId, { format: 'png' }));
    const { blob, width, height } = await pngDataUrlToWebp(dataUrl);
    const stepId = crypto.randomUUID();
    const path = `${state.workspaceId}/${state.demoId}/${stepId}.webp`;
    const up = await supabase.storage
      .from('captures')
      .upload(path, blob, { contentType: 'image/webp', upsert: false });
    if (up.error) throw up.error;

    const position = (await getState()).steps;
    const blurs = msg.sensitive
      .map((r) => toRelRect(r, msg.viewport))
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const ins = await supabase.from('steps').insert({
      id: stepId,
      demo_id: state.demoId,
      workspace_id: state.workspaceId,
      position,
      kind: 'image',
      image_path: path,
      image_width: width,
      image_height: height,
      title: msg.title.slice(0, 200),
      page_url: msg.url.slice(0, 2000),
      page_title: msg.title.slice(0, 300),
      blurs: blurs as unknown as NonNullable<Json>,
      element_meta: JSON.parse(
        JSON.stringify({
          selector: msg.selector,
          tag: msg.tag,
          label: msg.label,
          element: msg.element,
          viewport: msg.viewport,
          dpr: msg.dpr,
          click: msg.click,
        }),
      ) as NonNullable<Json>,
    });
    if (ins.error) throw ins.error;
    const hs = hotspotRect(msg.click, msg.element, msg.viewport);
    const hot = await supabase.from('hotspots').insert({
      step_id: stepId,
      demo_id: state.demoId,
      workspace_id: state.workspaceId,
      ...hs,
      title: defaultHotspotTitle(msg.label),
    });
    if (hot.error) throw hot.error;
    await setState({ steps: position + 1, lastError: null });
  } catch (e) {
    await setState({
      lastError: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e),
    });
  }
}

async function start(req: Extract<PopupRequest, { type: 'fd:start' }>): Promise<RecordingStatus> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Non connecté');
  const { data, error } = await supabase
    .from('demos')
    .insert({ workspace_id: req.workspaceId, title: req.title || 'Nouvelle démo', created_by: auth.user.id })
    .select('id')
    .single();
  if (error) throw error;
  const state = await setState({
    recording: true,
    demoId: data.id,
    workspaceId: req.workspaceId,
    tabId: req.tabId,
    steps: 0,
    lastError: null,
  });
  await inject(req.tabId);
  return state;
}

async function stop(): Promise<RecordingStatus> {
  const state = await getState();
  if (state.tabId !== null) {
    await browser.tabs.sendMessage(state.tabId, { type: 'fd:recorder-stop' }).catch(() => undefined);
  }
  if (state.demoId) {
    await browser.tabs.create({ url: `${APP_URL.replace(/\/$/, '')}/#/demos/${state.demoId}/edit` });
  }
  return setState({ ...EMPTY });
}

/** Annule : arrête la capture et supprime la démo créée (et ses étapes, en cascade). */
async function cancel(): Promise<RecordingStatus> {
  const state = await getState();
  if (state.tabId !== null)
    await browser.tabs.sendMessage(state.tabId, { type: 'fd:recorder-stop' }).catch(() => undefined);
  if (state.demoId) {
    await supabase.from('demos').delete().eq('id', state.demoId);
    if (state.workspaceId) {
      const dir = `${state.workspaceId}/${state.demoId}`;
      const { data } = await supabase.storage.from('captures').list(dir);
      if (data?.length) await supabase.storage.from('captures').remove(data.map((f) => `${dir}/${f.name}`));
    }
  }
  return setState({ ...EMPTY });
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((msg: unknown, sender) => {
    const m = msg as ClickPayload | PopupRequest;
    if (m.type === 'fd:click') {
      if (sender.tab?.windowId !== undefined) void handleClick(m, sender.tab.windowId);
      return undefined;
    }
    if (m.type === 'fd:status') return getState();
    if (m.type === 'fd:start')
      return start(m).catch((e: unknown) => setState({ lastError: (e as Error).message ?? String(e) }));
    if (m.type === 'fd:stop') return stop();
    if (m.type === 'fd:pause') return getState().then((s) => setState({ paused: !s.paused }));
    if (m.type === 'fd:cancel') return cancel();
    return undefined;
  });

  // Réinjection après navigation dans l'onglet enregistré.
  browser.tabs.onUpdated.addListener((tabId, info) => {
    if (info.status !== 'complete') return;
    void getState().then((s) => {
      if (s.recording && s.tabId === tabId) void inject(tabId);
    });
  });
  browser.tabs.onRemoved.addListener((tabId) => {
    void getState().then((s) => {
      if (s.recording && s.tabId === tabId) void stop();
    });
  });
});
