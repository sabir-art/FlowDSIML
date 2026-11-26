/**
 * Sandbox v2, étape 2 (docs/tech/sandbox-v2.md §3.4 et §3.5) : lecture « vivante » d'une page capturée.
 * Les scripts gardés de la page s'exécutent, mais dans une boîte sans aucune sortie :
 *  - réseau : fetch / XHR en GET rejouent les réponses enregistrées (clé : méthode + adresse normalisée,
 *    paramètres triés) ; un GET non enregistré reçoit 404 vide (« non rejoué ») ; toute écriture
 *    (POST, PUT, PATCH, DELETE) reçoit un succès fictif et rien n'est transmis ; WebSocket, EventSource
 *    et sendBeacon sont inertes ;
 *  - stockage : localStorage, sessionStorage et document.cookie en mémoire, propres à la visite de la
 *    page ; indexedDB absent ;
 *  - navigation : history et location sont virtuels (adresse d'origine de la page) ; un lien, une
 *    affectation de location ou un envoi de formulaire est transmis au lecteur ({ t: 'nav', url }), qui
 *    affiche la page capturée correspondante.
 * La CSP n'autorise que des scripts écrits dans le document et désignés par leur empreinte (le nôtre, celui
 * du cadre, ceux que l'auteur a gardés) : aucune adresse, aucun eval, connect-src 'none', images, polices
 * et styles en data: ou dans la page seulement. L'iframe garde sandbox="allow-scripts" (origine opaque).
 * Le mode inerte (htmlFrame.buildSrcdoc) reste le défaut et n'est pas modifié par ce module.
 */
import { FRAME_RUNTIME, runtimeHash } from './htmlFrame';

/** Script de la page. Dans le HTML, sa place est marquée par <script data-fd-script="id"></script>. */
export interface LiveScript {
  id: string;
  /** Code du script (écrit dans la page, ou téléchargé à la capture). */
  code: string;
  /** Gardé par l'auteur : exécuté. Bloqué : retiré du document, mais toujours rétablissable. */
  keep: boolean;
  module?: boolean;
  /** Origine affichée (« page », adresse d'un tiers), catégorie (§3.3). */
  source?: string;
  category?: 'page' | 'third' | 'tracking';
}

/** Réponse GET enregistrée pendant la capture. */
export interface LiveResponse {
  method?: string;
  url: string;
  status: number;
  type: string;
  body: string;
}

export interface LivePage {
  /** Adresse d'origine de la page (location virtuelle). */
  url: string;
  /** Document, scripts remplacés par leurs marques. */
  html: string;
  scripts: LiveScript[];
  responses: LiveResponse[];
}

/** Statistiques envoyées par la page au lecteur ({ fd: 1, t: 'live', ... }). */
export interface LiveStats {
  replayed: number;
  unreplayed: number;
  writes: number;
}

/**
 * Environnement factice, exécuté avant tout script de la page. ES5 et aucune dépendance : il est écrit
 * tel quel dans le document et désigné par son empreinte dans la CSP.
 */
