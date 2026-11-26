import { defineBackground } from 'wxt/utils/define-background';
import { browser, type Browser } from 'wxt/browser';
import { supabase } from '@/lib/supabase';
import { capturedViewport, toRelRect } from '@/lib/geometry';
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
import { liveRecorder } from '@/lib/liveRecorder';
import { asFrameMode, frameFor } from '@/lib/frame';
import { strings } from '@/lib/i18n';
import {
  ASSET_MAX_BYTES,
  ASSET_TIMEOUT_MS,
  DATA_MAX_BYTES,
  assetDecision,
  assetTooLong,
  assetTypeAllowed,
  type AssetKind,
} from '@/lib/assetPolicy';
import {
  ADD_KEY,
  ATTACH_TTL_MS,
  liveTarget,
  originOf,
  parseAdd,
  parseAttach,
  type AddRequest,
  type AddTarget,
  type PendingAttach,
} from '@/lib/external';

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
  addTo: null,
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
    if (mode === 'video') {
      // EXT-02 §4.2 : le choix « Masquer en direct » est posé avant la barre (même monde isolé)
      const live = !!(await getState()).liveMask;
      await browser.scripting.executeScript({
        target: { tabId },
        func: (v: boolean) => {
          (window as unknown as { __fdLiveMask?: boolean }).__fdLiveMask = v;
        },
        args: [live],
      });
    }
    if (mode === 'html' && (await browser.storage.local.get('fd.htmlKind'))['fd.htmlKind'] === 'sandbox') {
      // Sandbox v2 (étape 3) : l'enregistreur des réponses GET va dans le monde de la page, la barre l'écoute
      // sous un nom d'évènement tiré au hasard (la page ne peut pas le deviner pour s'y faire passer)
      const eventName = `fd-live-${crypto.randomUUID()}`;
      await browser.scripting.executeScript({
        target: { tabId },
        func: (n: string) => {
          (window as unknown as { __fdLiveEvent?: string }).__fdLiveEvent ??= n;
        },
        args: [eventName],
      });
      const [named] = await browser.scripting.executeScript({
        target: { tabId },
        func: () => (window as unknown as { __fdLiveEvent?: string }).__fdLiveEvent ?? '',
      });
      await browser.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: liveRecorder,
        args: [String(named?.result ?? eventName)],
      });
    }
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

/** L60 §2 : miniature de la carte « Étape n capturée » (144 × 90, 2× la taille affichée). */
async function thumbOf(bitmap: ImageBitmap): Promise<string> {
  const c = new OffscreenCanvas(144, 90);
  const g = c.getContext('2d')!;
  const k = Math.max(144 / bitmap.width, 90 / bitmap.height);
  g.drawImage(bitmap, 0, 0, bitmap.width * k, bitmap.height * k);
  return toDataUrl(await c.convertToBlob({ type: 'image/jpeg', quality: 0.7 }));
}

/**
 * L64 §3 : titre et texte proposés pour une étape. Seuls le libellé du clic et le titre de la page sont
 * envoyés (jamais la capture, jamais une donnée floutée). Échec ou délai dépassé : rien n'est proposé,
 * l'étape garde le libellé du clic.
 */
async function draftStep(id: string, n: number, tabId: number, msg: ClickPayload, ws: string) {
  const tell = (text: string | null) =>
    browser.tabs.sendMessage(tabId, { type: 'fd:draft', n, text }).catch(() => undefined);
  try {
    const lang = (navigator.language || 'fr').slice(0, 2).toLowerCase() === 'en' ? 'en' : 'fr';
    const call = supabase.functions.invoke('ai', {
      body: {
        ws,
        task: 'step_draft',
        lang,
        input: { label: msg.label.slice(0, 200), page: msg.title.slice(0, 200) },
      },
    });
    // Le serveur abandonne au-delà de 4 s (TIMEOUT, aucun crédit décompté) ; 5 s ici, réseau compris
    const late = new Promise<never>((_, no) => setTimeout(() => no(new Error('late')), 5000));
    const r = (await Promise.race([call, late])) as { data?: { result?: { title?: string; text?: string } } };
    const out = r.data?.result;
    if (!out?.title || !out.text) throw new Error('empty');
    const c = (await pending.all()).find((x) => x.id === id);
    if (!c) return void tell(null);
    await pending.put({ ...c, ai: { title: out.title.slice(0, 80), text: out.text.slice(0, 280) } });
    await tell(out.text);
  } catch {
    await tell(null);
  }
}

