/** Logique pure du player (testée). */
import type {
  ChoiceAction,
  Dataset,
  Manifest,
  Quiz,
  QuizQuestion,
  RuleCond,
  RuleOp,
  Step,
} from '@flowdsiml/manifest';
import { maskPreviewStyle, type Mask } from '@flowdsiml/manifest';

/** EXT-02 §6.2 : aperçu d'un masque avant publication (arrondi, filtre de fond, teinte). */
export function maskStyle(m: Mask, ratio: number) {
  const p = maskPreviewStyle(m, ratio);
  return {
    borderRadius: p.borderRadius,
    backdropFilter: p.backdropFilter,
    '-webkit-backdrop-filter': p.backdropFilter,
    ...(p.background ? { background: p.background } : {}),
  };
}

export { resolvePlacement, type Placement } from '@flowdsiml/player-core';

/** L'origine qui embarque le player est-elle autorisée ? (contrôle côté client, contournable) */
export function embedAllowed(allowed: string[], inIframe: boolean, parentOrigin: string | null): boolean {
  if (!inIframe || allowed.length === 0) return true;
  if (!parentOrigin) return false;
  return allowed.some((a) => {
    try {
      const want = new URL(a.includes('://') ? a : `https://${a}`);
      const got = new URL(parentOrigin);
      if (want.hostname.startsWith('*.')) return got.hostname.endsWith(want.hostname.slice(1));
      return want.hostname === got.hostname;
    } catch {
      return false;
    }
  });
}

/** Résout les URL d'images relatives (assets/…) par rapport au dossier publié. */
export function resolveAssets(m: Manifest, base: string): Manifest {
  const abs = (u: string) => (/^(https?:|blob:|data:)/.test(u) ? u : base + u);
  return {
    ...m,
    steps: m.steps.map((s): Step => ({
      ...s,
      image: s.image ? { ...s.image, url: abs(s.image.url) } : s.image,
      // L17 : capture « Avant » publiée à côté des autres
      beforeAfter: s.beforeAfter
        ? { ...s.beforeAfter, before: { ...s.beforeAfter.before, url: abs(s.beforeAfter.before.url) } }
        : s.beforeAfter,
      // L25-01 : page entière (animation de défilement)
      options: s.options.fullPage?.url
        ? { ...s.options, fullPage: { ...s.options.fullPage, url: abs(s.options.fullPage.url) } }
        : s.options,
      // L28 035 : voix off
      voice: s.voice ? { ...s.voice, src: abs(s.voice.src) } : s.voice,
      // F7 : vidéo et images des pauses
      video: s.video
        ? {
            ...s.video,
            url: abs(s.video.url),
            frames: Object.fromEntries(Object.entries(s.video.frames).map(([k, u]) => [k, abs(u)])),
          }
        : s.video,
    })),
  };
}

/**
 * L18 : variante A/B du visiteur, tirée une fois (répartition splitB % pour B) et gardée dans le
 * stockage local (tc_ab_<testId>, valeur A ou B, aucune donnée personnelle). Sans stockage : tirage
 * à chaque chargement.
 */
export function abVariant(
  testId: string,
  splitB: number,
  store: Pick<Storage, 'getItem' | 'setItem'> | null,
  rnd: () => number = Math.random,
): 'A' | 'B' {
  const key = `tc_ab_${testId}`;
  try {
    const v = store?.getItem(key);
    if (v === 'A' || v === 'B') return v;
  } catch {
    /* stockage indisponible */
  }
  const v = rnd() * 100 < splitB ? 'B' : 'A';
  try {
    store?.setItem(key, v);
  } catch {
    /* stockage indisponible */
  }
  return v;
}

/** L18 : manifeste vu par le visiteur (la bulle testée prend le texte de B pour la variante B). */
export function applyAb(m: Manifest, variant: 'A' | 'B'): Manifest {
  const ab = m.ab;
  if (!ab || variant === 'A') return m;
  return {
    ...m,
    steps: m.steps.map((s) => ({
      ...s,
      hotspots: s.hotspots.map((h) =>
        h.id === ab.hotspotId ? { ...h, title: ab.b.title, body: ab.b.body, cta: ab.b.cta } : h,
      ),
    })),
  };
}

