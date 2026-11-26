/**
 * Sandbox v2, étape 3 (docs/tech/sandbox-v2.md §3.1) : enregistrement « vivant » d'une page, à côté de la
 * copie inerte de htmlCapture.
 *  - collectLive (dans la page, monde isolé) : document SOURCE (tel que le serveur l'a envoyé, avant les
 *    scripts), CSS et images intégrés, scripts remplacés par des marques à leur place et téléchargés,
 *    réponses GET relevées par l'enregistreur (liveRecorder) ou relues d'après performance.
 *  - redactLive (pur, au moment de l'envoi) : données personnelles remplacées dans le document et les
 *    réponses, avec les mêmes valeurs neutres que la copie inerte (sauf celles que l'auteur a gardées).
 * Rien n'est envoyé ici : l'enregistrement brut reste dans l'extension jusqu'à « Envoyer ».
 */
import { classifyRemoved, labelType, matchText, neutralText, plausibleValue } from '@flowdsiml/core';

export type LiveKind = 'image' | 'font' | 'css' | 'js' | 'data';
export type LiveFetch = (url: string, kind: LiveKind) => Promise<string | null>;

export interface LiveScript {
  id: string;
  code: string;
  keep: boolean;
  module?: boolean;
  source: string;
  category: 'page' | 'third' | 'tracking';
}
export interface LiveResponse {
  method: 'GET';
  url: string;
  status: number;
  type: string;
  body: string;
}
/** Enregistrement brut (avant le remplacement des données personnelles). */
export interface LiveRaw {
  url: string;
  html: string;
  scripts: LiveScript[];
  responses: LiveResponse[];
  /** Scripts de la page que l'extension n'a pas pu lire (adresse refusée, trop lourds). */
  missing: number;
}

export const LIVE_LIMITS = {
  responses: 300,
  response: 1024 * 1024,
  responsesTotal: 10 * 1024 * 1024,
  scripts: 200,
  scriptsTotal: 15 * 1024 * 1024,
};

/** Réponses relevées par l'enregistreur de la page (évènement au nom tiré au hasard). */
export function listenLive(eventName: string): { take: () => LiveResponse[] } {
  const byUrl = new Map<string, LiveResponse>();
  let total = 0;
  document.addEventListener(eventName, (e) => {
    try {
      const d = JSON.parse(String((e as CustomEvent).detail)) as Partial<LiveResponse>;
      if (typeof d.url !== 'string' || typeof d.body !== 'string') return;
      if (d.body.length > LIVE_LIMITS.response) return;
      const prev = byUrl.get(d.url);
      if (!prev && byUrl.size >= LIVE_LIMITS.responses) return;
      if (total - (prev?.body.length ?? 0) + d.body.length > LIVE_LIMITS.responsesTotal) return;
      total += d.body.length - (prev?.body.length ?? 0);
      byUrl.set(d.url, {
        method: 'GET',
        url: d.url,
        status: Number(d.status) || 200,
        type: String(d.type ?? 'application/json'),
        body: d.body,
      });
    } catch {
      /* détail illisible : ignoré */
    }
  });
  return { take: () => [...byUrl.values()] };
}

const absUrl = (u: string, base: string) => {
  try {
    return new URL(u, base).href;
  } catch {
    return '';
  }
};
const JS_TYPE =
  /^(|text\/javascript|application\/javascript|text\/ecmascript|application\/ecmascript|module)$/i;
const DATA_TYPE = /^application\/(ld\+)?json$/i;

/** Remplace les url(...) d'un CSS par des data: (images et polices). */
async function inlineUrls(css: string, base: string, get: LiveFetch): Promise<string> {
  const urls = new Set<string>();
  for (const m of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g))
    if (m[2] && !m[2].startsWith('data:') && !m[2].startsWith('#')) urls.add(m[2]);
  for (const u of urls) {
    const full = absUrl(u, base);
    const kind = /\.(woff2?|ttf|otf|eot)(\?|#|$)/i.test(full) ? 'font' : 'image';
    const data = /^https?:/.test(full) ? await get(full, kind) : null;
    css = css.split(u).join(data ?? '');
  }
  return css;
}

/** Catégorie d'un script (même classement que l'écran de vérification). */
function categoryOf(el: Element, pageUrl: string, src: string): LiveScript['category'] {
  const c = classifyRemoved(el, pageUrl);
  if (c?.group === 'trackingScripts') return 'tracking';
  if (c?.reason === 'scriptThirdParty') return 'third';
  // Même hôte mais autre port : une autre origine, donc un autre service (gardé seulement par l'auteur)
  try {
    if (
      src &&
      new URL(src).port !== new URL(pageUrl).port &&
      new URL(src).hostname === new URL(pageUrl).hostname
    )
      return 'third';
  } catch {
    /* adresse illisible : classement de l'écran de vérification */
  }
  return 'page';
}

/**
 * Enregistrement brut de la page : document source, scripts, réponses. Rend null sans source lisible (la
 * copie inerte reste alors seule, comme en v1).
 */
