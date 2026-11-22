import { Fragment, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert, X, Plus } from 'lucide-react';
import { Button } from '@flowdsiml/ui';
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
import { useSavePart } from './saveParts';

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

  useSavePart('html', {
    dirty,
    busy,
    invalid: noDomain,
    save,
    reset: () => {
      setDraft(saved);
      setInput('');
      setInputErr(null);
      setError(null);
    },
  });

  return (
    <section className="stg-sec hc-card" aria-labelledby={`${id}-t`}>
      <div className="stg-sec__head">
        <div>
          <h2 id={`${id}-t`}>{t('htmlCapture.title')}</h2>
          <p>{t('htmlCapture.help')}</p>
        </div>
      </div>
      <fieldset className="stg-row stg-fieldset" aria-describedby={`${id}-h`}>
        <legend className="sr-only">{t('htmlCapture.legend')}</legend>
        <div className="stg-text" data-gap-exempt="">
          <div className="stg-lab" aria-hidden="true">
            {t('htmlCapture.legend')}
          </div>
          <div className="stg-help" id={`${id}-h`}>
            {t('htmlCapture.applied')}
          </div>
          {locked && (
            <div className="stg-help hc-ro" id={`${id}-ro`}>
              {t('htmlCapture.readOnly')}
            </div>
          )}
        </div>
        <div className="stg-ctl stg-ctl--wide hc-modes">
          {/* §18.6 : options d'un même groupe, 6 px de padding vertical chacune (maquette) */}
          <div className="stg-opts" data-gap-exempt="">
            {MODES.map((m) => (
              <Fragment key={m}>
                <label className="stg-opt hc-mode">
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
                    <span className="stg-help">{t(`htmlCapture.${m}Help`)}</span>
                  </span>
                </label>
                {m === 'domains' && draft.mode === 'domains' && (
                  /* Décision UX du 22/11 (securite-domaines) : sous le choix coché, en retrait de 28 px */
                  <div className="hc-domains">
                    {draft.domains.length > 0 && (
                      <ul className="hc-chips" aria-label={t('htmlCapture.domainsList')}>
                        {draft.domains.map((d) => (
                          <li key={d} className="hc-chip">
                            <span className="hc-chip__name">{d}</span>
                            {!locked && (
                              <button
                                type="button"
                                className="hc-chip__remove"
                                aria-label={t('htmlCapture.removeDomain', { domain: d })}
                                onClick={() =>
                                  setDraft((x) => ({ ...x, domains: x.domains.filter((y) => y !== d) }))
                                }
                              >
                                <X size={14} aria-hidden="true" />
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {!locked && (
                      <>
                        <div className="hc-add">
                          <input
                            id={`${id}-d`}
                            className="fd-input"
                            placeholder={t('htmlCapture.domainPlaceholder')}
                            autoComplete="off"
                            spellCheck={false}
                            value={input}
                            aria-label={t('htmlCapture.domainLabel')}
                            aria-invalid={inputErr ? true : undefined}
                            aria-describedby={inputErr ? `${id}-de ${id}-dh` : `${id}-dh`}
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
                          <Button icon={<Plus size={16} />} onClick={add}>
                            {t('htmlCapture.addDomain')}
                          </Button>
                        </div>
                        {inputErr && (
                          <p className="stg-error" id={`${id}-de`} role="alert">
                            <CircleAlert size={16} aria-hidden="true" />
                            {inputErr}
                          </p>
                        )}
                        <span className="stg-help" id={`${id}-dh`}>
                          {t('htmlCapture.domainHelp')}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </Fragment>
            ))}
          </div>
          <HtmlCaptureNotice />
          {error && (
            <p className="stg-error" role="alert">
              <CircleAlert size={16} aria-hidden="true" />
              {error}
            </p>
          )}
        </div>
      </fieldset>
    </section>
  );
}
