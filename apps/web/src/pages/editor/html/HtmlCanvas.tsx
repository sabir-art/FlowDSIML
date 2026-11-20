import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Copy, Droplet, EyeOff, ImageUp, Link2, MoreHorizontal, PenLine, Trash2 } from 'lucide-react';
import { MediaLibrary, mediaUrl } from '../../../components/media/MediaLibrary';
import { useToast } from '../../../components/Toast';
import {
  FRAME_SANDBOX,
  buildSrcdoc,
  parseFromFrame,
  type FrameOp,
  type ToFrame,
} from '@flowdsiml/player-core';
import type { DemoEditor } from '../useDemoEditor';
import type { StepRow } from '../types';
import { asOps, frameSend, opOn, removeOp, setHtmlEdit, upsertOp, useHtmlEdit } from './htmlModel';
import './html.css';

const ICON = { size: 16, 'aria-hidden': true } as const;

/**
 * A8 (L20-01) : étape HTML dans l'éditeur. La page capturée est rendue telle quelle dans le cadre
 * navigateur (iframe srcdoc sandbox, origine opaque) ; survol en pointillé, sélection avec
 * étiquette, fil du sélecteur en tête ; barre d'actions (toolbar) sous l'élément, retournée
 * au-dessus s'il n'y a pas la place, sans jamais le couvrir. Tout se fait aussi au clavier.
 */
