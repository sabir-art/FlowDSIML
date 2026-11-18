/**
 * L13 : calculs du suivi des apprenants à partir de la RPC learners_progress.
 * La base renvoie un état par apprenant et par module ; ici on en déduit l'état par formation,
 * le statut affiché (Terminé / En cours / À relancer), les KPI, les filtres et l'export CSV.
 */

export type ModuleStatus = 'validated' | 'failed' | 'in_progress' | 'not_started';
export type LearnerStatus = 'done' | 'active' | 'stale';

export interface RawModule {
  demoId: string;
  total: number;
  seen: number;
  completed: boolean;
  hasQuiz: boolean;
  best: number | null;
  used: number;
  max: number | null;
  status: ModuleStatus;
  lastActivity: string | null;
}

export interface RawLearner {
  id: string;
  email: string | null;
  name: string;
  source: 'lead' | 'link';
  structureId: string | null;
  createdAt: string;
  lastReminder: string | null;
  modules: RawModule[];
}

export interface PathModuleInfo {
  demoId: string;
  title: string;
  required: boolean;
  hasQuiz: boolean;
  threshold: number;
}

export interface PathInfo {
  id: string;
  title: string;
  ordered: boolean;
  goal: number;
  modules: PathModuleInfo[];
}

export interface ProgressData {
  paths: PathInfo[];
  structures: Array<{ id: string; name: string }>;
  learners: RawLearner[];
}

export interface PathState {
  path: PathInfo;
  /** 0 à 1 */
  pct: number;
  done: boolean;
  status: LearnerStatus;
  /** Premier module non validé (null si tout est validé). */
  current: { index: number; title: string } | null;
  lastActivity: string;
  /** Date de la dernière validation de module, quand la formation est terminée. */
  doneAt: string | null;
}

export interface LearnerRow {
  raw: RawLearner;
  label: string;
  paths: PathState[];
  pct: number;
  best: number | null;
  attempts: number;
  status: LearnerStatus;
  lastActivity: string;
  inactiveDays: number;
}

export const STALE_DAYS = 7;
export const REMINDER_HOURS = 72;
const DAY = 86_400_000;

const maxIso = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

function modulePct(m: RawModule | undefined): number {
  if (!m) return 0;
  if (m.status === 'validated') return 1;
  return m.total > 0 ? Math.min(1, m.seen / m.total) : 0;
}

/** Une formation est suivie dès qu'un de ses modules a été commencé. */
export function followsPath(l: RawLearner, p: PathInfo): boolean {
  return p.modules.some((pm) => {
    const m = l.modules.find((x) => x.demoId === pm.demoId);
    return !!m && m.status !== 'not_started';
  });
}

function statusFor(done: boolean, last: string, now: number): LearnerStatus {
  if (done) return 'done';
  return now - Date.parse(last) < STALE_DAYS * DAY ? 'active' : 'stale';
}

export function pathState(l: RawLearner, p: PathInfo, now: number): PathState {
  const mods = p.modules.map((pm) => l.modules.find((m) => m.demoId === pm.demoId));
  const pct = mods.length ? mods.reduce((s, m) => s + modulePct(m), 0) / mods.length : 0;
  const required = p.modules.filter((pm) => pm.required);
  const mustDo = required.length ? required : p.modules;
  const done =
    mustDo.length > 0 &&
    mustDo.every((pm) => l.modules.find((m) => m.demoId === pm.demoId)?.status === 'validated');
  const idx = mods.findIndex((m) => m?.status !== 'validated');
  const last = mods.reduce<string | null>((a, m) => maxIso(a, m?.lastActivity ?? null), null) ?? l.createdAt;
  return {
    path: p,
    pct,
    done,
    status: statusFor(done, last, now),
    current: idx < 0 ? null : { index: idx, title: p.modules[idx]!.title },
    lastActivity: last,
    doneAt: done ? last : null,
  };
}