/** Index de l'étape suivante pour une action de hotspot. */
export function nextIndex(
  m: Manifest,
  current: number,
  action: { type: string; stepId?: string },
): number | null {
  if (action.type === 'goto' && action.stepId) {
    const i = m.steps.findIndex((s) => s.id === action.stepId);
    return i >= 0 ? i : null;
  }
  if (action.type === 'next') return current + 1 < m.steps.length ? current + 1 : null;
  return null;
}

export function randomId(): string {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Parse le hash : #/d/<demoId>?company=x | #/l/<token> | #/l/<adresse> | #/preview | #/c/<slug>[/f/<formation>]
 * L28 082 : une adresse personnalisée finit toujours par « -<6 base62> » ; un jeton n'a jamais de tiret.
 */
export function parseRoute(
  hash: string,
):
  | { kind: 'demo'; id: string; search: string }
  | { kind: 'link'; token: string; search: string }
  | { kind: 'address'; address: string; search: string }
  | { kind: 'preview' }
  | { kind: 'center'; slug: string; pathId: string | null; params: URLSearchParams }
  | { kind: 'page'; id: string; code?: string }
  | { kind: 'none' } {
  const h = hash.replace(/^#/, '');
  const [path = '', search = ''] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'd' && parts[1] && /^[0-9a-f-]{36}$/i.test(parts[1]))
    return { kind: 'demo', id: parts[1], search: `?${search}` };
  if (parts[0] === 'l' && parts[1] && /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]-[A-Za-z0-9]{6}$/.test(parts[1]))
    return { kind: 'address', address: parts[1], search: `?${search}` };
  if (parts[0] === 'l' && parts[1] && /^[A-Za-z0-9_-]{6,64}$/.test(parts[1]))
    return { kind: 'link', token: parts[1], search: `?${search}` };
  if (parts[0] === 'preview') return { kind: 'preview' };
  // L19b : page publique d'une démo (#/p/<id>)
  if (parts[0] === 'p' && parts[1] && /^[0-9a-f-]{36}$/i.test(parts[1])) {
    // L25-14 : page personnalisée d'un lien (#/p/<id>/<code de 12 caractères>)
    if (parts[2] !== undefined)
      return /^[0-9A-Za-z]{12}$/.test(parts[2])
        ? { kind: 'page', id: parts[1], code: parts[2] }
        : { kind: 'none' };
    return { kind: 'page', id: parts[1] };
  }
  // L14 : centre de formation (#/c/<slug>, #/c/<slug>/f/<formation>)
  if (parts[0] === 'c' && parts[1] && /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(parts[1])) {
    const pathId = parts[2] === 'f' && parts[3] && /^[0-9a-f-]{36}$/i.test(parts[3]) ? parts[3] : null;
    return { kind: 'center', slug: parts[1], pathId, params: new URLSearchParams(search) };
  }
  return { kind: 'none' };
}

/** F1 : index de l'écran affiché derrière une étape pop-up (dernière étape image précédente). */
export function backdropIndex(m: Manifest, i: number): number | null {
  for (let j = i - 1; j >= 0; j--) if (m.steps[j]?.kind === 'image' && m.steps[j]?.image) return j;
  return null;
}

/**
 * F1 : éléments de la checklist (un par chapitre, sinon un par étape). Un chapitre est coché quand
 * sa dernière étape a été vue (spec a2 §3), ce qui reste juste avec un parcours à embranchements.
 */