export function HtmlCanvas({
  editor,
  step,
  readOnly,
}: {
  editor: DemoEditor;
  step: StepRow;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const ed = useHtmlEdit(step.id);
  const [crumbSlot, setCrumbSlot] = useState<HTMLElement | null>(null);
  useEffect(() => setCrumbSlot(document.getElementById('html-crumbs-slot')), [step.id]);
  const frame = useRef<HTMLIFrameElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [scale, setScale] = useState(1);
  const [menu, setMenu] = useState<'more' | 'link' | null>(null);
  const toast = useToast();
  const [notice, setNotice] = useState('');
  const [barPos, setBarPos] = useState<{ left: number; top: number } | null>(null);
  const url = step.html_path ? editor.imageUrls[step.html_path] : undefined;
  const meta = (step.html_meta ?? {}) as {
    title?: string;
    url?: string;
    viewport?: { w: number; h: number };
  };
  const vw = meta.viewport?.w ?? 1280;
  const vh = meta.viewport?.h ?? 800;
  const ops = asOps(step.html_ops);
  const frameOps = useMemo<FrameOp[]>(
    // L28 051 : images remplacées affichées depuis la médiathèque (fichier public de l'espace)
    () =>
      ops.map((o) => ({
        id: o.id,
        sel: o.sel,
        op: o.op,
        value: o.op === 'image' && typeof o.value === 'string' ? mediaUrl(o.value) : o.value,
        ...(o.sels ? { sels: o.sels } : {}),
        ...(o.fit ? { fit: o.fit } : {}),
      })),
    [step.html_ops], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const ready = useRef(false);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    setDoc(null);
    setFailed(false);
    ready.current = false;
    fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then(buildSrcdoc)
      .then((d) => alive && setDoc(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [url]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / vw)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [vw, doc]);

  const post = (m: ToFrame) => frame.current?.contentWindow?.postMessage(m, '*');
  useEffect(() => {
    frameSend.current = (m) => post({ fd: 1, ...m } as ToFrame);
    return () => {
      frameSend.current = null;
    };
  });

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const win = frame.current?.contentWindow;
      if (!win || e.source !== win) return;
      const m = parseFromFrame(e.data);
      if (!m) return;
      if (m.t === 'ready') {
        ready.current = true;
        post({ fd: 1, t: 'init', mode: 'editor', ops: frameOps });
      } else if (m.t === 'applied') setHtmlEdit({ notFound: m.notFound });
      else if (m.t === 'select') {
        setMenu(null);
        setHtmlEdit({ selected: m.el, multi: [] });
      } else if (m.t === 'multi') {
        setMenu(null);
        // L25-07 : nombre d'éléments annoncé
        setHtmlEdit({ multi: m.els.length > 1 ? m.els : [] });
        if (m.els.length > 1) setNotice(t('editor.data.multiAnnounce', { count: m.els.length }));
      } else if (m.t === 'key' && !readOnly && ed.selected) {
        if (m.key === 'edit') setHtmlEdit({ focusText: ed.focusText + 1 });
        else toggle('hide');
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  });

  // Opérations modifiées (panneau, annulation) : la page est rejouée
  useEffect(() => {
    if (ready.current) post({ fd: 1, t: 'ops', ops: frameOps });
  }, [frameOps]);

  // Barre d'actions : sous l'élément, au-dessus s'il n'y a pas la place ; jamais dessus
  useLayoutEffect(() => {
    const sel = ed.selected;
    if (!sel || !wrap.current || !bar.current) return setBarPos(null);
    const box = wrap.current.getBoundingClientRect();
    const bh = bar.current.offsetHeight || 40;
    const bw = bar.current.offsetWidth || 420;
    const top = sel.rect.y * scale;
    const bottom = (sel.rect.y + sel.rect.h) * scale;
    const below = bottom + 8;
    const above = top - bh - 8;
    // L25-08 : au-dessus d'un graphique (son panneau est à droite), pour ne rien masquer dessous
    const y = sel.chart && above >= 0 ? above : below + bh <= box.height ? below : Math.max(0, above);
    const x = Math.min(Math.max(0, sel.rect.x * scale), Math.max(0, box.width - bw));
    setBarPos({ left: x, top: y });
  }, [ed.selected, scale]);

  function toggle(op: 'hide' | 'blur' | 'remove') {
    const sel = ed.selected;
    if (!sel) return;
    const existing = opOn(step, sel.sel, op);
    if (existing) removeOp(editor, step, existing.id);
    else upsertOp(editor, step, { sel: sel.sel, op, before: sel.text.trim().slice(0, 200) }, ed.scope);
  }
  function linkTo(stepId: string | null) {
    const sel = ed.selected;
    if (!sel) return;
    setMenu(null);
    const existing = opOn(step, sel.sel, 'link');
    if (!stepId) return existing && removeOp(editor, step, existing.id);
    upsertOp(editor, step, { sel: sel.sel, op: 'link', value: stepId }, 'step');
  }
  async function copySel() {
    if (!ed.selected) return;
    setMenu(null);
    await navigator.clipboard?.writeText(ed.selected.sel).catch(() => undefined);
    setNotice(t('editor.html.copied'));
  }

  const multi = ed.multi.length > 1 ? ed.multi : null;
  const sel = multi ? null : ed.selected;
  const linked = sel ? opOn(step, sel.sel, 'link') : undefined;
  const others = editor.steps.map((s, i) => ({ s, n: i + 1 })).filter(({ s }) => s.id !== step.id);
  if (!step.html_path) return <div className="muted html-empty">{t('editor.html.missing')}</div>;
  const crumbsEl = (
    <div className="html-crumbs" role="group" aria-label={t('editor.html.trail')}>
      <span className="badge">{t('editor.html.kind')}</span>
      {multi ? (
        <span className="html-crumb">
          <b>{t('editor.data.trailMulti', { count: multi.length, sel: commonShort(multi) })}</b>
        </span>
      ) : sel ? (
        sel.trail.map((label, i) => {
          const isLast = i === sel.trail.length - 1;
          return (
            <span key={`${i}-${label}`} className="html-crumb">
              {i > 0 && <span aria-hidden="true"> › </span>}
              <button
                type="button"
                className="crumb-btn"
                aria-current={isLast ? 'true' : undefined}
                aria-label={t('editor.html.trailBtn', { el: label })}
                onClick={() => frameSend.current?.({ t: 'up', n: sel.trail.length - 1 - i })}
              >
                {isLast ? <b>{label}</b> : label}
              </button>
            </span>
          );
        })
      ) : (
        <span className="muted">{t('editor.html.noSelection')}</span>
      )}
    </div>
  );

  return (
    <div className="html-canvas">
      {/* L20-01 : fil du sélecteur en tête du canevas, au-dessus du cadre navigateur */}
      {crumbSlot ? createPortal(crumbsEl, crumbSlot) : crumbsEl}
      <div className="html-stage" ref={wrap} style={{ height: `${Math.round(vh * scale)}px` }}>
        {doc ? (
          <iframe
            ref={frame}
            key={step.id}
            srcDoc={doc}
            sandbox={FRAME_SANDBOX}
            referrerPolicy="no-referrer"
            title={t('editor.html.frame', { title: meta.title || step.title || '' })}
            style={{ width: `${vw}px`, height: `${vh}px`, transform: `scale(${scale})` }}
          />
        ) : (
          <p className="html-state" role={failed ? 'alert' : 'status'}>
            {failed ? t('editor.html.error') : t('editor.html.loading')}
          </p>
        )}
        {sel && !readOnly && (
          <div
            ref={bar}
            className="eltb"
            role="toolbar"
            aria-label={t('editor.html.toolbar')}
            style={barPos ? { left: barPos.left, top: barPos.top } : { visibility: 'hidden' }}
          >
            {/* L20-01 : étiquette du sélecteur, dans la barre (elle ne masque aucun texte de la page) */}
            <span className="eltb-tag" aria-hidden="true">
              {sel.short}
            </span>
            {/* L28-05 : une image se remplace, elle ne se réécrit pas */}
            {sel.img ? (
              <button type="button" onClick={() => setHtmlEdit({ library: sel.sel })}>
                <ImageUp {...ICON} />
                {t('editor.html.replaceImage')}
              </button>
            ) : (
              <button
                type="button"
                disabled={sel.canvas}
                title={sel.canvas ? t('editor.html.canvasHelp') : undefined}
                onClick={() => setHtmlEdit({ focusText: ed.focusText + 1 })}
              >
                <PenLine {...ICON} />
                {t('editor.html.editText')}
              </button>
            )}
            <button type="button" aria-pressed={!!opOn(step, sel.sel, 'hide')} onClick={() => toggle('hide')}>
              <EyeOff {...ICON} />
              {opOn(step, sel.sel, 'hide') ? t('editor.html.unhide') : t('editor.html.hide')}
            </button>
            <button type="button" aria-pressed={!!opOn(step, sel.sel, 'blur')} onClick={() => toggle('blur')}>
              <Droplet {...ICON} />
              {opOn(step, sel.sel, 'blur') ? t('editor.html.unblur') : t('editor.html.blur')}
            </button>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menu === 'link'}
              aria-pressed={!!linked}
              onClick={() => setMenu(menu === 'link' ? null : 'link')}
            >
              <Link2 {...ICON} />
              {t('editor.html.link')}
            </button>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menu === 'more'}
              aria-label={t('editor.html.more')}
              onClick={() => setMenu(menu === 'more' ? null : 'more')}
            >
              <MoreHorizontal {...ICON} />
            </button>
            {menu === 'link' && (
              <div className="menu eltb-menu" role="menu">
                {others.map(({ s, n }) => (
                  <button
                    key={s.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={linked?.value === s.id}
                    onClick={() => linkTo(s.id)}
                  >
                    {t('editor.html.linkTo', { n, title: s.title || '' })}
                  </button>
                ))}
                {linked && (
                  <button type="button" role="menuitem" onClick={() => linkTo(null)}>
                    {t('editor.html.unlink')}
                  </button>
                )}
              </div>
            )}
            {menu === 'more' && (
              <div className="menu eltb-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(null);
                    toggle('remove');
                  }}
                >
                  <Trash2 {...ICON} />
                  {t('editor.html.remove')}
                </button>
                <button type="button" role="menuitem" onClick={() => void copySel()}>
                  <Copy {...ICON} />
                  {t('editor.html.copySel')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <p className="muted html-keys">{t('editor.html.keysHelp')}</p>
      <div className="sr-only" role="status" aria-live="polite">
        {notice}
      </div>
      {ed.library && !readOnly && (
        <MediaLibrary
          wsId={step.workspace_id}
          kind="image"
          onClose={() => setHtmlEdit({ library: null })}
          onPick={(f) => {
            const target = ed.library;
            if (f.kind === 'font' || !target) return;
            const fit = opOn(step, target, 'image')?.fit;
            upsertOp(
              editor,
              step,
              { sel: target, op: 'image', value: f.path, ...(fit ? { fit } : {}) },
              'step',
            );
            setHtmlEdit({ library: null });
            toast(t('editor.html.imageReplaced'), {
              label: t('editor.undo'),
              onClick: () => editor.undo(),
              durationMs: 8000,
            });
            // Image importée : aucune détection automatique, comptée au bilan RGPD
            toast(t('editor.importWarn'), undefined, { tone: 'warning' });
          }}
        />
      )}
    </div>
  );
}

/** Sélecteur court commun (« b.value »), sinon celui du premier élément. */
export function commonShort(els: Array<{ short: string }>): string {
  const first = els[0]?.short ?? '';
  return els.every((e) => e.short === first) ? first : `${first}…`;
}

/** Opérations introuvables lors de la dernière application (liste du panneau). */
export function useNotFound(stepId: string) {
  return useHtmlEdit(stepId).notFound;
}
export { removeOp };
