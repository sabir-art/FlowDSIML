// L41 étape 2 (docs/tech/ia-fournisseurs.md §4, spec UX l41-console-modeles-ia §2) : actions de la
// Console sur les fournisseurs, servies par l'Edge Function `ai`. Rôles vérifiés par la base
// (is_platform_owner pour lire, is_platform_admin pour écrire). Une clé collée part une seule fois, est
// testée, et n'est enregistrée qu'en cas de succès ; aucune réponse ne contient de clé.
import { CATALOGUE, PROVIDERS, isRetired, labelOf, publicCatalogue, type Provider } from './catalogue.ts';
import { forgetKey, providerKey, type VaultRead } from './keys.ts';
import { FUNCTIONS, changeLabel, choicesFor, cutFeatures, resolve, type Fn } from './functions.ts';
import { DEFAULT_RULES, menuOf, type AssistantRow, type AutoRule, type AutoRules } from './assistant.ts';
import type { KeyTest } from './providers/anthropic.ts';

export interface ProviderRow {
  provider: Provider;
  added_at: string | null;
  last_test_at: string | null;
  last_test_ok: boolean | null;
  last_test_error: string | null;
  last_test_ms: number | null;
}

export interface ProviderState {
  provider: Provider;
  label: string;
  /** connected : clé présente et dernier test non refusé ; refused : dernier test refusé ; missing. */
  state: 'connected' | 'refused' | 'missing';
  /** vault : enregistrée depuis la Console ; env : définie au déploiement (« Clé définie au déploiement »). */
  source: 'vault' | 'env' | null;
  addedAt: string | null;
  lastTest: { at: string; ok: boolean; cause: string | null; ms: number | null } | null;
}

/** État de chaque fournisseur du catalogue, sans aucune clé. */
export function providerStates(
  rows: ProviderRow[],
  has: Record<Provider, 'vault' | 'env' | null>,
): ProviderState[] {
  return PROVIDERS.map(({ id, label }) => {
    const r = rows.find((x) => x.provider === id);
    const source = has[id];
    const lastTest = r?.last_test_at
      ? { at: r.last_test_at, ok: !!r.last_test_ok, cause: r.last_test_error, ms: r.last_test_ms }
      : null;
    return {
      provider: id,
      label,
      state: !source ? 'missing' : lastTest && !lastTest.ok ? 'refused' : 'connected',
      source,
      addedAt: source === 'vault' ? (r?.added_at ?? null) : null,
      lastTest,
    };
  });
}

/** Forme d'une clé collée : 10 à 500 caractères, sans espace (rien d'autre n'est jugé ici). */
export const keyShapeOk = (k: unknown): k is string =>
  typeof k === 'string' && k.length >= 10 && k.length <= 500 && !/\s/.test(k);

const isProvider = (p: unknown): p is Provider => PROVIDERS.some((x) => x.id === p);

export interface ConsoleDeps {
  /** Compte de la Console (null : pas un compte de la plateforme). */
  role: () => Promise<{ uid: string; admin: boolean } | null>;
  vault: VaultRead;
  rows: () => Promise<ProviderRow[]>;
  save: (provider: Provider, key: string, uid: string, ms: number) => Promise<{ replaced: boolean }>;
  tested: (provider: Provider, r: KeyTest, uid: string) => Promise<void>;
  test: (provider: Provider, key: string) => Promise<KeyTest>;
  env?: (n: string) => string | undefined;
  /** L41 étape 3 : modèles choisis par fonction (ai_function_models). */
  fnModels: () => Promise<Partial<Record<Fn, string>>>;
  /** label : libellé lisible du journal (« Traduction · Claude Sonnet (défaut) → Claude Opus »). */
  setModel: (fn: Fn, model: string | null, uid: string, label: string) => Promise<{ old: string | null }>;
  /** Fonctions de l'espace coupées (ai_cut), tenues à jour à chaque lecture. */
  setCut: (features: string[]) => Promise<void>;
  /** L41 étape 4 : liste de l'assistant et règles d'Auto. */
  assistantRows?: () => Promise<AssistantRow[]>;
  autoRules?: () => Promise<Partial<AutoRules>>;
  setAssistant?: (rows: AssistantRow[], uid: string, label: string) => Promise<void>;
  setRule?: (rule: AutoRule, model: string, uid: string, label: string) => Promise<{ old: string | null }>;
}

/** Modèles de texte du catalogue, non retirés : ceux que la liste de l'assistant peut contenir. */
const textModels = () => CATALOGUE.filter((m) => m.capabilities.includes('text') && !isRetired(m));

