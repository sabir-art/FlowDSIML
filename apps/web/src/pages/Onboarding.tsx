import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Check,
  CircleAlert,
  ExternalLink,
  FileText,
  GraduationCap,
  Megaphone,
  Puzzle,
  Pin,
  Users,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { check, useAction } from '../lib/useAction';
import { EXTENSION_URL } from '../lib/env';
import { initials } from '../lib/initials';
import { useMediaQuery } from '../lib/useMediaQuery';
import { useAuth } from '../auth/AuthProvider';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { BrandMark } from '../components/BrandMark';
import { useHelp } from '../help/HelpProvider';
import { useToast } from '../components/Toast';
import { createDemoFromImages, IMAGE_ACCEPT } from './demos/importImages';
import { orderedCategories, type UseCase } from './demos/templates';
import './onboarding.css';

type StepId = 'profile' | 'space' | 'use' | 'ext' | 'capture';
const FULL: StepId[] = ['profile', 'space', 'use', 'ext', 'capture'];
const JOBS = ['trainer', 'advisor', 'comms', 'it', 'other'] as const;
const USES: Array<{ id: UseCase; icon: typeof Users }> = [
  { id: 'train', icon: GraduationCap },
  { id: 'youth', icon: Users },
  { id: 'document', icon: FileText },
  { id: 'comms', icon: Megaphone },
];
const KEY = 'fd.onb.step';

interface Saved {
  step: number;
  firstName: string;
  job: string;
  name: string;
  uses: UseCase[];
  wsId: string | null;
}
function readSaved(): Partial<Saved> {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as Partial<Saved>;
  } catch {
    return {};
  }
}

/**
 * L48-C : assistant de démarrage en plein écran (spec docs/ux/specs/l48c-demarrage.md). Cinq étapes,
 * une question et une action principale par écran, aperçu décoratif à droite. L'étape atteinte et les
 * réponses sont gardées dans sessionStorage. « Nouvel espace » (menu) n'affiche que l'étape Espace.
 */
