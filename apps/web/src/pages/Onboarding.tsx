import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Chrome,
  CircleAlert,
  Globe,
  Info,
  Mail,
  Monitor,
  Settings,
  Upload,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { check, useAction } from '../lib/useAction';
import { focusFirstError, validateForm, type FieldErrors } from '../lib/validation';
import { useAuth } from '../auth/AuthProvider';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { BrandMark } from '../components/BrandMark';
import { MkFieldError } from './auth/AuthLayout';
import '../styles/maquette.css';
import '../styles/maquette-ajouts.css';
import '../styles/maquette-peau.css';

type Step = 1 | 2 | 3;
const USES = [
  { id: 'website', icon: Globe },
  { id: 'outreach', icon: Mail },
  { id: 'presales', icon: Monitor },
] as const;

/** Avancement réel de la checklist de l'étape 3 (données du workspace créé). */
type Progress = { captured: boolean; shared: boolean; viewed: boolean };

/** Onboarding (ONB-01 à 03), à l'identique de la maquette onboarding.html : espace, extension, premiers pas. */
export function Onboarding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { reload, select, workspaces } = useWorkspace();
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState('');
  const [use, setUse] = useState<(typeof USES)[number]['id']>('website');
  const [wsId, setWsId] = useState<string | null>(null);
  const [extAck, setExtAck] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const { busy, error, run } = useAction();
  const heading = useRef<HTMLHeadingElement>(null);
  const first = (profile?.full_name ?? '').trim().split(/\s+/)[0];

  // Accessibilité de la maquette : le titre de l'étape reçoit le focus à chaque changement d'étape
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus();
  }, [step]);

  // Étape 3 : coches calculées à partir des données réelles du workspace
  useEffect(() => {
    if (step !== 3 || !wsId) return;
    void (async () => {
      const [d, o] = await Promise.all([
        supabase.from('demos').select('id,status').eq('workspace_id', wsId).is('deleted_at', null),
        supabase.rpc('workspace_overview', { p_workspace: wsId, p_days: 3650 }),
      ]);
      const demos = (d.data ?? []) as Array<{ status: string }>;
      const rows = (o.data ?? []) as Array<{ views: number }>;
      setProgress({
        captured: demos.length > 0,
        shared: demos.some((x) => x.status === 'published'),
        viewed: rows.some((r) => Number(r.views) > 0),
      });
    })();
  }, [step, wsId]);

  async function createWorkspace(wsName: string) {
    const ws = await run(async () => check(await supabase.rpc('create_workspace', { p_name: wsName })));
    if (!ws) return null;
    await reload();
    select(ws.id);
    setWsId(ws.id);
    // Usage déclaré : mémorisé sur le compte (servira à proposer des modèles, V2)
    void supabase.auth.updateUser({ data: { use_case: use } });
    return ws.id as string;
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs = validateForm(e.currentTarget, t);
    setErrors(errs);
    if (focusFirstError(e.currentTarget, errs)) return;
    if (wsId || (await createWorkspace(name.trim()))) setStep(2);
  }

  // « Passer » : il faut au moins un espace pour utiliser l'app ; à l'étape 1, on le crée avec le nom saisi
  // (ou un nom par défaut), puis on va aux démos.
  async function skip() {
    if (!wsId && step === 1 && workspaces.length === 0) {
      const ok = await createWorkspace(
        name.trim() || t('onboarding.defaultName', { name: first || '' }).trim(),
      );
      if (!ok) return;
    }
    navigate('/', { replace: true });
  }

  const steps = [t('onboarding.done.account'), t('onboarding.done.extension')];

  return (
    <div className="mk">
      <div className="ob">
        <header className="ob-top">
          <span className="row ob-brand">
            <BrandMark size={40} />
          </span>
          <div className="ob-steps" aria-label={t('onboarding.progress')}>
            {[1, 2, 3].map((n) => (
              <span key={n} className={n <= step ? 'on' : undefined} />
            ))}
            <span className="t-caption muted ob-steplabel">
              {t('onboarding.stepOf', { n: step, total: 3 })}
            </span>
          </div>
          <button type="button" className="mk-link t-label" onClick={() => void skip()} disabled={busy}>
            {t('onboarding.skip')}
          </button>
        </header>
        <main className="ob-body" id="main">
          <div className="ob-card">
            {error && (
              <div className="alert alert-danger ob-alert" role="alert">
                <CircleAlert aria-hidden="true" />
                {error}
              </div>
            )}

            {step === 1 && (
              <section aria-labelledby="ob-h1">
                {first && <p className="t-label ob-hello">{t('onboarding.hello', { name: first })}</p>}
                <h1 id="ob-h1" ref={heading} tabIndex={-1} className="ob-h1">
                  {t('onboarding.title')}
                </h1>
                <p className="muted t-lg ob-sub">{t('onboarding.subtitle')}</p>
                <form onSubmit={submit} noValidate>
                  <div className="field ob-field">
                    <label htmlFor="ws-name">{t('onboarding.name')}</label>
                    <input
                      id="ws-name"
                      className="input"
                      required
                      maxLength={80}
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setErrors({});
                      }}
                      aria-describedby={errors['ws-name'] ? 'ws-name-error ws-help' : 'ws-help'}
                      {...(errors['ws-name'] ? { 'aria-invalid': true } : {})}
                    />
                    <MkFieldError id="ws-name" errors={errors} />
                    <span className="help" id="ws-help">
                      {t('onboarding.nameHelp')}
                    </span>
                  </div>
                  <fieldset className="ob-fieldset">
                    <legend className="label ob-legend">{t('onboarding.useQuestion')}</legend>
                    <div className="choice-grid">
                      {USES.map(({ id, icon: Icon }) => (
                        <label key={id} className="choice">
                          <input type="radio" name="use" checked={use === id} onChange={() => setUse(id)} />
                          <Icon aria-hidden="true" />
                          <b>{t(`onboarding.use.${id}`)}</b>
                          <span className="t-caption muted">{t(`onboarding.use.${id}Help`)}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="row between ob-actions">
                    <span />
                    <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
                      {t('onboarding.continue')}
                      <ArrowRight aria-hidden="true" />
                    </button>
                  </div>
                </form>
              </section>
            )}

            {step === 2 && (
              <section aria-labelledby="ob-h2">
                <h1 id="ob-h2" ref={heading} tabIndex={-1}>
                  {t('onboarding.extTitle')}
                </h1>
                <p className="muted t-lg ob-sub">{t('onboarding.extSubtitle')}</p>
                <div className="ext-visual">
                  <div className="col ob-ext-steps">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="row-3">
                        <span className="badge badge-primary">{n}</span>
                        {t(`onboarding.ext${n}`)}
                      </div>
                    ))}
                    <div className="row ob-ext-actions">
                      {/* Extension pas encore publiée sur le Chrome Web Store ; import d'images pas encore disponible */}
                      <button type="button" className="btn btn-primary" aria-disabled="true">
                        <Chrome aria-hidden="true" />
                        {t('onboarding.addToChrome')}
                        <span className="badge">{t('shell.soon')}</span>
                      </button>
                      <button type="button" className="btn btn-ghost" aria-disabled="true">
                        <Upload aria-hidden="true" />
                        {t('onboarding.importInstead')}
                        <span className="badge">{t('shell.soon')}</span>
                      </button>
                    </div>
                  </div>
                  <div className="ext-pop" aria-hidden="true">
                    <div className="row between">
                      <BrandMark size={18} />
                      <Settings />
                    </div>
                    <div className="segmented">
                      <button type="button" tabIndex={-1} aria-checked="true" role="radio">
                        {t('onboarding.popCaptures')}
                      </button>
                      <button type="button" tabIndex={-1} aria-checked="false" role="radio">
                        HTML <span className="badge ob-badge-xs">V2</span>
                      </button>
                    </div>
                    <span className="setting ob-setting">
                      <span className="t-caption">{t('onboarding.popTabs')}</span>
                      <span className="switch">
                        <input type="checkbox" checked readOnly tabIndex={-1} />
                        <span />
                      </span>
                    </span>
                    <span className="btn btn-accent btn-block">
                      <span className="ob-rec" />
                      {t('onboarding.popStart')}
                    </span>
                  </div>
                </div>
                <div className="alert ob-browsers">
                  <Info aria-hidden="true" />
                  <span>{t('onboarding.browsers')}</span>
                </div>
                <div className="row between ob-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
                    <ArrowLeft aria-hidden="true" />
                    {t('onboarding.back')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-lg"
                    onClick={() => {
                      setExtAck(true);
                      setStep(3);
                    }}
                  >
                    {t('onboarding.extDone')}
                  </button>
                </div>
              </section>
            )}

            {step === 3 && (
              <section aria-labelledby="ob-h3">
                <h1 id="ob-h3" ref={heading} tabIndex={-1}>
                  {t('onboarding.firstTitle')}
                </h1>
                <p className="muted t-lg ob-sub">{t('onboarding.firstSubtitle')}</p>
                <ol className="checklist ob-checklist">
                  {steps.map((label, i) => (
                    <Item key={label} done={i === 0 || extAck || Boolean(progress?.captured)} label={label} />
                  ))}
                  <li>
                    {progress?.captured ? <Done /> : <span className="todo" aria-hidden="true" />}
                    <span className="grow">
                      {progress?.captured ? (
                        <s className="muted">{t('onboarding.done.capture')}</s>
                      ) : (
                        <>
                          <b>{t('onboarding.done.capture')}</b>
                          <br />
                          <span className="t-caption muted">{t('onboarding.captureHelp')}</span>
                        </>
                      )}
                    </span>
                    {!progress?.captured && (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => setStep(2)}>
                        {t('onboarding.start')}
                      </button>
                    )}
                  </li>
                  <Item done={Boolean(progress?.shared)} label={t('onboarding.done.share')} />
                  <Item done={Boolean(progress?.viewed)} label={t('onboarding.done.view')} />
                </ol>
                <div className="row between ob-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>
                    <ArrowLeft aria-hidden="true" />
                    {t('onboarding.back')}
                  </button>
                  {/* Pas encore de démo d'exemple fournie avec un nouvel espace */}
                  <span className="btn btn-secondary btn-lg" aria-disabled="true">
                    {t('onboarding.exploreSample')}
                    <span className="badge">{t('shell.soon')}</span>
                  </span>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function Done() {
  return (
    <span className="ok">
      <Check aria-hidden="true" />
    </span>
  );
}

function Item({ done, label }: { done: boolean; label: string }) {
  const { t } = useTranslation();
  return (
    <li>
      {done ? <Done /> : <span className="todo" aria-hidden="true" />}
      <span className="grow">{done ? <s className="muted">{label}</s> : label}</span>
      <span className="sr-only">{done ? t('onboarding.doneSr') : t('onboarding.todoSr')}</span>
    </li>
  );
}
