import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { check } from '../../../lib/useAction';
import { errorMessage } from '../../../lib/errors';
import {
  MAX_DOMAINS,
  domainOk,
  htmlCaptureChanged,
  normalizeDomain,
  useHtmlCapture,
  type HtmlCapture,
  type HtmlCaptureMode,
} from '../../../lib/htmlCapture';
import { useWorkspace } from '../../../workspace/WorkspaceProvider';
import { useToast } from '../../../components/Toast';
import { HtmlCaptureNotice } from '../../../components/HtmlCaptureNotice';

const MODES: HtmlCaptureMode[] = ['allowed', 'domains', 'disabled'];

/**
 * L49 P1 (spec §2) : Paramètres › Sécurité, « Captures HTML ». Une ligne de réglage (libellé et aide à
 * gauche, 3 radios simples à droite) ; domaines en pastilles grises ; mention en texte gris ; « Enregistrer »
 * désactivé tant que rien n'a changé. Propriétaires et admins modifient (RPC set_html_capture, journal) ;
 * les autres rôles voient les mêmes valeurs en lecture seule.
 */
export function HtmlCaptureCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const { current, can } = useWorkspace();
  const ws = current!;
  const saved = useHtmlCapture(ws.id);
  const [draft, setDraft] = useState<HtmlCapture>(saved);
  const [input, setInput] = useState('');
  const [inputErr, setInputErr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();
  useEffect(() => setDraft(saved), [saved]);

  const locked = !can('workspace.settings');
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const noDomain = draft.mode === 'domains' && draft.domains.length === 0;

  function add() {
    const d = normalizeDomain(input);
    if (!d) return;
    if (!domainOk(d)) return setInputErr(t('htmlCapture.domainInvalid'));
    if (draft.domains.length >= MAX_DOMAINS) return setInputErr(t('htmlCapture.domainMax'));
    setInputErr(null);
    setInput('');
    if (!draft.domains.includes(d)) setDraft((x) => ({ ...x, domains: [...x.domains, d] }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      check(
        await supabase.rpc('set_html_capture', {
          p_ws: ws.id,
          p_mode: draft.mode,
          p_domains: draft.mode === 'domains' ? draft.domains : [],
        }),
      );
      htmlCaptureChanged(ws.id);
      toast(t('htmlCapture.saved'));
    } catch (e) {
      setError(errorMessage(t, e));
    } finally {
      setBusy(false);
    }
  }

  const off = locked ? { 'aria-disabled': true as const, 'aria-describedby': `${id}-ro` } : {};

  return (
    <section className="card sr-card hc-card" aria-labelledby={`${id}-t`}>
      <div className="sr-head">
        <h3 className="t-h3" id={`${id}-t`}>
          {t('htmlCapture.title')}
        </h3>
      </div>
      <fieldset className="sr-row sr-fieldset" aria-describedby={`${id}-h`}>
        <legend className="sr-only">{t('htmlCapture.legend')}</legend>
        <div>
          <b aria-hidden="true">{t('htmlCapture.legend')}</b>
          <p className="t-caption muted" id={`${id}-h`}>
            {t('htmlCapture.help')}
          </p>
          {locked && (
            <p className="hc-ro" id={`${id}-ro`}>
              {t('htmlCapture.readOnly')}
            </p>
          )}
        </div>
        <div className="sr-ctl hc-modes">
          {MODES.map((m) => (
            <label key={m} className="hc-mode">
              <input
                type="radio"
                name={`${id}-mode`}
                value={m}
                checked={draft.mode === m}
                {...off}
                onChange={() => !locked && setDraft((x) => ({ ...x, mode: m }))}
                onClick={(e) => locked && e.preventDefault()}
              />
              <span>
                <b>{t(`htmlCapture.${m}`)}</b>
                <small>{t(`htmlCapture.${m}Help`)}</small>
              </span>
            </label>
          ))}
          {draft.mode === 'domains' && (
            <div className="hc-domains">
              {draft.domains.length > 0 && (
                <ul className="hc-chips" aria-label={t('htmlCapture.domainsList')}>
                  {draft.domains.map((d) => (
                    <li key={d} className="hc-chip">
                      <span className="t-mono">{d}</span>
                      {!locked && (
                        <button
                          type="button"
                          className="fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm"
                          aria-label={t('htmlCapture.removeDomain', { domain: d })}
                          onClick={() =>
                            setDraft((x) => ({ ...x, domains: x.domains.filter((y) => y !== d) }))
                          }
                        >
                          <X aria-hidden="true" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {!locked && (
                <div className="field">
                  <label htmlFor={`${id}-d`}>{t('htmlCapture.domainLabel')}</label>
                  <div className="row hc-add">
                    <input
                      id={`${id}-d`}
                      className="input t-mono"
                      placeholder="app.example.com"
                      value={input}
                      aria-invalid={inputErr ? true : undefined}
                      aria-describedby={inputErr ? `${id}-de` : undefined}
                      onChange={(e) => {
                        setInput(e.target.value);
                        setInputErr(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          add();
                        }
                      }}
                    />
                    <button type="button" className="fd-btn" onClick={add}>
                      {t('htmlCapture.add')}
                    </button>
                  </div>
                  {inputErr && (
                    <p className="field-error" id={`${id}-de`} role="alert">
                      {inputErr}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          <HtmlCaptureNotice />
        </div>
      </fieldset>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="sr-foot hc-foot">
        <p className="hc-applied">{t('htmlCapture.applied')}</p>
        {!locked && (
          <button
            type="button"
            className="fd-btn fd-btn--primary"
            disabled={!dirty || busy || noDomain}
            onClick={() => void save()}
          >
            {t('common.save')}
          </button>
        )}
      </div>
    </section>
  );
}
