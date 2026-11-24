import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { asCrop, croppedSize } from '@flowdsiml/player-core';
import { useToast } from '../../../components/Toast';
import { MEDIA_MAX_BYTES, useMedia, type MediaFile } from '../../../components/media/useMedia';
import { mediaUrl } from '../../../components/media/MediaLibrary';
import type { DemoEditor } from '../useDemoEditor';
import type { Selection, StepRow } from '../types';
import { asLayers, isFull, moveRect, placeNew, type ImageLayer } from './layers';
import { toRaster } from './raster';

export const LAYER_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
export const LAYER_ACCEPT = '.png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml';

/** Étapes qui reçoivent une image « appliquée à toutes les étapes » : les étapes à capture. */
const isCapture = (s: StepRow) => s.kind === 'image' && !!s.image_path;

/**
 * Actions sur les images ajoutées d'une étape. Une image appliquée à toutes les étapes est une copie
 * suivie (même `group`) : ses réglages changent partout en une seule annulation, comme une zone de flou.
 */
export function useLayerEdit(editor: DemoEditor, step: StepRow, setSelection: (s: Selection) => void) {
  const { t } = useTranslation();
  const toast = useToast();
  const layers = asLayers(step.options);
  const size = croppedSize(
    { width: step.image_width ?? 1280, height: step.image_height ?? 800 },
    asCrop((step.options as { crop?: unknown } | null)?.crop),
  );
  const frameRatio = size.width / Math.max(1, size.height);

  const write = (s: StepRow, list: ImageLayer[]) => {
    const opts: Record<string, unknown> = { ...((s.options ?? {}) as Record<string, unknown>) };
    if (list.length) opts.images = list;
    else delete opts.images;
    editor.updateStep(s.id, { options: opts as StepRow['options'] });
  };
  /** Ajout, retrait, ordre : une annulation à part (jamais fondue dans la modification d'avant). */
  const setLayers = (list: ImageLayer[]) => editor.batch(() => write(step, list));

  const clean = (l: ImageLayer): ImageLayer =>
    Object.fromEntries(Object.entries(l).filter(([, v]) => v !== undefined)) as ImageLayer;

  /** Modifie une image ; ses copies sur les autres étapes suivent (une annulation). */
  const patch = (l: ImageLayer, p: Partial<ImageLayer>) => {
    // Image de cette seule étape : les retouches qui se suivent (glisser, saisie) font une annulation
    if (!l.group)
      return write(
        step,
        layers.map((x) => (x.id === l.id ? clean({ ...x, ...p }) : x)),
      );
    editor.batch(() => {
      for (const s of editor.steps) {
        const list = asLayers(s.options);
        const isThis = s.id === step.id;
        if (!isThis && !(l.group && list.some((x) => x.group === l.group))) continue;
        write(
          s,
          list.map((x) =>
            (isThis && x.id === l.id) || (!isThis && x.group === l.group) ? clean({ ...x, ...p }) : x,
          ),
        );
      }
    });
  };

  const grouped = (l: ImageLayer) =>
    !!l.group &&
    editor.steps.some((s) => s.id !== step.id && asLayers(s.options).some((x) => x.group === l.group));

  const setScope = (l: ImageLayer, all: boolean) =>
    editor.batch(() => {
      if (all) {
        const group = l.group ?? `g${Date.now().toString(36)}`;
        const copy = { ...l, group };
        write(
          step,
          layers.map((x) => (x.id === l.id ? copy : x)),
        );
        for (const s of editor.steps) {
          if (s.id === step.id || !isCapture(s)) continue;
          const list = asLayers(s.options);
          if (!isFull(list) && !list.some((x) => x.group === group))
            write(s, [...list, { ...copy, id: list.some((x) => x.id === copy.id) ? newId() : copy.id }]);
        }
      } else if (l.group) {
        for (const s of editor.steps) {
          if (s.id === step.id) continue;
          const list = asLayers(s.options);
          if (list.some((x) => x.group === l.group))
            write(
              s,
              list.filter((x) => x.group !== l.group),
            );
        }
        write(
          step,
          layers.map((x) => (x.id === l.id ? clean({ ...x, group: undefined }) : x)),
        );
      }
    });

  /** Retire l'image de cette étape, avec « Annuler » dans le toast. */
  const remove = (l: ImageLayer) => {
    setLayers(layers.filter((x) => x.id !== l.id));
    setSelection({ kind: 'step' });
    toast(t('editor.image.removed'), { label: t('common.undo'), onClick: () => void editor.undo() });
  };

  const duplicate = (l: ImageLayer) => {
    if (isFull(layers)) return;
    const copy = clean({ ...l, ...moveRect(l, 0.02, 0.02), id: newId(), group: undefined });
    const i = layers.findIndex((x) => x.id === l.id);
    setLayers([...layers.slice(0, i + 1), copy, ...layers.slice(i + 1)]);
    setSelection({ kind: 'image', id: copy.id });
  };

  return { layers, frameRatio, setLayers, patch, grouped, setScope, remove, duplicate };
}

