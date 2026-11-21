import type { Json } from '@flowdsiml/supabase-types';
import type { HtmlOp } from '@flowdsiml/core';
import { supabase } from './supabase';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import type { PendingHtmlPage } from './htmlStore';

/**
 * A8 : envoi des pages HTML. Chaque page passe par la fonction html-ingest, qui l'assainit une
 * seconde fois côté serveur et la range dans le bucket html (aucune écriture directe du client).
 * Le clic capturé entre deux pages devient une opération « lien » vers l'étape suivante.
 */
export type HtmlDemoKind = 'guided' | 'sandbox';

async function ingest(
  token: string,
  workspaceId: string,
  demoId: string,
  html: string,
  url: string,
): Promise<string> {
  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/html-ingest`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
      'content-type': 'application/json',
    },
    // L49 : l'adresse de la page (celle de html_meta.url) sert au réglage « Captures HTML » de l'espace
    body: JSON.stringify({ workspaceId, demoId, html, url }),
  });
  const body = (await res.json().catch(() => ({}))) as { path?: string; error?: string };
  if (!res.ok || !body.path) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body.path;
}

export async function sendHtml(
  pages: PendingHtmlPage[],
  target: { workspaceId: string; title: string; kind: HtmlDemoKind },
  onProgress: (done: number) => void,
): Promise<string> {
  const { data: s } = await supabase.auth.getSession();
  const user = s.session?.user;
  if (!user || !s.session) throw new Error('Non connecté');
  const ordered = [...pages].sort((a, b) => a.order - b.order).filter((p) => !p.tooBig);
  const stepIds = ordered.map(() => crypto.randomUUID());
  const demo = await supabase
    .from('demos')
    .insert({
      workspace_id: target.workspaceId,
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
  const demoId = demo.data.id;
  for (const [i, p] of ordered.entries()) {
    const path = await ingest(s.session.access_token, target.workspaceId, demoId, p.html, p.url);
    const ops: HtmlOp[] = [];
    const next = stepIds[i + 1];
    if (p.clickSel && next)
      ops.push({ id: `l${i + 1}`, sel: p.clickSel, op: 'link', value: next, scope: 'step' });
    const ins = await supabase.from('steps').insert({
      id: stepIds[i],
      demo_id: demoId,
      workspace_id: target.workspaceId,
      position: i,
      kind: 'html',
      title: (p.clickLabel || p.title || `Page ${i + 1}`).slice(0, 200),
      page_url: p.url.slice(0, 2000),
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
    onProgress(i + 1);
  }
  return demoId;
}
