/** CSV RFC 4180 + protection contre l'injection de formules (Excel/Sheets). */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  // Un nombre n'est jamais une formule : -5 reste -5 (la protection vise les textes)
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  let s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** `sep` : ',' par défaut ; ';' pour Excel en français. */
export function toCsv(headers: string[], rows: unknown[][], sep: ',' | ';' = ','): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(sep)).join('\r\n');
}
