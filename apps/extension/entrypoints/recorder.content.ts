import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';
import { elementLabel } from '@/lib/geometry';
import { cssSelector } from '@/lib/selector';
import type { ClickPayload } from '@/lib/messages';

/**
 * Injecté à la demande (registration: runtime) dans l'onglet enregistré.
 * Écoute les clics en phase de capture et les transmet au service worker,
 * qui prend la capture d'écran. Les valeurs saisies ne sont jamais lues.
 */
export default defineContentScript({
  matches: ['<all_urls>'],
  registration: 'runtime',
  main() {
    const w = window as unknown as { __fdRecorder?: boolean };
    if (w.__fdRecorder) return;
    w.__fdRecorder = true;

    const badge = document.createElement('div');
    badge.setAttribute('data-fd-ui', '');
    badge.textContent = '● REC';
    badge.style.cssText =
      'position:fixed;z-index:2147483647;bottom:12px;right:12px;padding:4px 10px;border-radius:999px;' +
      'background:#d93f4c;color:#fff;font:600 12px system-ui,sans-serif;pointer-events:none;opacity:.9';
    document.documentElement.appendChild(badge);

    const rect = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    };

    function sensitiveRects() {
      const sel = 'input[type=password], input[autocomplete^="cc-"], [data-fd-blur]';
      return Array.from(document.querySelectorAll(sel))
        .map(rect)
        .filter((r) => r.width > 0 && r.height > 0 && r.top < innerHeight && r.left < innerWidth);
    }

    let last = 0;
    function onPointerDown(ev: PointerEvent) {
      if (!ev.isTrusted || ev.button !== 0) return;
      const now = Date.now();
      if (now - last < 400) return; // anti double-clic
      last = now;
      const target = ev.target instanceof Element ? ev.target : null;
      if (target?.closest('[data-fd-ui]')) return;
      const el =
        target?.closest('a,button,input,select,textarea,label,[role],[onclick],[tabindex]') ?? target;
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
        sensitive: sensitiveRects(),
      };
      badge.style.visibility = 'hidden';
      void browser.runtime
        .sendMessage(payload)
        .catch(() => undefined)
        .finally(() => {
          badge.style.visibility = 'visible';
        });
    }

    document.addEventListener('pointerdown', onPointerDown, true);
    browser.runtime.onMessage.addListener((msg: unknown) => {
      if ((msg as { type?: string })?.type === 'fd:recorder-stop') {
        document.removeEventListener('pointerdown', onPointerDown, true);
        badge.remove();
        w.__fdRecorder = false;
      }
    });
  },
});