export function Onboarding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const newSpace = params.get('nouvel') === '1';
  const steps: StepId[] = newSpace ? ['space'] : FULL;
  const { profile, user } = useAuth();
  const { reload, select, workspaces, error: wsError } = useWorkspace();
  const help = useHelp();
  const toast = useToast();
  const narrow = useMediaQuery('(max-width: 899px)');
  const saved = useRef(newSpace ? {} : readSaved()).current;
  const meta = (user?.user_metadata ?? {}) as { first_name?: string; job?: string; use_cases?: UseCase[] };
  const [index, setIndex] = useState(Math.min(saved.step ?? 0, steps.length - 1));
  const [firstName, setFirstName] = useState(
    saved.firstName ?? meta.first_name ?? (profile?.full_name ?? '').trim().split(/\s+/)[0] ?? '',
  );
  const [job, setJob] = useState(saved.job ?? meta.job ?? '');
  const [name, setName] = useState(saved.name ?? '');
  const [uses, setUses] = useState<UseCase[]>(saved.uses ?? meta.use_cases ?? []);
  const [wsId, setWsId] = useState<string | null>(saved.wsId ?? null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [extSeen, setExtSeen] = useState(!!profile?.extension_seen_at);
  const { busy, error, run } = useAction();
  const heading = useRef<HTMLHeadingElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const step = steps[index]!;

  // Reprise : étape atteinte et réponses gardées pour un rechargement
  useEffect(() => {
    if (newSpace) return;
    try {
      sessionStorage.setItem(
        KEY,
        JSON.stringify({ step: index, firstName, job, name, uses, wsId } satisfies Saved),
      );
    } catch {
      /* stockage indisponible */
    }
  }, [newSpace, index, firstName, job, name, uses, wsId]);

  // Le titre de l'étape reçoit le focus à chaque changement d'étape
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus();
  }, [index]);

  // Étape Extension : relecture de profiles.extension_seen_at toutes les 2 s, arrêt en quittant l'étape
  useEffect(() => {
    if (step !== 'ext' || extSeen || !user) return;
    const id = window.setInterval(() => {
      void supabase
        .from('profiles')
        .select('extension_seen_at')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.extension_seen_at) setExtSeen(true);
        });
    }, 2000);
    return () => window.clearInterval(id);
  }, [step, extSeen, user]);

  const done = () => {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* stockage indisponible */
    }
    navigate('/', { replace: true });
  };

  async function createWorkspace(wsName: string) {
    const ws = await run(async () => check(await supabase.rpc('create_workspace', { p_name: wsName })));
    if (!ws) return null;
    await reload();
    select(ws.id);
    setWsId(ws.id);
    return ws.id as string;
  }

  async function next(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step === 'profile') {
      void supabase.auth.updateUser({ data: { first_name: firstName.trim(), job: job || null } });
    }
    if (step === 'space' && !wsId) {
      if (!name.trim()) {
        setNameError(t('validation.required'));
        nameInput.current?.focus();
        return;
      }
      if (!(await createWorkspace(name.trim()))) return;
      if (newSpace) return done();
    }
    if (step === 'use') void supabase.auth.updateUser({ data: { use_cases: uses } });
    if (step === 'capture') return done();
    setIndex(index + 1);
  }

  // « Passer » : il faut un espace ; avant sa création, on le crée avec le nom saisi ou un nom par défaut
  async function skip() {
    if (!wsId && workspaces.length === 0 && !wsError) {
      const ok = await createWorkspace(
        name.trim() || t('onboarding.defaultName', { name: firstName.trim() || '' }).trim(),
      );
      if (!ok) return;
    }
    done();
  }

  // Import d'images à la place de l'extension : une démo, une étape par image, puis l'éditeur
  async function importImages(files: File[]) {
    if (!wsId || !user || !files.length) return;
    const id = await run(async () =>
      createDemoFromImages({
        workspaceId: wsId,
        userId: user.id,
        folderId: null,
        title: t('demos.untitled'),
        files,
      }),
    );
    if (!id) return;
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* stockage indisponible */
    }
    toast(t('editor.importWarnMany', { count: files.length }), undefined, { tone: 'warning' });
    navigate(`/demos/${id}/edit?guide=1`, { replace: true });
  }

  const title = (id: string, text: string) => (
    <h1 id={id} ref={heading} tabIndex={-1} className="obx-h1">
      {text}
    </h1>
  );
  const total = steps.length;
  const jobLabel = job ? t(`onboarding.jobs.${job}`) : '';

  let body: ReactNode;
  let preview: ReactNode = null;
  if (step === 'profile') {
    body = (
      <>
        {title('obx-t', t('onboarding.profileTitle', { name: firstName.trim() || '' }).replace(/,\s*$/, ''))}
        <p className="obx-sub">{t('onboarding.profileSub')}</p>
        <div className="obx-fields">
          <label className="fd-field">
            <span className="fd-label">{t('onboarding.firstName')}</span>
            <input
              className="fd-input"
              autoComplete="given-name"
              maxLength={60}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </label>
          <label className="fd-field">
            <span className="fd-label">{t('onboarding.job')}</span>
            <select className="fd-input" value={job} onChange={(e) => setJob(e.target.value)}>
              <option value="">{t('onboarding.jobNone')}</option>
              {JOBS.map((j) => (
                <option key={j} value={j}>
                  {t(`onboarding.jobs.${j}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </>
    );
    preview = (
      <div className="obx-card obx-profile">
        <span className="obx-avatar">{initials(firstName || profile?.full_name || user?.email || '?')}</span>
        <b>{firstName || '…'}</b>
        {jobLabel && <span>{jobLabel}</span>}
      </div>
    );
  } else if (step === 'space') {
    body = (
      <>
        {title('obx-t', t('onboarding.wsTitle'))}
        <p className="obx-sub">{t('onboarding.nameHelp')}</p>
        <div className="obx-fields">
          <label className="fd-field">
            <span className="fd-label">{t('onboarding.name')}</span>
            <input
              ref={nameInput}
              className="fd-input"
              maxLength={80}
              value={name}
              readOnly={!!wsId}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? 'obx-name-err' : undefined}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(null);
              }}
            />
            {nameError && (
              <span className="fd-field__error" id="obx-name-err">
                {nameError}
              </span>
            )}
          </label>
        </div>
      </>
    );
    preview = (
      <div className="obx-card obx-side">
        <BrandMark size={28} />
        <span className="obx-ws">
          <span className="obx-ws__logo">{initials(name || '?')}</span>
          <b>{name || t('onboarding.name')}</b>
        </span>
        {[t('nav.demos'), t('nav.paths'), t('nav.analytics')].map((x) => (
          <span key={x} className="obx-side__item">
            {x}
          </span>
        ))}
      </div>
    );
  } else if (step === 'use') {
    body = (
      <fieldset className="obx-fieldset">
        <legend>{title('obx-t', t('onboarding.useTitle'))}</legend>
        <p className="obx-sub">{t('onboarding.useSub')}</p>
        <div className="obx-uses">
          {USES.map(({ id, icon: Icon }) => (
            <label key={id} className={`obx-use${uses.includes(id) ? ' is-on' : ''}`}>
              <input
                type="checkbox"
                checked={uses.includes(id)}
                onChange={(e) => setUses((u) => (e.target.checked ? [...u, id] : u.filter((x) => x !== id)))}
              />
              <Icon aria-hidden="true" />
              <b>{t(`onboarding.uses.${id}`)}</b>
              <span>{t(`onboarding.uses.${id}Help`)}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
    preview = (
      <div className="obx-tpls">
        {orderedCategories(uses)
          .slice(0, 3)
          .map((c) => (
            <div key={c} className="obx-card obx-tpl">
              {t(`templates.cat.${c}`)}
            </div>
          ))}
      </div>
    );
  } else if (step === 'ext') {
    body = (
      <>
        {title('obx-t', t('onboarding.extTitle'))}
        <p className="obx-sub">{t('onboarding.extSubtitle')}</p>
        {narrow ? (
          <p className="obx-note">{t('onboarding.extDesktop')}</p>
        ) : (
          <ol className="obx-lines">
            <li className={extSeen ? 'is-done' : undefined}>
              <span className="obx-num" aria-hidden="true">
                {extSeen ? <Check /> : 1}
              </span>
              <span className="obx-line">
                {t('onboarding.ext1')}
                {EXTENSION_URL ? (
                  <a className="fd-btn" href={EXTENSION_URL} target="_blank" rel="noopener noreferrer">
                    {t('onboarding.addToChrome')}
                    <ExternalLink aria-hidden="true" />
                  </a>
                ) : (
                  <button
                    type="button"
                    className="fd-btn"
                    onClick={(e) => help?.openArticle('creer-demo-extension', e.currentTarget)}
                  >
                    {t('onboarding.addToChrome')}
                  </button>
                )}
                {extSeen && (
                  <span className="obx-ok" role="status">
                    {t('onboarding.extDetected')}
                  </span>
                )}
              </span>
            </li>
            <li>
              <span className="obx-num" aria-hidden="true">
                2
              </span>
              <span className="obx-line">{t('onboarding.pinHelp')}</span>
            </li>
          </ol>
        )}
        <p className="obx-links">
          <button type="button" className="link-btn" disabled={busy} onClick={() => picker.current?.click()}>
            {t('onboarding.importInstead')}
          </button>
          <button type="button" className="link-btn" onClick={() => setIndex(index + 1)}>
            {t('onboarding.extSkip')}
          </button>
          <input
            ref={picker}
            type="file"
            accept={IMAGE_ACCEPT}
            multiple
            hidden
            aria-label={t('onboarding.importInstead')}
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = '';
              void importImages(files);
            }}
          />
        </p>
        <p className="obx-foot">{t('onboarding.browsersShort')}</p>
      </>
    );
    preview = (
      <div className="obx-card obx-browser">
        <span className="obx-browser__bar">
          <span className="obx-browser__url" />
          <span className="obx-browser__ext">
            <Puzzle />
          </span>
          <span className="obx-browser__pin">
            <Pin />
          </span>
        </span>
        <span className="obx-browser__menu">
          <span>
            <BrandMark size={16} /> TutoClick
          </span>
          <Pin className="obx-browser__pinned" />
        </span>
      </div>
    );
  } else {
    body = (
      <>
        {title('obx-t', t('onboarding.captureTitle'))}
        <p className="obx-sub">{t('onboarding.captureSub')}</p>
        <ol className="obx-lines">
          {[1, 2, 3].map((n) => (
            <li key={n}>
              <span className="obx-num" aria-hidden="true">
                {n}
              </span>
              <span className="obx-line">{t(`onboarding.capture${n}`)}</span>
            </li>
          ))}
        </ol>
        <p className="obx-links">
          {/* Pas encore de démo d'exemple fournie avec un nouvel espace */}
          <span className="fd-link" aria-disabled="true" data-tip={t('soon.badge')}>
            {t('onboarding.seeSample')} · {t('shell.soon')}
          </span>
        </p>
      </>
    );
    preview = (
      <div className="obx-card obx-panel">
        <span className="obx-panel__head">
          <BrandMark size={18} />
        </span>
        <span className="obx-panel__start">{t('onboarding.popStart')}</span>
      </div>
    );
  }

  return (
    <div className="obx">
      <header className="obx-top">
        <BrandMark size={32} />
        {total > 1 && (
          <div
            className="obx-progress"
            role="progressbar"
            aria-label={t('onboarding.progress')}
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={index + 1}
            aria-valuetext={t('onboarding.stepOf', { n: index + 1, total })}
          >
            <span className="obx-progress__bars" aria-hidden="true">
              {steps.map((s, i) => (
                <span key={s} className={i <= index ? 'on' : undefined} />
              ))}
            </span>
            <span className="obx-progress__label">{t('onboarding.stepOf', { n: index + 1, total })}</span>
          </div>
        )}
        <button type="button" className="fd-btn fd-btn--ghost" onClick={() => void skip()} disabled={busy}>
          {t('onboarding.skip')}
        </button>
      </header>
      <div className="obx-cols">
        <main className="obx-main" id="main">
          <form className="obx-form" onSubmit={(e) => void next(e)} noValidate aria-labelledby="obx-t">
            {error && (
              <div className="alert alert-danger" role="alert">
                <CircleAlert aria-hidden="true" />
                {error}
              </div>
            )}
            {body}
            <div className="obx-actions">
              {index > 0 ? (
                <button type="button" className="fd-btn fd-btn--ghost" onClick={() => setIndex(index - 1)}>
                  {t('onboarding.back')}
                </button>
              ) : (
                <span />
              )}
              <button type="submit" className="fd-btn fd-btn--primary fd-btn--lg" disabled={busy}>
                {step === 'capture' || newSpace ? t('onboarding.openSpace') : t('onboarding.continue')}
              </button>
            </div>
          </form>
        </main>
        {!narrow && (
          <aside className="obx-preview" aria-hidden="true">
            {preview}
          </aside>
        )}
      </div>
    </div>
  );
}
