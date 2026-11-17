import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { supabase } from '@/lib/supabase';
import { toRelRect } from '@/lib/geometry';
import { pending } from '@/lib/pending';
import type { ClickPayload, PopupRequest, RecordingStatus } from '@/lib/messages';

/**
 * Service worker MV3. L'état d'enregistrement vit dans storage.session (le worker peut être arrêté).
 * Chaque clic → capture PNG gardée dans IndexedDB avec les détections (spec f1-formation §1).
 * Rien n'est envoyé pendant la capture : à la fin, l'écran de vérification (review.html) floute les
 * pixels puis envoie. Un arrêt du worker ne perd pas les captures déjà prises.
 */
const KEY = 'fd.recording';
const EMPTY: RecordingStatus = {
  recording: false,
  paused: false,
  demoId: null,
  workspaceId: null,
  title: '',
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
  if (!state.recording || state.paused || !state.workspaceId) return;
  try {
    const dataUrl = await enqueue(() => browser.tabs.captureVisibleTab(windowId, { format: 'png' }));
    const image = await (await fetch(dataUrl)).blob();
    const bitmap = await createImageBitmap(image);
    const { width, height } = bitmap;
    bitmap.close();
    const order = (await getState()).steps;
    await pending.put({
      id: crypto.randomUUID(),
      order,
      image,
      width,
      height,
      viewport: msg.viewport,
      dpr: msg.dpr,
      url: msg.url.slice(0, 2000),
      title: msg.title.slice(0, 300),
      label: msg.label,
      selector: msg.selector,
      tag: msg.tag,
      element: msg.element,
      click: msg.click,
      zones: msg.detections.flatMap((d) => {
        const rect = toRelRect(d.rect, msg.viewport);
        return rect ? [{ id: crypto.randomUUID(), type: d.type, rect, excerpt: d.excerpt, blur: true }] : [];
      }),
    });
    await setState({ steps: order + 1, lastError: null });
  } catch (e) {
    await setState({
      lastError: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e),
    });
  }
}

async function start(req: Extract<PopupRequest, { type: 'fd:start' }>): Promise<RecordingStatus> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Non connecté');
  await pending.clear();
  const state = await setState({
    recording: true,
    demoId: null,
    workspaceId: req.workspaceId,
    title: req.title,
    tabId: req.tabId,
    steps: 0,
    lastError: null,
  });
  await inject(req.tabId);
  return state;
}

/** Fin de capture : ouvre l'écran de vérification (rien n'a encore été envoyé). */
async function stop(): Promise<RecordingStatus> {
  const state = await getState();
  if (state.tabId !== null) {
    await browser.tabs.sendMessage(state.tabId, { type: 'fd:recorder-stop' }).catch(() => undefined);
  }
  if (state.workspaceId && (await pending.count()) > 0) {
    await browser.storage.local.set({
      'fd.review': { workspaceId: state.workspaceId, title: state.title || 'Nouvelle démo' },
    });
    await browser.tabs.create({ url: browser.runtime.getURL('/review.html') });
  }
  return setState({ ...EMPTY });
}

/** Annule : arrête la capture et efface les captures gardées dans le navigateur. */
async function cancel(): Promise<RecordingStatus> {
  const state = await getState();
  if (state.tabId !== null)
    await browser.tabs.sendMessage(state.tabId, { type: 'fd:recorder-stop' }).catch(() => undefined);
  await pending.clear();
  return setState({ ...EMPTY });
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((msg: unknown, sender) => {
    const m = msg as ClickPayload | PopupRequest;
    if (m.type === 'fd:click') {
      // On répond après la capture : le badge REC reste masqué jusque-là (il n'apparaît pas à l'image)
      if (sender.tab?.windowId !== undefined) return handleClick(m, sender.tab.windowId).then(() => true);
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
