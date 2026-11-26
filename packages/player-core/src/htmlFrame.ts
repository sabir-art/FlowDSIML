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
  op: 'text' | 'hide' | 'blur' | 'link' | 'image' | 'remove' | 'style' | 'chart' | 'mask' | 'extlink';
  /** L28-05 : image remplacée, Ajuster (contain, par défaut) ou Remplir (cover). */
  fit?: 'contain' | 'cover';
  /** L25-07 : style posé sur plusieurs éléments. */
  sels?: string[];
  /** Texte, id d'étape ou URL ; L25-07/08 : objet de style ou de graphique (revalidé dans la page). */
  value?: string | FrameStyle | FrameChart;
}
export interface FrameStyle {
  color?: string;
  background?: string;
  fontSize?: number;
  fontWeight?: '400' | '600' | '700';
}
export interface FrameChart {
  type: 'bar' | 'line' | 'donut';
  rows: Array<{ label: string; value: number }>;
  title?: string;
}
/** L25-08 : graphique reconnu dans la page (conteneur, type, valeurs lues, titre). */
export interface DetectedChart extends FrameChart {
  sel: string;
  title: string;
}
/** L25-07 : élément d'une sélection multiple (fond effectif et couleur du texte, pour le contraste). */
export interface MultiEl {
  sel: string;
  short: string;
  bg: string;
  color: string;
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
  /** L25-07 : « Sélectionner les semblables » ; vider la sélection multiple. */
  | { fd: 1; t: 'similar' }
  | { fd: 1; t: 'multi-clear' }
  /** Éditeur : sélectionne le n-ième parent de l'élément sélectionné (fil du sélecteur). */
  | { fd: 1; t: 'up'; n: number }
  /**
   * A8 guide du Sandbox : zone visée par la bulle courante (null : aucune). Le sélecteur unique prime ;
   * sinon le rect (0..1 de la fenêtre capturée, au défilement 0) sert de secours.
   */
  | { fd: 1; t: 'target'; sel: string | null; rect: { x: number; y: number; w: number; h: number } | null }
  | { fd: 1; t: 'target'; clear: true }
  /** A8 guide, éditeur : vérifie le sélecteur d'une bulle et sélectionne l'élément s'il est unique. */
  | { fd: 1; t: 'probe'; sel: string }
  /**
   * EXT-02 §3 : zones cliquables de la page (liens vers une étape, liens externes autorisés). show : cadres
   * affichés ou non ; flash : affichés 1,2 s (clic à côté d'une zone) ; dark : couleurs du thème sombre.
   */
  | { fd: 1; t: 'zones'; show?: boolean; flash?: true; dark?: boolean };

export interface Selected {
  sel: string;
  short: string;
  trail: string[];
  rect: { x: number; y: number; w: number; h: number };
  text: string;
  tag: string;
  canvas: boolean;
  img: boolean;
  /** L25-07 : éléments du même sélecteur court sur la page ; fond effectif et couleur du texte. */
  similar: number;
  bg: string;
  color: string;
  /** L25-08 : graphique reconnu (l'élément ou un parent proche). */
  chart: DetectedChart | null;
}

export type FromFrame =
  | { fd: 1; t: 'ready'; h: number }
  | { fd: 1; t: 'applied'; notFound: string[]; h: number }
  | { fd: 1; t: 'go'; step: string }
  /**
   * Clic hors d'une zone cliquable. ext : lien externe désactivé (« Ce lien mène hors de la démo. ») ;
   * empty : clic dans le vide (ni lien ni bouton de la page d'origine).
   */
  | { fd: 1; t: 'unlinked'; ext?: true; empty?: true }
  /** EXT-02 §3 : nombre de zones cliquables de la page, après chaque application des opérations. */
  | { fd: 1; t: 'zones'; n: number }
  /** EXT-02 §3.1 : touche H pressée dans la page (bascule « Zones cliquables »). */
  | { fd: 1; t: 'zones-key' }
  /** L49 §4 : lien externe autorisé ; le lecteur retrouve l'adresse par l'id de l'opération. */
  | { fd: 1; t: 'ext'; id: string }
  | { fd: 1; t: 'select'; el: Selected | null }
  | { fd: 1; t: 'multi'; els: MultiEl[] }
  | { fd: 1; t: 'key'; key: 'edit' | 'hide' }
  | { fd: 1; t: 'scroll' }
  /** A8 guide : position de l'élément visé, en px de la fenêtre de la page ; found : sélecteur trouvé. */
  | { fd: 1; t: 'target'; rect: { x: number; y: number; w: number; h: number }; found: boolean }
  /** A8 guide : clic du visiteur dans la zone visée. */
  | { fd: 1; t: 'hit' }
  /** A8 guide, éditeur : le sélecteur d'une bulle désigne-t-il un seul élément de la page ? */
  | { fd: 1; t: 'probe'; ok: boolean }
  /**
   * Sandbox v2 (liveFrame) : navigation demandée par la page (lien, location, envoi de formulaire) ; le
   * lecteur affiche la page capturée de même adresse. L'adresse vient de la page : elle ne sert qu'à
   * choisir une étape, jamais à ouvrir quoi que ce soit.
   */
  | { fd: 1; t: 'nav'; url: string }
  /** Sandbox v2 : changement de route d'une application à page unique (history virtuel). */
  | { fd: 1; t: 'route'; url: string }
  /** Sandbox v2 : réponses rejouées, non rejouées, écritures fictives (mesure de fidélité). */
  | { fd: 1; t: 'live'; replayed: number; unreplayed: number; writes: number };

const STEP_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
const HEX = /^#[0-9A-Fa-f]{6}$/;
const hex = (v: unknown) => typeof v === 'string' && HEX.test(v);

function parseChart(v: unknown): DetectedChart | null {
  if (!v || typeof v !== 'object') return null;
  const c = v as Record<string, unknown>;
  if (!str(c.sel, 500) || !str(c.title, 120) || !['bar', 'line', 'donut'].includes(c.type as string))
    return null;
  if (!Array.isArray(c.rows) || c.rows.length < 1 || c.rows.length > 12) return null;
  const rows: DetectedChart['rows'] = [];
  for (const r of c.rows as unknown[]) {
    const o = r as Record<string, unknown> | null;
    if (!o || !str(o.label, 40) || !num(o.value)) return null;
    rows.push({ label: o.label as string, value: o.value as number });
  }
  return { sel: c.sel as string, type: c.type as DetectedChart['type'], rows, title: c.title as string };
}

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
    case 'nav':
    case 'route':
      return str(m.url, 2000) && /^https?:\/\//.test(m.url as string)
        ? { fd: 1, t: m.t, url: m.url as string }
        : null;
    case 'live':
      return num(m.replayed) && num(m.unreplayed) && num(m.writes)
        ? {
            fd: 1,
            t: 'live',
            replayed: m.replayed as number,
            unreplayed: m.unreplayed as number,
            writes: m.writes as number,
          }
        : null;
    case 'unlinked':
      return m.ext === true
        ? { fd: 1, t: 'unlinked', ext: true }
        : m.empty === true
          ? { fd: 1, t: 'unlinked', empty: true }
          : { fd: 1, t: 'unlinked' };
    case 'zones-key':
      return { fd: 1, t: 'zones-key' };
    case 'zones':
      return num(m.n) && Number.isInteger(m.n) && (m.n as number) >= 0 && (m.n as number) <= 5000
        ? { fd: 1, t: 'zones', n: m.n as number }
        : null;
    case 'ext':
      return typeof m.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(m.id)
        ? { fd: 1, t: 'ext', id: m.id }
        : null;
    case 'scroll':
      return { fd: 1, t: 'scroll' };
    case 'target': {
      const r = m.rect as Record<string, unknown> | undefined;
      if (!r || !num(r.x) || !num(r.y) || !num(r.w) || !num(r.h) || typeof m.found !== 'boolean') return null;
      return {
        fd: 1,
        t: 'target',
        rect: { x: r.x as number, y: r.y as number, w: r.w as number, h: r.h as number },
        found: m.found,
      };
    }
    case 'hit':
      return { fd: 1, t: 'hit' };
    case 'probe':
      return { fd: 1, t: 'probe', ok: m.ok === true };
    case 'key':
      return m.key === 'edit' || m.key === 'hide' ? { fd: 1, t: 'key', key: m.key } : null;
    case 'multi': {
      if (!Array.isArray(m.els) || m.els.length > 200) return null;
      const els: MultiEl[] = [];
      for (const x of m.els as unknown[]) {
        const e = x as Record<string, unknown> | null;
        if (!e || !str(e.sel, 500) || !str(e.short, 120) || !hex(e.bg) || !hex(e.color)) return null;
        els.push({
          sel: e.sel as string,
          short: e.short as string,
          bg: e.bg as string,
          color: e.color as string,
        });
      }
      return { fd: 1, t: 'multi', els };
    }
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
          similar: num(e.similar) ? Math.max(0, Math.min(200, e.similar as number)) : 1,
          bg: hex(e.bg) ? (e.bg as string) : '#FFFFFF',
          color: hex(e.color) ? (e.color as string) : '#000000',
          chart: e.chart == null ? null : parseChart(e.chart),
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
  // Sandbox v2 (liveFrame) : les scripts de la page s'exécutent ; boutons et envois gardent leur effet
  var live = window.__fdLive === true;
  var mode = 'player';
  var ops = [];
  var autoLinks = [];
  var unlinked = 'toast';
  var original = null;
  var selected = null;
  var hoverBox = null, selBox = null, selTag = null;
  var BLUE = '#2897D5';
  var multi = [], multiBoxes = [];
  var target = null;
  // EXT-02 §3 : zones cliquables (cadres bleus numérotés par-dessus la page, jamais dans son contenu)
  var zonesOn = false, zonesDark = false, zoneLayer = null, zoneTimer = 0;
  var HEXRE = /^#[0-9A-Fa-f]{6}$/;
  var SVGNS = 'http://www.w3.org/2000/svg';
  function post(m) { m.fd = 1; parentWin.postMessage(m, '*'); }
  function zoneEls() {
    var out = [], all = document.querySelectorAll('[data-fd-link],[data-fd-ext]');
    for (var i = 0; i < all.length; i++) {
      var b = all[i].getBoundingClientRect();
      if (b.width > 0 && b.height > 0 && !all[i].closest('[data-fd-ui]')) out.push(all[i]);
    }
    return out;
  }
  function drawZones() {
    if (zoneLayer) { zoneLayer.remove(); zoneLayer = null; }
    if (mode !== 'player' || (!zonesOn && !zoneTimer)) return;
    var blue = zonesDark ? '#7FA8FF' : '#2F6FED';
    var soft = zonesDark ? 'rgba(127,168,255,.20)' : 'rgba(47,111,237,.16)';
    zoneLayer = document.createElement('div');
    zoneLayer.setAttribute('data-fd-ui', '');
    zoneLayer.setAttribute('data-fd-zones', '');
    zoneLayer.setAttribute('aria-hidden', 'true');
    zoneLayer.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;z-index:2147483646;pointer-events:none';
    var els = zoneEls();
    for (var i = 0; i < els.length; i++) {
      var b = els[i].getBoundingClientRect();
      var z = document.createElement('div');
      z.style.cssText = 'position:absolute;box-sizing:border-box;border:2px solid ' + blue + ';border-radius:8px;background:' + soft +
        ';left:' + (b.left + scrollX - 2) + 'px;top:' + (b.top + scrollY - 2) + 'px;width:' + (b.width + 4) + 'px;height:' + (b.height + 4) + 'px';
      var nb = document.createElement('span');
      nb.textContent = String(i + 1);
      nb.style.cssText = 'position:absolute;top:-12px;left:-2px;padding:0 6px;border-radius:6px;background:' + blue + ';color:' +
        (zonesDark ? '#0b0f14' : '#fff') + ';font:700 12px/20px system-ui,sans-serif';
      z.appendChild(nb);
      zoneLayer.appendChild(z);
    }
    document.body.appendChild(zoneLayer);
  }
  function flashZones() {
    clearTimeout(zoneTimer);
    zoneTimer = setTimeout(function () { zoneTimer = 0; drawZones(); }, 1200);
    drawZones();
  }
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
  function toHex(c) {
    var m = /rgba?\\(([0-9.]+),\\s*([0-9.]+),\\s*([0-9.]+)(?:,\\s*([0-9.]+))?/.exec(c || '');
    if (!m || (m[4] !== undefined && parseFloat(m[4]) === 0)) return null;
    return '#' + [m[1], m[2], m[3]].map(function (x) { var h = Math.round(parseFloat(x)).toString(16); return h.length < 2 ? '0' + h : h; }).join('').toUpperCase();
  }
  function bgOf(el) {
    for (var c = el; c && c.nodeType === 1; c = c.parentElement) { var h = toHex(getComputedStyle(c).backgroundColor); if (h) return h; }
    return '#FFFFFF';
  }
  function colorOf(el) { return toHex(getComputedStyle(el).color) || '#000000'; }
  // L25-07 : propriétés de la liste blanche seulement, revalidées ici (jamais de chaîne CSS libre)
  function applyStyle(el, v) {
    if (!v || typeof v !== 'object') return;
    if (typeof v.color === 'string' && HEXRE.test(v.color)) el.style.setProperty('color', v.color);
    if (typeof v.background === 'string' && HEXRE.test(v.background)) el.style.setProperty('background-color', v.background);
    if (typeof v.fontSize === 'number' && v.fontSize >= 8 && v.fontSize <= 96) el.style.setProperty('font-size', Math.round(v.fontSize) + 'px');
    if (v.fontWeight === '400' || v.fontWeight === '600' || v.fontWeight === '700') el.style.setProperty('font-weight', v.fontWeight);
  }
  // L25-08 : lecture d'un graphique simple (SVG rect/path/circle avec texte de valeur, ou barres HTML)
  function numOf(s) {
    var t = String(s || '').replace(/[\\s\\u00a0\\u202f]/g, '').replace(',', '.').replace(/%$/, '');
    return /^-?[0-9]+(\\.[0-9]+)?$/.test(t) ? parseFloat(t) : null;
  }
  function leaves(c) {
    var out = [], w = document.createTreeWalker(c, 4);
    for (var n = w.nextNode(); n; n = w.nextNode()) { var v = (n.nodeValue || '').trim(); if (v) out.push(v); }
    return out;
  }
  function chartTitle(c) {
    var drawn = c.closest && c.closest('[data-fd-title]');
    if (drawn) return (drawn.getAttribute('data-fd-title') || '').slice(0, 120);
    var a = c.getAttribute('aria-label');
    if (a) return a.slice(0, 120);
    for (var p = c, k = 0; p && k < 3; p = p.parentElement, k++) {
      for (var s = p.previousElementSibling; s; s = s.previousElementSibling) {
        if (/^H[1-6]$/.test(s.tagName) || /title|titre/i.test(s.className || '')) return (s.textContent || '').trim().slice(0, 120);
      }
      var h = p.parentElement && p.parentElement.querySelector('h1,h2,h3,h4,h5,h6,figcaption');
      if (h && !c.contains(h)) return (h.textContent || '').trim().slice(0, 120);
    }
    return '';
  }
  function readChart(c) {
    if (c.querySelector && c.querySelector('canvas')) return null;
    // SVG : l'élément lui-même ou son unique enfant direct (jamais un SVG plus profond de la page)
    var direct = [].slice.call(c.children).filter(function (x) { return x.tagName.toLowerCase() === 'svg'; });
    var svg = c.tagName.toLowerCase() === 'svg' ? c : (direct.length === 1 ? direct[0] : null);
    var rows = [], type = null, target = c;
    if (svg) {
      var texts = [].slice.call(svg.querySelectorAll('text')).map(function (t) { return (t.textContent || '').trim(); }).filter(Boolean);
      var nums = texts.filter(function (t) { return numOf(t) !== null; }), labels = texts.filter(function (t) { return numOf(t) === null; });
      if (nums.length < 2) return null;
      var vb = svg.getBoundingClientRect();
      var rects = [].slice.call(svg.querySelectorAll('rect')).filter(function (r) { var b = r.getBoundingClientRect(); return b.height > 0 && b.width < vb.width * 0.9; });
      var arcs = [].slice.call(svg.querySelectorAll('path')).filter(function (p) { return /[Aa]/.test(p.getAttribute('d') || ''); });
      if (svg.querySelector('circle[stroke-dasharray]') || arcs.length >= 2) type = 'donut';
      else if (rects.length >= 2) type = 'bar';
      else if (svg.querySelector('polyline,path')) type = 'line';
      else return null;
      for (var i = 0; i < nums.length && i < 12; i++) rows.push({ label: (labels[i] || '').slice(0, 40), value: numOf(nums[i]) });
      target = svg;
    } else {
      var kids = [].slice.call(c.children);
      if (kids.length < 2 || kids.length > 12) return null;
      for (var j = 0; j < kids.length; j++) {
        var k = kids[j], lv = leaves(k);
        var n = lv.filter(function (t) { return numOf(t) !== null; }), l = lv.filter(function (t) { return numOf(t) === null; });
        var bar = (k.getAttribute('style') || '').indexOf('height') >= 0 || k.querySelector('[style*="height"]');
        if (n.length !== 1 || l.length !== 1 || !bar) return null;
        rows.push({ label: l[0].slice(0, 40), value: numOf(n[0]) });
      }
      type = 'bar';
    }
    return { sel: selectorOf(target), type: type, rows: rows, title: chartTitle(target) };
  }
  function chartOf(el) {
    // Graphique déjà redessiné : son conteneur reste la cible (même sélecteur que l'opération)
    var drawn = el.closest && el.closest('[data-fd-chart]');
    if (drawn) { var d = readChart(drawn); if (d) { d.sel = selectorOf(drawn); return d; } }
    for (var c = el, k = 0; c && k < 4 && c !== document.body && c !== document.documentElement; c = c.parentElement, k++) {
      var r = readChart(c);
      if (r) return r;
    }
    return null;
  }
  function chartColors(el) {
    var out = [];
    var marks = el.querySelectorAll('rect,path,circle,polyline,[style*="background"]');
    for (var i = 0; i < marks.length && out.length < 6; i++) {
      var cs = getComputedStyle(marks[i]);
      var c = marks[i] instanceof SVGElement ? (toHex(cs.fill) || toHex(cs.stroke)) : toHex(cs.backgroundColor);
      if (c && c !== '#FFFFFF' && out.indexOf(c) < 0) out.push(c);
    }
    return out.concat(['#2897D5', '#0B6B62', '#D60B52', '#6B7280', '#B45309', '#7C3AED']);
  }
  function svgEl(tag, attrs, text) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) e.setAttribute(k, String(attrs[k]));
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function fmt(v) { try { return new Intl.NumberFormat(document.documentElement.lang || 'fr-FR').format(v); } catch (e) { return String(v); } }
  // L25-08 : graphique redessiné avec les couleurs de la capture ; valeurs toujours écrites ; role=img
  function drawChart(el, v) {
    if (!v || typeof v !== 'object' || ['bar', 'line', 'donut'].indexOf(v.type) < 0 || !Array.isArray(v.rows)) return;
    var rows = v.rows.filter(function (r) { return r && typeof r.label === 'string' && typeof r.value === 'number' && isFinite(r.value); }).slice(0, 12);
    if (!rows.length) return;
    var colors = chartColors(el), ink = colorOf(el);
    var b = el.getBoundingClientRect();
    var W = Math.max(160, Math.round(b.width) || 320), H = Math.max(120, Math.round(b.height) || 180);
    var title = typeof v.title === 'string' ? v.title.slice(0, 120) : '';
    var svg = el.tagName.toLowerCase() === 'svg' ? el : null;
    while (el.firstChild) el.removeChild(el.firstChild);
    if (!svg) { svg = svgEl('svg', { width: '100%', height: H }); el.appendChild(svg); svg.setAttribute('aria-hidden', 'true'); }
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', (title ? title + ' : ' : '') + rows.map(function (r) { return r.label + ' ' + fmt(r.value); }).join(', '));
    el.setAttribute('data-fd-chart', v.type);
    el.setAttribute('data-fd-title', title);
    var font = { 'font-size': 12, 'font-family': 'inherit', fill: ink, 'text-anchor': 'middle' };
    function text(x, y, t, extra) { var a = {}; for (var k in font) a[k] = font[k]; for (var k2 in extra || {}) a[k2] = extra[k2]; a.x = x; a.y = y; svg.appendChild(svgEl('text', a, t)); }
    var max = Math.max.apply(null, rows.map(function (r) { return Math.abs(r.value); }).concat([1]));
    var top = 20, bottom = H - 20, step = W / rows.length;
    if (v.type === 'bar') {
      rows.forEach(function (r, i) {
        var h = Math.max(1, (bottom - top) * Math.abs(r.value) / max), bw = step * 0.56, x = i * step + (step - bw) / 2;
        svg.appendChild(svgEl('rect', { x: x, y: bottom - h, width: bw, height: h, rx: 3, fill: colors[0] }));
        text(x + bw / 2, bottom - h - 5, fmt(r.value), { 'font-weight': 600 });
        text(x + bw / 2, H - 5, r.label);
      });
    } else if (v.type === 'line') {
      var pts = rows.map(function (r, i) { return [i * step + step / 2, bottom - (bottom - top - 6) * r.value / max]; });
      svg.appendChild(svgEl('polyline', { points: pts.map(function (p) { return p.join(','); }).join(' '), fill: 'none', stroke: colors[0], 'stroke-width': 2 }));
      pts.forEach(function (p, i) {
        svg.appendChild(svgEl('circle', { cx: p[0], cy: p[1], r: 4, fill: colors[0], stroke: '#FFFFFF', 'stroke-width': 2 }));
        text(p[0], p[1] - 8, fmt(rows[i].value), { 'font-weight': 600 });
        text(p[0], H - 5, rows[i].label);
      });
    } else {
      var total = rows.reduce(function (a, r) { return a + Math.max(0, r.value); }, 0) || 1;
      var R = Math.min(H, W / 2) / 2 - 12, cx = R + 12, cy = H / 2, C = 2 * Math.PI * R, acc = 0;
      rows.forEach(function (r, i) {
        var len = C * Math.max(0, r.value) / total;
        svg.appendChild(svgEl('circle', { cx: cx, cy: cy, r: R, fill: 'none', stroke: colors[i % colors.length], 'stroke-width': 16,
          'stroke-dasharray': Math.max(0, len - 2) + ' ' + C, 'stroke-dashoffset': -acc, transform: 'rotate(-90 ' + cx + ' ' + cy + ')' }));
        acc += len;
        var ly = 16 + i * 18, lx = cx + R + 24;
        svg.appendChild(svgEl('rect', { x: lx, y: ly - 9, width: 10, height: 10, rx: 2, fill: colors[i % colors.length] }));
        text(lx + 16, ly, r.label, { 'text-anchor': 'start' });
        text(W - 6, ly, fmt(r.value), { 'text-anchor': 'end', 'font-weight': 600 });
      });
    }
  }
  function sameShort(el) {
    var s = shortSel(el);
    return candidates().filter(function (e) { return shortSel(e) === s; });
  }
  function postMulti() {
    multiBoxes.forEach(function (b) { b.remove(); });
    multiBoxes = [];
    var els = [];
    for (var i = 0; i < multi.length; i++) {
      var e = q(multi[i]);
      if (!e) continue;
      var b = box(BLUE, false); place(b, e); multiBoxes.push(b);
      els.push({ sel: multi[i], short: shortSel(e), bg: bgOf(e), color: colorOf(e) });
    }
    if (multi.length) place(selBox, null);
    post({ t: 'multi', els: els });
  }
  function toggleMulti(el, keyboard) {
    if (!el) return;
    // Souris : l'élément déjà sélectionné ouvre la sélection ; clavier : l'élément focalisé s'ajoute
    if (keyboard && !multi.length) { multi = [selectorOf(el)]; postMulti(); return; }
    if (!multi.length && selected) multi = [selected];
    var s = selectorOf(el), i = multi.indexOf(s);
    if (i >= 0) multi.splice(i, 1); else if (multi.length < 200) multi.push(s);
    if (multi.length === 1) { var only = q(multi[0]); multi = []; postMulti(); select(only); return; }
    postMulti();
  }
  // L28-05 : l'image remplacée ou masquée garde la taille de l'élément d'origine
  var BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  function keepSize(el) { var r = el.getBoundingClientRect(); if (r.width && r.height) { el.style.width = r.width + 'px'; el.style.height = r.height + 'px'; } }
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
      if (o.op === 'style') {
        var sels = Array.isArray(o.sels) ? o.sels.slice(0, 200) : [o.sel], hit = false;
        for (var si = 0; si < sels.length; si++) { var se = q(sels[si]); if (se) { applyStyle(se, o.value); hit = true; } }
        if (!hit) notFound.push(o.id);
        continue;
      }
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
      else if (o.op === 'image' && el.tagName === 'IMG' && safeImg(o.value)) { keepSize(el); el.style.objectFit = o.fit === 'cover' ? 'cover' : 'contain'; el.setAttribute('src', o.value); el.removeAttribute('srcset'); }
      else if (o.op === 'mask' && el.tagName === 'IMG') { keepSize(el); el.style.backgroundColor = bgOf(el.parentElement || el); el.setAttribute('src', BLANK); el.removeAttribute('srcset'); el.setAttribute('alt', ''); el.setAttribute('data-fd-masked', ''); }
      else if (o.op === 'chart') drawChart(el, o.value);
      else if (o.op === 'extlink' && el.getAttribute('data-tc-ext') === 'off') el.setAttribute('data-fd-ext', String(o.id));
    }
    if (mode === 'player') {
      for (var j = 0; j < autoLinks.length; j++) {
        var a = q(autoLinks[j].sel);
        if (a && !a.hasAttribute('data-fd-link')) a.setAttribute('data-fd-link', autoLinks[j].step);
      }
      if (unlinked === 'highlight') document.documentElement.setAttribute('data-fd-highlight', '');
      post({ t: 'zones', n: zoneEls().length });
      drawZones();
    }
    if (mode === 'editor' && multi.length) postMulti();
    else if (mode === 'editor' && selected) {
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
    // L25-08 : un clic dans un graphique reconnu sélectionne le graphique entier
    var chart = el ? chartOf(el) : null;
    if (chart) { var tgt = q(chart.sel); if (tgt) el = tgt; }
    selected = el ? selectorOf(el) : null;
    place(selBox, el);
    if (el) {
      var r = el.getBoundingClientRect();
      selTag.textContent = shortSel(el);
      // L20-01 : l'étiquette du sélecteur est affichée dans la barre d'actions de l'éditeur (hors de la
      // page) : elle ne masque plus de texte de la capture
      selTag.style.display = 'none';
      if (focus !== false && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
      post({ t: 'select', el: {
        sel: selected, short: shortSel(el), trail: trail(el),
        rect: { x: r.left, y: r.top, w: r.width, h: r.height },
        text: (el.textContent || '').slice(0, 5000), tag: el.tagName.toLowerCase(),
        canvas: el.hasAttribute('data-fd-canvas'), img: el.tagName === 'IMG',
        similar: Math.min(200, sameShort(el).length), bg: bgOf(el), color: colorOf(el), chart: chart
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
      } else if (e.key === 'Enter' && e.shiftKey && cur) {
        e.preventDefault();
        toggleMulti(cur, true);
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
  // L25-07 : Maj + clic ne sélectionne pas de texte dans la page (sélection multiple seulement)
  document.addEventListener('mousedown', function (e) {
    if (mode === 'editor' && e.shiftKey) e.preventDefault();
  }, true);
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (mode === 'editor') {
      e.preventDefault();
      e.stopPropagation();
      if (t.closest('[data-fd-ui]')) return;
      // L25-07 : Maj + clic ajoute ou retire l'élément de la sélection multiple
      if (e.shiftKey && t !== document.body) { toggleMulti(t); return; }
      if (multi.length) { multi = []; postMulti(); }
      select(t === document.body ? null : t);
      return;
    }
    // A8 guide : avant les liens, le guide avance ; la navigation se fait ensuite comme d'habitude
    // Un clic qui fait avancer le guide n'affiche pas « non disponible »
    var hit = !!target && inTarget(e);
    if (hit) post({ t: 'hit' });
    var linked = t.closest('[data-fd-link]');
    var ext = t.closest('[data-tc-ext]');
    var actionable = t.closest('a,button,[role=button],[role=link],[role=tab],[role=menuitem],input[type=submit],summary');
    if ((actionable && !live) || linked || ext) e.preventDefault();
    if (linked) post({ t: 'go', step: linked.getAttribute('data-fd-link') });
    // L49 §4 : lien externe autorisé (le lecteur demande confirmation) ou désactivé
    else if (ext && ext.hasAttribute('data-fd-ext')) post({ t: 'ext', id: ext.getAttribute('data-fd-ext') });
    // L49 §4.1 : lien signalé par Safe Browsing (data-tc-ext="blocked") : rien ne se passe
    else if (ext) { if (ext.getAttribute('data-tc-ext') === 'off' && unlinked !== 'none' && !hit) post({ t: 'unlinked', ext: true }); }
    // EXT-02 §3.2 : clic à côté d'une zone (bouton ou lien non relié, ou dans le vide) : les zones
    // s'illuminent un instant et le lecteur dit combien la page en compte
    else if (!live && unlinked !== 'none' && !hit && !t.closest('[data-fd-ui]')) {
      flashZones();
      post(actionable ? { t: 'unlinked' } : { t: 'unlinked', empty: true });
    }
  }, true);
  document.addEventListener('submit', function (e) { if (!live) e.preventDefault(); }, true);
  // EXT-02 §3.1 : la touche H bascule les zones cliquables, y compris quand le focus est dans la page
  document.addEventListener('keydown', function (e) {
    if (mode !== 'player' || e.ctrlKey || e.metaKey || e.altKey || (e.key !== 'h' && e.key !== 'H')) return;
    var k = e.target;
    if (k && (k.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(k.tagName))) return;
    post({ t: 'zones-key' });
  });
  // A8 guide : la zone visée suit le défilement et la taille de la page
  function targetEl() { return target && target.sel && unique(target.sel) ? q(target.sel) : null; }
  function targetBox() {
    var el = targetEl();
    if (el) { var b = el.getBoundingClientRect(); return { r: { x: b.left, y: b.top, w: b.width, h: b.height }, found: true }; }
    if (!target || !target.rect) return null;
    var W = document.documentElement.clientWidth, H = innerHeight, k = target.rect;
    return { r: { x: k.x * W - scrollX, y: k.y * H - scrollY, w: k.w * W, h: k.h * H }, found: false };
  }
  function postTarget() { var t = mode === 'player' && targetBox(); if (t) post({ t: 'target', rect: t.r, found: t.found }); }
  function inTarget(e) {
    var el = targetEl();
    if (el) return el.contains(e.target);
    var t = targetBox();
    return !!t && e.clientX >= t.r.x && e.clientX <= t.r.x + t.r.w && e.clientY >= t.r.y && e.clientY <= t.r.y + t.r.h;
  }
  addEventListener('scroll', function () { if (target) postTarget(); }, { passive: true });
  addEventListener('resize', function () { if (target) postTarget(); drawZones(); });

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
    } else if (m.t === 'zones' && mode === 'player') {
      if (typeof m.dark === 'boolean') zonesDark = m.dark;
      if (typeof m.show === 'boolean') zonesOn = m.show;
      if (m.flash === true) flashZones(); else drawZones();
    } else if (m.t === 'ops') {
      ops = Array.isArray(m.ops) ? m.ops : [];
      apply();
    } else if (m.t === 'select' && mode === 'editor') {
      select(typeof m.sel === 'string' ? q(m.sel) : null);
    } else if (m.t === 'similar' && mode === 'editor') {
      var base = current() || (multi.length ? q(multi[0]) : null);
      if (base) { multi = sameShort(base).slice(0, 200).map(selectorOf); if (multi.length < 2) { multi = []; select(base); } else postMulti(); }
    } else if (m.t === 'multi-clear' && mode === 'editor') {
      var keep = multi.length ? q(multi[0]) : null;
      multi = []; postMulti(); select(keep);
    } else if (m.t === 'target' && mode === 'player') {
      var okRect = m.rect && ['x', 'y', 'w', 'h'].every(function (k) { return typeof m.rect[k] === 'number' && isFinite(m.rect[k]); });
      target = m.clear || (!m.sel && !okRect) ? null : { sel: typeof m.sel === 'string' ? m.sel.slice(0, 500) : null, rect: okRect ? m.rect : null };
      var te = targetEl();
      if (te) {
        var tb = te.getBoundingClientRect();
        if (tb.top < 0 || tb.bottom > innerHeight || tb.left < 0 || tb.right > document.documentElement.clientWidth)
          te.scrollIntoView({ block: 'center', inline: 'nearest' });
      }
      postTarget();
    } else if (m.t === 'probe' && mode === 'editor') {
      var ps = typeof m.sel === 'string' ? m.sel.slice(0, 500) : '';
      var found = !!ps && unique(ps);
      if (found) select(q(ps));
      post({ t: 'probe', ok: found });
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

/**
 * Lot B (recette UX) : vignette d'une page HTML dans la liste des étapes. Même CSP que la page, mais
 * aucun script, pas même le nôtre ; l'iframe qui l'affiche est en sandbox vide.
 */
export function thumbSrcdoc(html: string): string {
  const head =
    `<meta http-equiv="Content-Security-Policy" content="${frameCsp("'none'")}">` +
    '<meta name="referrer" content="no-referrer">';
  const doc = html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<meta[^>]+http-equiv[^>]*>/gi, '');
  return /<head[^>]*>/i.test(doc) ? doc.replace(/<head([^>]*)>/i, (m) => m + head) : head + doc;
}

/** Attributs de l'iframe (jamais allow-same-origin, ni popups, ni navigation, ni formulaires). */
export const FRAME_SANDBOX = 'allow-scripts';
