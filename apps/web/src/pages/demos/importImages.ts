import { supabase } from '../../lib/supabase';

/** Formats acceptés à l'import (mêmes formats que le rail des étapes). */
export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp';
const ACCEPTED = IMAGE_ACCEPT.split(',');

/** Ordre des fichiers : par nom, en tenant compte des numéros (« ecran-2 » avant « ecran-10 »). */
export function orderImages(files: Iterable<File>): File[] {
  return [...files]
    .filter((f) => ACCEPTED.includes(f.type))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}

const extOf = (f: File) => (f.type === 'image/png' ? 'png' : f.type === 'image/jpeg' ? 'jpg' : 'webp');

/**
 * REV-06 : crée une démo à partir d'images, une étape par image, dans l'ordre des fichiers. Chaque étape
 * est marquée « importée » : elle n'a pas eu de détection automatique et compte au bilan RGPD.
 * Renvoie l'identifiant de la démo créée.
 */
export async function createDemoFromImages(opts: {
  workspaceId: string;
  userId: string;
  folderId: string | null;
  title: string;
  files: File[];
}): Promise<string> {
  const { data: demo, error } = await supabase
    .from('demos')
    .insert({
      workspace_id: opts.workspaceId,
      title: opts.title,
      created_by: opts.userId,
      folder_id: opts.folderId,
    })
    .select()
    .single();
  if (error) throw error;
  let position = 0;
  for (const file of orderImages(opts.files)) {
    const bmp = await createImageBitmap(file);
    const id = crypto.randomUUID();
    const path = `${opts.workspaceId}/${demo.id}/${id}.${extOf(file)}`;
    const up = await supabase.storage.from('captures').upload(path, file, { contentType: file.type });
    if (up.error) throw up.error;
    const ins = await supabase.from('steps').insert({
      id,
      demo_id: demo.id,
      workspace_id: opts.workspaceId,
      kind: 'image',
      image_path: path,
      image_width: bmp.width,
      image_height: bmp.height,
      position: position++,
      element_meta: { imported: true, file_name: file.name.slice(0, 120) },
    });
    if (ins.error) throw ins.error;
  }
  return demo.id as string;
}
