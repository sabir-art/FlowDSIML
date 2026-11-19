import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';
import { elementLabel } from '@/lib/geometry';
import { scanPage } from '@/lib/scan';
import type { RecordingStatus, VideoBarRequest } from '@/lib/messages';
import { MAX_MS, WARN_MS, elapsed, timer } from '@/lib/video';
import { lang, strings } from '@/lib/i18n';

/**
 * F7 (L21-02) : barre d'enregistrement vidéo dans l'onglet (shadow DOM, toujours au-dessus,
 * déplaçable). Chronomètre role=timer, Pause / Reprendre, Marquer une étape, Terminer ; raccourcis
 * Alt + Maj + P, M, S rappelés au survol ; « Plus qu'une minute » à 9 min, arrêt à 10 min.
 * Vérification des données (F1) pendant l'enregistrement : les zones repérées sont floutées DANS LA
 * PAGE avant d'être filmées (flou incrusté). Les clics sont horodatés (pauses-étapes proposées).
 */
export default defineContentScript({
  matches: ['<all_urls>'],
  registration: 'runtime',
  main() {
    const w = window as unknown as { __fdVideoBar?: boolean };
    if (w.__fdVideoBar) return;
    w.__fdVideoBar = true;
    const s = strings;
    const send = (m: VideoBarRequest) => browser.runtime.sendMessage(m).catch(() => null);

    // ===== Flou incrusté des données repérées =====
    const veil = document.createElement('div');
    veil.setAttribute('data-fd-ui', '');
    veil.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483646';
    document.documentElement.appendChild(veil);
    let maxZones = 0;
    function blurNow() {
      const zones = scanPage();
      veil.replaceChildren(
        ...zones.map((d) => {
          const b = document.createElement('div');
          b.setAttribute('data-fd-blur', '');
          b.style.cssText =
            `position:fixed;left:${d.rect.left - 2}px;top:${d.rect.top - 2}px;` +
            `width:${d.rect.width + 4}px;height:${d.rect.height + 4}px;border-radius:4px;` +
            'backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);background:rgba(120,120,120,.35)';
          return b;
        }),
      );
      if (zones.length > maxZones) {
        maxZones = zones.length;
        void send({ type: 'fd:video-blurs', count: maxZones });
      }
    }
    blurNow();
    const scanTimer = setInterval(blurNow, 700);
    const mo = new MutationObserver(() => requestAnimationFrame(blurNow));
    mo.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
    addEventListener('scroll', blurNow, { passive: true, capture: true });

    // ===== Barre =====
    const host = document.createElement('div');
    host.setAttribute('data-fd-ui', '');
    host.style.cssText = 'position:fixed;z-index:2147483647;left:50%;bottom:20px;transform:translateX(-50%)';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        .bar{display:flex;align-items:center;gap:6px;padding:6px 8px 6px 14px;border-radius:999px;background:#141311;
          color:#fff;font:500 13px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.3);cursor:grab;user-select:none}
        .dot{width:10px;height:10px;border-radius:50%;background:#e5484d;animation:p 1.4s ease-in-out infinite}
        .bar.paused .dot{background:#a8a29e;animation:none}
        @keyframes p{50%{opacity:.35}} @media (prefers-reduced-motion:reduce){.dot{animation:none}}
        .t{font-variant-numeric:tabular-nums;min-width:96px}
        button{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border:0;border-radius:999px;
          background:#2b2926;color:#fff;font:inherit;cursor:pointer}
        button:hover{background:#3a3734} button:focus-visible{outline:3px solid #1f7fb6;outline-offset:2px}
        .stop{background:#fff;color:#141311} .stop:hover{background:#e7e5e4}
        .toast,.alert{position:absolute;bottom:52px;left:50%;transform:translateX(-50%);white-space:nowrap;padding:8px 14px;
          border-radius:10px;background:#141311;color:#fff;font:500 13px system-ui,sans-serif}
        .alert{background:#7a1f12}
        [hidden]{display:none!important}
      </style>
      <div class="toast" role="status" hidden></div>
      <div class="alert" role="alert" hidden></div>
      <div class="bar" role="toolbar" aria-label="${s.recBar}">
        <span class="dot" aria-hidden="true"></span>
        <span class="t" role="timer" aria-live="off"></span>
        <button type="button" class="pause" title="${s.shortcutPause}"></button>
        <button type="button" class="mark" title="${s.shortcutMark}">${s.markStep}</button>
        <button type="button" class="stop" title="${s.shortcutStop}">${s.finish}</button>
      </div>`;
    document.documentElement.appendChild(host);
    const $ = <T extends Element>(q: string) => root.querySelector(q) as T;
    const bar = $<HTMLDivElement>('.bar');
    const timeEl = $<HTMLSpanElement>('.t');
    const pauseBtn = $<HTMLButtonElement>('.pause');
    const toast = $<HTMLDivElement>('.toast');
    const alertEl = $<HTMLDivElement>('.alert');
    let warned = false;
    let stopped = false;
    let micShown = false;

    pauseBtn.onclick = () => void send({ type: 'fd:video-pause' }).then(tick);
    $<HTMLButtonElement>('.mark').onclick = () => {
      void send({ type: 'fd:video-mark', label: '', manual: true });
      flash(s.marked);
    };
    $<HTMLButtonElement>('.stop').onclick = () => finish();
    function finish() {
      if (stopped) return;
      stopped = true;
      void send({ type: 'fd:video-stop' });
    }
    function flash(text: string, ms = 2500) {
      toast.textContent = text;
      toast.hidden = false;
      setTimeout(() => (toast.hidden = true), ms);
    }

    async function tick() {
      const st = (await browser.runtime
        .sendMessage({ type: 'fd:status' })
        .catch(() => null)) as RecordingStatus | null;
      if (!st?.recording || st.mode !== 'video') return;
      const ms = elapsed(
        { startedAt: st.startedAt ?? Date.now(), pausedAt: st.pausedAt ?? null, pausedMs: st.pausedMs ?? 0 },
        Date.now(),
      );
      const paused = !!st.pausedAt;
      timeEl.textContent = `${timer(ms)} / ${timer(MAX_MS)}`;
      timeEl.setAttribute('aria-label', s.timerLabel.replace('{{t}}', timer(ms)));
      bar.classList.toggle('paused', paused);
      pauseBtn.textContent = paused ? s.resume : s.pause;
      if (st.micDenied && !micShown) {
        micShown = true;
        alertEl.textContent = s.micDenied;
        alertEl.hidden = false;
        setTimeout(() => (alertEl.hidden = true), 8000);
      }
      if (!warned && ms >= WARN_MS) {
        warned = true;
        flash(s.limitSoon, 6000);
      }
      if (ms >= MAX_MS) finish();
    }
    void tick();
    const tickTimer = setInterval(() => void tick(), 500);

    // Déplacement de la barre à la souris
    let drag: { x: number; y: number; left: number; top: number } | null = null;
    bar.addEventListener('pointerdown', (e) => {
      if ((e.target as Element).closest('button')) return;
      const r = host.getBoundingClientRect();
      drag = { x: e.clientX, y: e.clientY, left: r.left, top: r.top };
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener('pointermove', (e) => {
      if (!drag) return;
      host.style.transform = 'none';
      host.style.bottom = 'auto';
      host.style.left = `${Math.max(0, drag.left + e.clientX - drag.x)}px`;
      host.style.top = `${Math.max(0, drag.top + e.clientY - drag.y)}px`;
    });
    bar.addEventListener('pointerup', () => (drag = null));

    // Clics horodatés : pauses-étapes proposées au montage
    let last = 0;
    function onPointerDown(ev: PointerEvent) {
      if (!ev.isTrusted || ev.button !== 0) return;
      const target = ev.target instanceof Element ? ev.target : null;
      if (target?.closest('[data-fd-ui]')) return;
      if (Date.now() - last < 400) return;
      last = Date.now();
      const el =
        target?.closest('a,button,input,select,textarea,label,[role],[onclick],[tabindex]') ?? target;
      const label = el
        ? elementLabel({
            text: el instanceof HTMLInputElement ? null : (el.textContent ?? ''),
            ariaLabel: el.getAttribute('aria-label'),
            placeholder: el.getAttribute('placeholder'),
            title: el.getAttribute('title'),
            alt: el.getAttribute('alt'),
          })
        : '';
      void send({ type: 'fd:video-mark', label, manual: false });
    }
    document.addEventListener('pointerdown', onPointerDown, true);

    browser.runtime.onMessage.addListener((msg: unknown) => {
      if ((msg as { type?: string })?.type === 'fd:recorder-stop') {
        clearInterval(tickTimer);
        clearInterval(scanTimer);
        mo.disconnect();
        document.removeEventListener('pointerdown', onPointerDown, true);
        host.remove();
        veil.remove();
        w.__fdVideoBar = false;
      }
    });
    void lang;
  },
});
