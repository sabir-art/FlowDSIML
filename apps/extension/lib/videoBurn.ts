import { AUDIO_BPS, VIDEO_BPS, pickMime } from './video';
import { maskBox, rectsAt, type MaskRect, type VideoMask } from './videoMasks';

/**
 * EXT-02 §4 : incrustation des masques dans la vidéo, à l'envoi. La vidéo brute est rejouée dans un
 * canvas, chaque image reçoit ses masques, et le tout est réenregistré (WebM, même débit). Cela prend à
 * peu près la durée de la vidéo. Rien ne part avant la fin : la vidéo envoyée porte ses masques.
 */

/** Couvre une zone de l'image : flou fort du contenu, puis voile gris neutre (aucune couleur de marque). */
export function coverRect(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  source: CanvasImageSource,
  r: MaskRect,
  width: number,
  height: number,
) {
  const b = maskBox(r, width, height);
  if (!b.w || !b.h) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(b.x, b.y, b.w, b.h);
  ctx.clip();
  ctx.filter = 'blur(14px)';
  ctx.drawImage(source, 0, 0, width, height);
  ctx.filter = 'none';
  ctx.fillStyle = 'rgba(143,143,143,0.55)';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.restore();
}

/** Dessine l'image courante et ses masques (instant t en ms). */
export function drawMasked(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  masks: VideoMask[],
  t: number,
  width: number,
  height: number,
) {
  ctx.drawImage(video, 0, 0, width, height);
  for (const m of masks) for (const r of rectsAt(m, t)) coverRect(ctx, video, r, width, height);
}

export async function burnVideo(
  blob: Blob,
  masks: VideoMask[],
  durationMs: number,
  onProgress: (ratio: number) => void,
): Promise<Blob> {
  const video = document.createElement('video');
  video.playsInline = true;
  video.src = URL.createObjectURL(blob);
  try {
    await new Promise<void>((resolve, reject) => {
      video.addEventListener('loadeddata', () => resolve(), { once: true });
      video.addEventListener('error', () => reject(new Error('VIDEO_UNREADABLE')), { once: true });
    });
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponible');
    drawMasked(ctx, video, masks, 0, width, height);
    const tracks = [...canvas.captureStream(30).getVideoTracks()];
    // Le son passe par un graphe audio non relié aux haut-parleurs : rien n'est joué pendant la préparation
    let audio: AudioContext | null = null;
    try {
      audio = new AudioContext();
      const dest = audio.createMediaStreamDestination();
      audio.createMediaElementSource(video).connect(dest);
      tracks.push(...dest.stream.getAudioTracks());
    } catch {
      video.muted = true;
    }
    const mime = pickMime((t) => MediaRecorder.isTypeSupported(t));
    const recorder = new MediaRecorder(new MediaStream(tracks), {
      mimeType: mime,
      videoBitsPerSecond: VIDEO_BPS,
      audioBitsPerSecond: AUDIO_BPS,
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
    let done = false;
    const frame = () => {
      if (done) return;
      const t = video.currentTime * 1000;
      drawMasked(ctx, video, masks, t, width, height);
      onProgress(Math.min(0.99, durationMs > 0 ? t / durationMs : 0));
      schedule();
    };
    // Image par image quand le navigateur le permet (pas de retard entre l'image et son masque)
    const schedule = () =>
      'requestVideoFrameCallback' in video
        ? (video as HTMLVideoElement).requestVideoFrameCallback(frame)
        : requestAnimationFrame(frame);
    const ended = new Promise<void>((resolve, reject) => {
      video.addEventListener('ended', () => resolve(), { once: true });
      video.addEventListener('error', () => reject(new Error('VIDEO_UNREADABLE')), { once: true });
    });
    recorder.start(1000);
    schedule();
    await video.play();
    await ended;
    done = true;
    drawMasked(ctx, video, masks, durationMs, width, height);
    recorder.stop();
    await stopped;
    tracks.forEach((t) => t.stop());
    void audio?.close();
    onProgress(1);
    return new Blob(chunks, { type: mime.split(';')[0] });
  } finally {
    URL.revokeObjectURL(video.src);
  }
}
