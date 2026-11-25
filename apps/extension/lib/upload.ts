import type { Json } from '@flowdsiml/supabase-types';
import { supabase } from './supabase';
import { burnBlurs } from './burn';
import { defaultHotspotTitle, hotspotRect } from './geometry';
import type { PendingCapture } from './pending';
import type { FillTarget } from './messages';
import { intoCrop } from './frame';
import { fullHeight, fullPageBlurs } from './fullpage';

/**
 * Envoi après vérification (spec f1-formation §1) : crée la démo, puis pour chaque capture floute
 * les pixels des zones cochées, envoie le WebP et insère l'étape et son hotspot. Seuls le type et la
 * boîte des détections sont envoyés (element_meta.pii), jamais le texte ni l'extrait.
 * L26-04 : capture guidée (target.fill) : pas de nouvelle démo ; les captures remplissent dans l'ordre
 * les étapes « À capturer » (titre et texte de bulle gardés), les suivantes s'ajoutent à la fin.
 */
export async function sendCaptures(
  captures: PendingCapture[],
  target: {
    workspaceId: string;
    title: string;
    device?: 'desktop' | 'mobile';
    viewport?: { w: number; h: number } | null;
    fill?: FillTarget | null;
    /** EXT-02 §8 : ajout à une démo existante (les étapes vont à la fin ; l'éditeur les place). */
    appendTo?: string | null;
  },
  onProgress: (done: number) => void,
  /** Identifiants des étapes créées, dans l'ordre (rempli par l'envoi). */
  created: string[] = [],
): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Non connecté');
  let demoId: string;
  // L26-04 : étapes à remplir (encore « À capturer ») et position des captures en plus
  let slots: Array<{ id: string; options: Record<string, unknown> }> = [];
  let base = 0;
  if (target.fill) {
    demoId = target.fill.demoId;
    const ids = target.fill.steps.map((s) => s.id);
    const open = await supabase
      .from('steps')
      .select('id, options')
      .in('id', ids)
      .eq('to_capture', true)
      .is('image_path', null);
    if (open.error) throw open.error;
    const byId = new Map((open.data ?? []).map((r) => [r.id, r]));
    slots = ids.flatMap((id) => {
      const r = byId.get(id);
      return r ? [{ id, options: (r.options ?? {}) as Record<string, unknown> }] : [];
    });
    const last = await supabase
      .from('steps')
      .select('position')
      .eq('demo_id', demoId)
      .order('position', { ascending: false })
      .limit(1);
    if (last.error) throw last.error;
    base = (last.data?.[0]?.position ?? -1) + 1;
  } else if (target.appendTo) {
    demoId = target.appendTo;
    const last = await supabase
      .from('steps')
      .select('position')
      .eq('demo_id', demoId)
      .order('position', { ascending: false })
      .limit(1);
    if (last.error) throw last.error;
    base = (last.data?.[0]?.position ?? -1) + 1;
  } else {
    const demo = await supabase
      .from('demos')
      .insert({
        workspace_id: target.workspaceId,
        title: target.title.slice(0, 160),
        created_by: auth.user.id,
        // F7 : démo mobile (cadre téléphone dans le lecteur)
        device: target.device ?? 'desktop',
        viewport: (target.viewport ?? null) as Json,
      })
      .select('id')
      .single();
    if (demo.error) throw demo.error;
    demoId = demo.data.id;
  }

  for (const [position, c] of captures.entries()) {
    const { blob, width, height } = await burnBlurs(
      c.image,
      c.zones.filter((z) => z.blur).map((z) => z.rect),
    );
    const slot = slots[position];
    const stepId = slot?.id ?? crypto.randomUUID();
    // Étape remplie : nom de fichier nouveau (pas d'écrasement d'une image d'exemple partagée)
    const path = slot
      ? `${target.workspaceId}/${demoId}/${stepId}-${crypto.randomUUID().slice(0, 8)}.webp`
      : `${target.workspaceId}/${demoId}/${stepId}.webp`;
    const up = await supabase.storage
      .from('captures')
      .upload(path, blob, { contentType: 'image/webp', upsert: false });
    if (up.error) throw up.error;
    // L25-01 : page entière (animation de défilement), floutée par défaut sur tout le document
    let fullPage: Record<string, unknown> | null = null;
    if (c.full) {
      const f = await burnBlurs(c.full.image, fullPageBlurs(c.full.zones, c.zones, c.viewport, c.full.page));
      const fpath = `${target.workspaceId}/${demoId}/${stepId}-page.webp`;
      const fu = await supabase.storage
        .from('captures')
        .upload(fpath, f.blob, { contentType: 'image/webp', upsert: false });
      if (fu.error) throw fu.error;
      const scale = f.height / fullHeight(c.full.page);
      fullPage = {
        path: fpath,
        width: f.width,
        height: f.height,
        // Position du viewport capturé dans l'image de la page (pixels de l'image)
        top: Math.round(c.full.page.scrollY * scale),
        viewportHeight: Math.round(c.viewport.height * scale),
      };
    }
    const options: Record<string, unknown> = {};
    if (c.tab) options.tab = c.tab;
    if (fullPage) options.fullPage = fullPage;
    // EXT-02 §5 : cadre gardé, en recadrage non destructif (l'image envoyée reste entière)
    const crop = c.frame?.crop ?? null;
    if (crop) options.crop = crop;
    const elementMeta = JSON.parse(
      JSON.stringify({
        selector: c.selector,
        tag: c.tag,
        label: c.label,
        element: c.element,
        viewport: c.viewport,
        dpr: c.dpr,
        click: c.click,
        pii: c.zones.map((z) => ({ type: z.type, rect: z.rect, blurred: z.blur, manual: !!z.manual })),
      }),
    ) as NonNullable<Json>;
    // Le hotspot est relatif au cadre recadré (L25-02)
    const whole = hotspotRect(c.click, c.element, c.viewport);
    const rect = intoCrop(whole, crop) ?? whole;
    if (slot) {
      // Étape du modèle : image et page posées, titre, textes et réglages gardés
      const upd = await supabase
        .from('steps')
        .update({
          image_path: path,
          image_width: width,
          image_height: height,
          page_url: c.url.slice(0, 2000),
          page_title: c.title.slice(0, 300),
          blurs: [] as unknown as NonNullable<Json>,
          options: { ...slot.options, ...options } as NonNullable<Json>,
          element_meta: elementMeta,
          to_capture: false,
        })
        .eq('id', stepId);
      if (upd.error) throw upd.error;
      const first = await supabase
        .from('hotspots')
        .select('id')
        .eq('step_id', stepId)
        .order('position')
        .limit(1);
      if (first.error) throw first.error;
      const hot = first.data?.[0]
        ? await supabase.from('hotspots').update(rect).eq('id', first.data[0].id)
        : await supabase.from('hotspots').insert({
            step_id: stepId,
            demo_id: demoId,
            workspace_id: target.workspaceId,
            ...rect,
            title: defaultHotspotTitle(c.label),
          });
      if (hot.error) throw hot.error;
      onProgress(position + 1);
      continue;
    }
    const ins = await supabase.from('steps').insert({
      id: stepId,
      demo_id: demoId,
      workspace_id: target.workspaceId,
      position: base + position - slots.length,
      kind: 'image',
      image_path: path,
      image_width: width,
      image_height: height,
      title: c.title.slice(0, 200),
      page_url: c.url.slice(0, 2000),
      page_title: c.title.slice(0, 300),
      // Flous incrustés dans l'image : pas de calque à rejouer dans le player
      blurs: [] as unknown as NonNullable<Json>,
      ...(Object.keys(options).length ? { options: options as NonNullable<Json> } : {}),
      element_meta: elementMeta,
    });
    if (ins.error) throw ins.error;
    created.push(stepId);
    const hot = await supabase.from('hotspots').insert({
      step_id: stepId,
      demo_id: demoId,
      workspace_id: target.workspaceId,
      ...rect,
      title: defaultHotspotTitle(c.label),
    });
    if (hot.error) throw hot.error;
    onProgress(position + 1);
  }
  return demoId;
}
