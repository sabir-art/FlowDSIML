import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';
import { Check, Crop, Monitor, Square, SquareMousePointer, createElement, type IconNode } from 'lucide';
import { elementLabel, type PxRect } from '@/lib/geometry';
import { cssSelector } from '@/lib/selector';
import type { ClickPayload } from '@/lib/messages';
import { scanFullPage, scanPage } from '@/lib/scan';
import { guideChip, strings, tabChip } from '@/lib/i18n';
import { asFrameMode, elementCrop, type FrameMode } from '@/lib/frame';

/**
 * Injecté à la demande (registration: runtime) dans l'onglet enregistré.
 * Écoute les clics en phase de capture et les transmet au service worker,
 * qui prend la capture d'écran. Le texte de la page n'est lu que pour repérer les données
 * personnelles possibles (spec f1-formation §1) : seuls le type, la boîte et un extrait masqué en
 * sortent, et rien n'est envoyé au serveur avant l'écran de vérification.
 *
 * EXT-02 §5 : barre d'enregistrement (pilule sombre, centrée en bas, déplaçable) : « Capture · n »,
 * segmenté « Page / Élément / Zone » qui vaut pour les clics suivants, « Redessiner » en mode Zone,
 * « Terminer ». La barre et les repères sont masqués pendant la prise de vue ; les clics sur la barre
 * ne créent pas d'étape. Le cadre et la zone sont gardés d'une page à l'autre (storage.local).
 */
const FRAME_KEY = 'fd.frameState';
type FrameState = { mode: FrameMode; zone: PxRect | null };

