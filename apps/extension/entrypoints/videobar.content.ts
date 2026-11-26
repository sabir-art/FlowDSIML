import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';
import { elementLabel } from '@/lib/geometry';
import { labelText } from '@/lib/labelText';
import { maskExcerpt } from '@flowdsiml/core';
import { scanNodes } from '@/lib/scan';
import type { RecordingStatus, VideoBarRequest } from '@/lib/messages';
import { MAX_MS, WARN_MS, elapsed, timer } from '@/lib/video';
import { barCount, lang, strings } from '@/lib/i18n';
import { BAR_CSS, barIcon, barMarkup, wireBar } from '@/lib/captureBar';
import { Mic, MicOff } from 'lucide';

/**
 * F7 (L21-02) : barre d'enregistrement vidéo dans l'onglet (shadow DOM, toujours au-dessus,
 * déplaçable). Chronomètre role=timer, Pause / Reprendre, Marquer une étape, Terminer ; raccourcis
 * Alt + Maj + P, M, S rappelés au survol ; « Plus qu'une minute » à 9 min, arrêt à 10 min.
 * Données personnelles (EXT-02 §4) : tout le document est analysé et chaque donnée repérée est suivie dans
 * le temps (positions à l'écran), pour la revue « Vérifier la vidéo ».
 *  - « Masquer en direct » activé : les données sont en plus masquées DANS LA PAGE avant d'être filmées
 *    (flou porté par l'élément, ou surlignage de la portion de texte). Ce masque est définitif.
 *  - Désactivé (par défaut) : la page n'est pas touchée, l'image est brute ; les masques sont choisis à la
 *    revue et incrustés à l'envoi.
 * Les clics sont horodatés (pauses-étapes proposées).
 */
