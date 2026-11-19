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

export const MODULES = ['capturer', 'modifier', 'flouter', 'publier', 'diffuser', 'statistiques'] as const;
export type Module = (typeof MODULES)[number];
type Tour = { key: string; demo_id: string; title: string; steps: number };

export function Academy() {
  const { t } = useTranslation();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [tours, setTours] = useState<Record<string, Tour>>({});
  const [playing, setPlaying] = useState<Module | null>(null);

  useEffect(() => {
    void Promise.all([
      supabase.from('learn_progress').select('module'),
      supabase
        .from('help_tours')
        .select('key, demo_id, title, steps')
        .in(
          'key',
          MODULES.map((m) => `learn-${m}`),
        ),
    ]).then(([p, h]) => {
      setDone(new Set((p.data ?? []).map((r) => r.module)));
      setTours(Object.fromEntries((h.data ?? []).map((r) => [r.key.replace(/^learn-/, ''), r])));
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

  const n = MODULES.filter((m) => done.has(m)).length;
  const next = MODULES.find((m) => !done.has(m) && tours[m]);
  const tour = playing ? tours[playing] : null;
  return (
    <section className="help-sec academy" aria-labelledby="ac-t">
      <div className="academy-head">
        <GraduationCap aria-hidden="true" />
        <b id="ac-t">{t('learn.title')}</b>
        <span className="help-muted academy-count">{t('learn.count', { n, total: MODULES.length })}</span>
      </div>
      <div
        className="academy-bar"
        role="progressbar"
        aria-label={t('learn.progress')}
        aria-valuemin={0}
        aria-valuemax={MODULES.length}
        aria-valuenow={n}
        aria-valuetext={t('learn.valuetext', { count: n, total: MODULES.length })}
      >
        <span style={{ width: `${(n / MODULES.length) * 100}%` }} />
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
                <span className="help-muted academy-act">{t('learn.soon')}</span>
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
          demoId={tour.demo_id}
          title={tour.title || t(`learn.m.${playing}`)}
          onComplete={() => finish(playing)}
          onClose={() => setPlaying(null)}
        />
      )}
    </section>
  );
}
