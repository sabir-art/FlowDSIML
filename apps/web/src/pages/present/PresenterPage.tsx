/**
 * L22-03 : vue présentateur. Scène identique à l'écran public, minuteur, commandes, notes privées,
 * étape suivante et raccourcis (→ ← N B T Échap). Une présentation n'est pas comptée comme une vue.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, EyeOff, Eye } from 'lucide-react';
import { useDemoEditor } from '../editor/useDemoEditor';
import { buildDraftManifest } from '../editor/draftManifest';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { useToast } from '../../components/Toast';
import { Loading } from '../../components/guards';
import { PlayerFrame } from './PlayerFrame';
import { channelName, clock, fromSearch, noteLines, screenUrl, spoken, type PresentMessage } from './present';
import './present.css';

export function PresenterPage() {
  const { demoId = '' } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const toast = useToast();
  const { current: ws } = useWorkspace();
  const editor = useDemoEditor(demoId);
  const total = editor.steps.length;
  const opts = useMemo(() => fromSearch(search, Math.max(1, total)), [search, total]);
  const [index, setIndex] = useState(0);
  const [black, setBlack] = useState(false);
  const [notesOn, setNotesOn] = useState(true);
  const [started, setStarted] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [screenAlive, setScreenAlive] = useState(0);
  const channel = useRef<BroadcastChannel | null>(null);
  const initialised = useRef(false);

  const manifest = useMemo(
    () => (editor.demo && total ? buildDraftManifest(editor, ws?.name ?? '') : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor.demo, editor.steps, editor.hotspots, editor.imageUrls, total],
  );
  useEffect(() => {
    if (!initialised.current && total) {
      initialised.current = true;
      setIndex(opts.start);
    }
  }, [total, opts.start]);

  const state = { index, black, hideHotspots: opts.hideHotspots };
  const title = editor.demo?.title ?? '';

  // Diffusion vers l'écran public ; il se signale toutes les secondes (« alive »)
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(channelName(demoId));
    channel.current = ch;
    ch.onmessage = (e: MessageEvent<PresentMessage>) => {
      if (e.data?.type === 'alive' || e.data?.type === 'hello') setScreenAlive(Date.now());
      if (e.data?.type === 'hello') sendState(true);
    };
    // « end » seulement quand la présentation se termine vraiment (Terminer, onglet fermé),
    // jamais au démontage d'un effet (StrictMode le rejoue en développement).
    const end = () => ch.postMessage({ type: 'end' } satisfies PresentMessage);
    addEventListener('pagehide', end);
    return () => {
      removeEventListener('pagehide', end);
      ch.close();
      channel.current = null;
    };
  }, [demoId]);
  const sendState = (withManifest: boolean) =>
    channel.current?.postMessage({
      type: 'state',
      ...(withManifest && manifestRef.current ? { manifest: manifestRef.current } : {}),
      ...stateRef.current,
    } satisfies PresentMessage);
  const manifestRef = useRef(manifest);
  manifestRef.current = manifest;
  // Lu par le gestionnaire du canal (créé une fois) : toujours la dernière valeur, jamais celle du 1er rendu
  const stateRef = useRef({ ...state, title, total });
  stateRef.current = { ...state, title, total };
  useEffect(() => {
    sendState(true);
  }, [manifest]);
  useEffect(() => {
    sendState(false);
  }, [index, black, title, total]);

  // Minuteur (une mise à jour par seconde, jamais annoncée automatiquement)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = Math.floor((now - started) / 1000);
  const target = opts.minutes * 60;
  const over = opts.timer && elapsed > target;
  const ratio = opts.timer ? Math.min(1, elapsed / target) : 0;
  const screenOpen = opts.mode === 'two' && now - screenAlive < 3000;

  const go = (i: number) => setIndex(Math.max(0, Math.min(total - 1, i)));
  const finish = () => {
    channel.current?.postMessage({ type: 'end' } satisfies PresentMessage);
    toast(t('present.ended', { time: spoken(elapsed) }));
    navigate(`/demos/${demoId}/edit`);
  };
  const keys = useRef({ go, finish, index });
  keys.current = { go, finish, index };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const k = keys.current;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') k.go(k.index + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') k.go(k.index - 1);
      else if (e.key === 'n' || e.key === 'N') setNotesOn((v) => !v);
      else if (e.key === 'b' || e.key === 'B') setBlack((v) => !v);
      else if (e.key === 't' || e.key === 'T') setStarted(Date.now());
      else if (e.key === 'Escape') k.finish();
      else return;
      e.preventDefault();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);
  // Un seul écran : plein écran au lancement (si le navigateur l'accepte)
  useEffect(() => {
    if (opts.mode === 'one') document.documentElement.requestFullscreen?.().catch(() => undefined);
  }, [opts.mode]);

  if (editor.loading) return <Loading />;
  const step = editor.steps[index];
  const nextStep = editor.steps[index + 1];
  const notes = noteLines(step?.presenter_notes);
  const nextImg = nextStep?.image_path ? editor.imageUrls[nextStep.image_path] : null;
  const timeLabel = opts.timer
    ? t('present.timerLabel', { elapsed: spoken(elapsed), target: spoken(target) })
    : t('present.timerLabelFree', { elapsed: spoken(elapsed) });

  return (
    <main className={`presenter${opts.mode === 'one' && !notesOn ? ' presenter--solo' : ''}`} id="main">
      <h1 className="sr-only">{t('present.pageTitle', { title })}</h1>
      <div className="main-s">
        <div className="pr-head">
          {opts.mode === 'two' &&
            (screenOpen ? (
              <span className="live">
                <i aria-hidden="true" />
                {t('present.screenOpen')}
              </span>
            ) : (
              <span className="live live--off">
                <i aria-hidden="true" />
                {t('present.screenClosed')}
                <button
                  type="button"
                  className="pr-reopen"
                  onClick={() =>
                    window.open(screenUrl(demoId), `fd-present-${demoId}`, 'popup,width=1280,height=800')
                  }
                >
                  {t('present.reopen')}
                </button>
              </span>
            ))}
          <span className="pr-title">{title}</span>
        </div>
        <div className="stage pr-stage">
          <PlayerFrame
            manifest={manifest}
            state={state}
            title={t('present.stageTitle')}
            className="pr-frame"
          />
        </div>
        {opts.timer && (
          <div className={`tbar${over || ratio > 0.8 ? ' is-late' : ''}`} aria-hidden="true">
            <span>
              <i style={{ width: `${Math.round(ratio * 100)}%` }} />
            </span>
          </div>
        )}
        <div className="bar" role="toolbar" aria-label={t('present.controls')}>
          <span className={`t${over ? ' over' : ''}`} role="timer" aria-label={timeLabel}>
            {clock(over ? elapsed - target : elapsed)}
            {opts.timer && (over ? <small>{t('present.over')}</small> : <small>/ {clock(target)}</small>)}
          </span>
          <span className="pr-count">{t('present.stepOf', { n: index + 1, total })}</span>
          <span className="pr-actions">
            <button
              type="button"
              aria-keyshortcuts="ArrowLeft"
              disabled={index === 0}
              onClick={() => go(index - 1)}
            >
              <ArrowLeft aria-hidden="true" />
              {t('present.prev')}
            </button>
            <button
              type="button"
              className="pri"
              aria-keyshortcuts="ArrowRight"
              disabled={index >= total - 1}
              onClick={() => go(index + 1)}
            >
              {t('present.next')}
              <ArrowRight aria-hidden="true" />
            </button>
            <button type="button" aria-keyshortcuts="B" aria-pressed={black} onClick={() => setBlack(!black)}>
              <EyeOff aria-hidden="true" />
              {t('present.black')}
            </button>
            <button type="button" aria-keyshortcuts="Escape" onClick={finish}>
              {t('present.finish')}
            </button>
          </span>
        </div>
      </div>
      {(opts.mode === 'two' || notesOn) && (
        <aside aria-label={t('present.panel')}>
          <section className="pcard" aria-labelledby="pn-t">
            <h2 id="pn-t">
              {t('present.notes', { n: index + 1 })}
              <button
                type="button"
                className="pr-ghost"
                aria-keyshortcuts="N"
                onClick={() => setNotesOn(!notesOn)}
              >
                {notesOn ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                {t(notesOn ? 'present.hideNotes' : 'present.showNotes')}
              </button>
            </h2>
            {notesOn &&
              (notes.length ? (
                <ul className="notes">
                  {notes.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              ) : (
                <p className="pr-muted">{t('present.noNotes')}</p>
              ))}
          </section>
          <section className="pcard" aria-labelledby="nx-t">
            <h2 id="nx-t">{nextStep ? t('present.nextStep', { n: index + 2 }) : t('present.lastStep')}</h2>
            {nextStep && (
              <>
                <div className="next" aria-hidden="true">
                  {nextImg ? (
                    <img src={nextImg} alt="" />
                  ) : (
                    <span className="next-text">{nextStep.title}</span>
                  )}
                </div>
                <p className="pr-next-title">{nextStep.title || t('editor.untitled')}</p>
              </>
            )}
          </section>
          <section className="pcard" aria-labelledby="kb-t">
            <h2 id="kb-t">{t('present.shortcuts')}</h2>
            <div className="kbd">
              <kbd>→</kbd>
              <span>{t('present.next')}</span>
              <kbd>←</kbd>
              <span>{t('present.prev')}</span>
              <kbd>N</kbd>
              <span>{t('present.hideNotes')}</span>
              <kbd>B</kbd>
              <span>{t('present.black')}</span>
              <kbd>T</kbd>
              <span>{t('present.resetTimer')}</span>
              <kbd>{t('present.esc')}</kbd>
              <span>{t('present.finish')}</span>
            </div>
          </section>
        </aside>
      )}
    </main>
  );
}