export default defineContentScript({
  matches: ['<all_urls>'],
  registration: 'runtime',
  main() {
    const w = window as unknown as { __fdVideoBar?: boolean; __fdLiveMask?: boolean };
    if (w.__fdVideoBar) return;
    w.__fdVideoBar = true;
    const s = strings;
    const send = (m: VideoBarRequest) => browser.runtime.sendMessage(m).catch(() => null);
    /** « Masquer en direct » : posé par le service avant ce script (désactivé par défaut). */
    const LIVE = w.__fdLiveMask === true;

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

    // ===== Suivi des données repérées (une ligne par donnée à la revue) =====
    type Rect = { x: number; y: number; w: number; h: number };
    type Meta = { id: string; type: string; excerpt: string; by: string; label?: string };
    /** Ce qui porte chaque donnée dans la page, d'après la dernière analyse. */
    let tracked = new Map<string, { els: Element[]; ranges: Range[] }>();
    const known = new Set<string>();
    const lastSent = new Map<string, string>();
    let metas: Meta[] = [];
    let samples: Array<{ id: string; at: number; rects: Rect[] }> = [];
    const zoneIds = new WeakMap<Element, string>();
    let zoneSeq = 0;
    /** Empreinte de la valeur : elle sert d'identifiant, la valeur ne sort pas de la page. */
    const hash = (v: string) => {
      let h = 5381;
      for (let i = 0; i < v.length; i++) h = ((h << 5) + h + v.charCodeAt(i)) >>> 0;
      return h.toString(36);
    };
    const visibleRects = (list: DOMRect[]): Rect[] => {
      const W = innerWidth || 1;
      const H = innerHeight || 1;
      return list
        .filter((r) => r.width > 1 && r.height > 1 && r.bottom > 0 && r.right > 0 && r.top < H && r.left < W)
        .map((r) => ({
          x: Math.max(0, (r.left - 2) / W),
          y: Math.max(0, (r.top - 2) / H),
          w: Math.min(1, (r.width + 4) / W),
          h: Math.min(1, (r.height + 4) / H),
        }))
        .slice(0, 8);
    };
    /** Relève la position de chaque donnée ; seuls les changements sont gardés. */
    function sample() {
      const at = Date.now();
      const seen = new Set<string>();
      for (const [id, t] of tracked) {
        seen.add(id);
        const rects = visibleRects([
          ...t.els.map((el) => el.getBoundingClientRect()),
          ...t.ranges.flatMap((r) => [...r.getClientRects()]),
        ]);
        const key = rects
          .map((r) => `${r.x.toFixed(3)},${r.y.toFixed(3)},${r.w.toFixed(3)},${r.h.toFixed(3)}`)
          .join(';');
        if (lastSent.get(id) === key) continue;
        lastSent.set(id, key);
        samples.push({ id, at, rects });
      }
      // Donnée disparue de la page : elle n'est plus à l'écran
      for (const [id, key] of lastSent)
        if (!seen.has(id) && key !== '') {
          lastSent.set(id, '');
          samples.push({ id, at, rects: [] });
        }
    }
    function flush() {
      if (!metas.length && !samples.length) return;
      void send({ type: 'fd:video-track', live: LIVE, metas, samples });
      metas = [];
      samples = [];
    }
    let sampling = 0;
    const loop = () => {
      sample();
      sampling = requestAnimationFrame(loop);
    };
    sampling = requestAnimationFrame(loop);
    const flushTimer = setInterval(flush, 400);

    function maskNow() {
      const next = new Set<Element>();
      const ranges: Range[] = [];
      const found = new Map<string, { els: Element[]; ranges: Range[] }>();
      for (const d of scanNodes(document.body)) {
        if (d.el.closest('[data-fd-ui]')) continue;
        let id: string;
        if (d.type === 'zone' || !d.value) {
          id = zoneIds.get(d.el) ?? `z${++zoneSeq}`;
          zoneIds.set(d.el, id);
        } else id = `${d.type}-${hash(d.value)}`;
        if (!known.has(id)) {
          if (known.size >= 200) continue;
          known.add(id);
          metas.push({
            id,
            type: d.type,
            excerpt: d.type === 'zone' ? '' : maskExcerpt(d.type, d.value),
            by: d.by,
            label: d.label,
          });
        }
        const slot = found.get(id) ?? { els: [], ranges: [] };
        found.set(id, slot);
        let range: Range | null = null;
        if (d.node && d.start !== undefined && d.end !== undefined) {
          range = document.createRange();
          range.setStart(d.node, d.start);
          range.setEnd(d.node, d.end);
        }
        // En direct, une donnée au milieu d'un texte plus long : seule sa portion est couverte. Sans le
        // direct, rien n'est posé dans la page : la portion de texte suffit toujours au suivi.
        const total = (d.el.textContent ?? '').trim().length || 1;
        const partial = range && (!LIVE || (highlight && (d.end! - d.start!) / total < 0.6)) ? range : null;
        if (partial) {
          ranges.push(partial);
          slot.ranges.push(partial);
        } else {
          next.add(d.el);
          slot.els.push(d.el);
        }
      }
      tracked = found;
      if (LIVE) {
        for (const el of masked) if (!next.has(el)) el.removeAttribute(MASK);
        for (const el of next) if (!el.hasAttribute(MASK)) el.setAttribute(MASK, '');
        masked = next;
        if (highlight) {
          highlight.clear();
          for (const r of ranges) highlight.add(r);
        }
        // Images des repères : ces zones sont déjà masquées dans l'image
        shown = visibleRects([
          ...[...next].map((el) => el.getBoundingClientRect()),
          ...ranges.flatMap((r) => [...r.getClientRects()]),
        ]).slice(0, 40);
      }
      sample();
      const count = found.size;
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
        ${BAR_CSS}
        .bar:not(.is-paused) .dot{animation:p 1.4s ease-in-out infinite}
        @keyframes p{50%{opacity:.35}} @media (prefers-reduced-motion:reduce){.bar .dot{animation:none}}
        .bar .mic[aria-pressed=false]{color:#f5a524}
        .toast,.alert{position:absolute;bottom:56px;left:50%;transform:translateX(-50%);white-space:nowrap;padding:8px 14px;
          border-radius:10px;background:#16181d;color:#fff;font:500 13px system-ui,sans-serif}
        .alert{background:#7a1f12}
        [hidden]{display:none!important}
      </style>
      <div class="toast" role="status" hidden></div>
      <div class="alert" role="alert" hidden></div>
      ${barMarkup({
        label: s.recBar,
        name: s.barVideo,
        middle: `<span class="note clk"></span>
          <button type="button" class="mic" aria-pressed="true" hidden></button>`,
      })}`;
    document.documentElement.appendChild(host);
    const $ = <T extends Element>(q: string) => root.querySelector(q) as T;
    // L60 §2 : barre commune ; la pastille est le chronomètre (« 00:42 »), les clics deviennent des pauses
    const ui = wireBar(root, {
      name: s.barVideo,
      mover: host,
      onPause: () =>
        send({ type: 'fd:video-pause' }).then(async () => {
          await tick();
          return ui.paused;
        }),
      onStop: () => finish(),
    });
    const timeEl = $<HTMLSpanElement>('.pill');
    timeEl.setAttribute('role', 'timer');
    timeEl.setAttribute('aria-live', 'off');
    ui.setCount(timer(0));
    timeEl.setAttribute('aria-label', s.timerLabel.replace('{{t}}', timer(0)));
    const clk = $<HTMLSpanElement>('.clk');
    clk.textContent = barCount('clicks', 0);
    const micBtn = $<HTMLButtonElement>('.mic');
    const paintMic = (on: boolean) => {
      micBtn.setAttribute('aria-pressed', String(on));
      micBtn.replaceChildren(barIcon(on ? Mic : MicOff), s.micLabel);
    };
    paintMic(true);
    micBtn.onclick = () => void send({ type: 'fd:video-mic' }).then(tick);
    const toast = $<HTMLDivElement>('.toast');
    const alertEl = $<HTMLDivElement>('.alert');
    let warned = false;
    let stopped = false;
    let micShown = false;

    function finish() {
      if (stopped) return;
      stopped = true;
      sample();
      flush();
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
      // Le compte à rebours n'est pas une pause de la personne
      const paused = !!st.pausedAt && !st.countdown;
      ui.setCount(timer(ms));
      timeEl.setAttribute('aria-label', s.timerLabel.replace('{{t}}', timer(ms)));
      if (ui.paused !== paused) ui.setPaused(paused);
      clk.textContent = barCount('clicks', st.steps);
      micBtn.hidden = !st.micOn;
      if (st.micOn) paintMic(!st.micMuted);
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

    // ===== L60 §2 : compte à rebours de 3 s, fond assombri à 55 %, Échap pour annuler =====
    void browser.runtime
      .sendMessage({ type: 'fd:status' })
      .then((st: unknown) => {
        if ((st as RecordingStatus | null)?.countdown) countdown();
      })
      .catch(() => undefined);
    function countdown() {
      const cdHost = document.createElement('div');
      cdHost.setAttribute('data-fd-ui', '');
      cdHost.setAttribute('data-fd-countdown', '');
      cdHost.style.cssText = 'position:fixed;inset:0;z-index:2147483647';
      const cr = cdHost.attachShadow({ mode: 'open' });
      cr.innerHTML = `
        <style>
          .cd{position:fixed;inset:0;display:grid;place-content:center;justify-items:center;gap:16px;
            background:rgba(0,0,0,.55);color:#fff;font:500 16px system-ui,sans-serif;text-align:center}
          .n{font:700 120px/1 system-ui,sans-serif;font-variant-numeric:tabular-nums}
          @media (prefers-reduced-motion:no-preference){.n.go{animation:z .9s ease-out}}
          @keyframes z{from{transform:scale(1.35);opacity:0}to{transform:scale(1);opacity:1}}
        </style>
        <div class="cd" role="dialog" aria-modal="true" aria-label="${s.countdownText}">
          <b class="n" aria-hidden="true"></b>
          <p>${s.countdownText}</p>
          <span role="status" class="sr" style="position:fixed;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)"></span>
        </div>`;
      document.documentElement.appendChild(cdHost);
      const num = cr.querySelector<HTMLElement>('.n')!;
      const said = cr.querySelector<HTMLElement>('[role=status]')!;
      let n = 3;
      let timerId = 0;
      const show = () => {
        num.textContent = String(n);
        num.classList.remove('go');
        void num.offsetWidth;
        num.classList.add('go');
        said.textContent = s.countdownLabel.replace('{{n}}', String(n));
      };
      const end = () => {
        clearInterval(timerId);
        document.removeEventListener('keydown', onKey, true);
        cdHost.remove();
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        e.stopPropagation();
        end();
        void browser.runtime.sendMessage({ type: 'fd:cancel' }).catch(() => undefined);
      };
      document.addEventListener('keydown', onKey, true);
      show();
      timerId = window.setInterval(() => {
        n -= 1;
        if (n > 0) return show();
        end();
        void send({ type: 'fd:video-go' }).then(tick);
      }, 1000);
    }

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
            text: labelText(el),
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
        document.querySelector('[data-fd-countdown]')?.remove();
        clearInterval(scanTimer);
        clearInterval(flushTimer);
        cancelAnimationFrame(sampling);
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
