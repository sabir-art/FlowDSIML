import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useTranslation } from 'react-i18next';
import {
  Box,
  AlertTriangle,
  Camera,
  Code,
  ExternalLink,
  Link2,
  MessageSquareOff,
  Plus,
  Unlink,
} from 'lucide-react';
import type { Json } from '@flowdsiml/supabase-types';
import type { DemoEditor } from '../useDemoEditor';
import { sandboxOf } from '../draftManifest';
import { deadByUrl, deadLinks, ignoredOf, sandboxGraph, type DeadLink, type SbNode } from './sandboxGraph';
import { guideOnPages, guideRows, type GuideRow, type GuideStepRef } from './sandboxGuide';
import { GuideList } from './GuideList';
import { guideHint, upsertOp } from './htmlModel';
import { Menu } from '../../../components/Menu';
import { useHtmlCapture } from '../../../lib/htmlCapture';
import { Status, Select } from '@flowdsiml/ui';
import { useToast } from '../../../components/Toast';
import { captureInExtension } from '../../../lib/extensionLink';
import { EXTENSION_URL } from '../../../lib/env';

const ICON = { size: 16, 'aria-hidden': true } as const;

/** Inverse un tracé orthogonal « M x y H … V … H … » (pour orienter la flèche). */
function reversePath(d: string): string {
  const pts: Array<[number, number]> = [];
  let x = 0;
  let y = 0;
  for (const m of d.matchAll(/([MHV])\s*(-?[\d.]+)(?:\s+(-?[\d.]+))?/g)) {
    if (m[1] === 'M') {
      x = Number(m[2]);
      y = Number(m[3]);
    } else if (m[1] === 'H') x = Number(m[2]);
    else y = Number(m[2]);
    pts.push([x, y]);
  }
  return pts
    .reverse()
    .map(([px, py], i) => `${i ? 'L' : 'M'}${px} ${py}`)
    .join(' ');
}
const W = 150;
const H = 116;
const GX = 44;
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
  onEditBubble,
}: {
  editor: DemoEditor;
  readOnly: boolean;
  /** Ouvre une page dans l'éditeur (index d'étape). */
  onOpen: (index: number) => void;
  /** A8 : ouvre une page sur une bulle du guide (panneau de la bulle). */
  onEditBubble: (index: number, hotspotId: string) => void;
}) {
  const { t } = useTranslation();
  const demo = editor.demo!;
  const htmlOff = useHtmlCapture(demo.workspace_id).mode === 'disabled';
  const toast = useToast();
  // EXT-CONNECT : « Capturer cette page » ouvre l'adresse dans l'extension, capture HTML rattachée à ce Sandbox
  async function capture(d: DeadLink) {
    const r = await captureInExtension({ demoId: demo.id, workspaceId: demo.workspace_id, url: d.url });
    if (r.ok) return toast(t(r.started ? 'editor.sandbox.capStarted' : 'editor.sandbox.capOpened'));
    if (r.error === 'unavailable')
      return toast(
        t(EXTENSION_URL ? 'editor.sandbox.capUnavailable' : 'editor.sandbox.capUnavailableSoon'),
        EXTENSION_URL
          ? {
              label: t('editor.sandbox.capInstall'),
              onClick: () => window.open(EXTENSION_URL, '_blank', 'noopener,noreferrer'),
            }
          : undefined,
        { tone: 'warning' },
      );
    toast(
      t(
        r.error === 'signed-out'
          ? 'editor.sandbox.capSignedOut'
          : r.error === 'busy'
            ? 'editor.sandbox.capBusy'
            : 'editor.sandbox.capError',
      ),
      undefined,
      { tone: 'warning' },
    );
  }
  const pages = editor.steps.filter((s) => s.kind === 'html');
  const sb = sandboxOf(demo.sandbox, pages);
  // Sandbox v2 : réglage proposé dès qu'une page a son enregistrement vivant ; garde-fou de l'espace
  const hasLive = pages.some((p) => !!p.html_live_path);
  const [liveAllowed, setLiveAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    if (!hasLive) return;
    let alive = true;
    void supabase.rpc('sandbox_live_allowed', { p_ws: demo.workspace_id }).then(({ data, error }) => {
      if (alive) setLiveAllowed(error ? null : data === true);
    });
    return () => {
      alive = false;
    };
  }, [hasLive, demo.workspace_id]);
  /** Sandbox vivant réellement actif : la page réagit elle-même aux clics. */
  const liveOn = hasLive && !!sb.live && liveAllowed !== false;
  const { nodes } = useMemo(() => sandboxGraph(editor.steps, demo.sandbox), [editor.steps, demo.sandbox]);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const title = (id: string) => byId.get(id)?.title ?? '';
  const orphans = nodes.filter((n) => n.orphan);
  const linkedDefault = new Set(nodes.filter((n) => !n.orphan).map((n) => n.id));
  const keySet = new Set(sb.keyPages.length ? sb.keyPages : [...linkedDefault]);
  const cols = Math.max(1, ...nodes.map((n) => n.col + 1));
  const rows = Math.max(1, ...nodes.map((n) => n.row + 1));
  // L48-G §5 : liens sans page ; un nœud fantôme par adresse non capturée, dans une colonne à droite
  const { dead, ignored } = useMemo(
    () => deadLinks(editor.steps, demo.sandbox),
    [editor.steps, demo.sandbox],
  );
  const [showIgnored, setShowIgnored] = useState(false);
  const ghostUrls = [...new Set(dead.map((d) => d.url))];
  // Lot B : une ligne par destination, le compteur compte les destinations
  const groups = deadByUrl(dead);
  const deadBy = (id: string) => dead.filter((d) => d.from === id).length;
  const allCols = cols + (ghostUrls.length ? 1 : 0);
  const allRows = Math.max(rows, ghostUrls.length);
  const width = allCols * (W + GX) - GX + 48;
  const height = allRows * (H + GY) - GY + 48;
  const ghostPos = (i: number) => ({ x: 24 + cols * (W + GX), y: 24 + i * (H + GY) });
  const pos = (n: SbNode) => ({ x: 24 + n.col * (W + GX), y: 24 + n.row * (H + GY) });

  // Paires de pages (sans doublon) : a → b, et both si b → a existe aussi
  const edges = (() => {
    const seen = new Set<string>();
    const out: Array<{ key: string; d: string; both: boolean }> = [];
    for (const n of nodes)
      for (const to of n.to) {
        const m = byId.get(to);
        if (!m) continue;
        const key = [n.id, to].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        const both = m.to.includes(n.id);
        // Sens de tracé : de la colonne de gauche vers la droite (même colonne : de haut en bas)
        const [u, v] = n.col < m.col || (n.col === m.col && n.row <= m.row) ? [n, m] : [m, n];
        const a = pos(u);
        const b = pos(v);
        let d: string;
        if (u.col === v.col) {
          // Même colonne : par le couloir de droite
          const gx = a.x + W + GX / 2;
          d = `M${a.x + W} ${a.y + H / 2} H${gx} V${b.y + H / 2} H${b.x + W}`;
        } else {
          // Colonnes différentes : sortie à droite, descente dans le couloir, entrée à gauche
          const gx = b.x - GX / 2;
          d = `M${a.x + W} ${a.y + H / 2} H${gx} V${b.y + H / 2} H${b.x}`;
        }
        // Flèche vers la page liée : si seul v → u existe, on inverse le tracé
        const forward = u.id === n.id || both;
        out.push({ key, d: forward ? d : reversePath(d), both });
      }
    return out;
  })();

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
    ...(groups.length ? [t('editor.sandbox.deadDesc', { count: groups.length })] : []),
  ].join(' ; ');

  function save(patch: Record<string, unknown>) {
    // Les liens laissés (ignoredLinks) ne sont pas dans sandboxOf : on les garde
    editor.updateDemo({
      sandbox: { ...sb, ignoredLinks: ignoredOf(demo.sandbox), ...patch } as unknown as Json,
    });
  }
  // A8 : guide optionnel (étapes dans l'ordre, orphelines signalées, repères sur les cartes)
  const gRows = guideRows(editor.steps, editor.hotspots, sb.guideSteps);
  const gOnPage = guideOnPages(gRows);
  const saveGuide = (list: GuideStepRef[]) => save({ guideSteps: list });
  const editBubble = (r: GuideRow) =>
    r.orphan
      ? open(r.page)
      : onEditBubble(
          editor.steps.findIndex((s) => s.id === r.page),
          r.hotspot,
        );
  function addGuideStep() {
    // L'ajout se fait sur une page : la dernière page du guide, sinon la page de départ
    const last = [...gRows].reverse().find((r) => !r.orphan)?.page;
    open(last ?? sb.start ?? pages[0]?.id ?? '');
    guideHint.close = toast(t('editor.sandbox.guideAddHint'));
  }
  const leave = (list: DeadLink[]) =>
    save({ ignoredLinks: [...ignoredOf(demo.sandbox), ...list.map((d) => ({ url: d.url, from: d.from }))] });
  const restore = (d: DeadLink) =>
    save({ ignoredLinks: ignoredOf(demo.sandbox).filter((x) => !(x.from === d.from && x.url === d.url)) });
  const linkTo = (d: DeadLink, page: string) => {
    const step = editor.steps.find((x) => x.id === d.from);
    if (step) upsertOp(editor, step, { sel: d.sel, op: 'link', value: page }, 'step');
  };
  const open = (id: string) => onOpen(editor.steps.findIndex((s) => s.id === id));

  return (
    <div className="sb-plan">
      <div className="sb-main">
        <h2 className="sb-title">{t('editor.sandbox.planTitle', { title: demo.title })}</h2>
        <p className="muted sb-sub">{t('editor.sandbox.sub', { count: pages.length })}</p>
        <div className="sb-row">
          {/* Zone défilante atteignable au clavier quand le plan dépasse (RGAA 7.3) */}
          <div className="sb-scroll" tabIndex={0} role="region" aria-label={t('editor.sandbox.mapRegion')}>
            <div
              className="sbmap"
              role="img"
              aria-label={t('editor.sandbox.mapLabel', { desc })}
              style={{ width, height }}
            >
              <svg className="links" width={width} height={height} aria-hidden="true">
                <defs>
                  <marker
                    id="sb-arrow"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M0 0 L10 5 L0 10 z" fill="var(--fd-color-primary)" />
                  </marker>
                </defs>
                {/* L20-02 : un seul tracé par paire de pages (flèche à chaque bout si le lien va dans les deux
                  sens), routé dans les couloirs entre les cartes : jamais sous une carte */}
                {/* L48-G §5 : traits pointillés vers les pages non capturées */}
                <g stroke="var(--fd-color-danger)" strokeWidth="2" strokeDasharray="5 4" fill="none">
                  {dead.map((d) => {
                    const n = byId.get(d.from);
                    if (!n) return null;
                    const a = pos(n);
                    const b = ghostPos(ghostUrls.indexOf(d.url));
                    const gx = b.x - GX / 2;
                    return (
                      <path
                        key={`${d.from} ${d.url}`}
                        d={`M${a.x + W} ${a.y + H / 2} H${gx} V${b.y + H / 2} H${b.x}`}
                      />
                    );
                  })}
                </g>
                <g stroke="var(--fd-color-primary)" strokeWidth="2" fill="none">
                  {edges.map((e) => (
                    <path
                      key={e.key}
                      d={e.d}
                      markerEnd="url(#sb-arrow)"
                      markerStart={e.both ? 'url(#sb-arrow)' : undefined}
                    />
                  ))}
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
                    {n.start && (
                      <Status size="sm" tone="success">
                        {t('editor.sandbox.start')}
                      </Status>
                    )}
                    {n.orphan && (
                      <Status size="sm" tone="warning">
                        {t('editor.sandbox.toLink')}
                      </Status>
                    )}
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
                    {sb.guide && gOnPage.has(n.id) && (
                      <small className="sb-guide-on">
                        {t('editor.sandbox.guideOnPages', { list: gOnPage.get(n.id)!.join(', ') })}
                      </small>
                    )}
                    {deadBy(n.id) > 0 && (
                      <small className="sb-dead">
                        {t('editor.sandbox.deadCount', { count: deadBy(n.id) })}
                      </small>
                    )}
                  </div>
                );
              })}
              {ghostUrls.map((u, i) => {
                const p = ghostPos(i);
                return (
                  <div
                    key={u}
                    className="sbnode sbnode--ghost"
                    style={{ left: p.x, top: p.y, width: W, height: H }}
                  >
                    <Unlink {...ICON} />
                    <b>{t('editor.sandbox.ghost')}</b>
                    <small title={u}>{u.replace(/^https?:\/\//, '')}</small>
                  </div>
                );
              })}
            </div>
          </div>
          {(dead.length > 0 || ignored.length > 0) && (
            <section className="card sb-deadpanel" aria-labelledby="sb-dead-h">
              <h3 id="sb-dead-h">
                {t('editor.sandbox.deadTitle')} <span className="sb-deadpanel__n">({groups.length})</span>
              </h3>
              {dead.length > 0 && <p className="help">{t(`editor.sandbox.deadHelp.${sb.unlinked}`)}</p>}
              {/* L49 P1 : captures HTML désactivées par un admin : l'action est désactivée avec la raison */}
              {htmlOff && (
                <p id="sb-dead-off" className="help">
                  {t('htmlCapture.blockedByAdmin')}
                </p>
              )}
              <ul className="sb-deadlist">
                {groups.map(({ url, label, items }) => (
                  <li key={url}>
                    <b>{label}</b>
                    <span className="sb-deadlist__path">
                      {items.length > 1
                        ? t('editor.sandbox.deadOnPages', {
                            count: items.length,
                            pages: items.map((d) => title(d.from)).join(', '),
                          })
                        : title(items[0]!.from)}{' '}
                      → <span title={url}>{url.replace(/^https?:\/\//, '')}</span>
                    </span>
                    {!readOnly && (
                      <span className="sb-deadlist__actions">
                        {/* L48-G écart 3 et EXT-CONNECT : capture dans l'extension, rattachée à ce Sandbox */}
                        <button
                          type="button"
                          className="fd-btn fd-btn--sm"
                          aria-disabled={htmlOff || undefined}
                          aria-describedby={htmlOff ? 'sb-dead-off' : undefined}
                          onClick={() => {
                            if (!htmlOff) void capture(items[0]!);
                          }}
                        >
                          <Camera {...ICON} />
                          {t('editor.sandbox.deadCapture')}
                        </button>
                        <a className="link-button" href={url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink {...ICON} />
                          {t('editor.sandbox.deadOpen')}
                        </a>
                        <span className="grow" />
                        <Menu
                          label={t('editor.sandbox.deadMore', { link: label })}
                          items={[
                            // Relier ou laisser : vaut pour toutes les pages qui portent ce lien
                            ...nodes
                              .filter((n) => !(items.length === 1 && n.id === items[0]!.from))
                              .map((n) => ({
                                label: n.title,
                                icon: <Link2 />,
                                group: t('editor.sandbox.deadLink'),
                                onSelect: () =>
                                  items.filter((d) => d.from !== n.id).forEach((d) => linkTo(d, n.id)),
                              })),
                            'separator' as const,
                            {
                              label: t('editor.sandbox.deadLeave'),
                              icon: <MessageSquareOff />,
                              onSelect: () => leave(items),
                            },
                          ]}
                        />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {ignored.length > 0 && (
                <>
                  <button
                    type="button"
                    className="link-button"
                    aria-expanded={showIgnored}
                    onClick={() => setShowIgnored(!showIgnored)}
                  >
                    {t('editor.sandbox.deadShowLeft', { count: ignored.length })}
                  </button>
                  {showIgnored && (
                    <ul className="sb-deadlist sb-deadlist--left">
                      {ignored.map((d) => (
                        <li key={`${d.from} ${d.url}`}>
                          <b>{d.label}</b>
                          <span className="sb-deadlist__path">
                            {title(d.from)} → {d.url.replace(/^https?:\/\//, '')}
                          </span>
                          {!readOnly && (
                            <button type="button" className="link-button" onClick={() => restore(d)}>
                              {t('editor.sandbox.deadRestore')}
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </section>
          )}
        </div>
        {orphans.map((n) => (
          <div key={n.id} className="alert alert-warning sb-alert" role="alert">
            <AlertTriangle {...ICON} />
            <div>
              {t('editor.sandbox.orphanAlert', { page: n.title })}{' '}
              <button type="button" className="link-button" onClick={() => open(sb.start ?? n.id)}>
                {t('editor.sandbox.linkFromMenu')}
              </button>
            </div>
          </div>
        ))}
      </div>
      <aside className="card sb-settings" aria-labelledby="sb-settings-h">
        <div className="sb-head">
          <span className="icon-chip" aria-hidden="true">
            <Box {...ICON} />
          </span>
          <h2 id="sb-settings-h">{t('editor.sandbox.settings')}</h2>
        </div>
        <div className="field">
          <label htmlFor="sb-start">{t('editor.sandbox.startPage')}</label>
          <Select
            id="sb-start"
            size="sm"
            value={sb.start ?? ''}
            disabled={readOnly}
            onChange={(e) => save({ start: e.target.value })}
          >
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {title(p.id)}
              </option>
            ))}
          </Select>
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
        {hasLive && (
          <div>
            <div className="setting">
              <label className="t-label" htmlFor="sb-live">
                {t('editor.sandbox.live')}
              </label>
              <span className="switch">
                <input
                  id="sb-live"
                  type="checkbox"
                  checked={sb.live && liveAllowed !== false}
                  disabled={readOnly || liveAllowed === false}
                  aria-describedby="sb-live-h"
                  onChange={(e) => save({ live: e.target.checked })}
                />
                <span />
              </span>
            </div>
            <p className="help" id="sb-live-h">
              {t(liveAllowed === false ? 'editor.sandbox.liveForbidden' : 'editor.sandbox.liveHelp')}
            </p>
          </div>
        )}
        <div className="field">
          <label htmlFor="sb-unlinked">{t('editor.sandbox.unlinked')}</label>
          <Select
            id="sb-unlinked"
            size="sm"
            value={sb.unlinked}
            disabled={readOnly || liveOn}
            aria-describedby={liveOn ? 'sb-unlinked-h' : undefined}
            onChange={(e) => save({ unlinked: e.target.value })}
          >
            <option value="toast">{t('editor.sandbox.unlinkedToast')}</option>
            <option value="none">{t('editor.sandbox.unlinkedNone')}</option>
            <option value="highlight">{t('editor.sandbox.unlinkedHighlight')}</option>
          </Select>
          {/* Recette UX de l'étape 3 : une page vivante réagit elle-même, le réglage est sans effet */}
          {liveOn && (
            <p className="help" id="sb-unlinked-h">
              {t('editor.sandbox.unlinkedLive')}
            </p>
          )}
        </div>
        <div>
          <div className="setting">
            <label className="t-label" htmlFor="sb-guide">
              {t('editor.sandbox.guide')}
            </label>
            <span className="switch">
              <input
                id="sb-guide"
                type="checkbox"
                checked={sb.guide}
                disabled={readOnly}
                aria-describedby="sb-guide-help"
                onChange={(e) => save({ guide: e.target.checked })}
              />
              <span />
            </span>
          </div>
          <p id="sb-guide-help" className="help">
            {t('editor.sandbox.guideHelp')}
          </p>
        </div>
        {sb.guide && (
          <GuideList
            rows={gRows}
            readOnly={readOnly}
            onChange={saveGuide}
            onEdit={editBubble}
            onAdd={addGuideStep}
          />
        )}
        <button type="button" className="btn btn-secondary btn-sm" disabled>
          <Plus {...ICON} />
          {t('editor.sandbox.addPage')} <span className="soon-text">{t('editor.sandbox.soon')}</span>
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
                  className="link-button"
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
