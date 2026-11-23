import { defineBackground } from 'wxt/utils/define-background';
import { browser, type Browser } from 'wxt/browser';
import { supabase } from '@/lib/supabase';
import { toRelRect } from '@/lib/geometry';
import { pending } from '@/lib/pending';
import type {
  ClickPayload,
  HtmlBarRequest,
  PopupRequest,
  RecordingStatus,
  TrackedTab,
  VideoBarRequest,
} from '@/lib/messages';
import { fullHeight } from '@/lib/fullpage';
import { htmlStore } from '@/lib/htmlStore';
import { elapsed } from '@/lib/video';
import { videoStore } from '@/lib/videoStore';
import { APP_URL, DEBUGGER } from '@/lib/config';
import { ATTACH_TTL_MS, originOf, parseAttach, type PendingAttach } from '@/lib/external';

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
      files: [
        mode === 'video'
          ? '/content-scripts/videobar.js'
          : mode === 'html'
            ? '/content-scripts/htmlbar.js'
            : '/content-scripts/recorder.js',
      ],
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

// ===== L25-01 : taille de l'onglet, capture pleine page, onglets suivis =====
/** Attache le protocole DevTools à un onglet (une fois) ; false si impossible (DevTools ouvert…). */
async function attach(tabId: number): Promise<boolean> {
  const s = await getState();
  if (s.debugged?.includes(tabId)) return true;
  // Option B : pas de protocole DevTools dans la version de la boutique
  if (!DEBUGGER) return false;
  try {
    await dbg().attach({ tabId }, '1.3');
  } catch {
    return false;
  }
  await setState({ debugged: [...((await getState()).debugged ?? []), tabId] });
  return true;
}
/** Prépare un onglet suivi : taille imposée ou émulation mobile, protocole pour la page entière. */
async function prepareTab(tabId: number, s: RecordingStatus) {
  if (s.mode === 'mobile' && s.viewport) {
    if (await attach(tabId)) {
      await dbg().sendCommand({ tabId }, 'Emulation.setDeviceMetricsOverride', {
        width: s.viewport.w,
        height: s.viewport.h,
        deviceScaleFactor: 2,
        mobile: true,
      });
      await dbg().sendCommand({ tabId }, 'Emulation.setTouchEmulationEnabled', {
        enabled: true,
        maxTouchPoints: 5,
      });
    }
    return;
  }
  // Option B : la taille d'onglet passe par la fenêtre (inexacte de quelques pixels), le premier onglet seulement
  if (!DEBUGGER) {
    if (s.size && !s.restoreWindow) await resizeWindow(tabId, s.size);
    return;
  }
  // Capture à chaque clic : le protocole sert aussi à la capture pleine page
  const need = !!s.size || s.mode === 'clicks';
  if (!need || !(await attach(tabId))) return;
  if (s.size)
    await dbg()
      .sendCommand({ tabId }, 'Emulation.setDeviceMetricsOverride', {
        width: s.size.w,
        height: s.size.h,
        deviceScaleFactor: 0,
        mobile: false,
      })
      .catch(() => undefined);
}
/** Option B : fenêtre redimensionnée pour que la zone de la page ait la taille choisie (bord du navigateur compris). */
async function resizeWindow(tabId: number, size: { w: number; h: number }) {
  try {
    const tab = await browser.tabs.get(tabId);
    const win = await browser.windows.get(tab.windowId);
    if (!win.id || !win.width || !win.height || !tab.width || !tab.height) return;
    await setState({
      restoreWindow: { id: win.id, width: win.width, height: win.height, state: win.state ?? 'normal' },
    });
    await browser.windows.update(win.id, {
      state: 'normal',
      width: size.w + (win.width - tab.width),
      height: size.h + (win.height - tab.height),
    });
  } catch {
    /* fenêtre fermée ou plein écran imposé : la capture garde la taille actuelle */
  }
}
/** Remet chaque onglet à sa taille et détache le protocole (option B : rend sa taille à la fenêtre). */
async function releaseTabs(s: RecordingStatus) {
  for (const tabId of s.debugged ?? []) await stopEmulation(tabId);
  const w = s.restoreWindow;
  if (w)
    await browser.windows
      .update(
        w.id,
        w.state === 'normal' ? { width: w.width, height: w.height } : { state: w.state as 'maximized' },
      )
      .catch(() => undefined);
  await setState({ debugged: [], restoreWindow: null });
}
/** Capture du viewport (et de la page entière si le protocole est attaché). */
async function shoot(
  tabId: number,
  windowId: number,
  s: RecordingStatus,
  msg: ClickPayload,
): Promise<{ view: string; full: string | null }> {
  if (!s.debugged?.includes(tabId))
    return { view: await browser.tabs.captureVisibleTab(windowId, { format: 'png' }), full: null };
  const view = await captureMobile(tabId);
  let full: string | null = null;
  if (msg.page && msg.page.height > msg.viewport.height + 1) {
    try {
      const r = (await dbg().sendCommand({ tabId }, 'Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
        // Image en pixels CSS : la page entière reste sous la limite des canevas
        clip: {
          x: 0,
          y: 0,
          width: msg.page.width,
          height: fullHeight(msg.page),
          scale: 1 / Math.max(1, msg.dpr),
        },
      })) as { data: string };
      full = `data:image/png;base64,${r.data}`;
    } catch {
      full = null;
    }
  }
  return { view, full };
}
const tracked = (s: RecordingStatus, tabId: number | undefined): TrackedTab | null =>
  tabId === undefined ? null : ((s.tabs ?? []).find((t) => t.id === tabId) ?? null);

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

