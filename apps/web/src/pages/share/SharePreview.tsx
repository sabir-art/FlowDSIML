import { ExternalLink, Image as ImageIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Tables } from '@flowdsiml/supabase-types';
import { themeSchema } from '@flowdsiml/manifest';
import { beaconCenter, themeVars } from '@flowdsiml/player-core';
import { supabase } from '../../lib/supabase';
import { asSettings } from '../editor/types';
import '@flowdsiml/player-core/player-core.css';

type Step = Pick<Tables<'steps'>, 'id' | 'kind' | 'title' | 'image_path' | 'image_width' | 'image_height'>;
type Hotspot = Pick<Tables<'hotspots'>, 'x' | 'y' | 'w' | 'h'>;

/**
 * P12 : aperçu statique de la démo (capture de l'étape 1 + pastille du hotspot, sans pulsation).
 * Pas d'iframe : le vrai player compterait des vues et fausserait les analytics.
 */
export function SharePreview({
  demo,
  playerUrl,
  published,
}: {
  demo: Tables<'demos'>;
  playerUrl: string;
  published: boolean;
}) {
  const { t } = useTranslation();
  const [count, setCount] = useState<number | null>(null);
  const [first, setFirst] = useState<Step | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [hotspot, setHotspot] = useState<Hotspot | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: steps } = await supabase
        .from('steps')
        .select('id, kind, title, image_path, image_width, image_height')
        .eq('demo_id', demo.id)
        .order('position')
        .order('created_at');
      if (!active) return;
      const list = (steps ?? []) as Step[];
      setCount(list.length);
      const s = list[0] ?? null;
      setFirst(s);
      if (!s) return;
      const [signed, hs] = await Promise.all([
        s.image_path
          ? supabase.storage.from('captures').createSignedUrl(s.image_path, 3600)
          : Promise.resolve(null),
        supabase.from('hotspots').select('x, y, w, h').eq('step_id', s.id).order('position').limit(1),
      ]);
      if (!active) return;
      setImage(signed?.data?.signedUrl ?? null);
      setHotspot(((hs.data ?? [])[0] as Hotspot | undefined) ?? null);
    })();
    return () => {
      active = false;
    };
  }, [demo.id]);

  const theme = themeSchema.parse(asSettings(demo.settings).theme ?? {});
  const previewUrl = `${playerUrl}?preview=1`;

  return (
    <section className="fd-card share-preview" aria-labelledby="share-preview-title">
      <h2 id="share-preview-title" className="sr-only">
        {t('share.preview')}
      </h2>
      {count === 0 ? (
        <div className="share-preview__empty">
          <ImageIcon size={24} aria-hidden="true" />
          <p>{t('share.previewEmpty')}</p>
        </div>
      ) : (
        <div
          className="share-preview__frame fd-player-scope"
          style={{
            aspectRatio:
              first?.image_width && first.image_height
                ? `${first.image_width} / ${first.image_height}`
                : '16 / 10',
            ...themeVars(theme),
          }}
        >
          {image ? (
            <img src={image} alt={first?.title || demo.title} />
          ) : (
            first?.kind === 'text' && <span className="share-preview__text">{first.title}</span>
          )}
          {image && hotspot && (
            <span className="p-beacon" style={beaconCenter(hotspot)} aria-hidden="true">
              <span className="p-beacon-dot" />
            </span>
          )}
        </div>
      )}
      <div className="share-preview__meta">
        <strong>{demo.title}</strong>
        {count !== null && count > 0 && <span className="fd-muted">{t('share.stepCount', { count })}</span>}
      </div>
      {published && (
        <a className="fd-btn fd-btn--sm fd-btn--block" href={previewUrl} target="_blank" rel="noreferrer">
          <span className="fd-btn__icon" aria-hidden="true">
            <ExternalLink />
          </span>
          {t('share.openPreview')}
        </a>
      )}
    </section>
  );
}