export function learnerRow(l: RawLearner, paths: PathInfo[], now: number): LearnerRow {
  const followed = paths.filter((p) => followsPath(l, p)).map((p) => pathState(l, p, now));
  const quizMods = l.modules.filter(
    (m) => m.hasQuiz && followed.some((s) => s.path.modules.some((pm) => pm.demoId === m.demoId)),
  );
  const scores = quizMods.map((m) => m.best).filter((x): x is number => x !== null);
  const last = l.modules.reduce<string | null>((a, m) => maxIso(a, m.lastActivity), null) ?? l.createdAt;
  const done = followed.length > 0 && followed.every((s) => s.done);
  return {
    raw: l,
    label: l.name.trim() || l.email || '',
    paths: followed,
    pct: followed.length ? followed.reduce((s, x) => s + x.pct, 0) / followed.length : 0,
    best: scores.length ? Math.max(...scores) : null,
    attempts: quizMods.reduce((s, m) => s + m.used, 0),
    status: statusFor(done, last, now),
    lastActivity: last,
    inactiveDays: Math.max(0, Math.floor((now - Date.parse(last)) / DAY)),
  };
}

export function buildRows(d: ProgressData, now: number): LearnerRow[] {
  return d.learners.map((l) => learnerRow(l, d.paths, now));
}

/** Relance possible : e-mail connu et aucune relance depuis 72 h (règle aussi vérifiée en base). */
export function canRemind(l: RawLearner, now: number): boolean {
  return !!l.email && (!l.lastReminder || now - Date.parse(l.lastReminder) >= REMINDER_HOURS * 3_600_000);
}

// ---------------------------------------------------------------------------
// Filtres et tri (gardés dans l'URL)
// ---------------------------------------------------------------------------
export interface Filters {
  path: string;
  status: LearnerStatus | '';
  structure: string;
  q: string;
  /** Module (démo) non validé : ouvert depuis la vue par formation. */
  module: string;
}

export type SortKey = 'name' | 'progress' | 'score' | 'last';

export function applyFilters(rows: LearnerRow[], f: Filters): LearnerRow[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter((r) => {
    const scope = f.path ? r.paths.find((s) => s.path.id === f.path) : null;
    if (f.path && !scope) return false;
    const status = scope ? scope.status : r.status;
    if (f.status && status !== f.status) return false;
    if (
      f.structure === 'none' ? r.raw.structureId !== null : f.structure && r.raw.structureId !== f.structure
    )
      return false;
    if (f.module && r.raw.modules.find((m) => m.demoId === f.module)?.status === 'validated') return false;
    if (q && !r.label.toLowerCase().includes(q) && !(r.raw.email ?? '').includes(q)) return false;
    return true;
  });
}

export function sortRows(rows: LearnerRow[], key: SortKey, asc: boolean): LearnerRow[] {
  const val = (r: LearnerRow): number | string =>
    key === 'name'
      ? r.label.toLowerCase()
      : key === 'progress'
        ? r.pct
        : key === 'score'
          ? (r.best ?? -1)
          : r.lastActivity;
  const out = [...rows].sort((a, b) => {
    const x = val(a);
    const y = val(b);
    return x < y ? -1 : x > y ? 1 : a.label.localeCompare(b.label);
  });
  return asc ? out : out.reverse();
}

// ---------------------------------------------------------------------------
// KPI
// ---------------------------------------------------------------------------
export function kpis(rows: LearnerRow[], paths: PathInfo[]) {
  const scored = rows.filter((r) => r.best !== null);
  const thresholds = [
    ...new Set(paths.flatMap((p) => p.modules.filter((m) => m.hasQuiz).map((m) => m.threshold))),
  ];
  return {
    total: rows.length,
    done: rows.filter((r) => r.status === 'done').length,
    active: rows.filter((r) => r.status === 'active').length,
    stale: rows.filter((r) => r.status === 'stale').length,
    avgScore: scored.length ? Math.round(scored.reduce((s, r) => s + r.best!, 0) / scored.length) : null,
    threshold: thresholds.length === 1 ? thresholds[0]! : null,
  };
}

