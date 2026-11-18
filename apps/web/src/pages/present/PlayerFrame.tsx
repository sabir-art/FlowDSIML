/**
 * L22 : le lecteur réel en mode présentation (iframe en aperçu, sans statistiques), piloté par
 * postMessage : manifeste à l'ouverture, puis étape, écran noir et points chauds masqués.
 */
import { useEffect, useRef } from 'react';
import type { Manifest } from '@flowdsiml/manifest';
import { PLAYER_URL } from '../../lib/env';

export interface PresentFrameState {
  index: number;
  black: boolean;
  hideHotspots: boolean;
}

export function PlayerFrame({
  manifest,
  state,
  title,
  className,
}: {
  manifest: Manifest | null;
  state: PresentFrameState;
  title: string;
  className?: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const ready = useRef(false);
  const origin = new URL(PLAYER_URL).origin;
  const latest = useRef({ manifest, state });
  latest.current = { manifest, state };

  const send = (withManifest: boolean) => {
    const w = frame.current?.contentWindow;
    const { manifest: m, state: s } = latest.current;
    if (!w || !m) return;
    if (withManifest) w.postMessage({ type: 'fd:preview', manifest: m }, origin);
    w.postMessage({ type: 'fd:present', ...s }, origin);
  };

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== origin || e.source !== frame.current?.contentWindow) return;
      if ((e.data as { type?: string })?.type === 'fd:preview-ready') {
        ready.current = true;
        send(true);
      }
    };
    addEventListener('message', onMsg);
    return () => removeEventListener('message', onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin]);

  useEffect(() => {
    if (ready.current) send(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest]);
  useEffect(() => {
    if (ready.current) send(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index, state.black, state.hideHotspots]);

  return (
    <iframe ref={frame} className={className} src={`${PLAYER_URL}/#/preview`} title={title} tabIndex={-1} />
  );
}