export const LIVE_SHIM = `(function () {
  'use strict';
  var W = window, P = W.parent, D;
  try { D = JSON.parse(document.getElementById('fd-replay').textContent); } catch (e) { D = { url: 'https://page.invalid/', responses: [] }; }
  W.__fdLive = true;
  var stats = { replayed: 0, unreplayed: 0, writes: 0 }, statsTimer = 0;
  function post(m) { m.fd = 1; P.postMessage(m, '*'); }
  function report() { clearTimeout(statsTimer); statsTimer = setTimeout(function () { post({ t: 'live', replayed: stats.replayed, unreplayed: stats.unreplayed, writes: stats.writes }); }, 50); }
  var here = new URL(D.url);
  function abs(u) { try { return new URL(String(u), here.href); } catch (e) { return null; } }
  function key(method, u) {
    var x = abs(u);
    if (!x) return '';
    x.hash = '';
    var ps = [];
    x.searchParams.forEach(function (v, k) { ps.push([k, v]); });
    ps.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0; });
    x.search = '';
    ps.forEach(function (p) { x.searchParams.append(p[0], p[1]); });
    return String(method || 'GET').toUpperCase() + ' ' + x.href;
  }
  var table = {};
  (D.responses || []).forEach(function (r) { table[key(r.method || 'GET', r.url)] = r; });
  /** Réponse de la boîte : enregistrée, 404 vide, ou succès fictif d'une écriture. */
  function answer(method, u) {
    var m = String(method || 'GET').toUpperCase();
    if (m === 'GET' || m === 'HEAD') {
      var r = table[key('GET', u)];
      if (r) { stats.replayed++; report(); return { status: r.status, type: r.type, body: m === 'HEAD' ? '' : r.body }; }
      stats.unreplayed++; report();
      return { status: 404, type: 'text/plain', body: '' };
    }
    stats.writes++; report();
    return m === 'DELETE' ? { status: 204, type: 'text/plain', body: '' } : { status: 200, type: 'application/json', body: '{}' };
  }

  // ----- Réseau -----
  W.fetch = function (input, init) {
    var u = typeof input === 'string' || input instanceof URL ? String(input) : input && input.url;
    var m = (init && init.method) || (input && typeof input === 'object' && input.method) || 'GET';
    var a = answer(m, u);
    var empty = a.status === 204 || a.status === 304 || String(m).toUpperCase() === 'HEAD';
    return new Promise(function (res) {
      setTimeout(function () { res(new Response(empty ? null : a.body, { status: a.status, headers: { 'content-type': a.type } })); }, 0);
    });
  };
  function FakeXHR() {
    EventTarget.call(this);
    this.readyState = 0; this.status = 0; this.statusText = ''; this.responseText = ''; this.response = '';
    this.responseType = ''; this.responseURL = ''; this.timeout = 0; this.withCredentials = false;
    this._h = {}; this._m = 'GET'; this._u = '';
    this.upload = new EventTarget();
  }
  FakeXHR.prototype = Object.create(EventTarget.prototype);
  FakeXHR.prototype.constructor = FakeXHR;
  FakeXHR.UNSENT = 0; FakeXHR.OPENED = 1; FakeXHR.HEADERS_RECEIVED = 2; FakeXHR.LOADING = 3; FakeXHR.DONE = 4;
  FakeXHR.prototype._fire = function (type) {
    var ev = new Event(type);
    var h = this['on' + type];
    if (typeof h === 'function') h.call(this, ev);
    this.dispatchEvent(ev);
  };
  FakeXHR.prototype.open = function (m, u) { this._m = m; this._u = u; this.readyState = 1; this._fire('readystatechange'); };
  FakeXHR.prototype.setRequestHeader = function () {};
  FakeXHR.prototype.overrideMimeType = function () {};
  FakeXHR.prototype.getResponseHeader = function (n) { return String(n).toLowerCase() === 'content-type' ? this._h.type || null : null; };
  FakeXHR.prototype.getAllResponseHeaders = function () { return this._h.type ? 'content-type: ' + this._h.type + '\\r\\n' : ''; };
  FakeXHR.prototype.abort = function () { this._aborted = true; };
  FakeXHR.prototype.send = function () {
    var x = this, a = answer(x._m, x._u);
    setTimeout(function () {
      if (x._aborted) return;
      x.status = a.status; x.statusText = a.status === 404 ? 'Not Found' : 'OK'; x._h.type = a.type;
      x.responseURL = (abs(x._u) || here).href;
      x.responseText = a.body;
      if (x.responseType === 'json') { try { x.response = a.body ? JSON.parse(a.body) : null; } catch (e) { x.response = null; } }
      else x.response = a.body;
      x.readyState = 4;
      x._fire('readystatechange'); x._fire('load'); x._fire('loadend');
    }, 0);
  };
  W.XMLHttpRequest = FakeXHR;
  function Inert(u) {
    EventTarget.call(this);
    var s = this;
    s.url = String(u); s.readyState = 0;
    setTimeout(function () { s.readyState = 1; var ev = new Event('open'); if (typeof s.onopen === 'function') s.onopen(ev); s.dispatchEvent(ev); }, 0);
  }
  Inert.prototype = Object.create(EventTarget.prototype);
  Inert.prototype.send = function () { stats.writes++; report(); };
  Inert.prototype.close = function () { this.readyState = 3; var ev = new Event('close'); if (typeof this.onclose === 'function') this.onclose(ev); this.dispatchEvent(ev); };
  W.WebSocket = Inert;
  W.EventSource = Inert;
  try { Object.defineProperty(Navigator.prototype, 'sendBeacon', { configurable: true, value: function () { stats.writes++; report(); return true; } }); } catch (e) {}

  // ----- Stockage en mémoire, propre à la visite -----
  function Mem() { this._d = {}; }
  Mem.prototype.getItem = function (k) { k = String(k); return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; };
  Mem.prototype.setItem = function (k, v) { this._d[String(k)] = String(v); };
  Mem.prototype.removeItem = function (k) { delete this._d[String(k)]; };
  Mem.prototype.clear = function () { this._d = {}; };
  Mem.prototype.key = function (i) { var ks = Object.keys(this._d); return i < ks.length ? ks[i] : null; };
  Object.defineProperty(Mem.prototype, 'length', { get: function () { return Object.keys(this._d).length; } });
  function define(o, k, d) { try { Object.defineProperty(o, k, d); } catch (e) {} }
  define(W, 'localStorage', { configurable: true, value: new Mem() });
  define(W, 'sessionStorage', { configurable: true, value: new Mem() });
  define(W, 'indexedDB', { configurable: true, value: undefined });
  var jar = {};
  define(document, 'cookie', {
    configurable: true,
    get: function () { return Object.keys(jar).map(function (k) { return k + '=' + jar[k]; }).join('; '); },
    set: function (v) { var kv = String(v).split(';')[0]; var i = kv.indexOf('='); if (i > 0) jar[kv.slice(0, i).trim()] = kv.slice(i + 1).trim(); }
  });

  // ----- Navigation virtuelle -----
  function go(u, method) {
    var x = abs(u);
    if (!x) return;
    post({ t: 'nav', url: x.href, method: method || 'GET' });
  }
  var entries = [{ url: here.href, state: null }], at = 0;
  function setUrl(u) { var x = abs(u); if (x) here = x; }
  define(document, 'URL', { configurable: true, get: function () { return here.href; } });
  define(document, 'documentURI', { configurable: true, get: function () { return here.href; } });
  define(document, 'referrer', { configurable: true, get: function () { return ''; } });
  var H = W.history;
  define(H, 'state', { configurable: true, get: function () { return entries[at].state; } });
  define(H, 'length', { configurable: true, get: function () { return entries.length; } });
  H.pushState = function (st, t, u) { if (u != null) setUrl(u); entries = entries.slice(0, at + 1); entries.push({ url: here.href, state: st }); at++; post({ t: 'route', url: here.href }); };
  H.replaceState = function (st, t, u) { if (u != null) setUrl(u); entries[at] = { url: here.href, state: st }; post({ t: 'route', url: here.href }); };
  H.go = function (n) {
    var to = at + (n || 0);
    if (!n || to < 0 || to >= entries.length) return;
    at = to; setUrl(entries[at].url);
    setTimeout(function () { W.dispatchEvent(new PopStateEvent('popstate', { state: entries[at].state })); post({ t: 'route', url: here.href }); }, 0);
  };
  H.back = function () { H.go(-1); };
  H.forward = function () { H.go(1); };
  /** location virtuelle, vue par les scripts gardés (portée « with », ou constante en tête d'un module). */
  var loc = {
    assign: function (u) { go(u); },
    replace: function (u) { go(u); },
    reload: function () { go(here.href); },
    toString: function () { return here.href; }
  };
  ['href', 'origin', 'protocol', 'host', 'hostname', 'port', 'pathname', 'search', 'hash'].forEach(function (k) {
    Object.defineProperty(loc, k, {
      enumerable: true,
      get: function () { return here[k]; },
      set: function (v) {
        if (k === 'hash') { here.hash = v; W.dispatchEvent(new HashChangeEvent('hashchange')); return; }
        var x = new URL(here.href);
        if (k === 'href') { go(v); return; }
        x[k] = v; go(x.href);
      }
    });
  });
  W.__fdLocation = loc;
  W.__fdScope = new Proxy({}, {
    has: function (t, k) { return k === 'location'; },
    get: function (t, k) { return k === 'location' ? loc : undefined; },
    set: function (t, k, v) { if (k === 'location') { go(v); return true; } return false; }
  });
  W.open = function () { return null; };
  // Liens et formulaires : après les gestionnaires de la page (phase de bulle), si elle n'a pas déjà empêché
  W.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0) return;
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    e.preventDefault();
    if (!href || href.charAt(0) === '#') { if (href && href.length > 1) { here.hash = href; var t = document.getElementById(href.slice(1)); if (t) t.scrollIntoView(); } return; }
    if (/^(javascript|mailto|tel):/i.test(href)) return;
    go(href);
  });
  // L'iframe n'a pas allow-forms : le navigateur bloque l'envoi AVANT l'évènement submit, donc la page ne
  // le verrait jamais. Le clic sur un bouton d'envoi (ou Entrée, qui le simule) est repris ici : contrôle
  // de validité natif (sauf novalidate), puis évènement submit envoyé à la page.
  document.addEventListener('click', function (e) {
    var t = e.target, b = t && t.closest && t.closest('button, input[type=submit], input[type=image]');
    if (!b || e.defaultPrevented) return;
    var type = (b.getAttribute('type') || (b.tagName === 'BUTTON' ? 'submit' : '')).toLowerCase();
    var f = b.form;
    if (!f || (type !== 'submit' && type !== 'image')) return;
    e.preventDefault();
    if (!f.noValidate && !b.formNoValidate && !f.reportValidity()) return;
    var ev;
    try { ev = new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: b }); } catch (x) { ev = new Event('submit', { bubbles: true, cancelable: true }); }
    f.dispatchEvent(ev);
  }, true);
  W.addEventListener('submit', function (e) {
    // La page a géré l'envoi elle-même (fetch, validation) : rien de plus
    if (e.defaultPrevented) return;
    e.preventDefault();
    var f = e.target;
    var m = String((f && f.getAttribute && f.getAttribute('method')) || 'GET').toUpperCase();
    if (m !== 'GET') { stats.writes++; report(); }
    go((f && f.getAttribute && f.getAttribute('action')) || here.href, m);
  });
  report();
})();`;