async function handleClick(msg: ClickPayload, windowId: number, tabId: number | undefined) {
  const state = await getState();
  if (!state.recording || state.paused || !state.workspaceId) return;
  // L25-01 : seuls l'onglet de départ et les onglets qu'il a ouverts sont capturés
  const tab = tracked(state, tabId) ?? (tabId === state.tabId ? { id: tabId!, n: 1, title: '' } : null);
  if (!tab) return;
  try {
    const shot = await enqueue(() => shoot(tab.id, windowId, state, msg));
    const image = await (await fetch(shot.view)).blob();
    const bitmap = await createImageBitmap(image);
    const { width, height } = bitmap;
    bitmap.close();
    let full: Awaited<ReturnType<typeof fullCapture>> = undefined;
    if (shot.full && msg.page) full = await fullCapture(shot.full, msg);
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
      // L25-06 : onglet de la capture quand le suivi des onglets est activé
      tab: state.followTabs ? { n: tab.n, title: msg.title.slice(0, 120) } : undefined,
      full,
    });
    await setState({ steps: order + 1, lastError: null });
  } catch (e) {
    await setState({
      lastError: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e),
    });
  }
}

/** L25-01 : capture pleine page et ses zones (relatives à la page entière). */
async function fullCapture(dataUrl: string, msg: ClickPayload) {
  if (!msg.page) return undefined;
  const image = await (await fetch(dataUrl)).blob();
  const bmp = await createImageBitmap(image);
  const { width, height } = bmp;
  bmp.close();
  const box = { width: msg.page.width, height: fullHeight(msg.page) };
  return {
    image,
    width,
    height,
    page: msg.page,
    zones: (msg.pageDetections ?? []).flatMap((d) => {
      const rect = toRelRect(d.rect, box);
      return rect ? [{ type: d.type, rect }] : [];
    }),
  };
}

