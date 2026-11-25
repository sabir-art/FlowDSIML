/**
 * EXT-02 §8 : « Capturer de nouvelles étapes » depuis l'éditeur (extension 0.3.0). La capture vise
 * cette démo et s'insère après l'étape choisie, suivie par son identifiant. L'app ne donne à l'extension
 * que la cible et la page de départ (lib/extensionLink.ts) ; les étapes sont créées par l'extension avec
 * sa propre session, puis placées ici.
 *  - fenêtre (MODAL-01, 560 px) : « Insérer après », type de capture, page de départ, état de
 *    l'extension, « Importer des images à cet endroit » ;
 *  - bandeau pendant la capture (« Revenir à la capture », « Annuler l'ajout ») et repère dans la liste ;
 *  - à l'envoi : insertion, toast avec « Annuler », pastille « Nouveau » jusqu'à la première ouverture.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CircleCheck,
  Code,
  CornerDownRight,
  Image as ImageIcon,
  ImagePlus,
  MousePointerClick,
  Radio,
} from 'lucide-react';
import { Alert, Modal, Select } from '@flowdsiml/ui';
import { useToast } from '../../../components/Toast';
import { hostAllowed, useHtmlCapture } from '../../../lib/htmlCapture';
import {
  ADD_HTML_MIN,
  ADD_STEPS_MIN,
  addStatus,
  addStepsInExtension,
  clearAddCapture,
  focusAddCapture,
  pingExtension,
} from '../../../lib/extensionLink';
import { EXTENSION_URL } from '../../../lib/env';
import type { DemoEditor } from '../useDemoEditor';
import './capture-more.css';

const START = '__start';
type Pending = { afterId: string | null };
const keyOf = (demoId: string) => `tc.addCapture:${demoId}`;

export type CaptureMore = ReturnType<typeof useCaptureMore>;

export function useCaptureMore(editor: DemoEditor, demoId: string, select: (index: number) => void) {
  const { t } = useTranslation();
  const toast = useToast();
  /** Fenêtre ouverte : étape d'insertion préremplie (null : au début). */
  const [dialog, setDialog] = useState<{ afterId: string | null } | null>(null);
  /** Capture en cours dans l'extension pour cette démo (gardée si la page est rechargée). */
  const [pending, setPending] = useState<Pending | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(keyOf(demoId)) ?? 'null') as Pending | null;
    } catch {
      return null;
    }
  });
  /** Étapes ajoutées, « Nouveau » jusqu'à leur première ouverture. */
  const [fresh, setFresh] = useState<string[]>([]);
  const live = useRef(editor);
  live.current = editor;
  const remember = useCallback(
    (p: Pending | null) => {
      setPending(p);
      try {
        if (p) sessionStorage.setItem(keyOf(demoId), JSON.stringify(p));
        else sessionStorage.removeItem(keyOf(demoId));
      } catch {
        /* stockage indisponible : le bandeau ne survit pas à un rechargement */
      }
    },
    [demoId],
  );

  /** « n · Titre » de l'étape d'insertion, lue par son identifiant (elle peut avoir bougé). */
  const afterLabel = useCallback(
    (afterId: string | null) => {
      const i = afterId ? editor.steps.findIndex((s) => s.id === afterId) : -1;
      return i < 0 ? null : { n: i + 1, title: editor.steps[i]!.title || t('editor.untitled') };
    },
    [editor.steps, t],
  );

  // Pendant la capture : l'éditeur lit l'état de l'extension (toutes les 2 s, et au retour sur l'onglet)
  const busy = useRef(false);
  useEffect(() => {
    if (!pending) return;
    let stopped = false;
    const check = async () => {
      if (busy.current || stopped) return;
      busy.current = true;
      try {
        const st = await addStatus(demoId);
        if (stopped || !st) return;
        if (st.state === 'none') return remember(null);
        if (st.state !== 'sent') return;
        const added = (await live.current.adoptSteps(st.stepIds, pending.afterId)) ?? [];
        await clearAddCapture(demoId);
        remember(null);
        if (!added.length) return;
        const ids = added.map((s) => s.id);
        setFresh(ids);
        const at = pending.afterId ? live.current.steps.findIndex((s) => s.id === pending.afterId) : -1;
        select(at + 1);
        const n = at + 1;
        toast(
          n > 0
            ? t('editor.captureMore.added', { count: ids.length, n })
            : t('editor.captureMore.addedStart', { count: ids.length }),
          {
            label: t('common.undo'),
            durationMs: 8000,
            onClick: () => {
              setFresh([]);
              void live.current.dropSteps(ids);
            },
          },
        );
      } finally {
        busy.current = false;
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 2000);
    const onFocus = () => void check();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [pending, demoId, remember, select, t, toast]);

  /** Première ouverture d'une étape ajoutée : elle perd sa pastille « Nouveau ». */
  const seen = useCallback(
    (id: string) => setFresh((l) => (l.includes(id) ? l.filter((x) => x !== id) : l)),
    [],
  );
  return {
    dialog,
    open: (afterId: string | null) => setDialog({ afterId }),
    close: () => setDialog(null),
    pending,
    started: (afterId: string | null) => {
      setDialog(null);
      remember({ afterId });
    },
    cancel: () => {
      void clearAddCapture(demoId);
      remember(null);
    },
    focus: () => void focusAddCapture(demoId),
    afterLabel,
    fresh,
    seen,
  };
}

/** Bandeau sous l'en-tête, pendant la capture dans un autre onglet (§8.3). */
export function CaptureMoreBanner({ capture }: { capture: CaptureMore }) {
  const { t } = useTranslation();
  if (!capture.pending) return null;
  const after = capture.afterLabel(capture.pending.afterId);
  return (
    <div className="cm-banner" role="status">
      <Radio aria-hidden="true" />
      <p>
        <b>{t('editor.captureMore.running')}</b>{' '}
        {after
          ? t('editor.captureMore.willArriveAfter', { n: after.n, title: after.title })
          : t('editor.captureMore.willArriveStart')}
      </p>
      <button type="button" className="fd-btn fd-btn--sm" onClick={capture.focus}>
        {t('editor.captureMore.back')}
      </button>
      <button
        type="button"
        className="fd-btn fd-btn--sm fd-btn--ghost cm-banner__cancel"
        onClick={capture.cancel}
      >
        {t('editor.captureMore.cancel')}
      </button>
    </div>
  );
}

/** Repère pointillé dans la liste des étapes : « Les nouvelles étapes arriveront ici ». */
export function CaptureMoreMarker({ n }: { n: number }) {
  const { t } = useTranslation();
  return (
    <li className="cm-marker" data-gap-exempt="">
      <CornerDownRight aria-hidden="true" />
      <span aria-hidden="true">{t('editor.captureMore.here')}</span>
      <span className="sr-only">
        {n > 0 ? t('editor.captureMore.hereAfter', { n }) : t('editor.captureMore.hereStart')}
      </span>
    </li>
  );
}

type Ext = 'checking' | 'ready' | 'missing';

export function CaptureMoreDialog({
  capture,
  editor,
  workspaceId,
  onImport,
}: {
  capture: CaptureMore;
  editor: DemoEditor;
  workspaceId: string;
  /** « Importer des images à cet endroit » : l'import d'images existant, après la même étape. */
  onImport: (afterId: string | null) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const open = !!capture.dialog;
  const [after, setAfter] = useState<string>(START);
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [ext, setExt] = useState<Ext>('checking');
  const [version, setVersion] = useState<string | null>(null);
  const [mode, setMode] = useState<'clicks' | 'html'>('clicks');
  const [htmlExt, setHtmlExt] = useState(false);
  const rule = useHtmlCapture(workspaceId);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);
  const stepUrl = (stepId: string) => editor.steps.find((s) => s.id === stepId)?.page_url ?? '';

  const check = useCallback(async () => {
    setExt('checking');
    const r = await pingExtension();
    setVersion(r?.version ?? null);
    setHtmlExt(!!r?.html);
    setExt(r?.ready ? 'ready' : 'missing');
  }, []);
  // À l'ouverture : étape d'insertion, page de départ reprise de cette étape, état de l'extension
  const opened = capture.dialog?.afterId;
  useEffect(() => {
    if (opened === undefined) return;
    setAfter(opened ?? START);
    setUrl(opened ? (editor.steps.find((s) => s.id === opened)?.page_url ?? '') : '');
    setUrlError(null);
    setError(null);
    setSending(false);
    setMode('clicks');
    void check();
    // L'ouverture seule relance ces réglages (pas chaque modification de la démo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, check]);

  const afterId = after === START ? null : after;
  const known = afterId ? stepUrl(afterId) : '';
  const afterN = afterId ? editor.steps.findIndex((s) => s.id === afterId) + 1 : 0;
  // HTML : selon l'extension (0.3.1), le réglage de l'espace (L49) et le domaine de la page de départ
  let host = '';
  try {
    const u = new URL(url.trim());
    if (u.protocol === 'https:' || u.protocol === 'http:') host = u.hostname;
  } catch {
    host = '';
  }
  const htmlWhy =
    rule.mode === 'disabled'
      ? t('editor.captureMore.htmlOff')
      : rule.mode === 'domains' && host && !hostAllowed(host, rule.domains)
        ? t('editor.captureMore.htmlDomain', { domain: host })
        : ext === 'ready' && !htmlExt
          ? t('editor.captureMore.htmlVersion', { version: ADD_HTML_MIN })
          : null;
  const picked = mode === 'html' && !htmlWhy ? 'html' : 'clicks';
  const submit = async () => {
    if (ext !== 'ready' || sending) return;
    let target: URL | null = null;
    try {
      target = new URL(url.trim());
    } catch {
      target = null;
    }
    if (!target || (target.protocol !== 'https:' && target.protocol !== 'http:')) {
      setUrlError(url.trim() ? t('editor.captureMore.urlInvalid') : t('editor.captureMore.urlRequired'));
      urlRef.current?.focus();
      return;
    }
    setUrlError(null);
    setError(null);
    setSending(true);
    const r = await addStepsInExtension({
      demoId: editor.demo!.id,
      workspaceId,
      afterStepId: afterId,
      url: target.href,
      mode: picked,
    });
    setSending(false);
    if (r.ok) return capture.started(afterId);
    setError(
      r.error === 'busy'
        ? t('editor.captureMore.errBusy')
        : r.error === 'signed-out'
          ? t('editor.captureMore.errSignedOut')
          : r.error === 'demo'
            ? t('editor.captureMore.errDemo')
            : t('editor.captureMore.errUnavailable'),
    );
    if (r.error === 'unavailable') void check();
  };

  return (
    <Modal
      open={open}
      onClose={capture.close}
      size="md"
      icon={<MousePointerClick />}
      title={t('editor.captureMore.title')}
      subtitle={t('editor.captureMore.lead')}
      closeLabel={t('common.close')}
      className="cm-dialog"
      footer={
        <>
          <button type="button" className="fd-btn" onClick={capture.close}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="fd-btn fd-btn--primary"
            aria-disabled={ext !== 'ready' || sending || undefined}
            aria-describedby={ext === 'missing' ? `${id}-ext` : undefined}
            onClick={() => void submit()}
          >
            <MousePointerClick aria-hidden="true" />
            {t('editor.captureMore.start')}
          </button>
        </>
      }
    >
      {error && <Alert kind="error">{error}</Alert>}
      <div className="cm-field">
        <label className="cm-label" id={`${id}-after-l`} htmlFor={`${id}-after`}>
          {t('editor.captureMore.after')}
        </label>
        <Select
          id={`${id}-after`}
          aria-labelledby={`${id}-after-l`}
          value={after}
          onChange={(e) => {
            const v = e.target.value;
            setAfter(v);
            // La page de départ suit l'étape choisie tant qu'elle n'a pas été modifiée à la main
            if (!url || url === known) setUrl(v === START ? '' : stepUrl(v));
          }}
          options={[
            { value: START, label: t('editor.captureMore.atStart') },
            ...editor.steps.map((s, i) => ({
              value: s.id,
              label: `${i + 1} · ${s.title || t('editor.untitled')}`,
            })),
          ]}
        />
      </div>
      <div className="cm-field">
        <span className="cm-label" id={`${id}-type-l`}>
          {t('editor.captureMore.type')}
        </span>
        <div
          className="fd-segmented cm-seg"
          role="radiogroup"
          aria-labelledby={`${id}-type-l`}
          aria-describedby={`${id}-type-h`}
        >
          <button
            type="button"
            role="radio"
            aria-checked={picked === 'clicks'}
            tabIndex={picked === 'clicks' ? 0 : -1}
            onClick={() => setMode('clicks')}
            onKeyDown={(e) => {
              if ((e.key === 'ArrowRight' || e.key === 'ArrowDown') && !htmlWhy) {
                e.preventDefault();
                setMode('html');
                (e.currentTarget.nextElementSibling as HTMLElement | null)?.focus();
              }
            }}
          >
            <ImageIcon aria-hidden="true" />
            {t('editor.captureMore.typeShots')}
          </button>
          {/* HTML : désactivé avec sa raison si l'espace, le domaine ou la version de l'extension l'empêche */}
          <button
            type="button"
            role="radio"
            aria-checked={picked === 'html'}
            aria-disabled={htmlWhy ? true : undefined}
            aria-describedby={htmlWhy ? `${id}-html-why` : undefined}
            tabIndex={picked === 'html' ? 0 : -1}
            onClick={() => !htmlWhy && setMode('html')}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                setMode('clicks');
                (e.currentTarget.previousElementSibling as HTMLElement | null)?.focus();
              }
            }}
          >
            <Code aria-hidden="true" />
            {t('editor.captureMore.typeHtml')}
          </button>
        </div>
        {htmlWhy && (
          <p className="cm-help cm-help--why" id={`${id}-html-why`}>
            {htmlWhy}
          </p>
        )}
        <p className="cm-help" id={`${id}-type-h`}>
          {t('editor.captureMore.typeHelp')}
        </p>
      </div>
      <div className="cm-field">
        <label className="cm-label" htmlFor={`${id}-url`}>
          {t('editor.captureMore.url')}
        </label>
        <input
          ref={urlRef}
          id={`${id}-url`}
          className="fd-input"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          required
          placeholder="https://"
          value={url}
          aria-invalid={urlError ? true : undefined}
          aria-describedby={`${urlError ? `${id}-url-e ` : ''}${id}-url-h`}
          onChange={(e) => {
            setUrl(e.target.value);
            setUrlError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
        />
        {urlError && (
          <p className="fd-error" id={`${id}-url-e`}>
            {urlError}
          </p>
        )}
        <p className="cm-help" id={`${id}-url-h`}>
          {known && url === known ? `${t('editor.captureMore.urlFrom', { n: afterN })} ` : ''}
          {t('editor.captureMore.urlHelp')}
        </p>
      </div>
      {ext === 'ready' && (
        <p className="cm-ext cm-ext--ok" role="status">
          <CircleCheck aria-hidden="true" />
          {t('editor.captureMore.extOk', { version: version ?? ADD_STEPS_MIN })}
        </p>
      )}
      {ext === 'missing' && (
        <div className="cm-ext cm-ext--missing" id={`${id}-ext`} role="status">
          <p>
            <b>{t('editor.captureMore.extNeeded', { version: ADD_STEPS_MIN })}</b>
            <span>
              {version ? t('editor.captureMore.extOld', { version }) : t('editor.captureMore.extAbsent')}
            </span>
          </p>
          <div className="cm-ext__acts">
            {EXTENSION_URL ? (
              <a className="fd-btn fd-btn--sm" href={EXTENSION_URL} target="_blank" rel="noopener noreferrer">
                {t('editor.captureMore.extInstall')}
                <span className="sr-only">{t('extension.newTab')}</span>
              </a>
            ) : (
              <a className="fd-btn fd-btn--sm" href="#/extension">
                {t('editor.captureMore.extInstall')}
              </a>
            )}
            <button type="button" className="fd-btn fd-btn--sm fd-btn--ghost" onClick={() => void check()}>
              {t('editor.captureMore.extRetry')}
            </button>
          </div>
        </div>
      )}
      <p className="cm-or" aria-hidden="true">
        <span>{t('editor.captureMore.or')}</span>
      </p>
      <button
        type="button"
        className="fd-btn cm-import"
        onClick={() => {
          capture.close();
          onImport(afterId);
        }}
      >
        <ImagePlus aria-hidden="true" />
        {t('editor.captureMore.import')}
      </button>
    </Modal>
  );
}
