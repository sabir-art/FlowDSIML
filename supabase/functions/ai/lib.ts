// Logique pure de l'Edge Function « ai » (L30) : validation des demandes, masquage des données
// personnelles, consignes et schémas de sortie. Aucun accès réseau ici (testé par lib_test.ts).

/** Fonction activable (settings.ai.features) → tâches qu'elle couvre. */
export const FEATURE_OF = {
  write: 'write',
  write_all: 'write',
  translate: 'translate',
  suggest: 'suggest',
  generate: 'generate',
  dataset: 'dataset',
  chart: 'chart',
  assistant: 'assistant',
} as const;
export type Task = keyof typeof FEATURE_OF;

export const SONNET = 'claude-sonnet-5-5';
export const HAIKU = 'claude-haiku-5-5';

export const LANGS: Record<string, string> = {
  fr: 'français',
  en: 'anglais',
  es: 'espagnol',
  de: 'allemand',
  it: 'italien',
  pt: 'portugais',
  nl: 'néerlandais',
  ar: 'arabe',
};

export const WRITE_ACTIONS = ['simplify', 'shorten', 'spelling', 'from_title', 'tone'] as const;
export const TONES = ['neutral', 'warm', 'formal'] as const;

export class AiError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}

// ---------------------------------------------------------------------------
// Données personnelles : copie du détecteur de packages/core/src/pii.ts (les Edge Functions
// n'importent pas les paquets du monorepo). Chaque correspondance est remplacée par un repère
// [type] AVANT l'envoi : le fournisseur ne reçoit jamais la valeur.
// ---------------------------------------------------------------------------
const NIR =
  /\b[12][ .]?\d{2}[ .]?(?:0[1-9]|1[0-2]|[2-9]\d)[ .]?(?:\d{2}|2[AB])[ .]?\d{3}[ .]?\d{3}(?:[ .]?\d{2})?\b/g;
const PHONE = /(?:\+33[ .-]?|\b0)[1-9](?:[ .-]?\d{2}){4}\b/g;
const EMAIL = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g;
const IBAN = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}(?:[ ]?[A-Z0-9]{1,3})?\b/g;
const STREET =
  /\b\d{1,4}(?:[ ]?(?:bis|ter))?,?[ ]+(?:rue|avenue|av\.|bd|boulevard|chemin|allée|impasse|place|route|quai|cours|square|résidence|lotissement)\b[^\n,;]{2,60}/gi;
const POSTCODE_CITY = /\b(?:0[1-9]|[1-8]\d|9[0-8])\d{3}[ ]+[A-ZÉÈ][A-Za-zÀ-ÿ'’ -]{1,40}\b/g;
const DATE = /\b(?:0?[1-9]|[12]\d|3[01])[/.-](?:0?[1-9]|1[0-2])[/.-](?:19|20)\d{2}\b/g;
const FIRST_LAST = /\b[A-ZÉÈ][a-zà-ÿ]+(?:-[A-ZÉÈ][a-zà-ÿ]+)?[ ]+[A-ZÉÈ]{2,}(?:[- ][A-ZÉÈ]{2,})*\b/g;

const RULES: Array<[RegExp, string, ((m: RegExpExecArray) => boolean)?]> = [
  [EMAIL, 'email'],
  [IBAN, 'iban', (m) => /\d{6,}/.test(m[0].replace(/\s/g, ''))],
  [NIR, 'nir', (m) => m[0].replace(/[ .]/g, '').length >= 13],
  [PHONE, 'telephone'],
  [STREET, 'adresse'],
  [POSTCODE_CITY, 'adresse'],
  [DATE, 'date'],
  [FIRST_LAST, 'nom'],
];

/** Remplace les données personnelles détectées ; renvoie le texte et le nombre de remplacements. */
export function redact(text: string): { text: string; count: number } {
  const hits: Array<{ start: number; end: number; type: string }> = [];
  for (const [re, type, check] of RULES) {
    re.lastIndex = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      const start = m.index;
      const end = start + m[0].length;
      if (check && !check(m)) continue;
      if (hits.some((h) => start < h.end && end > h.start)) continue;
      hits.push({ start, end, type });
    }
  }
  hits.sort((a, b) => b.start - a.start);
  let out = text;
  for (const h of hits) out = `${out.slice(0, h.start)}[${h.type}]${out.slice(h.end)}`;
  return { text: out, count: hits.length };
}

