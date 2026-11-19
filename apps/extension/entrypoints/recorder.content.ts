import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';
import { elementLabel } from '@/lib/geometry';
import { cssSelector } from '@/lib/selector';
import type { ClickPayload } from '@/lib/messages';
import { scanFullPage, scanPage } from '@/lib/scan';
import { guideChip, tabChip } from '@/lib/i18n';

/**
 * Injecté à la demande (registration: runtime) dans l'onglet enregistré.
 * Écoute les clics en phase de capture et les transmet au service worker,
 * qui prend la capture d'écran. Le texte de la page n'est lu que pour repérer les données
 * personnelles possibles (spec f1-formation §1) : seuls le type, la boîte et un extrait masqué en
 * sortent, et rien n'est envoyé au serveur avant l'écran de vérification.
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
    // L25-01 : onglet suivi (« Onglet 2 · Aide ») et annonce pour les lecteurs d'écran
    const live = document.createElement('div');
    live.setAttribute('data-fd-ui', '');
    live.setAttribute('role', 'status');
    live.style.cssText =
      'position:fixed;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap';
    document.documentElement.appendChild(live);
    // L25-01 : onglet suivi ; L26-04 : prochaine étape à capturer (relu après chaque clic)
    const refresh = () =>
      browser.runtime
        .sendMessage({ type: 'fd:tab-info' })
        .then((r: unknown) => {
          const info = r as {
            n: number;
            title: string;
            guide?: { title: string; n: number; total: number } | null;
          } | null;
          const parts = ['● REC'];
          const said: string[] = [];
          if (info && info.n >= 2) {
            const chip = tabChip(info.n, info.title || document.title);
            parts.push(chip.label);
            said.push(chip.announce);
          }
          if (info?.guide) {
            const g = guideChip(info.guide);
            parts.push(g);
            said.push(g);
          }
          badge.textContent = parts.join(' · ');
          if (said.length) live.textContent = said.join('. ');
        })
        .catch(() => undefined);
    void refresh();

    const rect = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    };

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
        detections: scanPage(),
        // L25-01 : page entière (animation de défilement dans l'éditeur)
        page: {
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
          scrollX,
          scrollY,
        },
        pageDetections: scanFullPage(),
      };
      badge.style.visibility = 'hidden';
      // Deux images d'affichage : le badge masqué est bien peint avant la capture
      const painted = new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      void painted
        .then(() => browser.runtime.sendMessage(payload))
        .catch(() => undefined)
        .finally(() => {
          badge.style.visibility = 'visible';
          // La capture est gardée de façon asynchrone : relecture un peu après
          setTimeout(() => void refresh(), 600);
        });
    }

    document.addEventListener('pointerdown', onPointerDown, true);
    browser.runtime.onMessage.addListener((msg: unknown) => {
      if ((msg as { type?: string })?.type === 'fd:recorder-stop') {
        document.removeEventListener('pointerdown', onPointerDown, true);
        badge.remove();
        live.remove();
        w.__fdRecorder = false;
      }
    });
  },
});
