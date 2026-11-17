import type { PxRect, Viewport } from './geometry';

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
  /** Zones sensibles à flouter (champs mot de passe, carte bancaire, data-fd-blur). */
  sensitive: PxRect[];
}

export type PopupRequest =
  | { type: 'fd:start'; workspaceId: string; title: string; tabId: number }
  | { type: 'fd:stop' }
  | { type: 'fd:status' };

export interface RecordingStatus {
  recording: boolean;
  demoId: string | null;
  workspaceId: string | null;
  tabId: number | null;
  steps: number;
  lastError: string | null;
}
