/** Variables de personnalisation : {{company}}, {{first_name|ami}} (valeur par défaut après |). */
const VAR_RE = /\{\{\s*([a-z][a-z0-9_]{0,39})\s*(?:\|([^}]*))?\}\}/g;

export type VariableValues = Record<string, string | undefined>;

/** Même motif, précédé de l'espace éventuelle (retirée si la variable est vide). */
const VAR_WITH_SPACE_RE = new RegExp(`([ \\u00a0\\u202f]?)${VAR_RE.source}`, 'g');

/**
 * Remplace les variables. Une variable sans valeur (ni valeur, ni défaut) disparaît avec l'espace
 * qui la précède : « Bienvenue {{first_name}} ! » → « Bienvenue ! », jamais « Bienvenue  ! » (PL3).
 */
export function applyVariables(
  text: string,
  values: VariableValues,
  defaults: VariableValues = {},
  /** L17 : bornes placées autour de chaque valeur insérée (glossaire : jamais souligné dedans). */
  wrap: [string, string] = ['', ''],
): string {
  return text.replace(VAR_WITH_SPACE_RE, (_m, space: string, key: string, inlineDefault?: string) => {
    const v = values[key]?.trim() || defaults[key]?.trim() || (inlineDefault ?? '').trim();
    return v ? space + wrap[0] + v + wrap[1] : '';
  });
}

/**
 * L46-bis : adresse d'un bouton d'action avec variables. Chaque valeur (ou repli) est encodée
 * (encodeURIComponent) ; sans valeur ni repli, le paramètre reste vide (?prenom=), le lien reste valide.
 */
export function applyUrlVariables(
  url: string,
  values: VariableValues,
  defaults: VariableValues = {},
): string {
  return url.replace(VAR_RE, (_m, key: string, inlineDefault?: string) =>
    encodeURIComponent(values[key]?.trim() || defaults[key]?.trim() || (inlineDefault ?? '').trim()),
  );
}

/**
 * L46-bis : valeurs saisies dans un formulaire du lecteur qui correspondent à une variable du visiteur
 * ou de l'entreprise (clé ou alias français). L'appelant ne les laisse jamais écraser l'adresse ni le
 * lien personnalisé ; rien n'est gardé après la session.
 */
export function variablesFromForm(fields: Record<string, string>): VariableValues {
  const out: VariableValues = {};
  for (const v of PREDEFINED_VARIABLES) {
    if (v.computed || v.emailOnly) continue;
    const value = (fields[v.key] ?? (v.alias ? fields[v.alias] : undefined))?.trim();
    if (value) out[v.key] = value.slice(0, 200);
  }
  return out;
}

export function extractVariableKeys(text: string): string[] {
  const keys = new Set<string>();
  for (const m of text.matchAll(VAR_RE)) if (m[1]) keys.add(m[1]);
  return [...keys];
}

/** L46 : groupes du catalogue des variables, dans l'ordre d'affichage. */
export type VariableGroup = 'visitor' | 'company' | 'demo' | 'date' | 'workspace';

export interface PredefinedVariable {
  key: string;
  group: Exclude<VariableGroup, 'workspace'>;
  /** Alias français accepté dans l'adresse (?prenom=Camille). */
  alias?: string;
  /** Calculée par le lecteur (toujours une valeur, jamais de repli). */
  computed?: boolean;
  /** Donnée personnelle : seulement dans les e-mails et les formulaires, jamais à l'écran. */
  emailOnly?: boolean;
}

/**
 * L46 : variables prédéfinies, disponibles dans toutes les démos sans les créer. Libellés,
 * descriptions, exemples et replis proposés : traductions de l'app (variables.builtin.<clé>).
 */
export const PREDEFINED_VARIABLES: readonly PredefinedVariable[] = [
  { key: 'first_name', group: 'visitor', alias: 'prenom' },
  { key: 'last_name', group: 'visitor', alias: 'nom' },
  { key: 'job_title', group: 'visitor', alias: 'fonction' },
  { key: 'email', group: 'visitor', emailOnly: true },
  { key: 'company', group: 'company', alias: 'entreprise' },
  { key: 'demo_title', group: 'demo', computed: true },
  { key: 'step_count', group: 'demo', computed: true },
  { key: 'today', group: 'date', computed: true },
];
export const PREDEFINED_KEYS = PREDEFINED_VARIABLES.map((v) => v.key);

/**
 * Lit les variables depuis une query string : ?company=Acme, ?v_company=Acme ou, pour les variables
 * prédéfinies, l'alias français (?entreprise=Acme). Les variables calculées ne se lisent jamais dans
 * l'adresse.
 */
export function variablesFromSearch(search: string, allowedKeys: string[]): VariableValues {
  const params = new URLSearchParams(search);
  const out: VariableValues = {};
  const keys = [...new Set([...allowedKeys, ...PREDEFINED_KEYS])];
  for (const key of keys) {
    const def = PREDEFINED_VARIABLES.find((p) => p.key === key);
    if (def?.computed) continue;
    const v = params.get(key) ?? params.get(`v_${key}`) ?? (def?.alias ? params.get(def.alias) : null);
    if (v !== null) out[key] = v.slice(0, 200);
  }
  return out;
}

/** L46 : valeurs calculées par le lecteur (titre de la démo, nombre d'étapes, date du jour). */
export function computedVariables(
  demo: { title: string; stepCount: number },
  locale: string,
  now: Date = new Date(),
): VariableValues {
  let today: string;
  try {
    today = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(now);
  } catch {
    today = now.toISOString().slice(0, 10);
  }
  return { demo_title: demo.title, step_count: String(demo.stepCount), today };
}

/**
 * L25-13 : titre d'une page personnalisée. Variables remplacées ; une variable vide est retirée avec
 * ses mots de liaison (« pour », « de », « chez », virgule…) ; titre vide : celui de la démo.
 */
export function personalTitle(tpl: string, values: VariableValues, fallback: string): string {
  const out = tpl
    .replace(
      /(\s*(?:,|·|-|—|:)?\s*(?:(?<!\p{L})(?:pour|de|d’|d'|du|chez|à|avec|for|at|with)(?!\p{L}))?\s*)\{\{\s*([a-z][a-z0-9_]{0,39})\s*\}\}/giu,
      (m, lead: string, key: string) => {
        const v = (values[key.toLowerCase()] ?? '').trim();
        return v ? `${lead}${v}` : '';
      },
    )
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,·:—-]+|[\s,·:—-]+$/g, '')
    .trim();
  return out || fallback;
}
