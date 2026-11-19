/**
 * L19-04 : modèle des segments et filtres (mêmes règles que public.segment_conditions_ok). Une
 * condition = critère, opérateur, valeur ; 8 au plus ; « toutes » (ET) ou « au moins une » (OU).
 */
export type Field =
  | 'device'
  | 'browser'
  | 'os'
  | 'lang'
  | 'country'
  | 'source'
  | 'demo'
  | 'completed'
  | 'lead'
  | 'cta'
  | 'steps'
  | 'referrer';
export type Op = 'is' | 'is_not' | 'gte' | 'lte' | 'contains' | 'not_contains';
export interface Condition {
  field: Field;
  op: Op;
  value: string | number | boolean;
}
export interface SegmentDef {
  match: 'all' | 'any';
  conditions: Condition[];
}

export const MAX_CONDITIONS = 8;
export const NAME_MAX = 60;
/** Sous ce nombre de visiteurs : chiffres agrégés seulement. */
export const MIN_VISITORS = 5;

type Kind = 'list' | 'bool' | 'number' | 'text' | 'code' | 'demo';
export const FIELDS: Record<
  Field,
  { group: 'visit' | 'device' | 'path' | 'actions'; kind: Kind; values?: string[] }
> = {
  source: { group: 'visit', kind: 'list', values: ['direct', 'embed', 'link'] },
  referrer: { group: 'visit', kind: 'text' },
  device: { group: 'device', kind: 'list', values: ['desktop', 'mobile', 'tablet'] },
  browser: {
    group: 'device',
    kind: 'list',
    values: ['chrome', 'edge', 'firefox', 'safari', 'opera', 'samsung', 'other'],
  },
  os: {
    group: 'device',
    kind: 'list',
    values: ['windows', 'macos', 'ios', 'android', 'linux', 'chromeos', 'other'],
  },
  lang: { group: 'device', kind: 'code' },
  country: { group: 'device', kind: 'code' },
  demo: { group: 'path', kind: 'demo' },
  steps: { group: 'path', kind: 'number' },
  completed: { group: 'path', kind: 'bool' },
  cta: { group: 'actions', kind: 'bool' },
  lead: { group: 'actions', kind: 'bool' },
};
export const FIELD_ORDER = Object.keys(FIELDS) as Field[];

export function opsFor(field: Field): Op[] {
  switch (FIELDS[field].kind) {
    case 'bool':
      return ['is'];
    case 'number':
      return ['gte', 'lte'];
    case 'text':
      return ['contains', 'not_contains'];
    default:
      return ['is', 'is_not'];
  }
}

/** Condition par défaut d'un critère (première valeur de la liste, « oui »…). */
export function defaultCondition(field: Field, demoId?: string): Condition {
  const f = FIELDS[field];
  const op = opsFor(field)[0]!;
  const value =
    f.kind === 'bool'
      ? true
      : f.kind === 'number'
        ? 1
        : f.kind === 'list'
          ? f.values![0]!
          : f.kind === 'demo'
            ? (demoId ?? '')
            : field === 'country'
              ? 'FR'
              : field === 'lang'
                ? 'fr'
                : '';
  return { field, op, value };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Valeur acceptée par la base pour ce critère ? */
export function conditionValid(c: Condition): boolean {
  const f = FIELDS[c.field];
  if (!f || !opsFor(c.field).includes(c.op)) return false;
  switch (f.kind) {
    case 'bool':
      return typeof c.value === 'boolean';
    case 'number':
      return typeof c.value === 'number' && Number.isInteger(c.value) && c.value >= 0 && c.value <= 999;
    case 'list':
      return typeof c.value === 'string' && f.values!.includes(c.value);
    case 'demo':
      return typeof c.value === 'string' && UUID.test(c.value);
    case 'text':
      return typeof c.value === 'string' && c.value.trim().length >= 1 && c.value.trim().length <= 100;
    case 'code':
      return typeof c.value === 'string' && (c.field === 'lang' ? /^[a-z]{2}$/ : /^[A-Z]{2}$/).test(c.value);
  }
}

export const defValid = (d: SegmentDef) =>
  d.conditions.length >= 1 && d.conditions.length <= MAX_CONDITIONS && d.conditions.every(conditionValid);

/** Filtres de la barre, gardés dans l'URL (?f=) : JSON compact, ignoré s'il est invalide. */
export function encodeDef(d: SegmentDef): string {
  return JSON.stringify({
    m: d.match === 'any' ? 'any' : undefined,
    c: d.conditions.map((c) => [c.field, c.op, c.value]),
  });
}
export function decodeDef(raw: string | null): SegmentDef | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as { m?: string; c?: unknown[] };
    const conditions = (Array.isArray(o.c) ? o.c : [])
      .filter((x): x is [Field, Op, string | number | boolean] => Array.isArray(x) && x.length === 3)
      .map(([field, op, value]) => ({ field, op, value }))
      .filter(conditionValid)
      .slice(0, MAX_CONDITIONS);
    return conditions.length ? { match: o.m === 'any' ? 'any' : 'all', conditions } : null;
  } catch {
    return null;
  }
}

/** Code pays ou langue saisi (« fr », « FR ») normalisé. */
export const normCode = (field: Field, v: string) =>
  field === 'country' ? v.trim().toUpperCase().slice(0, 2) : v.trim().toLowerCase().slice(0, 2);