/** Liste de l'assistant pour la Console : tous les modèles de texte, dans l'ordre enregistré. */
async function assistantState(d: ConsoleDeps) {
  const keys = await keysOf(d);
  const rows = (await d.assistantRows?.()) ?? [];
  const rules = { ...DEFAULT_RULES, ...((await d.autoRules?.()) ?? {}) };
  // Un modèle du catalogue absent de la table arrive en fin de liste, non proposé
  const known = new Set(rows.map((r) => r.model));
  const max = Math.max(0, ...rows.map((r) => r.position));
  const all = [
    ...rows.filter((r) => textModels().some((m) => m.id === r.model)),
    ...textModels()
      .filter((m) => !known.has(m.id))
      .map((m, i) => ({ model: m.id, position: max + 1 + i, proposed: false, tag: 'none' as const })),
  ].sort((a, b) => a.position - b.position);
  return {
    models: all.map((r) => {
      const m = textModels().find((x) => x.id === r.model)!;
      return { ...r, label: m.label, provider: m.provider, available: keys.has(m.provider) };
    }),
    rules,
    menu: menuOf(all, keys),
  };
}

const TAG_LABEL = { none: 'sans étiquette', recommended: 'étiquette Recommandé', beta: 'étiquette Bêta' };

/**
 * Journal (recette UX L41 étape 4) : ce qui change, pas la seule liste. « Claude Haiku : proposé ;
 * Claude Haiku : étiquette Bêta », « Ordre : Claude Opus, Claude Sonnet ».
 */
export function assistantChange(before: AssistantRow[], after: AssistantRow[]): string {
  const old = new Map(before.map((r) => [r.model, r]));
  const parts: string[] = [];
  for (const r of after) {
    const o = old.get(r.model);
    const was = o?.proposed ?? false;
    if (r.proposed !== was) parts.push(`${labelOf(r.model)} : ${r.proposed ? 'proposé' : 'retiré'}`);
    if (r.tag !== (o?.tag ?? 'none')) parts.push(`${labelOf(r.model)} : ${TAG_LABEL[r.tag]}`);
  }
  // Ordre des modèles restés proposés
  const order = (xs: AssistantRow[]) =>
    [...xs]
      .sort((a, b) => a.position - b.position)
      .filter((r) => r.proposed)
      .map((r) => r.model);
  const kept = new Set(order(before).filter((m) => order(after).includes(m)));
  const a = order(before).filter((m) => kept.has(m));
  const b = order(after).filter((m) => kept.has(m));
  if (a.join() !== b.join()) parts.push(`Ordre : ${order(after).map(labelOf).join(', ')}`);
  return `Liste de l’assistant · ${parts.length ? parts.join(' ; ') : 'aucun changement'}`;
}

const RULE_LABEL: Record<AutoRule, string> = {
  short: 'demandes courtes',
  whole_demo: 'analyse de toute la démo',
  fallback: 'modèle indisponible',
};
const ruleModel = (m: string) => (m === 'next' ? 'le suivant de la liste' : labelOf(m) || m);

/** Fournisseurs qui ont une clé (coffre ou déploiement). */
async function keysOf(d: ConsoleDeps): Promise<Set<Provider>> {
  const out = new Set<Provider>();
  for (const { id } of PROVIDERS)
    if (await providerKey(id, d.vault, { env: d.env, fresh: true })) out.add(id);
  return out;
}

/** État de chaque fonction : choix, modèle utilisé, état, modèles proposables. */
async function functionStates(d: ConsoleDeps) {
  const keys = await keysOf(d);
  const chosen = await d.fnModels();
  const rs = FUNCTIONS.map((def) => ({ def, r: resolve(def, chosen[def.fn], keys) }));
  await d.setCut(cutFeatures(rs.map((x) => x.r)));
  return rs.map(({ def, r }) => ({ ...r, capability: def.capability, choices: choicesFor(def, keys) }));
}

export type ConsoleReply = { status: number; body: Record<string, unknown> };

export const CONSOLE_ACTIONS = [
  'console_catalog',
  'console_providers',
  'console_key_test',
  'console_key_save',
  'console_functions',
  'console_set_model',
  'console_assistant',
  'console_assistant_set',
  'console_auto_rule_set',
];

