import type { PxRect, Viewport } from './geometry';
import type { Detection } from './scan';
import type { HtmlCapture } from './htmlCapture';

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

/** F7 : type de capture choisi dans la popup. */
export type CaptureMode = 'clicks' | 'video' | 'mobile' | 'html';

export type PopupRequest =
  | {
      type: 'fd:start';
      workspaceId: string;
      title: string;
      tabId: number;
      mode?: CaptureMode;
      /** Vidéo : identifiant du flux de l'onglet (tabCapture, obtenu dans la popup). */
      streamId?: string;
      mic?: boolean;
      webcam?: boolean;
      /** Format mobile : taille émulée. */
      viewport?: { w: number; h: number };
    }
  | { type: 'fd:stop' }
  | { type: 'fd:pause' }
  | { type: 'fd:cancel' }
  | { type: 'fd:status' };

/** F7 : messages de la barre d'enregistrement (content script) vers le service worker. */
export type VideoBarRequest =
  | { type: 'fd:video-pause' }
  | { type: 'fd:video-mark'; label: string; manual: boolean }
  | { type: 'fd:video-stop' }
  | { type: 'fd:video-blurs'; count: number };

/** A8 : barre de la capture HTML (content script) vers le service worker. */
export type HtmlBarRequest =
  | { type: 'fd:html-ready' }
  | { type: 'fd:html-page'; capture: HtmlCapture }
  | { type: 'fd:html-click'; sel: string; label: string }
  | { type: 'fd:html-stop' }
  | { type: 'fd:fetch-asset'; url: string; kind: 'image' | 'font' | 'css' };

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
  /** F7 : type de capture en cours (absent : captures à chaque clic). */
  mode?: CaptureMode;
  /** F7 : démo mobile (taille émulée), null sinon. */
  viewport?: { w: number; h: number } | null;
  /** F7 : chronomètre de la vidéo (pauses exclues). */
  startedAt?: number;
  pausedAt?: number | null;
  pausedMs?: number;
  micDenied?: boolean;
  blurredZones?: number;
  /** A8 : capture HTML à faire au prochain chargement de page (après un clic qui navigue). */
  htmlAwait?: boolean;
}
