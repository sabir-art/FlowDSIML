import { browser } from 'wxt/browser';
import { AUDIO_BPS, VIDEO_BPS, pickMime, type Mark, type Zone } from '@/lib/video';
import { videoStore, type PendingVideo } from '@/lib/videoStore';

/**
 * F7 : document hors écran (MV3) qui enregistre l'onglet. Flux de l'onglet (tabCapture), micro et
 * webcam facultatifs ; la webcam est incrustée en pastille ronde de 120 px en bas à droite (canvas).
 * Seul l'onglet est filmé, jamais l'écran entier. Débit plafonné (600 kb/s au total).
 */
type Start = {
  type: 'fd:rec-start';
  streamId: string;
  mic: boolean;
  webcam: boolean;
  meta: Omit<
    PendingVideo,
    'id' | 'blob' | 'mime' | 'durationMs' | 'marks' | 'frames' | 'hasVoice' | 'micDenied' | 'blurredZones'
  >;
};
type Msg =
  | Start
  | { type: 'fd:rec-pause' }
  | { type: 'fd:rec-resume' }
  | { type: 'fd:rec-mark'; t: number; label: string; manual: boolean; zones?: Zone[] }
  | { type: 'fd:rec-stop'; durationMs: number; blurredZones: number }
  | { type: 'fd:rec-cancel' };

let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let tracks: MediaStreamTrack[] = [];
let preview: HTMLVideoElement | null = null;
let marks: Mark[] = [];
let frames: Blob[] = [];
let hasVoice = false;
let micDenied = false;
let mime = 'video/webm';
let meta: Start['meta'] | null = null;

async function frame(): Promise<Blob> {
  const v = preview!;
  const c = document.createElement('canvas');
  c.width = v.videoWidth || 1280;
  c.height = v.videoHeight || 720;
  c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b ?? new Blob()), 'image/webp', 0.85));
}

async function start(m: Start) {
  chunks = [];
  marks = [];
  frames = [];
  meta = m.meta;
  const tab = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: m.streamId },
    } as unknown as MediaTrackConstraints,
  });
  tracks = [...tab.getTracks()];
  let mic: MediaStream | null = null;
  if (m.mic) {
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      tracks.push(...mic.getTracks());
    } catch {
      // Refus du micro : l'enregistrement continue sans son (alerte dans la barre)
      micDenied = true;
    }
  }
  hasVoice = !!mic;
  preview = document.createElement('video');
  preview.muted = true;
  preview.srcObject = tab;
  await preview.play();
  let video: MediaStream = tab;
  if (m.webcam) {
    try {
      const cam = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 320 } });
      tracks.push(...cam.getTracks());
      const camEl = document.createElement('video');
      camEl.muted = true;
      camEl.srcObject = cam;
      await camEl.play();
      const c = document.createElement('canvas');
      c.width = preview.videoWidth || 1280;
      c.height = preview.videoHeight || 720;
      const g = c.getContext('2d')!;
      const draw = () => {
        if (!recorder) return;
        g.drawImage(preview!, 0, 0, c.width, c.height);
        const r = 60;
        const cx = c.width - r - 24;
        const cy = c.height - r - 24;
        g.save();
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        g.clip();
        g.drawImage(camEl, cx - r, cy - r, r * 2, r * 2);
        g.restore();
        requestAnimationFrame(draw);
      };
      video = c.captureStream(15);
      requestAnimationFrame(draw);
    } catch {
      /* webcam refusée : vidéo de l'onglet seule */
    }
  }
  const out = new MediaStream([...video.getVideoTracks(), ...(mic?.getAudioTracks() ?? [])]);
  mime = pickMime((t) => MediaRecorder.isTypeSupported(t));
  recorder = new MediaRecorder(out, {
    mimeType: mime,
    videoBitsPerSecond: VIDEO_BPS,
    audioBitsPerSecond: AUDIO_BPS,
  });
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.start(1000);
  return { micDenied };
}

async function stop(durationMs: number, blurredZones: number) {
  const r = recorder;
  if (!r || !meta) return { ok: false };
  const done = new Promise<void>((res) => (r.onstop = () => res()));
  r.stop();
  await done;
  recorder = null;
  tracks.forEach((t) => t.stop());
  const blob = new Blob(chunks, { type: mime.split(';')[0] });
  await videoStore.put({
    id: 'current',
    blob,
    mime,
    durationMs,
    marks,
    frames,
    hasVoice,
    micDenied,
    blurredZones,
    ...meta,
  });
  return { ok: true, bytes: blob.size };
}

browser.runtime.onMessage.addListener((msg: unknown) => {
  const m = msg as Msg;
  if (m.type === 'fd:rec-start') return start(m).catch((e: Error) => ({ error: e.message }));
  if (m.type === 'fd:rec-pause') return void recorder?.pause();
  if (m.type === 'fd:rec-resume') return void recorder?.resume();
  if (m.type === 'fd:rec-mark')
    return frame().then((b) => {
      marks.push({ t: m.t, label: m.label, manual: m.manual, zones: m.zones ?? [] });
      frames.push(b);
      return true;
    });
  if (m.type === 'fd:rec-stop') return stop(m.durationMs, m.blurredZones);
  if (m.type === 'fd:rec-cancel') {
    recorder?.stop();
    recorder = null;
    tracks.forEach((t) => t.stop());
    return Promise.resolve(true);
  }
  return undefined;
});