/** Vue par formation : répartition, quiz et avancement par module. */
export function pathStats(rows: LearnerRow[], p: PathInfo) {
  const states = rows
    .map((r) => ({ r, s: r.paths.find((x) => x.path.id === p.id) }))
    .filter((x): x is { r: LearnerRow; s: PathState } => !!x.s);
  const n = states.length;
  const count = (st: LearnerStatus) => states.filter((x) => x.s.status === st).length;
  const quizIds = p.modules.filter((m) => m.hasQuiz).map((m) => m.demoId);
  const tried = states.filter((x) =>
    quizIds.some((id) => (x.r.raw.modules.find((m) => m.demoId === id)?.used ?? 0) > 0),
  );
  const quizOk = (x: { r: LearnerRow }, first: boolean) =>
    quizIds.every((id) => {
      const m = x.r.raw.modules.find((mm) => mm.demoId === id);
      return m?.status === 'validated' && (!first || m.used === 1);
    });
  const modules = p.modules.map((pm) => ({
    ...pm,
    ok: states.filter((x) => x.r.raw.modules.find((m) => m.demoId === pm.demoId)?.status === 'validated')
      .length,
  }));
  let drop: { from: number; to: number; points: number } | null = null;
  for (let i = 1; i < modules.length; i++) {
    const pts = n ? Math.round(((modules[i - 1]!.ok - modules[i]!.ok) / n) * 100) : 0;
    if (pts > 0 && (!drop || pts > drop.points)) drop = { from: i, to: i + 1, points: pts };
  }
  return {
    learners: n,
    done: count('done'),
    active: count('active'),
    stale: count('stale'),
    hasQuiz: quizIds.length > 0,
    quizTried: tried.length,
    quizPassed: tried.filter((x) => quizOk(x, false)).length,
    quizFirst: tried.filter((x) => quizOk(x, true)).length,
    modules,
    drop,
  };
}

/** Parts entières dont la somme fait 100 (méthode du plus fort reste). */
export function splitPercents(values: number[]): number[] {
  const total = values.reduce((s, v) => s + v, 0);
  if (!total) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * 100);
  const out = raw.map(Math.floor);
  let rest = 100 - out.reduce((s, v) => s + v, 0);
  const order = raw.map((v, i) => ({ i, f: v - Math.floor(v) })).sort((a, b) => b.f - a.f);
  for (const { i } of order) {
    if (rest <= 0) break;
    out[i]!++;
    rest--;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Export CSV
// ---------------------------------------------------------------------------
export type ExportColumn = 'identity' | 'progress' | 'quiz' | 'modules';

export interface CsvLabels {
  name: string;
  email: string;
  structure: string;
  source: string;
  sourceValue: (s: 'lead' | 'link') => string;
  paths: string;
  progress: string;
  status: string;
  statusValue: (s: LearnerStatus) => string;
  lastActivity: string;
  best: string;
  attempts: string;
  moduleValue: (s: ModuleStatus) => string;
}

export function csvTable(
  rows: LearnerRow[],
  d: ProgressData,
  cols: ExportColumn[],
  L: CsvLabels,
): { headers: string[]; data: unknown[][] } {
  const structure = (id: string | null) => d.structures.find((s) => s.id === id)?.name ?? '';
  const mods = d.paths.flatMap((p) => p.modules.map((m) => ({ p, m })));
  const headers: string[] = [];
  if (cols.includes('identity')) headers.push(L.name, L.email, L.structure, L.source);
  if (cols.includes('progress')) headers.push(L.paths, L.progress, L.status, L.lastActivity);
  if (cols.includes('quiz')) headers.push(L.best, L.attempts);
  if (cols.includes('modules')) headers.push(...mods.map(({ p, m }) => `${p.title} · ${m.title}`));
  const data = rows.map((r) => {
    const out: unknown[] = [];
    if (cols.includes('identity'))
      out.push(r.raw.name, r.raw.email ?? '', structure(r.raw.structureId), L.sourceValue(r.raw.source));
    if (cols.includes('progress'))
      out.push(
        r.paths.map((s) => s.path.title).join(' | '),
        Math.round(r.pct * 100),
        L.statusValue(r.status),
        r.lastActivity,
      );
    if (cols.includes('quiz')) out.push(r.best ?? '', r.attempts);
    if (cols.includes('modules'))
      out.push(
        ...mods.map(({ m }) => {
          const x = r.raw.modules.find((mm) => mm.demoId === m.demoId);
          return x ? `${L.moduleValue(x.status)} (${Math.round(modulePct(x) * 100)} %)` : '';
        }),
      );
    return out;
  });
  return { headers, data };
}
