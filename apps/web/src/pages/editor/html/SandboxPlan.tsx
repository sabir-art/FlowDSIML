import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Code, Map as MapIcon, Plus } from 'lucide-react';
import type { Json } from '@flowdsiml/supabase-types';
import type { DemoEditor } from '../useDemoEditor';
import { sandboxOf } from '../draftManifest';
import { sandboxGraph, type SbNode } from './sandboxGraph';

const ICON = { size: 16, 'aria-hidden': true } as const;
const W = 150;
const H = 116;
const GX = 56;
const GY = 36;

/**
 * A8 (L20-02) : plan du Sandbox. Une carte par page (vignette, titre, « n liens »), liens tracés en
 * couleur principale, badges « Départ » et « À relier », alerte pour une page orpheline. Le plan est
 * une image décrite (role="img") ; la liste équivalente des pages et de leurs liens est dans les
 * réglages, navigable au clavier. Pages clés : la complétion « a vu les n pages clés ».
 */
export function SandboxPlan({
  editor,
  readOnly,
  onOpen,
}: {
  editor: DemoEditor;
  readOnly: boolean;
  /** Ouvre une page dans l'éditeur (index d'étape). */
  onOpen: (index: number) => void;
}) {
  const { t } = useTranslation();
  const demo = editor.demo!;
  const pages = editor.steps.filter((s) => s.kind === 'html');
  const sb = sandboxOf(demo.sandbox, pages);
  const { nodes } = useMemo(() => sandboxGraph(editor.steps, demo.sandbox), [editor.steps, demo.sandbox]);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const title = (id: string) => byId.get(id)?.title ?? '';
  const orphans = nodes.filter((n) => n.orphan);
  const linkedDefault = new Set(nodes.filter((n) => !n.orphan).map((n) => n.id));
  const keySet = new Set(sb.keyPages.length ? sb.keyPages : [...linkedDefault]);
  const cols = Math.max(1, ...nodes.map((n) => n.col + 1));
  const rows = Math.max(1, ...nodes.map((n) => n.row + 1));
  const width = cols * (W + GX) - GX + 48;
  const height = rows * (H + GY) - GY + 48;
  const pos = (n: SbNode) => ({ x: 24 + n.col * (W + GX), y: 24 + n.row * (H + GY) });

  const desc = [
    ...nodes
      .filter((n) => n.to.length)
      .map((n) =>
        t('editor.sandbox.descLinks', {
          from: n.title,
          to: n.to.map(title).join(` ${t('editor.sandbox.and')} `),
        }),
      ),
    ...orphans.map((n) => t('editor.sandbox.descOrphan', { page: n.title })),
  ].join(' ; ');

  function save(patch: Record<string, unknown>) {
    editor.updateDemo({ sandbox: { ...sb, ...patch } as unknown as Json });
  }
  const open = (id: string) => onOpen(editor.steps.findIndex((s) => s.id === id));

  return (
    <div className="sb-plan">
      <div className="sb-main">
        <h2 className="sb-title">{t('editor.sandbox.planTitle', { title: demo.title })}</h2>
        <p className="muted sb-sub">{t('editor.sandbox.sub', { count: pages.length })}</p>
        <div className="sb-scroll">
          <div
            className="sbmap"
            role="img"
            aria-label={t('editor.sandbox.mapLabel', { desc })}
            style={{ width, height }}
          >
            <svg className="links" width={width} height={height} aria-hidden="true">
              <g stroke="var(--fd-color-primary)" strokeWidth="2" fill="none">
                {nodes.flatMap((n) =>
                  n.to.map((to) => {
                    const target = byId.get(to);
                    if (!target) return null;
                    const a = pos(n);
                    const b = pos(target);
                    const forward = target.col > n.col;
                    const x1 = forward ? a.x + W : a.x + W / 2;
                    const y1 = forward ? a.y + H / 2 : a.y + H;
                    const x2 = forward ? b.x : b.x + W / 2;
                    const y2 = forward ? b.y + H / 2 : b.y + H;
                    const d = forward
                      ? `M${x1} ${y1} C ${x1 + 40} ${y1}, ${x2 - 40} ${y2}, ${x2} ${y2}`
                      : `M${x1} ${y1} C ${x1} ${y1 + 30}, ${x2} ${y2 + 30}, ${x2} ${y2}`;
                    return <path key={`${n.id}-${to}`} d={d} />;
                  }),
                )}
              </g>
            </svg>
            {nodes.map((n) => {
              const p = pos(n);
              return (
                <div
                  key={n.id}
                  className={`sbnode${n.start ? ' start' : ''}${n.orphan ? ' warn' : ''}`}
                  style={{ left: p.x, top: p.y, width: W, height: H }}
                >
                  {n.start && <span className="badge badge-success">{t('editor.sandbox.start')}</span>}
                  {n.orphan && <span className="badge badge-warning">{t('editor.sandbox.toLink')}</span>}
                  <div className="mini">
                    <Code {...ICON} />
                  </div>
                  <b>{n.title}</b>
                  <small>
                    {n.to.length
                      ? n.start
                        ? `${t('editor.sandbox.start')} · ${t('editor.sandbox.links', { count: n.to.length })}`
                        : t('editor.sandbox.links', { count: n.to.length })
                      : t('editor.sandbox.noLinkedPage')}
                  </small>
                </div>
              );
            })}
          </div>
        </div>
        {orphans.map((n) => (
          <div key={n.id} className="alert alert-warning sb-alert" role="alert">
            <AlertTriangle {...ICON} />
            <div>
              {t('editor.sandbox.orphanAlert', { page: n.title })}{' '}
              <button type="button" className="link-btn" onClick={() => open(sb.start ?? n.id)}>
                {t('editor.sandbox.linkFromMenu')}
              </button>
            </div>
          </div>
        ))}
      </div>
      <aside className="card sb-settings" aria-labelledby="sb-settings-h">
        <div className="sb-head">
          <span className="icon-chip" aria-hidden="true">
            <MapIcon {...ICON} />
          </span>
          <h2 id="sb-settings-h">{t('editor.sandbox.settings')}</h2>
        </div>
        <div className="field">
          <label htmlFor="sb-start">{t('editor.sandbox.startPage')}</label>
          <select
            id="sb-start"
            className="select input-sm"
            value={sb.start ?? ''}
            disabled={readOnly}
            onChange={(e) => save({ start: e.target.value })}
          >
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {title(p.id)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="setting">
            <label className="t-label" htmlFor="sb-auto">
              {t('editor.sandbox.autoLink')}
            </label>
            <span className="switch">
              <input
                id="sb-auto"
                type="checkbox"
                checked={sb.autoLink}
                disabled={readOnly}
                onChange={(e) => save({ autoLink: e.target.checked })}
              />
              <span />
            </span>
          </div>
          <p className="help">{t('editor.sandbox.autoLinkHelp')}</p>
        </div>
        <div className="field">
          <label htmlFor="sb-unlinked">{t('editor.sandbox.unlinked')}</label>
          <select
            id="sb-unlinked"
            className="select input-sm"
            value={sb.unlinked}
            disabled={readOnly}
            onChange={(e) => save({ unlinked: e.target.value })}
          >
            <option value="toast">{t('editor.sandbox.unlinkedToast')}</option>
            <option value="none">{t('editor.sandbox.unlinkedNone')}</option>
            <option value="highlight">{t('editor.sandbox.unlinkedHighlight')}</option>
          </select>
        </div>
        <div className="setting">
          <label className="t-label" htmlFor="sb-guide">
            {t('editor.sandbox.guide')} <span className="badge">{t('editor.sandbox.soon')}</span>
          </label>
          <span className="switch">
            <input id="sb-guide" type="checkbox" checked={false} disabled readOnly />
            <span />
          </span>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" disabled>
          <Plus {...ICON} />
          {t('editor.sandbox.addPage')} <span className="badge">{t('editor.sandbox.soon')}</span>
        </button>
        <fieldset className="sb-keys">
          <legend>{t('editor.sandbox.keyPages')}</legend>
          <p className="help">{t('editor.sandbox.keyHelp')}</p>
          {nodes.map((n) => (
            <label key={n.id} className="check">
              <input
                type="checkbox"
                checked={keySet.has(n.id)}
                disabled={readOnly}
                onChange={(e) => {
                  const next = new Set(keySet);
                  if (e.target.checked) next.add(n.id);
                  else next.delete(n.id);
                  save({ keyPages: nodes.filter((x) => next.has(x.id)).map((x) => x.id) });
                }}
              />
              {n.title}
            </label>
          ))}
          <p className="muted">{t('editor.sandbox.completion', { n: keySet.size })}</p>
        </fieldset>
        <section aria-labelledby="sb-list-h">
          <h3 id="sb-list-h" className="sec-title">
            {t('editor.sandbox.listTitle')}
          </h3>
          <ul className="sb-list">
            {nodes.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className="link-btn"
                  aria-label={t('editor.sandbox.open', { page: n.title })}
                  onClick={() => open(n.id)}
                >
                  {n.title}
                </button>
                {' → '}
                {n.to.length ? n.to.map(title).join(', ') : t('editor.sandbox.listNone')}
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
