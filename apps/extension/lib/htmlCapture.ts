import type { LiveRaw } from './liveCapture';
import { isVisible, openMenu, screenName } from './screenChange';
import { hotspotRect, type RelRect } from './geometry';
import {
  type HtmlRemovedItem,
  type HtmlSecurityCounts,
  HTML_MAX_BYTES,
  collectRemoved,
  maskExcerpt,
  piiItem,
  neutralText,
  neutralizeText,
  sanitizeCss,
  sanitizeDom,
  stableSelector,
} from '@flowdsiml/core';
import { PII_ATTR, type PiiOriginal } from './htmlKeep';
import { hideWidget, thirdPartyScriptSites, thirdPartyWidgets } from './htmlWidgets';
import { scanNodes } from './scan';

/**
 * A8 (L20) : capture HTML de la page courante, dans la page (script de contenu). Copie du DOM
 * rendu, styles et images intégrés (fichier unique), données repérées remplacées dans la source
 * (« Xxxxxx Xxxxxx ») et floutées, puis assainie. Rien n'est envoyé ici.
 */
export interface HtmlCapture {
  /** Sandbox v2 (étape 3) : enregistrement vivant brut, données personnelles remplacées à l'envoi. */
  live?: LiveRaw;
  html: string;
  bytes: number;
  tooBig: boolean;
  title: string;
  /** L60 : nom lisible de l'écran copié (titre principal, puis l'onglet choisi s'il y en a un). */
  heading?: string;
  url: string;
  viewport: { w: number; h: number };
  /** Liens de la page (sélecteur stable, href absolu, libellé) : liaison du Sandbox. */
  links: Array<{ sel: string; href: string; label: string }>;
  /** Éléments dont le texte a été remplacé et flouté. */
  blurred: number;
  /** Graphiques canvas convertis en image (non modifiables comme du texte). */
  canvases: number;
  /** L49 §3 : rapport d'analyse (ce qui a été retiré ou neutralisé sur la page d'origine). */
  security: HtmlSecurityCounts;
  /**
   * EXT-02 §2 : éléments retirés ou remplacés, un par un, classés par raison (écran de vérification).
   * Absent des pages capturées avant la version 0.2.
   */
  removed?: HtmlRemovedItem[];
  /**
   * EXT-02 §2.3 : texte d'origine des données remplacées, par identifiant de `removed`. Gardé dans le
   * navigateur pour « Garder » ; jamais affiché, jamais envoyé avec la page.
   */
  piiOriginals?: Record<string, PiiOriginal>;
  /**
   * Gêne lot B : menu ouvert pendant la copie, et l'élément qui l'a ouvert (survolé ou déplié). La page
   * précédente, même page menu fermé, est reliée d'office à cet état par cet élément.
   */
  menu?: { sel: string; label: string; rect: RelRect };
}

/** Récupère une ressource (image → data: WebP, police → data:, CSS → texte) par le service. */
export type FetchAsset = (url: string, kind: 'image' | 'font' | 'css') => Promise<string | null>;

const BLUR = 'filter:blur(6px)!important';

/** Associe chaque nœud vivant à son clone (cloneNode conserve l'ordre). */
function mapClone(live: Node, clone: Node): Map<Node, Node> {
  const m = new Map<Node, Node>();
  const a = document.createTreeWalker(live, NodeFilter.SHOW_ALL);
  const b = document.createTreeWalker(clone, NodeFilter.SHOW_ALL);
  m.set(live, clone);
  for (let x = a.nextNode(), y = b.nextNode(); x && y; x = a.nextNode(), y = b.nextNode()) m.set(x, y);
  return m;
}

const abs = (u: string, base: string) => {
  try {
    return new URL(u, base).href;
  } catch {
    return '';
  }
};

