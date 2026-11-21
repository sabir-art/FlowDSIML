/**
 * L26 §3.4 : « Apprendre TutoClick », parcours de 6 modules (chacun une visite guidée). Progression par
 * personne, « n sur 6 » ; un module est terminé quand la dernière étape de sa visite est vue. Libellés :
 * « Revoir » (fait), « Commencer » (le prochain), « n étapes » (les autres). Pas de durée affichée.
 * Sans visite configurée pour un module : « Bientôt disponible ».
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleCheck, Circle, GraduationCap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TourDialog } from './TourDialog';
import { MODULE_TOUR, loadTours, type TourEntry } from './tours';
import { Status } from '@flowdsiml/ui';

export const MODULES = ['capturer', 'modifier', 'flouter', 'publier', 'diffuser', 'statistiques'] as const;
export type Module = (typeof MODULES)[number];
type Tour = TourEntry;

export function Academy() {
  const { t } = useTranslation();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [tours, setTours] = useState<Record<string, Tour>>({});
  const [playing, setPlaying] = useState<Module | null>(null);

  useEffect(() => {
    void Promise.all([supabase.from('learn_progress').select('module'), loadTours()]).then(([p, list]) => {
      setDone(new Set((p.data ?? []).map((r) => r.module)));
      setTours(
        Object.fromEntries(
          MODULES.flatMap((m) => {
            const e = list.find((x) => x.key === MODULE_TOUR[m]);
            return e ? [[m, e]] : [];
          }),
        ),
      );
    });
  }, []);

  const finish = (m: Module) => {
    if (done.has(m)) return;
    setDone((d) => new Set(d).add(m));
    void supabase
      .from('learn_progress')
      .upsert({ module: m }, { onConflict: 'user_id,module', ignoreDuplicates: true })
      .then(() => undefined);
  };

  // La progression ne compte que les modules disponibles (« 0 sur 2 » s'il n'y en a que 2)
  const available = MODULES.filter((m) => tours[m]);
  const n = available.filter((m) => done.has(m)).length;
  const total = available.length;
  const next = MODULES.find((m) => !done.has(m) && tours[m]);
  const tour = playing ? tours[playing] : null;
  return (
    <section className="help-sec academy" aria-labelledby="ac-t">
      <div className="academy-head">
        <GraduationCap aria-hidden="true" />
        <b id="ac-t">{t('learn.title')}</b>
        {total > 0 && <span className="help-muted academy-count">{t('learn.count', { n, total })}</span>}
      </div>
      <div
        className="academy-bar"
        role="progressbar"
        aria-label={t('learn.progress')}
        aria-valuemin={0}
        aria-valuemax={total || 1}
        aria-valuenow={n}
        aria-valuetext={t('learn.valuetext', { count: n, total })}
      >
        <span style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
      </div>
      <ol>
        {MODULES.map((m) => {
          const ok = done.has(m);
          const tr = tours[m];
          return (
            <li key={m} className={ok ? 'done' : undefined}>
              {ok ? <CircleCheck aria-hidden="true" /> : <Circle aria-hidden="true" />}
              <span>
                {t(`learn.m.${m}`)}
                {ok && <span className="sr-only"> · {t('learn.done')}</span>}
              </span>
              {!tr ? (
                <Status size="sm" className="help-soon academy-act">
                  {t('shell.soon')}
                </Status>
              ) : ok || m === next ? (
                <button
                  type="button"
                  className={`academy-act${m === next ? ' is-next' : ''}`}
                  aria-label={`${ok ? t('learn.again') : t('learn.start')}\u202f: ${t(`learn.m.${m}`)}`}
                  onClick={() => setPlaying(m)}
                >
                  {ok ? t('learn.again') : t('learn.start')}
                </button>
              ) : (
                <span className="help-muted academy-act">{t('learn.steps', { count: tr.steps })}</span>
              )}
            </li>
          );
        })}
      </ol>
      {tour && playing && (
        <TourDialog
          tourId={tour.id}
          title={tour.title || t(`learn.m.${playing}`)}
          onComplete={() => finish(playing)}
          onClose={() => setPlaying(null)}
        />
      )}
    </section>
  );
}
