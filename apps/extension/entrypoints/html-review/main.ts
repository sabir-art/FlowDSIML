import '@flowdsiml/ui/tokens.css';
import '@/lib/fonts.css';
import './style.css';
import { browser } from 'wxt/browser';
import { strings } from '@/lib/i18n';
import { ADD_KEY, type AddTarget } from '@/lib/external';
import {
  Box,
  ChartNoAxesColumn,
  Check,
  ChevronDown,
  ChevronUp,
  CircleQuestionMark,
  Code,
  ExternalLink,
  EyeOff,
  Files,
  Info,
  PanelTop,
  Play,
  Search,
  Server,
  TextCursorInput,
  Trash2,
  TriangleAlert,
  UserRound,
  createElement as lucide,
  type IconNode,
} from 'lucide';
import {
  HTML_MAX_BYTES,
  HTML_REVIEW_GROUPS,
  type HtmlRemovedItem,
  type HtmlReviewGroup,
} from '@flowdsiml/core';
import { APP_URL } from '@/lib/config';
import { htmlStore, type PendingHtmlPage } from '@/lib/htmlStore';
import { restorePii } from '@/lib/htmlKeep';
import { applyWidgets } from '@/lib/htmlWidgets';
import { sendHtml, type HtmlDemoKind, type SendPage } from '@/lib/htmlUpload';
import { pairsOf, readableText, redactLive } from '@/lib/liveCapture';
import { rs } from '@/lib/reviewStrings';
import { supabase } from '@/lib/supabase';
import { fmt, plural, vs } from '@/lib/verifyStrings';
import { followAppearance } from '@/lib/appearance';

// L64 §4 : apparence choisie dans les réglages (Système, Clair, Sombre)
followAppearance();

/**
 * EXT-02 §2 : « Vérifier avant l'envoi ». Titre et type, bilan, pages copiées, puis six groupes de ce
 * qui n'a pas été copié ou a été protégé. Une donnée remplacée ou un lien externe peut être gardé ;
 * rien d'autre. Rien ne quitte le navigateur avant « Envoyer ».
 */
const s = vs;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const lang = document.documentElement.lang || 'fr';
const PAGE_SIZE = 20;
/**
 * Groupes de l'écran. Décision du chef (suivi UX du lot B) : les éléments ajoutés par un script d'un
 * autre site forment un groupe à part, sous « Scripts de la page », pour que les chiffres concordent avec
 * la tuile. Dans les données, ils restent du groupe pageScripts (raison widgetThirdParty).
 */
type ReviewGroup = HtmlReviewGroup | 'widgets';
/** Sandbox v2 : groupe « Sandbox vivant » (scripts rejoués, Garder / Bloquer ; réponses du site). */
type GroupKey = 'pages' | 'live' | ReviewGroup;
const REVIEW_GROUPS: ReviewGroup[] = [
  'pageScripts',
  'widgets',
  ...HTML_REVIEW_GROUPS.filter((g) => g !== 'pageScripts'),
];
const groupOf = (it: HtmlRemovedItem): ReviewGroup =>
  it.reason === 'widgetThirdParty' ? 'widgets' : it.group;

function icon(node: IconNode, size = 16): SVGElement {
  const el = lucide(node);
  el.setAttribute('width', String(size));
  el.setAttribute('height', String(size));
  el.setAttribute('aria-hidden', 'true');
  return el as unknown as SVGElement;
}
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | undefined> = {},
  ...children: Array<Node | string | null | undefined>
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined) continue;
    if (k === 'class') el.className = v;
    else el.setAttribute(k, v);
  }
  for (const c of children) if (c !== null && c !== undefined) el.append(c);
  return el;
}
// Sous 0,1 Mo, le poids est donné en Ko (« 12 Ko » plutôt que « 0,0 Mo »)
const size = (bytes: number) =>
  bytes < 104858
    ? fmt(s.sizeKb, { n: Math.max(1, Math.round(bytes / 1024)).toLocaleString(lang) })
    : fmt(s.size, {
        n: (bytes / 1024 / 1024).toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      });
const MAX = fmt(s.size, { n: (HTML_MAX_BYTES / 1024 / 1024).toLocaleString(lang) });
const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
};
const addressOf = (url: string) => {
  try {
    const u = new URL(url);
    return (u.host + u.pathname).replace(/\/$/, '') + (u.hash.startsWith('#/') ? u.hash : '');
  } catch {
    return url;
  }
};

