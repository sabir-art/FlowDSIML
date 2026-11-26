import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';
import { stableSelector } from '@flowdsiml/core';
import { defaultHotspotTitle, elementLabel, hotspotRect } from '@/lib/geometry';
import { labelText } from '@/lib/labelText';
import { captureHtml } from '@/lib/htmlCapture';
import { isScreenChange, isVisible, mainHeading } from '@/lib/screenChange';
import type { HtmlBarRequest } from '@/lib/messages';
import { barCount, lang, strings } from '@/lib/i18n';
import {
  BAR_CSS,
  CARD_CSS,
  barMarkup,
  cardMarkup,
  ring,
  togglePause,
  wireBar,
  wireCard,
} from '@/lib/captureBar';

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
        ${BAR_CSS}
        ${CARD_CSS}
        .card{position:absolute;bottom:56px;left:50%;transform:translateX(-50%)}
        .cap:disabled{opacity:.6;cursor:progress}
        .toast{position:absolute;bottom:56px;left:50%;transform:translateX(-50%);white-space:nowrap;padding:8px 14px;
          border-radius:10px;background:#16181d;color:#fff;font:500 13px system-ui,sans-serif}
        .toast.err{background:#7a1f12}
        [hidden]{display:none!important}
      </style>
      <div class="toast" role="status" hidden></div>
      ${cardMarkup()}
      ${barMarkup({
        label: s.htmlBar,
        name: s.barHtml,
        middle: `<span class="note mnote">${s.barHtmlNote}</span>
          <button type="button" class="cap" title="${s.htmlShortcutCapture}">${s.barAddPage}</button>
          <span class="note tgt" hidden></span>`,
      })}`;
    document.documentElement.appendChild(host);
    const $ = <T extends Element>(q: string) => root.querySelector(q) as T;
    const tgt = $<HTMLSpanElement>('.tgt');
    // L60 §2 : barre commune (état, pastille « 2 pages », Pause, Terminer, déplacement)
    const ui = wireBar(root, {
      name: s.barHtml,
      mover: host,
      onPause: togglePause,
      onStop: () => void send({ type: 'fd:html-stop' }),
      shortcut: true,
    });
    void browser.storage.local.get('fd.htmlKind').then((r) => {
      if (r['fd.htmlKind'] !== 'sandbox') return;
      ui.setName(s.barSandbox);
      $<HTMLSpanElement>('.mnote').textContent = s.barSandboxNote;
    });
    // L60 §2 : carte « Étape n capturée » ; « Annuler » retire la dernière page
    const card = wireCard(root, {
      onUndo: (c) =>
        browser.runtime
          .sendMessage({ type: 'fd:undo-step', n: c.n })
          .then((st: unknown) => setCount((st as { steps?: number } | null)?.steps ?? pages))
          .catch(() => undefined),
    });
    void browser.runtime
      .sendMessage({ type: 'fd:status' })
      .then((st: unknown) => ui.setPaused(!!(st as { paused?: boolean } | null)?.paused))
      .catch(() => undefined);
    const capBtn = $<HTMLButtonElement>('.cap');
    const toast = $<HTMLDivElement>('.toast');
    // EXT-02 §8 : cible d'un ajout (« Démo CRM · après l'étape 3 »), à la suite du nombre de pages
    let target: string | null = null;
    let pages = 0;
    const setCount = (n: number) => {
      pages = n;
      ui.setCount(barCount('pages', n));
      tgt.textContent = target ?? '';
      tgt.hidden = !target;
    };
    setCount(0);
    function flash(text: string, err = false) {
      toast.textContent = text;
      toast.classList.toggle('err', err);
      toast.hidden = false;
      setTimeout(() => (toast.hidden = true), 3000);
    }

    // L49 §6 : mention d'autorisation au lancement (avant la première page), lisible 10 s

    let busy = false;
    async function capture() {
      // En pause, aucune page n'est ajoutée (L60 §2)
      if (busy || ui.paused) return;
      busy = true;
      capBtn.disabled = true;
      flash(s.htmlCapturing);
      try {
        const c = await captureHtml(async (url, kind) => send<string>({ type: 'fd:fetch-asset', url, kind }));
        if (c.tooBig) return flash(s.htmlTooBig, true);
        const st = await send<{ steps: number; label?: string }>({ type: 'fd:html-page', capture: c });
        setCount(st?.steps ?? 0);
        remember();
        toast.hidden = true;
        if (st?.steps) card.show({ n: st.steps, label: st.label ? defaultHotspotTitle(st.label, lang) : '' });
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
      // L60 : un onglet choisi remplace un panneau sans changer d'adresse ni de titre : c'est un écran
      const tab = el.closest('[role="tab"]');
      const tabWas = tab?.getAttribute('aria-selected') ?? null;
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
        const tabChosen =
          !!tab && tab.isConnected && tabWas !== 'true' && tab.getAttribute('aria-selected') === 'true';
        if (tabChosen || isScreenChange(document, appeared, heading, { w: innerWidth, h: innerHeight })) {
          clearInterval(watch);
          void capture();
        }
      });
    }

    // Clic sur un élément de la page : lien proposé vers la page suivante
    function onClick(e: MouseEvent) {
      const t = e.target as Element | null;
      if (!t || t.closest('[data-fd-ui]') || e.composedPath().includes(host) || ui.paused) return;
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
        rect: (() => {
          const r = el.getBoundingClientRect();
          const box = { left: r.left, top: r.top, width: r.width, height: r.height };
          return hotspotRect({ x: e.clientX, y: e.clientY }, box, { width: innerWidth, height: innerHeight });
        })(),
      });
      ring(e.clientX, e.clientY);
      watchClick(el);
    }
    document.addEventListener('click', onClick, true);

    const onMsg = (msg: unknown) => {
      const type = (msg as { type?: string })?.type;
      if (type === 'fd:html-capture') void capture();
      if (type === 'fd:paused') ui.setPaused(!!(msg as { paused?: boolean }).paused);
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
        // L60 §1 : l'avertissement HTML s'affiche une fois, dans le popup, et ne recouvre plus la page
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
