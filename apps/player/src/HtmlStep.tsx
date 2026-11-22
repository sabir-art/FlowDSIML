import { openExternal } from './openExternal';
import { mediaPublicUrl } from './config';
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Rect, SandboxSettings, Step } from '@flowdsiml/manifest';
import {
  FRAME_SANDBOX,
  buildSrcdoc,
  parseFromFrame,
  type FrameOp,
  type ToFrame,
} from '@flowdsiml/player-core';
import { fmt, type Dict } from './i18n';

/** L49 §4 : seules les adresses https peuvent être ouvertes (même règle que l'éditeur et la base). */
const EXTLINK_RE = /^https:\/\/[^\s"'<>]+$/;

/**
 * A8 (L20) : étape HTML. La page capturée est rendue en iframe srcdoc sandbox (origine opaque, CSP
 * stricte, notre seul script) à la taille capturée, mise à l'échelle du lecteur. Elle reste du vrai
 * texte, lisible par un lecteur d'écran ; les éléments masqués sont retirés du rendu.
 * Démo guidée : « Suivant » et liens vers une étape. Sandbox : navigation libre entre les pages
 * reliées ; un clic non relié affiche « Cette partie n'est pas disponible dans la démo ».
 */
export function HtmlStep({
  step,
  t,
  sub,
  sandbox,
  nextLabel,
  onNext,
  onGo,
  status,
  target = null,
  onHit,
  overlay,
}: {
  step: Step;
  t: Dict;
  sub: (s: string) => string;
  /** Réglages du Sandbox (null : démo guidée). */
  sandbox: SandboxSettings | null;
  nextLabel: string;
  onNext: () => void;
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
}) {
  const h = step.html!;
  const ht = t.html;
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  /** L49 §4 : lien externe autorisé en attente de confirmation (adresse de l'opération). */
  const [leave, setLeave] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [ready, setReady] = useState(false);
  /** A8 guide : zone visée, en px de la page (avant mise à l'échelle) ; found : élément trouvé. */
  const [spot, setSpot] = useState<{ rect: Rect; found: boolean } | null>(null);
  const [boxW, setBoxW] = useState(0);
  const vw = h.viewport?.w ?? 1280;
  const vh = h.viewport?.h ?? 800;

  useEffect(() => {
    let alive = true;
    setDoc(null);
    setReady(false);
    setFailed(false);
    fetch(h.url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then(buildSrcdoc)
      .then((d) => alive && setDoc(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [h.url]);

  // Mise à l'échelle : la page garde sa largeur capturée et tient dans la scène, en largeur comme en
  // hauteur (comme les captures image) ; sinon elle débordait sur la barre du haut et les contrôles
  useEffect(() => {
    const el = box.current;
    const step = el?.parentElement;
    if (!el || !step) return;
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
  }, [vw, vh]);

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
      else if (m.t === 'unlinked') {
        setToast(m.ext ? ht.outside : ht.unavailable);
        window.setTimeout(() => setToast(null), 3000);
      } else if (m.t === 'ext') {
        // L'adresse vient de l'opération publiée, jamais de la page
        const o = ops.find((x) => x.op === 'extlink' && x.id === m.id);
        if (o && typeof o.value === 'string') setLeave(o.value);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [ops, sandbox, h.links, onGo, ht, onHit]);

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
  return (
    <div class="p-html-step">
      <div
        class="p-html-frame"
        ref={box}
        style={{ height: `${Math.round(vh * scale)}px`, width: boxW ? `${boxW}px` : '100%' }}
      >
        {doc ? (
          <iframe
            ref={frame}
            key={step.id}
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
      </div>
      {leave && <LeaveDialog url={leave} ht={ht} onClose={() => setLeave(null)} />}
      {status && (
        <p class="p-html-key" aria-live="polite">
          {status}
        </p>
      )}
      {!sandbox && (
        <div class="p-html-bar">
          <span class="p-html-title">{sub(step.title ?? '')}</span>
          <button type="button" class="pill pill-p" onClick={onNext}>
            {nextLabel}
          </button>
        </div>
      )}
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
