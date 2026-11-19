/**
 * A8 (L20) : rendu d'une page HTML capturée. La page est servie en iframe srcdoc,
 * sandbox="allow-scripts" SANS allow-same-origin (origine opaque, isolée de l'app et du lecteur),
 * avec une CSP stricte : seul notre script (empreinte sha256) peut s'exécuter. Les scripts de la
 * capture ont été retirés deux fois (extension, html-ingest) et seraient bloqués par la CSP.
 *
 * Échanges par postMessage, dans les deux sens, au format { fd: 1, t, ... } vérifié de chaque
 * côté. Aucun HTML n'est jamais reçu ni exécuté par message : seulement des sélecteurs, des textes
 * (posés en textContent), des id d'étape et des URL d'image (https ou data:image).
 */

/** Opération appliquée dans la page (valeurs déjà résolues par le parent : variables, URL). */
export interface FrameOp {
  id: string;
  sel: string;
  op: 'text' | 'hide' | 'blur' | 'link' | 'image' | 'remove';
  value?: string;
}

export type ToFrame =
  | {
      fd: 1;
      t: 'init';
      mode: 'player' | 'editor';
      ops: FrameOp[];
      /** Liens automatiques du Sandbox (même href capturé → même page). */
      autoLinks?: Array<{ sel: string; step: string }>;
      unlinked?: 'toast' | 'none' | 'highlight';
    }
  | { fd: 1; t: 'ops'; ops: FrameOp[] }
  | { fd: 1; t: 'select'; sel: string | null }
  /** Éditeur : sélectionne le n-ième parent de l'élément sélectionné (fil du sélecteur). */
  | { fd: 1; t: 'up'; n: number };

export interface Selected {
  sel: string;
  short: string;
  trail: string[];
  rect: { x: number; y: number; w: number; h: number };
  text: string;
  tag: string;
  canvas: boolean;
  img: boolean;
}

export type FromFrame =
  | { fd: 1; t: 'ready'; h: number }
  | { fd: 1; t: 'applied'; notFound: string[]; h: number }
  | { fd: 1; t: 'go'; step: string }
  | { fd: 1; t: 'unlinked' }
  | { fd: 1; t: 'select'; el: Selected | null }
  | { fd: 1; t: 'key'; key: 'edit' | 'hide' }
  | { fd: 1; t: 'scroll' };

const STEP_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;

/** Contrôle d'un message reçu de la page (format strict ; tout le reste est ignoré). */
export function parseFromFrame(data: unknown): FromFrame | null {
  if (!data || typeof data !== 'object') return null;
  const m = data as Record<string, unknown>;
  if (m.fd !== 1 || typeof m.t !== 'string') return null;
  switch (m.t) {
    case 'ready':
      return num(m.h) ? { fd: 1, t: 'ready', h: m.h as number } : null;
    case 'applied':
      return Array.isArray(m.notFound) && m.notFound.every((x) => str(x, 40)) && num(m.h)
        ? { fd: 1, t: 'applied', notFound: m.notFound as string[], h: m.h as number }
        : null;
    case 'go':
      return typeof m.step === 'string' && STEP_RE.test(m.step) ? { fd: 1, t: 'go', step: m.step } : null;
    case 'unlinked':
      return { fd: 1, t: 'unlinked' };
    case 'scroll':
      return { fd: 1, t: 'scroll' };
    case 'key':
      return m.key === 'edit' || m.key === 'hide' ? { fd: 1, t: 'key', key: m.key } : null;
    case 'select': {
      if (m.el === null) return { fd: 1, t: 'select', el: null };
      const e = m.el as Record<string, unknown> | undefined;
      const r = e?.rect as Record<string, unknown> | undefined;
      if (
        !e ||
        !str(e.sel, 500) ||
        !str(e.short, 120) ||
        !str(e.text, 5000) ||
        !str(e.tag, 40) ||
        !Array.isArray(e.trail) ||
        e.trail.length > 60 ||
        !e.trail.every((x) => str(x, 120)) ||
        !r ||
        !num(r.x) ||
        !num(r.y) ||
        !num(r.w) ||
        !num(r.h)
      )
        return null;
      return {
        fd: 1,
        t: 'select',
        el: {
          sel: e.sel as string,
          short: e.short as string,
          trail: e.trail as string[],
          rect: { x: r.x as number, y: r.y as number, w: r.w as number, h: r.h as number },
          text: e.text as string,
          tag: e.tag as string,
          canvas: e.canvas === true,
          img: e.img === true,
        },
      };
    }
    default:
      return null;
  }
}