/** Ajout d'images : import d'un fichier (qui entre aussi dans la médiathèque) ou fichier de la médiathèque. */
export function useLayerImport(
  editor: DemoEditor,
  step: StepRow,
  wsId: string,
  setSelection: (s: Selection) => void,
) {
  const { t } = useTranslation();
  const toast = useToast();
  const media = useMedia(wsId);
  const [busy, setBusy] = useState(false);
  const { layers, frameRatio, setLayers } = useLayerEdit(editor, step, setSelection);

  /** Copie le fichier dans les captures de la démo (SVG converti en image) et pose l'image au centre. */
  const addBlob = async (blob: Blob, name: string): Promise<boolean> => {
    if (isFull(layers)) {
      toast(t('editor.image.full'), undefined, { tone: 'warning' });
      return false;
    }
    setBusy(true);
    try {
      const img = await toRaster(blob);
      const path = await editor.uploadLayer(img.blob);
      if (!path) throw new Error('upload');
      const id = newId();
      const ratio = img.width / Math.max(1, img.height);
      setLayers([
        ...layers,
        {
          id,
          path,
          name: name.slice(0, 120),
          ratio: Math.round(ratio * 1000) / 1000,
          ...placeNew(ratio, frameRatio),
        },
      ]);
      setSelection({ kind: 'image', id });
      return true;
    } catch {
      toast(t('editor.image.error'), undefined, { tone: 'warning' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  /** Import d'un fichier : il entre dans la médiathèque (catégorie Image), puis il est posé sur l'étape. */
  const importFile = async (file: File) => {
    if (!LAYER_TYPES.includes(file.type)) {
      toast(t('editor.image.badType'), undefined, { tone: 'warning' });
      return;
    }
    if (file.size > MEDIA_MAX_BYTES) {
      toast(t('editor.image.tooBig'), undefined, { tone: 'warning' });
      return;
    }
    if (isFull(layers)) {
      toast(t('editor.image.full'), undefined, { tone: 'warning' });
      return;
    }
    setBusy(true);
    const up = await media.upload(file, 'image');
    setBusy(false);
    if (!up.ok) {
      toast(
        t(
          up.error === 'tooBig'
            ? 'editor.image.tooBig'
            : up.error === 'badType' || up.error === 'svgRejected'
              ? 'editor.image.badType'
              : up.error === 'quota'
                ? 'editor.image.quota'
                : 'editor.image.error',
        ),
        undefined,
        { tone: 'warning' },
      );
      return;
    }
    // Le fichier gardé est celui de la médiathèque (SVG nettoyé par le serveur)
    await addFromMedia(up.file);
  };

  const mediaBlob = async (f: MediaFile): Promise<Blob | null> => {
    try {
      const res = await fetch(mediaUrl(f.path));
      if (!res.ok) return null;
      const blob = await res.blob();
      return blob.type ? blob : new Blob([blob], { type: f.mime });
    } catch {
      return null;
    }
  };

  const addFromMedia = async (f: MediaFile) => {
    const blob = await mediaBlob(f);
    if (!blob) {
      toast(t('editor.image.error'), undefined, { tone: 'warning' });
      return;
    }
    await addBlob(blob.type === f.mime ? blob : new Blob([blob], { type: f.mime }), f.name);
  };

  /** Fichier de la médiathèque rendu comme un fichier image (PNG, JPEG ou WebP) pour remplacer la capture. */
  const mediaAsFile = async (f: MediaFile): Promise<File | null> => {
    const blob = await mediaBlob(f);
    if (!blob) {
      toast(t('editor.image.error'), undefined, { tone: 'warning' });
      return null;
    }
    try {
      const img = await toRaster(new Blob([blob], { type: f.mime }));
      return new File([img.blob], f.name, { type: img.blob.type });
    } catch {
      toast(t('editor.image.error'), undefined, { tone: 'warning' });
      return null;
    }
  };

  return { busy, importFile, addFromMedia, mediaAsFile };
}

function newId() {
  return `i${crypto.randomUUID().slice(0, 8)}`;
}
