import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';
import { stableSelector } from '@flowdsiml/core';
import { elementLabel } from '@/lib/geometry';
import { labelText } from '@/lib/labelText';
import { captureHtml } from '@/lib/htmlCapture';
import { isScreenChange, isVisible, mainHeading } from '@/lib/screenChange';
import type { HtmlBarRequest } from '@/lib/messages';
import { strings } from '@/lib/i18n';

/**
 * A8 (L20) : barre de la capture HTML. Chaque page est copiée (DOM assaini, données remplacées) au
 * chargement après un clic qui navigue. Dans une application à page unique (routeur côté client, sans
 * rechargement), la page est copiée dès que l'adresse change après un clic, ou que l'écran change sans
 * changement d'adresse (lib/screenChange.ts), une fois l'affichage stabilisé. « Capturer cette page »
 * (Alt + Maj + M) reste disponible pour un état passager (menu ouvert, fenêtre). Le clic qui mène à la
 * page suivante devient un lien proposé.
 */
/** Après un clic : durée pendant laquelle un changement d'adresse sans rechargement est guetté. */
const WATCH_MS = 8000;
/** Affichage stable : aucune modification du DOM pendant ce délai (au plus SETTLE_MAX_MS d'attente). */
const SETTLE_MS = 500;
const SETTLE_MAX_MS = 5000;
export default defineContentScript({
  matches: ['<all_urls>'],
  registration: 'runtime',
  main() {
    const w = window as unknown as { __fdHtmlBar?: boolean };
    if (w.__fdHtmlBar) return;
    w.__fdHtmlBar = true;
    const s = strings;
    const send = <T>(m: HtmlBarRequest) =>
      browser.runtime.sendMessage(m).catch(() => null) as Promise<T | null>;

    const host = document.createElement('div');
    host.setAttribute('data-fd-ui', '');
    host.style.cssText = 'position:fixed;z-index:2147483647;left:50%;bottom:20px;transform:translateX(-50%)';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        .bar{display:flex;align-items:center;gap:6px;padding:6px 8px 6px 14px;border-radius:999px;background:#141311;
          color:#fff;font:500 13px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.3)}
        .dot{width:10px;height:10px;border-radius:50%;background:#2897d5}
        .n{min-width:84px;font-variant-numeric:tabular-nums}
        button{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border:0;border-radius:999px;
          background:#2b2926;color:#fff;font:inherit;cursor:pointer}
        button:hover{background:#3a3734} button:focus-visible{outline:3px solid #1f7fb6;outline-offset:2px}
        button:disabled{opacity:.6;cursor:progress}
        .stop{background:#fff;color:#141311} .stop:hover{background:#e7e5e4}
        .toast{position:absolute;bottom:52px;left:50%;transform:translateX(-50%);white-space:nowrap;padding:8px 14px;
          border-radius:10px;background:#141311;color:#fff;font:500 13px system-ui,sans-serif}
        .toast.err{background:#7a1f12}
        [hidden]{display:none!important}
        .notice{position:absolute;bottom:96px;left:50%;transform:translateX(-50%);display:flex;gap:8px;align-items:flex-start;
          width:max-content;max-width:min(440px,calc(100vw - 32px));padding:10px 14px;border-radius:10px;background:#141311;
          color:#d6d3d1;font:400 13px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.3)}
        .notice svg{flex:none;margin-top:1px}
      </style>
      <p class="notice" role="note" hidden><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/>
        <path d="M12 16v-4"/><path d="M12 8h.01"/></svg><span>${s.htmlNotice}</span></p>
      <div class="toast" role="status" hidden></div>
      <div class="bar" role="toolbar" aria-label="${s.htmlBar}">
        <span class="dot" aria-hidden="true"></span>
        <span class="n" aria-live="polite"></span>
        <button type="button" class="cap" title="${s.htmlShortcutCapture}">${s.htmlCapturePage}</button>
        <button type="button" class="stop" title="${s.shortcutStop}">${s.finish}</button>
      </div>`;
    document.documentElement.appendChild(host);
    const $ = <T extends Element>(q: string) => root.querySelector(q) as T;
    const countEl = $<HTMLSpanElement>('.n');
    const capBtn = $<HTMLButtonElement>('.cap');
    const toast = $<HTMLDivElement>('.toast');
    // EXT-02 §8 : cible d'un ajout (« Démo CRM · après l'étape 3 »), à la suite du nombre de pages
    let target: string | null = null;
    let pages = 0;
    const setCount = (n: number) => {
      pages = n;
      const label =
        n <= 1 ? s.htmlPagesOne.replace('{{n}}', String(n)) : s.htmlPages.replace('{{n}}', String(n));
      countEl.textContent = target ? `${label} · ${target}` : label;
    };
    setCount(0);
    function flash(text: string, err = false) {
      toast.textContent = text;
      toast.classList.toggle('err', err);
      toast.hidden = false;
      setTimeout(() => (toast.hidden = true), 3000);
    }

    // L49 §6 : mention d'autorisation au lancement (avant la première page), lisible 10 s
    const notice = $<HTMLParagraphElement>('.notice');

    let busy = false;
    async function capture() {
      if (busy) return;
      busy = true;
      capBtn.disabled = true;
      flash(s.htmlCapturing);
      try {
        const c = await captureHtml(async (url, kind) => send<string>({ type: 'fd:fetch-asset', url, kind }));
        if (c.tooBig) return flash(s.htmlTooBig, true);
        const st = await send<{ steps: number }>({ type: 'fd:html-page', capture: c });
        setCount(st?.steps ?? 0);
        remember();
        flash(s.htmlCaptured);
      } catch {
        flash(s.htmlFailed, true);
      } finally {
        busy = false;
        capBtn.disabled = false;
      }
    }
    capBtn.onclick = () => void capture();

    // Application à page unique : l'adresse change sans rechargement (history.pushState, ancre). Le script
    // de contenu ne voit pas les appels de la page : l'adresse est relue après chaque clic.
    const settled = () =>
      new Promise<void>((resolve) => {
        let quiet = setTimeout(done, SETTLE_MS);
        const max = setTimeout(done, SETTLE_MAX_MS);
        const mo = new MutationObserver((list) => {
          // Les changements de notre barre ne comptent pas
          if (list.every((m) => host.contains(m.target))) return;
          clearTimeout(quiet);
          quiet = setTimeout(done, SETTLE_MS);
        });
        function done() {
          clearTimeout(quiet);
          clearTimeout(max);
          mo.disconnect();
          resolve();
        }
        mo.observe(document.documentElement, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true,
        });
      });
    // Éléments visibles dans la dernière copie : un clic sur un élément apparu depuis (entrée d'un menu
    // ouvert après coup) ne peut pas servir de lien, il n'existe pas dans la page copiée
    let seen: WeakSet<Element> | null = null;
    function remember() {
      seen = new WeakSet();
      for (const el of document.body.querySelectorAll('*')) if (isVisible(el)) seen.add(el);
    }

    let initial = false;
    let watch: ReturnType<typeof setInterval> | undefined;
    let clickNo = 0;
    function watchClick(el: Element) {
      const no = ++clickNo;
      const from = location.href;
      const heading = mainHeading(document);
      const expanded = el.getAttribute('aria-expanded');
      const until = Date.now() + WATCH_MS;
      // 1. L'adresse change sans rechargement
      clearInterval(watch);
      watch = setInterval(() => {
        if (location.href !== from) {
          clearInterval(watch);
          if (!initial) void settled().then(() => capture());
        } else if (Date.now() > until) clearInterval(watch);
      }, 150);
      // 2. L'écran change sans changement d'adresse : éléments ajoutés ou rendus visibles depuis le clic
      const appeared = new Set<Element>();
      const mo = new MutationObserver((list) => {
        for (const m of list) {
          if (host.contains(m.target)) continue;
          if (m.type === 'childList') {
            for (const n of m.addedNodes) if (n instanceof Element) appeared.add(n);
          } else if (m.target instanceof Element && !seen?.has(m.target)) appeared.add(m.target);
        }
      });
      mo.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['hidden', 'class', 'style', 'aria-hidden'],
      });
      // État lisible de l'extérieur (tests) : un clic est en cours d'examen
      host.setAttribute('data-fd-watching', '');
      void settled().then(() => {
        mo.disconnect();
        if (no === clickNo) host.removeAttribute('data-fd-watching');
        // Un clic plus récent a pris le relais ; ou l'adresse a changé (cas 1) ; ou capture de départ en attente
        if (no !== clickNo || location.href !== from || initial) return;
        // Le clic a ouvert ou fermé un menu, une liste, un volet : état passager de la même page
        if (el.isConnected && el.getAttribute('aria-expanded') !== expanded) return;
        if (isScreenChange(document, appeared, heading, { w: innerWidth, h: innerHeight })) {
          clearInterval(watch);
          void capture();
        }
      });
    }
    $<HTMLButtonElement>('.stop').onclick = () => void send({ type: 'fd:html-stop' });

    // Clic sur un élément de la page : lien proposé vers la page suivante
    function onClick(e: MouseEvent) {
      const t = e.target as Element | null;
      if (!t || t.closest('[data-fd-ui]') || e.composedPath().includes(host)) return;
      const el =
        t.closest(
          'a,button,[role="button"],[role="link"],[role="tab"],[role="menuitem"],input[type="submit"]',
        ) ?? t;
      const label = elementLabel({
        text: labelText(el),
        ariaLabel: el.getAttribute('aria-label'),
        placeholder: el.getAttribute('placeholder'),
        title: el.getAttribute('title'),
        alt: el.getAttribute('alt'),
      });
      void send({
        type: 'fd:html-click',
        sel: stableSelector(el),
        label,
        transient: !!seen && !seen.has(el),
      });
      watchClick(el);
    }
    document.addEventListener('click', onClick, true);

    const onMsg = (msg: unknown) => {
      const type = (msg as { type?: string })?.type;
      if (type === 'fd:html-capture') void capture();
      if (type === 'fd:recorder-stop') {
        document.removeEventListener('click', onClick, true);
        clearInterval(watch);
        browser.runtime.onMessage.removeListener(onMsg);
        host.remove();
        w.__fdHtmlBar = false;
      }
    };
    browser.runtime.onMessage.addListener(onMsg);

    // Au chargement : capture si la page suit un clic (ou au démarrage)
    void send<{ capture: boolean; pages: number; target?: string | null }>({ type: 'fd:html-ready' }).then(
      (r) => {
        target = r?.target ?? null;
        setCount(r?.pages ?? pages);
        if ((r?.pages ?? 0) === 0) {
          notice.hidden = false;
          setTimeout(() => (notice.hidden = true), 10000);
        }
        if (r?.capture) {
          // Capture de départ en attente : un clic fait entre-temps ne doit pas produire un doublon
          initial = true;
          setTimeout(() => {
            initial = false;
            void capture();
          }, 600);
        }
      },
    );
  },
});