async function handleClick(
  msg: ClickPayload,
  windowId: number,
  tabId: number | undefined,
): Promise<{ n: number; id: string; thumb: string; drafting: boolean } | undefined> {
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
    const thumb = await thumbOf(bitmap).catch(() => '');
    bitmap.close();
    // Fenêtre réellement capturée : une barre a pu s'ouvrir entre le clic et la capture
    const viewport = capturedViewport(msg.viewport, msg.dpr, { width, height });
    let full: Awaited<ReturnType<typeof fullCapture>> = undefined;
    if (shot.full && msg.page) full = await fullCapture(shot.full, msg);
    const order = (await getState()).steps;
    const id = crypto.randomUUID();
    await pending.put({
      id,
      order,
      image,
      width,
      height,
      viewport,
      dpr: msg.dpr,
      url: msg.url.slice(0, 2000),
      title: msg.title.slice(0, 300),
      label: msg.label,
      selector: msg.selector,
      tag: msg.tag,
      element: msg.element,
      click: msg.click,
      zones: msg.detections.flatMap((d) => {
        const rect = toRelRect(d.rect, viewport);
        return rect ? [{ id: crypto.randomUUID(), type: d.type, rect, excerpt: d.excerpt, blur: true }] : [];
      }),
      // L25-06 : onglet de la capture quand le suivi des onglets est activé
      tab: state.followTabs ? { n: tab.n, title: msg.title.slice(0, 120) } : undefined,
      full,
      // EXT-02 §5 : cadre demandé dans la barre ; l'image reste entière
      frame: frameFor(asFrameMode(msg.frame?.mode), {
        element: msg.element,
        click: msg.click,
        viewport,
        zone: msg.frame?.zone ?? null,
      }),
      zone: msg.frame?.zone ?? null,
    });
    await setState({ steps: order + 1, lastError: null });
    // L64 §3 : rédaction automatique, après la capture (la carte de la page affiche « Rédaction… »)
    if (state.autoDraft) void draftStep(id, order + 1, tab.id, msg, state.workspaceId);
    return { n: order + 1, id, thumb, drafting: !!state.autoDraft };
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
  // EXT-02 §5 : la capture part du cadre par défaut de la personne (Réglages de l'extension), sans zone
  const saved = (await browser.storage.local.get('fd.frame'))['fd.frame'];
  await browser.storage.local.set({ 'fd.frameState': { mode: asFrameMode(saved), zone: null } });
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
      // L60 §2 : compte à rebours de 3 s dans la page, enregistrement en pause d'ici là (temps exclu)
      startedAt: Date.now(),
      pausedAt: Date.now(),
      pausedMs: 0,
      countdown: true,
      micDenied: !!r?.micDenied,
      micOn: !!req.mic && !r?.micDenied,
      micMuted: false,
      blurredZones: 0,
      liveMask: !!req.liveMask,
      viewport: null,
    });
    await browser.runtime.sendMessage({ type: 'fd:rec-pause' }).catch(() => undefined);
    await inject(req.tabId, 'video');
    return state;
  }
  if (mode === 'html') await htmlStore.clear();
  if (mode === 'clicks' || mode === 'html') await prepareTab(req.tabId, { ...(await getState()), mode });
  // EXT-02 §8 : une cible posée par l'éditeur vaut pour cette capture (captures d'écran, même espace)
  const wanted = await addTarget();
  const adding =
    wanted &&
    wanted.state === 'pending' &&
    mode === (wanted.mode ?? 'clicks') &&
    !req.fill &&
    wanted.workspaceId === req.workspaceId
      ? wanted
      : null;
  if (adding) await saveTarget({ ...adding, state: 'recording', captureTabId: req.tabId });
  const state = await setState({
    addTo: adding ? { demoId: adding.demoId, title: adding.title, after: adding.after } : null,
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
    // L64 §2 : destination (dossier d'une nouvelle démo, ou démo existante : étapes à la fin)
    folderId: req.appendDemo || req.fill ? null : (req.folderId ?? null),
    appendDemo: req.fill ? null : (req.appendDemo ?? null),
    autoDraft: (mode === 'clicks' || mode === 'mobile') && !!req.autoDraft,
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

/**
 * L60 §2 : pause des captures (clics, HTML), depuis la barre, le popup ou Alt + Maj + P. Les barres des
 * onglets suivis sont prévenues. Un même geste peut arriver deux fois (raccourci de Chrome et de la page) :
 * une seule bascule par 400 ms.
 */
let lastPauseToggle = 0;
async function togglePaused() {
  const s = await getState();
  if (!s.recording || Date.now() - lastPauseToggle < 400) return s;
  lastPauseToggle = Date.now();
  const next = await setState({ paused: !s.paused });
  const ids = new Set([s.tabId, ...(s.tabs ?? []).map((t) => t.id)]);
  for (const id of ids)
    if (typeof id === 'number')
      void browser.tabs.sendMessage(id, { type: 'fd:paused', paused: next.paused }).catch(() => undefined);
  return next;
}

async function onVideoBar(m: VideoBarRequest): Promise<unknown> {
  const s = await getState();
  if (!s.recording || s.mode !== 'video') return null;
  if (m.type === 'fd:video-stop') return stopVideo();
  if (m.type === 'fd:video-blurs') return setState({ blurredZones: Math.max(s.blurredZones ?? 0, m.count) });
  if (m.type === 'fd:video-track') {
    // Positions relevées dans la page : horodatées en temps d'enregistrement (pauses exclues)
    if (s.pausedAt) return null;
    const clock = { startedAt: s.startedAt ?? Date.now(), pausedAt: null, pausedMs: s.pausedMs ?? 0 };
    return browser.runtime
      .sendMessage({
        type: 'fd:rec-track',
        live: m.live,
        metas: m.metas.slice(0, 200),
        samples: m.samples
          .slice(0, 2000)
          .map((x) => ({ id: x.id, t: elapsed(clock, x.at), rects: x.rects.slice(0, 8) })),
      })
      .catch(() => null);
  }
  if (m.type === 'fd:video-go') {
    // Fin du compte à rebours : l'enregistrement commence vraiment
    if (!s.countdown) return s;
    await browser.runtime.sendMessage({ type: 'fd:rec-resume' }).catch(() => undefined);
    return setState({
      countdown: false,
      pausedMs: (s.pausedMs ?? 0) + Date.now() - (s.pausedAt ?? Date.now()),
      pausedAt: null,
    });
  }
  if (m.type === 'fd:video-mic') {
    if (!s.micOn) return s;
    await browser.runtime.sendMessage({ type: 'fd:rec-mic', on: !!s.micMuted }).catch(() => undefined);
    return setState({ micMuted: !s.micMuted });
  }
  if (m.type === 'fd:video-pause') {
    if (s.countdown) return s;
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
async function toDataUrl(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(bin)}`;
}
/** Corps lu par morceaux, abandonné dès que la limite est dépassée (la longueur annoncée peut manquer). */
async function readBounded(res: Response, max: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const reader = res.body?.getReader();
  if (!reader) return null;
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      void reader.cancel().catch(() => undefined);
      return null;
    }
    parts.push(value);
  }
  const out = new Uint8Array(new ArrayBuffer(size));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.byteLength;
  }
  return out;
}
/**
 * Ressource de la page capturée : image en WebP, police, CSS. La demande suit la règle de
 * lib/assetPolicy (adresse, hôte, cookies du site capturé seulement), y compris après une redirection ;
 * le type et la taille de la réponse sont contrôlés avant tout retour à la page.
 */
async function fetchAsset(
  rawUrl: unknown,
  kind: unknown,
  pageUrl: string | undefined,
): Promise<string | null> {
  const ask = assetDecision(rawUrl, kind, pageUrl);
  if (!ask) return null;
  const k = kind as AssetKind;
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), ASSET_TIMEOUT_MS);
  try {
    const res = await fetch(ask.url, {
      credentials: ask.credentials,
      redirect: 'follow',
      signal: stop.signal,
    });
    if (!res.ok) return null;
    // Redirection : l'adresse finale doit satisfaire la même règle
    if (res.url && res.url !== ask.url && !assetDecision(res.url, k, pageUrl)) return null;
    const type = res.headers.get('content-type');
    if (!assetTypeAllowed(k, type) || assetTooLong(res.headers.get('content-length'))) return null;
    const bytes = await readBounded(res, ASSET_MAX_BYTES);
    if (!bytes) return null;
    const blob = new Blob([bytes], { type: (type ?? '').split(';')[0]!.trim() });
    if (k === 'css' || k === 'js') return await blob.text();
    // Sandbox v2 : réponse relue pour être rejouée (type et statut gardés, 1 Mo au plus)
    if (k === 'data')
      return bytes.length > DATA_MAX_BYTES
        ? null
        : JSON.stringify({ type: blob.type, status: res.status, body: await blob.text() });
    if (k === 'font') return toDataUrl(blob);
    if (/svg/.test(blob.type)) return toDataUrl(new Blob([blob], { type: 'image/svg+xml' }));
    try {
      const bmp = await createImageBitmap(blob);
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      c.getContext('2d')!.drawImage(bmp, 0, 0);
      return toDataUrl(await c.convertToBlob({ type: 'image/webp', quality: 0.82 }));
    } catch {
      return toDataUrl(blob);
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function onHtmlBar(
  m: HtmlBarRequest,
  sender?: { tab?: { id?: number; url?: string }; frameId?: number; url?: string },
): Promise<unknown> {
  const s = await getState();
  if (!s.recording || s.mode !== 'html') return null;
  // Ressources : seulement pour l'onglet en cours de capture, depuis son cadre principal
  if (m.type === 'fd:fetch-asset') {
    if (sender?.tab?.id === undefined || sender.tab.id !== s.tabId || (sender.frameId ?? 0) !== 0)
      return null;
    // Adresse du cadre principal qui demande (toujours connue), sinon celle de l'onglet
    return fetchAsset(m.url, m.kind, sender.url ?? sender.tab.url);
  }
  if (m.type === 'fd:html-ready') {
    // L60 §2 : en pause, la page chargée n'est pas ajoutée (la capture attendue reste en attente)
    if (s.paused) return { capture: false, pages: s.steps, target: targetChip(s) };
    if (s.htmlAwait) await setState({ htmlAwait: false });
    // EXT-02 §8 : la barre de capture HTML porte la même pastille de cible que celle des captures
    return { capture: !!s.htmlAwait, pages: s.steps, target: targetChip(s) };
  }
  if (m.type === 'fd:html-page') {
    if (s.paused) return { steps: s.steps };
    const order = s.steps + 1;
    // L60 §2 : la carte « Étape n capturée » rappelle le clic qui a mené à cette page
    const prev = order > 1 ? await htmlStore.last() : undefined;
    // Gêne lot B : copie faite menu ouvert (survol) juste après la même page menu fermé, sans clic
    // entre les deux : la page précédente est reliée d'office à cet état par l'élément qui l'ouvre
    const menu = m.capture.menu;
    if (prev && menu && !prev.clickSel && sameAddress(prev.url, m.capture.url))
      await htmlStore.put({ ...prev, clickSel: menu.sel, clickLabel: menu.label, clickRect: menu.rect });
    const label = prev ? (menu && !prev.clickSel ? menu.label : (prev.clickLabel ?? '')) : '';
    await htmlStore.put({ ...m.capture, order });
    return { ...(await setState({ steps: order, htmlAwait: false })), label };
  }
  if (m.type === 'fd:html-click') {
    if (s.paused) return null;
    const last = await htmlStore.last();
    // Le dernier clic avant la page suivante est le lien proposé. Une entrée de menu apparue après la
    // copie n'existe pas dans la page copiée : le lien reste sur l'élément qui a ouvert le menu.
    if (last && !(m.transient && last.clickSel))
      await htmlStore.put({ ...last, clickSel: m.sel, clickLabel: m.label, clickRect: m.rect });
    // Une navigation suit peut-être : la page suivante sera capturée à son chargement
    return setState({ htmlAwait: true });
  }
  if (m.type === 'fd:html-stop') return stop();
  return null;
}

/** Même page, hors ancre (la copie menu ouvert garde l'adresse de la page). */
function sameAddress(a: string, b: string): boolean {
  try {
    const x = new URL(a);
    const y = new URL(b);
    return x.origin === y.origin && x.pathname === y.pathname && x.search === y.search;
  } catch {
    return false;
  }
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
// ===== EXT-02 §8 : capturer de nouvelles étapes pour une démo ouverte dans l'éditeur =====
async function addTarget(): Promise<AddTarget | null> {
  const t = liveTarget(
    (await browser.storage.local.get(ADD_KEY))[ADD_KEY] as AddTarget | undefined,
    Date.now(),
  );
  if (!t) await browser.storage.local.remove(ADD_KEY);
  return t;
}
const saveTarget = (t: AddTarget) => browser.storage.local.set({ [ADD_KEY]: t });
async function onAdd(
  req: AddRequest,
  sender: Browser.runtime.MessageSender,
): Promise<Record<string, unknown>> {
  if (req.type === 'fd:ping') return { ok: true, version: browser.runtime.getManifest().version };
  const current = await addTarget();
  const mine = current && current.demoId === req.demoId ? current : null;
  if (req.type === 'fd:add-status') {
    if (!mine) return { ok: true, state: 'none', steps: 0, stepIds: [] };
    const steps = mine.state === 'recording' ? (await getState()).steps : mine.stepIds.length;
    // « pending » (accès au site à accorder dans le popup) se lit comme une capture en cours
    return {
      ok: true,
      state: mine.state === 'pending' ? 'recording' : mine.state,
      steps,
      stepIds: mine.stepIds,
    };
  }
  if (req.type === 'fd:add-focus') {
    if (!mine) return { ok: false, error: 'none' };
    const review = (
      await browser.tabs.query({
        url: [browser.runtime.getURL('/review.html'), browser.runtime.getURL('/html-review.html')],
      })
    )[0];
    const id = mine.state === 'review' ? review?.id : mine.captureTabId;
    if (id === undefined || id === null) return { ok: false, error: 'tab' };
    const tab = await browser.tabs.update(id, { active: true }).catch(() => null);
    if (tab?.windowId !== undefined)
      await browser.windows.update(tab.windowId, { focused: true }).catch(() => undefined);
    return { ok: !!tab };
  }
  if (req.type === 'fd:add-clear') {
    if (!mine) return { ok: true };
    const s = await getState();
    if (s.recording && s.addTo?.demoId === req.demoId) await cancel();
    if (mine.state === 'review') {
      await pending.clear();
      await htmlStore.clear();
    }
    await browser.storage.local.remove([ADD_KEY, 'fd.review', 'fd.htmlReview']);
    return { ok: true };
  }
  if (req.type !== 'fd:add-steps') return { ok: false, error: 'schema' };
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, error: 'signed-out' };
  if ((await getState()).recording) return { ok: false, error: 'busy' };
  // Titre de la démo et étape d'insertion : lus avec la session de l'extension (RLS)
  const demo = await supabase
    .from('demos')
    .select('id, title, workspace_id')
    .eq('id', req.demoId)
    .maybeSingle();
  if (!demo.data || demo.data.workspace_id !== req.workspaceId) return { ok: false, error: 'demo' };
  let after: AddTarget['after'] = null;
  if (req.afterStepId) {
    const rows = await supabase.from('steps').select('id, title').eq('demo_id', req.demoId).order('position');
    const i = (rows.data ?? []).findIndex((r) => r.id === req.afterStepId);
    if (i < 0) return { ok: false, error: 'demo' };
    after = { n: i + 1, title: (rows.data![i]!.title ?? '').slice(0, 120) };
  }
  const tab = await browser.tabs.create({ url: req.url, active: true });
  if (tab.id === undefined) return { ok: false, error: 'tab' };
  const target: AddTarget = {
    demoId: req.demoId,
    workspaceId: req.workspaceId,
    afterStepId: req.afterStepId,
    title: (demo.data.title ?? '').slice(0, 160),
    after,
    at: Date.now(),
    state: 'pending',
    editorTabId: sender.tab?.id ?? null,
    captureTabId: tab.id,
    stepIds: [],
    mode: req.mode,
  };
  await saveTarget(target);
  const origin = originOf(req.url)!;
  const granted = await browser.permissions.contains({ origins: [`${origin}/*`] }).catch(() => false);
  // Sans accès au site : l'onglet est ouvert, le popup demande l'autorisation puis démarre
  if (!granted) return { ok: true, started: false };
  await tabLoaded(tab.id);
  await start({
    type: 'fd:start',
    workspaceId: req.workspaceId,
    title: '',
    tabId: tab.id,
    mode: req.mode,
    followTabs: req.mode === 'html',
  });
  return { ok: true, started: true };
}

async function onExternal(
  msg: unknown,
  sender: Browser.runtime.MessageSender,
): Promise<Record<string, unknown>> {
  const from = sender.origin ?? (sender.url ? (originOf(sender.url) ?? undefined) : undefined);
  // EXT-02 §8 : messages de l'ajout d'étapes depuis l'éditeur
  const add = parseAdd(msg, from, originOf(APP_URL));
  if (add) return add.ok ? onAdd(add.req, sender) : add;
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
      const appendTo = state.addTo
        ? state.addTo.demoId
        : state.appendDemo
          ? state.appendDemo.id
          : attach && attach.workspaceId === state.workspaceId && Date.now() - attach.at < ATTACH_TTL_MS
            ? attach.demoId
            : undefined;
      await browser.storage.local.set({
        'fd.htmlReview': {
          workspaceId: state.workspaceId,
          title: state.title || 'Nouvelle démo',
          appendTo,
          folderId: state.folderId ?? null,
          // EXT-02 §8 : ajout à la démo ouverte dans l'éditeur (étapes HTML)
          addTo: state.addTo ?? null,
        },
      });
      if (state.addTo) {
        const t = await addTarget();
        if (t && t.demoId === state.addTo.demoId) await saveTarget({ ...t, state: 'review' });
      }
      await browser.tabs.create({ url: browser.runtime.getURL('/html-review.html') });
    }
    return setState({ ...EMPTY });
  }
  await releaseTabs(state);
  // L60 §3 : sans donnée repérée, pas d'écran de vérification : la barre de l'onglet capturé devient le
  // panneau d'envoi et l'envoi part tout de suite (onglet de vérification ouvert en arrière-plan)
  const caps = state.workspaceId ? await pending.all() : [];
  const clean = caps.length > 0 && caps.every((c) => !c.zones.some((z) => !z.manual));
  const sendTab = clean && !state.addTo && state.tabId !== null ? state.tabId : null;
  for (const t of state.tabs ?? [{ id: state.tabId ?? -1 }])
    if (t.id >= 0 && t.id !== sendTab)
      await browser.tabs.sendMessage(t.id, { type: 'fd:recorder-stop' }).catch(() => undefined);
  if (sendTab !== null) {
    await browser.storage.local.set({ 'fd.autoSend': { tabId: sendTab, at: Date.now() } });
    await browser.tabs
      .sendMessage(sendTab, { type: 'fd:send-progress', done: 0, total: caps.length })
      .catch(() => undefined);
  }
  if (state.workspaceId && caps.length > 0) {
    await browser.storage.local.set({
      'fd.review': {
        workspaceId: state.workspaceId,
        title: state.title || 'Nouvelle démo',
        // F7 : démo mobile (cadre téléphone dans le lecteur)
        device: state.mode === 'mobile' ? 'mobile' : 'desktop',
        viewport: state.mode === 'mobile' ? (state.viewport ?? null) : null,
        fill: state.fill ?? null,
        // L64 §2 : dossier de la nouvelle démo, ou démo existante (étapes à la fin)
        folderId: state.folderId ?? null,
        appendTo: state.addTo ? null : (state.appendDemo?.id ?? null),
        // EXT-02 §8 : ajout à la démo ouverte dans l'éditeur
        addTo: state.addTo ?? null,
      },
    });
    if (state.addTo) {
      const t = await addTarget();
      if (t && t.demoId === state.addTo.demoId) await saveTarget({ ...t, state: 'review' });
    }
    await browser.tabs.create({ url: browser.runtime.getURL('/review.html'), active: sendTab === null });
  } else if (state.addTo) await browser.storage.local.remove(ADD_KEY);
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
  // EXT-02 §8 : la cible ne vaut que pour une capture, elle est effacée à l'annulation
  if (state.addTo) await browser.storage.local.remove(ADD_KEY);
  return setState({ ...EMPTY });
}

/** EXT-02 §8 : pastille de cible d'un ajout (« Démo CRM · après l'étape 3 »), null hors ajout. */
function targetChip(s: { addTo?: RecordingStatus['addTo'] }): string | null {
  return s.addTo
    ? (s.addTo.after ? strings.addChipAfter : strings.addChipStart)
        .replace('{{demo}}', s.addTo.title)
        .replace('{{n}}', String(s.addTo.after?.n ?? ''))
    : null;
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
        if (cmd === 'rec-pause') void togglePaused();
        return;
      }
      if (cmd === 'rec-pause')
        void (s.mode === 'video' ? onVideoBar({ type: 'fd:video-pause' }) : togglePaused());
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
    if (m.type.startsWith('fd:html-') || m.type === 'fd:fetch-asset')
      return onHtmlBar(m as HtmlBarRequest, sender);
    if (m.type === 'fd:click') {
      // On répond après la capture : le badge REC reste masqué jusque-là (il n'apparaît pas à l'image)
      if (sender.tab?.windowId !== undefined)
        return handleClick(m as ClickPayload, sender.tab.windowId, sender.tab.id).then((r) => r ?? true);
      return undefined;
    }
    // L60 §3 : avancement de l'envoi, relayé à la barre de l'onglet capturé ; fin : la barre se retire
    if (m.type === 'fd:send-progress' || m.type === 'fd:send-done') {
      const r = m as { tabId?: number; done?: number; total?: number };
      if (typeof r.tabId !== 'number') return undefined;
      return browser.tabs
        .sendMessage(
          r.tabId,
          m.type === 'fd:send-done'
            ? { type: 'fd:recorder-stop' }
            : { type: 'fd:send-progress', done: r.done, total: r.total },
        )
        .catch(() => undefined);
    }
    if (m.type === 'fd:undo-step')
      // L60 §2 : « Annuler » de la carte « Étape n capturée » : l'étape est retirée
      return getState().then(async (s) => {
        const { id, n } = m as { id?: string; n?: number };
        // Seule la dernière étape se retire : la numérotation reste continue
        if (!s.recording || s.steps < 1 || n !== s.steps) return s;
        if (s.mode === 'html') await htmlStore.remove(s.steps);
        else if (id) await pending.remove(id);
        else return s;
        return setState({ steps: s.steps - 1 });
      });
    if (m.type === 'fd:tab-info')
      // L25-01 : numéro de l'onglet suivi, pour la puce « Onglet 2 · Aide » de la barre
      return getState().then((s) => {
        const t = tracked(s, sender.tab?.id);
        // L26-04 : prochaine étape à capturer (n / N), affichée dans la barre
        const next = s.fill?.steps[s.steps];
        const guide =
          s.fill && next ? { title: next.title, n: s.steps + 1, total: s.fill.steps.length } : null;
        // EXT-02 §8 : pastille de cible « Démo CRM · après l'étape 3 »
        const target = targetChip(s);
        // EXT-02 §5 : la barre affiche « Capture · n »
        if (t) return { n: t.n, title: sender.tab?.title ?? t.title, guide, steps: s.steps, target };
        return { n: 1, title: '', guide, steps: s.steps, target };
      });
    const p = m as PopupRequest;
    if (p.type === 'fd:status') return getState();
    if (p.type === 'fd:start')
      return start(p).catch((e: unknown) => setState({ lastError: (e as Error).message ?? String(e) }));
    if (m.type === 'fd:stop') return stop();
    if (m.type === 'fd:pause')
      return getState().then((s) =>
        s.mode === 'video' ? onVideoBar({ type: 'fd:video-pause' }) : togglePaused(),
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
