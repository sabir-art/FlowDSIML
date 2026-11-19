/**
 * L16 : adaptateur SCORM 1.2 et 2004 (4e édition) du lecteur hors ligne.
 * - Statut : « completed » quand la dernière étape est vue ; « passed » ou « failed » selon le quiz
 *   (1.2 : cmi.core.lesson_status ; 2004 : cmi.completion_status + cmi.success_status). Une réussite
 *   n'est jamais rétrogradée et le score envoyé est le meilleur de la session.
 * - Reprise : étape courante dans cmi.core.lesson_location / cmi.location et cmi.suspend_data.
 * - Temps passé : cmi.core.session_time (HHHH:MM:SS.SS) ou cmi.session_time (durée ISO 8601).
 * Sans LMS (paquet ouvert hors d'une plateforme), l'adaptateur ne fait rien.
 */
export type ScormVersion = '1.2' | '2004';

interface Api12 {
  LMSInitialize(a: ''): string;
  LMSGetValue(k: string): string;
  LMSSetValue(k: string, v: string): string;
  LMSCommit(a: ''): string;
  LMSFinish(a: ''): string;
}
interface Api2004 {
  Initialize(a: ''): string;
  GetValue(k: string): string;
  SetValue(k: string, v: string): string;
  Commit(a: ''): string;
  Terminate(a: ''): string;
}

/** Durée SCORM 1.2 : HHHH:MM:SS.SS (heures sur 2 à 4 chiffres). */
export function time12(ms: number): string {
  const cs = Math.max(0, Math.round(ms / 10));
  const h = Math.min(9999, Math.floor(cs / 360000));
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(h)}:${p(m)}:${p(s)}.${p(c)}`;
}

/** Durée SCORM 2004 : ISO 8601 (PT#H#M#S, centièmes de seconde au plus). */
export function time2004(ms: number): string {
  const cs = Math.max(0, Math.round(ms / 10));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = (cs % 6000) / 100;
  return `PT${h ? `${h}H` : ''}${h || m ? `${m}M` : ''}${s.toFixed(2).replace(/\.?0+$/, '')}S`;
}

/** Recherche de l'API SCORM dans les fenêtres parentes puis l'ouvreur (algorithme ADL). */
export function findApi(version: ScormVersion, win: Window = window): Api12 | Api2004 | null {
  const key = version === '1.2' ? 'API' : 'API_1484_11';
  const look = (start: Window | null): Api12 | Api2004 | null => {
    let w: Window | null = start;
    for (let i = 0; w && i < 12; i++) {
      try {
        const api = (w as unknown as Record<string, unknown>)[key];
        if (api) return api as Api12 | Api2004;
      } catch {
        /* fenêtre d'une autre origine : on remonte */
      }
      if (w.parent === w) break;
      w = w.parent;
    }
    return null;
  };
  return look(win) ?? look(win.opener as Window | null);
}

export interface LmsState {
  learnerId: string;
  /** Étape de reprise (sinon null). */
  resumeStep: number | null;
}

/** Session SCORM : une instance par chargement du paquet. */
export class ScormSession {
  private readonly started = Date.now();
  private best: number | null = null;
  private passed = false;
  private completed = false;
  private finished = false;
  readonly active: boolean;

  constructor(
    readonly version: ScormVersion,
    private readonly api: Api12 | Api2004 | null,
  ) {
    this.active = !!api;
  }

  private get(k12: string, k2004: string): string {
    if (!this.api) return '';
    try {
      return this.version === '1.2'
        ? (this.api as Api12).LMSGetValue(k12)
        : (this.api as Api2004).GetValue(k2004);
    } catch {
      return '';
    }
  }
  private set(k12: string | null, k2004: string | null, value: string) {
    if (!this.api) return;
    try {
      if (this.version === '1.2' && k12) (this.api as Api12).LMSSetValue(k12, value);
      if (this.version === '2004' && k2004) (this.api as Api2004).SetValue(k2004, value);
    } catch {
      /* LMS indisponible : le module reste utilisable */
    }
  }
  private commit() {
    if (!this.api) return;
    try {
      if (this.version === '1.2') (this.api as Api12).LMSCommit('');
      else (this.api as Api2004).Commit('');
    } catch {
      /* idem */
    }
  }

  init(): LmsState {
    if (!this.api) return { learnerId: '', resumeStep: null };
    try {
      if (this.version === '1.2') (this.api as Api12).LMSInitialize('');
      else (this.api as Api2004).Initialize('');
    } catch {
      return { learnerId: '', resumeStep: null };
    }
    const status = this.get('cmi.core.lesson_status', 'cmi.completion_status');
    this.passed = status === 'passed' || this.get('', 'cmi.success_status') === 'passed';
    this.completed = this.passed || status === 'completed';
    if (!this.completed && (status === 'not attempted' || status === 'unknown' || status === ''))
      this.set('cmi.core.lesson_status', 'cmi.completion_status', 'incomplete');
    const entry = this.get('cmi.core.entry', 'cmi.entry');
    const loc = Number.parseInt(this.get('cmi.core.lesson_location', 'cmi.location'), 10);
    this.commit();
    return {
      learnerId: this.get('cmi.core.student_id', 'cmi.learner_id'),
      resumeStep: entry === 'resume' && Number.isFinite(loc) && loc > 0 ? loc : null,
    };
  }

  /** Étape vue : position de reprise ; la dernière étape vaut « completed ». */
  step(index: number, total: number) {
    this.set('cmi.core.lesson_location', 'cmi.location', String(index));
    this.set('cmi.suspend_data', 'cmi.suspend_data', JSON.stringify({ step: index }));
    if (index >= total - 1) this.complete();
    else this.commit();
  }

  complete() {
    if (!this.completed) {
      this.completed = true;
      if (!this.passed) this.set('cmi.core.lesson_status', null, 'completed');
      this.set(null, 'cmi.completion_status', 'completed');
    }
    this.commit();
  }

  /** Résultat d'une tentative de quiz (score de 0 à 100). */
  quiz(score: number, passed: boolean) {
    this.best = Math.max(this.best ?? 0, Math.round(score));
    this.set('cmi.core.score.min', 'cmi.score.min', '0');
    this.set('cmi.core.score.max', 'cmi.score.max', '100');
    this.set('cmi.core.score.raw', 'cmi.score.raw', String(this.best));
    this.set(null, 'cmi.score.scaled', String(this.best / 100));
    if (passed) this.passed = true;
    const success = this.passed ? 'passed' : 'failed';
    this.set('cmi.core.lesson_status', null, success);
    this.set(null, 'cmi.success_status', success);
    this.commit();
  }

  /** Fin de session : temps passé, sortie (« suspend » tant que le module n'est pas terminé). */
  finish() {
    if (!this.api || this.finished) return;
    this.finished = true;
    const ms = Date.now() - this.started;
    this.set('cmi.core.session_time', null, time12(ms));
    this.set(null, 'cmi.session_time', time2004(ms));
    const done = this.passed || (this.completed && this.best === null);
    this.set('cmi.core.exit', 'cmi.exit', done ? '' : 'suspend');
    this.commit();
    try {
      if (this.version === '1.2') (this.api as Api12).LMSFinish('');
      else (this.api as Api2004).Terminate('');
    } catch {
      /* idem */
    }
  }
}