/**
 * Script de la page (chaîne autonome, sans dépendance). Il n'exécute jamais de HTML reçu : les
 * textes passent par textContent, les URL d'image sont filtrées (https ou data:image).
 */
export const FRAME_RUNTIME = `(function () {
  'use strict';
  var parentWin = window.parent;
  var mode = 'player';
  var ops = [];
  var autoLinks = [];
  var unlinked = 'toast';
  var original = null;
  var selected = null;
  var hoverBox = null, selBox = null, selTag = null;
  var BLUE = '#2897D5';
  function post(m) { m.fd = 1; parentWin.postMessage(m, '*'); }
  function height() { return Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0); }
  function neutral(s) { return s.replace(/\\p{Lu}/gu, 'X').replace(/\\p{Ll}/gu, 'x').replace(/\\p{N}/gu, '0'); }
  function q(sel) { try { return document.querySelector(sel); } catch (e) { return null; } }
  function unstableClass(c) { return /\\d{3,}|[A-Za-z0-9]{6,}_[A-Za-z0-9]{4,}|^css-|^sc-|^jsx-|--|^fd-/.test(c); }
  function unstableId(id) { return /\\d{4,}|^[a-f0-9-]{16,}$|^:r/.test(id); }
  function esc(s) { return s.replace(/[^A-Za-z0-9_-]/g, function (c) { return '\\\\' + c; }); }
  function unique(sel) { try { return document.querySelectorAll(sel).length === 1; } catch (e) { return false; } }
  function part(el) {
    var tag = el.tagName.toLowerCase();
    var cls = [].slice.call(el.classList).filter(function (c) { return !unstableClass(c); }).slice(0, 2);
    var p = tag + cls.map(function (c) { return '.' + esc(c); }).join('');
    var parent = el.parentElement;
    if (parent) {
      var same = [].slice.call(parent.children).filter(function (c) { return c.tagName === el.tagName; });
      if (same.length > 1) p += ':nth-of-type(' + (same.indexOf(el) + 1) + ')';
    }
    return p;
  }
  function selectorOf(el) {
    var attrs = ['data-testid', 'data-test', 'data-qa', 'name'];
    for (var i = 0; i < attrs.length; i++) {
      var v = el.getAttribute(attrs[i]);
      if (v && v.length < 80) {
        var s = el.tagName.toLowerCase() + '[' + attrs[i] + '="' + v.replace(/["\\\\]/g, '\\\\$&') + '"]';
        if (unique(s)) return s;
      }
    }
    var parts = [];
    var cur = el;
    while (cur && cur.tagName !== 'BODY' && cur.tagName !== 'HTML') {
      if (cur.id && !unstableId(cur.id) && unique('#' + esc(cur.id))) {
        parts.unshift('#' + esc(cur.id));
        if (unique(parts.join(' > '))) return parts.join(' > ');
        break;
      }
      parts.unshift(part(cur));
      var s2 = parts.join(' > ');
      if (parts.length >= 2 && unique('body ' + s2) && unique(s2)) return s2;
      cur = cur.parentElement;
    }
    return parts[0] && parts[0].charAt(0) === '#' ? parts.join(' > ') : 'body > ' + parts.join(' > ');
  }
  function label(el) {
    var cls = [].slice.call(el.classList).filter(function (c) { return !unstableClass(c); })[0];
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
  }
  function shortSel(el) {
    var cls = [].slice.call(el.classList).filter(function (c) { return !unstableClass(c); })[0];
    return el.tagName.toLowerCase() + (el.id && !unstableId(el.id) ? '#' + el.id : cls ? '.' + cls : '');
  }
  function trail(el) {
    var out = [];
    for (var cur = el; cur && cur.tagName !== 'HTML'; cur = cur.parentElement) out.unshift(label(cur));
    return out;
  }
  function safeImg(u) { return typeof u === 'string' && (/^https:\\/\\//.test(u) || /^data:image\\/(png|jpe?g|gif|webp|avif);/.test(u)); }
  function apply() {
    if (original) {
      document.body.replaceWith(original.cloneNode(true));
    } else {
      original = document.body.cloneNode(true);
    }
    var notFound = [];
    for (var i = 0; i < ops.length; i++) {
      var o = ops[i];
      var el = q(o.sel);
      if (!el) { notFound.push(o.id); continue; }
      if (o.op === 'text') el.textContent = String(o.value || '');
      else if (o.op === 'blur') {
        var w = document.createTreeWalker(el, 4);
        for (var n = w.nextNode(); n; n = w.nextNode()) n.nodeValue = neutral(n.nodeValue || '');
        el.style.filter = 'blur(6px)';
        el.setAttribute('data-fd-blurred', '');
      } else if (o.op === 'hide' || o.op === 'remove') {
        if (mode === 'player') { el.style.setProperty('display', 'none', 'important'); el.setAttribute('aria-hidden', 'true'); }
        else el.setAttribute(o.op === 'hide' ? 'data-fd-hidden' : 'data-fd-removed', '');
      } else if (o.op === 'link') el.setAttribute('data-fd-link', String(o.value || ''));
      else if (o.op === 'image' && el.tagName === 'IMG' && safeImg(o.value)) { el.setAttribute('src', o.value); el.removeAttribute('srcset'); }
    }
    if (mode === 'player') {
      for (var j = 0; j < autoLinks.length; j++) {
        var a = q(autoLinks[j].sel);
        if (a && !a.hasAttribute('data-fd-link')) a.setAttribute('data-fd-link', autoLinks[j].step);
      }
      if (unlinked === 'highlight') document.documentElement.setAttribute('data-fd-highlight', '');
    }
    if (mode === 'editor' && selected) {
      var again = q(selected);
      if (again) select(again, false); else select(null, false);
    }
    post({ t: 'applied', notFound: notFound, h: height() });
  }
  function box(color, dashed) {
    var b = document.createElement('div');
    b.setAttribute('data-fd-ui', '');
    b.style.cssText = 'position:absolute;pointer-events:none;z-index:2147483646;border-radius:2px;display:none;' +
      'outline:' + (dashed ? '1px dashed ' : '2px solid ') + color + ';outline-offset:' + (dashed ? '0' : '2px');
    document.documentElement.appendChild(b);
    return b;
  }
  function place(b, el) {
    if (!el) { b.style.display = 'none'; return; }
    var r = el.getBoundingClientRect();
    b.style.display = 'block';
    b.style.left = (r.left + scrollX) + 'px';
    b.style.top = (r.top + scrollY) + 'px';
    b.style.width = r.width + 'px';
    b.style.height = r.height + 'px';
  }
  function select(el, focus) {
    selected = el ? selectorOf(el) : null;
    place(selBox, el);
    if (el) {
      var r = el.getBoundingClientRect();
      selTag.textContent = shortSel(el);
      selTag.style.display = 'block';
      selTag.style.left = (r.left + scrollX - 2) + 'px';
      selTag.style.top = Math.max(0, r.top + scrollY - 24) + 'px';
      if (focus !== false && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
      post({ t: 'select', el: {
        sel: selected, short: shortSel(el), trail: trail(el),
        rect: { x: r.left, y: r.top, w: r.width, h: r.height },
        text: (el.textContent || '').slice(0, 5000), tag: el.tagName.toLowerCase(),
        canvas: el.hasAttribute('data-fd-canvas'), img: el.tagName === 'IMG'
      } });
    } else {
      selTag.style.display = 'none';
      post({ t: 'select', el: null });
    }
  }
  function candidates() {
    return [].slice.call(document.body.querySelectorAll('*')).filter(function (e) {
      if (e.closest('[data-fd-ui]')) return false;
      var r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && /\\S/.test(e.textContent || '') || e.tagName === 'IMG';
    });
  }
  function current() { return selected ? q(selected) : null; }
  function setupEditor() {
    var st = document.createElement('style');
    st.setAttribute('data-fd-ui', '');
    st.textContent = '[data-fd-hidden],[data-fd-removed]{opacity:.35!important;text-decoration:line-through!important}' +
      'a,button,input,select,textarea,label{cursor:default!important}';
    document.head.appendChild(st);
    hoverBox = box(BLUE, true);
    selBox = box(BLUE, false);
    selTag = document.createElement('div');
    selTag.setAttribute('data-fd-ui', '');
    selTag.style.cssText = 'position:absolute;z-index:2147483647;display:none;pointer-events:none;padding:2px 6px;' +
      'border-radius:4px;background:' + BLUE + ';color:#080808;font:600 12px/16px ui-monospace,monospace';
    document.documentElement.appendChild(selTag);
    document.addEventListener('mouseover', function (e) {
      var t = e.target;
      if (t && t.closest && !t.closest('[data-fd-ui]') && t !== document.body) place(hoverBox, t);
    }, true);
    document.addEventListener('mouseleave', function () { place(hoverBox, null); });
    document.addEventListener('keydown', function (e) {
      var cur = current();
      if (e.key === 'Tab') {
        e.preventDefault();
        var list = candidates();
        var i = cur ? list.indexOf(cur) : -1;
        var next = list[(i + (e.shiftKey ? -1 : 1) + list.length) % list.length];
        if (next) select(next);
      } else if (e.key === 'Escape' && cur) {
        e.preventDefault();
        if (cur.parentElement && cur.parentElement !== document.documentElement) select(cur.parentElement);
      } else if (e.key === 'Enter' && cur) {
        e.preventDefault();
        post({ t: 'key', key: 'edit' });
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && cur) {
        e.preventDefault();
        post({ t: 'key', key: 'hide' });
      }
    }, true);
    addEventListener('scroll', function () { var c = current(); if (c) select(c, false); else post({ t: 'scroll' }); }, { passive: true });
  }
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (mode === 'editor') {
      e.preventDefault();
      e.stopPropagation();
      if (!t.closest('[data-fd-ui]')) select(t === document.body ? null : t);
      return;
    }
    var linked = t.closest('[data-fd-link]');
    var actionable = t.closest('a,button,[role=button],[role=link],[role=tab],[role=menuitem],input[type=submit],summary');
    if (actionable || linked) e.preventDefault();
    if (linked) post({ t: 'go', step: linked.getAttribute('data-fd-link') });
    else if (actionable && unlinked !== 'none') post({ t: 'unlinked' });
  }, true);
  document.addEventListener('submit', function (e) { e.preventDefault(); }, true);
  addEventListener('message', function (e) {
    if (e.source !== parentWin) return;
    var m = e.data;
    if (!m || m.fd !== 1 || typeof m.t !== 'string') return;
    if (m.t === 'init') {
      mode = m.mode === 'editor' ? 'editor' : 'player';
      ops = Array.isArray(m.ops) ? m.ops : [];
      autoLinks = Array.isArray(m.autoLinks) ? m.autoLinks : [];
      unlinked = m.unlinked === 'none' || m.unlinked === 'highlight' ? m.unlinked : 'toast';
      if (mode === 'editor' && !hoverBox) setupEditor();
      if (mode === 'player') {
        var hs = document.createElement('style');
        hs.textContent = '[data-fd-highlight] [data-fd-link]{outline:2px solid ' + BLUE + '!important;outline-offset:2px}';
        document.head.appendChild(hs);
      }
      apply();
    } else if (m.t === 'ops') {
      ops = Array.isArray(m.ops) ? m.ops : [];
      apply();
    } else if (m.t === 'select' && mode === 'editor') {
      select(typeof m.sel === 'string' ? q(m.sel) : null);
    } else if (m.t === 'up' && mode === 'editor' && typeof m.n === 'number') {
      var c = current();
      for (var k = 0; c && k < m.n && c.parentElement && c.parentElement !== document.documentElement; k++) c = c.parentElement;
      if (c) select(c);
    }
  });
  post({ t: 'ready', h: height() });
})();`;

