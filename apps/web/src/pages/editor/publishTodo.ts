/**
 * L38-5 (revue formation n° 5) : contenu à compléter avant publication, signalé dans la modale Publier sans
 * la bloquer : titre par défaut, étapes à capture sans titre, sans bulle ou à la bulle vide, quiz ouvert
 * sans question. L48-G §5 : liens du Sandbox vers des pages non capturées.
 */
export type TodoItem =
  | { kind: 'demoTitle' }
  | { kind: 'untitled' | 'noBubble' | 'emptyBubble'; index: number }
  | { kind: 'quizEmpty' }
  | { kind: 'deadLinks'; count: number };

const plain = (html: string | null | undefined) =>
  (html ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();

export function publishTodo(input: {
  title: string;
  defaultTitle: string;
  steps: Array<{ id: string; kind: string; title: string }>;
  hotspots: Array<{ step_id: string; title: string; body: string | null }>;
  /** Réglages du quiz posés (page Quiz ouverte). */
  quizOpened: boolean;
  questions: number;
  /** L48-G : liens sans page non traités (Sandbox). */
  deadLinks?: number;
}): TodoItem[] {
  const out: TodoItem[] = [];
  const title = input.title.trim();
  if (!title || title === input.defaultTitle) out.push({ kind: 'demoTitle' });
  input.steps.forEach((s, index) => {
    if (s.kind !== 'image') return;
    const hs = input.hotspots.filter((h) => h.step_id === s.id);
    if (!s.title.trim()) out.push({ kind: 'untitled', index });
    if (!hs.length) out.push({ kind: 'noBubble', index });
    else if (hs.some((h) => !h.title.trim() && !plain(h.body))) out.push({ kind: 'emptyBubble', index });
  });
  if (input.quizOpened && input.questions === 0) out.push({ kind: 'quizEmpty' });
  if (input.deadLinks) out.push({ kind: 'deadLinks', count: input.deadLinks });
  return out;
}

/** Une ligne par étape (remarques regroupées), puis les remarques de la démo. */
export function todoLines(
  items: TodoItem[],
): Array<{ key: string; index?: number; count?: number; kinds: TodoItem['kind'][] }> {
  const byStep = new Map<number, TodoItem['kind'][]>();
  const rest: Array<{ key: string; count?: number; kinds: TodoItem['kind'][] }> = [];
  for (const it of items) {
    if ('index' in it) byStep.set(it.index, [...(byStep.get(it.index) ?? []), it.kind]);
    else rest.push({ key: it.kind, kinds: [it.kind], ...('count' in it ? { count: it.count } : {}) });
  }
  const first = rest.filter((r) => r.key === 'demoTitle');
  const last = rest.filter((r) => r.key !== 'demoTitle');
  return [
    ...first,
    ...[...byStep].sort(([a], [b]) => a - b).map(([index, kinds]) => ({ key: `s${index}`, index, kinds })),
    ...last,
  ];
}
