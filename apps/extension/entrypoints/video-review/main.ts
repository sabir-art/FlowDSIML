import '@flowdsiml/ui/tokens.css';
import '@/lib/fonts.css';
import '../html-review/style.css';
import './style.css';
import {
  Check,
  CircleQuestionMark,
  Info,
  Pause,
  Play,
  Plus,
  Trash2,
  TriangleAlert,
  createElement as lucide,
  type IconNode,
} from 'lucide';
import { APP_URL } from '@/lib/config';
import { strings } from '@/lib/i18n';
import { rs } from '@/lib/reviewStrings';
import { checkRecording, proposePauses } from '@/lib/video';
import { burnVideo, coverRect } from '@/lib/videoBurn';
import {
  clock,
  manualMask,
  rectsAt,
  segments,
  span,
  toBurn,
  type MaskRect,
  type VideoMask,
} from '@/lib/videoMasks';
import { vr } from '@/lib/videoReviewStrings';
import { videoStore } from '@/lib/videoStore';
import { sendVideo } from '@/lib/videoUpload';
import { fmt, plural } from '@/lib/verifyStrings';

/**
 * EXT-02 §4.4 : « Vérifier la vidéo ». Le lecteur montre la vidéo avec ses masques ; la chronologie porte
 * un segment par passage masqué ; la liste a une ligne par donnée repérée (« Démasquer » / « Masquer »,
 * « Pourquoi masqué ? »). Une donnée masquée en direct l'est dans l'image : son masque est définitif.
 * Les autres masques sont incrustés à l'envoi (« Préparation de la vidéo… »). Rien ne part avant « Envoyer ».
 */
const s = vr;
const old = strings;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function icon(node: IconNode, size = 16): SVGElement {
  const el = lucide(node);
  el.setAttribute('width', String(size));
  el.setAttribute('height', String(size));
  el.setAttribute('aria-hidden', 'true');
  return el as unknown as SVGElement;
}
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | undefined> = {},
  ...children: Array<Node | string | null | undefined>
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined) continue;
    if (k === 'class') el.className = v;
    else el.setAttribute(k, v);
  }
  for (const c of children) if (c !== null && c !== undefined) el.append(c);
  return el;
}

