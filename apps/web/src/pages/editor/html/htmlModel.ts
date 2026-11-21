import { useSyncExternalStore } from 'react';
import { STYLE_SELS_MAX, validHtmlOps, type HtmlOp, type HtmlStyle } from '@flowdsiml/core';
import type { MultiEl, Selected } from '@flowdsiml/player-core';
import type { Json } from '@flowdsiml/supabase-types';
import type { DemoEditor } from '../useDemoEditor';
import type { StepRow } from '../types';

/** Opérations d'une étape (valeur de la base, vérifiée). */
export function asOps(v: Json | null | undefined): HtmlOp[] {
  return validHtmlOps(v) ? v : [];
}

export const newOpId = () => `o-${crypto.randomUUID().slice(0, 8)}`;

/**
 * État partagé de l'éditeur d'éléments (canevas, barre d'actions et panneau sont séparés) :
 * élément sélectionné, opérations introuvables, demande d'édition du texte. Une étape à la fois.
 */
interface HtmlEditState {
  stepId: string | null;
  selected: Selected | null;
  notFound: string[];
  /** Incrémenté par « Modifier le texte » / Entrée : le panneau place le focus sur le champ. */
  focusText: number;
  /** Portée choisie dans le panneau (« Cette étape » / « Toutes les étapes »). */
  scope: 'step' | 'all';
  /** L25-07 : sélection multiple (Maj + clic, « Sélectionner les semblables »), 2 éléments au moins. */
  multi: MultiEl[];
  /** L28-05 : sélecteur de l'image à remplacer (médiathèque ouverte), depuis la barre ou le panneau. */
  library: string | null;
  /** A8 guide : sélecteur d'une bulle vérifié dans la page (ok : null tant que la page n'a pas répondu). */
  probe: { sel: string; ok: boolean | null } | null;
}
let state: HtmlEditState = {
  stepId: null,
  selected: null,
  notFound: [],
  focusText: 0,
  scope: 'step',
  multi: [],
  library: null,
  probe: null,
};
const subs = new Set<() => void>();
export function setHtmlEdit(patch: Partial<HtmlEditState>) {
  state = { ...state, ...patch };
  subs.forEach((f) => f());
}
export function useHtmlEdit(stepId: string): HtmlEditState {
  const s = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
  );
  if (s.stepId !== stepId) {
    state = {
      stepId,
      selected: null,
      notFound: [],
      focusText: 0,
      scope: s.scope,
      multi: [],
      library: null,
      probe: null,
    };
    return state;
  }
  return s;
}
/** L25-09 : élément sélectionné dans le canevas HTML (cible proposée par « Relier les colonnes »). */
export const htmlSelection = () => ({ stepId: state.stepId, selected: state.selected });
/** A8 : vérification de sélecteur en attente (renvoyée à la page dès qu'elle est prête). */
export const htmlProbe = () => state.probe;

/** A8 : fermeture du toast de consigne « Sélectionnez un élément… » (dès qu'une bulle est ajoutée). */
export const guideHint: { close: (() => void) | null } = { close: null };

/** Envoi vers la page de l'éditeur (canevas monté). */
export const frameSend: {
  current:
    | ((
        m:
          | { t: 'select'; sel: string | null }
          | { t: 'probe'; sel: string }
          | { t: 'up'; n: number }
          | { t: 'similar' }
          | { t: 'multi-clear' },
      ) => void)
    | null;
} = {
  current: null,
};

/** Étapes HTML de la démo (portée « Toutes les étapes »). */
export const htmlSteps = (editor: DemoEditor) => editor.steps.filter((s) => s.kind === 'html');

/**
 * Ajoute ou remplace l'opération d'un type sur un sélecteur. Portée « toutes » : la même
 * opération (même groupe) est posée sur chaque étape HTML, en une seule annulation.
 */