let hash: Promise<string> | null = null;
/** Empreinte sha256 du script (CSP script-src). */
export function runtimeHash(): Promise<string> {
  hash ??= crypto.subtle.digest('SHA-256', new TextEncoder().encode(FRAME_RUNTIME)).then((buf) => {
    let bin = '';
    for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
    return `'sha256-${btoa(bin)}'`;
  });
  return hash;
}

/** CSP de la page : rien d'autre que notre script, aucun envoi, aucun cadre, aucune base. */
export function frameCsp(scriptHash: string): string {
  return [
    "default-src 'none'",
    'img-src data: https:',
    "style-src 'unsafe-inline'",
    'font-src data:',
    `script-src ${scriptHash}`,
    "form-action 'none'",
    "base-uri 'none'",
    "frame-src 'none'",
  ].join('; ');
}

/**
 * Document srcdoc : CSP et referrer en tête, notre script en fin de corps. Les balises <script>
 * éventuelles de la page (déjà retirées en amont) sont neutralisées une fois de plus.
 */
export async function buildSrcdoc(html: string): Promise<string> {
  const h = await runtimeHash();
  const head =
    `<meta http-equiv="Content-Security-Policy" content="${frameCsp(h)}">` +
    '<meta name="referrer" content="no-referrer">';
  let doc = html.replace(/<script\b[\s\S]*?<\/script\s*>/gi, '').replace(/<meta[^>]+http-equiv[^>]*>/gi, '');
  // Remplacements par fonction : le script contient « $& », qui serait interprété dans une chaîne
  doc = /<head[^>]*>/i.test(doc) ? doc.replace(/<head([^>]*)>/i, (m) => m + head) : head + doc;
  const script = `<script>${FRAME_RUNTIME}</script>`;
  return /<\/body\s*>/i.test(doc)
    ? doc.replace(/<\/body\s*>(?![\s\S]*<\/body)/i, (m) => script + m)
    : doc + script;
}

/** Attributs de l'iframe (jamais allow-same-origin, ni popups, ni navigation, ni formulaires). */
export const FRAME_SANDBOX = 'allow-scripts';