/** Remplace les url(...) d'un CSS par des data: (images et polices). */
async function inlineCssUrls(css: string, base: string, fetchAsset: FetchAsset, budget: { left: number }) {
  const urls = new Set<string>();
  for (const m of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g))
    if (m[2] && !m[2].startsWith('data:') && !m[2].startsWith('#')) urls.add(m[2]);
  for (const u of urls) {
    const full = abs(u, base);
    if (!/^https?:/.test(full) || budget.left <= 0) {
      css = css.split(u).join('');
      continue;
    }
    const kind = /\.(woff2?|ttf|otf|eot)(\?|#|$)/i.test(full) ? 'font' : 'image';
    const data = await fetchAsset(full, kind);
    budget.left -= data?.length ?? 0;
    css = css.split(u).join(data ?? '');
  }
  return css;
}

async function collectCss(fetchAsset: FetchAsset, budget: { left: number }): Promise<string> {
  const out: string[] = [];
  const read = async (sheet: CSSStyleSheet, base: string): Promise<string> => {
    let rules: CSSRuleList | null = null;
    try {
      rules = sheet.cssRules;
    } catch {
      rules = null;
    }
    if (!rules) {
      const text = sheet.href ? await fetchAsset(sheet.href, 'css') : null;
      return text ? inlineCssUrls(text, sheet.href ?? base, fetchAsset, budget) : '';
    }
    const parts: string[] = [];
    for (const r of [...rules]) {
      if (r instanceof CSSImportRule && r.styleSheet)
        parts.push(await read(r.styleSheet, r.href ? abs(r.href, base) : base));
      else parts.push(r.cssText);
    }
    return inlineCssUrls(parts.join('\n'), sheet.href ?? base, fetchAsset, budget);
  };
  for (const sheet of [...document.styleSheets]) {
    const owner = sheet.ownerNode as Element | null;
    if (owner?.closest('[data-fd-ui]')) continue;
    if (sheet.disabled) continue;
    out.push(await read(sheet, location.href));
  }
  return sanitizeCss(out.join('\n'));
}

