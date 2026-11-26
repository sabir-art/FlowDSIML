/**
 * L63 : libellés lisibles. Un titre d'étape ou de bulle né d'une capture ne doit jamais être un sélecteur
 * CSS (« div:has(> #search…) ») ni des textes d'interface collés (« Generate speechText to SpeechOpen… »).
 */

const TAGS =
  'div|span|section|article|button|input|select|textarea|ul|ol|li|a|p|svg|path|img|form|nav|header|footer|main|table|tr|td|th|label|iframe';
const SELECTOR = new RegExp(
  [
    ':has\\(|:not\\(|:is\\(|:where\\(|:nth-|::[a-z]', // pseudo-classes et pseudo-éléments
    '\\[(data|aria|class|id|role|name|type|href)[-^$*~|=\\]]', // sélecteurs d'attribut
    `(^|[\\s>+~(])(${TAGS})[#.:\\[][\\w-]`, // balise suivie d'un id, d'une classe ou d'un attribut
    '[#.][\\w-]+\\s*[>+~]\\s*[#.\\w]', // combinateur entre deux sélecteurs
    '^[#.][a-zA-Z][\\w-]*$', // un id ou une classe seuls
    '[{}]|=>|\\bfunction\\s*\\(', // code
  ].join('|'),
);

/** Vrai si le texte ressemble à un sélecteur ou à du code plutôt qu'à un libellé. */
export function looksLikeSelector(s: string): boolean {
  return SELECTOR.test(s.trim());
}

/**
 * Vrai si le texte ressemble à des libellés collés sans espace : une minuscule suivie d'une majuscule,
 * au moins deux fois (« speechText to SpeechOpen »), hors sigles et noms de marque courts.
 */
export function looksGlued(s: string): boolean {
  const joins = s.match(/\p{Ll}\p{Lu}/gu)?.length ?? 0;
  return joins >= 2 && s.trim().length > 20;
}

/** Titre technique : à signaler et à réécrire (sélecteur, code, textes collés). */
export const looksTechnical = (s: string) => looksLikeSelector(s) || looksGlued(s);

/**
 * Libellé court et lisible parmi des candidats, dans l'ordre de préférence (libellé accessible, texte
 * visible, texte indicatif, titre, texte alternatif). Seule la première ligne compte ; un candidat
 * technique est écarté. Chaîne vide si rien ne convient : l'appelant écrit alors « Cliquez ici ».
 */
export function readableLabel(candidates: Array<string | null | undefined>, max = 60): string {
  for (const raw of candidates) {
    const line = (raw ?? '')
      .split(/[\r\n]+/)
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .find(Boolean);
    if (!line || looksTechnical(line)) continue;
    return line.length > max ? `${line.slice(0, max - 3).trimEnd()}…` : line;
  }
  return '';
}

/**
 * Lot B (recette UX §3.4) : adresse affichée dans le cadre du navigateur, réduite au domaine et au
 * chemin (« crm.acme.example/opportunites ») : ni protocole, ni paramètres, ni ancre, 120 caractères au
 * plus. Chaîne vide pour une adresse illisible.
 */
export function displayAddress(url: string): string {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    const path = u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '');
    return `${u.host}${path}`.slice(0, 120);
  } catch {
    return '';
  }
}
