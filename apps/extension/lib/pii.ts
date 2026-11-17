/**
 * Détection de données personnelles, côté client uniquement (spec f1-formation §1).
 * Logique pure (testée) : motifs sur le texte et libellés de champs. Le texte détecté ne quitte
 * jamais le navigateur : seuls le type, la boîte et un extrait masqué sont gardés pour l'écran de
 * vérification, et seuls le type et la boîte sont envoyés (après flou des pixels).
 */
export type PiiType =
  | 'name'
  | 'nir'
  | 'phone'
  | 'email'
  | 'address'
  | 'birthdate'
  | 'iban'
  | 'identifier'
  /** Zone imposée sans type : mot de passe, carte bancaire, [data-fd-blur], zone ajoutée à la main. */
  | 'zone';

export interface TextMatch {
  type: PiiType;
  start: number;
  end: number;
}

const NIR =
  /\b[12][ .]?\d{2}[ .]?(?:0[1-9]|1[0-2]|[2-9]\d)[ .]?(?:\d{2}|2[AB])[ .]?\d{3}[ .]?\d{3}(?:[ .]?\d{2})?\b/g;
const PHONE = /(?:\+33[ .-]?|\b0)[1-9](?:[ .-]?\d{2}){4}\b/g;
const EMAIL = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g;
const IBAN = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}(?:[ ]?[A-Z0-9]{1,3})?\b/g;
const STREET =
  /\b\d{1,4}(?:[ ]?(?:bis|ter))?,?[ ]+(?:rue|avenue|av\.|bd|boulevard|chemin|allée|impasse|place|route|quai|cours|square|résidence|lotissement)\b[^\n,;]{2,60}/gi;
const POSTCODE_CITY = /\b(?:0[1-9]|[1-8]\d|9[0-8])\d{3}[ ]+[A-ZÉÈ][A-Za-zÀ-ÿ'’ -]{1,40}\b/g;
const DATE = /\b(?:0?[1-9]|[12]\d|3[01])[/.-](?:0?[1-9]|1[0-2])[/.-](?:19|20)\d{2}\b/g;
/** Prénom + NOM (nom en capitales), ex. « Camille DURAND ». */
const FIRST_LAST = /\b[A-ZÉÈ][a-zà-ÿ]+(?:-[A-ZÉÈ][a-zà-ÿ]+)?[ ]+[A-ZÉÈ]{2,}(?:[- ][A-ZÉÈ]{2,})*\b/g;
const BIRTH_CONTEXT = /(naissance|né\(e\)|née?\s+le|birth|date of birth|dob)/i;

/** Libellé de champ → type (nom de champ, aria-label, placeholder, en-tête de colonne, `autocomplete`…). */
const LABELS: Array<[RegExp, PiiType]> = [
  [/(s[ée]curit[ée] sociale|\bnir\b|\bssn\b|n°\s*ss\b|\bsecu)/i, 'nir'],
  [/(naissance|birth|\bbday\b|\bdob\b|né\(e\) le)/i, 'birthdate'],
  [/(\biban\b|\brib\b|\bbic\b)/i, 'iban'],
  [/(e-?mail|courriel|\bmail\b)/i, 'email'],
  [/(t[ée]l[ée]phone|\btel\b|\btél\b|portable|mobile|phone)/i, 'phone'],
  [/(adresse|address|street|\bvoie\b|code postal|postal|\bzip\b|\bville\b|\bcity\b)/i, 'address'],
  [/(identifiant|\blogin\b|username|user ?id|matricule|n° dossier|num[ée]ro de dossier)/i, 'identifier'],
  [/(\bnom\b|pr[ée]nom|\bname\b|given-name|family-name|usager|b[ée]n[ée]ficiaire|jeune accompagn)/i, 'name'],
];

export function labelType(label: string | null | undefined): PiiType | null {
  if (!label) return null;
  const l = label.trim();
  if (!l || l.length > 80) return null;
  for (const [re, type] of LABELS) if (re.test(l)) return type;
  return null;
}

/** Valeur de l'attribut `autocomplete` → type (prioritaire sur le libellé). */
export function autocompleteType(ac: string | null | undefined): PiiType | null {
  const a = (ac ?? '').toLowerCase();
  if (!a || a === 'off' || a === 'on') return null;
  if (/cc-|current-password|new-password|one-time-code/.test(a)) return 'zone';
  if (/bday/.test(a)) return 'birthdate';
  if (/email/.test(a)) return 'email';
  if (/tel/.test(a)) return 'phone';
  if (/address|postal-code|country|street/.test(a)) return 'address';
  if (/username/.test(a)) return 'identifier';
  if (/name/.test(a)) return 'name';
  return null;
}

/** Correspondances de motifs dans un texte (sans chevauchement, la première règle gagne). */
export function matchText(text: string, context = ''): TextMatch[] {
  const out: TextMatch[] = [];
  const add = (re: RegExp, type: PiiType, check?: (m: RegExpExecArray) => boolean) => {
    re.lastIndex = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      const start = m.index;
      const end = start + m[0].length;
      if (check && !check(m)) continue;
      if (out.some((o) => start < o.end && end > o.start)) continue;
      out.push({ type, start, end });
    }
  };
  add(EMAIL, 'email');
  add(IBAN, 'iban', (m) => /\d{6,}/.test(m[0].replace(/\s/g, '')));
  add(NIR, 'nir', (m) => m[0].replace(/[ .]/g, '').length >= 13);
  add(PHONE, 'phone');
  add(STREET, 'address');
  add(POSTCODE_CITY, 'address');
  // Une date n'est une date de naissance que près d'un libellé « naissance » / « né(e) le »
  add(
    DATE,
    'birthdate',
    (m) => BIRTH_CONTEXT.test(context) || BIRTH_CONTEXT.test(text.slice(Math.max(0, m.index - 30), m.index)),
  );
  add(FIRST_LAST, 'name');
  return out.sort((a, b) => a.start - b.start);
}

/**
 * « Libellé : valeur » dans un même nœud de texte (« Nom : DURAND ») : renvoie la partie valeur
 * si le libellé est reconnu.
 */
export function inlineLabelValue(text: string): TextMatch | null {
  const m = /^\s*([^:\n]{2,40}?)\s*[:：]\s*(\S.*?)\s*$/.exec(text);
  if (!m) return null;
  const type = labelType(m[1]);
  if (!type) return null;
  const start = text.indexOf(m[2]!, m[1]!.length);
  return { type, start, end: start + m[2]!.length };
}

/** Extrait masqué pour l'écran de vérification : jamais la valeur en clair. */
export function maskExcerpt(type: PiiType, value: string): string {
  const v = value.replace(/\s+/g, ' ').trim();
  if (type === 'email') {
    const [user = '', domain = ''] = v.split('@');
    const tld = domain.includes('.') ? domain.slice(domain.lastIndexOf('.')) : '';
    return `${user.slice(0, 1)}••••@••••${tld}`;
  }
  if (type === 'phone') return `${v.replace(/\D/g, '').slice(0, 2)} •• •• •• ••`;
  if (type === 'nir') return `${v.slice(0, 1)} •• •• •• ••• ••• ••`;
  if (type === 'iban') return `${v.slice(0, 4)} •••• •••• ••••`;
  if (type === 'birthdate') return '••/••/••••';
  return v
    .split(' ')
    .map((w) => (w ? `${w.slice(0, 1)}${'•'.repeat(Math.min(6, Math.max(2, w.length - 1)))}` : w))
    .slice(0, 4)
    .join(' ');
}
