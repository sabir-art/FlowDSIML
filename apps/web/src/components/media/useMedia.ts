/**
 * Médiathèque de l'espace : fichiers, usages, occupation et actions (import avec catégorie déduite,
 * renommer, changer de catégorie, supprimer). Partagé par la page /media et la fenêtre de sélection.
 * Les fichiers passent par la fonction media (type réel, SVG assaini, quota) ; la table est en lecture.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Tables } from '@flowdsiml/supabase-types';
import { supabase } from '../../lib/supabase';
import { deduceKind, inspectFile, type KindReason, type MediaKind } from './mediaKind';

export type MediaFile = Tables<'media_files'>;
export type MediaFilter = 'all' | MediaKind;
export const MEDIA_QUOTA = 500 * 1024 * 1024;
export const MEDIA_MAX_BYTES = 5 * 1024 * 1024;
export const MEDIA_ACCEPT = '.png,.jpg,.jpeg,.svg,.woff2,image/png,image/jpeg,image/svg+xml,font/woff2';

export type UploadResult =
  | { ok: true; file: MediaFile; reason: KindReason }
  | { ok: false; error: 'tooBig' | 'badType' | 'svgRejected' | 'quota' | 'error' };

/** Code d'erreur renvoyé par la fonction media (corps JSON de la réponse). */
async function errorCode(error: unknown): Promise<string | null> {
  try {
    const res = (error as { context?: Response } | null)?.context;
    const body = res && typeof res.json === 'function' ? await res.clone().json() : null;
    return typeof body?.error === 'string' ? body.error : null;
  } catch {
    return null;
  }
}

export function useMedia(wsId: string | undefined) {
  const [files, setFiles] = useState<MediaFile[] | null>(null);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [used, setUsed] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!wsId) return;
    const [f, u, s] = await Promise.all([
      supabase
        .from('media_files')
        .select('*')
        .eq('workspace_id', wsId)
        .order('created_at', { ascending: false }),
      supabase.rpc('media_usage', { p_ws: wsId }),
      // Stockage de l'espace (médiathèque, vidéos, voix off), comme le quota côté serveur
      supabase.rpc('workspace_usage', { p_workspace: wsId }),
    ]);
    setFiles(f.data ?? []);
    const list = Array.isArray(u.data) ? (u.data as Array<{ id: string; demos: number }>) : [];
    setUsage(Object.fromEntries(list.map((x) => [x.id, x.demos])));
    const st = (s.data as { storage?: { media: number; videos: number; voices: number } } | null)?.storage;
    setUsed(st ? st.media + st.videos + st.voices : 0);
  }, [wsId]);
  useEffect(() => {
    void load();
  }, [load]);

  /** Importe un fichier ; sa catégorie est déduite (ou celle du filtre d'où part l'import). */
  const upload = useCallback(
    async (file: File, filter: MediaFilter = 'all'): Promise<UploadResult> => {
      if (!wsId) return { ok: false, error: 'error' };
      if (file.size > MEDIA_MAX_BYTES) return { ok: false, error: 'tooBig' };
      if (used + file.size > MEDIA_QUOTA) return { ok: false, error: 'quota' };
      const { kind, reason } = deduceKind(await inspectFile(file), filter);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('ws', wsId);
      fd.append('kind', kind);
      fd.append('name', file.name.slice(0, 120));
      setBusy(true);
      const { data, error } = await supabase.functions.invoke('media', { body: fd });
      setBusy(false);
      if (error || !data?.id) {
        const code = await errorCode(error);
        return {
          ok: false,
          error:
            code === 'MEDIA_QUOTA'
              ? 'quota'
              : code === 'TOO_BIG'
                ? 'tooBig'
                : code === 'BAD_TYPE'
                  ? 'badType'
                  : code === 'SVG_REJECTED'
                    ? 'svgRejected'
                    : 'error',
        };
      }
      await load();
      return { ok: true, file: data as MediaFile, reason };
    },
    [wsId, used, load],
  );

  const rename = useCallback(
    async (id: string, name: string) => {
      const { error } = await supabase.rpc('rename_media_file', { p_id: id, p_name: name });
      await load();
      return !error;
    },
    [load],
  );
  const setKind = useCallback(
    async (id: string, kind: 'logo' | 'image') => {
      const { error } = await supabase.rpc('set_media_kind', { p_id: id, p_kind: kind });
      await load();
      return !error;
    },
    [load],
  );
  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.functions.invoke('media', { method: 'DELETE', body: { id } });
      await load();
      return !error;
    },
    [load],
  );

  return { files, usage, used, busy, load, upload, rename, setKind, remove };
}
