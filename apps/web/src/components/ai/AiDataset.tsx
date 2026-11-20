import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { labelType, personalColumn } from '@flowdsiml/core';
import { AiRequestError, aiBlock, callAi, useAiStatus } from '../../lib/ai';
import { useBlockText } from './AiWrite';
import './ai.css';

export const DATASET_ROWS = [10, 20, 50] as const;

/** Colonnes demandées : « structure, nombre de jeunes suivis, taux » → 1 à 20 en-têtes uniques. */
export function parseColumns(s: string): string[] {
  const seen = new Set<string>();
  return s
    .split(/[,;\n]/)
    .map((c) => c.trim().replace(/\s+/g, ' ').slice(0, 60))
    .filter((c) => c && !seen.has(c.toLocaleLowerCase()) && seen.add(c.toLocaleLowerCase()))
    .slice(0, 20);
}

/** Garde-fou L25 : en-tête de nom, d'e-mail ou d'identifiant de personne (avant tout envoi). */
export function personalHeader(c: string): boolean {
  const lt = labelType(c);
  return !!lt && ['name', 'email', 'phone', 'identifier', 'nir', 'iban', 'birthdate', 'address'].includes(lt);
}

/**
 * L30-06 : « Générer des données fictives » dans la modale Jeu de données. Colonnes décrites, nombre
 * de lignes, aperçu (10 premières lignes), puis « Utiliser ce jeu de données » ou « Ignorer ».
 */
export function AiDataset({
  ws,
  lang,
  onUse,
  onCancel,
}: {
  ws: string;
  lang: string;
  onUse: (d: { columns: string[]; rows: string[][] }) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const blockText = useBlockText();
  const { status } = useAiStatus(ws);
  const [desc, setDesc] = useState('');
  const [rows, setRows] = useState<(typeof DATASET_ROWS)[number]>(10);
  const [phase, setPhase] = useState<'input' | 'busy' | 'ready' | 'error' | 'blocked'>('input');
  const [message, setMessage] = useState('');
  const [data, setData] = useState<{ columns: string[]; rows: string[][] } | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => () => ctrl.current?.abort(), []);

  const generate = async () => {
    const columns = parseColumns(desc);
    if (columns.some(personalHeader)) {
      setMessage(t('ai.dataset.personal'));
      return setPhase('blocked');
    }
    const b = aiBlock(status, 'dataset');
    if (b) {
      setMessage(blockText(b, status));
      return setPhase('blocked');
    }
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setPhase('busy');
    try {
      const r = await callAi<{ rows: string[][] }>(
        ws,
        'dataset',
        lang,
        { columns, rows, context: desc },
        c.signal,
      );
      // Garde-fou après génération : aucune colonne personnelle (mêmes règles que l'import CSV)
      if (
        columns.some((col, i) =>
          personalColumn(
            col,
            r.rows.map((x) => x[i] ?? ''),
          ),
        )
      ) {
        setMessage(t('ai.dataset.personal'));
        return setPhase('blocked');
      }
      setData({ columns, rows: r.rows });
      setPhase('ready');
    } catch (e) {
      if (e instanceof AiRequestError && e.code === 'ABORTED') return setPhase('input');
      if (e instanceof AiRequestError && (e.code === 'AI_QUOTA_WORKSPACE' || e.code === 'AI_QUOTA_USER')) {
        setMessage(blockText(e.code === 'AI_QUOTA_USER' ? 'userQuota' : 'quota', status));
        return setPhase('blocked');
      }
      setPhase('error');
    }
  };

  return (
    <section className="ai-preview ai-dataset" aria-labelledby="ai-ds-t" aria-busy={phase === 'busy'}>
      <h3 id="ai-ds-t">{t('ai.dataset.title')}</h3>
      <span className="sr-only" role="status">
        {phase === 'ready' ? t('ai.ready') : ''}
      </span>
      {phase !== 'ready' && (
        <>
          <label className="fd-field">
            <span className="fd-label">{t('ai.dataset.columns')}</span>
            <input
              className="fd-input"
              value={desc}
              maxLength={500}
              placeholder={t('ai.dataset.placeholder')}
              disabled={phase === 'busy'}
              onChange={(e) => {
                setDesc(e.target.value);
                if (phase === 'blocked') setPhase('input');
              }}
            />
          </label>
          <label className="fd-field">
            <span className="fd-label">{t('ai.dataset.rows')}</span>
            <select
              className="fd-input"
              value={rows}
              disabled={phase === 'busy'}
              onChange={(e) => setRows(Number(e.target.value) as (typeof DATASET_ROWS)[number])}
            >
              {DATASET_ROWS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {phase === 'busy' && (
        <>
          <p className="ai-after">{t('ai.dataset.busy')}</p>
          <div className="ai-progress" aria-hidden="true" />
        </>
      )}
      {phase === 'blocked' && (
        <p className="ai-after" role="alert">
          {message}
        </p>
      )}
      {phase === 'error' && (
        <p className="ai-after" role="alert">
          {t('ai.error')}
        </p>
      )}
      {phase === 'ready' && data && (
        <>
          <p className="t-caption muted">
            {t('ai.dataset.count', { count: data.rows.length, cols: data.columns.length })}
          </p>
          <div className="ai-tr-table-wrap">
            <table className="ai-tr-table ai-ds-table">
              <caption className="sr-only">{t('ai.dataset.caption')}</caption>
              <thead>
                <tr>
                  {data.columns.map((c) => (
                    <th key={c} scope="col">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.slice(0, 10).map((r, i) => (
                  <tr key={i}>
                    {data.columns.map((c, j) => (
                      <td key={c}>{r[j]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="t-caption">{t('ai.dataset.invented')}</p>
          <p className="ai-mention">
            <Sparkles aria-hidden="true" />
            {t('ai.mention')}
          </p>
        </>
      )}
      <div className="ai-actions">
        {phase === 'ready' && data ? (
          <button type="button" className="fd-btn fd-btn--primary fd-btn--sm" onClick={() => onUse(data)}>
            {t('ai.dataset.use')}
          </button>
        ) : phase === 'busy' ? (
          <button type="button" className="fd-btn fd-btn--sm" onClick={() => ctrl.current?.abort()}>
            {t('ai.stop')}
          </button>
        ) : (
          <button
            type="button"
            className="fd-btn fd-btn--primary fd-btn--sm"
            disabled={!parseColumns(desc).length}
            onClick={() => void generate()}
          >
            {phase === 'error' ? t('ai.retry') : t('ai.dataset.generate')}
          </button>
        )}
        <button type="button" className="fd-btn fd-btn--ghost fd-btn--sm" onClick={onCancel}>
          {t('ai.ignore')}
        </button>
      </div>
    </section>
  );
}
