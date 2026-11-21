/**
 * L49 P1 (docs/ux/specs/l49-securite-html.md §2) : réglage « Captures HTML » de l'espace,
 * workspaces.settings.htmlCapture, lisible par les membres, écrit seulement par la RPC set_html_capture.
 * La base et html-ingest appliquent la règle ; l'interface la reflète (types désactivés, raison de l'admin).
 */
import { useEffect, useState } from 'react';
import { hostAllowed, parseHtmlCapture as parse } from '@flowdsiml/core';
import { supabase } from './supabase';

export { hostAllowed };

export type HtmlCaptureMode = 'allowed' | 'domains' | 'disabled';
export interface HtmlCapture {
  mode: HtmlCaptureMode;
  domains: string[];
}
export const DEFAULT_HTML_CAPTURE: HtmlCapture = { mode: 'allowed', domains: [] };
export const MAX_DOMAINS = 50;

/** Même règle que public.html_capture_domain_ok : minuscules, sans protocole ni chemin, joker « *. » en tête. */
const DOMAIN = /^(\*\.)?([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
export const normalizeDomain = (s: string) => s.trim().toLowerCase();
export const domainOk = (s: string) => s.length <= 253 && DOMAIN.test(s);

const cache = new Map<string, Promise<HtmlCapture>>();
const EVENT = 'fd:html-capture';

function fetchHtmlCapture(wsId: string): Promise<HtmlCapture> {
  let p = cache.get(wsId);
  if (!p) {
    p = Promise.resolve(supabase.from('workspaces').select('settings').eq('id', wsId).maybeSingle()).then(
      ({ data }) => parse((data?.settings as Record<string, unknown> | null)?.htmlCapture),
    );
    cache.set(wsId, p);
  }
  return p;
}

export function htmlCaptureChanged(wsId: string) {
  cache.delete(wsId);
  dispatchEvent(new CustomEvent(EVENT, { detail: wsId }));
}

export function useHtmlCapture(wsId: string | undefined): HtmlCapture {
  const [v, setV] = useState<HtmlCapture>(DEFAULT_HTML_CAPTURE);
  useEffect(() => {
    if (!wsId) return;
    let alive = true;
    const load = () => void fetchHtmlCapture(wsId).then((r) => alive && setV(r));
    load();
    const on = (e: Event) => (e as CustomEvent<string>).detail === wsId && load();
    addEventListener(EVENT, on);
    return () => {
      alive = false;
      removeEventListener(EVENT, on);
    };
  }, [wsId]);
  return v;
}
