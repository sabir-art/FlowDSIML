/**
 * L16 : diffusion d'une démo (modale « Diffuser »). Règles pures (testées) : codes pour l'intranet,
 * vérification des sites autorisés, lien mailto ; accès aux données : diffusions enregistrées et vues
 * par site intégrant.
 */
import type { Json } from '@flowdsiml/supabase-types';
import { supabase } from '../../lib/supabase';

export type Tab = 'training' | 'scorm' | 'intranet' | 'mail' | 'where';
export type DiffusionKind = 'scorm' | 'intranet' | 'widget' | 'iframe' | 'email';

export interface EmbedOptions {
  /** Démarrage au clic (couverture « Lancer la démo »). */
  clickToStart: boolean;
  /** Langue de l'interface du lecteur ; null = langue de la démo. */
  lang: 'fr' | 'en' | null;
}

const clean = (s: string) => s.replace(/[<>"&]/g, '');

/** Adresse du lecteur avec les réglages d'intégration (?start=click, ?lang=…). */
export function embedUrl(url: string, o: EmbedOptions): string {
  const q = [o.clickToStart ? 'start=click' : '', o.lang ? `lang=${o.lang}` : ''].filter(Boolean);
  return q.length ? `${url}${url.includes('?') ? '&' : '?'}${q.join('&')}` : url;
}

export type IframeSize = { kind: 'fluid' } | { kind: 'fixed'; width: number; height: number };

/** Iframe : toujours un title, chargement différé, plein écran autorisé ; 16:10 ou taille fixe. */
export function iframeCode(url: string, title: string, size: IframeSize): string {
  const style =
    size.kind === 'fluid'
      ? 'width:100%;aspect-ratio:16/10;border:0'
      : `width:${size.width}px;height:${size.height}px;border:0`;
  return `<iframe src="${url}"\n  title="${clean(title)}"\n  loading="lazy" allow="fullscreen"\n  style="${style}"></iframe>`;
}

/** Bouton + pop-up : le bouton appartient à la page hôte, popup.js (servi par le lecteur) l'active. */
export function popupCode(
  playerBase: string,
  demoId: string,
  o: EmbedOptions & { label: string; float: boolean },
): string {
  const attrs = [
    'type="button"',
    `data-tutoclick="${demoId}"`,
    o.float ? 'data-tutoclick-float' : '',
    o.clickToStart ? 'data-tutoclick-start="click"' : '',
    o.lang ? `data-tutoclick-lang="${o.lang}"` : '',
  ].filter(Boolean);
  // L16-06 : un attribut par ligne (le code se coupe entre les attributs, jamais au milieu)
  return `<button\n  ${attrs.join('\n  ')}>${clean(o.label).slice(0, 40)}</button>\n<script src="${playerBase.replace(/\/$/, '')}/popup.js" defer></script>`;
}

/** Domaine saisi (« intranet.exemple.fr », « https://intranet.exemple.fr/page ») ; null s'il est invalide. */
export function hostOf(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  try {
    const u = new URL(v.includes('://') ? v : `https://${v}`);
    return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname) ? u.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** Même règle que le lecteur (embedAllowed) : liste vide = tout site autorisé ; « *.domaine » accepté. */
export function originAllowed(host: string, allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  return allowed.some((a) => {
    try {
      const want = new URL(a.includes('://') ? a : `https://${a}`).hostname;
      return want.startsWith('*.') ? host.endsWith(want.slice(1)) : want === host;
    } catch {
      return false;
    }
  });
}

/** Limite d'un lien mailto sûr pour la plupart des messageries (spec L16 §6). */
export const MAIL_MAX = 1500;

const EMAIL = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/;

/** Destinataires séparés par des virgules (ou points-virgules) : valides et invalides. */
export function parseRecipients(input: string): { valid: string[]; invalid: string[] } {
  const parts = input
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return { valid: parts.filter((p) => EMAIL.test(p)), invalid: parts.filter((p) => !EMAIL.test(p)) };
}

/** mailto:{{destinataires}}?subject=…&body=… (chaque partie encodée, texte brut). */
export function mailtoHref(recipients: string[], subject: string, body: string): string {
  return `mailto:${recipients.map(encodeURIComponent).join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// ===== Données =====

export interface Diffusion {
  id: string;
  kind: DiffusionKind;
  label: string;
  settings: Record<string, unknown>;
  version_id: string | null;
  created_by: string | null;
  first_at: string;
  last_at: string;
  uses: number;
}

export async function listDiffusions(demoId: string): Promise<Diffusion[]> {
  const { data } = await supabase
    .from('diffusions')
    .select('id, kind, label, settings, version_id, created_by, first_at, last_at, uses')
    .eq('demo_id', demoId)
    .order('last_at', { ascending: false })
    .limit(50);
  return (data ?? []) as Diffusion[];
}

/** Enregistre (ou rafraîchit) une diffusion ; jamais bloquant pour l'utilisateur. */
export async function recordDiffusion(
  demoId: string,
  kind: DiffusionKind,
  label: string,
  settings: Record<string, unknown> = {},
) {
  await supabase
    .rpc('record_diffusion', {
      p_demo: demoId,
      p_kind: kind,
      p_label: label.slice(0, 120),
      p_settings: settings as Json,
    })
    .then(
      () => undefined,
      () => undefined,
    );
}

/** Vues par site intégrant (90 derniers jours, 20 sites au plus). */
export async function embedViews(
  demoId: string,
): Promise<Array<{ origin: string; views: number; last_at: string }>> {
  const { data } = await supabase.rpc('demo_embed_views', { p_demo: demoId });
  return Array.isArray(data) ? (data as Array<{ origin: string; views: number; last_at: string }>) : [];
}
