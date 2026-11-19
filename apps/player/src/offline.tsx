/**
 * L16 : lecteur hors ligne des paquets SCORM. Le paquet fournit `window.TUTOCLICK_PACKAGE` (manifeste
 * publié, images à côté) ; aucun appel réseau, sauf si l'option « Envoyer aussi les statistiques à
 * TutoClick » a été cochée à l'export (stats non nul). Le quiz est corrigé localement.
 */
import { render } from 'preact';
import { parseManifest, type EventType, type Manifest } from '@flowdsiml/manifest';
import { Player } from './Player';
import type { TrackerLike } from './api';
import { randomId, resolveAssets } from './logic';
import { scoreQuiz } from './quizScore';
import { sha256Hex } from './sha256';
import { findApi, ScormSession, type ScormVersion } from './scorm';
import '@flowdsiml/player-core/player-core.css';
import './player.css';

export interface PackageConfig {
  manifest: unknown;
  scorm: ScormVersion;
  /** Option de l'export : suivi TutoClick en plus du LMS (désactivé par défaut). */
  stats: { trackUrl: string } | null;
  locale?: 'fr' | 'en';
}

type TrackData = Parameters<TrackerLike['track']>[1];

/** Traceur du paquet : progression vers le LMS, et vers TutoClick seulement si l'option est active. */
class OfflineTracker implements TrackerLike {
  readonly linkToken = null;
  readonly sessionId = randomId();
  private queue: Array<{ type: EventType; at: string } & NonNullable<TrackData>> = [];
  private timer: number | undefined;

  constructor(
    private readonly m: Manifest,
    private readonly lms: ScormSession,
    readonly visitorId: string,
    private readonly stats: PackageConfig['stats'],
  ) {
    addEventListener('pagehide', () => this.flush(true));
  }

  track(type: EventType, data: TrackData = {}) {
    if (type === 'step_view' && typeof data.stepIndex === 'number')
      this.lms.step(data.stepIndex, this.m.steps.length);
    if (type === 'demo_complete') this.lms.complete();
    if (!this.stats) return;
    this.queue.push({ type, ...data, at: new Date().toISOString() });
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.flush(false), 2000);
  }

  private flush(unloading: boolean) {
    if (!this.stats || !this.queue.length) return;
    const body = JSON.stringify({
      demoId: this.m.demoId,
      versionId: this.m.versionId,
      linkToken: null,
      visitorId: this.visitorId,
      sessionId: this.sessionId,
      referrer: null,
      embedOrigin: `scorm:${location.host || 'local'}`.slice(0, 300),
      events: this.queue.splice(0, 50),
    });
    const url = this.stats.trackUrl;
    if (unloading && navigator.sendBeacon?.(url, new Blob([body], { type: 'text/plain' }))) return;
    void fetch(url, {
      method: 'POST',
      body,
      keepalive: true,
      headers: { 'content-type': 'text/plain' },
    }).catch(() => undefined);
  }
}

async function boot() {
  const root = document.getElementById('root')!;
  const cfg = (window as unknown as { TUTOCLICK_PACKAGE?: PackageConfig }).TUTOCLICK_PACKAGE;
  if (!cfg) {
    root.textContent = 'Paquet incomplet.';
    return;
  }
  const manifest = resolveAssets(parseManifest(cfg.manifest), '');
  document.title = manifest.title;
  document.documentElement.lang = cfg.locale ?? manifest.locale;
  const lms = new ScormSession(cfg.scorm, findApi(cfg.scorm));
  const state = lms.init();
  // Apprenant LMS : identifiant haché, calculé seulement si les statistiques sont envoyées (jamais en
  // clair vers TutoClick) ; sinon identifiant aléatoire
  const visitorId =
    cfg.stats && state.learnerId
      ? (await sha256Hex(`${state.learnerId}:${manifest.demoId}`)).slice(0, 40)
      : randomId();
  const tracker = new OfflineTracker(manifest, lms, visitorId, cfg.stats);
  addEventListener('pagehide', () => lms.finish());
  addEventListener('beforeunload', () => lms.finish());
  render(
    <Player
      manifest={manifest}
      values={{}}
      tracker={tracker}
      uiLocale={cfg.locale}
      startStep={state.resumeStep ?? undefined}
      scoreQuiz={async (answers, attemptsUsed) => {
        const res = scoreQuiz(manifest.quiz!, answers, attemptsUsed);
        lms.quiz(res.score, res.passed);
        return res;
      }}
      onLead={async () => undefined}
    />,
    root,
  );
}

void boot();
