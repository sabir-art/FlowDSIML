/** Logique pure du player (testée). */
import type { ChoiceAction, Manifest, Quiz, QuizQuestion, Step } from '@flowdsiml/manifest';

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

/** Parse le hash : #/d/<demoId>?company=x | #/l/<token> | #/preview | #/c/<slug>[/f/<formation>] */
export function parseRoute(
  hash: string,
):
  | { kind: 'demo'; id: string; search: string }
  | { kind: 'link'; token: string; search: string }
  | { kind: 'preview' }
  | { kind: 'center'; slug: string; pathId: string | null; params: URLSearchParams }
  | { kind: 'page'; id: string }
  | { kind: 'none' } {
  const h = hash.replace(/^#/, '');
  const [path = '', search = ''] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'd' && parts[1] && /^[0-9a-f-]{36}$/i.test(parts[1]))
    return { kind: 'demo', id: parts[1], search: `?${search}` };
  if (parts[0] === 'l' && parts[1] && /^[A-Za-z0-9_-]{6,64}$/.test(parts[1]))
    return { kind: 'link', token: parts[1], search: `?${search}` };
  if (parts[0] === 'preview') return { kind: 'preview' };
  // L19b : page publique d'une démo (#/p/<id>)
  if (parts[0] === 'p' && parts[1] && /^[0-9a-f-]{36}$/i.test(parts[1]))
    return { kind: 'page', id: parts[1] };
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
}

/** L22 : destination imposée par la première règle vraie de l'étape `i`, sinon null. */
export function ruleTarget(m: Manifest, i: number, mem: BranchMemory): ChoiceAction | null {
  const rules = m.steps[i]?.options.rules ?? [];
  for (const r of rules) {
    const ok =
      'choice' in r.when
        ? mem.choices[r.when.choice.stepId] === r.when.choice.index
        : (mem.answers[r.when.quiz.questionId] ?? []).includes(r.when.quiz.answerId);
    if (ok) return r.goto;
  }
  return null;
}
