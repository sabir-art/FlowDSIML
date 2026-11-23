import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';
import { elementLabel } from '@/lib/geometry';
import { scanNodes } from '@/lib/scan';
import type { RecordingStatus, VideoBarRequest } from '@/lib/messages';
import { MAX_MS, WARN_MS, elapsed, timer } from '@/lib/video';
import { lang, strings } from '@/lib/i18n';

/**
 * F7 (L21-02) : barre d'enregistrement vidéo dans l'onglet (shadow DOM, toujours au-dessus,
 * déplaçable). Chronomètre role=timer, Pause / Reprendre, Marquer une étape, Terminer ; raccourcis
 * Alt + Maj + P, M, S rappelés au survol ; « Plus qu'une minute » à 9 min, arrêt à 10 min.
 * Vérification des données (F1) pendant l'enregistrement : les données repérées sont masquées DANS LA
 * PAGE avant d'être filmées (flou porté par l'élément, ou surlignage de la portion de texte), sur tout
 * le document. Les clics sont horodatés (pauses-étapes proposées).
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

    // ===== Masquage des données repérées, dans la page elle-même =====
    // Les données ne sont plus recouvertes par des rectangles posés au-dessus de la fenêtre : ceux-ci
    // suivaient le défilement avec une image de retard (la donnée apparaissait un instant) et
    // recouvraient tout panneau ouvert par-dessus. Le masque est porté par le contenu : l'élément est
    // flouté par un attribut, ou la portion de texte est couverte par un surlignage CSS. Il défile donc
    // avec son contenu, sans retard, et passe sous ce qui s'ouvre au-dessus. Tout le document est
    // analysé, pas seulement la fenêtre : ce qui arrive à l'écran en défilant est déjà masqué.
    const MASK = 'data-fd-masked';
    const maskStyle = document.createElement('style');
    maskStyle.setAttribute('data-fd-ui', '');
    maskStyle.textContent =
      `[${MASK}]{filter:blur(8px)!important}` +
      '::highlight(fd-mask){color:transparent;background-color:#8f8f8f;text-shadow:none}';
    document.documentElement.appendChild(maskStyle);
    const highlight =
      typeof Highlight !== 'undefined' && typeof CSS !== 'undefined' && CSS.highlights
        ? new Highlight()
        : null;
    if (highlight) CSS.highlights.set('fd-mask', highlight);
    let masked = new Set<Element>();
    let maxZones = 0;
    // L21-01 : zones masquées à l'écran (relatives à la fenêtre), jointes à chaque repère
    let shown: Array<{ x: number; y: number; w: number; h: number }> = [];
    function maskNow() {
      const next = new Set<Element>();
      const ranges: Range[] = [];
      for (const d of scanNodes(document.body)) {
        if (d.el.closest('[data-fd-ui]')) continue;
        if (highlight && d.node && d.start !== undefined && d.end !== undefined) {
          // Une donnée au milieu d'un texte plus long : seule sa portion est couverte
          const total = (d.el.textContent ?? '').trim().length || 1;
          if ((d.end - d.start) / total < 0.6) {
            const r = document.createRange();
            r.setStart(d.node, d.start);
            r.setEnd(d.node, d.end);
            ranges.push(r);
            continue;
          }
        }
        next.add(d.el);
      }
      for (const el of masked) if (!next.has(el)) el.removeAttribute(MASK);
      for (const el of next) if (!el.hasAttribute(MASK)) el.setAttribute(MASK, '');
      masked = next;
      if (highlight) {
        highlight.clear();
        for (const r of ranges) highlight.add(r);
      }
      const W = innerWidth || 1;
      const H = innerHeight || 1;
      const rects = [
        ...[...next].map((el) => el.getBoundingClientRect()),
        ...ranges.flatMap((r) => [...r.getClientRects()]),
      ];
      shown = rects
        .filter((r) => r.width > 1 && r.height > 1 && r.bottom > 0 && r.right > 0 && r.top < H && r.left < W)
        .map((r) => ({
          x: Math.max(0, (r.left - 2) / W),
          y: Math.max(0, (r.top - 2) / H),
          w: Math.min(1, (r.width + 4) / W),
          h: Math.min(1, (r.height + 4) / H),
        }))
        .slice(0, 40);
      const count = next.size + ranges.length;
      if (count > maxZones) {
        maxZones = count;
        void send({ type: 'fd:video-blurs', count: maxZones });
      }
    }
    maskNow();
    const scanTimer = setInterval(maskNow, 1500);
    // Le contenu change (liste chargée, onglet, saisie) : nouvelle analyse à l'image suivante
    let pending = 0;
    const mo = new MutationObserver((list) => {
      if (pending || list.every((m) => m.target instanceof Element && m.target.closest('[data-fd-ui]')))
        return;
      pending = requestAnimationFrame(() => {
        pending = 0;
        maskNow();
      });
    });
    mo.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
    // Saisie dans un champ : la valeur vient d'apparaître
    const onInput = () => maskNow();
    document.addEventListener('input', onInput, true);

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
    timeEl.textContent = `${timer(0)} / ${timer(MAX_MS)}`;
    timeEl.setAttribute('aria-label', s.timerLabel.replace('{{t}}', timer(0)));
    pauseBtn.textContent = s.pause;
    const toast = $<HTMLDivElement>('.toast');
    const alertEl = $<HTMLDivElement>('.alert');
    let warned = false;
    let stopped = false;
    let micShown = false;

    pauseBtn.onclick = () => void send({ type: 'fd:video-pause' }).then(tick);
    $<HTMLButtonElement>('.mark').onclick = () => {
      void send({ type: 'fd:video-mark', label: '', manual: true, zones: shown });
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
      void send({ type: 'fd:video-mark', label, manual: false, zones: shown });
    }
    document.addEventListener('pointerdown', onPointerDown, true);

    browser.runtime.onMessage.addListener((msg: unknown) => {
      if ((msg as { type?: string })?.type === 'fd:recorder-stop') {
        clearInterval(tickTimer);
        clearInterval(scanTimer);
        mo.disconnect();
        document.removeEventListener('pointerdown', onPointerDown, true);
        document.removeEventListener('input', onInput, true);
        cancelAnimationFrame(pending);
        for (const el of masked) el.removeAttribute(MASK);
        masked.clear();
        if (highlight) CSS.highlights.delete('fd-mask');
        maskStyle.remove();
        host.remove();
        w.__fdVideoBar = false;
      }
    });
    void lang;
  },
});
