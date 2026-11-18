/**
 * L22-04 : écran public. Reçoit tout de la vue présentateur par BroadcastChannel (même navigateur) :
 * aucune lecture en base, jamais de notes. Il se signale (« hello » puis « alive » chaque seconde)
 * pour que le présentateur sache s'il est ouvert.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Manifest } from '@flowdsiml/manifest';
import { PlayerFrame } from './PlayerFrame';
import { channelName, type PresentMessage } from './present';
import './present.css';

type Shown = Extract<PresentMessage, { type: 'state' }>;

export function PublicScreen() {
  const { demoId = '' } = useParams();
  const { t } = useTranslation();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(channelName(demoId));
    ch.onmessage = (e: MessageEvent<PresentMessage>) => {
      const m = e.data;
      if (m?.type === 'state') {
        if (m.manifest) setManifest(m.manifest);
        setShown(m);
        setEnded(false);
      } else if (m?.type === 'end') {
        setEnded(true);
        window.close();
      }
    };
    ch.postMessage({ type: 'hello' } satisfies PresentMessage);
    const id = setInterval(() => ch.postMessage({ type: 'alive' } satisfies PresentMessage), 1000);
    return () => {
      clearInterval(id);
      ch.close();
    };
  }, [demoId]);

  useEffect(() => {
    document.title = shown?.title ? `${shown.title} · TutoClick` : 'TutoClick';
  }, [shown?.title]);

  if (ended || !shown || !manifest)
    return (
      <main className="pub-wait" id="main">
        <h1 className="sr-only">{t('present.publicTitle')}</h1>
        <p role="status">{t(ended ? 'present.publicEnded' : 'present.publicWaiting')}</p>
      </main>
    );

  return (
    <main className="pub" id="main">
      <h1 className="sr-only">{shown.title}</h1>
      <div className="stage">
        <PlayerFrame
          manifest={manifest}
          state={{ index: shown.index, black: shown.black, hideHotspots: shown.hideHotspots }}
          title={t('present.stageTitle')}
          className="pr-frame"
        />
      </div>
      <div className="foot">
        <span>{shown.title}</span>
        <span>
          {shown.index + 1} / {shown.total}
        </span>
      </div>
    </main>
  );
}
