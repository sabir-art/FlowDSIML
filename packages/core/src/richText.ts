/**
 * Texte riche restreint, sûr par construction : tout est échappé, puis on réintroduit
 * un petit sous-ensemble de balises : **gras**, *italique*, [lien](https://…), retours à la ligne.
 * Ne jamais passer de HTML utilisateur brut au DOM ailleurs que via cette fonction.
 */
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

export function richTextToHtml(src: string): string {
  let out = escapeHtml(src);
  // Liens : le texte et l'URL sont déjà échappés ; on dé-échappe &amp; pour parser l'URL.
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
    const safe = safeUrl(url.replace(/&amp;/g, '&'));
    if (!safe) return label;
    return `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/\r?\n/g, '<br>');
  return out;
}

/** Version texte brut (pour aria-label, aperçus, CSV). */
export function richTextToPlain(src: string): string {
  return src
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1');
}
