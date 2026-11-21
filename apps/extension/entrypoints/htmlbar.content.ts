import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';
import { stableSelector } from '@flowdsiml/core';
import { elementLabel } from '@/lib/geometry';
import { captureHtml } from '@/lib/htmlCapture';
import type { HtmlBarRequest } from '@/lib/messages';
import { strings } from '@/lib/i18n';

/**
 * A8 (L20) : barre de la capture HTML. Chaque page est copiée (DOM assaini, données remplacées) au
 * chargement après un clic qui navigue, ou avec « Capturer cette page » (Alt + Maj + M) pour les
 * applications à page unique. Le clic qui mène à la page suivante devient un lien proposé.
 */
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
    const setCount = (n: number) =>
      (countEl.textContent =
        n <= 1 ? s.htmlPagesOne.replace('{{n}}', String(n)) : s.htmlPages.replace('{{n}}', String(n)));
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
        flash(s.htmlCaptured);
      } catch {
        flash(s.htmlFailed, true);
      } finally {
        busy = false;
        capBtn.disabled = false;
      }
    }
    capBtn.onclick = () => void capture();
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
        text: el instanceof HTMLInputElement ? null : (el.textContent ?? ''),
        ariaLabel: el.getAttribute('aria-label'),
        placeholder: el.getAttribute('placeholder'),
        title: el.getAttribute('title'),
        alt: el.getAttribute('alt'),
      });
      void send({ type: 'fd:html-click', sel: stableSelector(el), label });
    }
    document.addEventListener('click', onClick, true);

    const onMsg = (msg: unknown) => {
      const type = (msg as { type?: string })?.type;
      if (type === 'fd:html-capture') void capture();
      if (type === 'fd:recorder-stop') {
        document.removeEventListener('click', onClick, true);
        browser.runtime.onMessage.removeListener(onMsg);
        host.remove();
        w.__fdHtmlBar = false;
      }
    };
    browser.runtime.onMessage.addListener(onMsg);

    // Au chargement : capture si la page suit un clic (ou au démarrage)
    void send<{ capture: boolean; pages: number }>({ type: 'fd:html-ready' }).then((r) => {
      setCount(r?.pages ?? 0);
      if ((r?.pages ?? 0) === 0) {
        notice.hidden = false;
        setTimeout(() => (notice.hidden = true), 10000);
      }
      if (r?.capture) setTimeout(() => void capture(), 600);
    });
  },
});
