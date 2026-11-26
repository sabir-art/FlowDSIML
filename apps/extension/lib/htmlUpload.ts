import type { Json } from '@flowdsiml/supabase-types';
import { displayAddress, type HtmlOp } from '@flowdsiml/core';
import { supabase } from './supabase';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import type { PendingHtmlPage } from './htmlStore';
import { defaultHotspotTitle } from './geometry';
import { distinctNames } from './stepNames';

/**
 * A8 : envoi des pages HTML. Chaque page passe par la fonction html-ingest, qui l'assainit une
 * seconde fois côté serveur et la range dans le bucket html (aucune écriture directe du client).
 * Sandbox : le clic capturé entre deux pages devient une opération « lien » vers l'étape suivante.
 * Démo guidée (recette du lot B) : il devient une bulle posée sur l'élément cliqué (sélecteur, place de
 * secours), « Cliquez sur « libellé » » ; dans le lecteur, un clic sur l'élément mène à l'étape suivante.
 */
export type HtmlDemoKind = 'guided' | 'sandbox';

/** Page à envoyer, avec les liens externes que la personne garde (EXT-02 §2.3). */
export type SendPage = PendingHtmlPage & { keepLinks?: Array<{ sel: string; href: string; label: string }> };
/** Lien gardé que le serveur a refusé (adresse signalée) : dit sur l'écran de fin d'envoi (§2.4). */
export interface DroppedLink {
  label: string;
  host: string;
}

async function ingest(
  token: string,
  workspaceId: string,
  demoId: string,
  html: string,
  url: string,
  security: unknown,
): Promise<{ path: string; blocked: string[] }> {
  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/html-ingest`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
      'content-type': 'application/json',
    },
    // L49 : l'adresse de la page (celle de html_meta.url) sert au réglage « Captures HTML » de l'espace ;
    // les compteurs de la page d'origine complètent ceux que le serveur recalcule (rapport, L49 §3)
    body: JSON.stringify({ workspaceId, demoId, html, url, security }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    path?: string;
    error?: string;
    security?: { blocked?: unknown };
  };
  if (!res.ok || !body.path) throw new Error(body.error ?? `HTTP ${res.status}`);
  const blocked = Array.isArray(body.security?.blocked) ? body.security.blocked.map(String) : [];
  return { path: body.path, blocked };
}

export async function sendHtml(
  pages: SendPage[],
  target: {
    workspaceId: string;
    title: string;
    kind: HtmlDemoKind;
    appendTo?: string;
    /** L64 §2 : dossier de la nouvelle démo. */
    folderId?: string | null;
  },
  onProgress: (done: number) => void,
): Promise<{ demoId: string; dropped: DroppedLink[]; stepIds: string[] }> {
  const { data: s } = await supabase.auth.getSession();
  const user = s.session?.user;
  if (!user || !s.session) throw new Error('Non connecté');
  const ordered = [...pages].sort((a, b) => a.order - b.order).filter((p) => !p.tooBig);
  const stepIds = ordered.map(() => crypto.randomUUID());
  // L60 : le nom de l'écran copié (son titre, son onglet), pas le libellé du clic qui le quitte ; jamais
  // deux étapes du même nom (lot B)
  const names = distinctNames(
    ordered.map((p, i) => ({ name: p.heading || p.title || `Page ${i + 1}`, clickLabel: p.clickLabel })),
  );
  const dropped: DroppedLink[] = [];
  let demoId: string;
  let first = 0;
  if (target.appendTo) {
    // EXT-CONNECT : pages ajoutées à la fin d'un Sandbox existant ; la base (RLS) vérifie le droit de le
    // modifier. Les liens restés sans page se relient d'eux-mêmes par l'adresse (réglage autoLink).
    demoId = target.appendTo;
    const last = await supabase
      .from('steps')
      .select('position')
      .eq('demo_id', demoId)
      .order('position', { ascending: false })
      .limit(1);
    if (last.error) throw last.error;
    first = (last.data?.[0]?.position ?? -1) + 1;
  } else {
    const demo = await supabase
      .from('demos')
      .insert({
        workspace_id: target.workspaceId,
        folder_id: target.folderId ?? null,
        title: target.title.slice(0, 160),
        created_by: user.id,
        kind: target.kind,
        sandbox:
          target.kind === 'sandbox'
            ? ({ start: stepIds[0], autoLink: true, unlinked: 'toast', guide: false, keyPages: [] } as Json)
            : null,
      })
      .select('id')
      .single();
    if (demo.error) throw demo.error;
    demoId = demo.data.id;
  }
  for (const [i, p] of ordered.entries()) {
    const { path, blocked } = await ingest(
      s.session.access_token,
      target.workspaceId,
      demoId,
      p.html,
      p.url,
      p.security,
    );
    const ops: HtmlOp[] = [];
    const next = stepIds[i + 1];
    if (p.clickSel && next && target.kind === 'sandbox')
      ops.push({ id: `l${i + 1}`, sel: p.clickSel, op: 'link', value: next, scope: 'step' });
    // Liens externes gardés : réactivés par une opération « extlink » (le lecteur affiche d'abord
    // « Vous quittez la démo »). Une adresse que le serveur a signalée reste désactivée.
    for (const [k, l] of (p.keepLinks ?? []).entries()) {
      if (blocked.includes(l.href)) {
        let host = '';
        try {
          host = new URL(l.href).host;
        } catch {
          /* adresse illisible */
        }
        dropped.push({ label: l.label, host });
      } else ops.push({ id: `x${i + 1}-${k + 1}`, sel: l.sel, op: 'extlink', value: l.href, scope: 'step' });
    }
    const ins = await supabase.from('steps').insert({
      id: stepIds[i],
      demo_id: demoId,
      workspace_id: target.workspaceId,
      position: first + i,
      kind: 'html',
      title: names[i]!.slice(0, 200),
      page_url: p.url.slice(0, 2000),
      // Lot B (recette UX §3.4) : adresse du cadre préremplie (domaine et chemin), modifiable dans l'éditeur
      options: { address: displayAddress(p.url) } as NonNullable<Json>,
      html_path: path,
      html_ops: ops as unknown as Json,
      html_meta: {
        title: p.title,
        url: p.url,
        bytes: p.bytes,
        viewport: p.viewport,
        links: p.links.slice(0, 300),
        blurred: p.blurred,
        canvases: p.canvases,
      } as unknown as Json,
    });
    if (ins.error) throw ins.error;
    if (p.clickSel && target.kind === 'guided') {
      const hot = await supabase.from('hotspots').insert({
        step_id: stepIds[i]!,
        demo_id: demoId,
        workspace_id: target.workspaceId,
        sel: p.clickSel.slice(0, 500),
        ...(p.clickRect ?? { x: 0.5, y: 0.5, w: 0.02, h: 0.02 }),
        title: defaultHotspotTitle(p.clickLabel ?? ''),
      });
      if (hot.error) throw hot.error;
    }
    onProgress(i + 1);
  }
  return { demoId, dropped, stepIds };
}
