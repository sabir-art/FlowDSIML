// L41 étape 4 (docs/tech/ia-fournisseurs.md §6, spec UX §4) : modèles proposés dans l'assistant et
// règles d'« Auto ». Fonctions pures : menu de l'éditeur, choix d'Auto, repli, contrôle d'un modèle
// demandé. Un modèle d'un fournisseur sans clé, retiré ou sans la capacité « text » n'est jamais proposé.
import { isRetired, modelById, type Provider } from './catalogue.ts';

export type Tag = 'none' | 'recommended' | 'beta';
export interface AssistantRow {
  model: string;
  position: number;
  proposed: boolean;
  tag: Tag;
}
export type AutoRule = 'short' | 'whole_demo' | 'fallback';
export type AutoRules = Record<AutoRule, string>;

export const DEFAULT_RULES: AutoRules = {
  short: 'claude-sonnet-5-5',
  whole_demo: 'claude-sonnet-5-5',
  fallback: 'next',
};

/** Modèle de texte du catalogue, non retiré, dont le fournisseur a une clé. */
export function usable(id: string, keys: ReadonlySet<Provider>, today?: string): boolean {
  const m = modelById(id);
  return !!m && m.capabilities.includes('text') && !isRetired(m, today) && keys.has(m.provider);
}

/** Menu de l'assistant : modèles proposés et utilisables, dans l'ordre, avec leur étiquette. */
export function menuOf(rows: AssistantRow[], keys: ReadonlySet<Provider>, today?: string) {
  return [...rows]
    .sort((a, b) => a.position - b.position)
    .filter((r) => r.proposed && usable(r.model, keys, today))
    .map((r) => {
      const m = modelById(r.model)!;
      return { id: r.model, label: m.label, tag: r.tag, speed: m.speed, cost: m.cost };
    });
}

/**
 * Demande « courte » (une étape, un texte) ou « analyse de toute la démo » : la demande porte sur
 * l'ensemble (mots-clés) ou elle est longue.
 */
const WHOLE =
  /(toute la d[ée]mo|toutes les [ée]tapes|ensemble de la d[ée]mo|coh[ée]rence|relis|analys|r[ée]sum|tradui|traduction|whole demo|entire demo|all (the )?steps|consisten|review|analy[sz]|summar|translat)/i;
export function kindOf(message: string): 'short' | 'whole_demo' {
  return message.length > 400 || WHOLE.test(message) ? 'whole_demo' : 'short';
}

/**
 * Remplaçant d'un modèle de règle qui n'est plus proposé (décision du chef, recette UX L41 étape 4) : le
 * premier modèle Recommandé du menu, sinon le premier du menu ; jamais un Bêta si un Recommandé existe.
 */
export function replacementOf(menu: Array<{ id: string; tag?: Tag }>, except?: string): string | null {
  const xs = menu.filter((m) => m.id !== except);
  return (xs.find((m) => m.tag === 'recommended') ?? xs[0])?.id ?? null;
}

/** Modèle choisi par Auto : la règle de la situation, sinon le remplaçant. */
export function autoPick(
  rules: AutoRules,
  menu: Array<{ id: string; tag?: Tag }>,
  message: string,
): string | null {
  const want = rules[kindOf(message)];
  if (menu.some((m) => m.id === want)) return want;
  return replacementOf(menu);
}

/** Repli après un échec (indisponible, surcharge) : la règle, ou « le suivant de la liste ». */
export function fallbackOf(
  rules: AutoRules,
  menu: Array<{ id: string; tag?: Tag }>,
  current: string,
): string | null {
  if (rules.fallback !== 'next') {
    if (rules.fallback === current) return null;
    // Modèle de repli qui n'est plus proposé : le remplaçant, comme pour les autres règles
    return menu.some((m) => m.id === rules.fallback) ? rules.fallback : replacementOf(menu, current);
  }
  const i = menu.findIndex((m) => m.id === current);
  return menu[i + 1]?.id ?? (i > 0 ? menu[0]!.id : null);
}

/**
 * L41 étape 5 (spec UX §5) : modèles gardés par l'espace (workspaces.settings.ai.models). Absent : tous
 * les modèles proposés. L'espace ne peut que retirer : un modèle hors du menu de la Console est ignoré.
 */
export function workspaceMenu<T extends { id: string }>(menu: T[], chosen: unknown): T[] {
  if (!Array.isArray(chosen)) return menu;
  const keep = new Set(chosen.filter((x): x is string => typeof x === 'string'));
  return menu.filter((m) => keep.has(m.id));
}

/** Menu dans lequel Auto choisit : celui de l'espace ; s'il est vide, Auto prend le relais sur la Console. */
export const autoMenuOf = <T>(ws: T[], all: T[]): T[] => (ws.length ? ws : all);

/** Anciens choix de l'éditeur (« sonnet », « opus ») : le modèle du catalogue correspondant. */
export const LEGACY: Record<string, string> = { sonnet: 'claude-sonnet-5-5', opus: 'claude-opus-5-5' };

/** Modèle demandé par le navigateur : « auto », ou un modèle du menu ; sinon refusé (403 MODEL). */
export function requested(
  asked: string,
  menu: Array<{ id: string }>,
): { auto: true } | { auto: false; model: string } | null {
  if (!asked || asked === 'auto') return { auto: true };
  const id = LEGACY[asked] ?? asked;
  return menu.some((m) => m.id === id) ? { auto: false, model: id } : null;
}