export default defineContentScript({
  matches: ['<all_urls>'],
  registration: 'runtime',
  main() {
    const w = window as unknown as { __fdRecorder?: boolean };
    if (w.__fdRecorder) return;
    w.__fdRecorder = true;
    const s = strings;
    const PRIMARY = '#a3195b';

    const host = document.createElement('div');
    host.setAttribute('data-fd-ui', '');
    host.style.cssText = 'position:fixed;z-index:2147483647;inset:0;pointer-events:none';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host{all:initial}
        *{box-sizing:border-box}
        [hidden]{display:none!important}
        .dock{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);pointer-events:auto;display:flex;
          flex-direction:column;align-items:center;gap:8px;font:500 13px system-ui,sans-serif}
        .bar{display:flex;align-items:center;gap:8px;padding:6px 8px 6px 14px;border-radius:999px;background:#141311;
          color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.3);cursor:grab;user-select:none;white-space:nowrap}
        .dot{width:10px;height:10px;border-radius:50%;background:#e5484d;flex:none}
        .sep{width:1px;height:20px;background:#3a3734;flex:none}
        .seg{display:flex;gap:2px;padding:2px;border-radius:999px;background:#2b2926}
        button{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border:0;border-radius:999px;
          background:transparent;color:#d6d3d1;font:inherit;cursor:pointer}
        button:hover{color:#fff}
        button:focus-visible{outline:3px solid #6cb8e6;outline-offset:2px}
        .seg [aria-checked=true]{background:#fff;color:#141311}
        .btn{height:32px;padding:0 12px;background:#2b2926;color:#fff}
        .btn:hover{background:#3a3734}
        .stop,.ok{background:#fff;color:#141311}.stop:hover,.ok:hover{background:#e7e5e4;color:#141311}
        svg{flex:none}
        .hint{width:420px;max-width:calc(100vw - 32px);padding:16px;border-radius:12px;background:#141311;color:#fff;
          box-shadow:0 8px 24px rgba(0,0,0,.3);white-space:normal}
        .hint b{display:block;font-weight:700;font-size:14px}
        .hint p{margin:4px 0 12px;color:#d6d3d1;line-height:1.35}
        .hint .acts{display:flex;justify-content:flex-end;gap:8px}
        .sr{position:fixed;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
        .kept{position:fixed;border:2px dashed ${PRIMARY};border-radius:4px;pointer-events:none}
        .kept span{position:absolute;left:-2px;top:-24px;padding:2px 8px;border-radius:4px;background:${PRIMARY};
          color:#fff;font:600 12px system-ui,sans-serif;white-space:nowrap}
        .kept.low span{top:auto;bottom:-24px}
        .veil{position:fixed;inset:0;pointer-events:auto;cursor:crosshair}
        .zone{position:fixed;outline:2px solid #fff;box-shadow:0 0 0 100vmax rgba(0,0,0,.5);cursor:move}
        .zone:focus-visible{outline:2px solid #fff;box-shadow:0 0 0 100vmax rgba(0,0,0,.5),0 0 0 5px #6cb8e6}
        .hd{position:absolute;width:12px;height:12px;background:#fff;border:2px solid #141311;border-radius:2px}
        .size{position:absolute;right:0;bottom:-30px;padding:2px 8px;border-radius:4px;background:#141311;color:#fff;
          font:600 12px system-ui,sans-serif;white-space:nowrap}
        @media (max-width:600px){.seg span,.count-l{display:none}}
      </style>
      <div class="sr" role="status"></div>
      <div class="kept el" hidden><span>${s.keptElement}</span></div>
      <div class="kept zn" hidden><span>${s.keptZone}</span></div>
      <div class="veil" hidden>
        <div class="zone" tabindex="0" role="application">
          ${['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((d) => `<i class="hd" data-d="${d}"></i>`).join('')}
          <span class="size"></span>
        </div>
      </div>
      <div class="dock">
        <div class="hint" role="dialog" aria-labelledby="fd-trace-t" hidden>
          <b id="fd-trace-t">${s.traceTitle}</b>
          <p>${s.traceText}</p>
          <div class="acts">
            <button type="button" class="btn cancel">${s.traceCancel}</button>
            <button type="button" class="btn ok"></button>
          </div>
        </div>
        <div class="bar" role="toolbar" aria-label="${s.recording}">
          <span class="dot" aria-hidden="true"></span>
          <span class="count"></span>
          <span class="sep" aria-hidden="true"></span>
          <div class="seg" role="radiogroup" aria-label="${s.frameGroup}"></div>
          <button type="button" class="btn redraw" hidden>${s.redraw}</button>
          <button type="button" class="btn stop"></button>
        </div>
      </div>`;
    document.documentElement.appendChild(host);
    const $ = <T extends Element>(q: string) => root.querySelector(q) as T;
    const icon = (node: IconNode) => {
      const svg = createElement(node);
      svg.setAttribute('width', '16');
      svg.setAttribute('height', '16');
      svg.setAttribute('aria-hidden', 'true');
      return svg;
    };
    const dock = $<HTMLDivElement>('.dock');
    const bar = $<HTMLDivElement>('.bar');
    const live = $<HTMLDivElement>('.sr');
    const count = $<HTMLSpanElement>('.count');
    const seg = $<HTMLDivElement>('.seg');
    const redraw = $<HTMLButtonElement>('.redraw');
    const keptEl = $<HTMLDivElement>('.kept.el');
    const keptZone = $<HTMLDivElement>('.kept.zn');
    const veil = $<HTMLDivElement>('.veil');
    const zoneEl = $<HTMLDivElement>('.zone');
    const hint = $<HTMLDivElement>('.hint');
    const stopBtn = $<HTMLButtonElement>('.stop');
    stopBtn.append(icon(Square), s.finish);
    $<HTMLButtonElement>('.ok').append(icon(Check), s.traceOk);
    redraw.title = s.redrawTitle;

    const MODES: Array<{ mode: FrameMode; label: string; tip: string; icon: IconNode }> = [
      { mode: 'page', label: s.framePage, tip: s.framePageTip, icon: Monitor },
      { mode: 'element', label: s.frameElement, tip: s.frameElementTip, icon: SquareMousePointer },
      { mode: 'zone', label: s.frameZone, tip: s.frameZoneTip, icon: Crop },
    ];
    const radios = MODES.map((m) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.dataset.mode = m.mode;
      b.title = m.tip;
      b.setAttribute('aria-label', m.label);
      const text = document.createElement('span');
      text.textContent = m.label;
      b.append(icon(m.icon), text);
      b.addEventListener('click', () => choose(m.mode));
      seg.append(b);
      return b;
    });
    seg.addEventListener('keydown', (e) => {
      const i = radios.indexOf(root.activeElement as HTMLButtonElement);
      const d =
        e.key === 'ArrowRight' || e.key === 'ArrowDown'
          ? 1
          : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
            ? -1
            : 0;
      if (!d || i < 0) return;
      e.preventDefault();
      const next = radios[(i + d + radios.length) % radios.length]!;
      next.focus();
      choose(next.dataset.mode as FrameMode);
    });

    // ===== Cadre des prochaines captures =====
    let frame: FrameState = { mode: 'page', zone: null };
    let tracing = false;
    const say = (text: string) => {
      live.textContent = '';
      requestAnimationFrame(() => (live.textContent = text));
    };
    const place = (el: HTMLElement, r: PxRect) => {
      el.style.left = `${r.left}px`;
      el.style.top = `${r.top}px`;
      el.style.width = `${r.width}px`;
      el.style.height = `${r.height}px`;
      el.classList.toggle('low', r.top < 28);
    };
    function paint() {
      for (const b of radios) {
        const on = b.dataset.mode === frame.mode;
        b.setAttribute('aria-checked', String(on));
        b.tabIndex = on ? 0 : -1;
      }
      redraw.hidden = frame.mode !== 'zone' || tracing;
      keptEl.hidden = true;
      keptZone.hidden = !(frame.mode === 'zone' && frame.zone && !tracing);
      if (!keptZone.hidden && frame.zone) place(keptZone, frame.zone);
    }
    const store = () => void browser.storage.local.set({ [FRAME_KEY]: frame }).catch(() => undefined);
    function choose(mode: FrameMode) {
      if (tracing) endTrace(false);
      frame = { ...frame, mode };
      store();
      paint();
      say(s.frameAnnounce.replace('{{mode}}', MODES.find((m) => m.mode === mode)!.label.toLowerCase()));
      // Zone sans tracé : on la trace tout de suite
      if (mode === 'zone' && !frame.zone) startTrace();
    }
    redraw.addEventListener('click', () => startTrace());
    void browser.storage.local
      .get(FRAME_KEY)
      .then((r) => {
        const v = r[FRAME_KEY] as Partial<FrameState> | undefined;
        frame = { mode: asFrameMode(v?.mode), zone: v?.zone ?? null };
        paint();
        if (frame.mode === 'zone' && !frame.zone) startTrace();
      })
      .catch(() => paint());
    // Un autre onglet suivi a changé le cadre : cette barre suit
    const onStorage = (changes: Record<string, { newValue?: unknown }>) => {
      const v = changes[FRAME_KEY]?.newValue as Partial<FrameState> | undefined;
      if (!v || tracing) return;
      frame = { mode: asFrameMode(v.mode), zone: v.zone ?? null };
      paint();
    };
    browser.storage.onChanged.addListener(onStorage);

    // ===== Tracé de la zone (souris et clavier) =====
    let draft: PxRect = { left: 0, top: 0, width: 0, height: 0 };
    const MIN = 40;
    const fit = (r: PxRect): PxRect => {
      const width = Math.min(innerWidth, Math.max(MIN, r.width));
      const height = Math.min(innerHeight, Math.max(MIN, r.height));
      return {
        left: Math.min(Math.max(0, r.left), innerWidth - width),
        top: Math.min(Math.max(0, r.top), innerHeight - height),
        width,
        height,
      };
    };
    function paintDraft() {
      place(zoneEl, draft);
      const [wpx, hpx] = [Math.round(draft.width), Math.round(draft.height)];
      $<HTMLSpanElement>('.size').textContent = `${wpx} × ${hpx}`;
      zoneEl.setAttribute(
        'aria-label',
        s.zoneLabel.replace('{{w}}', String(wpx)).replace('{{h}}', String(hpx)),
      );
      const pos: Record<string, [number, number]> = {
        nw: [0, 0],
        n: [0.5, 0],
        ne: [1, 0],
        e: [1, 0.5],
        se: [1, 1],
        s: [0.5, 1],
        sw: [0, 1],
        w: [0, 0.5],
      };
      for (const hd of zoneEl.querySelectorAll<HTMLElement>('.hd')) {
        const [x, y] = pos[hd.dataset.d!]!;
        hd.style.left = `calc(${x * 100}% - 6px)`;
        hd.style.top = `calc(${y * 100}% - 6px)`;
        hd.style.cursor = `${hd.dataset.d}-resize`;
      }
    }
    function startTrace() {
      tracing = true;
      draft = fit(
        frame.zone ?? {
          left: innerWidth * 0.2,
          top: innerHeight * 0.15,
          width: innerWidth * 0.6,
          height: innerHeight * 0.5,
        },
      );
      veil.hidden = false;
      hint.hidden = false;
      paintDraft();
      paint();
      zoneEl.focus();
    }
    function endTrace(keep: boolean) {
      tracing = false;
      veil.hidden = true;
      hint.hidden = true;
      if (keep) {
        frame = { mode: 'zone', zone: draft };
        say(
          s.zoneSaid
            .replace('{{w}}', String(Math.round(draft.width)))
            .replace('{{h}}', String(Math.round(draft.height))),
        );
      } else if (!frame.zone) frame = { ...frame, mode: 'page' };
      store();
      paint();
      radios.find((b) => b.dataset.mode === frame.mode)?.focus();
    }
    $<HTMLButtonElement>('.ok').addEventListener('click', () => endTrace(true));
    $<HTMLButtonElement>('.cancel').addEventListener('click', () => endTrace(false));
    zoneEl.addEventListener('keydown', (e) => {
      const step = 8;
      const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
      const dy = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0;
      if (dx || dy) {
        draft = fit(
          e.shiftKey
            ? { ...draft, width: draft.width + dx, height: draft.height + dy }
            : { ...draft, left: draft.left + dx, top: draft.top + dy },
        );
        paintDraft();
      } else if (e.key === 'Enter') endTrace(true);
      else if (e.key === 'Escape') endTrace(false);
      else return;
      e.preventDefault();
      e.stopPropagation();
    });
    let gesture: { kind: string; x: number; y: number; from: PxRect } | null = null;
    veil.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const t = e.target as HTMLElement;
      const kind = t.classList.contains('hd') ? t.dataset.d! : t === zoneEl ? 'move' : 'draw';
      gesture = { kind, x: e.clientX, y: e.clientY, from: draft };
      veil.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    veil.addEventListener('pointermove', (e) => {
      if (!gesture) return;
      const dx = e.clientX - gesture.x;
      const dy = e.clientY - gesture.y;
      const f = gesture.from;
      if (gesture.kind === 'move') draft = fit({ ...f, left: f.left + dx, top: f.top + dy });
      else if (gesture.kind === 'draw') {
        const left = Math.max(0, Math.min(gesture.x, e.clientX));
        const top = Math.max(0, Math.min(gesture.y, e.clientY));
        draft = {
          left,
          top,
          width: Math.min(innerWidth - left, Math.max(MIN, Math.abs(dx))),
          height: Math.min(innerHeight - top, Math.max(MIN, Math.abs(dy))),
        };
      } else {
        let { left, top, width, height } = f;
        if (gesture.kind.includes('e')) width = f.width + dx;
        if (gesture.kind.includes('s')) height = f.height + dy;
        if (gesture.kind.includes('w')) {
          left = Math.min(f.left + dx, f.left + f.width - MIN);
          width = f.left + f.width - left;
        }
        if (gesture.kind.includes('n')) {
          top = Math.min(f.top + dy, f.top + f.height - MIN);
          height = f.top + f.height - top;
        }
        left = Math.max(0, left);
        top = Math.max(0, top);
        draft = {
          left,
          top,
          width: Math.min(innerWidth - left, Math.max(MIN, width)),
          height: Math.min(innerHeight - top, Math.max(MIN, height)),
        };
      }
      paintDraft();
    });
    veil.addEventListener('pointerup', () => {
      gesture = null;
      zoneEl.focus();
    });

    // ===== « Capture · n », onglet suivi, étape à capturer, cible d'un ajout =====
    const refresh = () =>
      browser.runtime
        .sendMessage({ type: 'fd:tab-info' })
        .then((r: unknown) => {
          const info = r as {
            n: number;
            title: string;
            steps?: number;
            guide?: { title: string; n: number; total: number } | null;
            target?: string | null;
          } | null;
          const parts = [`<span class="count-l">${s.capBar} · </span>${info?.steps ?? 0}`];
          const text: string[] = [];
          const said: string[] = [];
          if (info?.target) text.push(info.target);
          if (info && info.n >= 2) {
            const chip = tabChip(info.n, info.title || document.title);
            text.push(chip.label);
            said.push(chip.announce);
          }
          if (info?.guide) {
            const g = guideChip(info.guide);
            text.push(g);
            said.push(g);
          }
          count.innerHTML = parts.join('');
          for (const t of text) count.append(` · ${t}`);
          if (said.length) live.textContent = said.join('. ');
        })
        .catch(() => undefined);
    void refresh();

    stopBtn.addEventListener(
      'click',
      () => void browser.runtime.sendMessage({ type: 'fd:stop' }).catch(() => undefined),
    );

    // Déplacement de la barre à la souris
    let drag: { x: number; y: number; left: number; top: number } | null = null;
    bar.addEventListener('pointerdown', (e) => {
      if ((e.target as Element).closest('button')) return;
      const r = dock.getBoundingClientRect();
      drag = { x: e.clientX, y: e.clientY, left: r.left, top: r.top };
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener('pointermove', (e) => {
      if (!drag) return;
      dock.style.transform = 'none';
      dock.style.bottom = 'auto';
      dock.style.left = `${Math.max(0, drag.left + e.clientX - drag.x)}px`;
      dock.style.top = `${Math.max(0, drag.top + e.clientY - drag.y)}px`;
    });
    bar.addEventListener('pointerup', () => (drag = null));

    const rect = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    };
    const pick = (target: Element | null) =>
      target?.closest('a,button,input,select,textarea,label,[role],[onclick],[tabindex]') ?? target;

    // Mode Élément : au survol, le cadre qui sera gardé (pointillé, étiquette dans le coin)
    function onPointerMove(ev: PointerEvent) {
      if (frame.mode !== 'element' || tracing) return;
      const target = ev.target instanceof Element ? ev.target : null;
      const el = target?.closest('[data-fd-ui]') ? null : pick(target);
      const vp = { width: innerWidth, height: innerHeight };
      const crop = el ? elementCrop(rect(el), vp) : null;
      keptEl.hidden = !crop;
      if (crop)
        place(keptEl, {
          left: crop.x * vp.width,
          top: crop.y * vp.height,
          width: crop.w * vp.width,
          height: crop.h * vp.height,
        });
    }
    document.addEventListener('pointermove', onPointerMove, true);

    let last = 0;
    function onPointerDown(ev: PointerEvent) {
      if (!ev.isTrusted || ev.button !== 0 || tracing) return;
      const now = Date.now();
      if (now - last < 400) return; // anti double-clic
      const target = ev.target instanceof Element ? ev.target : null;
      if (target?.closest('[data-fd-ui]')) return;
      last = now;
      const el = pick(target);
      const payload: ClickPayload = {
        type: 'fd:click',
        click: { x: ev.clientX, y: ev.clientY },
        element: el ? rect(el) : null,
        label: el
          ? elementLabel({
              text: el instanceof HTMLInputElement ? null : (el.textContent ?? ''),
              ariaLabel: el.getAttribute('aria-label'),
              placeholder: el.getAttribute('placeholder'),
              title: el.getAttribute('title'),
              alt: el.getAttribute('alt'),
            })
          : '',
        selector: el ? cssSelector(el) : '',
        tag: el?.tagName.toLowerCase() ?? '',
        viewport: { width: innerWidth, height: innerHeight },
        dpr: devicePixelRatio,
        url: location.href,
        title: document.title,
        detections: scanPage(),
        // L25-01 : page entière (animation de défilement dans l'éditeur)
        page: {
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
          scrollX,
          scrollY,
        },
        pageDetections: scanFullPage(),
        // EXT-02 §5 : cadre demandé pour cette capture (la zone est relative à la fenêtre)
        frame: { mode: frame.mode, zone: frame.mode === 'zone' ? frame.zone : null },
      };
      // La barre et les repères ne doivent laisser aucune trace dans l'image
      host.style.visibility = 'hidden';
      // Deux images d'affichage : la barre masquée est bien peinte avant la capture
      const painted = new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      void painted
        .then(() => browser.runtime.sendMessage(payload))
        .catch(() => undefined)
        .finally(() => {
          host.style.visibility = 'visible';
          // La capture est gardée de façon asynchrone : relecture un peu après
          setTimeout(() => void refresh(), 600);
        });
    }

    document.addEventListener('pointerdown', onPointerDown, true);
    browser.runtime.onMessage.addListener((msg: unknown) => {
      if ((msg as { type?: string })?.type === 'fd:recorder-stop') {
        document.removeEventListener('pointerdown', onPointerDown, true);
        document.removeEventListener('pointermove', onPointerMove, true);
        browser.storage.onChanged.removeListener(onStorage);
        host.remove();
        w.__fdRecorder = false;
      }
    });
  },
});
