import { supabase } from '../../lib/supabase';

/** EXT-02 §4.1 : formats acceptés à l'import d'une vidéo, et limites des vidéos enregistrées. */
export const VIDEO_ACCEPT = 'video/mp4,video/webm';
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const VIDEO_MAX_MS = 600_000;

export type VideoFileError = 'badType' | 'tooBig' | 'tooLong' | 'unreadable';

/** Extension retenue : le type déclaré d'abord, sinon le nom du fichier (certains systèmes n'envoient pas de type). */
export function videoExt(file: { type: string; name: string }): 'mp4' | 'webm' | null {
  if (file.type === 'video/mp4') return 'mp4';
  if (file.type === 'video/webm') return 'webm';
  if (file.type) return null;
  const m = /\.(mp4|webm)$/i.exec(file.name);
  return m ? (m[1]!.toLowerCase() as 'mp4' | 'webm') : null;
}

/** Contrôles faits avant tout envoi : format, poids, puis durée lue dans le fichier. */
export function checkVideoFile(
  file: { type: string; name: string; size: number },
  durationMs: number | null,
): VideoFileError | null {
  if (!videoExt(file)) return 'badType';
  if (file.size > VIDEO_MAX_BYTES) return 'tooBig';
  if (durationMs == null || !Number.isFinite(durationMs) || durationMs <= 0) return 'unreadable';
  if (durationMs > VIDEO_MAX_MS) return 'tooLong';
  return null;
}

/** Titre proposé : le nom du fichier sans extension, séparateurs remplacés par des espaces. */
export function titleFromFile(name: string): string {
  return name
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

/** Durée et taille d'image lues par le navigateur (rien n'est envoyé). */
export function readVideoMeta(file: File): Promise<{ durationMs: number; w: number; h: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    const done = (r: { durationMs: number; w: number; h: number } | null) => {
      URL.revokeObjectURL(url);
      v.removeAttribute('src');
      resolve(r);
    };
    v.preload = 'metadata';
    v.muted = true;
    v.onerror = () => done(null);
    v.onloadedmetadata = () => {
      // WebM enregistré sans durée : le navigateur la calcule en allant à la fin
      if (v.duration === Infinity) {
        v.ondurationchange = () => {
          if (v.duration !== Infinity)
            done({ durationMs: Math.round(v.duration * 1000), w: v.videoWidth, h: v.videoHeight });
        };
        v.currentTime = 1e7;
        return;
      }
      done({ durationMs: Math.round(v.duration * 1000), w: v.videoWidth, h: v.videoHeight });
    };
    v.src = url;
  });
}

/**
 * Crée une démo d'une seule étape vidéo à partir d'un fichier. L'étape est marquée « importée » :
 * aucune détection automatique n'a eu lieu, elle compte au bilan RGPD. Si l'étape est refusée (quota,
 * fichier absent), la vidéo déposée et la démo sont retirées. Renvoie l'identifiant de la démo.
 */
export async function createDemoFromVideo(opts: {
  workspaceId: string;
  userId: string;
  folderId: string | null;
  file: File;
  durationMs: number;
}): Promise<string> {
  const ext = videoExt(opts.file);
  if (!ext) throw new Error('BAD_TYPE');
  const title = titleFromFile(opts.file.name);
  const { data: demo, error } = await supabase
    .from('demos')
    .insert({
      workspace_id: opts.workspaceId,
      title: title || 'Vidéo',
      created_by: opts.userId,
      folder_id: opts.folderId,
    })
    .select('id')
    .single();
  if (error) throw error;
  const path = `${opts.workspaceId}/${demo.id}/${crypto.randomUUID()}.${ext}`;
  const drop = async () => {
    await supabase.storage.from('videos').remove([path]);
    await supabase.from('demos').delete().eq('id', demo.id);
  };
  const up = await supabase.storage
    .from('videos')
    .upload(path, opts.file, { contentType: ext === 'mp4' ? 'video/mp4' : 'video/webm' });
  if (up.error) {
    await drop();
    throw up.error;
  }
  const ins = await supabase.from('steps').insert({
    id: crypto.randomUUID(),
    demo_id: demo.id,
    workspace_id: opts.workspaceId,
    position: 0,
    kind: 'video',
    title: (title || 'Vidéo').slice(0, 200),
    video_path: path,
    video_duration_ms: Math.max(1, Math.min(VIDEO_MAX_MS, Math.round(opts.durationMs))),
    video: {
      pauses: [],
      frames: {},
      captions: [],
      hasVoice: false,
      captionsDefault: false,
      autoplayMuted: true,
    },
    element_meta: { imported: true, file_name: opts.file.name.slice(0, 120) },
  });
  if (ins.error) {
    await drop();
    throw ins.error;
  }
  return demo.id as string;
}
