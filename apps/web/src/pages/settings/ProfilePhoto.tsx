/**
 * Retours client 21/11 §4.1 à §4.3 : photo de profil.
 * - Ligne « Photo » : avatar de 64 px (photo ou initiale), « Choisir une photo », « Retirer ».
 * - Fichier vérifié dans le navigateur (JPG, PNG, WebP, 2 Mo au plus ; le bucket l'impose aussi).
 * - « Recadrer la photo » : zone carrée, aperçu rond de 96 px, zoom de 100 à 300 %, glisser ou
 *   flèches (8 px). Recadrage et réduction dans le navigateur en 256 × 256 WebP : le réencodage par
 *   canvas retire les métadonnées EXIF (dont la position GPS) ; seule cette image est envoyée.
 * - Bucket privé « avatars », chemin non devinable <uid>/<uuid>.webp ; « Retirer » supprime le fichier.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert, Crop, ImagePlus } from 'lucide-react';
import { Button, Modal, Slider } from '@flowdsiml/ui';
import { supabase } from '../../lib/supabase';
import { check } from '../../lib/useAction';
import { useAuth } from '../../auth/AuthProvider';
import { initials } from '../../lib/initials';
import { AvatarPhoto, setAvatarPath } from '../../components/AvatarPhoto';
import { useToast } from '../../components/Toast';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024;
/** Côté de la zone de recadrage (px) et de l'image envoyée. */
const BOX = 280;
const OUT = 256;
const PREVIEW = 96;
const STEP = 8;