async function start(req: Extract<PopupRequest, { type: 'fd:start' }>): Promise<RecordingStatus> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Non connecté');
  await pending.clear();
  const mode = req.mode ?? 'clicks';
  const first = await browser.tabs.get(req.tabId);
  await setState({
    debugged: [],
    restoreWindow: null,
    tabs: [{ id: req.tabId, n: 1, title: (first.title ?? '').slice(0, 120) }],
    followTabs: mode !== 'video' && !!req.followTabs,
    size: mode === 'clicks' || mode === 'html' ? (req.size ?? null) : null,
  });
  if (mode === 'mobile' && !DEBUGGER)
    throw new Error('Format mobile : pas encore disponible dans cette version.');
  if (mode === 'mobile' && req.viewport) {
    await emulate(req.tabId, req.viewport);
    await setState({ debugged: [req.tabId] });
  }
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
  if (mode === 'html') await htmlStore.clear();
  if (mode === 'clicks' || mode === 'html') await prepareTab(req.tabId, { ...(await getState()), mode });
  const state = await setState({
    recording: true,
    mode,
    demoId: null,
    workspaceId: req.workspaceId,
    title: req.title,
    tabId: req.tabId,
    steps: 0,
    lastError: null,
    // L26-04 : capture guidée (captures à chaque clic seulement)
    fill: mode === 'clicks' ? (req.fill ?? null) : null,
    viewport: mode === 'mobile' ? (req.viewport ?? null) : null,
    // A8 : la page de départ est capturée dès l'injection de la barre
    htmlAwait: mode === 'html',
  });
  await inject(req.tabId, mode);
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
      .sendMessage({
        type: 'fd:rec-mark',
        t,
        label: m.label.slice(0, 200),
        manual: m.manual,
        zones: (m.zones ?? []).slice(0, 40),
      })
      .catch(() => undefined);
    return setState({ steps: s.steps + 1 });
  }
  return null;
}

