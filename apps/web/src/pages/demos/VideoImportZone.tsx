import { useEffect, useId, useImperativeHandle, useRef, useState, type DragEvent, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CircleAlert, FileVideo, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { MEDIA_QUOTA, sizeLabel } from '../../components/media/MediaLibrary';
import {
  VIDEO_ACCEPT,
  checkVideoFile,
  createDemoFromVideo,
  megabytes,
  readVideoMeta,
  type VideoImport,
} from './importVideo';

type Failure = { title: string; body: string; action: 'other' | 'usage' };
type State =
  | { phase: 'idle' }
  | { phase: 'sending'; name: string; sent: number; total: number; stalled: boolean }
  | { phase: 'error'; failure: Failure };

export interface VideoImportHandle {
  /** Arrête l'envoi en cours (la vidéo déposée et la démo sont retirées). */
  stop: () => void;
}

/**
 * EXT-02 §4.1 bis : zone large « Importer une vidéo » (MEDIA-01 §18.1). Contrôles avant tout envoi
 * (format, poids, durée, place dans l'espace), envoi avec reprise et pourcentage, erreurs dans la zone.
 */
export function VideoImportZone({
  ws,
  userId,
  folderId,
  onBusy,
  onCreated,
  handle,
}: {
  ws: string;
  userId: string;
  folderId: string | null;
  /** Vrai pendant l'envoi : la fenêtre demande confirmation avant de se fermer. */
  onBusy: (busy: boolean) => void;
  onCreated: (demoId: string) => void;
  handle: Ref<VideoImportHandle>;
}) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ phase: 'idle' });
  const [over, setOver] = useState(false);
  const job = useRef<VideoImport | null>(null);
  const run = useRef(0);

  const stop = () => {
    run.current++;
    job.current?.abort();
    job.current = null;
    setState({ phase: 'idle' });
    onBusy(false);
  };
  useImperativeHandle(handle, () => ({ stop }));
  // Fenêtre démontée pendant un envoi : rien ne reste déposé
  useEffect(
    () => () => {
      job.current?.abort();
    },
    [],
  );
  // Reprise automatique au retour du réseau
  useEffect(() => {
    const onLine = () => job.current?.resume();
    window.addEventListener('online', onLine);
    return () => window.removeEventListener('online', onLine);
  }, []);

  const fail = (failure: Failure) => {
    job.current = null;
    setState({ phase: 'error', failure });
    onBusy(false);
  };
  const other = (key: string, vars: Record<string, unknown>): Failure => ({
    title: t(`videoImport.${key}.title`, vars),
    body: t(`videoImport.${key}.body`),
    action: 'other',
  });

  const start = async (file: File) => {
    const mine = ++run.current;
    const name = file.name;
    // Format et poids d'abord : la durée n'est lue que pour un fichier acceptable
    const early = checkVideoFile(file, 1);
    if (early === 'badType') return fail(other('badType', { name }));
    if (early === 'tooBig') return fail(other('tooBig', { name, size: megabytes(file.size) }));
    setState({ phase: 'sending', name, sent: 0, total: file.size, stalled: false });
    onBusy(true);
    const meta = await readVideoMeta(file);
    if (mine !== run.current) return;
    const late = checkVideoFile(file, meta?.durationMs ?? null);
    if (late === 'tooLong')
      return fail(other('tooLong', { name, min: Math.ceil((meta?.durationMs ?? 0) / 60_000) }));
    if (late) return fail(other('unreadable', { name }));
    const quota = (used: number): Failure => ({
      title: t('videoImport.quota.title', {
        used: sizeLabel(Math.min(used, MEDIA_QUOTA), i18n.language),
        total: sizeLabel(MEDIA_QUOTA, i18n.language),
      }),
      body: t('videoImport.quota.body'),
      action: 'usage',
    });
    // Place dans l'espace (médiathèque, vidéos, voix off) : même calcul que le serveur
    const usage = await supabase.rpc('workspace_usage', { p_workspace: ws });
    if (mine !== run.current) return;
    const st = (usage.data as { storage?: { media: number; videos: number; voices: number } } | null)
      ?.storage;
    const used = st ? st.media + st.videos + st.voices : 0;
    if (used + file.size > MEDIA_QUOTA) return fail(quota(used));
    try {
      const j = await createDemoFromVideo({
        workspaceId: ws,
        userId,
        folderId,
        file,
        durationMs: meta!.durationMs,
        onProgress: (sent, total) =>
          mine === run.current && setState({ phase: 'sending', name, sent, total, stalled: false }),
        onStall: () =>
          mine === run.current && setState((s) => (s.phase === 'sending' ? { ...s, stalled: true } : s)),
      });
      if (mine !== run.current) return j.abort();
      job.current = j;
      const demoId = await j.done;
      if (mine !== run.current) return;
      job.current = null;
      onBusy(false);
      onCreated(demoId);
    } catch (e) {
      if (mine !== run.current) return;
      const msg = `${(e as { message?: string })?.message ?? ''}`;
      if (msg === 'ABORTED') return;
      fail(msg.includes('MEDIA_QUOTA') ? quota(MEDIA_QUOTA) : other('failed', { name }));
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (state.phase === 'sending') return;
    const f = e.dataTransfer.files?.[0];
    if (f) void start(f);
  };
  const choose = () => input.current?.click();
  const field = (
    <input
      ref={input}
      id={`${id}-f`}
      type="file"
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      aria-label={t('videoImport.title')}
      accept={`${VIDEO_ACCEPT},.mp4,.webm`}
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (f) void start(f);
      }}
    />
  );
  const drag = {
    onDragOver: (e: DragEvent) => {
      if (state.phase === 'sending') return;
      e.preventDefault();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop,
  };

  if (state.phase === 'sending') {
    const pct = state.total ? Math.min(100, Math.floor((state.sent / state.total) * 100)) : 0;
    return (
      <div
        className={`nd-vz is-busy${state.stalled ? ' is-stalled' : ''}`}
        aria-busy="true"
        data-align-zone=""
      >
        <span className="nd-vz__tile" aria-hidden="true">
          <FileVideo />
        </span>
        <div className="nd-vz__txt" data-gap-exempt="">
          <b>{state.name}</b>
          <span role="status">
            {state.stalled
              ? t('videoImport.stalled', { pct })
              : t('videoImport.sending', {
                  pct,
                  sent: megabytes(state.sent),
                  total: megabytes(state.total),
                })}
          </span>
          <span
            className="nd-vz__bar"
            role="progressbar"
            aria-label={t('videoImport.progress')}
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <i style={{ width: `${pct}%` }} />
          </span>
        </div>
        <div className="nd-vz__acts">
          {state.stalled && (
            <button type="button" className="fd-btn" onClick={() => job.current?.resume()}>
              {t('videoImport.resume')}
            </button>
          )}
          <button type="button" className="fd-btn" onClick={stop}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    );
  }

  if (state.phase === 'error' && !over) {
    const f = state.failure;
    return (
      <div className="nd-vz is-error" data-align-zone="" {...drag}>
        {field}
        <span className="nd-vz__tile" aria-hidden="true">
          <CircleAlert />
        </span>
        <div className="nd-vz__txt" role="alert" data-gap-exempt="">
          <b>{f.title}</b>
          <span>{f.body}</span>
        </div>
        <div className="nd-vz__acts">
          {f.action === 'usage' ? (
            <Link className="fd-btn" to="/settings/usage">
              {t('videoImport.seeUsage')}
            </Link>
          ) : (
            <button type="button" className="fd-btn" aria-controls={`${id}-f`} onClick={choose}>
              {t('videoImport.pickOther')}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`nd-vz${over ? ' is-drag' : ''}`}
      role="group"
      aria-label={t('videoImport.title')}
      data-align-zone=""
      {...drag}
    >
      {field}
      <span className="nd-vz__tile" aria-hidden="true">
        {over ? <Upload /> : <FileVideo />}
      </span>
      <div className="nd-vz__txt" data-gap-exempt="">
        <b>{over ? t('dropzone.dropHere') : t('videoImport.title')}</b>
        <span id={`${id}-h`}>{t('videoImport.hint')}</span>
      </div>
      {!over && (
        <div className="nd-vz__acts">
          <button
            type="button"
            className="fd-btn"
            aria-controls={`${id}-f`}
            aria-describedby={`${id}-h`}
            onClick={choose}
          >
            <Upload aria-hidden="true" />
            {t('videoImport.pick')}
          </button>
        </div>
      )}
    </div>
  );
}
