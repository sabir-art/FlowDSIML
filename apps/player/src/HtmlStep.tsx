import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { SandboxSettings, Step } from '@flowdsiml/manifest';
import {
  FRAME_SANDBOX,
  buildSrcdoc,
  parseFromFrame,
  type FrameOp,
  type ToFrame,
} from '@flowdsiml/player-core';
import { fmt, type Dict } from './i18n';

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
}: {
  step: Step;
  t: Dict;
  sub: (s: string) => string;
  /** Réglages du Sandbox (null : démo guidée). */
  sandbox: SandboxSettings | null;
  nextLabel: string;
  onNext: () => void;
  onGo: (stepId: string) => void;
}) {
  const h = step.html!;
  const ht = t.html;
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [toast, setToast] = useState(false);
  const [scale, setScale] = useState(1);
  const vw = h.viewport?.w ?? 1280;
  const vh = h.viewport?.h ?? 800;

  useEffect(() => {
    let alive = true;
    setDoc(null);
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

  // Mise à l'échelle : la page garde sa largeur capturée
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / vw)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [vw]);

  /** Opérations envoyées à la page : variables résolues, images https ou data:image seulement. */
  const ops = useMemo<FrameOp[]>(
    () =>
      h.ops
        .filter((o) => o.op !== 'image' || /^(https:|data:image\/)/.test(o.value ?? ''))
        .map((o) => ({
          id: o.id,
          sel: o.sel,
          op: o.op,
          value: o.op === 'text' ? sub(o.value ?? '') : o.value,
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
      } else if (m.t === 'go') onGo(m.step);
      else if (m.t === 'unlinked') {
        setToast(true);
        window.setTimeout(() => setToast(false), 3000);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [ops, sandbox, h.links, onGo]);

  const title = h.title || step.title || '';
  return (
    <div class="p-html-step">
      <div class="p-html-frame" ref={box} style={{ height: `${Math.round(vh * scale)}px` }}>
        {doc ? (
          <iframe
            ref={frame}
            key={step.id}
            srcdoc={doc}
            sandbox={FRAME_SANDBOX}
            referrerpolicy="no-referrer"
            title={fmt(ht as unknown as Record<string, string>, 'frame', { title })}
            style={{ width: `${vw}px`, height: `${vh}px`, transform: `scale(${scale})` }}
          />
        ) : (
          <p class="p-html-state" role={failed ? 'alert' : 'status'}>
            {failed ? ht.error : ht.loading}
          </p>
        )}
        <div class="p-html-toast" role="status" aria-live="polite">
          {toast ? ht.unavailable : ''}
        </div>
      </div>
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
