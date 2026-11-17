import type { Json } from '@flowdsiml/supabase-types';
import { supabase } from './supabase';
import { burnBlurs } from './burn';
import { defaultHotspotTitle, hotspotRect } from './geometry';
import type { PendingCapture } from './pending';

/**
 * Envoi après vérification (spec f1-formation §1) : crée la démo, puis pour chaque capture floute
 * les pixels des zones cochées, envoie le WebP et insère l'étape et son hotspot. Seuls le type et la
 * boîte des détections sont envoyés (element_meta.pii), jamais le texte ni l'extrait.
 */
export async function sendCaptures(
  captures: PendingCapture[],
  target: { workspaceId: string; title: string },
  onProgress: (done: number) => void,
): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Non connecté');
  const demo = await supabase
    .from('demos')
    .insert({ workspace_id: target.workspaceId, title: target.title.slice(0, 160), created_by: auth.user.id })
    .select('id')
    .single();
  if (demo.error) throw demo.error;
  const demoId = demo.data.id;

  for (const [position, c] of captures.entries()) {
    const { blob, width, height } = await burnBlurs(
      c.image,
      c.zones.filter((z) => z.blur).map((z) => z.rect),
    );
    const stepId = crypto.randomUUID();
    const path = `${target.workspaceId}/${demoId}/${stepId}.webp`;
    const up = await supabase.storage
      .from('captures')
      .upload(path, blob, { contentType: 'image/webp', upsert: false });
    if (up.error) throw up.error;
    const ins = await supabase.from('steps').insert({
      id: stepId,
      demo_id: demoId,
      workspace_id: target.workspaceId,
      position,
      kind: 'image',
      image_path: path,
      image_width: width,
      image_height: height,
      title: c.title.slice(0, 200),
      page_url: c.url.slice(0, 2000),
      page_title: c.title.slice(0, 300),
      // Flous incrustés dans l'image : pas de calque à rejouer dans le player
      blurs: [] as unknown as NonNullable<Json>,
      element_meta: JSON.parse(
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
      ) as NonNullable<Json>,
    });
    if (ins.error) throw ins.error;
    const hot = await supabase.from('hotspots').insert({
      step_id: stepId,
      demo_id: demoId,
      workspace_id: target.workspaceId,
      ...hotspotRect(c.click, c.element, c.viewport),
      title: defaultHotspotTitle(c.label),
    });
    if (hot.error) throw hot.error;
    onProgress(position + 1);
  }
  return demoId;
}
