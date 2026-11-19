import '@flowdsiml/ui/tokens.css';
import './style.css';
import { browser } from 'wxt/browser';
import { APP_URL } from '@/lib/config';
import { strings } from '@/lib/i18n';
import { checkRecording, proposePauses, timer } from '@/lib/video';
import { videoStore } from '@/lib/videoStore';
import { sendVideo } from '@/lib/videoUpload';

/**
 * F7 : vérification après l'enregistrement (images clés, une par repère). Les données repérées ont
 * été floutées dans la page pendant l'enregistrement ; ici, pas de retouche : « Envoyer » ou
 * « Supprimer l'enregistrement ». Au-delà de 50 Mo, l'envoi est impossible (message clair).
 */
const s = strings;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]'))
  el.textContent = s[el.dataset.i18n as keyof typeof s];
document.title = s.vrTitle;

function alert(msg: string | null) {
  $('alert').textContent = msg ?? '';
  $('alert').hidden = !msg;
}

async function main() {
  const v = await videoStore.get();
  if (!v) {
    alert(s.vrNone);
    $<HTMLButtonElement>('send').disabled = true;
    return;
  }
  const mb = (v.blob.size / 1024 / 1024).toLocaleString(document.documentElement.lang, {
    maximumFractionDigits: 1,
  });
  $('meta').textContent =
    `${v.title || s.vrUntitled} · ${timer(v.durationMs)} · ${mb} Mo${v.hasVoice ? '' : ` · ${s.vrNoSound}`}`;
  const video = $<HTMLVideoElement>('video');
  video.src = URL.createObjectURL(v.blob);
  video.setAttribute('aria-label', s.vrVideoLabel);
  $('blurred').textContent = v.blurredZones
    ? s.vrBlurred.replace('{{n}}', String(v.blurredZones))
    : s.vrBlurredNone;
  const kept = proposePauses(v.marks, v.durationMs);
  const list = $('frames');
  list.replaceChildren(
    ...kept.map((m, i) => {
      const li = document.createElement('li');
      const img = document.createElement('img');
      const blob = v.frames[v.marks.indexOf(m)];
      if (blob) img.src = URL.createObjectURL(blob);
      img.alt = s.vrFrameAlt.replace('{{n}}', String(i + 1)).replace('{{t}}', timer(m.t));
      const cap = document.createElement('span');
      cap.textContent = `${s.vrPause.replace('{{n}}', String(i + 1))} · ${timer(m.t)}${m.label ? ` · ${m.label}` : ''}`;
      li.append(img, cap);
      return li;
    }),
  );
  if (!kept.length)
    list.replaceChildren(Object.assign(document.createElement('li'), { textContent: s.vrNoFrames }));

  const check = checkRecording(v.blob.size, v.durationMs);
  const send = $<HTMLButtonElement>('send');
  if (check === 'tooBig') {
    alert(s.vrTooBig);
    send.disabled = true;
  } else if (check !== 'ok') {
    alert(s.vrEmpty);
    send.disabled = true;
  }
  send.addEventListener('click', async () => {
    send.disabled = true;
    alert(null);
    try {
      const demoId = await sendVideo(
        v,
        (r) => ($('progress').textContent = s.vrSending.replace('{{p}}', String(Math.round(r * 100)))),
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
  $('delete').addEventListener('click', async () => {
    if (!confirm(s.vrConfirmDelete)) return;
    await videoStore.clear();
    window.close();
  });
  void browser;
}
void main();
