/**
 * EXT-STORE (docs/ux/store/README.md §6) : `debugger` et l'accès aux sites sont facultatifs, demandés au clic
 * sur « Démarrer », jamais à l'installation.
 * - `debugger` : Format mobile (bloquant), taille d'onglet imposée (sinon taille actuelle), page entière en
 *   captures à chaque clic (sinon partie visible ; après « Pas maintenant », on ne redemande plus au démarrage).
 * - Accès aux sites (`<all_urls>`, facultatif) : réinjecter la barre et capturer après un changement de page
 *   ou dans un onglet suivi. Sans lui, `activeTab` couvre seulement la page ouverte au démarrage.
 */
import type { CaptureMode } from './messages';

export type DebuggerReason = 'mobile' | 'size' | 'full';
export const ALL_SITES = '<all_urls>';
/** Choix « Pas maintenant » pour la page entière (gardé dans storage.local). */
export const FULL_LATER_KEY = 'fd.dbgFullLater';

export interface PermissionNeed {
  /** Raison de demander `debugger` (absente : pas besoin, ou déjà accordée, ou refusée pour la page entière). */
  debugger: DebuggerReason | null;
  /** Accès à tous les sites à demander. */
  sites: boolean;
}

export function permissionNeed(opts: {
  mode: CaptureMode;
  /** Taille d'onglet choisie : « current » = taille actuelle. */
  size: string;
  hasDebugger: boolean;
  hasSites: boolean;
  fullLater: boolean;
}): PermissionNeed {
  const { mode, size, hasDebugger, hasSites, fullLater } = opts;
  let reason: DebuggerReason | null = null;
  if (!hasDebugger) {
    if (mode === 'mobile') reason = 'mobile';
    else if ((mode === 'clicks' || mode === 'html') && size !== 'current') reason = 'size';
    else if (mode === 'clicks' && !fullLater) reason = 'full';
  }
  // La vidéo enregistre l'onglet par tabCapture : pas besoin d'accéder aux pages
  return { debugger: reason, sites: mode !== 'video' && !hasSites };
}

/** Refus (fenêtre de Chrome ou « Pas maintenant ») : la capture démarre-t-elle quand même ? */
export const startsWithout = (reason: DebuggerReason | null) => reason !== 'mobile';