function alertMsg(msg: string | null) {
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

function seekTo(v: HTMLVideoElement, ms: number): Promise<void> {
  return new Promise((resolve) => {
    v.addEventListener('seeked', () => resolve(), { once: true });
    v.currentTime = Math.max(0, ms / 1000);
  });
}

/** Nom d'une ligne : « Nom · « C•••••• M•••••• » », « Masque ajouté 1 », « Zone toujours masquée ». */
function nameOf(m: VideoMask, manualIndex: number): string {
  if (m.type === 'manual') return `${s.manual} ${manualIndex}`;
  if (m.type === 'zone') return s.zone;
  const type = rs.types[m.type];
  return m.excerpt ? `${type} · « ${m.excerpt} »` : type;
}

/** Texte du « Pourquoi masqué ? » : la raison du repérage, puis ce que la personne peut faire. */
function whyOf(m: VideoMask): string {
  let reason: string;
  if (m.by === 'manual') return s.byManual;
  if (m.by === 'zone' || m.type === 'zone' || m.type === 'manual') reason = s.byZone;
  else {
    const kind = s.kind[m.type];
    reason =
      m.by === 'field'
        ? m.label
          ? fmt(s.byField, { kind, label: m.label })
          : fmt(s.byFieldNoLabel, { kind })
        : m.by === 'label' && m.label
          ? fmt(s.byLabel, { kind, label: m.label })
          : fmt(s.byPattern, { kind });
  }
  return `${reason} ${m.live ? s.whyLive : m.on ? s.whyOn : s.whyOff}`;
}

async function main() {
  document.title = s.title;
  $('top-title').textContent = s.title;
  $('h1').textContent = s.title;
  $('zones-h').textContent = s.zones;
  $('hint').textContent = s.hint;
  $('mask-help').textContent = s.maskHelp;
  $('add').replaceChildren(icon(Plus), s.add);
  $('delete').replaceChildren(icon(Trash2), s.delete);
  $('send').textContent = s.send;
  $('player').setAttribute('aria-label', s.player);
  $('confirm-t').textContent = old.vrConfirmTitle;
  $('confirm-d').textContent = old.vrConfirmBody;
  $('confirm-no').textContent = old.vrCancel;
  $('confirm-yes').textContent = old.vrDelete;

  const send = $<HTMLButtonElement>('send');
  const v = await videoStore.get();
  if (!v) {
    alertMsg(old.vrNone);
    $('split').hidden = true;
    $<HTMLButtonElement>('delete').disabled = true;
    return;
  }
  const video = $<HTMLVideoElement>('video');
  video.src = URL.createObjectURL(v.blob);
  video.setAttribute('aria-label', s.player);
  // Une seule durée : celle de la vidéo
  const measured = await within(realDuration(video), 4000, NaN);
  const durationMs = Math.round(Number.isFinite(measured) ? measured : v.durationMs);
  const total = clock(durationMs);

  // ---------- État ----------
  const masks: VideoMask[] = (v.masks ?? []).map((m) => ({ ...m }));
  let selected: string | null = masks[0]?.id ?? null;
  const whyOpen = new Set<string>();
  let busy = false;
  let manualSeq = 0;
  const manualNo = new Map<string, number>();
  const label = (m: VideoMask) => {
    if (m.type === 'manual' && !manualNo.has(m.id)) manualNo.set(m.id, ++manualSeq);
    return nameOf(m, manualNo.get(m.id) ?? 0);
  };
  const live = masks.some((m) => m.live);
  $('intro').textContent = !masks.length
    ? s.introNone
    : live
      ? s.introLive
      : plural(s.intro_one, s.intro_other, masks.length);
  const now = () => video.currentTime * 1000;

  // ---------- Lecteur : masques sur l'image ----------
  const layer = $('masks');
  const place = (el: HTMLElement, r: MaskRect) => {
    el.style.left = `${r.x * 100}%`;
    el.style.top = `${r.y * 100}%`;
    el.style.width = `${r.w * 100}%`;
    el.style.height = `${r.h * 100}%`;
  };
  function renderMasks() {
    const t = now();
    const kids: HTMLElement[] = [];
    for (const m of masks) {
      const rects = rectsAt(m, t, 0);
      rects.forEach((r, i) => {
        const cls = [
          'vmask',
          m.live ? 'is-live' : m.on ? '' : 'is-off',
          m.id === selected ? 'is-sel' : '',
          m.type === 'manual' ? 'is-manual' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const el = h('div', { class: cls, 'data-mask': m.id });
        place(el, r);
        if (m.type === 'manual' && i === 0 && !busy) editable(el, m);
        kids.push(el);
      });
    }
    // Le masque en cours de déplacement garde le focus : on ne le remplace pas
    const active = document.activeElement as HTMLElement | null;
    const keep = active?.closest<HTMLElement>('.vmask.is-manual');
    const id = keep?.dataset.mask;
    layer.replaceChildren(...kids);
    if (id) layer.querySelector<HTMLElement>(`.vmask.is-manual[data-mask="${id}"]`)?.focus();
  }

  /** Masque ajouté : déplaçable (souris, flèches), redimensionnable (poignée, Maj + flèches), retirable. */
  function editable(el: HTMLElement, m: VideoMask) {
    el.tabIndex = 0;
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', fmt(s.maskLabel, { name: label(m) }));
    el.setAttribute('aria-describedby', 'mask-help');
    const grip = h('span', { class: 'grip', 'aria-hidden': 'true' });
    el.append(grip);
    const rect = () => m.frames[0]!.rects[0]!;
    const set = (r: MaskRect) => {
      const w = Math.min(1, Math.max(0.02, r.w));
      const hh = Math.min(1, Math.max(0.02, r.h));
      m.frames[0]!.rects[0] = {
        x: Math.min(1 - w, Math.max(0, r.x)),
        y: Math.min(1 - hh, Math.max(0, r.y)),
        w,
        h: hh,
      };
      place(el, rect());
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.focus();
      select(m.id, false);
      const box = $('screen').getBoundingClientRect();
      const start = { ...rect() };
      const resize = e.target === grip;
      el.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => {
        const dx = (ev.clientX - e.clientX) / box.width;
        const dy = (ev.clientY - e.clientY) / box.height;
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
      const step = 0.01;
      const d: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const q = rect();
      if (d[e.key]) {
        e.preventDefault();
        const [dx, dy] = d[e.key]!;
        set(e.shiftKey ? { ...q, w: q.w + dx, h: q.h + dy } : { ...q, x: q.x + dx, y: q.y + dy });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeMask(m);
      }
    });
  }

  // ---------- Chronologie ----------
  const tl = $('timeline');
  const head = $('head');
  tl.setAttribute('aria-label', s.timeline);
  tl.setAttribute('aria-valuemax', String(Math.round(durationMs / 1000)));
  function renderTimeline() {
    const segs: HTMLElement[] = [];
    for (const m of masks)
      for (const [a, b] of segments(m, durationMs)) {
        const el = h('span', {
          class: `seg${m.live || m.on ? '' : ' off'}${m.id === selected ? ' sel' : ''}`,
          'data-mask': m.id,
        });
        el.style.left = `${(a / durationMs) * 100}%`;
        el.style.width = `${(Math.max(0, b - a) / durationMs) * 100}%`;
        segs.push(el);
      }
    tl.replaceChildren(...segs, head);
    tick();
  }
  function tick() {
    const t = Math.min(durationMs, now());
    head.style.left = `${durationMs ? (t / durationMs) * 100 : 0}%`;
    $('time').textContent = `${clock(t)} / ${total}`;
    tl.setAttribute('aria-valuenow', String(Math.round(t / 1000)));
    tl.setAttribute('aria-valuetext', fmt(s.timelineValue, { t: clock(t), total }));
    renderMasks();
  }
  const goTo = (ms: number) => {
    video.currentTime = Math.min(durationMs, Math.max(0, ms)) / 1000;
    tick();
  };
  tl.addEventListener('pointerdown', (e) => {
    const box = tl.getBoundingClientRect();
    const at = (ev: PointerEvent) => goTo(((ev.clientX - box.left) / box.width) * durationMs);
    at(e);
    tl.setPointerCapture(e.pointerId);
    const up = () => {
      tl.removeEventListener('pointermove', at);
      tl.removeEventListener('pointerup', up);
    };
    tl.addEventListener('pointermove', at);
    tl.addEventListener('pointerup', up);
  });
  tl.addEventListener('keydown', (e) => {
    const d: Record<string, number> = { ArrowLeft: -1000, ArrowRight: 1000, PageDown: -5000, PageUp: 5000 };
    if (e.key in d) goTo(now() + d[e.key]!);
    else if (e.key === 'Home') goTo(0);
    else if (e.key === 'End') goTo(durationMs);
    else return;
    e.preventDefault();
  });
  let raf = 0;
  const loop = () => {
    tick();
    raf = video.paused ? 0 : requestAnimationFrame(loop);
  };
  const play = $('play');
  const playIcon = () => {
    play.replaceChildren(icon(video.paused ? Play : Pause, 18));
    play.setAttribute('aria-label', video.paused ? s.play : s.pause);
  };
  playIcon();
  play.addEventListener('click', () => {
    if (!video.paused) return video.pause();
    if (now() >= durationMs - 50) video.currentTime = 0;
    void video.play();
  });
  video.addEventListener('play', () => {
    playIcon();
    if (!raf) raf = requestAnimationFrame(loop);
  });
  video.addEventListener('pause', playIcon);
  video.addEventListener('ended', playIcon);
  video.addEventListener('seeked', tick);
  video.addEventListener('timeupdate', () => video.paused && tick());

  // ---------- Liste ----------
  const list = $('list');
  function select(id: string | null, jump = true) {
    selected = id;
    const m = masks.find((x) => x.id === id);
    const at = m ? span(m, durationMs) : null;
    if (jump && at) {
      video.pause();
      goTo(at[0]);
    }
    renderList();
    renderTimeline();
  }
  function removeMask(m: VideoMask) {
    const i = masks.indexOf(m);
    masks.splice(i, 1);
    whyOpen.delete(m.id);
    selected = masks[Math.min(i, masks.length - 1)]?.id ?? null;
    renderList();
    renderTimeline();
    (list.querySelector<HTMLElement>(`[data-key="act:${selected}"]`) ?? $('add')).focus();
  }
  function renderList() {
    const onCount = masks.filter((m) => m.live || m.on).length;
    $('count').textContent = masks.length ? fmt(s.count, { on: onCount, total: masks.length }) : '';
    const kids: HTMLElement[] = [];
    for (const m of masks) {
      const name = label(m);
      const at = span(m, durationMs);
      const open = whyOpen.has(m.id);
      const whyId = `why-${m.id}`;
      const pick = h(
        'button',
        { type: 'button', class: 'mr-name', 'aria-label': fmt(s.goTo, { name }) },
        name,
      );
      pick.addEventListener('click', () => select(m.id));
      const status = h('span', { class: `st2${m.live || m.on ? '' : ' off'}` });
      if (m.live) status.append(s.status.live);
      else if (m.on) status.append(icon(Check, 14), s.status.on);
      else status.append(icon(TriangleAlert, 14), s.status.off);
      let action: HTMLElement = h('span', {});
      if (!m.live) {
        const manual = m.type === 'manual';
        const text = manual ? s.remove : m.on ? s.unmask : s.mask;
        const aria = fmt(manual ? s.removeOf : m.on ? s.unmaskOf : s.maskOf, { name });
        const b = h(
          'button',
          { type: 'button', class: 'bt ac2', 'aria-label': aria, 'data-key': `act:${m.id}` },
          text,
        );
        b.disabled = busy;
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          if (manual) return removeMask(m);
          m.on = !m.on;
          selected = m.id;
          renderList();
          renderTimeline();
          list.querySelector<HTMLElement>(`[data-key="act:${m.id}"]`)?.focus();
        });
        action = b;
      }
      const why = h(
        'button',
        {
          type: 'button',
          class: 'wy',
          'aria-expanded': String(open),
          'aria-controls': whyId,
          'aria-label': fmt(s.whyOf, { name }),
          'data-key': `why:${m.id}`,
        },
        icon(CircleQuestionMark),
        s.why,
      );
      why.addEventListener('click', (e) => {
        e.stopPropagation();
        if (open) whyOpen.delete(m.id);
        else whyOpen.add(m.id);
        renderList();
        list.querySelector<HTMLElement>(`[data-key="why:${m.id}"]`)?.focus();
      });
      const row = h(
        'li',
        { class: `mr${m.id === selected ? ' on' : ''}`, 'data-mask': m.id },
        h(
          'div',
          { class: 'tx' },
          pick,
          h('span', { class: 'mu' }, at ? `${clock(at[0])} – ${clock(at[1])}` : ''),
        ),
        status,
        action,
        why,
      );
      // Toute la ligne amène au passage (le bouton du nom fait de même au clavier)
      row.addEventListener('click', (e) => {
        if (!(e.target as Element).closest('button')) select(m.id);
      });
      kids.push(row);
      if (open) kids.push(h('li', { class: 'why', id: whyId }, icon(Info), h('p', {}, whyOf(m))));
    }
    if (!masks.length) kids.push(h('li', { class: 'mnone mu' }, s.empty));
    list.replaceChildren(...kids);
  }

  // ---------- Ajouter un masque ----------
  let seq = 0;
  function addMask(rect: MaskRect) {
    const m = manualMask(`m${++seq}-${Date.now().toString(36)}`, rect, now(), durationMs);
    masks.push(m);
    selected = m.id;
    renderList();
    renderTimeline();
    layer.querySelector<HTMLElement>(`.vmask.is-manual[data-mask="${m.id}"]`)?.focus();
  }
  $('add').addEventListener('click', () => {
    video.pause();
    addMask({ x: 0.4, y: 0.42, w: 0.2, h: 0.08 });
  });
  // Glisser sur l'image : un masque à cet endroit, à partir de l'instant affiché
  const screen = $('screen');
  screen.addEventListener('pointerdown', (e) => {
    if (busy || e.button !== 0 || (e.target as Element).closest('.vmask.is-manual')) return;
    e.preventDefault();
    video.pause();
    const box = screen.getBoundingClientRect();
    const rel = (ev: PointerEvent) => ({
      x: Math.min(1, Math.max(0, (ev.clientX - box.left) / box.width)),
      y: Math.min(1, Math.max(0, (ev.clientY - box.top) / box.height)),
    });
    const a = rel(e);
    const draft = h('div', { class: 'vdraft' });
    layer.append(draft);
    let r: MaskRect = { x: a.x, y: a.y, w: 0, h: 0 };
    screen.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const b = rel(ev);
      r = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
      place(draft, r);
    };
    const up = () => {
      screen.removeEventListener('pointermove', move);
      screen.removeEventListener('pointerup', up);
      draft.remove();
      if (r.w >= 0.02 && r.h >= 0.02) addMask(r);
    };
    screen.addEventListener('pointermove', move);
    screen.addEventListener('pointerup', up);
  });

  renderList();
  renderTimeline();

  // ---------- Envoi ----------
  const check = checkRecording(v.blob.size, durationMs);
  const reason = $('reason');
  const lang = document.documentElement.lang;
  if (check === 'tooBig') {
    alertMsg(old.vrTooBig);
    reason.textContent = old.vrTooBigReason.replace(
      '{{mb}}',
      (v.blob.size / 1024 / 1024).toLocaleString(lang, { maximumFractionDigits: 1 }),
    );
    reason.hidden = false;
    send.setAttribute('aria-describedby', 'reason');
  } else if (check !== 'ok') alertMsg(old.vrEmpty);
  else send.disabled = false;

  const status = $('status');
  // Libellé et barre créés une fois, puis mis à jour : le lecteur d'écran n'entend pas chaque image
  const progText = h('b', {});
  const progFill = h('i', {});
  const progBar = h('span', { class: 'prog', 'aria-hidden': 'true' }, progFill);
  let lastShown = '';
  const progress = (text: string, ratio: number | null) => {
    const p = ratio === null ? null : Math.round(ratio * 100);
    const shown = p === null ? text : fmt(text, { p });
    progFill.style.width = `${p ?? 100}%`;
    if (shown !== lastShown) {
      lastShown = shown;
      progText.textContent = shown;
    }
    if (!progText.isConnected) status.replaceChildren(progText, progBar);
  };
  const guard = (e: BeforeUnloadEvent) => {
    e.preventDefault();
  };

  /** Images des pauses, tirées de la vidéo envoyée (masques déjà dans l'image, sinon incrustés ici). */
  async function keyFrames(blob: Blob, burned: boolean, toCover: VideoMask[], times: number[]) {
    const reader = document.createElement('video');
    reader.muted = true;
    reader.src = URL.createObjectURL(blob);
    const readable = Number.isFinite(await within(realDuration(reader), 4000, NaN));
    const out: Array<Blob | null> = [];
    for (const t of times) {
      if (!readable) {
        out.push(null);
        continue;
      }
      const ok = await within(
        seekTo(reader, t).then(() => true),
        3000,
        false,
      );
      if (!ok) {
        out.push(null);
        continue;
      }
      const c = document.createElement('canvas');
      c.width = reader.videoWidth || 1280;
      c.height = reader.videoHeight || 800;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(reader, 0, 0, c.width, c.height);
      if (!burned)
        for (const m of toCover) for (const r of rectsAt(m, t)) coverRect(ctx, reader, r, c.width, c.height);
      out.push(await new Promise<Blob | null>((res) => c.toBlob(res, 'image/webp', 0.86)));
    }
    URL.revokeObjectURL(reader.src);
    return out;
  }

  send.addEventListener('click', async () => {
    send.disabled = true;
    busy = true;
    alertMsg(null);
    video.pause();
    renderList();
    renderMasks();
    $<HTMLButtonElement>('add').disabled = true;
    // Pendant la préparation et l'envoi, la barre ne porte que l'avancement et « Envoyer »
    $<HTMLButtonElement>('delete').hidden = true;
    addEventListener('beforeunload', guard);
    const burnList = toBurn(masks);
    let stage: 'prep' | 'send' = 'prep';
    try {
      let blob = v.blob;
      if (burnList.length) {
        // Les masques sont incrustés dans chaque image : la vidéo envoyée les porte
        progress(s.prep, 0);
        blob = await burnVideo(v.blob, burnList, durationMs, (r) => progress(s.prep, r));
        if (checkRecording(blob.size, durationMs) === 'tooBig') throw new Error('TOO_BIG');
      }
      stage = 'send';
      progress(s.sending, 0);
      const kept = proposePauses(v.marks, durationMs);
      const keptFrames = await keyFrames(
        blob,
        burnList.length > 0,
        burnList,
        kept.map((m) => m.t),
      );
      const demoId = await sendVideo({ ...v, blob }, (r) => progress(s.sending, r), {
        durationMs,
        keptFrames,
      });
      await videoStore.clear();
      removeEventListener('beforeunload', guard);
      progress(s.sent, null);
      location.href = `${APP_URL.replace(/\/$/, '')}/#/demos/${demoId}/edit`;
    } catch (e) {
      removeEventListener('beforeunload', guard);
      busy = false;
      send.disabled = false;
      $<HTMLButtonElement>('add').disabled = false;
      $<HTMLButtonElement>('delete').hidden = false;
      status.replaceChildren();
      lastShown = '';
      renderList();
      renderMasks();
      alertMsg(
        (e as Error).message === 'TOO_BIG' ? old.vrTooBig : stage === 'prep' ? s.prepError : old.vrError,
      );
    }
  });

  // « Supprimer l'enregistrement » : confirmation dans la page, focus rendu au bouton si annulé
  const dlg = $<HTMLDialogElement>('confirm');
  const del = $<HTMLButtonElement>('delete');
  del.addEventListener('click', () => {
    dlg.returnValue = '';
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