export async function consoleAction(body: Record<string, unknown>, d: ConsoleDeps): Promise<ConsoleReply> {
  const who = await d.role();
  // Hors de la plateforme : comme une adresse inconnue
  if (!who) return { status: 404, body: { error: 'NOT_FOUND' } };
  const action = body.action;
  if (action === 'console_catalog') return { status: 200, body: { result: publicCatalogue() } };
  if (action === 'console_providers') {
    const has = {} as Record<Provider, 'vault' | 'env' | null>;
    for (const { id } of PROVIDERS) {
      const k = await providerKey(id, d.vault, { env: d.env, fresh: true });
      has[id] = k?.source ?? null;
    }
    return { status: 200, body: { result: providerStates(await d.rows(), has) } };
  }
  if (action === 'console_functions') return { status: 200, body: { result: await functionStates(d) } };
  if (action === 'console_assistant') return { status: 200, body: { result: await assistantState(d) } };
  const writes = [
    'console_key_test',
    'console_key_save',
    'console_set_model',
    'console_assistant_set',
    'console_auto_rule_set',
  ];
  if (!writes.includes(String(action))) return { status: 400, body: { error: 'BAD_REQUEST' } };
  if (!who.admin) return { status: 403, body: { error: 'READ_ONLY' } };
  if (action === 'console_assistant_set') {
    const list = body.models;
    const ids = new Set(textModels().map((m) => m.id));
    if (
      !Array.isArray(list) ||
      !list.length ||
      list.length > 50 ||
      !list.every(
        (r) =>
          r &&
          typeof r === 'object' &&
          ids.has((r as AssistantRow).model) &&
          typeof (r as AssistantRow).proposed === 'boolean' &&
          ['none', 'recommended', 'beta'].includes((r as AssistantRow).tag),
      )
    )
      return { status: 400, body: { error: 'BAD_LIST' } };
    const rows = (list as AssistantRow[]).map((r, i) => ({
      model: r.model,
      position: i + 1,
      proposed: r.proposed,
      tag: r.tag,
    }));
    // « Gardez au moins un modèle. »
    if (!rows.some((r) => r.proposed)) return { status: 409, body: { error: 'LAST_MODEL' } };
    const label = assistantChange((await d.assistantRows?.()) ?? [], rows);
    await d.setAssistant?.(rows, who.uid, label);
    return { status: 200, body: { result: await assistantState(d) } };
  }
  if (action === 'console_auto_rule_set') {
    const rule = body.rule as AutoRule;
    if (!(rule in RULE_LABEL)) return { status: 400, body: { error: 'BAD_RULE' } };
    const model = String(body.model ?? '');
    const okModel = textModels().some((m) => m.id === model) || (rule === 'fallback' && model === 'next');
    if (!okModel) return { status: 400, body: { error: 'BAD_MODEL' } };
    const before = { ...DEFAULT_RULES, ...((await d.autoRules?.()) ?? {}) }[rule];
    const label = `Auto · ${RULE_LABEL[rule]} · ${ruleModel(before)} → ${ruleModel(model)}`;
    const { old } = (await d.setRule?.(rule, model, who.uid, label)) ?? { old: null };
    return { status: 200, body: { result: { old: old ?? before, ...(await assistantState(d)) } } };
  }
  if (action === 'console_set_model') {
    const def = FUNCTIONS.find((f) => f.fn === body.fn);
    if (!def) return { status: 400, body: { error: 'BAD_FUNCTION' } };
    const model = body.model === null || body.model === def.defaultModel ? null : body.model;
    // Seulement un modèle du catalogue qui sait faire la fonction
    const allowed = choicesFor(def, new Set(PROVIDERS.map((p) => p.id))).map((c) => c.id);
    if (model !== null && (typeof model !== 'string' || !allowed.includes(model)))
      return { status: 400, body: { error: 'BAD_MODEL' } };
    const before = (await d.fnModels())[def.fn] ?? null;
    const { old } = await d.setModel(def.fn, model, who.uid, changeLabel(def, before, model));
    return { status: 200, body: { result: { old, functions: await functionStates(d) } } };
  }
  const provider = body.provider;
  if (!isProvider(provider)) return { status: 400, body: { error: 'BAD_PROVIDER' } };

  if (action === 'console_key_test') {
    const k = await providerKey(provider, d.vault, { env: d.env, fresh: true });
    if (!k) return { status: 409, body: { error: 'MISSING' } };
    const r = await d.test(provider, k.key);
    await d.tested(provider, r, who.uid);
    return {
      status: 200,
      body: {
        result: r.ok ? { ok: true, ms: r.ms } : { ok: false, ms: r.ms, cause: r.cause, status: r.status },
      },
    };
  }

  // Tester et enregistrer : rien n'est gardé si le test échoue
  const key = body.key;
  if (!keyShapeOk(key)) return { status: 400, body: { error: 'BAD_KEY' } };
  const r = await d.test(provider, key);
  if (!r.ok) return { status: 422, body: { error: 'KEY_TEST', cause: r.cause, status: r.status, ms: r.ms } };
  try {
    const saved = await d.save(provider, key, who.uid, r.ms);
    forgetKey(provider);
    return { status: 200, body: { result: { ok: true, ms: r.ms, replaced: saved.replaced } } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    return msg.includes('NO_VAULT')
      ? { status: 503, body: { error: 'NO_VAULT' } }
      : { status: 500, body: { error: 'SERVER' } };
  }
}