/** Empreinte sha256 d'un texte, au format CSP. */
async function sha(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  let bin = '';
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
  return `'sha256-${btoa(bin)}'`;
}

/** CSP d'une page vivante : seuls les scripts désignés, aucune sortie. */
export function liveCsp(hashes: string[]): string {
  return [
    "default-src 'none'",
    'img-src data:',
    "style-src 'unsafe-inline'",
    'font-src data:',
    `script-src ${hashes.join(' ')}`,
    "connect-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
    "frame-src 'none'",
    "worker-src 'none'",
    "media-src 'none'",
    "object-src 'none'",
  ].join('; ');
}

/** Corps d'un script gardé : location virtuelle (portée « with » ; constante en tête d'un module). */
export function wrapScript(s: LiveScript): string {
  // Un </script> écrit dans le code fermerait la balise : on le coupe (sans changer le sens en JS)
  const code = s.code.replace(/<\/(script)/gi, '<\\/$1');
  return s.module
    ? `const location = window.__fdLocation;\n${code}`
    : `with (window.__fdScope) {\n${code}\n}`;
}

const jsonInScript = (v: unknown) =>
  JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

/**
 * Document srcdoc d'une page vivante : CSP et données de rejeu en tête, environnement factice avant tout,
 * scripts gardés à leur place, script du cadre en fin de corps. Un script bloqué est retiré (il reste
 * dans LivePage.scripts, donc rétablissable sans recapture).
 */