export function checklistItems(
  m: Manifest,
  visited: ReadonlySet<number>,
  current: number,
): Array<{ id: string; title: string; target: number; done: boolean; current: boolean }> {
  if (m.chapters.length)
    return m.chapters.flatMap((c) => {
      const idx = m.steps.flatMap((s, i) => (s.chapterId === c.id ? [i] : []));
      if (!idx.length) return [];
      return [
        {
          id: c.id,
          title: c.title,
          target: idx[0]!,
          done: visited.has(idx[idx.length - 1]!),
          current: idx.includes(current),
        },
      ];
    });
  return m.steps.map((s, i) => ({
    id: s.id,
    title: s.title || s.hotspots[0]?.title || `${i + 1}`,
    target: i,
    done: visited.has(i),
    current: i === current,
  }));
}

/** F1 : destination d'un choix de parcours. */
export function choiceTarget(
  m: Manifest,
  action: ChoiceAction,
  from = -1,
): { kind: 'step'; index: number } | { kind: 'end' } | { kind: 'url'; url: string } | null {
  if (action.type === 'end') return { kind: 'end' };
  // L22-09 : étape suivante dans l'ordre courant ; après la dernière, fin de la démo
  if (action.type === 'next')
    return from < 0 ? null : from + 1 < m.steps.length ? { kind: 'step', index: from + 1 } : { kind: 'end' };
  if (action.type === 'url') return { kind: 'url', url: action.url };
  const i =
    action.type === 'goto'
      ? m.steps.findIndex((s) => s.id === action.stepId)
      : m.steps.findIndex((s) => s.chapterId === action.chapterId);
  return i >= 0 ? { kind: 'step', index: i } : null;
}

/** F1 : l'autoplay peut-il avancer depuis l'étape i ? (pas de formulaire, de choix ni de fin) */
export function canAutoAdvance(m: Manifest, i: number, gated: boolean): boolean {
  const s = m.steps[i];
  if (!s || gated || i >= m.steps.length - 1) return false;
  return s.options.choices.length === 0;
}

/** F2 : une question est juste si l'ensemble coché = l'ensemble des bonnes réponses (tout ou rien). */
export function isCorrect(q: QuizQuestion, chosen: readonly string[]): boolean {
  if (!chosen.length) return false;
  const good = new Set(q.answers.filter((a) => a.correct).map((a) => a.id));
  return chosen.length === good.size && chosen.every((id) => good.has(id));
}

/** F2 : réponse incomplète = au moins une bonne réponse cochée, aucune mauvaise, mais pas toutes. */
export function isPartial(q: QuizQuestion, chosen: readonly string[]): boolean {
  const good = new Set(q.answers.filter((a) => a.correct).map((a) => a.id));
  return chosen.length > 0 && chosen.every((id) => good.has(id)) && chosen.length < good.size;
}

/** F2 : score local (aperçu ou repli hors ligne), même calcul que submit_quiz_attempt. */
/** L19 : question de sondage non notée (note de 0 à 10, réponse écrite). */
export const isOpenQuestion = (q: { type: string }) => q.type === 'nps' || q.type === 'text';

/** Réponse envoyée à submit_quiz_attempt : note (nps), texte (text, 500 caractères) ou choix. */
export function quizAnswerPayload(quiz: Quiz, questionId: string, values: string[]) {
  const q = quiz.questions.find((x) => x.id === questionId);
  if (q?.type === 'nps') return { questionId, value: Number(values[0]) };
  if (q?.type === 'text') return { questionId, text: (values[0] ?? '').trim().slice(0, 500) };
  return { questionId, answerIds: values };
}

export function scoreQuiz(quiz: Quiz, answers: Record<string, string[]>) {
  let points = 0;
  let total = 0;
  let correct = 0;
  const questions = quiz.questions
    .filter((q) => !isOpenQuestion(q))
    .map((q) => {
      total += q.points;
      const ok = isCorrect(q, answers[q.id] ?? []);
      if (ok) {
        correct++;
        points += q.points;
      }
      return { questionId: q.id, correct: ok };
    });
  const score = total ? Math.round((100 * points) / total) : 0;
  return {
    score,
    correct,
    total: quiz.questions.length,
    passed: quiz.mode === 'survey' || score >= quiz.threshold,
    questions,
  };
}

