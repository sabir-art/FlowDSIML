/**
 * L38-7 (revue formation n° 7) : bloc « Formation » de la page Partager. Il dit de quelle formation la démo
 * est un module, ou permet de l'ajouter à une formation (choix de la formation et de la position), et mène
 * au paquet SCORM (Diffuser). Écriture réservée aux éditeurs (politique path_modules_write).
 */
import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CircleAlert, GraduationCap, PackageOpen } from 'lucide-react';
import type { Tables } from '@flowdsiml/supabase-types';
import { Select } from '@flowdsiml/ui';
import { supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';

type Mod = Pick<Tables<'path_modules'>, 'path_id' | 'demo_id' | 'position'>;

export function TrainingCard({
  demoId,
  workspaceId,
  editable,
  paths,
  modules,
  onChanged,
}: {
  demoId: string;
  workspaceId: string;
  editable: boolean;
  paths: Pick<Tables<'paths'>, 'id' | 'title'>[];
  modules: Mod[];
  onChanged: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const ids = useId();
  const { error, run } = useAction();
  const ordered = (pathId: string) =>
    modules.filter((m) => m.path_id === pathId).sort((a, b) => a.position - b.position);
  const mine = paths
    .map((p) => ({ p, n: ordered(p.id).findIndex((m) => m.demo_id === demoId) + 1 }))
    .filter((x) => x.n > 0);
  const free = paths.filter((p) => !mine.some((x) => x.p.id === p.id));
  const [pathId, setPathId] = useState('');
  const chosen = pathId || free[0]?.id || '';
  const count = chosen ? ordered(chosen).length : 0;
  const [pos, setPos] = useState<number | null>(null);
  const at = Math.min(pos ?? count, count);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!chosen) return;
    const path = paths.find((p) => p.id === chosen);
    await run(
      async () => {
        // Les modules suivants descendent d'un cran, puis le module prend la place choisie
        for (const m of ordered(chosen).filter((m) => m.position >= at))
          check(
            await supabase
              .from('path_modules')
              .update({ position: m.position + 1 })
              .eq('path_id', chosen)
              .eq('demo_id', m.demo_id),
          );
        check(
          await supabase
            .from('path_modules')
            .insert({ path_id: chosen, demo_id: demoId, workspace_id: workspaceId, position: at }),
        );
        setPos(null);
        await onChanged();
      },
      t('share.training.added', { path: path?.title ?? '' }),
    );
  }

  return (
    <div className="card card-pad sh-training">
      <h2 className="t-label">
        <GraduationCap aria-hidden="true" />
        {t('share.training.title')}
      </h2>
      {mine.map(({ p, n }) => (
        <p key={p.id}>{t('share.training.moduleOf', { n, path: p.title || t('learners.untitled') })}</p>
      ))}
      {mine.length === 0 && !editable && <p className="muted">{t('share.training.none')}</p>}
      {editable && free.length > 0 && (
        <form className="sh-training-add" onSubmit={add}>
          <div className="field">
            <label htmlFor={`${ids}-p`}>{t('share.training.path')}</label>
            <Select
              id={`${ids}-p`}
              value={chosen}
              onChange={(e) => {
                setPathId(e.target.value);
                setPos(null);
              }}
            >
              {free.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title || t('learners.untitled')}
                </option>
              ))}
            </Select>
          </div>
          <div className="field">
            <label htmlFor={`${ids}-n`}>{t('share.training.position')}</label>
            <Select id={`${ids}-n`} value={at} onChange={(e) => setPos(Number(e.target.value))}>
              {Array.from({ length: count + 1 }, (_, i) => (
                <option key={i} value={i}>
                  {i === count
                    ? t('share.training.last', { n: i + 1 })
                    : t('share.training.at', { n: i + 1 })}
                </option>
              ))}
            </Select>
          </div>
          <button type="submit" className="btn btn-secondary">
            {t('share.training.add')}
          </button>
        </form>
      )}
      {editable && paths.length === 0 && (
        <p className="muted">
          {t('share.training.noPath')} <Link to="/learners">{t('share.training.toLearners')}</Link>
        </p>
      )}
      {error && (
        <p className="error-msg" role="alert">
          <CircleAlert aria-hidden="true" />
          {error}
        </p>
      )}
      <p className="sh-training-scorm">
        <PackageOpen aria-hidden="true" />
        <Link to={`/demos/${demoId}/distribute`}>{t('share.training.scorm')}</Link>
      </p>
    </div>
  );
}

/**
 * Parcours de formation d'une démo, dans la fenêtre « Diffuser » (première section) : la carte charge
 * elle-même les parcours de l'espace et la place de la démo.
 */
export function TrainingSection({
  demoId,
  workspaceId,
  editable,
}: {
  demoId: string;
  workspaceId: string;
  editable: boolean;
}) {
  const [data, setData] = useState<{ paths: Pick<Tables<'paths'>, 'id' | 'title'>[]; modules: Mod[] } | null>(
    null,
  );
  const load = useCallback(async () => {
    const [paths, mods] = await Promise.all([
      supabase.from('paths').select('id, title').eq('workspace_id', workspaceId),
      supabase.from('path_modules').select('path_id, demo_id, position').eq('workspace_id', workspaceId),
    ]);
    setData({ paths: paths.data ?? [], modules: mods.data ?? [] });
  }, [workspaceId]);
  useEffect(() => {
    void load();
  }, [load]);
  if (!data) return null;
  return (
    <TrainingCard
      demoId={demoId}
      workspaceId={workspaceId}
      editable={editable}
      paths={data.paths}
      modules={data.modules}
      onChanged={load}
    />
  );
}
