import { isExternalLink } from '@flowdsiml/core';

/**
 * Lot B (arbitrage UX du correctif, §2.3) : à la copie, on retire ce qu'un script d'un autre site a ajouté
 * à la page (lanceur de discussion, bandeau de cookies, pastille d'aide). Dans la démo, ce serait un bouton
 * inerte : le visiteur cliquerait sans résultat. L'élément est compté dans « Scripts non copiés » de
 * « Vérifier avant l'envoi », avec « Garder » pour le laisser affiché.
 *
 * Un script ne laisse pas sa signature sur ce qu'il ajoute : on retient un faisceau d'indices, prudent.
 *  - la page charge au moins un script d'un autre site (sinon, rien n'est retiré) ;
 *  - l'élément est posé directement dans <body> et ne figure pas dans la source de la page ;
 *  - il flotte au-dessus de la page (fixed ou sticky, lui ou son premier enfant) et en couvre moins de
 *    la moitié : un lanceur, un bandeau, une pastille, pas le contenu de l'application.
 * À la copie, l'élément est seulement masqué et marqué ; l'envoi le retire, sauf s'il est gardé.
 */
export const WIDGET_ATTR = 'data-fd-widget';
const HIDE = 'display:none!important';
const HIDE_RE = /;?display:none!important/g;
const MARK_RE = new RegExp(` ${WIDGET_ATTR}="[^"]*"`, 'g');
/** Part de la fenêtre au-delà de laquelle un élément flottant est le contenu, pas un ajout. */
const MAX_RATIO = 0.5;
const SKIP = new Set(['SCRIPT', 'STYLE', 'LINK', 'NOSCRIPT', 'TEMPLATE', 'META', 'IFRAME']);

/**
 * Sites (distincts du site de la page) d'où la page charge des scripts. Un autre port du même hôte est
 * un autre service : il compte aussi.
 */
export function thirdPartyScriptSites(doc: Document, pageUrl: string): string[] {
  const out = new Set<string>();
  const page = new URL(pageUrl);
  for (const s of doc.querySelectorAll<HTMLScriptElement>('script[src]')) {
    const src = s.getAttribute('src') ?? '';
    try {
      const u = new URL(src, pageUrl);
      const other = isExternalLink(u.href, pageUrl) || (u.hostname === page.hostname && u.port !== page.port);
      if (/^https?:$/.test(u.protocol) && other) out.add(u.host);
    } catch {
      /* adresse illisible : ignorée */
    }
  }
  return [...out];
}

const sig = (el: Element) => `${el.tagName}#${el.id}`;

/**
 * Enfants de <body> absents de la source : appariement dans l'ordre (étiquette et identifiant), les
 * éléments de la page vivante qui ne trouvent pas leur place dans la source sont des ajouts.
 */
export function addedToBody(live: Element[], source: Element[]): Element[] {
  const src = source.map(sig);
  const out: Element[] = [];
  let j = 0;
  for (const el of live) {
    const k = src.indexOf(sig(el), j);
    if (k >= 0) j = k + 1;
    else out.push(el);
  }
  return out;
}

type Box = { width: number; height: number };
type Look = (el: Element) => { position: string; box: Box; visible: boolean };

/** Ajouts de scripts tiers, sur la page vivante. `sourceHtml` : la page telle que le serveur l'a envoyée. */
export function thirdPartyWidgets(
  doc: Document,
  pageUrl: string,
  sourceHtml: string,
  view: Box,
  look: Look,
): Element[] {
  if (!thirdPartyScriptSites(doc, pageUrl).length) return [];
  const source = new DOMParser().parseFromString(sourceHtml, 'text/html');
  const live = [...doc.body.children].filter((el) => !el.hasAttribute('data-fd-ui') && !SKIP.has(el.tagName));
  const floats = (el: Element) => {
    const l = look(el);
    if (/fixed|sticky/.test(l.position)) return l;
    const first = el.firstElementChild;
    const f = first ? look(first) : null;
    return f && /fixed|sticky/.test(f.position) ? f : null;
  };
  return addedToBody(live, [...source.body.children]).filter((el) => {
    const l = look(el);
    const f = floats(el);
    return !!f && l.visible && f.box.width * f.box.height < view.width * view.height * MAX_RATIO;
  });
}

/** Copie : l'élément est masqué et marqué (identifiant de la liste de vérification). */
export function hideWidget(el: Element, id: string): void {
  el.setAttribute(WIDGET_ATTR, id);
  el.setAttribute('style', `${el.getAttribute('style') ?? ''};${HIDE}`);
}

/** Envoi : les ajouts gardés réapparaissent, les autres sont retirés ; les marques disparaissent. */
export function applyWidgets(html: string, keep: string[]): string {
  if (!html.includes(WIDGET_ATTR)) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const kept = new Set(keep);
  for (const el of [...doc.querySelectorAll(`[${WIDGET_ATTR}]`)]) {
    if (!kept.has(el.getAttribute(WIDGET_ATTR) ?? '')) {
      el.remove();
      continue;
    }
    el.removeAttribute(WIDGET_ATTR);
    const style = (el.getAttribute('style') ?? '').replace(HIDE_RE, '');
    if (style.replace(/[;\s]/g, '')) el.setAttribute('style', style);
    else el.removeAttribute('style');
  }
  return `<!doctype html>\n${doc.documentElement.outerHTML}`.replace(MARK_RE, '');
}