export async function collectLive(opts: {
  source: string | null;
  pageUrl: string;
  recorded: LiveResponse[];
  get: LiveFetch;
  /** Adresses lues par la page avant l'enregistreur (performance), relues par le service de fond. */
  earlier?: string[];
}): Promise<LiveRaw | null> {
  if (!opts.source) return null;
  const doc = new DOMParser().parseFromString(opts.source, 'text/html');
  const baseEl = doc.querySelector('base[href]');
  const base = baseEl
    ? absUrl(baseEl.getAttribute('href') ?? '', opts.pageUrl) || opts.pageUrl
    : opts.pageUrl;
  doc
    .querySelectorAll('base, meta[http-equiv], iframe, frame, object, embed, noscript')
    .forEach((e) => e.remove());

  // Scripts : marques à leur place ; les données (JSON) restent écrites, elles ne s'exécutent pas
  const scripts: LiveScript[] = [];
  let missing = 0;
  let total = 0;
  for (const el of [...doc.querySelectorAll('script')]) {
    const type = (el.getAttribute('type') ?? '').trim();
    if (DATA_TYPE.test(type)) {
      if (/<\/script/i.test(el.textContent ?? '')) el.remove();
      continue;
    }
    if (!JS_TYPE.test(type) || el.hasAttribute('nomodule') || scripts.length >= LIVE_LIMITS.scripts) {
      el.remove();
      continue;
    }
    const src = el.getAttribute('src');
    const full = src ? absUrl(src, base) : '';
    const code = src ? (/^https?:/.test(full) ? await opts.get(full, 'js') : null) : (el.textContent ?? '');
    if (code === null || total + code.length > LIVE_LIMITS.scriptsTotal) {
      missing++;
      el.remove();
      continue;
    }
    total += code.length;
    const category = categoryOf(el, opts.pageUrl, full);
    const id = `s${scripts.length + 1}`;
    scripts.push({
      id,
      code,
      // §3.3 : scripts de la page gardés ; tiers et mesure d'audience bloqués, rétablissables
      keep: category === 'page',
      module: /^module$/i.test(type) || undefined,
      source: src ? full : 'page',
      category,
    });
    const mark = doc.createElement('script');
    mark.setAttribute('data-fd-script', id);
    el.replaceWith(mark);
  }

  // Feuilles de style intégrées ; les autres liens (préchargement, icônes) retirés
  for (const link of [...doc.querySelectorAll('link')]) {
    const rel = (link.getAttribute('rel') ?? '').toLowerCase();
    const href = absUrl(link.getAttribute('href') ?? '', base);
    if (/\bstylesheet\b/.test(rel) && /^https?:/.test(href)) {
      const css = await opts.get(href, 'css');
      if (css) {
        const style = doc.createElement('style');
        style.textContent = await inlineUrls(css, href, opts.get);
        link.replaceWith(style);
        continue;
      }
    }
    link.remove();
  }
  for (const style of [...doc.querySelectorAll('style')])
    style.textContent = await inlineUrls(style.textContent ?? '', base, opts.get);
  for (const el of [...doc.querySelectorAll<HTMLElement>('[style*="url("]')])
    el.setAttribute('style', await inlineUrls(el.getAttribute('style') ?? '', base, opts.get));
  // Images intégrées ; médias et sources multiples retirés (la CSP n'admet que data:)
  for (const img of [...doc.querySelectorAll('img[src]')]) {
    const src = absUrl(img.getAttribute('src') ?? '', base);
    const data = /^https?:/.test(src) ? await opts.get(src, 'image') : null;
    if (data) img.setAttribute('src', data);
    else img.removeAttribute('src');
    img.removeAttribute('srcset');
    img.removeAttribute('loading');
  }
  doc.querySelectorAll('picture source, video, audio').forEach((e) => e.remove());

  // Réponses : relevées par l'enregistreur, puis celles lues avant lui (performance), relues en GET
  const responses = [...opts.recorded];
  const seen = new Set(responses.map((r) => r.url));
  let rtotal = responses.reduce((n, r) => n + r.body.length, 0);
  for (const u of opts.earlier ?? []) {
    if (seen.has(u) || responses.length >= LIVE_LIMITS.responses) continue;
    seen.add(u);
    const got = await opts.get(u, 'data');
    if (!got) continue;
    try {
      const d = JSON.parse(got) as { type: string; status: number; body: string };
      if (rtotal + d.body.length > LIVE_LIMITS.responsesTotal) continue;
      rtotal += d.body.length;
      responses.push({ method: 'GET', url: u, status: d.status, type: d.type, body: d.body });
    } catch {
      /* réponse illisible : ignorée */
    }
  }

  return {
    url: opts.pageUrl,
    html: `<!doctype html>\n${doc.documentElement.outerHTML}`,
    scripts,
    responses,
    missing,
  };
}

