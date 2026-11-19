import '@flowdsiml/ui/tokens.css';
import './style.css';
import { APP_URL } from '@/lib/config';
import { strings } from '@/lib/i18n';
import { checkRecording, clampZone, proposePauses, timer, type Zone } from '@/lib/video';
import { videoStore } from '@/lib/videoStore';
import { sendVideo } from '@/lib/videoUpload';

/**
 * F7 / L21-01 : vérification après l'enregistrement. Une seule durée (lue dans la vidéo), images
 * clés tirées de la vidéo à chaque repère, zones floutées repérées pendant l'enregistrement visibles
 * et ajustables (déplacer, redimensionner, ajouter, retirer) : elles sont incrustées dans les images
 * envoyées. Au-delà de 50 Mo, envoi impossible (raison affichée). « Supprimer l'enregistrement »
 * demande confirmation. Rien n'est envoyé avant « Envoyer ».
 */
const s = strings;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]'))
  el.textContent = s[el.dataset.i18n as keyof typeof s];
document.title = s.vrTitle;
const fill = (t: string, v: Record<string, string | number>) =>
  t.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(v[k] ?? ''));

function alert(msg: string | null) {
  $('alert').textContent = msg ?? '';
  $('alert').hidden = !msg;
}

/** Promesse bornée : au-delà du délai (vidéo illisible), la valeur de repli. */
const within = <T>(p: Promise<T>, ms: number, fallback: T) =>
  Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);

/** Durée réelle d'une vidéo WebM (MediaRecorder n'écrit pas la durée : on la fait calculer). */
function realDuration(v: HTMLVideoElement): Promise<number> {
  return new Promise((resolve) => {
    v.addEventListener('error', () => resolve(NaN), { once: true });
    const done = () => {
      if (Number.isFinite(v.duration) && v.duration > 0) {
        v.removeEventListener('durationchange', done);
        v.currentTime = 0;
        resolve(v.duration * 1000);
      }
    };
    const start = () => {
      if (Number.isFinite(v.duration) && v.duration > 0) return resolve(v.duration * 1000);
      v.addEventListener('durationchange', done);
      v.currentTime = 1e7;
    };
    if (v.readyState >= 1) start();
    else v.addEventListener('loadedmetadata', start, { once: true });
  });
}

function seek(v: HTMLVideoElement, ms: number): Promise<void> {
  return new Promise((resolve) => {
    v.addEventListener('seeked', () => resolve(), { once: true });
    v.currentTime = Math.max(0, ms / 1000);
  });
}

/** Image clé tirée de la vidéo enregistrée (déjà floutée pendant l'enregistrement). */
async function grab(v: HTMLVideoElement, ms: number): Promise<HTMLCanvasElement> {
  await seek(v, ms);
  const c = document.createElement('canvas');
  c.width = v.videoWidth || 1280;
  c.height = v.videoHeight || 800;
  c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
  return c;
}

/** Image envoyée : image clé avec les zones floutées incrustées (pixels illisibles). */
async function burn(src: HTMLCanvasElement, zones: Zone[]): Promise<Blob | null> {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  for (const z of zones) {
    const x = z.x * c.width;
    const y = z.y * c.height;
    const w = z.w * c.width;
    const h = z.h * c.height;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.filter = 'blur(14px)';
    ctx.drawImage(src, 0, 0);
    ctx.restore();
    ctx.fillStyle = 'rgba(120,120,120,0.35)';
    ctx.fillRect(x, y, w, h);
  }
  return new Promise((r) => c.toBlob(r, 'image/webp', 0.86));
}