export async function captureHtml(fetchAsset: FetchAsset): Promise<HtmlCapture> {
  const live = document.documentElement;
  const detections = scanNodes(document.body);
  // Canvas : image de l'état affiché (si lisible), avant le clonage
  const canvasData = new Map<HTMLCanvasElement, string>();
  for (const c of [...document.querySelectorAll('canvas')]) {
    try {
      canvasData.set(c, c.toDataURL('image/webp', 0.85));
    } catch {
      /* canvas « tainted » : laissé vide */
    }
  }

  const clone = live.cloneNode(true) as HTMLElement;
  const map = mapClone(live, clone);

  // Données repérées : texte remplacé dans la source et flou
  const blurredEls = new Set<Element>();
  let piiReplaced = 0;
  // Liste de vérification : valeur masquée et type, jamais la valeur réelle. Le texte d'origine est mis
  // de côté (piiOriginals) pour « Garder », et l'élément porteur est marqué
  const piiList: Array<{ masked: string; type: (typeof detections)[number]['type'] }> = [];
  const piiOriginals: Record<string, PiiOriginal> = {};
  const mark = (el: Element, id: string) =>
    el.setAttribute(PII_ATTR, `${el.getAttribute(PII_ATTR) ?? ''} ${id}`.trim());
  for (const d of detections) {
    const el = map.get(d.el) as HTMLElement | undefined;
    if (d.node && d.start !== undefined && d.end !== undefined) {
      const t = map.get(d.node) as Text | undefined;
      if (t) {
        const original = t.data.slice(d.start, d.end);
        const masked = neutralText(original);
        t.data = t.data.slice(0, d.start) + masked + t.data.slice(d.end);
        piiReplaced++;
        const id = `p${piiList.push({ masked: maskExcerpt(d.type, original), type: d.type })}`;
        const host = el ?? t.parentElement;
        if (host) {
          // Place de l'extrait : rang de son nœud texte dans l'élément, et position dans ce nœud
          let node = -1;
          const w = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
          for (let n = w.nextNode(), k = 0; n; n = w.nextNode(), k++) if (n === t) node = k;
          piiOriginals[id] = { masked, original, node, start: d.start };
          mark(host, id);
        }
      }
    }
    if (!el) continue;
    if (!d.node) {
      const texts: string[] = [];
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) texts.push(n.nodeValue ?? '');
      const value = el.getAttribute('value') ?? undefined;
      neutralizeText(el);
      piiReplaced++;
      const id = `p${piiList.push({ masked: (el.textContent ?? '').replace(/\s+/g, ' ').trim(), type: d.type })}`;
      piiOriginals[id] = { texts, value };
      mark(el, id);
    }
    // Le nom de colonne ou la libellé ne sont pas floutés : seulement l'élément porteur
    el.setAttribute('style', `${el.getAttribute('style') ?? ''};${BLUR}`);
    el.setAttribute('data-fd-blurred', '');
    blurredEls.add(el);
  }
  // Ce texte ne doit jamais rester : les attributs title/alt des éléments floutés aussi
  for (const el of blurredEls)
    for (const a of ['title', 'alt', 'aria-label'])
      if (el.hasAttribute(a)) el.setAttribute(a, neutralText(el.getAttribute(a) ?? ''));

  // Liens de la page : sélecteur calculé sur la page, libellé lu dans la copie (déjà neutralisée)
  const links: HtmlCapture['links'] = [];
  // Lien de la copie → son sélecteur sur la page (pour « Garder » un lien externe)
  const linkOf = new Map<Element, { sel: string; href: string }>();
  for (const a of [...document.querySelectorAll<HTMLAnchorElement>('a[href]')]) {
    if (a.closest('[data-fd-ui]') || !/^https?:/.test(a.href)) continue;
    const label = ((map.get(a) as Element | undefined)?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const sel = stableSelector(a);
    links.push({ sel, href: a.href, label: label.slice(0, 120) });
    const copy = map.get(a) as Element | undefined;
    if (copy) linkOf.set(copy, { sel, href: a.href });
  }

  // Lot B : ajouts de scripts d'un autre site (discussion, cookies, aide), masqués et listés pour « Garder »
  const widgetItems = await markWidgets(map);

  // Interface de l'extension retirée
  for (const el of [...clone.querySelectorAll('[data-fd-ui]')]) el.remove();

  // Canvas → image
  let canvases = 0;
  for (const [c, data] of canvasData) {
    const el = map.get(c) as HTMLElement | undefined;
    if (!el?.parentNode) continue;
    const img = document.createElement('img');
    img.src = data;
    img.alt = c.getAttribute('aria-label') ?? '';
    img.width = c.width;
    img.height = c.height;
    img.setAttribute('style', c.getAttribute('style') ?? '');
    img.className = c.className;
    img.setAttribute('data-fd-canvas', '');
    el.replaceWith(img);
    canvases++;
  }

  // Images : data: WebP (srcset et <source> retirés, l'image affichée est gardée)
  const budget = { left: HTML_MAX_BYTES };
  for (const img of [...document.querySelectorAll('img')]) {
    const el = map.get(img) as HTMLImageElement | undefined;
    if (!el || el.hasAttribute('data-fd-canvas')) continue;
    el.removeAttribute('srcset');
    el.removeAttribute('sizes');
    el.removeAttribute('loading');
    const src = img.currentSrc || img.src;
    if (!src || src.startsWith('data:')) continue;
    const data = budget.left > 0 && /^https?:/.test(src) ? await fetchAsset(src, 'image') : null;
    budget.left -= data?.length ?? 0;
    if (data) el.setAttribute('src', data);
    else el.removeAttribute('src');
  }
  for (const s of [...clone.querySelectorAll('picture source, video, audio')]) s.remove();
  // Styles en ligne avec url(...)
  for (const el of [...clone.querySelectorAll<HTMLElement>('[style*="url("]')])
    el.setAttribute(
      'style',
      await inlineCssUrls(el.getAttribute('style') ?? '', location.href, fetchAsset, budget),
    );

  // Feuilles de style → un seul <style>
  const css = await collectCss(fetchAsset, budget);
  for (const s of [...clone.querySelectorAll('style, link')]) s.remove();
  const head =
    clone.querySelector('head') ?? clone.insertBefore(document.createElement('head'), clone.firstChild);
  const style = document.createElement('style');
  style.textContent = css;
  head.appendChild(style);
  for (const m of [...head.querySelectorAll('meta[charset]')]) m.remove();
  const meta = document.createElement('meta');
  meta.setAttribute('charset', 'utf-8');
  head.insertBefore(meta, head.firstChild);

  // Liens : absolus (liaison du Sandbox), jamais suivis dans le lecteur
  for (const a of [...clone.querySelectorAll<HTMLAnchorElement>('a[href]')]) {
    const full = abs(a.getAttribute('href') ?? '', location.href);
    if (full) a.setAttribute('href', full);
    a.removeAttribute('target');
  }

  // Liste détaillée, relevée avant l'assainissement (qui retire ces éléments de la copie)
  const removed = [
    ...collectRemoved(clone, location.href, (el) => linkOf.get(el)),
    ...piiList.map((p, i) => piiItem(i, p.masked, p.type)),
    ...widgetItems,
  ];
  const security = { ...sanitizeDom(clone, location.href), piiReplaced };
  const html = `<!doctype html>\n${clone.outerHTML}`;
  const bytes = new TextEncoder().encode(html).length;
  return {
    html,
    bytes,
    tooBig: bytes > HTML_MAX_BYTES,
    title: document.title.slice(0, 200),
    heading: screenName(document).slice(0, 200),
    menu: menuOf(),
    url: location.href.slice(0, 2000),
    viewport: { w: innerWidth, h: innerHeight },
    links,
    blurred: blurredEls.size,
    canvases,
    security,
    removed,
    piiOriginals,
  };
}