/** Adresses lues par la page (fetch, XHR) avant que l'enregistreur ne soit en place. */
export function earlierReads(): string[] {
  try {
    return (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
      .filter((e) => e.initiatorType === 'fetch' || e.initiatorType === 'xmlhttprequest')
      .map((e) => e.name)
      .filter((u) => /^https?:/.test(u));
  } catch {
    return [];
  }
}

/** Paire « valeur d'origine → valeur neutre » déjà appliquée dans la copie inerte. */
export type Pair = readonly [string, string];

/** Échappe une chaîne pour la retrouver telle qu'elle est écrite dans un JSON. */
const jsonEscaped = (s: string) => JSON.stringify(s).slice(1, -1);

/** Remplace dans un texte les valeurs de la copie inerte, puis les motifs sûrs (e-mail, téléphone, IBAN, NIR). */
function redactText(text: string, pairs: readonly Pair[], count: { n: number }): string {
  let out = text;
  for (const [orig, masked] of pairs) {
    if (orig.length < 3 || !out.includes(orig)) continue;
    count.n += out.split(orig).length - 1;
    out = out.split(orig).join(masked);
  }
  const hits = matchText(out).filter(
    (m) => m.type !== 'name' && m.type !== 'address' && m.type !== 'birthdate',
  );
  for (const m of [...hits].reverse()) {
    out = out.slice(0, m.start) + neutralText(out.slice(m.start, m.end)) + out.slice(m.end);
    count.n++;
  }
  return out;
}

/** Valeurs d'un JSON : la clé sert de libellé (« nom », « email », « telephone »…). */
function redactJson(
  v: unknown,
  key: string,
  pairs: readonly Pair[],
  count: { n: number },
  readable: string,
): unknown {
  if (typeof v === 'string') {
    const type = labelType(key);
    // Une valeur que la copie inerte affiche telle quelle (jugée non personnelle dans son contexte) reste
    // lisible : la démo rejouée montre ce que montre la copie
    const shown = v.trim().length >= 3 && readable.includes(v.trim());
    if (type && !shown && plausibleValue(type, v, { single: true })) {
      count.n++;
      return neutralText(v);
    }
    return redactText(v, pairs, count);
  }
  if (Array.isArray(v)) return v.map((x) => redactJson(x, key, pairs, count, readable));
  if (v && typeof v === 'object')
    return Object.fromEntries(
      Object.entries(v).map(([k, x]) => [k, redactJson(x, k, pairs, count, readable)]),
    );
  return v;
}

/**
 * Enregistrement prêt à l'envoi : données personnelles remplacées dans le document (texte et attributs) et
 * dans les réponses ; les valeurs que l'auteur a gardées ne figurent pas dans `pairs`.
 */
export function redactLive(
  raw: LiveRaw,
  pairs: readonly Pair[],
  /** Texte lisible des copies inertes de la capture (valeurs que la détection a laissées). */
  readable = '',
): LiveRaw & { piiReplaced: number } {
  const count = { n: 0 };
  // Document : les paires sont cherchées telles quelles et sous leur forme échappée en HTML
  const htmlPairs: Pair[] = pairs.flatMap(([o, m]) => {
    const e = o.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return e === o ? [[o, m] as const] : [[o, m] as const, [e, m] as const];
  });
  // Les scripts écrits dans la page peuvent porter des données (état initial) : traités comme du texte
  const html = redactText(raw.html, htmlPairs, count);
  const scripts = raw.scripts.map((s) =>
    s.source === 'page'
      ? {
          ...s,
          code: redactText(
            s.code,
            pairs.map(([o, m]) => [jsonEscaped(o), m] as const),
            count,
          ),
        }
      : s,
  );
  const responses = raw.responses.map((r) => {
    if (/json/i.test(r.type)) {
      try {
        return { ...r, body: JSON.stringify(redactJson(JSON.parse(r.body), '', pairs, count, readable)) };
      } catch {
        /* JSON invalide : traité comme du texte */
      }
    }
    return { ...r, body: redactText(r.body, pairs, count) };
  });
  return { ...raw, html, scripts, responses, piiReplaced: count.n };
}

/** Texte lisible d'une copie inerte (balises, styles et scripts retirés). */
export function readableText(html: string): string {
  return html
    .replace(/<(style|script)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ');
}

/** Paires de la copie inerte (piiOriginals), hors valeurs gardées par l'auteur. */
export function pairsOf(
  originals: Record<string, { original?: string; masked?: string; texts?: string[] }> | undefined,
  kept: ReadonlySet<string> = new Set(),
): Pair[] {
  const out: Pair[] = [];
  for (const [id, o] of Object.entries(originals ?? {})) {
    if (kept.has(id)) continue;
    if (o.original && o.masked) out.push([o.original, o.masked]);
    for (const t of o.texts ?? []) if (t.trim().length >= 3) out.push([t.trim(), neutralText(t.trim())]);
  }
  // Les plus longues d'abord : « Camille Durand » avant « Durand »
  return out.sort((a, b) => b[0].length - a[0].length);
}
