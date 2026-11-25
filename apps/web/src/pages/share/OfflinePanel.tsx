import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CircleCheck, Download, FileArchive, TriangleAlert } from 'lucide-react';
import { formatSize } from '@flowdsiml/exports/model';
import { download } from '../export/exportData';
import {
  MAX_OFFLINE_BYTES,
  OfflineBuildError,
  buildOfflinePackage,
  estimateOfflineSize,
  type OfflineBuild,
} from './offlinePackage';

type Job =
  | { status: 'idle' }
  | { status: 'running'; done: number; total: number }
  | { status: 'ready'; build: OfflineBuild }
  | { status: 'error'; error: OfflineBuildError };

/**
 * Retours du 24/11 (2e série) §8 : Diffuser › Hors ligne. Taille estimée avant de générer, avertissement
 * d'accès (l'archive contourne mot de passe et invitation), « Télécharger l'archive ». Réservé aux rôles
 * qui peuvent diffuser, et seulement si les exports hors de TutoClick sont autorisés (Paramètres ›
 * Sécurité). v1 sans lead ni suivi.
 */
export function OfflinePanel({
  demoId,
  editable,
  blocked,
}: {
  demoId: string;
  /** La personne peut diffuser cette démo. */
  editable: boolean;
  /** Identifiant de la note qui explique pourquoi l'export est indisponible (règles de l'espace). */
  blocked: string | null;
}) {
  const { t, i18n } = useTranslation();
  const [estimate, setEstimate] = useState<{ bytes: number | null; files: number } | 'loading' | 'error'>(
    'loading',
  );
  const [job, setJob] = useState<Job>({ status: 'idle' });
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setEstimate('loading');
    estimateOfflineSize(demoId, ac.signal).then(
      (e) => !ac.signal.aborted && setEstimate(e),
      () => !ac.signal.aborted && setEstimate('error'),
    );
    return () => {
      ac.abort();
      controller.current?.abort();
    };
  }, [demoId]);

  const tooBig =
    typeof estimate === 'object' && estimate.bytes !== null && estimate.bytes > MAX_OFFLINE_BYTES;
  const off = !editable || !!blocked || tooBig;
  const start = () => {
    if (off || job.status === 'running') return;
    const ac = new AbortController();
    controller.current = ac;
    setJob({ status: 'running', done: 0, total: 0 });
    buildOfflinePackage(demoId, (done, total) => setJob({ status: 'running', done, total }), ac.signal).then(
      (build) => {
        if (ac.signal.aborted) return;
        setJob({ status: 'ready', build });
        download(build.bytes, build.name, 'application/zip');
      },
      (e: unknown) => {
        if (ac.signal.aborted) return;
        setJob({
          status: 'error',
          error: e instanceof OfflineBuildError ? e : new OfflineBuildError('SERVER'),
        });
      },
    );
  };
  const cancel = () => {
    controller.current?.abort();
    setJob({ status: 'idle' });
  };
  const pct = job.status === 'running' && job.total ? Math.round((100 * job.done) / job.total) : 0;

  return (
    <div className="dif-off">
      <p className="dif-off__lead">{t('distribute.offline.intro')}</p>
      <dl className="dif-off__facts">
        <div>
          <dt>{t('distribute.offline.size')}</dt>
          <dd aria-live="polite">
            {estimate === 'loading'
              ? t('distribute.offline.sizeLoading')
              : estimate === 'error' || estimate.bytes === null
                ? t('distribute.offline.sizeUnknown')
                : t('distribute.offline.sizeValue', {
                    size: formatSize(estimate.bytes, i18n.language),
                    count: estimate.files,
                  })}
          </dd>
        </div>
        <div>
          <dt>{t('distribute.offline.limit')}</dt>
          <dd>{t('distribute.offline.limitValue')}</dd>
        </div>
      </dl>
      {/* L'archive contourne les modes d'accès : avertissement avant la génération */}
      <div className="alert alert-warning dif-off__warn" role="note" id="dif-off-warn">
        <TriangleAlert aria-hidden="true" />
        <span>{t('distribute.offline.warning')}</span>
      </div>
      <ul className="dif-off__limits">
        <li>{t('distribute.offline.limit1')}</li>
        <li>{t('distribute.offline.limit2')}</li>
        <li>{t('distribute.offline.limit3')}</li>
      </ul>
      {tooBig && (
        <p className="alert alert-danger" role="alert">
          <AlertTriangle aria-hidden="true" />
          <span>{t('distribute.offline.errSize')}</span>
        </p>
      )}

      {job.status === 'running' && (
        <div className="dif-block" role="status">
          <div className="row between dif-run">
            <span className="row dif-run-l">
              <span className="spinner" aria-hidden="true" />
              <b>{t('distribute.offline.generating')}</b>
            </span>
            {job.total > 0 && (
              <span className="t-caption muted num">
                {t('distribute.offline.progress', { done: job.done, total: job.total })}
              </span>
            )}
          </div>
          <div
            className="progress"
            role="progressbar"
            aria-label={t('distribute.offline.progressLabel')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      {job.status === 'ready' && (
        <div className="dif-block">
          <div className="alert alert-success" role="status">
            <CircleCheck aria-hidden="true" />
            <span>
              <b>{t('distribute.offline.readyTitle')}</b> {t('distribute.offline.readyText')}
            </span>
          </div>
          <div className="dif-file">
            <span className="dif-file-ic" aria-hidden="true">
              <FileArchive />
            </span>
            <span className="grow">
              <b>{job.build.name}</b>
              <span className="t-caption muted">
                {t('distribute.offline.fileMeta', {
                  size: formatSize(job.build.bytes.length, i18n.language),
                  n: job.build.versionNumber,
                })}
              </span>
            </span>
          </div>
        </div>
      )}
      {job.status === 'error' && (
        <div className="alert alert-danger dif-block" role="alert">
          <AlertTriangle aria-hidden="true" />
          <span>
            <b>{t('distribute.offline.errTitle')}</b>{' '}
            {job.error.code === 'ASSET' && job.error.step
              ? t('distribute.offline.errAsset', { n: job.error.step.n })
              : job.error.code === 'TOO_BIG'
                ? t('distribute.offline.errSize')
                : job.error.code === 'UNPUBLISHED'
                  ? t('distribute.offline.errUnpublished')
                  : t('distribute.offline.errServer')}
          </span>
        </div>
      )}

      <div className="row dif-off__acts">
        {job.status === 'running' ? (
          <button type="button" className="btn btn-secondary" onClick={cancel}>
            {t('common.cancel')}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            aria-disabled={off || undefined}
            aria-describedby={blocked ?? 'dif-off-warn'}
            title={!editable ? t('distribute.offline.noRight') : undefined}
            onClick={start}
          >
            <Download aria-hidden="true" />
            {t('distribute.offline.download')}
          </button>
        )}
      </div>
    </div>
  );
}
