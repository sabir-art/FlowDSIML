import type { PxRect, Viewport } from './geometry';
import type { Detection } from './scan';

/** Clic capturé par le content script et envoyé au service worker. */
export interface ClickPayload {
  type: 'fd:click';
  click: { x: number; y: number };
  element: PxRect | null;
  label: string;
  selector: string;
  tag: string;
  viewport: Viewport;
  dpr: number;
  url: string;
  title: string;
  /**
   * Données personnelles possibles et zones imposées (mot de passe, carte, data-fd-blur), trouvées
   * dans la page. Restent dans le navigateur jusqu'à l'écran de vérification.
   */
  detections: Detection[];
}

export type PopupRequest =
  | { type: 'fd:start'; workspaceId: string; title: string; tabId: number }
  | { type: 'fd:stop' }
  | { type: 'fd:pause' }
  | { type: 'fd:cancel' }
  | { type: 'fd:status' };

export interface RecordingStatus {
  recording: boolean;
  paused: boolean;
  /** Démo créée à l'envoi (après vérification) ; null pendant la capture. */
  demoId: string | null;
  workspaceId: string | null;
  /** Titre saisi au démarrage, utilisé à la création de la démo. */
  title: string;
  tabId: number | null;
  steps: number;
  lastError: string | null;
}