/** Mélange de Fisher-Yates (aléa injectable pour les tests). */
export function shuffled<T>(list: readonly T[], rnd: () => number = Math.random): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** L22 : mémoire de la session utilisée par les règles (choix faits, réponses au quiz). */
export interface BranchMemory {
  /** Index du choix fait à chaque étape à menu (par identifiant d'étape). */
  choices: Record<string, number>;
  /** Réponses cochées par question du quiz. */
  answers: Record<string, string[]>;
  /** L25-10 : valeurs des variables (lien personnalisé, formulaire), score du quiz (%), variante A/B. */
  vars?: Record<string, string | undefined>;
  score?: number | null;
  variant?: 'A' | 'B';
}

const norm = (s: string) => s.trim().toLocaleLowerCase();
/** Nombre saisi (« 1 248 », « 12,5 ») ; null sinon. */
export function ruleNumber(s: string): number | null {
  const t = s.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

/**
 * L25-10 : comparaison d'une condition, opérateurs en liste fermée. Aucune évaluation d'expression :
 * égalité et inclusion de chaînes (sans casse), comparaison de nombres. Valeur absente = vide.
 */
export function compareCond(left: string, op: RuleOp, right: string): boolean {
  switch (op) {
    case 'is':
      return norm(left) === norm(right);
    case 'isNot':
      return norm(left) !== norm(right);
    case 'contains':
      return norm(right) !== '' && norm(left).includes(norm(right));
    case 'lt':
    case 'gt': {
      const a = ruleNumber(left);
      const b = ruleNumber(right);
      if (a === null || b === null) return false;
      return op === 'lt' ? a < b : a > b;
    }
    default:
      return false;
  }
}

/** Valeur lue par une condition (variable, réponse d'une étape, score, variante). */
function condLeft(m: Manifest, c: RuleCond, mem: BranchMemory): string {
  switch (c.source) {
    case 'var':
      return (c.key && mem.vars?.[c.key]) || '';
    case 'answer': {
      const k = c.stepId ? mem.choices[c.stepId] : undefined;
      const st = m.steps.find((s) => s.id === c.stepId);
      return k === undefined ? '' : (st?.options.choices[k]?.label ?? '');
    }
    case 'score':
      return mem.score === null || mem.score === undefined ? '' : String(mem.score);
    case 'ab':
      return mem.variant ?? 'A';
  }
}

/**
 * L22 : destination imposée par la première règle vraie de l'étape `i`. L25-10 : sinon, « Sinon,
 * aller à » s'il est réglé ; null = étape suivante.
 */
export function ruleTarget(m: Manifest, i: number, mem: BranchMemory): ChoiceAction | null {
  const opts = m.steps[i]?.options;
  const rules = opts?.rules ?? [];
  for (const r of rules) {
    const ok =
      'choice' in r.when
        ? mem.choices[r.when.choice.stepId] === r.when.choice.index
        : 'quiz' in r.when
          ? (mem.answers[r.when.quiz.questionId] ?? []).includes(r.when.quiz.answerId)
          : compareCond(condLeft(m, r.when.cond, mem), r.when.cond.op, r.when.cond.value);
    if (ok) return r.goto;
  }
  if (rules.length && opts?.rulesElse && opts.rulesElse.type !== 'next') return opts.rulesElse;
  return null;
}

/**
 * L25-06 : onglets visibles à l'étape i (déjà ouverts, dernier titre connu) et onglet actif. Vide si
 * l'étape n'a pas d'onglet ou si l'éditeur les a masqués.
 */
export function tabsAt(m: Manifest, i: number): { tabs: { n: number; title: string }[]; active: number } {
  const cur = m.steps[i]?.options.tab;
  if (!cur || m.steps[i]!.options.showTabs === false) return { tabs: [], active: 0 };
  const seen = new Map<number, { n: number; title: string }>();
  for (let k = 0; k <= i; k++) {
    const t = m.steps[k]!.options.tab;
    if (t) seen.set(t.n, t);
  }
  return { tabs: [...seen.values()].sort((a, b) => a.n - b.n), active: cur.n };
}

/** L25-06 : l'étape i change d'onglet (par rapport à la dernière étape qui en a un). */
export function tabChanged(m: Manifest, i: number): boolean {
  const cur = m.steps[i]?.options.tab;
  if (!cur) return false;
  for (let k = i - 1; k >= 0; k--) {
    const t = m.steps[k]!.options.tab;
    if (t) return t.n !== cur.n;
  }
  return cur.n > 1;
}

/**
 * L25-09 : ligne du jeu de données utilisée. « Selon le lien personnalisé » : la ligne dont la colonne
 * de correspondance vaut la variable reliée à cette colonne ; sinon la ligne 1. Sans correspondance :
 * null (les valeurs de la capture restent).
 */
export function datasetRow(ds: Dataset, vars: Record<string, string | undefined>): string[] | null {
  if (!ds.rows.length) return null;
  if (ds.rowMode === 'first' || !ds.linkColumn) return ds.rows[0]!;
  const col = ds.columns.indexOf(ds.linkColumn);
  const key = ds.bindings.find((b) => b.kind === 'variable' && b.column === ds.linkColumn)?.key;
  const v = key ? vars[key] : undefined;
  if (col < 0 || !v) return null;
  return ds.rows.find((r) => norm(r[col] ?? '') === norm(v)) ?? null;
}

/** L25-09 : variables remplies par la ligne (hors variable de correspondance). */
export function datasetVars(ds: Dataset, row: string[] | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!row) return out;
  for (const b of ds.bindings) {
    if (b.kind !== 'variable' || !b.key) continue;
    if (ds.rowMode === 'link' && b.column === ds.linkColumn) continue;
    const i = ds.columns.indexOf(b.column);
    if (i >= 0 && row[i] !== undefined) out[b.key] = row[i]!;
  }
  return out;
}

