import { openExternal } from './openExternal';
import { mediaPublicUrl } from './config';
import type { ComponentChildren } from 'preact';
import { Info, MousePointerClick, Plus } from 'lucide-preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Rect, SandboxSettings, Step } from '@flowdsiml/manifest';
import {
  FRAME_SANDBOX,
  buildLiveSrcdoc,
  buildSrcdoc,
  mergeResponses,
  pageKey,
  parseFromFrame,
  type FrameOp,
  type LivePage,
  type ToFrame,
} from '@flowdsiml/player-core';
import { fmt, type Dict } from './i18n';

/** L49 §4 : seules les adresses https peuvent être ouvertes (même règle que l'éditeur et la base). */
const EXTLINK_RE = /^https:\/\/[^\s"'<>]+$/;

/**
 * A8 (L20) : étape HTML. La page capturée est rendue en iframe srcdoc sandbox (origine opaque, CSP
 * stricte, notre seul script) à la taille capturée, mise à l'échelle du lecteur. Elle reste du vrai
 * texte, lisible par un lecteur d'écran ; les éléments masqués sont retirés du rendu.
 * Démo guidée : la page prend la scène des captures (même cadre, même largeur, bulle de l'étape posée
 * par le lecteur) ; liens vers une étape. Sandbox : navigation libre entre les pages reliées, avec sa
 * barre (pages clés, « Zones cliquables »).
 * EXT-02 §3 : la bascule « Zones cliquables » (touche H) entoure en bleu les éléments reliés ; un clic à
 * côté les illumine un instant et affiche « Aucun lien à cet endroit » avec leur nombre.
 */
/**
 * Sandbox v2 : enregistrements vivants déjà lus (une fois par adresse signée, pour toute la visite). Un
 * enregistrement illisible est retiré du cache : la page reste inerte.
 */
const liveCache = new Map<string, Promise<LivePage>>();
function loadLive(url: string): Promise<LivePage> {
  let p = liveCache.get(url);
  if (!p) {
    p = fetch(url).then((r) =>
      r.ok ? (r.json() as Promise<LivePage>) : Promise.reject(new Error(String(r.status))),
    );
    liveCache.set(url, p);
    p.catch(() => liveCache.delete(url));
  }
  return p;
}

/** Choix « Zones cliquables » gardé dans le navigateur (par personne). */
const ZONES_KEY = 'tc.player.zones';
const readZones = () => {
  try {
    return localStorage.getItem(ZONES_KEY) === '1';
  } catch {
    return false;
  }
};
export function HtmlStep({
  step,
  t,
  sub,
  sandbox,
  onGo,
  status,
  target = null,
  onHit,
  overlay,
  onAddZone,
  chrome,
  livePages = [],
}: {
  step: Step;
  t: Dict;
  sub: (s: string) => string;
  /** Réglages du Sandbox (null : démo guidée). */
  sandbox: SandboxSettings | null;
  onGo: (stepId: string) => void;
  /** Sandbox : « n pages clés vues sur N ». */
  status?: string;
  /** A8 guide : zone visée par la bulle courante (sélecteur unique, sinon rect de secours). */
  target?: { sel: string | null; rect: Rect } | null;
  /** A8 guide : clic du visiteur dans la zone visée. */
  onHit?: () => void;
  /**
   * A8 guide : calque posé sur la page, avec la zone visée en fractions du cadre (null : pas encore
   * située) et found (false : sélecteur introuvable, la zone est le rect de secours).
   */
  overlay?: (box: Rect | null, found: boolean) => ComponentChildren;
  /**
   * EXT-02 §3.3, aperçu de l'éditeur seulement : « Ajouter une zone » quand la page n'a aucune zone
   * cliquable. Absent dans le lecteur public (l'encart n'y apparaît jamais).
   */
  onAddZone?: () => void;
  /**
   * Lot B (recette UX §3.4) : Sandbox, cadre du navigateur au-dessus de la page, avec l'adresse de la
   * page courante (absent : sans cadre).
   */
  chrome?: { style: 'light' | 'dark' | 'minimal'; dots: boolean; address: string | null };
  /**
   * Sandbox v2 : pages vivantes de la démo (étape et adresse de son enregistrement). Sert aux réponses
   * rejouées (celles de toute la démo) et à la navigation par adresse.
   */
  livePages?: Array<{ id: string; url: string }>;
}) {
  const h = step.html!;
  const ht = t.html;
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  /** Sandbox v2 : adresse d'une page capturée → étape ; une navigation vers la page elle-même la recharge. */
  const navMap = useRef(new Map<string, string>());
  const [reload, setReload] = useState(0);
  /** Page rejouée avec ses scripts (pas de « zone cliquable » à ajouter : la page réagit elle-même). */
  const [isLive, setIsLive] = useState(false);
  const live = sandbox ? h.live : null;
  const liveKey = livePages.map((p) => `${p.id}:${p.url}`).join('|');
  const [toast, setToast] = useState<string | null>(null);
  /** EXT-02 §3 : nombre de zones cliquables de la page (null : pas encore compté), bascule, message. */
  const [zones, setZones] = useState<number | null>(null);
  const [zonesOn, setZonesOn] = useState(readZones);
  const [miss, setMiss] = useState(false);
  const missTimer = useRef(0);
  /** EXT-02 §3.3 : « Continuer sans zone » referme l'encart pour cette étape. */
  const [noZoneClosed, setNoZoneClosed] = useState(false);
  const toggleZones = useCallback((on?: boolean) => {
    setZonesOn((cur) => {
      const next = on ?? !cur;
      try {
        localStorage.setItem(ZONES_KEY, next ? '1' : '0');
      } catch {
        /* préférence non gardée */
      }
      return next;
    });
    setMiss(false);
  }, []);
  /** L49 §4 : lien externe autorisé en attente de confirmation (adresse de l'opération). */
  const [leave, setLeave] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [ready, setReady] = useState(false);
  /** A8 guide : zone visée, en px de la page (avant mise à l'échelle) ; found : élément trouvé. */
  const [spot, setSpot] = useState<{ rect: Rect; found: boolean } | null>(null);
  const [boxW, setBoxW] = useState(0);
  const vw = h.viewport?.w ?? 1280;
  const vh = h.viewport?.h ?? 800;
  /** Démo guidée : la page tient dans la scène des captures (taille donnée par la feuille de style). */
  const guided = !sandbox;

  useEffect(() => {
    let alive = true;
    setDoc(null);
    setReady(false);
    setFailed(false);
    setZones(null);
    setMiss(false);
    const inert = () =>
      fetch(h.url)
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
        .then(buildSrcdoc);
    // Sandbox v2 : page rejouée avec ses scripts gardés et les réponses de toute la démo ; sinon inerte
    const vivante = async () => {
      const list = (
        await Promise.all(
          livePages.map((p) =>
            loadLive(p.url)
              .then((page) => ({ id: p.id, page }))
              .catch(() => null),
          ),
        )
      ).filter((x): x is { id: string; page: LivePage } => !!x);
      const own = list.find((x) => x.id === step.id);
      if (!live || !own) throw new Error('LIVE_MISSING');
      navMap.current = new Map(list.map((x) => [pageKey(x.page.url), x.id]));
      return buildLiveSrcdoc({
        ...own.page,
        scripts: own.page.scripts.map((sc) => ({ ...sc, keep: live.keep.includes(sc.id) })),
        responses: mergeResponses(
          own.page,
          list.map((x) => x.page),
        ),
      });
    };
    setIsLive(false);
    (live
      ? vivante()
          .then((d) => {
            if (alive) setIsLive(true);
            return d;
          })
          .catch(inert)
      : inert()
    )
      .then((d) => alive && setDoc(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h.url, live?.url, live?.keep.join(','), liveKey]);

  // Mise à l'échelle : la page garde sa largeur capturée et tient dans la scène, en largeur comme en
  // hauteur (comme les captures image) ; sinon elle débordait sur la barre du haut et les contrôles
  useEffect(() => {
    const el = box.current;
    // Lot B : en Sandbox, la page peut être dans un cadre de navigateur ; la mesure se fait sur l'étape
    const step = el?.closest<HTMLElement>('.p-html-step') ?? el?.parentElement;
    if (!el || !step) return;
    if (guided) {
      // La scène a déjà sa taille (proportions de la page capturée) : la page la remplit
      const fit = new ResizeObserver(() => {
        const w = el.clientWidth;
        if (!w) return;
        setScale(w / vw);
        setBoxW(w);
      });
      fit.observe(el);
      return () => fit.disconnect();
    }
    const wrap = el.closest<HTMLElement>('.p-stage-wrap');
    const ro = new ResizeObserver(() => {
      const full = step.clientWidth;
      let availH = Infinity;
      if (wrap) {
        const cs = getComputedStyle(wrap);
        // Hauteur de la scène, moins ce qui accompagne le cadre (repère « page interactive »)
        availH =
          wrap.clientHeight -
          parseFloat(cs.paddingTop) -
          parseFloat(cs.paddingBottom) -
          (step.offsetHeight - el.offsetHeight);
      }
      const s = Math.min(1, full / vw, availH > 0 ? availH / vh : 1);
      setScale(s);
      setBoxW(Math.min(full, Math.floor(vw * s)));
    });
    ro.observe(step);
    if (wrap) ro.observe(wrap);
    return () => ro.disconnect();
  }, [vw, vh, guided]);

  /** Opérations envoyées à la page : variables résolues, images https ou data:image seulement. */
  const ops = useMemo<FrameOp[]>(
    () =>
      h.ops
        // L28 051 : image remplacée prise dans la médiathèque de l'espace (fichier public)
        .map((o) =>
          o.op === 'image' && typeof o.value === 'string' && /^[0-9a-f-]{36}\//.test(o.value)
            ? { ...o, value: mediaPublicUrl(o.value) }
            : o,
        )
        .filter(
          (o) => o.op !== 'image' || (typeof o.value === 'string' && /^(https:|data:image\/)/.test(o.value)),
        )
        // L49 §4 : lien externe autorisé seulement vers une adresse https
        .filter((o) => o.op !== 'extlink' || (typeof o.value === 'string' && EXTLINK_RE.test(o.value)))
        .map((o) => ({
          id: o.id,
          sel: o.sel,
          op: o.op,
          ...(o.sels ? { sels: o.sels } : {}),
          ...(o.fit ? { fit: o.fit } : {}),
          // Style et graphique : objets revalidés dans la page (liste blanche, valeurs numériques)
          value: o.op === 'text' ? sub(typeof o.value === 'string' ? o.value : '') : o.value,
        })),
    [h.ops, sub],
  );

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const win = frame.current?.contentWindow;
      if (!win || e.source !== win) return;
      const m = parseFromFrame(e.data);
      if (!m) return;
      if (m.t === 'ready') {
        const init: ToFrame = {
          fd: 1,
          t: 'init',
          mode: 'player',
          ops,
          autoLinks: sandbox?.autoLink ? h.links : [],
          unlinked: sandbox ? sandbox.unlinked : 'toast',
        };
        // Origine opaque : seule la cible « * » est possible ; aucun secret n'est transmis
        win.postMessage(init, '*');
        setReady(true);
      } else if (m.t === 'target') setSpot({ rect: m.rect, found: m.found });
      else if (m.t === 'hit') onHit?.();
      else if (m.t === 'go') onGo(m.step);
      else if (m.t === 'nav') {
        // Sandbox v2 : page capturée de même adresse ; elle-même : rechargée (stockage neuf)
        const id = navMap.current.get(pageKey(m.url));
        if (id === step.id) setReload((n) => n + 1);
        else if (id) onGo(id);
        else if (sandbox?.unlinked !== 'none') {
          setToast(null);
          setMiss(true);
          window.clearTimeout(missTimer.current);
          missTimer.current = window.setTimeout(() => setMiss(false), 5000);
        }
      } else if (m.t === 'zones') setZones(m.n);
      else if (m.t === 'zones-key') toggleZones();
      else if (m.t === 'unlinked' && m.ext) {
        setMiss(false);
        setToast(ht.outside);
        window.setTimeout(() => setToast(null), 3000);
      } else if (m.t === 'unlinked') {
        // EXT-02 §3.2 : « Aucun lien à cet endroit », 5 s ou jusqu'au clic suivant
        setToast(null);
        setMiss(true);
        window.clearTimeout(missTimer.current);
        missTimer.current = window.setTimeout(() => setMiss(false), 5000);
      } else if (m.t === 'ext') {
        // L'adresse vient de l'opération publiée, jamais de la page
        const o = ops.find((x) => x.op === 'extlink' && x.id === m.id);
        if (o && typeof o.value === 'string') setLeave(o.value);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [ops, sandbox, h.links, onGo, ht, onHit, toggleZones, step.id]);

  // EXT-02 §3.1 : cadres des zones, aux couleurs du thème du lecteur
  useEffect(() => {
    const win = frame.current?.contentWindow;
    if (!win || !ready) return;
    const dark = !!box.current?.closest('.is-dark');
    const msg: ToFrame = { fd: 1, t: 'zones', show: zonesOn && (zones ?? 0) > 0, dark };
    win.postMessage(msg, '*');
  }, [ready, zonesOn, zones]);
  // Touche H (hors champ de saisie) ; dans la page capturée, la touche est relayée par le cadre
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== 'h' || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if ((zones ?? 0) > 0) toggleZones();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zones, toggleZones]);
  // Le message disparaît au clic suivant, où qu'il soit
  useEffect(() => {
    if (!miss) return;
    const off = (e: MouseEvent) => {
      if (!(e.target as Element | null)?.closest?.('.p-html-miss')) setMiss(false);
    };
    window.addEventListener('click', off);
    return () => window.removeEventListener('click', off);
  }, [miss]);
  useEffect(() => () => window.clearTimeout(missTimer.current), []);

  // A8 guide : la page suit la zone visée et renvoie sa position (défilement, taille)
  const targetKey = target ? JSON.stringify(target) : '';
  useEffect(() => {
    const win = frame.current?.contentWindow;
    setSpot(null);
    if (!win || !ready) return;
    const msg: ToFrame = target
      ? { fd: 1, t: 'target', sel: target.sel, rect: target.rect }
      : { fd: 1, t: 'target', clear: true };
    win.postMessage(msg, '*');
  }, [ready, targetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const title = h.title || step.title || '';
  const page = (
    <>
      <div
        class={guided ? 'p-stage p-html-frame' : 'p-html-frame'}
        ref={box}
        style={
          guided
            ? { '--ratio': String(vw / vh) }
            : { height: `${Math.round(vh * scale)}px`, width: boxW ? `${boxW}px` : '100%' }
        }
      >
        {doc ? (
          <iframe
            ref={frame}
            key={`${step.id}:${reload}`}
            srcdoc={doc}
            sandbox={FRAME_SANDBOX}
            referrerpolicy="no-referrer"
            title={fmt(ht as unknown as Record<string, string>, 'frame', { title })}
            // Plus large que la capture : la page occupe toute la largeur (elle se réorganise)
            style={{
              width: `${Math.max(vw, boxW / scale)}px`,
              height: `${vh}px`,
              transform: `scale(${scale})`,
            }}
          />
        ) : (
          <p class="p-html-state" role={failed ? 'alert' : 'status'}>
            {failed ? ht.error : ht.loading}
          </p>
        )}
        {overlay?.(
          spot && boxW > 0
            ? {
                x: (spot.rect.x * scale) / boxW,
                y: spot.rect.y / vh,
                w: (spot.rect.w * scale) / boxW,
                h: spot.rect.h / vh,
              }
            : null,
          spot?.found ?? true,
        )}
        <div class="p-html-toast" role="status" aria-live="polite">
          {toast ?? ''}
        </div>
        {/* Démo guidée : une bulle posée sur un élément fait avancer au clic, ce n'est pas une impasse */}
        {onAddZone && ready && zones === 0 && !isLive && !(target && !sandbox) && !noZoneClosed && (
          <div class="p-html-nozone" role="status">
            <Info aria-hidden="true" />
            <div class="p-html-nozone-tx">
              <b>{sandbox ? ht.noZoneTitleSandbox : ht.noZoneTitle}</b>
              <p>{sandbox ? ht.noZoneSandbox : ht.noZoneGuided}</p>
              <div class="p-html-nozone-acts">
                <button type="button" class="p-btn p-btn-primary" onClick={onAddZone}>
                  <Plus aria-hidden="true" />
                  {ht.addZone}
                </button>
                <button type="button" class="p-btn p-btn-secondary" onClick={() => setNoZoneClosed(true)}>
                  {ht.continueNoZone}
                </button>
              </div>
            </div>
          </div>
        )}
        <div class="p-html-miss" role="status" aria-live="polite">
          {miss && (
            <>
              <MousePointerClick aria-hidden="true" />
              <p class="p-html-miss-tx">
                <b>{ht.noLink}</b>
                <span>
                  {(zones ?? 0) === 0
                    ? ht.zonesNone
                    : zones === 1
                      ? ht.zonesOne
                      : fmt(ht as unknown as Record<string, string>, 'zonesMany', { n: String(zones) })}
                </span>
              </p>
              {(zones ?? 0) > 0 && !zonesOn && (
                <button type="button" class="p-html-miss-bt" onClick={() => toggleZones(true)}>
                  {ht.showZones}
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {leave && <LeaveDialog url={leave} ht={ht} onClose={() => setLeave(null)} />}
    </>
  );
  // Démo guidée : ni titre ni barre sous la page (ils relèvent du Sandbox), comme une capture
  if (guided) return page;
  return (
    <div class="p-html-step">
      {chrome ? (
        <div class={`p-win p-win--${chrome.style} p-win--sb`}>
          <div class="p-chrome" aria-hidden="true">
            <div class="p-tabs p-tabs--addr">
              {chrome.dots && chrome.style !== 'minimal' && (
                <span class="p-tabs-dots">
                  <i />
                  <i />
                  <i />
                </span>
              )}
              {chrome.address !== null && <span class="p-addr">{chrome.address}</span>}
            </div>
          </div>
          {page}
        </div>
      ) : (
        page
      )}
      <div class="p-html-bar">
        {/* Sandbox : le repère des pages clés tient la place du titre de l'étape */}
        {status ? (
          <p class="p-html-key" aria-live="polite">
            {status}
          </p>
        ) : (
          <span class="p-html-title" />
        )}
        <button
          type="button"
          class={`p-html-zones${zonesOn && (zones ?? 0) > 0 ? ' is-on' : ''}`}
          aria-pressed={zonesOn && (zones ?? 0) > 0}
          aria-keyshortcuts="H"
          disabled={(zones ?? 0) === 0}
          onClick={() => toggleZones()}
        >
          <MousePointerClick aria-hidden="true" />
          {ht.zones}
          <span class="p-html-zones-n">{zones ?? 0}</span>
        </button>
      </div>
    </div>
  );
}

/**
 * L49 §4 : « Vous quittez la démo ». Le domaine affiché est celui de l'adresse réelle, jamais le texte
 * du lien (protection contre l'hameçonnage). « Rester dans la démo » a le focus ; « Ouvrir » ouvre un
 * nouvel onglet depuis le lecteur, sans opener ni referrer (la page capturée garde son sandbox).
 */
function LeaveDialog({ url, ht, onClose }: { url: string; ht: Dict['html']; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const stay = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    stay.current?.focus();
  }, []);
  let domain = '';
  try {
    domain = new URL(url).hostname;
  } catch {
    /* adresse déjà validée (https) */
  }
  return (
    <dialog
      ref={ref}
      class="p-leave"
      aria-labelledby="p-leave-t"
      aria-describedby="p-leave-b"
      onClose={onClose}
    >
      <h2 id="p-leave-t">{ht.leaveTitle}</h2>
      <p id="p-leave-b">
        {ht.leaveBody} <strong>{domain}</strong>
      </p>
      <div class="p-leave-acts">
        <button ref={stay} type="button" class="p-btn p-btn-secondary" onClick={() => ref.current?.close()}>
          {ht.leaveStay}
        </button>
        <button
          type="button"
          class="p-btn p-btn-primary"
          onClick={() => {
            openExternal(url, '_blank');
            ref.current?.close();
          }}
        >
          {ht.leaveOpen}
        </button>
      </div>
    </dialog>
  );
}