// ---------- État ----------
let pages: PendingHtmlPage[] = [];
/** Pages retirées de la démo (par leur ordre de capture). */
const gone = new Set<number>();
/** Éléments gardés : « ordre de la page : identifiant ». */
const kept = new Set<string>();
const active = () => pages.filter((p) => !gone.has(p.order));
const pageNo = (p: PendingHtmlPage) => pages.indexOf(p) + 1;
const pageTitle = (p: PendingHtmlPage) => p.title || addressOf(p.url);
const keyOf = (p: PendingHtmlPage, it: HtmlRemovedItem) => `${p.order}:${it.id}`;

interface Row {
  key: string;
  icon: IconNode;
  thumb?: PendingHtmlPage;
  name: string;
  mono: boolean;
  source: string;
  status: string;
  tone: 'plain' | 'kept' | 'warn';
  why: string;
  action?: { label: string; aria: string; run: () => void };
}

const GROUP_ICON: Record<GroupKey, IconNode> = {
  pages: Files,
  live: Play,
  pageScripts: Code,
  widgets: PanelTop,
  trackingScripts: ChartNoAxesColumn,
  frames: PanelTop,
  forms: TextCursorInput,
  pii: EyeOff,
  externalLinks: ExternalLink,
};

/** Un lien externe ne peut être gardé que s'il est en https et retrouvable dans la page. */
const linkKeepable = (it: HtmlRemovedItem) => !!it.sel && /^https:\/\/[^\s"'<>]+$/.test(it.href ?? '');

function itemName(it: HtmlRemovedItem): { name: string; mono: boolean } {
  if (it.group === 'pii') {
    const type = it.piiType ? rs.types[it.piiType] : s.fallback.pii;
    return { name: it.name ? `${type} · « ${it.name} »` : type, mono: false };
  }
  // Lot B : élément ajouté par un script tiers, nommé par son texte (« Discuter avec nous »)
  if (it.reason === 'widgetThirdParty') return { name: it.name || s.fallback.widget, mono: false };
  if (it.group === 'pageScripts' || it.group === 'trackingScripts')
    return it.name
      ? { name: it.name, mono: true }
      : { name: it.reason === 'scriptInline' ? s.fallback.scriptInline : s.fallback.script, mono: false };
  if (it.group === 'frames')
    return {
      name:
        it.name ||
        (it.reason === 'frameVideo'
          ? s.fallback.frameVideo
          : it.reason === 'frameMap'
            ? s.fallback.frameMap
            : s.fallback.frame),
      mono: false,
    };
  return { name: it.name || (it.group === 'forms' ? s.fallback.form : s.fallback.link), mono: false };
}

function itemRow(p: PendingHtmlPage, it: HtmlRemovedItem): Row {
  const key = keyOf(p, it);
  const isKept = kept.has(key);
  const { name, mono } = itemName(it);
  const many = pages.length > 1;
  const origin = fmt(s.pageN, { n: pageNo(p), title: pageTitle(p) });
  // Un lien externe montre son hôte complet (« legal.example.com »), les autres leur site d'origine
  const from = (it.group === 'externalLinks' && hostOf(it.href ?? '')) || it.source;
  const source = from ? (many ? `${from} · ${origin}` : from) : many ? origin : s.inPage;
  const canKeep =
    it.group === 'pii'
      ? !!p.piiOriginals?.[it.id]
      : it.reason === 'widgetThirdParty' || (it.group === 'externalLinks' && linkKeepable(it));
  const status = isKept
    ? s.status.kept
    : it.group === 'pii'
      ? s.status.replaced
      : it.group === 'frames'
        ? s.status.removed
        : it.group === 'externalLinks' || it.group === 'forms'
          ? s.status.disabled
          : s.status.notCopied;
  const why =
    it.group === 'pii'
      ? isKept
        ? s.reasonWhy.piiKept
        : s.reasonWhy.pii
      : it.group === 'externalLinks'
        ? isKept
          ? s.reasonWhy.linkKept
          : canKeep
            ? s.reasonWhy.linkExternal
            : s.reasonWhy.linkLocked
        : s.reasonWhy[it.reason as keyof typeof s.reasonWhy];
  const row: Row = {
    key,
    // Suivi UX du lot B : un élément ajouté par un script n'est pas un script, il a l'icône d'un panneau
    icon: it.group === 'pii' ? UserRound : it.reason === 'widgetThirdParty' ? PanelTop : GROUP_ICON[it.group],
    name,
    mono,
    source,
    status,
    tone: isKept ? 'kept' : 'plain',
    why,
  };
  if (isKept)
    row.action = {
      label: s.remove,
      aria: fmt(s.removeOf, { name }),
      run: () => {
        kept.delete(key);
        refresh(groupOf(it), key);
      },
    };
  else if (canKeep)
    row.action = {
      label: s.keep,
      aria: fmt(s.keepOf, { name }),
      run: () => {
        const keep = () => {
          kept.add(key);
          refresh(groupOf(it), key);
        };
        if (it.group !== 'externalLinks') return keep();
        void ask(
          s.keepLinkTitle,
          fmt(s.keepLinkBody, { label: name, host: hostOf(it.href ?? '') || it.source }),
          s.keepLinkOk,
        ).then((yes) => yes && keep());
      },
    };
  return row;
}

function pageRow(p: PendingHtmlPage): Row {
  const title = pageTitle(p);
  return {
    key: `page:${p.order}`,
    icon: Files,
    thumb: p,
    name: fmt(s.pageN, { n: pageNo(p), title }),
    mono: false,
    source: `${addressOf(p.url)} · ${size(p.bytes)}`,
    status: p.tooBig ? s.status.heavy : s.status.ready,
    tone: p.tooBig ? 'warn' : 'plain',
    why: fmt(p.tooBig ? s.pageWhyHeavy : s.pageWhyReady, { title, size: size(p.bytes), max: MAX }),
    action: {
      label: s.remove,
      aria: fmt(s.removeOf, { name: title }),
      run: () => removePage(p),
    },
  };
}

// ---------- Sandbox vivant ----------
/** Choix de l'auteur par script (« live:<page>:<script> ») ; sinon le choix de la capture. */
const liveKeep = new Map<string, boolean>();
const liveKey = (p: PendingHtmlPage, id: string) => `live:${p.order}:${id}`;
const livePages = () => active().filter((p) => !p.tooBig && p.live);
const liveOn = () => kind === 'sandbox' && livePages().length > 0;
const keepOf = (p: PendingHtmlPage, sc: { id: string; keep: boolean }) =>
  liveKeep.get(liveKey(p, sc.id)) ?? sc.keep;
const liveScriptsCount = () => livePages().reduce((n, p) => n + p.live!.scripts.length, 0);

function liveRows(): Row[] {
  const many = pages.length > 1;
  const rows: Row[] = [];
  for (const p of livePages()) {
    const origin = fmt(s.pageN, { n: pageNo(p), title: pageTitle(p) });
    for (const sc of p.live!.scripts) {
      const key = liveKey(p, sc.id);
      const on = keepOf(p, sc);
      const name =
        sc.source === 'page' ? s.fallback.scriptInline : sc.source.replace(/^https?:\/\//, '').slice(0, 80);
      rows.push({
        key,
        icon: sc.category === 'tracking' ? ChartNoAxesColumn : Code,
        name,
        mono: sc.source !== 'page',
        source: many ? `${s.live.category[sc.category]} · ${origin}` : s.live.category[sc.category],
        status: on ? s.live.played : s.live.blocked,
        tone: on ? 'kept' : 'plain',
        why: s.live.why[sc.category],
        action: {
          label: on ? s.live.block : s.keep,
          aria: fmt(on ? s.live.blockOf : s.keepOf, { name }),
          run: () => {
            liveKeep.set(key, !on);
            refresh('live', key);
          },
        },
      });
    }
    rows.push({
      key: `live:${p.order}:responses`,
      icon: Server,
      name: many ? `${s.live.responses} · ${origin}` : s.live.responses,
      mono: false,
      source: plural(s.live.responsesN_one, s.live.responsesN_other, p.live!.responses.length),
      status: s.live.replayed,
      tone: 'plain',
      why: s.live.responsesWhy,
    });
  }
  return rows;
}

function rowsOf(g: GroupKey): Row[] {
  if (g === 'pages') return active().map(pageRow);
  if (g === 'live') return liveRows();
  return active().flatMap((p) =>
    (p.removed ?? []).filter((it) => groupOf(it) === g).map((it) => itemRow(p, it)),
  );
}
const countOf = (g: ReviewGroup) =>
  active().reduce((n, p) => n + (p.removed ?? []).filter((it) => groupOf(it) === g).length, 0);
const keptIn = (g: ReviewGroup) =>
  active().reduce(
    (n, p) => n + (p.removed ?? []).filter((it) => groupOf(it) === g && kept.has(keyOf(p, it))).length,
    0,
  );

function stateOf(g: GroupKey): string {
  if (g === 'live') {
    const all = livePages().flatMap((p) => p.live!.scripts.map((sc) => keepOf(p, sc)));
    return fmt(s.live.state, { played: all.filter(Boolean).length, blocked: all.filter((x) => !x).length });
  }
  if (g === 'pages') {
    const heavy = active().filter((p) => p.tooBig).length;
    return heavy ? plural(s.pagesHeavy_one, s.pagesHeavy_other, heavy) : s.pagesReady;
  }
  if (g === 'frames') return plural(s.framesRemoved_one, s.framesRemoved_other, countOf(g));
  const k = keptIn(g);
  return k ? `${s.state[g]} · ${plural(s.keptCount_one, s.keptCount_other, k)}` : s.state[g];
}

// ---------- Groupes ----------
interface GroupView {
  key: GroupKey;
  root: HTMLElement;
  open: boolean;
  whyOpen: boolean;
  query: string;
  limit: number;
  /** Lignes dont le « Pourquoi ? » est déplié */
  whyRows: Set<string>;
}
const views = new Map<GroupKey, GroupView>();

function chip(row: Row): HTMLElement {
  const el = h('span', { class: `st2${row.tone === 'plain' ? '' : ' kp'}` });
  if (row.tone === 'kept') el.append(icon(Check, 14));
  if (row.tone === 'warn') el.append(icon(TriangleAlert, 14));
  el.append(row.status);
  return el;
}

function thumb(p: PendingHtmlPage): HTMLElement {
  const box = h('span', { class: 'pth', 'aria-hidden': 'true' });
  const frame = h('iframe', { sandbox: '', loading: 'lazy', tabindex: '-1', scrolling: 'no' });
  frame.srcdoc = p.html;
  box.append(frame);
  return box;
}

function renderRows(v: GroupView) {
  const list = v.root.querySelector<HTMLElement>('.rows');
  const foot = v.root.querySelector<HTMLElement>('.ft2');
  if (!list || !foot) return;
  const all = rowsOf(v.key);
  const q = v.query.trim().toLowerCase();
  const found = q ? all.filter((r) => `${r.name} ${r.source}`.toLowerCase().includes(q)) : all;
  const shown = found.slice(0, v.limit);
  const kids: HTMLElement[] = [];
  for (const row of shown) {
    const whyId = `why-${v.key}-${row.key.replace(/\W/g, '-')}`;
    const open = v.whyRows.has(row.key);
    const why = h(
      'button',
      {
        type: 'button',
        class: 'wy',
        'aria-expanded': String(open),
        'aria-controls': whyId,
        'aria-label': fmt(s.whyOf, { name: row.name }),
        'data-key': `why:${row.key}`,
      },
      icon(CircleQuestionMark),
      s.why,
    );
    why.addEventListener('click', () => {
      if (open) v.whyRows.delete(row.key);
      else v.whyRows.add(row.key);
      renderRows(v);
      focusKey(`why:${row.key}`);
    });
    const name = h(row.mono ? 'code' : 'b', {}, row.name);
    const el = h(
      'li',
      { class: `el2 gr${row.thumb ? ' pgr' : ''}` },
      row.thumb ? thumb(row.thumb) : h('span', { class: 'gi', 'aria-hidden': 'true' }, icon(row.icon)),
      h('div', { class: 'tx' }, name, h('span', { class: 'mu' }, row.source)),
      chip(row),
      why,
    );
    if (row.action) {
      const act = h(
        'button',
        { type: 'button', class: 'bt ac2', 'aria-label': row.action.aria, 'data-key': `act:${row.key}` },
        row.action.label,
      );
      act.addEventListener('click', row.action.run);
      el.append(act);
    }
    kids.push(el);
    if (open) kids.push(h('li', { class: 'why row-why', id: whyId }, icon(Info), h('p', {}, row.why)));
  }
  if (!found.length) kids.push(h('li', { class: 'none mu' }, s.noMatch));
  list.replaceChildren(...kids);
  foot.replaceChildren();
  // Les pages n'ont un pied que s'il en reste à afficher
  foot.hidden = true;
  if (v.key !== 'pages' || found.length > shown.length) {
    foot.hidden = false;
    foot.append(h('span', { class: 'mu' }, fmt(s.shown, { shown: shown.length, total: found.length })));
    if (found.length > shown.length) {
      const more = h('button', { type: 'button', class: 'bt', 'data-key': `more:${v.key}` }, s.more);
      more.addEventListener('click', () => {
        const from = v.limit;
        v.limit += PAGE_SIZE;
        renderRows(v);
        // Le focus va à la première ligne ajoutée
        list.querySelectorAll<HTMLElement>('li.el2')[from]?.querySelector<HTMLElement>('button')?.focus();
      });
      foot.append(more);
    }
  }
}

function renderGroup(v: GroupView) {
  const g = v.key;
  const title = s.group[g];
  const count = g === 'pages' ? active().length : g === 'live' ? liveScriptsCount() : countOf(g);
  const listId = `list-${g}`;
  const whyId = `gwhy-${g}`;
  const toggle = h(
    'button',
    {
      type: 'button',
      class: 'bt ac2',
      'aria-expanded': String(v.open),
      'aria-controls': listId,
      'aria-label': fmt(v.open ? s.hideOf : s.showOf, { name: title }),
      'data-key': `toggle:${g}`,
    },
    icon(v.open ? ChevronUp : ChevronDown),
    v.open ? s.hide : s.show,
  );
  toggle.addEventListener('click', () => {
    v.open = !v.open;
    renderGroup(v);
    focusKey(`toggle:${g}`);
  });
  let why: HTMLElement = h('span', {});
  if (g !== 'pages') {
    why = h(
      'button',
      {
        type: 'button',
        class: 'wy',
        'aria-expanded': String(v.whyOpen),
        'aria-controls': whyId,
        'aria-label': fmt(s.whyOf, { name: title }),
        'data-key': `gwhy:${g}`,
      },
      icon(CircleQuestionMark),
      s.why,
    );
    why.addEventListener('click', () => {
      v.whyOpen = !v.whyOpen;
      renderGroup(v);
      focusKey(`gwhy:${g}`);
    });
  }
  const kids: HTMLElement[] = [
    h(
      'div',
      { class: 'gh2 gr' },
      h('span', { class: 'gi', 'aria-hidden': 'true' }, icon(GROUP_ICON[g], 20)),
      h('div', { class: 'tx' }, h('h2', { id: `gt-${g}` }, title), h('span', { class: 'mu' }, stateOf(g))),
      h('span', { class: 'cnt' }, String(count)),
      why,
      toggle,
    ),
  ];
  if (g !== 'pages' && v.whyOpen)
    kids.push(h('div', { class: 'why', id: whyId }, icon(Info), h('p', {}, s.groupWhy[g])));
  if (v.open) {
    const lst = h('div', { class: 'lst', id: listId });
    if (g !== 'pages') {
      const input = h('input', {
        type: 'search',
        class: 'fi-input',
        placeholder: s.filter,
        'aria-label': fmt(s.filterOf, { group: title }),
      });
      input.value = v.query;
      input.addEventListener('input', () => {
        v.query = input.value;
        v.limit = PAGE_SIZE;
        renderRows(v);
      });
      lst.append(h('div', { class: 'lh2' }, h('label', { class: 'fi' }, icon(Search), input)));
    }
    lst.append(
      h('ul', { class: 'rows', role: 'list', 'aria-labelledby': `gt-${g}` }),
      h('div', { class: 'ft2' }),
    );
    kids.push(lst);
  }
  v.root.replaceChildren(...kids);
  if (v.open) renderRows(v);
}

function focusKey(key: string) {
  document.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`)?.focus();
}

// ---------- Bilan ----------
function renderSummary() {
  // La tuile compte les scripts seuls ; les éléments ajoutés par un script sont nommés à part dans la note
  const pageOnly = countOf('pageScripts');
  const scripts = pageOnly + countOf('trackingScripts');
  // Éléments retirés de la copie (un élément gardé y reste)
  const elements = countOf('widgets') - keptIn('widgets');
  const prot = countOf('frames') + countOf('forms') + countOf('pii') + countOf('externalLinks');
  const keptN = REVIEW_GROUPS.reduce((n, g) => n + keptIn(g), 0);
  const cell = (label: string, n: number) =>
    h('div', {}, h('dt', { class: 'mu' }, label), h('dd', {}, String(n)));
  $('sumbar').replaceChildren(
    cell(s.sumPages, active().length),
    cell(s.sumScripts, scripts),
    cell(s.sumProtected, prot),
    cell(s.sumKept, keptN),
  );
  const note = $('note');
  note.hidden = scripts === 0 && elements === 0;
  const counts = { page: pageOnly, track: countOf('trackingScripts') };
  note.replaceChildren(
    icon(Info),
    h(
      'p',
      {},
      elements
        ? fmt(s.noteMix, {
            ...counts,
            scripts: plural(s.noteScripts_one, s.noteScripts_other, scripts),
            elements: plural(s.noteElements_one, s.noteElements_other, elements),
          })
        : plural(s.note_one, s.note_other, scripts, counts),
    ),
  );
}

/** Tout redessiner ; un groupe vide n'apparaît pas. */
function renderAll() {
  renderSummary();
  // Sandbox v2 : « Sandbox vivant » juste après les pages, seulement pour un Sandbox
  const order: GroupKey[] = ['pages', ...(liveOn() ? (['live'] as const) : []), ...REVIEW_GROUPS];
  const kids: HTMLElement[] = [];
  for (const g of order) {
    const n =
      g === 'pages' ? active().length : g === 'live' ? liveScriptsCount() + livePages().length : countOf(g);
    if (!n) continue;
    let v = views.get(g);
    if (!v) {
      v = {
        key: g,
        root: h('section', { class: 'grp', 'aria-labelledby': `gt-${g}` }),
        // Les pages se déplient d'office si l'une d'elles est trop lourde
        open: g === 'pages' && pages.some((p) => p.tooBig),
        whyOpen: false,
        query: '',
        limit: PAGE_SIZE,
        whyRows: new Set(),
      };
      views.set(g, v);
    }
    renderGroup(v);
    kids.push(v.root);
  }
  $('groups').replaceChildren(...kids);
  $<HTMLButtonElement>('send').disabled = sent || !active().some((p) => !p.tooBig);
}

/** Après « Garder » ou « Retirer » : le groupe et le bilan, le focus reste sur le bouton de la ligne. */
function refresh(g: GroupKey, key: string) {
  renderSummary();
  const v = views.get(g);
  if (v) renderGroup(v);
  focusKey(`act:${key}`);
}

// ---------- Fenêtre de confirmation ----------
function ask(title: string, body: string, ok: string, danger = false): Promise<boolean> {
  const dlg = $<HTMLDialogElement>('dlg');
  $('dlg-t').textContent = title;
  $('dlg-b').textContent = body;
  $('dlg-no').textContent = s.cancel;
  const yes = $('dlg-ok');
  yes.textContent = ok;
  yes.className = danger ? 'bt pr is-danger' : 'bt pr';
  const back = document.activeElement as HTMLElement | null;
  return new Promise((resolve) => {
    const done = (v: boolean) => {
      dlg.removeEventListener('close', onClose);
      yes.onclick = null;
      $('dlg-no').onclick = null;
      if (dlg.open) dlg.close();
      back?.focus();
      resolve(v);
    };
    const onClose = () => done(false);
    dlg.addEventListener('close', onClose);
    yes.onclick = () => done(true);
    $('dlg-no').onclick = () => done(false);
    dlg.showModal();
    $('dlg-no').focus();
  });
}
// Clic sur le voile : ferme
$<HTMLDialogElement>('dlg').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) (e.currentTarget as HTMLDialogElement).close();
});

// ---------- Retirer une page (annulable) ----------
let toastTimer: ReturnType<typeof setTimeout> | undefined;
function hideToast() {
  clearTimeout(toastTimer);
  $('toast').hidden = true;
  $('toast').replaceChildren();
}
function removePage(p: PendingHtmlPage) {
  gone.add(p.order);
  renderAll();
  const undo = h('button', { type: 'button', class: 'bt' }, s.undo);
  undo.addEventListener('click', () => {
    gone.delete(p.order);
    hideToast();
    renderAll();
    focusKey(`act:page:${p.order}`);
  });
  $('toast').replaceChildren(h('span', { class: 'tx' }, fmt(s.pageRemoved, { title: pageTitle(p) })), undo);
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 10000);
  // Le focus passe à la ligne suivante, sinon au bouton du groupe
  const next = active()[0];
  if (next && views.get('pages')?.open)
    focusKey(`act:page:${(active().find((x) => x.order > p.order) ?? next).order}`);
  else $('main').focus();
}

function alertMsg(msg: string | null) {
  $('alert').textContent = msg ?? '';
  $('alert').hidden = !msg;
}

// ---------- Type ----------
let kind: HtmlDemoKind = 'guided';
function renderKind() {
  const group = $('kind');
  const opts: Array<[HtmlDemoKind, string]> = [
    ['guided', s.guided],
    ['sandbox', s.sandbox],
  ];
  group.replaceChildren(
    ...opts.map(([value, label]) => {
      const b = h(
        'button',
        {
          type: 'button',
          role: 'radio',
          'aria-checked': String(kind === value),
          tabindex: kind === value ? '0' : '-1',
          'data-kind': value,
        },
        label,
      );
      b.addEventListener('click', () => pick(value));
      return b;
    }),
  );
}
function pick(value: HtmlDemoKind) {
  kind = value;
  renderKind();
  // Le groupe « Sandbox vivant » n'existe que pour un Sandbox
  if (pages.length) renderAll();
  $('kind').querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
}
$('kind').addEventListener('keydown', (e) => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
  e.preventDefault();
  pick(kind === 'guided' ? 'sandbox' : 'guided');
});

// ---------- Envoi ----------
let sent = false;
function titleError(show: boolean) {
  const input = $<HTMLInputElement>('vt');
  $('vt-err').hidden = !show;
  $('vt-err').textContent = show ? s.nameMissing : '';
  input.classList.toggle('er', show);
  if (show) {
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', 'vt-err');
  } else {
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
  }
}

/** Pages à envoyer, avec ce qui est gardé : données rétablies dans la copie, liens à réactiver. */
function toSend(): SendPage[] {
  // Sandbox v2 : texte lisible de toutes les copies (ce que la détection a laissé visible)
  const readable =
    kind === 'sandbox'
      ? active()
          .map((x) => readableText(x.html))
          .join(' ')
      : '';
  return active()
    .filter((p) => !p.tooBig)
    .map((p) => {
      const mine = (p.removed ?? []).filter((it) => kept.has(keyOf(p, it)));
      const pii = mine.filter((it) => it.group === 'pii').map((it) => it.id);
      const widgets = mine.filter((it) => it.reason === 'widgetThirdParty').map((it) => it.id);
      const restoredPii = restorePii(p.html, p.piiOriginals, pii);
      const restored = restoredPii.restored;
      // Lot B : ajouts de scripts tiers retirés, sauf ceux gardés
      const html = applyWidgets(restoredPii.html, widgets);
      const { piiOriginals: _local, live: raw, ...page } = p;
      // Sandbox v2 : mêmes valeurs neutres que la copie (sauf les données gardées), choix Garder / Bloquer
      const liveSend =
        kind === 'sandbox' && raw
          ? (() => {
              const r = redactLive(raw, pairsOf(p.piiOriginals, new Set(pii)), readable);
              return {
                url: r.url,
                html: r.html,
                scripts: r.scripts.map((sc) => ({ ...sc, keep: keepOf(p, sc) })),
                responses: r.responses,
              };
            })()
          : undefined;
      return {
        ...page,
        liveSend,
        html,
        security: { ...p.security, piiReplaced: Math.max(0, (p.security?.piiReplaced ?? 0) - restored) },
        keepLinks: mine
          .filter((it) => it.group === 'externalLinks' && linkKeepable(it))
          .map((it) => ({ sel: it.sel!, href: it.href!, label: itemName(it).name })),
      };
    });
}

async function main() {
  document.title = s.title;
  $('top-title').textContent = s.title;
  $('h1').textContent = s.title;
  $('intro').textContent = s.intro;
  $('vt-label').textContent = s.name;
  $('vk').textContent = s.type;
  $('server').textContent = s.server;
  $('delete').replaceChildren(icon(Trash2), s.delete);
  $('send').textContent = s.send;

  pages = (await htmlStore.all()).sort((a, b) => a.order - b.order);
  const target = (await browser.storage.local.get('fd.htmlReview'))['fd.htmlReview'] as
    | {
        workspaceId: string;
        title: string;
        appendTo?: string;
        folderId?: string | null;
        addTo?: { demoId: string; title: string; after: { n: number; title: string } | null } | null;
      }
    | undefined;
  const send = $<HTMLButtonElement>('send');
  if (!pages.length || !target) {
    alertMsg(s.nothing);
    send.disabled = true;
    $('vhead').hidden = true;
    $('sumbar').hidden = true;
    return;
  }

  // Titre : celui donné au départ, sinon « Capture du 23 nov. 2026 »
  const given = target.title && target.title !== 'Nouvelle démo' ? target.title : '';
  const date = new Date().toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' });
  const title = $<HTMLInputElement>('vt');
  title.value = given || fmt(s.nameDefault, { date });
  title.addEventListener('input', () => title.value.trim() && titleError(false));

  // Type : choisi dans « Nouvelle démo » (métadonnées du compte) ; à défaut, Sandbox quand les pages
  // sont reliées entre elles
  const chosen = await supabase.auth
    .getUser()
    .then(({ data }) => data.user?.user_metadata?.content_type as unknown)
    .catch(() => null);
  const linked = pages.length > 2 && pages.filter((p) => p.clickSel).length < pages.length - 1;
  // EXT-02 §1.2 : « HTML guidée » ou « Sandbox » choisi dans le popup au démarrage, prioritaire
  const asked = (await browser.storage.local.get('fd.htmlKind'))['fd.htmlKind'] as unknown;
  kind =
    asked === 'sandbox' || asked === 'guided'
      ? asked
      : chosen === 'sandbox'
        ? 'sandbox'
        : chosen === 'html'
          ? 'guided'
          : linked
            ? 'sandbox'
            : 'guided';
  if (target.appendTo) {
    // Capture lancée depuis un Sandbox de l'app : les pages s'y ajoutent, ni titre ni type à choisir
    $('kind').hidden = true;
    $('name-field').hidden = true;
    $('vhead').classList.add('is-append');
    let name = '';
    try {
      const { data } = await supabase.from('demos').select('title').eq('id', target.appendTo).maybeSingle();
      name = data?.title ?? '';
    } catch {
      /* nom illisible : libellé sans nom */
    }
    // EXT-02 §8.4 : ajout à une démo ouverte dans l'éditeur : destination et « Ajouter n étapes »
    const add = target.addTo;
    $('kline').replaceChildren(
      icon(Box),
      add
        ? (add.after ? strings.addDestAfter : strings.addDestStart)
            .replace('{{demo}}', add.title)
            .replace('{{n}}', String(add.after?.n ?? ''))
            .replace('{{title}}', add.after?.title ?? '')
        : name
          ? fmt(s.append, { name })
          : s.appendUnnamed,
    );
    $('kline').hidden = false;
    if (add) {
      const label = () => {
        const n = toSend().length;
        send.textContent = (n === 1 ? strings.addSend_one : strings.addSend_other).replace(
          '{{count}}',
          String(n),
        );
      };
      label();
      // Une page retirée ou gardée change le nombre d'étapes ajoutées
      document.addEventListener('click', () => requestAnimationFrame(label));
    }
  } else renderKind();

  renderAll();

  send.addEventListener('click', async () => {
    if (!target.appendTo && !title.value.trim()) {
      titleError(true);
      title.focus();
      return;
    }
    const batch = toSend();
    if (!batch.length) return alertMsg(s.noPageLeft);
    send.disabled = true;
    hideToast();
    alertMsg(null);
    try {
      const { demoId, dropped, stepIds } = await sendHtml(
        batch,
        {
          workspaceId: target.workspaceId,
          title: title.value.trim(),
          kind: target.appendTo ? 'sandbox' : kind,
          appendTo: target.appendTo,
          folderId: target.folderId ?? null,
        },
        (done) => {
          $('progress').textContent = fmt(s.sending, { done, total: batch.length });
        },
      );
      await htmlStore.clear();
      await browser.storage.local.remove(['fd.htmlReview', 'fd.attach']);
      // L60 §3 : « ready » : toast « Démo prête » et étapes « Nouvelle » dans l'éditeur (nouvelle démo)
      const url = `${APP_URL.replace(/\/$/, '')}/#/demos/${demoId}/edit${target.addTo || target.appendTo ? '' : `?ready=${batch.length}`}`;
      void supabase
        .rpc('extension_report', { p_version: browser.runtime.getManifest().version, p_demo: demoId })
        .then(
          () => undefined,
          () => undefined,
        );
      // EXT-02 §8.4 : l'éditeur lit les étapes créées et les place ; l'extension lui rend la main
      let back: { windowId?: number } | null = null;
      if (target.addTo) {
        const t = (await browser.storage.local.get(ADD_KEY))[ADD_KEY] as AddTarget | undefined;
        if (t && t.demoId === demoId) {
          await browser.storage.local.set({ [ADD_KEY]: { ...t, state: 'sent', stepIds } });
          back =
            t.editorTabId !== null
              ? ((await browser.tabs.update(t.editorTabId, { active: true }).catch(() => null)) ?? null)
              : null;
        }
      }
      if (!dropped.length) {
        $('progress').textContent = s.sent;
        if (back) {
          if (back.windowId !== undefined)
            await browser.windows.update(back.windowId, { focused: true }).catch(() => undefined);
          const self = await browser.tabs.getCurrent();
          if (self?.id !== undefined) return void browser.tabs.remove(self.id);
        }
        location.href = url;
        return;
      }
      // §2.4 : le serveur a retiré un élément gardé ; on le dit avant d'ouvrir la démo
      sent = true;
      $('progress').textContent = '';
      $<HTMLButtonElement>('delete').disabled = true;
      const open = h('a', { class: 'bt', href: url }, s.openDemo);
      $('srv').replaceChildren(
        icon(TriangleAlert, 20),
        h(
          'div',
          {},
          h('b', {}, plural(s.srv_one, s.srv_other, dropped.length)),
          ...dropped.map((d) => h('span', { class: 'mu' }, fmt(s.srvLink, { label: d.label, host: d.host }))),
        ),
        open,
      );
      $('srv').hidden = false;
      scrollTo({ top: 0 });
      open.focus();
    } catch {
      send.disabled = false;
      $('progress').textContent = '';
      alertMsg(s.sendError);
    }
  });

  $('delete').addEventListener('click', async () => {
    if (!(await ask(s.deleteTitle, s.deleteBody, s.deleteOk, true))) return;
    await htmlStore.clear();
    await browser.storage.local.remove('fd.htmlReview');
    window.close();
  });
}
void main();