/**
 * Valeur générée qui ressemble à une donnée réelle (garde-fou L25 du jeu de données fictif) :
 * NIR, IBAN, e-mail hors .example, téléphone hors de la plage fictive 01 99 00.
 */
export function looksReal(v: string): boolean {
  const t = (re: RegExp) => {
    re.lastIndex = 0;
    return re.test(v);
  };
  if (t(NIR) && v.replace(/[ .]/g, '').length >= 13) return true;
  if (t(IBAN) && /\d{6,}/.test(v.replace(/\s/g, ''))) return true;
  EMAIL.lastIndex = 0;
  for (let m = EMAIL.exec(v); m; m = EMAIL.exec(v)) if (!/\.example$/i.test(m[0])) return true;
  PHONE.lastIndex = 0;
  for (let m = PHONE.exec(v); m; m = PHONE.exec(v))
    if (!/^0?1[ .-]?99[ .-]?00/.test(m[0].replace(/^\+33[ .-]?/, '0'))) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Validation des entrées (tailles bornées : le coût est maîtrisé avant l'appel)
// ---------------------------------------------------------------------------
const str = (v: unknown, max: number, field: string, required = true): string => {
  if (v === undefined || v === null || v === '') {
    if (required) throw new AiError(`MISSING_${field}`);
    return '';
  }
  if (typeof v !== 'string') throw new AiError(`BAD_${field}`);
  if (v.length > max) throw new AiError(`TOO_LONG_${field}`);
  return v;
};
const lang = (v: unknown): string => {
  const l = typeof v === 'string' ? v.slice(0, 2).toLowerCase() : 'fr';
  return LANGS[l] ? l : 'fr';
};

export interface Item {
  id: string;
  text: string;
}
const items = (v: unknown, max: number, each: number): Item[] => {
  if (!Array.isArray(v) || v.length === 0) throw new AiError('MISSING_ITEMS');
  if (v.length > max) throw new AiError('TOO_MANY_ITEMS');
  return v.map((x, i) => {
    const o = (x ?? {}) as Record<string, unknown>;
    return { id: str(o.id, 64, 'ID'), text: str(o.text, each, `ITEM_${i}`, false) };
  });
};

export interface Request {
  task: Task;
  lang: string;
  /** Contenu déjà masqué, prêt à envoyer. */
  payload: Record<string, unknown>;
  redacted: number;
}

/** Valide la demande et masque tous les textes libres. */
export function parseRequest(body: Record<string, unknown>): Request {
  const task = body.task as Task;
  if (!(task in FEATURE_OF)) throw new AiError('BAD_TASK');
  const l = lang(body.lang);
  const input = (body.input ?? {}) as Record<string, unknown>;
  let redacted = 0;
  const r = (s: string) => {
    const x = redact(s);
    redacted += x.count;
    return x.text;
  };
  const ri = (list: Item[]) => list.map((i) => ({ id: i.id, text: r(i.text) }));
  let payload: Record<string, unknown>;
  switch (task) {
    case 'write': {
      const action = input.action as string;
      if (!WRITE_ACTIONS.includes(action as (typeof WRITE_ACTIONS)[number])) throw new AiError('BAD_ACTION');
      const tone = action === 'tone' ? (input.tone as string) : undefined;
      if (action === 'tone' && !TONES.includes(tone as (typeof TONES)[number])) throw new AiError('BAD_TONE');
      const text = str(input.text, 2000, 'TEXT', action !== 'from_title');
      const title = str(input.title, 200, 'TITLE', action === 'from_title');
      payload = { action, tone, text: r(text), title: r(title), seed: Number(input.variant ?? 0) | 0 };
      break;
    }
    case 'write_all':
      payload = { items: ri(items(input.items, 100, 2000)) };
      break;
    case 'translate': {
      const target = lang(input.target);
      if (!input.target || target === l) throw new AiError('BAD_TARGET');
      const glossary = Array.isArray(input.glossary) ? input.glossary.slice(0, 100) : [];
      payload = {
        target,
        items: ri(items(input.items, 200, 2000)),
        glossary: glossary.map((g) => {
          const o = (g ?? {}) as Record<string, unknown>;
          return {
            term: str(o.term, 80, 'TERM'),
            translation: str(o.translation, 80, 'TERM', false) || null,
          };
        }),
      };
      break;
    }
    case 'suggest':
      payload = { items: ri(items(input.items, 100, 2000)) };
      break;
    case 'generate': {
      const plan = str(input.plan, 4000, 'PLAN');
      payload = { plan: r(plan) };
      break;
    }
    case 'dataset': {
      const rows = Number(input.rows);
      if (![10, 20, 50].includes(rows)) throw new AiError('BAD_ROWS');
      if (!Array.isArray(input.columns) || input.columns.length === 0 || input.columns.length > 20)
        throw new AiError('BAD_COLUMNS');
      const columns = input.columns.map((c) => str(c, 60, 'COLUMN'));
      payload = { rows, columns, context: r(str(input.context, 500, 'CONTEXT', false)) };
      break;
    }
    case 'chart':
      payload = { description: r(str(input.description, 1000, 'DESCRIPTION')) };
      break;
    case 'assistant': {
      const msgs = Array.isArray(input.messages) ? input.messages.slice(-20) : [];
      if (msgs.length === 0) throw new AiError('MISSING_MESSAGES');
      payload = {
        context: r(str(input.context, 6000, 'CONTEXT', false)),
        messages: msgs.map((m) => {
          const o = (m ?? {}) as Record<string, unknown>;
          const role = o.role === 'assistant' ? 'assistant' : 'user';
          return { role, text: r(str(o.text, 2000, 'MESSAGE')) };
        }),
      };
      if ((payload.messages as Array<{ role: string }>).at(-1)!.role !== 'user')
        throw new AiError('BAD_MESSAGES');
      break;
    }
  }
  return { task, lang: l, payload, redacted };
}

// ---------------------------------------------------------------------------
// Consignes et schémas de sortie
// ---------------------------------------------------------------------------
const BASE =
  'Tu aides à rédiger des démonstrations interactives de logiciels (tutoriels pas à pas) dans TutoClick. ' +
  "Les textes entre crochets comme [email] ou [nom] remplacent des données personnelles masquées : garde-les tels quels, n'invente jamais de valeur à leur place. " +
  "Garde à l'identique les variables entre doubles accolades, par exemple {{prenom}}. " +
  "N'invente aucune fonctionnalité du logiciel qui n'apparaît pas dans le texte fourni.";

const obj = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const S = { type: 'string' };
const ITEMS = { type: 'array', items: obj({ id: S, text: S }) };

const ACTION_TEXT: Record<string, string> = {
  simplify: 'Reformule ce texte plus simplement, avec des phrases courtes et des mots courants.',
  shorten: 'Raccourcis ce texte en gardant les informations utiles à la personne qui suit le tutoriel.',
  spelling: "Corrige l'orthographe, la grammaire et la ponctuation sans changer le sens ni le ton.",
  from_title:
    "Rédige le texte d'une bulle d'étape (une à deux phrases, à l'impératif) à partir de son titre.",
  tone: 'Réécris ce texte avec le ton demandé, sans changer les informations.',
};
const TONE_TEXT: Record<string, string> = {
  neutral: 'neutre et factuel',
  warm: 'chaleureux et encourageant',
  formal: 'formel (vouvoiement)',
};

export interface Prompt {
  model: string;
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  schema: Record<string, unknown> | null;
  maxTokens: number;
}

export function buildPrompt(req: Request): Prompt {
  const p = req.payload as Record<string, any>;
  const inLang = `Réponds en ${LANGS[req.lang]}.`;
  const user = (content: unknown) => [
    { role: 'user' as const, content: typeof content === 'string' ? content : JSON.stringify(content) },
  ];
  switch (req.task) {
    case 'write': {
      let ask = ACTION_TEXT[p.action]!;
      if (p.action === 'tone') ask += ` Ton : ${TONE_TEXT[p.tone]}.`;
      if (p.seed > 0) ask += ' Propose une formulation différente des précédentes.';
      const content =
        p.action === 'from_title'
          ? `Titre : ${p.title}`
          : `Titre de l'étape : ${p.title || '(aucun)'}\nTexte : ${p.text}`;
      return {
        model: HAIKU,
        system: `${BASE} ${ask} ${inLang} Renvoie seulement la proposition.`,
        messages: user(content),
        schema: obj({ text: S }),
        maxTokens: 1500,
      };
    }
    case 'write_all':
      return {
        model: HAIKU,
        system: `${BASE} ${ACTION_TEXT.spelling} Traite chaque élément séparément et garde son id. Ne renvoie que les éléments modifiés.`,
        messages: user({ items: p.items }),
        schema: obj({ items: ITEMS }),
        maxTokens: 16000,
      };
    case 'translate': {
      const gl = (p.glossary as Array<{ term: string; translation: string | null }>)
        .map((g) =>
          g.translation ? `« ${g.term} » → « ${g.translation} »` : `« ${g.term} » : ne pas traduire`,
        )
        .join(' ; ');
      return {
        model: SONNET,
        system: `${BASE} Traduis chaque élément du ${LANGS[req.lang]} vers le ${LANGS[p.target]}, en gardant son id, le registre et la mise en forme. ${gl ? `Glossaire à respecter : ${gl}.` : ''}`,
        messages: user({ items: p.items }),
        schema: obj({ items: ITEMS }),
        maxTokens: 32000,
      };
    }
    case 'suggest':
      return {
        model: SONNET,
        system:
          `${BASE} Relis les étapes (titre et texte) et propose au plus 10 améliorations utiles, les plus importantes d'abord. ` +
          'Types : clarity (phrase ambiguë ou trop complexe), length (texte trop long pour une bulle), accessibility (consigne qui dépend de la couleur ou de la position seule, lien peu explicite), consistency (même action nommée différemment). ' +
          `message : constat en une phrase. proposal : texte de remplacement complet de l'étape, ou chaîne vide. ${inLang}`,
        messages: user({ items: p.items }),
        schema: obj({
          suggestions: {
            type: 'array',
            items: obj({
              id: S,
              type: { type: 'string', enum: ['clarity', 'length', 'accessibility', 'consistency'] },
              message: S,
              proposal: S,
            }),
          },
        }),
        maxTokens: 6000,
      };
    case 'generate':
      return {
        model: SONNET,
        system:
          `${BASE} À partir du plan fourni, propose une démo : un titre court et 3 à 30 étapes. ` +
          "Chaque étape a un titre (5 mots au plus, à l'impératif) et un texte de bulle (une à deux phrases). " +
          `N'invente pas d'écran qui n'est pas décrit dans le plan. ${inLang}`,
        messages: user(p.plan),
        schema: obj({ title: S, steps: { type: 'array', items: obj({ title: S, text: S }) } }),
        maxTokens: 8000,
      };
    case 'dataset':
      return {
        model: HAIKU,
        system:
          `Tu génères des jeux de données entièrement fictifs pour des démonstrations de logiciels. ` +
          'Aucune personne réelle : noms inventés et variés, e-mails sur des domaines en .example, téléphones au format 01 99 00 xx xx, aucun numéro de sécurité sociale ni IBAN réaliste. ' +
          `Exactement ${p.rows} lignes, une valeur par colonne dans l'ordre des colonnes. ${inLang}`,
        messages: user({ columns: p.columns, context: p.context }),
        schema: obj({ rows: { type: 'array', items: { type: 'array', items: S } } }),
        maxTokens: 12000,
      };
    case 'chart':
      return {
        model: HAIKU,
        system:
          `Tu proposes un graphique simple à partir d'une description, avec des valeurs fictives et plausibles si elles ne sont pas données. ` +
          `type : bar, line ou pie. 2 à 12 libellés, 1 à 4 séries de même longueur que les libellés. ${inLang}`,
        messages: user(p.description),
        schema: obj({
          type: { type: 'string', enum: ['bar', 'line', 'pie'] },
          title: S,
          labels: { type: 'array', items: S },
          series: {
            type: 'array',
            items: obj({ name: S, values: { type: 'array', items: { type: 'number' } } }),
          },
        }),
        maxTokens: 3000,
      };
    case 'assistant':
      return {
        model: SONNET,
        system:
          `${BASE} Tu es l'assistant de l'éditeur de démos. Réponds de façon brève et concrète sur la démo en cours et sur l'usage de TutoClick. ` +
          `Tu ne modifies rien toi-même : propose, la personne applique. ${inLang}` +
          (p.context ? `\n\nDémo en cours :\n${p.context}` : ''),
        messages: (p.messages as Array<{ role: 'user' | 'assistant'; text: string }>).map((m) => ({
          role: m.role,
          content: m.text,
        })),
        schema: null,
        maxTokens: 2000,
      };
  }
}

/** Contrôle de forme de la réponse (en plus du schéma imposé au modèle). */
export function checkOutput(task: Task, out: any, payload: Record<string, any>): unknown {
  const ids = new Set(((payload.items as Item[] | undefined) ?? []).map((i) => i.id));
  const isStr = (v: unknown) => typeof v === 'string';
  switch (task) {
    case 'write':
      if (!isStr(out?.text) || !out.text.trim()) throw new AiError('EMPTY', 502);
      return { text: out.text.trim() };
    case 'write_all':
    case 'translate':
      if (!Array.isArray(out?.items)) throw new AiError('EMPTY', 502);
      return { items: out.items.filter((i: Item) => ids.has(i.id) && isStr(i.text)) };
    case 'suggest':
      if (!Array.isArray(out?.suggestions)) throw new AiError('EMPTY', 502);
      return { suggestions: out.suggestions.filter((s: { id: string }) => ids.has(s.id)).slice(0, 10) };
    case 'generate':
      if (!isStr(out?.title) || !Array.isArray(out?.steps) || out.steps.length === 0)
        throw new AiError('EMPTY', 502);
      return { title: out.title.slice(0, 120), steps: out.steps.slice(0, 30) };
    case 'dataset': {
      const n = (payload.columns as string[]).length;
      if (!Array.isArray(out?.rows)) throw new AiError('EMPTY', 502);
      // Garde-fou : on repasse le détecteur sur les valeurs générées (aucune donnée réelle plausible)
      const rows = out.rows
        .filter((r: unknown) => Array.isArray(r) && r.length === n)
        .slice(0, payload.rows)
        .map((r: unknown[]) => r.map((v) => (looksReal(String(v)) ? '' : String(v))));
      return { rows };
    }
    case 'chart': {
      const labels = Array.isArray(out?.labels) ? out.labels.slice(0, 12) : [];
      const series = Array.isArray(out?.series)
        ? out.series
            .slice(0, 4)
            .filter(
              (s: { values: unknown[] }) => Array.isArray(s.values) && s.values.length === labels.length,
            )
        : [];
      if (labels.length < 2 || series.length === 0) throw new AiError('EMPTY', 502);
      return { type: out.type, title: String(out.title ?? ''), labels, series };
    }
    case 'assistant':
      if (!isStr(out?.text) || !out.text.trim()) throw new AiError('EMPTY', 502);
      return { text: out.text.trim() };
  }
}
