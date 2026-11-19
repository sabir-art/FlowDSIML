import { defineBackground } from 'wxt/utils/define-background';
import { browser, type Browser } from 'wxt/browser';
import { supabase } from '@/lib/supabase';
import { toRelRect } from '@/lib/geometry';
import { pending } from '@/lib/pending';
import type { ClickPayload, PopupRequest, RecordingStatus, VideoBarRequest } from '@/lib/messages';
import { elapsed } from '@/lib/video';
import { videoStore } from '@/lib/videoStore';

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

async function inject(tabId: number, mode: RecordingStatus['mode'] = 'clicks') {
  try {
    await browser.scripting.executeScript({
      target: { tabId },
      // F7 : la vidéo a sa barre d'enregistrement (et le flou des données pendant l'enregistrement)
      files: [mode === 'video' ? '/content-scripts/videobar.js' : '/content-scripts/recorder.js'],
    });
  } catch {
    /* pages internes (chrome://, Web Store) : capture impossible */
  }
}

// ===== F7 : format mobile (émulation par le protocole DevTools : taille et mode tactile) =====
const dbg = () => browser.debugger;
async function emulate(tabId: number, vp: { w: number; h: number }) {
  const target = { tabId };
  await dbg().attach(target, '1.3');
  await dbg().sendCommand(target, 'Emulation.setDeviceMetricsOverride', {
    width: vp.w,
    height: vp.h,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await dbg().sendCommand(target, 'Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
}
async function stopEmulation(tabId: number) {
  try {
    await dbg().sendCommand({ tabId }, 'Emulation.clearDeviceMetricsOverride');
    await dbg().detach({ tabId });
  } catch {
    /* onglet fermé ou débogage déjà arrêté */
  }
}
/** Capture de l'écran émulé (exactement la taille du téléphone). */
async function captureMobile(tabId: number): Promise<string> {
  const r = (await dbg().sendCommand({ tabId }, 'Page.captureScreenshot', { format: 'png' })) as {
    data: string;
  };
  return `data:image/png;base64,${r.data}`;
}

// ===== F7 : vidéo de l'onglet (document hors écran) =====
async function ensureOffscreen() {
  const c = browser;
  if (await c.offscreen.hasDocument?.()) return;
  await c.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA' as Browser.offscreen.Reason],
    justification: "Enregistrer la vidéo de l'onglet choisi (tabCapture), le micro et la webcam si demandés.",
  });
}
async function closeOffscreen() {
  if (await browser.offscreen.hasDocument?.()) await browser.offscreen.closeDocument();
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
    const dataUrl = await enqueue(() =>
      state.mode === 'mobile' && state.tabId !== null
        ? captureMobile(state.tabId)
        : browser.tabs.captureVisibleTab(windowId, { format: 'png' }),
    );
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
  const mode = req.mode ?? 'clicks';
  if (mode === 'mobile' && req.viewport) await emulate(req.tabId, req.viewport);
  if (mode === 'video') {
    if (!req.streamId) throw new Error("Flux de l'onglet indisponible.");
    await videoStore.clear();
    await ensureOffscreen();
    const tab = await browser.tabs.get(req.tabId);
    const r = (await browser.runtime.sendMessage({
      type: 'fd:rec-start',
      streamId: req.streamId,
      mic: !!req.mic,
      webcam: !!req.webcam,
      meta: {
        workspaceId: req.workspaceId,
        title: req.title,
        device: 'desktop',
        viewport: null,
        url: (tab.url ?? '').slice(0, 2000),
      },
    })) as { micDenied?: boolean; error?: string };
    if (r?.error) throw new Error(r.error);
    const state = await setState({
      recording: true,
      mode,
      demoId: null,
      workspaceId: req.workspaceId,
      title: req.title,
      tabId: req.tabId,
      steps: 0,
      lastError: null,
      startedAt: Date.now(),
      pausedAt: null,
      pausedMs: 0,
      micDenied: !!r?.micDenied,
      blurredZones: 0,
      viewport: null,
    });
    await inject(req.tabId, 'video');
    return state;
  }
  const state = await setState({
    recording: true,
    mode,
    demoId: null,
    workspaceId: req.workspaceId,
    title: req.title,
    tabId: req.tabId,
    steps: 0,
    lastError: null,
    viewport: mode === 'mobile' ? (req.viewport ?? null) : null,
  });
  await inject(req.tabId);
  return state;
}

/** F7 : fin de l'enregistrement vidéo → écran de vérification des images clés. */
async function stopVideo(): Promise<RecordingStatus> {
  const state = await getState();
  if (state.tabId !== null)
    await browser.tabs.sendMessage(state.tabId, { type: 'fd:recorder-stop' }).catch(() => undefined);
  const durationMs = elapsed(
    {
      startedAt: state.startedAt ?? Date.now(),
      pausedAt: state.pausedAt ?? null,
      pausedMs: state.pausedMs ?? 0,
    },
    Date.now(),
  );
  await browser.runtime
    .sendMessage({ type: 'fd:rec-stop', durationMs, blurredZones: state.blurredZones ?? 0 })
    .catch(() => undefined);
  await closeOffscreen();
  await browser.tabs.create({ url: browser.runtime.getURL('/video-review.html') });
  return setState({ ...EMPTY });
}

async function onVideoBar(m: VideoBarRequest): Promise<unknown> {
  const s = await getState();
  if (!s.recording || s.mode !== 'video') return null;
  if (m.type === 'fd:video-stop') return stopVideo();
  if (m.type === 'fd:video-blurs') return setState({ blurredZones: Math.max(s.blurredZones ?? 0, m.count) });
  if (m.type === 'fd:video-pause') {
    if (s.pausedAt) {
      await browser.runtime.sendMessage({ type: 'fd:rec-resume' }).catch(() => undefined);
      return setState({ pausedMs: (s.pausedMs ?? 0) + Date.now() - s.pausedAt, pausedAt: null });
    }
    await browser.runtime.sendMessage({ type: 'fd:rec-pause' }).catch(() => undefined);
    return setState({ pausedAt: Date.now() });
  }
  if (m.type === 'fd:video-mark') {
    if (s.pausedAt) return s;
    const t = elapsed(
      { startedAt: s.startedAt ?? Date.now(), pausedAt: null, pausedMs: s.pausedMs ?? 0 },
      Date.now(),
    );
    await browser.runtime
      .sendMessage({ type: 'fd:rec-mark', t, label: m.label.slice(0, 200), manual: m.manual })
      .catch(() => undefined);
    return setState({ steps: s.steps + 1 });
  }
  return null;
}

/** Fin de capture : ouvre l'écran de vérification (rien n'a encore été envoyé). */
async function stop(): Promise<RecordingStatus> {
  const state = await getState();
  if (state.mode === 'video') return stopVideo();
  if (state.mode === 'mobile' && state.tabId !== null) await stopEmulation(state.tabId);
  if (state.tabId !== null) {
    await browser.tabs.sendMessage(state.tabId, { type: 'fd:recorder-stop' }).catch(() => undefined);
  }
  if (state.workspaceId && (await pending.count()) > 0) {
    await browser.storage.local.set({
      'fd.review': {
        workspaceId: state.workspaceId,
        title: state.title || 'Nouvelle démo',
        // F7 : démo mobile (cadre téléphone dans le lecteur)
        device: state.mode === 'mobile' ? 'mobile' : 'desktop',
        viewport: state.mode === 'mobile' ? (state.viewport ?? null) : null,
      },
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
  if (state.mode === 'mobile' && state.tabId !== null) await stopEmulation(state.tabId);
  if (state.mode === 'video') {
    await browser.runtime.sendMessage({ type: 'fd:rec-cancel' }).catch(() => undefined);
    await closeOffscreen();
    await videoStore.clear();
  }
  await pending.clear();
  return setState({ ...EMPTY });
}

export default defineBackground(() => {
  // F7 : raccourcis (Alt + Maj + P, M, S) de la barre d'enregistrement
  browser.commands?.onCommand.addListener((cmd: string) => {
    if (cmd === 'rec-pause') void onVideoBar({ type: 'fd:video-pause' });
    if (cmd === 'rec-mark') void onVideoBar({ type: 'fd:video-mark', label: '', manual: true });
    if (cmd === 'rec-stop') void onVideoBar({ type: 'fd:video-stop' });
  });
  browser.runtime.onMessage.addListener((msg: unknown, sender) => {
    const m = msg as ClickPayload | PopupRequest | VideoBarRequest | { type: string };
    if (m.type.startsWith('fd:rec-')) return undefined; // messages destinés au document hors écran
    if (m.type.startsWith('fd:video-')) return onVideoBar(m as VideoBarRequest);
    if (m.type === 'fd:click') {
      // On répond après la capture : le badge REC reste masqué jusque-là (il n'apparaît pas à l'image)
      if (sender.tab?.windowId !== undefined)
        return handleClick(m as ClickPayload, sender.tab.windowId).then(() => true);
      return undefined;
    }
    const p = m as PopupRequest;
    if (p.type === 'fd:status') return getState();
    if (p.type === 'fd:start')
      return start(p).catch((e: unknown) => setState({ lastError: (e as Error).message ?? String(e) }));
    if (m.type === 'fd:stop') return stop();
    if (m.type === 'fd:pause')
      return getState().then((s) =>
        s.mode === 'video' ? onVideoBar({ type: 'fd:video-pause' }) : setState({ paused: !s.paused }),
      );
    if (m.type === 'fd:cancel') return cancel();
    return undefined;
  });

  // Réinjection après navigation dans l'onglet enregistré.
  browser.tabs.onUpdated.addListener((tabId, info) => {
    if (info.status !== 'complete') return;
    void getState().then((s) => {
      if (s.recording && s.tabId === tabId) void inject(tabId, s.mode);
    });
  });
  browser.tabs.onRemoved.addListener((tabId) => {
    void getState().then((s) => {
      if (s.recording && s.tabId === tabId) void stop();
    });
  });
});
