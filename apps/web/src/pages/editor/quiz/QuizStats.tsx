import { ChartColumn } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../../lib/supabase';
import { formatPercent } from '../../../lib/format';
import type { QuestionRow } from '../types';

interface Stats {
  attempts: number;
  visitors: number;
  passRate: number;
  avgScore: number;
  questions: Array<{
    questionId: string;
    answered: number;
    correctRate: number;
    choices: Record<string, number>;
  }>;
}

/** F2 : analytics par question (quiz_stats : agrégats, aucune donnée nominative). */
export function QuizStats({ demoId, questions }: { demoId: string; questions: QuestionRow[] }) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    void supabase
      .rpc('quiz_stats', { p_demo: demoId })
      .then(({ data }) => setStats((data as unknown as Stats) ?? null));
  }, [demoId]);
  if (!stats) return null;
  return (
    <section className="fd-card stack" aria-labelledby="qz-stats">
      <div className="fd-card__head" style={{ margin: 0 }}>
        <span className="fd-icon-chip" aria-hidden="true">
          <ChartColumn />
        </span>
        <h2 className="fd-card__title" id="qz-stats">
          {t('editor.quiz.stats')}
        </h2>
      </div>
      {!stats.attempts ? (
        <p className="fd-muted">{t('editor.quiz.statsEmpty')}</p>
      ) : (
        <>
          <dl className="quiz-kpis">
            <div>
              <dt>{t('editor.quiz.statsAttempts', { count: stats.attempts })}</dt>
            </div>
            <div>
              <dt>{t('editor.quiz.statsPassRate')}</dt>
              <dd>{formatPercent(stats.passRate)}</dd>
            </div>
            <div>
              <dt>{t('editor.quiz.statsAvg')}</dt>
              <dd>{t('editor.quiz.thresholdValue', { value: stats.avgScore })}</dd>
            </div>
          </dl>
          <ol className="quiz-stats">
            {questions.map((q, i) => {
              const s = stats.questions.find((x) => x.questionId === q.id);
              const rate = s?.correctRate ?? 0;
              return (
                <li key={q.id}>
                  <span className="quiz-stats__label">
                    <span className="quiz-list__n">{i + 1}</span>
                    {q.prompt || t('editor.untitled')}
                  </span>
                  <span className="fd-bar fd-bar--h" aria-hidden="true">
                    <span className="fd-bar__fill" style={{ width: `${Math.round(rate * 100)}%` }} />
                  </span>
                  <span className="quiz-stats__value">
                    {t('editor.quiz.statsCorrect', { value: Math.round(rate * 100) })}
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}
