/**
 * L22-03 : vue présentateur. Scène identique à l'écran public, minuteur, commandes, notes privées,
 * étape suivante et raccourcis (→ ← N B T Échap). Une présentation n'est pas comptée comme une vue.
 * L26-09 : notes de la démo (onglets Étape / Démo) et modification en direct ; L26-10 / 11 :
 * télécommande sur téléphone (touche R) ; L26-12 : bilan de fin (30 jours, pour la seule présentatrice).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Check, EyeOff, Eye, Pencil, Smartphone } from 'lucide-react';
import { useDemoEditor } from '../editor/useDemoEditor';
import { buildDraftManifest } from '../editor/draftManifest';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { Loading } from '../../components/guards';
import { supabase } from '../../lib/supabase';
import { PlayerFrame } from './PlayerFrame';
import {
  channelName,
  clock,
  fromSearch,
  noteLines,
  reportRows,
  screenUrl,
  spoken,
  type PresentMessage,
  type ReportRow,
} from './present';
import { openRemote, remoteUrl, type RemoteLink, type RemoteMessage } from './remote';
import { RemoteDialog, ReportDialog } from './RemoteDialogs';
import './present.css';

interface RemoteState {
  id: string;
  code: string | null;
  channel: string;
  paired: boolean;
  codeExpiresAt: number;
}

export function PresenterPage() {
  const { demoId = '' } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
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
  // L26-09 : onglet des notes (étape ou démo) et modification en direct
  const [notesTab, setNotesTab] = useState<'step' | 'demo'>('step');
  const [editing, setEditing] = useState(false);
  const [editedOnce, setEditedOnce] = useState(false);
  const changedSteps = useRef(new Set<string>());
  // L26-12 : temps passé par étape (secondes), compté au changement d'étape
  const spent = useRef<number[]>([]);
  const lastSwitch = useRef({ index: 0, at: Date.now() });
  const sessionStart = useRef(Date.now());
  const [report, setReport] = useState<{ seconds: number; rows: ReportRow[]; notes: number } | null>(null);
  // L26-10 : télécommande
  const [remote, setRemote] = useState<RemoteState | null>(null);
  const [remoteOpen, setRemoteOpen] = useState(false);
  const [remoteError, setRemoteError] = useState(false);
  const link = useRef<RemoteLink | null>(null);

  const manifest = useMemo(
    () => (editor.demo && total ? buildDraftManifest(editor, ws?.name ?? '') : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor.demo, editor.steps, editor.hotspots, editor.imageUrls, total],
  );
  useEffect(() => {
    if (!initialised.current && total) {
      initialised.current = true;
      setIndex(opts.start);
      lastSwitch.current = { index: opts.start, at: Date.now() };
      spent.current = Array.from({ length: total }, () => 0);
      if (opts.remote) void startRemote();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, opts.start]);

  // Temps par étape : la durée passée sur l'étape quittée est ajoutée à son compteur
  useEffect(() => {
    const prev = lastSwitch.current;
    if (prev.index === index) return;
    spent.current[prev.index] = (spent.current[prev.index] ?? 0) + (Date.now() - prev.at) / 1000;
    lastSwitch.current = { index, at: Date.now() };
  }, [index]);
  // L26-09 : l'onglet « Démo » s'ouvre de lui-même à l'étape 1 et sur l'écran de fin
  useEffect(() => {
    if (!total) return;
    setNotesTab(index === 0 || index === total - 1 ? 'demo' : 'step');
    setEditing(false);
  }, [index, total]);

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
    sendRemoteState();
  }, [index, black, title, total, started]);

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

  // ===== L26-10 : télécommande =====
  const remoteStateRef = useRef({ index, black, total, started, minutes: opts.timer ? opts.minutes : null });
  remoteStateRef.current = { index, black, total, started, minutes: opts.timer ? opts.minutes : null };
  const sendRemoteState = () => {
    const s = remoteStateRef.current;
    link.current?.send({
      type: 'state',
      index: s.index,
      total: s.total,
      black: s.black,
      startedAt: s.started,
      minutes: s.minutes,
    });
  };
  const remoteKey = `fd.remote.${demoId}`;
  const startRemote = useCallback(async () => {
    setRemoteOpen(true);
    setRemoteError(false);
    // Télécommande déjà ouverte pour cette présentation (vue rechargée ou remontée) : on la reprend
    let known: string | null = null;
    let saved: { code: string; exp: number } | null = null;
    try {
      const raw = JSON.parse(sessionStorage.getItem(remoteKey) ?? 'null') as {
        id: string;
        code: string;
        exp: number;
      } | null;
      known = raw?.id ?? null;
      saved = raw && raw.exp > Date.now() ? { code: raw.code, exp: raw.exp } : null;
    } catch {
      known = null;
    }
    if (known) {
      const { data: st } = await supabase.rpc('present_remote_status', { p_id: known });
      const s0 = st as { paired: boolean; channel: string; active: boolean } | null;
      if (s0?.active) {
        if (s0.paired) {
          setRemote({ id: known, code: null, channel: s0.channel, paired: true, codeExpiresAt: 0 });
          return;
        }
        if (saved) {
          setRemote({
            id: known,
            code: saved.code,
            channel: s0.channel,
            paired: false,
            codeExpiresAt: saved.exp,
          });
          return;
        }
        const { data: nc } = await supabase.rpc('present_remote_new_code', { p_id: known });
        const c = nc as { code: string; codeExpiresAt: string } | null;
        if (c) {
          setRemote({
            id: known,
            code: c.code,
            channel: s0.channel,
            paired: false,
            codeExpiresAt: Date.parse(c.codeExpiresAt),
          });
          return;
        }
      }
    }
    const { data, error } = await supabase.rpc('present_remote_start', { p_demo: demoId });
    const r = data as { id: string; code: string; channel: string; codeExpiresAt: string } | null;
    if (error || !r) return setRemoteError(true);
    try {
      sessionStorage.setItem(
        remoteKey,
        JSON.stringify({ id: r.id, code: r.code, exp: Date.parse(r.codeExpiresAt) }),
      );
    } catch {
      /* stockage indisponible */
    }
    setRemote({
      id: r.id,
      code: r.code,
      channel: r.channel,
      paired: false,
      codeExpiresAt: Date.parse(r.codeExpiresAt),
    });
  }, [demoId, remoteKey]);
  const newCode = async () => {
    if (!remote) return;
    const { data } = await supabase.rpc('present_remote_new_code', { p_id: remote.id });
    const r = data as { code: string; codeExpiresAt: string } | null;
    if (!r) return;
    setRemote({ ...remote, code: r.code, codeExpiresAt: Date.parse(r.codeExpiresAt) });
    try {
      sessionStorage.setItem(
        remoteKey,
        JSON.stringify({ id: remote.id, code: r.code, exp: Date.parse(r.codeExpiresAt) }),
      );
    } catch {
      /* stockage indisponible */
    }
  };
  // Statut (appairé, clé de canal courante) : toutes les 1,5 s tant que la présentation dure
  const remoteId = remote?.id;
  useEffect(() => {
    if (!remoteId) return;
    let off = false;
    const tick = () =>
      void supabase.rpc('present_remote_status', { p_id: remoteId }).then(({ data }) => {
        const s = data as { paired: boolean; channel: string; active: boolean; failures: number } | null;
        if (off || !s) return;
        setRemote((r) =>
          r && (r.paired !== s.paired || r.channel !== s.channel || (s.failures >= 5 && r.code))
            ? { ...r, paired: s.paired, channel: s.channel, code: s.failures >= 5 ? null : r.code }
            : r,
        );
      });
    tick();
    const id = window.setInterval(tick, 1500);
    return () => {
      off = true;
      clearInterval(id);
    };
  }, [remoteId]);
  // Canal de la télécommande : commandes du téléphone, état renvoyé
  const remoteChannel = remote?.channel;
  const handlers = useRef<(m: RemoteMessage) => void>(() => undefined);
  handlers.current = (m) => {
    if (m.type !== 'cmd') return;
    if (m.cmd === 'next') go(index + 1);
    else if (m.cmd === 'prev') go(index - 1);
    else if (m.cmd === 'black') setBlack((v) => !v);
    else if (m.cmd === 'end') finish();
    sendRemoteState();
  };
  useEffect(() => {
    if (!remoteChannel) return;
    const l = openRemote(remoteChannel, (m) => handlers.current(m));
    link.current = l;
    sendRemoteState();
    return () => {
      l.close();
      if (link.current === l) link.current = null;
    };
  }, [remoteChannel]);
  // Le téléphone appairé ferme la modale d'appairage
  useEffect(() => {
    if (remote?.paired) {
      sendRemoteState();
      const id = window.setTimeout(() => setRemoteOpen(false), 1200);
      return () => clearTimeout(id);
    }
  }, [remote?.paired]);

  const go = (i: number) => setIndex(Math.max(0, Math.min(total - 1, i)));
  const finish = () => {
    if (report) return;
    channel.current?.postMessage({ type: 'end' } satisfies PresentMessage);
    link.current?.send({ type: 'end' });
    // Requêtes Supabase paresseuses : .then() les déclenche
    if (remote) void supabase.rpc('present_remote_end', { p_id: remote.id }).then(() => undefined);
    try {
      sessionStorage.removeItem(remoteKey);
    } catch {
      /* rien */
    }
    // Dernière étape : son temps est compté jusqu'à maintenant
    const last = lastSwitch.current;
    spent.current[last.index] = (spent.current[last.index] ?? 0) + (Date.now() - last.at) / 1000;
    lastSwitch.current = { index: last.index, at: Date.now() };
    const secs = spent.current.map((s) => Math.round(s));
    const titles = editor.steps.map((s) => s.title);
    const duration = Math.round((Date.now() - sessionStart.current) / 1000);
    const notes = changedSteps.current.size;
    setReport({ seconds: duration, rows: reportRows(secs, titles), notes });
    setEditing(false);
    // L26-12 : bilan gardé 30 jours pour la seule personne qui a présenté (rien dans Analytics)
    if (editor.demo)
      void supabase
        .from('present_reports')
        .insert({
          workspace_id: editor.demo.workspace_id,
          demo_id: demoId,
          started_at: new Date(sessionStart.current).toISOString(),
          duration_s: Math.min(86400, duration),
          target_min: opts.timer ? opts.minutes : null,
          steps: secs.map((s, i) => ({ index: i, title: (titles[i] ?? '').slice(0, 200), seconds: s })),
          notes_changed: Math.min(500, notes),
        })
        .then(() => undefined);
  };
  const keys = useRef({ go, finish, index, startRemote, editing });
  keys.current = { go, finish, index, startRemote, editing };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const k = keys.current;
      // L26-09 : pendant la saisie des notes, flèches et raccourcis désactivés ; Échap quitte la modification
      const typing = (e.target as HTMLElement | null)?.closest?.(
        'textarea, input, select, [contenteditable]',
      );
      if (k.editing || typing) {
        if (e.key === 'Escape' && k.editing) {
          setEditing(false);
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      if (document.querySelector('dialog[open]')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') k.go(k.index + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') k.go(k.index - 1);
      else if (e.key === 'n' || e.key === 'N') setNotesOn((v) => !v);
      else if (e.key === 'b' || e.key === 'B') setBlack((v) => !v);
      else if (e.key === 't' || e.key === 'T') setStarted(Date.now());
      else if (e.key === 'r' || e.key === 'R') void k.startRemote();
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
  // Notes modifiées : renvoyées au téléphone (il les affiche sans recharger)
  const pushNotes = useRef<number | undefined>(undefined);
  const editNotes = (value: string) => {
    setEditedOnce(true);
    const step = editor.steps[index];
    if (notesTab === 'demo') editor.updateDemo({ presenter_notes: value.slice(0, 2000) });
    else if (step) {
      editor.updateStep(step.id, { presenter_notes: value.slice(0, 1000) });
      changedSteps.current.add(step.id);
    }
    window.clearTimeout(pushNotes.current);
    pushNotes.current = window.setTimeout(
      () => link.current?.send({ type: 'notes', index: notesTab === 'demo' ? -1 : index, text: value }),
      500,
    );
  };

  if (editor.loading) return <Loading />;
  const step = editor.steps[index];
  const nextStep = editor.steps[index + 1];
  const rawNotes = notesTab === 'demo' ? (editor.demo?.presenter_notes ?? '') : (step?.presenter_notes ?? '');
  const notes = noteLines(rawNotes);
  const nextImg = nextStep?.image_path ? editor.imageUrls[nextStep.image_path] : null;
  const timeLabel = opts.timer
    ? t('present.timerLabel', { elapsed: spoken(elapsed), target: spoken(target) })
    : t('present.timerLabelFree', { elapsed: spoken(elapsed) });
  const saving = editor.saveState === 'saving';

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
          {remote?.paired && (
            <span className="live live--phone">
              <Smartphone aria-hidden="true" />
              {t('present.phoneOn')}
            </span>
          )}
          <span className="pr-title">{title}</span>
          <button
            type="button"
            className="pr-ghost pr-phone-btn"
            aria-keyshortcuts="R"
            onClick={() => (remote ? setRemoteOpen(true) : void startRemote())}
          >
            <Smartphone aria-hidden="true" />
            {t('present.phone')}
          </button>
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
              <span className="sr-only">
                {notesTab === 'demo' ? t('present.notesDemo') : t('present.notes', { n: index + 1 })}
              </span>
              <span className="pr-tabs" role="tablist" aria-label={t('present.notesTabs')}>
                {(['step', 'demo'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={notesTab === k}
                    tabIndex={notesTab === k ? 0 : -1}
                    onClick={() => {
                      setNotesTab(k);
                      setEditing(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                        e.stopPropagation();
                        e.preventDefault();
                        setNotesTab(k === 'step' ? 'demo' : 'step');
                      }
                    }}
                  >
                    {k === 'step' ? t('present.tabStep', { n: index + 1 }) : t('present.tabDemo')}
                  </button>
                ))}
              </span>
              {notesOn && (
                <button
                  type="button"
                  className="pr-ghost"
                  aria-pressed={editing}
                  onClick={() => setEditing(!editing)}
                >
                  {editing ? <Check aria-hidden="true" /> : <Pencil aria-hidden="true" />}
                  {editing ? t('present.editDone') : t('present.edit')}
                </button>
              )}
              <button
                type="button"
                className="pr-ghost"
                aria-label={t(notesOn ? 'present.hideNotes' : 'present.showNotes')}
                aria-keyshortcuts="N"
                onClick={() => setNotesOn(!notesOn)}
              >
                {notesOn ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                {t(notesOn ? 'present.hideShort' : 'present.showShort')}
              </button>
            </h2>
            {notesOn &&
              (editing ? (
                <>
                  <label className="sr-only" htmlFor="pr-notes-edit">
                    {t('present.notesField')}
                  </label>
                  <textarea
                    id="pr-notes-edit"
                    className="pr-notes-edit"
                    autoFocus
                    rows={6}
                    maxLength={notesTab === 'demo' ? 2000 : 1000}
                    value={rawNotes}
                    onChange={(e) => editNotes(e.target.value)}
                  />
                </>
              ) : notes.length ? (
                <ul className="notes">
                  {notes.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              ) : (
                <p className="pr-muted">
                  {notesTab === 'demo' ? t('present.noDemoNotes') : t('present.noNotes')}
                </p>
              ))}
            {editedOnce && (
              <p className="pr-saved" role="status">
                {saving ? t('present.notesSaving') : t('present.notesSaved')}
              </p>
            )}
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
              <span>{t('present.kbNext')}</span>
              <kbd>←</kbd>
              <span>{t('present.kbPrev')}</span>
              <kbd>N</kbd>
              <span>{t('present.hideNotes')}</span>
              <kbd>B</kbd>
              <span>{t('present.black')}</span>
              <kbd>T</kbd>
              <span>{t('present.resetTimer')}</span>
              <kbd>R</kbd>
              <span>{t('present.kbPhone')}</span>
              <kbd>{t('present.esc')}</kbd>
              <span>{t('present.finish')}</span>
            </div>
          </section>
        </aside>
      )}
      {remoteOpen && (
        <RemoteDialog
          url={remote?.code ? remoteUrl(remote.id, remote.code) : null}
          code={remote?.code ?? null}
          paired={!!remote?.paired}
          expired={!!remote && !remote.paired && (!remote.code || remote.codeExpiresAt <= now)}
          error={remoteError}
          onNewCode={() => void newCode()}
          onClose={() => setRemoteOpen(false)}
        />
      )}
      {report && (
        <ReportDialog
          seconds={report.seconds}
          targetMin={opts.timer ? opts.minutes : null}
          rows={report.rows}
          notesChanged={report.notes}
          onClose={() => navigate('/')}
          onEditor={() => navigate(`/demos/${demoId}/edit`)}
        />
      )}
    </main>
  );
}