/** L25-09 : lignes d'un graphique relié (libellé : colonne de correspondance ou autre colonne publiée). */
export function datasetChartRows(ds: Dataset, column: string): Array<{ label: string; value: number }> {
  const v = ds.columns.indexOf(column);
  const labelCol =
    ds.linkColumn && ds.linkColumn !== column ? ds.linkColumn : ds.columns.find((c) => c !== column);
  const l = labelCol ? ds.columns.indexOf(labelCol) : -1;
  if (v < 0) return [];
  return ds.rows
    .flatMap((r, i) => {
      const n = ruleNumber(r[v] ?? '');
      return n === null ? [] : [{ label: (l >= 0 ? (r[l] ?? '') : String(i + 1)).slice(0, 40), value: n }];
    })
    .slice(0, 12);
}

/** L25-09 : étape HTML avec les valeurs du jeu de données (éléments reliés, graphiques reliés). */
export function withDataset(step: Step, ds: Dataset | null, row: string[] | null): Step {
  if (!ds || step.kind !== 'html' || !step.html) return step;
  const binds = ds.bindings.filter((b) => b.stepId === step.id);
  if (!binds.length) return step;
  const charts = new Map(
    binds.flatMap((b) =>
      b.kind === 'chart' && b.opId ? [[b.opId, datasetChartRows(ds, b.column)] as const] : [],
    ),
  );
  const ops = step.html.ops.map((o) => {
    const rows = charts.get(o.id);
    if (o.op !== 'chart' || !rows?.length || !o.value || typeof o.value !== 'object' || !('rows' in o.value))
      return o;
    return { ...o, value: { ...o.value, rows } };
  });
  const texts = row
    ? binds.flatMap((b, i) => {
        const c = ds.columns.indexOf(b.column);
        return b.kind === 'element' && b.sel && c >= 0
          ? [{ id: `ds-${i}`, sel: b.sel, op: 'text' as const, value: row[c] ?? '', scope: 'step' as const }]
          : [];
      })
    : [];
  return { ...step, html: { ...step.html, ops: [...ops, ...texts] } };
}