export function ProfilePhoto() {
  const { t } = useTranslation();
  const toast = useToast();
  const { user, profile, refreshProfile } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const path = profile?.avatar_path ?? null;

  const pick = (f: File | undefined) => {
    setError('');
    if (!f) return;
    if (!TYPES.includes(f.type)) return setError(t('profile.photo.badType'));
    if (f.size > MAX_BYTES) return setError(t('profile.photo.tooBig'));
    setFile(f);
  };

  async function save(blob: Blob) {
    if (!user) return;
    const next = `${user.id}/${crypto.randomUUID()}.webp`;
    check(
      await supabase.storage.from('avatars').upload(next, blob, { contentType: 'image/webp', upsert: false }),
    );
    check(await supabase.from('profiles').update({ avatar_path: next }).eq('id', user.id));
    if (path) await supabase.storage.from('avatars').remove([path]);
    setAvatarPath(user.id, next);
    await refreshProfile();
    toast(t('profile.photo.saved'));
  }

  async function remove() {
    if (!user || !path) return;
    setBusy(true);
    try {
      check(await supabase.from('profiles').update({ avatar_path: null }).eq('id', user.id));
      await supabase.storage.from('avatars').remove([path]);
      setAvatarPath(user.id, null);
      await refreshProfile();
      toast(t('profile.photo.removed'));
    } catch {
      setError(t('profile.photo.failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stg-row pf-photo">
      <div className="stg-text" data-gap-exempt="">
        <div className="stg-lab" id="pf-photo-label">
          {t('profile.photo.label')}
        </div>
        <div id="pf-photo-help" className="stg-help">
          {t('profile.photo.help')}
        </div>
      </div>
      <div className="stg-ctl">
        <div className="stg-lr">
          <span className="avatar pf-photo__avatar" aria-hidden="true">
            {initials(profile?.full_name || user?.email || '?')}
            <AvatarPhoto userId={user?.id} />
          </span>
          <Button
            icon={<ImagePlus aria-hidden="true" />}
            aria-describedby="pf-photo-help"
            aria-controls="pf-photo-file"
            onClick={() => input.current?.click()}
            disabled={busy}
          >
            {t('profile.photo.choose')}
          </Button>
          {path && (
            <button type="button" className="stg-link-danger" onClick={() => void remove()} disabled={busy}>
              {t('profile.photo.remove')}
            </button>
          )}
        </div>
        {error && (
          <p className="stg-error" role="alert">
            <CircleAlert size={16} aria-hidden="true" />
            {error}
          </p>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept={TYPES.join(',')}
        /* COMP-01 §5 : le champ reste dans la page, masqué à l'œil et relié au bouton */
        id="pf-photo-file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {file && (
        <CropDialog
          file={file}
          onClose={() => setFile(null)}
          onSave={async (blob) => {
            try {
              await save(blob);
              setFile(null);
            } catch {
              setError(t('profile.photo.failed'));
              setFile(null);
            }
          }}
        />
      )}
    </div>
  );
}

/** Position de l'image dans la zone : décalage du coin haut gauche, échelle. */
interface View {
  x: number;
  y: number;
  zoom: number;
}

function CropDialog({
  file,
  onClose,
  onSave,
}: {
  file: File;
  onClose: () => void;
  onSave: (blob: Blob) => Promise<void>;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      setImg(im);
      const s = cover(im);
      setView({ zoom: 1, x: (BOX - im.naturalWidth * s) / 2, y: (BOX - im.naturalHeight * s) / 2 });
    };
    im.onerror = () => setFailed(true);
    im.src = url;
    return () => {
      // Effet rejoué (mode strict) ou fermeture : l'image en cours ne doit plus rien signaler
      im.onload = null;
      im.onerror = null;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  /** Échelle de base : l'image couvre la zone carrée à 100 %. */
  const cover = (im: HTMLImageElement) => BOX / Math.min(im.naturalWidth, im.naturalHeight);
  const scale = img ? cover(img) * view.zoom : 1;
  /** L'image couvre toujours la zone (pas de bord vide). */
  const clamp = (v: View): View => {
    if (!img) return v;
    const s = cover(img) * v.zoom;
    const minX = BOX - img.naturalWidth * s;
    const minY = BOX - img.naturalHeight * s;
    return { ...v, x: Math.min(0, Math.max(minX, v.x)), y: Math.min(0, Math.max(minY, v.y)) };
  };
  const setZoom = (zoom: number) =>
    setView((v) => {
      if (!img) return v;
      // Zoom autour du centre de la zone
      const before = cover(img) * v.zoom;
      const after = cover(img) * zoom;
      const cx = (BOX / 2 - v.x) / before;
      const cy = (BOX / 2 - v.y) / before;
      return clamp({ zoom, x: BOX / 2 - cx * after, y: BOX / 2 - cy * after });
    });

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    setView((v) => clamp({ ...v, x: d.x + e.clientX - d.px, y: d.y + e.clientY - d.py }));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const dx = e.key === 'ArrowLeft' ? STEP : e.key === 'ArrowRight' ? -STEP : 0;
    const dy = e.key === 'ArrowUp' ? STEP : e.key === 'ArrowDown' ? -STEP : 0;
    if (!dx && !dy) return;
    e.preventDefault();
    // Flèche droite : on voit plus à droite de l'image (l'image glisse vers la gauche)
    setView((v) => clamp({ ...v, x: v.x + dx, y: v.y + dy }));
  };

  async function save() {
    if (!img) return;
    setBusy(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = OUT;
      canvas.height = OUT;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, -view.x / scale, -view.y / scale, BOX / scale, BOX / scale, 0, 0, OUT, OUT);
      // Réencodage WebP : aucune métadonnée de l'original (EXIF, GPS) n'est reprise
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.9));
      if (!blob) throw new Error('encode');
      await onSave(blob);
    } finally {
      setBusy(false);
    }
  }

  const layer = (size: number) =>
    img && (
      <img
        src={img.src}
        alt=""
        draggable={false}
        className="pf-crop__img"
        style={{
          width: img.naturalWidth * scale * (size / BOX),
          height: img.naturalHeight * scale * (size / BOX),
          transform: `translate(${view.x * (size / BOX)}px, ${view.y * (size / BOX)}px)`,
        }}
      />
    );

  const pct = Math.round(view.zoom * 100);
  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      icon={<Crop />}
      title={t('profile.photo.cropTitle')}
      closeLabel={t('common.close')}
      className="pf-crop"
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={() => void save()} disabled={!img || busy}>
            {t('profile.photo.save')}
          </Button>
        </>
      }
    >
      <div className="pf-crop__body">
        {failed ? (
          <p role="alert" className="stg-error">
            <CircleAlert size={16} aria-hidden="true" />
            {t('profile.photo.badType')}
          </p>
        ) : (
          <div className="pf-crop__row">
            <div
              className="pf-crop__box"
              style={{ width: BOX, height: BOX }}
              role="group"
              aria-label={t('profile.photo.cropArea')}
              aria-describedby={`${id}-h`}
              tabIndex={0}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
              onKeyDown={onKey}
            >
              {layer(BOX)}
            </div>
            <div className="pf-crop__side">
              <span
                className="pf-crop__preview"
                style={{ width: PREVIEW, height: PREVIEW }}
                aria-hidden="true"
              >
                {layer(PREVIEW)}
              </span>
              <span className="stg-help">{t('profile.photo.preview')}</span>
            </div>
          </div>
        )}
        <p id={`${id}-h`} className="stg-help pf-crop__help">
          {t('profile.photo.cropHelp')}
        </p>
        <div className="fd-modal__field pf-crop__zoom">
          <span className="fd-modal__label pf-crop__zoom-l">
            <span id={`${id}-z`}>{t('profile.photo.zoom')}</span>
            <span className="muted">{pct} %</span>
          </span>
          <Slider
            min={100}
            max={300}
            step={1}
            value={pct}
            valueText={`${pct} %`}
            aria-labelledby={`${id}-z`}
            disabled={!img}
            onChange={(v) => setZoom(v / 100)}
          />
        </div>
      </div>
    </Modal>
  );
}