async function main() {
  const v = await videoStore.get();
  if (!v) {
    alert(s.vrNone);
    $<HTMLButtonElement>('send').disabled = true;
    return;
  }
  const video = $<HTMLVideoElement>('video');
  video.src = URL.createObjectURL(v.blob);
  video.setAttribute('aria-label', s.vrVideoLabel);
  // Une seule durée : celle de la vidéo (le lecteur affiche la même)
  const measured = await within(realDuration(video), 4000, NaN);
  const durationMs = Math.round(Number.isFinite(measured) ? measured : v.durationMs);
  const lang = document.documentElement.lang;
  const mb = (v.blob.size / 1024 / 1024).toLocaleString(lang, { maximumFractionDigits: 1 });
  $('meta').textContent =
    `${v.title || s.vrUntitled} · ${timer(durationMs)} · ${mb} Mo${v.hasVoice ? '' : ` · ${s.vrNoSound}`}`;

  // Images clés tirées de la vidéo (lecteur caché, pour ne pas déplacer celui de la page)
  const kept = proposePauses(v.marks, durationMs);
  const reader = document.createElement('video');
  reader.muted = true;
  reader.src = video.src;
  const readable = Number.isFinite(await within(realDuration(reader), 4000, NaN));
  const shots: Array<HTMLCanvasElement | null> = [];
  for (const m of kept)
    shots.push(
      readable
        ? await within(
            grab(reader, m.t).catch(() => null),
            3000,
            null,
          )
        : null,
    );
  const zones: Zone[][] = kept.map((m) => (m.zones ?? []).map(clampZone));
  const detected = zones.reduce((a, z) => a + z.length, 0);
  $('blurred').textContent = detected
    ? fill(s.vrZones, { n: detected })
    : v.blurredZones
      ? fill(s.vrBlurred, { n: v.blurredZones })
      : s.vrBlurredNone;

  const list = $('frames');
  function render(focus?: { i: number; z: number }) {
    list.replaceChildren(
      ...kept.map((m, i) => {
        const li = document.createElement('li');
        const fig = document.createElement('div');
        fig.className = 'kf';
        const shot = shots[i];
        const img = document.createElement('img');
        const fallback = v!.frames[v!.marks.indexOf(m)];
        if (shot) img.src = shot.toDataURL('image/webp', 0.8);
        else if (fallback) img.src = URL.createObjectURL(fallback);
        img.alt = fill(s.vrFrameAlt, { n: i + 1, t: timer(m.t) });
        fig.append(img);
        zones[i]!.forEach((z, k) => fig.append(zoneEl(i, k, z)));
        const cap = document.createElement('div');
        cap.className = 'kf-cap';
        const txt = document.createElement('span');
        txt.textContent = `${fill(s.vrPause, { n: i + 1 })} · ${timer(m.t)}${m.label ? ` · ${m.label}` : ''}`;
        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'btn btn-small';
        add.textContent = s.vrAddZone;
        add.setAttribute('aria-label', `${s.vrAddZone} · ${fill(s.vrPause, { n: i + 1 })}`);
        add.onclick = () => {
          zones[i]!.push({ x: 0.4, y: 0.4, w: 0.2, h: 0.08 });
          render({ i, z: zones[i]!.length - 1 });
        };
        cap.append(txt, add);
        li.append(fig, cap);
        return li;
      }),
    );
    if (!kept.length)
      list.replaceChildren(Object.assign(document.createElement('li'), { textContent: s.vrNoFrames }));
    if (focus) list.querySelector<HTMLElement>(`[data-zone="${focus.i}-${focus.z}"]`)?.focus();
  }

  /** Zone floutée : déplaçable (souris, flèches), redimensionnable (poignée, Maj + flèches), retirable. */
  function zoneEl(i: number, k: number, z: Zone) {
    const el = document.createElement('div');
    el.className = 'zone';
    el.tabIndex = 0;
    el.dataset.zone = `${i}-${k}`;
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', fill(s.vrZone, { z: k + 1, n: i + 1 }));
    el.setAttribute('aria-describedby', 'zone-help');
    const place = (q: Zone) => {
      el.style.left = `${q.x * 100}%`;
      el.style.top = `${q.y * 100}%`;
      el.style.width = `${q.w * 100}%`;
      el.style.height = `${q.h * 100}%`;
    };
    place(z);
    const set = (q: Zone) => {
      zones[i]![k] = clampZone(q);
      place(zones[i]![k]!);
    };
    const handle = document.createElement('span');
    handle.className = 'zone-h';
    handle.setAttribute('aria-hidden', 'true');
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'zone-x';
    del.textContent = '×';
    del.setAttribute('aria-label', fill(s.vrRemoveZone, { z: k + 1, n: i + 1 }));
    del.onclick = (e) => {
      e.stopPropagation();
      zones[i]!.splice(k, 1);
      render();
    };
    el.append(handle, del);
    el.addEventListener('pointerdown', (e) => {
      if (e.target === del) return;
      e.preventDefault();
      const box = el.parentElement!.getBoundingClientRect();
      const start = { ...zones[i]![k]! };
      const sx = e.clientX;
      const sy = e.clientY;
      const resize = e.target === handle;
      el.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => {
        const dx = (ev.clientX - sx) / box.width;
        const dy = (ev.clientY - sy) / box.height;
        set(
          resize
            ? { ...start, w: start.w + dx, h: start.h + dy }
            : { ...start, x: start.x + dx, y: start.y + dy },
        );
      };
      const up = () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
    });
    el.addEventListener('keydown', (e) => {
      const q = zones[i]![k]!;
      const step = 0.01;
      const d: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      if (d[e.key]) {
        e.preventDefault();
        const [dx, dy] = d[e.key]!;
        set(e.shiftKey ? { ...q, w: q.w + dx, h: q.h + dy } : { ...q, x: q.x + dx, y: q.y + dy });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        zones[i]!.splice(k, 1);
        render();
      }
    });
    return el;
  }
  render();

  // État bloqué au-delà de 50 Mo : message, « Envoyer » désactivé avec la raison
  const check = checkRecording(v.blob.size, durationMs);
  const send = $<HTMLButtonElement>('send');
  const reason = $('reason');
  if (check === 'tooBig') {
    alert(s.vrTooBig);
    send.disabled = true;
    reason.textContent = fill(s.vrTooBigReason, {
      mb: (v.blob.size / 1024 / 1024).toLocaleString(lang, { maximumFractionDigits: 1 }),
    });
    reason.hidden = false;
    send.setAttribute('aria-describedby', 'reason');
  } else if (check !== 'ok') {
    alert(s.vrEmpty);
    send.disabled = true;
  }
  send.addEventListener('click', async () => {
    send.disabled = true;
    alert(null);
    try {
      const keptFrames = await Promise.all(
        shots.map((c, i) => (c ? burn(c, zones[i]!) : Promise.resolve(null))),
      );
      const demoId = await sendVideo(
        v,
        (r) => ($('progress').textContent = fill(s.vrSending, { p: Math.round(r * 100) })),
        { durationMs, keptFrames },
      );
      await videoStore.clear();
      $('progress').textContent = s.vrSent;
      location.href = `${APP_URL.replace(/\/$/, '')}/#/demos/${demoId}/edit`;
    } catch (e) {
      send.disabled = false;
      $('progress').textContent = '';
      alert((e as Error).message === 'TOO_BIG' ? s.vrTooBig : s.vrError);
    }
  });

  // « Supprimer l'enregistrement » : confirmation dans la page, focus rendu au bouton si annulé
  const dlg = $<HTMLDialogElement>('confirm');
  const del = $<HTMLButtonElement>('delete');
  del.addEventListener('click', () => {
    dlg.showModal();
    $<HTMLButtonElement>('confirm-no').focus();
  });
  $('confirm-no').addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', () => {
    if (dlg.returnValue !== 'yes') del.focus();
  });
  $('confirm-yes').addEventListener('click', async () => {
    dlg.returnValue = 'yes';
    await videoStore.clear();
    dlg.close();
    window.close();
  });
}
void main();