export function upsertOp(
  editor: DemoEditor,
  step: StepRow,
  op: Omit<HtmlOp, 'id' | 'scope' | 'group'>,
  scope: 'step' | 'all',
) {
  const targets = scope === 'all' ? htmlSteps(editor) : [step];
  const group = scope === 'all' ? `g-${crypto.randomUUID().slice(0, 8)}` : undefined;
  editor.batch(() => {
    for (const s of targets) {
      const ops = asOps(s.html_ops);
      const same = ops.find((o) => o.sel === op.sel && o.op === op.op);
      const rest = ops.filter((o) => o !== same && !(o.sel === op.sel && conflicts(o.op, op.op)));
      const next: HtmlOp = {
        id: same?.id ?? newOpId(),
        sel: op.sel,
        op: op.op,
        ...(op.sels ? { sels: op.sels } : {}),
        ...(op.value !== undefined ? { value: op.value } : {}),
        ...(op.fit ? { fit: op.fit } : {}),
        ...(op.before !== undefined
          ? { before: op.before }
          : same?.before !== undefined
            ? { before: same.before }
            : {}),
        scope,
        ...(group ? { group } : {}),
      };
      editor.updateStep(s.id, { html_ops: [...rest, next] as unknown as Json });
    }
  });
}

/**
 * L25-07 : style posé en masse, une seule ligne de modification (nouvelle opération à chaque
 * application). Portée « toutes » : même groupe sur chaque étape HTML.
 */
export function addStyleOp(
  editor: DemoEditor,
  step: StepRow,
  sels: string[],
  value: HtmlStyle,
  before: string,
  scope: 'step' | 'all',
) {
  const targets = scope === 'all' ? htmlSteps(editor) : [step];
  const group = scope === 'all' ? `g-${crypto.randomUUID().slice(0, 8)}` : undefined;
  editor.batch(() => {
    for (const s of targets) {
      const op: HtmlOp = {
        id: newOpId(),
        sel: sels[0]!,
        sels: sels.slice(0, STYLE_SELS_MAX),
        op: 'style',
        value,
        before: before.slice(0, 200),
        scope,
        ...(group ? { group } : {}),
      };
      editor.updateStep(s.id, { html_ops: [...asOps(s.html_ops), op] as unknown as Json });
    }
  });
}

/** Masquer et supprimer s'excluent ; le reste se cumule (texte + lien, par exemple). */
function conflicts(a: HtmlOp['op'], b: HtmlOp['op']) {
  return (
    (a === 'hide' && b === 'remove') ||
    (a === 'remove' && b === 'hide') ||
    // L28-05 : une image est remplacée ou masquée, pas les deux
    (a === 'image' && b === 'mask') ||
    (a === 'mask' && b === 'image')
  );
}

/** Retire une opération ; si elle appartient à un groupe, le groupe entier sur toutes les étapes. */
export function removeOp(editor: DemoEditor, step: StepRow, id: string) {
  const target = asOps(step.html_ops).find((o) => o.id === id);
  if (!target) return;
  const targets = target.group ? htmlSteps(editor) : [step];
  editor.batch(() => {
    for (const s of targets) {
      const ops = asOps(s.html_ops);
      const next = ops.filter((o) => (target.group ? o.group !== target.group : o.id !== id));
      if (next.length !== ops.length) editor.updateStep(s.id, { html_ops: next as unknown as Json });
    }
  });
}

/** Opération d'un type sur le sélecteur, s'il y en a une. */
export const opOn = (step: StepRow, sel: string, op: HtmlOp['op']) =>
  asOps(step.html_ops).find((o) => o.sel === sel && o.op === op);

/** Sélecteur lisible (fil court) pour la liste : « nav › span ». */
export function shortTrail(sel: string): string {
  const parts = sel
    .replace(/^body\s*>\s*/, '')
    .split(/\s*>\s*/)
    .map((p) => p.replace(/:nth-of-type\(\d+\)/g, ''));
  return parts.slice(-2).join(' › ');
}
