/**
 * L38 paquet 2 (revue formation n° 2 et 3) : « Importer une liste (CSV) ». Le fichier est contrôlé ligne par
 * ligne avant toute création ; seules les lignes sans erreur deviennent des liens. Après la création, les
 * liens s'exportent en CSV pour un publipostage. Aucun e-mail n'est envoyé par TutoClick.
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Upload, X } from 'lucide-react';
import { downloadText } from '../../lib/download';
import { COHORT_MAX, previewImport, TEMPLATE, type ImportPreview, type ImportRow } from './linksCsv';
import { Status } from '@flowdsiml/ui';

export function ImportLinksDialog({
  existing,
  cohortList,
  onImport,
  onExport,
  onClose,
}: {
  /** E-mails déjà portés par un lien de la démo (minuscules). */
  existing: Set<string>;
  /** Groupes déjà utilisés dans l'espace (suggestions). */
  cohortList: string[];
  /** Crée les liens des lignes valides ; renvoie les jetons créés. */
  onImport: (rows: ImportRow[]) => Promise<string[]>;
  /** Exporte les liens créés (jetons). */
  onExport: (tokens: string[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const ids = useId();
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [cohort, setCohort] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string[] | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy]);
  const preview: ImportPreview | null = text === null ? null : previewImport(text, existing, cohort);
  const valid = preview?.rows.filter((r) => !r.errors.length) ?? [];
  const invalid = preview?.rows.filter((r) => r.errors.length) ?? [];

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid.length || busy) return;
    setBusy(true);
    try {
      setCreated(await onImport(valid));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form
        className="modal modal-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${ids}-t`}
        onSubmit={submit}
        noValidate
      >
        <div className="modal-head">
          <h2 id={`${ids}-t`}>{t('share.import.title')}</h2>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            aria-label={t('common.close')}
            onClick={onClose}
            disabled={busy}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        {created ? (
          <>
            <div className="modal-body">
              <p role="status">{t('share.import.done', { count: created.length })}</p>
              <p className="muted">{t('share.import.doneHelp')}</p>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                {t('common.close')}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => onExport(created)}>
                <Download aria-hidden="true" />
                {t('share.import.export')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="modal-body">
              <p className="muted">{t('share.import.help')}</p>
              <p>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => downloadText(t('share.import.templateFile'), TEMPLATE)}
                >
                  <Download aria-hidden="true" />
                  {t('share.import.template')}
                </button>
              </p>
              <div className="field">
                <label htmlFor={`${ids}-f`} id={`${ids}-fl`}>
                  {t('share.import.file')}
                </label>
                {/* Champ natif masqué (libellé « Choose File » non traduisible) : bouton du design system */}
                <input
                  ref={fileRef}
                  id={`${ids}-f`}
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setFileName(f.name);
                    void f.text().then(setText);
                  }}
                />
                <div className="sh-file">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    aria-labelledby={`${ids}-fl ${ids}-fb`}
                    aria-describedby={`${ids}-fn`}
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload aria-hidden="true" />
                    <span id={`${ids}-fb`}>{t('share.import.choose')}</span>
                  </button>
                  <span
                    className={`sh-file-name${fileName ? '' : ' muted'}`}
                    id={`${ids}-fn`}
                    title={fileName}
                  >
                    {fileName || t('share.import.noFile')}
                  </span>
                </div>
              </div>
              <div className="field">
                <label htmlFor={`${ids}-g`}>
                  {t('share.cohort')} <span className="opt">{t('plans.optional')}</span>
                </label>
                <input
                  id={`${ids}-g`}
                  className="input"
                  list={`${ids}-gl`}
                  maxLength={COHORT_MAX}
                  value={cohort}
                  onChange={(e) => setCohort(e.target.value)}
                  aria-describedby={`${ids}-gh`}
                />
                <datalist id={`${ids}-gl`}>
                  {cohortList.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <span className="help" id={`${ids}-gh`}>
                  {t('share.import.cohortHelp')}
                </span>
              </div>
              {preview && preview.missing.length > 0 && (
                <p className="error-msg" role="alert">
                  {t('share.import.missing', {
                    file: fileName,
                    columns: preview.missing.map((m) => t(`share.import.col.${m}`)).join(', '),
                  })}
                </p>
              )}
              {preview && !preview.missing.length && (
                <div className="sh-import-preview">
                  <p role="status">
                    {t('share.import.summary', { count: valid.length })}
                    {invalid.length > 0 && <> {t('share.import.errors', { count: invalid.length })}</>}
                    {preview.truncated > 0 && (
                      <> {t('share.import.truncated', { count: preview.truncated })}</>
                    )}
                  </p>
                  {preview.rows.length > 0 && (
                    // Zone défilante atteignable au clavier (WCAG 2.1.1)
                    <div
                      className="table-wrap"
                      tabIndex={0}
                      role="region"
                      aria-label={t('share.import.caption')}
                    >
                      <table className="table">
                        <caption className="sr-only">{t('share.import.caption')}</caption>
                        <thead>
                          <tr>
                            <th scope="col">{t('share.import.line')}</th>
                            <th scope="col">{t('share.import.col.name')}</th>
                            <th scope="col">{t('share.import.col.email')}</th>
                            <th scope="col">{t('share.cohort')}</th>
                            <th scope="col">{t('share.import.check')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.rows.map((r) => (
                            <tr key={r.line} className={r.errors.length ? 'sh-import-ko' : undefined}>
                              <td>{r.line}</td>
                              <td className="sh-import-name">
                                {[r.firstName, r.lastName].filter(Boolean).join(' ') || '—'}
                              </td>
                              <td className="sh-import-email" title={r.email || undefined}>
                                {r.email || '—'}
                              </td>
                              <td className="sh-import-cohort">{r.cohort || '—'}</td>
                              <td>
                                {r.errors.length ? (
                                  <Status size="sm" tone="danger" className="sh-import-err">
                                    {r.errors.map((e) => t(`share.import.err.${e}`)).join(' · ')}
                                  </Status>
                                ) : (
                                  <Status size="sm" tone="success">
                                    {t('share.import.ok')}
                                  </Status>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={!valid.length || busy}>
                <Upload aria-hidden="true" />
                {busy ? t('share.import.creating') : t('share.import.create', { count: valid.length })}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