/** Fin de capture : ouvre l'écran de vérification (rien n'a encore été envoyé). */
// ===== A8 : capture HTML =====
const ASSET_MAX = 3 * 1024 * 1024;
async function toDataUrl(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(bin)}`;
}
/** Ressource de la page (cookies du site inclus, comme à l'affichage) : image en WebP, police, CSS. */
async function fetchAsset(url: string, kind: 'image' | 'font' | 'css'): Promise<string | null> {
  if (!/^https?:/.test(url)) return null;
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size > ASSET_MAX) return null;
    if (kind === 'css') return (await blob.text()).slice(0, ASSET_MAX);
    if (kind === 'font') return toDataUrl(blob);
    if (/svg/.test(blob.type)) return toDataUrl(new Blob([blob], { type: 'image/svg+xml' }));
    try {
      const bmp = await createImageBitmap(blob);
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      c.getContext('2d')!.drawImage(bmp, 0, 0);
      return toDataUrl(await c.convertToBlob({ type: 'image/webp', quality: 0.82 }));
    } catch {
      return /^image\//.test(blob.type) ? toDataUrl(blob) : null;
    }
  } catch {
    return null;
  }
}

async function onHtmlBar(m: HtmlBarRequest): Promise<unknown> {
  if (m.type === 'fd:fetch-asset') return fetchAsset(m.url, m.kind);
  const s = await getState();
  if (!s.recording || s.mode !== 'html') return null;
  if (m.type === 'fd:html-ready') {
    if (s.htmlAwait) await setState({ htmlAwait: false });
    return { capture: !!s.htmlAwait, pages: s.steps };
  }
  if (m.type === 'fd:html-page') {
    const order = s.steps + 1;
    await htmlStore.put({ ...m.capture, order });
    return setState({ steps: order, htmlAwait: false });
  }
  if (m.type === 'fd:html-click') {
    const last = await htmlStore.last();
    // Le dernier clic avant la page suivante est le lien proposé (un menu ouvert, puis son entrée)
    if (last) await htmlStore.put({ ...last, clickSel: m.sel, clickLabel: m.label });
    // Une navigation suit peut-être : la page suivante sera capturée à son chargement
    return setState({ htmlAwait: true });
  }
  if (m.type === 'fd:html-stop') return stop();
  return null;
}

/** Attend qu'un onglet ait fini de charger (30 s au plus). */
function tabLoaded(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      browser.tabs.onUpdated.removeListener(on);
      clearTimeout(timer);
      resolve();
    };
    const on = (id: number, info: { status?: string }) => {
      if (id === tabId && info.status === 'complete') done();
    };
    const timer = setTimeout(done, 30_000);
    browser.tabs.onUpdated.addListener(on);
  });
}

/**
 * EXT-CONNECT : « Capturer cette page » d'un Sandbox. Ouvre l'adresse et rattache la capture HTML à ce
 * Sandbox. Avec l'accès au site déjà accordé, la capture démarre aussitôt ; sinon l'utilisateur clique sur
 * l'extension dans le nouvel onglet (« Démarrer » demande l'accès, comme d'habitude) : aucune permission de plus.
 */
async function onExternal(
  msg: unknown,
  sender: Browser.runtime.MessageSender,
): Promise<{ ok: true; started: boolean } | { ok: false; error: string }> {
  const from = sender.origin ?? (sender.url ? (originOf(sender.url) ?? undefined) : undefined);
  const parsed = parseAttach(msg, from, originOf(APP_URL));
  if (!parsed.ok) return parsed;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, error: 'signed-out' };
  if ((await getState()).recording) return { ok: false, error: 'busy' };
  const { req } = parsed;
  const attach: PendingAttach = { ...req, origin: originOf(req.url)!, at: Date.now() };
  await browser.storage.local.set({ 'fd.attach': attach });
  const tab = await browser.tabs.create({ url: req.url, active: true });
  if (tab.id === undefined) return { ok: false, error: 'tab' };
  const granted = await browser.permissions.contains({ origins: [`${attach.origin}/*`] }).catch(() => false);
  if (!granted) return { ok: true, started: false };
  await tabLoaded(tab.id);
  await start({
    type: 'fd:start',
    workspaceId: req.workspaceId,
    title: '',
    tabId: tab.id,
    mode: 'html',
    followTabs: true,
  });
  return { ok: true, started: true };
}

async function stop(): Promise<RecordingStatus> {
  const state = await getState();
  if (state.mode === 'video') return stopVideo();
  if (state.mode === 'html') {
    await releaseTabs(state);
    for (const t of state.tabs ?? [{ id: state.tabId ?? -1 }])
      if (t.id >= 0)
        await browser.tabs.sendMessage(t.id, { type: 'fd:recorder-stop' }).catch(() => undefined);
    if (state.workspaceId && (await htmlStore.count()) > 0) {
      // EXT-CONNECT : capture rattachée à un Sandbox du même espace (posée par l'app)
      const attach = (await browser.storage.local.get('fd.attach'))['fd.attach'] as PendingAttach | undefined;
      const appendTo =
        attach && attach.workspaceId === state.workspaceId && Date.now() - attach.at < ATTACH_TTL_MS
          ? attach.demoId
          : undefined;
      await browser.storage.local.set({
        'fd.htmlReview': { workspaceId: state.workspaceId, title: state.title || 'Nouvelle démo', appendTo },
      });
      await browser.tabs.create({ url: browser.runtime.getURL('/html-review.html') });
    }
    return setState({ ...EMPTY });
  }
  await releaseTabs(state);
  for (const t of state.tabs ?? [{ id: state.tabId ?? -1 }])
    if (t.id >= 0) await browser.tabs.sendMessage(t.id, { type: 'fd:recorder-stop' }).catch(() => undefined);
  if (state.workspaceId && (await pending.count()) > 0) {
    await browser.storage.local.set({
      'fd.review': {
        workspaceId: state.workspaceId,
        title: state.title || 'Nouvelle démo',
        // F7 : démo mobile (cadre téléphone dans le lecteur)
        device: state.mode === 'mobile' ? 'mobile' : 'desktop',
        viewport: state.mode === 'mobile' ? (state.viewport ?? null) : null,
        fill: state.fill ?? null,
      },
    });
    await browser.tabs.create({ url: browser.runtime.getURL('/review.html') });
  }
  return setState({ ...EMPTY });
}

/** Annule : arrête la capture et efface les captures gardées dans le navigateur. */
async function cancel(): Promise<RecordingStatus> {
  const state = await getState();
  for (const t of state.tabs ?? [{ id: state.tabId ?? -1 }])
    if (t.id >= 0) await browser.tabs.sendMessage(t.id, { type: 'fd:recorder-stop' }).catch(() => undefined);
  await releaseTabs(state);
  if (state.mode === 'html') await htmlStore.clear();
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
    void getState().then((s) => {
      if (s.mode === 'html') {
        // A8 : Alt + Maj + M capture la page, Alt + Maj + S termine
        if (cmd === 'rec-mark' && s.tabId !== null)
          void browser.tabs.sendMessage(s.tabId, { type: 'fd:html-capture' }).catch(() => undefined);
        if (cmd === 'rec-stop') void stop();
        return;
      }
      if (cmd === 'rec-pause') void onVideoBar({ type: 'fd:video-pause' });
      if (cmd === 'rec-mark') void onVideoBar({ type: 'fd:video-mark', label: '', manual: true });
      if (cmd === 'rec-stop') void onVideoBar({ type: 'fd:video-stop' });
    });
  });
  // EXT-CONNECT : seul message accepté depuis l'app (origine contrôlée, schéma strict)
  browser.runtime.onMessageExternal.addListener((msg: unknown, sender) =>
    onExternal(msg, sender).catch(() => ({ ok: false as const, error: 'internal' })),
  );
  browser.runtime.onMessage.addListener((msg: unknown, sender) => {
    const m = msg as ClickPayload | PopupRequest | VideoBarRequest | { type: string };
    if (m.type.startsWith('fd:rec-')) return undefined; // messages destinés au document hors écran
    if (m.type.startsWith('fd:video-')) return onVideoBar(m as VideoBarRequest);
    if (m.type.startsWith('fd:html-') || m.type === 'fd:fetch-asset') return onHtmlBar(m as HtmlBarRequest);
    if (m.type === 'fd:click') {
      // On répond après la capture : le badge REC reste masqué jusque-là (il n'apparaît pas à l'image)
      if (sender.tab?.windowId !== undefined)
        return handleClick(m as ClickPayload, sender.tab.windowId, sender.tab.id).then(() => true);
      return undefined;
    }
    if (m.type === 'fd:tab-info')
      // L25-01 : numéro de l'onglet suivi, pour la puce « Onglet 2 · Aide » de la barre
      return getState().then((s) => {
        const t = tracked(s, sender.tab?.id);
        // L26-04 : prochaine étape à capturer (n / N), affichée dans la barre
        const next = s.fill?.steps[s.steps];
        const guide =
          s.fill && next ? { title: next.title, n: s.steps + 1, total: s.fill.steps.length } : null;
        if (t) return { n: t.n, title: sender.tab?.title ?? t.title, guide };
        return guide ? { n: 1, title: '', guide } : null;
      });
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

  // L25-01 : un onglet ouvert PAR un onglet suivi est suivi à son tour (jamais un onglet ouvert à la main)
  browser.tabs.onCreated.addListener((tab) => {
    void getState().then(async (s) => {
      if (!s.recording || !s.followTabs || tab.id === undefined || s.mode === 'video') return;
      if (!tracked(s, tab.openerTabId)) return;
      // Un nouvel onglet du navigateur (Ctrl + T : chrome://newtab) a été ouvert à la main : jamais suivi
      if (/^(chrome|edge|brave|about:newtab)/.test(tab.pendingUrl ?? tab.url ?? '')) return;
      const tabs = s.tabs ?? [];
      const n = Math.max(0, ...tabs.map((t) => t.n)) + 1;
      await setState({ tabs: [...tabs, { id: tab.id, n, title: (tab.title ?? '').slice(0, 120) }] });
    });
  });
  // Réinjection après navigation dans un onglet suivi.
  browser.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (info.status !== 'complete') return;
    void getState().then(async (s) => {
      if (!s.recording) return;
      const t = tracked(s, tabId) ?? (s.tabId === tabId ? { id: tabId, n: 1, title: '' } : null);
      if (!t) return;
      if (t.n > 1) {
        await setState({
          tabs: (s.tabs ?? []).map((x) =>
            x.id === tabId ? { ...x, title: (tab.title ?? '').slice(0, 120) } : x,
          ),
        });
        if (!s.debugged?.includes(tabId)) await prepareTab(tabId, s);
      }
      void inject(tabId, s.mode);
    });
  });
  browser.tabs.onRemoved.addListener((tabId) => {
    void getState().then((s) => {
      if (!s.recording) return;
      if (s.tabId === tabId) return void stop();
      if (tracked(s, tabId))
        void setState({
          tabs: (s.tabs ?? []).filter((t) => t.id !== tabId),
          debugged: (s.debugged ?? []).filter((x) => x !== tabId),
        });
    });
  });
});
