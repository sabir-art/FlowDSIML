/**
 * L49 P1 (docs/ux/specs/l49-securite-html.md §2.1) : règle du réglage « Captures HTML » d'un espace
 * (workspaces.settings.htmlCapture), partagée par l'app et l'extension. Même règle que
 * public.html_capture_host_in et html-ingest, qui restent la seule protection fiable.
 */
export type HtmlCaptureMode = 'allowed' | 'domains' | 'disabled';
export interface HtmlCaptureRule {
  mode: HtmlCaptureMode;
  domains: string[];
}

export function parseHtmlCapture(v: unknown): HtmlCaptureRule {
  const o = (v ?? {}) as Partial<HtmlCaptureRule>;
  const mode = o.mode === 'domains' || o.mode === 'disabled' ? o.mode : 'allowed';
  return { mode, domains: Array.isArray(o.domains) ? o.domains.filter((d) => typeof d === 'string') : [] };
}

/** Égalité, ou sous-domaine pour « *.x » (pas x lui-même). */
export function hostAllowed(host: string, domains: string[]): boolean {
  const h = host.toLowerCase();
  return domains.some((d) => h === d || (d.startsWith('*.') && h.endsWith(d.slice(1)) && h !== d.slice(2)));
}

/** Verdict pour une page : autorisée, captures désactivées, ou domaine hors liste. */
export function htmlCaptureVerdict(rule: HtmlCaptureRule, host: string): 'ok' | 'disabled' | 'domain' {
  if (rule.mode === 'disabled') return 'disabled';
  if (rule.mode === 'domains' && !hostAllowed(host, rule.domains)) return 'domain';
  return 'ok';
}
