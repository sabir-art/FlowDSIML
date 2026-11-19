import { Upload } from 'tus-js-client';
import type { Json } from '@flowdsiml/supabase-types';
import { supabase } from './supabase';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import { MAX_BYTES, proposePauses } from './video';
import type { PendingVideo } from './videoStore';

/** Envoi par reprise (TUS) vers le stockage, par morceaux de 6 Mo (exigence de Supabase). */
function tusUpload(
  blob: Blob,
  bucket: string,
  path: string,
  token: string,
  onProgress: (sent: number, total: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const up = new Upload(blob, {
      endpoint: `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000],
      headers: { authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY, 'x-upsert': 'false' },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: { bucketName: bucket, objectName: path, contentType: 'video/webm', cacheControl: '3600' },
      chunkSize: 6 * 1024 * 1024,
      onError: (e) => reject(e),
      onProgress: (sent, total) => onProgress(sent, total),
      onSuccess: () => resolve(),
    });
    up.start();
  });
}

/**
 * F7 : envoi après vérification. Crée la démo (desktop ou mobile), envoie la vidéo (TUS, bucket
 * videos, 50 Mo au plus), les images des repères (bucket captures), puis l'étape vidéo avec ses
 * pauses-étapes proposées (clics et marques). Renvoie l'id de la démo.
 */
export async function sendVideo(v: PendingVideo, onProgress: (ratio: number) => void): Promise<string> {
  if (v.blob.size > MAX_BYTES) throw new Error('TOO_BIG');
  const { data: s } = await supabase.auth.getSession();
  const user = s.session?.user;
  if (!user || !s.session) throw new Error('Non connecté');
  const demo = await supabase
    .from('demos')
    .insert({
      workspace_id: v.workspaceId,
      title: (v.title || 'Nouvelle démo').slice(0, 160),
      created_by: user.id,
      device: v.device,
      viewport: v.viewport as unknown as Json,
    })
    .select('id')
    .single();
  if (demo.error) throw demo.error;
  const demoId = demo.data.id;
  const stepId = crypto.randomUUID();
  const videoPath = `${v.workspaceId}/${demoId}/${crypto.randomUUID()}.webm`;
  await tusUpload(v.blob, 'videos', videoPath, s.session.access_token, (a, b) => onProgress((0.9 * a) / b));

  // Repères retenus (fusion à moins de 1,5 s) et leurs images
  const kept = proposePauses(v.marks, v.durationMs);
  const pauses: Array<{ id: string; t: number; title: string; body: string }> = [];
  const frames: Record<string, string> = {};
  for (const [i, m] of kept.entries()) {
    const id = `p-${i + 1}`;
    pauses.push({ id, t: Math.round(m.t), title: m.label.slice(0, 200), body: '' });
    const blob = v.frames[v.marks.indexOf(m)];
    if (blob && blob.size) {
      const path = `${v.workspaceId}/${demoId}/${crypto.randomUUID()}.webp`;
      const up = await supabase.storage.from('captures').upload(path, blob, { contentType: 'image/webp' });
      if (!up.error) frames[id] = path;
    }
    onProgress(0.9 + (0.08 * (i + 1)) / Math.max(1, kept.length));
  }
  const ins = await supabase.from('steps').insert({
    id: stepId,
    demo_id: demoId,
    workspace_id: v.workspaceId,
    position: 0,
    kind: 'video',
    title: (v.title || 'Vidéo').slice(0, 200),
    page_url: v.url.slice(0, 2000),
    video_path: videoPath,
    video_duration_ms: Math.max(1, Math.min(600000, Math.round(v.durationMs))),
    video: {
      pauses,
      frames,
      captions: [],
      hasVoice: v.hasVoice,
      captionsDefault: false,
      autoplayMuted: true,
    } as unknown as Json,
  });
  if (ins.error) {
    // Étape refusée (quota, fichier absent) : la vidéo déposée est retirée
    await supabase.storage.from('videos').remove([videoPath]);
    throw ins.error;
  }
  onProgress(1);
  return demoId;
}