/** Gêne lot B : élément qui a ouvert le menu affiché, s'il y en a un. */
function menuOf(): HtmlCapture['menu'] {
  const m = openMenu(document);
  if (!m) return undefined;
  const r = m.el.getBoundingClientRect();
  const box = { left: r.left, top: r.top, width: r.width, height: r.height };
  const center = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  return {
    sel: stableSelector(m.el),
    label: m.label,
    rect: hotspotRect(center, box, { width: innerWidth, height: innerHeight }),
  };
}

/** Source de la page telle que le serveur l'a envoyée (cache du navigateur d'abord), 2 s au plus. */
export async function pageSource(): Promise<string | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 2000);
  try {
    const r = await fetch(location.href, {
      cache: 'force-cache',
      credentials: 'include',
      signal: ctl.signal,
    });
    return r.ok && /html/.test(r.headers.get('content-type') ?? '') ? await r.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Lot B : éléments ajoutés par un script d'un autre site, masqués et marqués dans la copie. Sans source
 * lisible, rien n'est retiré (prudence). Le nom affiché est lu dans la copie, déjà neutralisée.
 */
async function markWidgets(map: Map<Node, Node>): Promise<HtmlRemovedItem[]> {
  const sites = thirdPartyScriptSites(document, location.href);
  if (!sites.length) return [];
  const source = await pageSource();
  if (!source) return [];
  const found = thirdPartyWidgets(
    document,
    location.href,
    source,
    { width: innerWidth, height: innerHeight },
    (el) => {
      const r = el.getBoundingClientRect();
      return {
        position: getComputedStyle(el).position,
        box: { width: r.width, height: r.height },
        visible: isVisible(el),
      };
    },
  );
  const out: HtmlRemovedItem[] = [];
  for (const el of found) {
    const copy = map.get(el) as Element | undefined;
    if (!copy) continue;
    const id = `w${out.length + 1}`;
    hideWidget(copy, id);
    const name = (copy.getAttribute('aria-label') ?? copy.textContent ?? '').replace(/\s+/g, ' ').trim();
    out.push({
      id,
      group: 'pageScripts',
      reason: 'widgetThirdParty',
      keepable: true,
      name: name.length > 60 ? `${name.slice(0, 59)}…` : name,
      source: sites.length === 1 ? sites[0]! : '',
    });
  }
  return out;
}
