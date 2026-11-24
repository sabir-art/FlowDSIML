import { Upload } from 'tus-js-client';
import { supabase } from './supabase';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env';

export interface ResumableUpload {
  /** Résolue à la fin de l'envoi ; rejetée par `abort()` (erreur « ABORTED ») ou par un refus du serveur. */
  done: Promise<void>;
  /** Reprend après une coupure (le serveur dit où il en est). */
  resume: () => void;
  /** Arrête l'envoi et retire ce qui a déjà été déposé. */
  abort: () => void;
}

/**
 * Envoi avec reprise (protocole TUS) vers le stockage, par morceaux de 6 Mo (exigence de Supabase).
 * `onStall` : la connexion a coupé et les nouvelles tentatives ont échoué ; l'envoi attend `resume()`.
 */
export async function resumableUpload(opts: {
  bucket: string;
  path: string;
  file: Blob;
  contentType: string;
  onProgress: (sent: number, total: number) => void;
  onStall: () => void;
}): Promise<ResumableUpload> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('NO_SESSION');
  let settle: { resolve: () => void; reject: (e: unknown) => void };
  const done = new Promise<void>((resolve, reject) => {
    settle = { resolve, reject };
  });
  let stopped = false;
  const up = new Upload(opts.file, {
    endpoint: `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/upload/resumable`,
    retryDelays: [0, 1000, 3000],
    headers: { authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY, 'x-upsert': 'false' },
    uploadDataDuringCreation: true,
    removeFingerprintOnSuccess: true,
    metadata: {
      bucketName: opts.bucket,
      objectName: opts.path,
      contentType: opts.contentType,
      cacheControl: '3600',
    },
    chunkSize: 6 * 1024 * 1024,
    onProgress: opts.onProgress,
    onSuccess: () => settle.resolve(),
    onError: (e) => {
      if (stopped) return;
      // Refus du serveur (type, taille, droits) : définitif. Sinon, coupure : on attend la reprise.
      const status = (
        e as { originalResponse?: { getStatus(): number } | null }
      ).originalResponse?.getStatus();
      if (status && status >= 400 && status < 500 && status !== 409 && status !== 423) settle.reject(e);
      else opts.onStall();
    },
  });
  up.start();
  return {
    done,
    resume: () => {
      if (!stopped) up.start();
    },
    abort: () => {
      stopped = true;
      void up.abort(true).catch(() => undefined);
      settle.reject(new Error('ABORTED'));
    },
  };
}
