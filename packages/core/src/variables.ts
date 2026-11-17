/** Variables de personnalisation : {{company}}, {{first_name|ami}} (valeur par défaut après |). */
const VAR_RE = /\{\{\s*([a-z][a-z0-9_]{0,39})\s*(?:\|([^}]*))?\}\}/g;

export type VariableValues = Record<string, string | undefined>;

export function applyVariables(text: string, values: VariableValues, defaults: VariableValues = {}): string {
  return text.replace(VAR_RE, (_m, key: string, inlineDefault?: string) => {
    const v = values[key];
    if (v !== undefined && v !== '') return v;
    const d = defaults[key];
    if (d !== undefined && d !== '') return d;
    return (inlineDefault ?? '').trim();
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