export async function buildLiveSrcdoc(page: LivePage): Promise<string> {
  const kept = new Map(page.scripts.filter((s) => s.keep).map((s) => [s.id, s]));
  const bodies = new Map<string, string>();
  for (const [id, s] of kept) bodies.set(id, wrapScript(s));
  const hashes = [await sha(LIVE_SHIM), await runtimeHash()];
  for (const b of bodies.values()) hashes.push(await sha(b));
  const data = jsonInScript({ url: page.url, responses: page.responses });
  const head =
    `<meta http-equiv="Content-Security-Policy" content="${liveCsp(hashes)}">` +
    '<meta name="referrer" content="no-referrer">' +
    `<script type="application/json" id="fd-replay">${data}</script>` +
    `<script>${LIVE_SHIM}</script>`;
  // Les scripts non marqués (jamais attendus après la capture) sont retirés, comme en mode inerte
  let doc = page.html.replace(/<meta[^>]+http-equiv[^>]*>/gi, '');
  doc = doc.replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, (_m, attrs: string) => {
    const id = /\bdata-fd-script="([^"]+)"/.exec(attrs)?.[1];
    const body = id ? bodies.get(id) : undefined;
    if (body === undefined) return '';
    return kept.get(id!)!.module ? `<script type="module">${body}</script>` : `<script>${body}</script>`;
  });
  doc = /<head[^>]*>/i.test(doc) ? doc.replace(/<head([^>]*)>/i, (m) => m + head) : head + doc;
  const runtime = `<script>${FRAME_RUNTIME}</script>`;
  return /<\/body\s*>/i.test(doc)
    ? doc.replace(/<\/body\s*>(?![\s\S]*<\/body)/i, (m) => runtime + m)
    : doc + runtime;
}
