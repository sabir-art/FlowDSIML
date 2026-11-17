/** Variables de personnalisation : {{company}}, {{first_name|ami}} (valeur par défaut après |). */
const VAR_RE = /\{\{\s*([a-z][a-z0-9_]{0,39})\s*(?:\|([^}]*))?\}\}/g;

export type VariableValues = Record<string, string | undefined>;

/** Même motif, précédé de l'espace éventuelle (retirée si la variable est vide). */
const VAR_WITH_SPACE_RE = new RegExp(`([ \\u00a0\\u202f]?)${VAR_RE.source}`, 'g');

/**
 * Remplace les variables. Une variable sans valeur (ni valeur, ni défaut) disparaît avec l'espace
 * qui la précède : « Bienvenue {{first_name}} ! » → « Bienvenue ! », jamais « Bienvenue  ! » (PL3).
 */
export function applyVariables(text: string, values: VariableValues, defaults: VariableValues = {}): string {
  return text.replace(VAR_WITH_SPACE_RE, (_m, space: string, key: string, inlineDefault?: string) => {
    const v = values[key]?.trim();
    if (v) return space + v;
    const d = defaults[key]?.trim();
    if (d) return space + d;
    const inline = (inlineDefault ?? '').trim();
    return inline ? space + inline : '';
  });
}

export function extractVariableKeys(text: string): string[] {
  const keys = new Set<string>();
  for (const m of text.matchAll(VAR_RE)) if (m[1]) keys.add(m[1]);
  return [...keys];
}

/** Lit les variables depuis une query string : ?company=Acme ou ?v_company=Acme. */
export function variablesFromSearch(search: string, allowedKeys: string[]): VariableValues {
  const params = new URLSearchParams(search);
  const out: VariableValues = {};
  for (const key of allowedKeys) {
    const v = params.get(key) ?? params.get(`v_${key}`);
    if (v !== null) out[key] = v.slice(0, 200);
  }
  return out;
}
