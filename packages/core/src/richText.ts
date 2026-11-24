/**
 * Texte riche restreint, sûr par construction : tout est échappé, puis on réintroduit
 * un petit sous-ensemble de balises : **gras**, *italique*, [lien](https://…), retours à la ligne.
 * Ne jamais passer de HTML utilisateur brut au DOM ailleurs que via cette fonction.
 */
import { applyUrlVariables, applyVariables, type VariableValues } from './variables';

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:'
      ? u.toString()
      : null;
  } catch {
    return null;
  }
}

/** Caractères privés : jetons de lien et caractères de mise en forme neutralisés (jamais dans une saisie). */
const TOKEN_OPEN = '\uE100';
const TOKEN_CLOSE = '\uE101';
const NEUTRAL: Record<string, string> = {
  '[': '\uE110',
  ']': '\uE111',
  '(': '\uE112',
  ')': '\uE113',
  '*': '\uE114',
};
const NEUTRAL_BACK = Object.fromEntries(Object.entries(NEUTRAL).map(([k, v]) => [v, k]));
const PRIVATE_RE = /[\uE100-\uE11F]/g;
const WHOLE_VAR_RE = /^\{\{[^{}]*\}\}$/;

/** Valeur insérée dans un texte : ses crochets, parenthèses et astérisques restent du texte. */
const neutral = (v: string) => v.replace(PRIVATE_RE, '').replace(/[[\]()*]/g, (c) => NEUTRAL[c]!);
const neutralMap = (m: VariableValues): VariableValues =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v === undefined ? v : neutral(v)]));

export interface RichTextVariables {
  values: VariableValues;
  defaults?: VariableValues;
  /** Bornes placées autour de chaque valeur insérée dans le texte (glossaire). */
  wrap?: [string, string];
}

/**
 * Rend le texte riche. Avec `vars`, les variables sont remplacées ici, et non avant : la valeur d'une
 * variable reste du texte (elle ne crée ni lien ni mise en forme), elle est encodée quand elle complète une
 * adresse, et une adresse faite d'une seule variable n'est gardée que si elle est en http, https ou mailto.
 * Les liens sont mis de côté avant le gras et l'italique : leur adresse n'est jamais retouchée.
 */
export function richTextToHtml(src: string, vars?: RichTextVariables): string {
  const values = vars ? neutralMap(vars.values) : {};
  const defaults = vars ? neutralMap(vars.defaults ?? {}) : {};
  const text = (s: string) => (vars ? applyVariables(s, values, defaults, vars.wrap) : s);
  const inline = (s: string) =>
    escapeHtml(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  const links: string[] = [];
  let out = src
    .replace(PRIVATE_RE, '')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
      const target = !vars
        ? url
        : WHOLE_VAR_RE.test(url)
          ? applyVariables(url, vars.values, vars.defaults ?? {}).trim()
          : applyUrlVariables(url, vars.values, vars.defaults ?? {});
      const safe = safeUrl(target);
      const shown = inline(text(label));
      links.push(
        safe ? `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${shown}</a>` : shown,
      );
      return `${TOKEN_OPEN}${links.length - 1}${TOKEN_CLOSE}`;
    });
  out = inline(text(out)).replace(/\r?\n/g, '<br>');
  return out
    .replace(new RegExp(`${TOKEN_OPEN}(\\d+)${TOKEN_CLOSE}`, 'g'), (_m, i: string) => links[Number(i)] ?? '')
    .replace(/[\uE110-\uE114]/g, (c) => escapeHtml(NEUTRAL_BACK[c] ?? ''));
}

/** Version texte brut (pour aria-label, aperçus, CSV). */
export function richTextToPlain(src: string): string {
  return src
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1');
}
