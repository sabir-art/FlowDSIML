import type { Manifest } from '@flowdsiml/manifest';
import { applyVariables, computedVariables, richTextToPlain } from '@flowdsiml/core';

/** Une étape exportée : titre et texte de la bulle, capture (déjà floutée à la publication). */
export interface ExportStep {
  title: string;
  text: string;
  /** URL lisible de la capture publiée (signée), ou null pour une étape sans image. */
  imageUrl: string | null;
  width: number;
  height: number;
  /** Zone de la bulle sur la capture (0 à 1), pour le cadre et la pastille numérotée. */
  target: { x: number; y: number; w: number; h: number } | null;
  /**
   * L25-02 : zone gardée de la capture (relative à l'image d'origine), ou null. width et height
   * sont déjà ceux de la capture recadrée ; l'image chargée doit être découpée à cette zone.
   */
  crop?: { x: number; y: number; w: number; h: number } | null;
  /** L25-11 : zoom de l'éditeur (centre relatif, échelle). */
  zoom?: { x: number; y: number; scale: number } | null;
  /** L25-11 : animation de saisie ou de défilement (L25-04/05), jouée dans la vidéo. */
  animation?:
    | { type: 'typing'; text: string; field: { x: number; y: number; w: number; h: number } | null }
    | { type: 'scroll'; direction: 'down' | 'up'; distance: number; duration: number }
    | null;
  /** L25-11 : étape vidéo (L21) : fichier, durée, passages coupés au montage (ms). */
  video?: { url: string; durationMs: number; cuts: Array<{ from: number; to: number }> } | null;
  /** L25-05 : capture pleine page (URL lisible), position de départ et hauteur de la fenêtre (px). */
  fullPage?: { url: string; width: number; height: number; top: number; viewportHeight: number } | null;
  /** L29-04 : type d'étape, chapitre et transcription (voix off, sinon sous-titres de la vidéo). */
  kind?: 'image' | 'text' | 'html' | 'before_after' | 'video';
  chapterId?: string | null;
  transcript?: string;
  /** L29 §3.5 : texte alternatif saisi sur l'étape. */
  alt?: string;
}

export interface ExportDemo {
  title: string;
  workspace: string;
  /** Couleur principale du workspace (#RRGGBB). */
  brand: string;
  /** Logo en data URL (PNG ou JPEG), sinon initiales. */
  logo: string | null;
  version: number;
  /** Adresse du tutoriel en ligne, seulement si la démo est publiée. */
  url: string | null;
  /** Formation ou module (couverture), facultatif. */
  context: string;
  /** « Créé avec TutoClick » (plan Free seulement). */
  showBranding: boolean;
  steps: ExportStep[];
  /** L25-11 : démo capturée au format mobile (9:16 proposé par défaut). */
  device?: 'desktop' | 'mobile';
  /** L29 : langue de la démo (BCP 47, « fr-FR » par défaut). */
  lang?: string;
  /** L29-04 : chapitres (h2 de la version accessible). */
  chapters?: Array<{ id: string; title: string }>;
  /** L29-04 : questions du quiz ou du sondage (sans les réponses). */
  questions?: string[];
}

/** Langue de la démo en BCP 47 (« fr » → « fr-FR », « en » → « en-GB »). */
export function demoLang(locale: string | undefined): string {
  const l = (locale || 'fr').toLowerCase();
  if (/^[a-z]{2}-[a-z]{2}$/.test(l)) return `${l.slice(0, 2)}-${l.slice(3).toUpperCase()}`;
  return l.startsWith('en') ? 'en-GB' : 'fr-FR';
}

/**
 * Étapes à exporter depuis le manifeste PUBLIÉ (flous incrustés) : texte de la première bulle
 * (sinon titre et corps de l'étape), variables remplacées par leur valeur par défaut — jamais par
 * les données d'un apprenant. Les formulaires et commentaires ne sont pas dans le manifeste.
 */
export function stepsFromManifest(m: Manifest): ExportStep[] {
  // L46 : variables calculées (titre, nombre d'étapes, date) connues à l'export
  const defaults = {
    ...computedVariables({ title: m.title, stepCount: m.steps.length }, m.locale),
    ...Object.fromEntries(m.variables.map((v) => [v.key, v.default ?? ''])),
  };
  const txt = (s: string) => applyVariables(richTextToPlain(s), {}, defaults).trim();
  return m.steps.map((s) => {
    const h = s.hotspots[0];
    const c = s.kind === 'image' ? (s.options?.crop ?? null) : null;
    const a = s.kind === 'image' ? s.options?.animation : undefined;
    const fp = s.kind === 'image' ? s.options?.fullPage : undefined;
    const transcript =
      s.voice?.transcript ||
      (s.kind === 'video' && s.video ? s.video.captions.map((c) => c.text).join(' ') : '');
    return {
      kind: s.kind,
      chapterId: s.chapterId ?? null,
      alt: s.alt?.trim() || undefined,
      transcript: applyVariables(transcript, {}, defaults).trim(),
      video:
        s.kind === 'video' && s.video
          ? { url: s.video.url, durationMs: s.video.durationMs, cuts: s.video.cuts }
          : null,
      zoom: s.zoom ? { x: s.zoom.x, y: s.zoom.y, scale: s.zoom.scale } : null,
      animation:
        a?.type === 'typing'
          ? { type: 'typing', text: applyVariables(a.text, {}, defaults), field: a.field }
          : a?.type === 'scroll'
            ? { type: 'scroll', direction: a.direction, distance: a.distance, duration: a.duration }
            : null,
      fullPage:
        fp?.url && !c
          ? {
              url: fp.url,
              width: fp.width,
              height: fp.height,
              top: fp.top,
              viewportHeight: fp.viewportHeight,
            }
          : null,
      title: txt(h?.title || s.title || ''),
      text: txt(h?.body || s.body || ''),
      imageUrl: s.kind === 'image' && s.image ? s.image.url : null,
      width: Math.round((s.image?.width ?? 1280) * (c?.w ?? 1)),
      height: Math.round((s.image?.height ?? 800) * (c?.h ?? 1)),
      crop: c,
      target: h ? { x: h.x, y: h.y, w: h.w, h: h.h } : null,
    };
  });
}

/** Nom de fichier tiré du titre : minuscules, sans accents, tirets. */
export function fileName(
  title: string,
  ext: 'pdf' | 'gif' | 'mp4' | 'fr.vtt' | 'en.vtt' | 'accessible.html',
): string {
  const base = title
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return `${base || 'tutoriel'}${ext === 'accessible.html' ? '-' : '.'}${ext}`;
}

/** Durée du GIF en secondes : nombre d'étapes × vitesse. */
export const gifDuration = (steps: number, secondsPerStep: number) =>
  Math.round(steps * secondsPerStep * 10) / 10;

/** Poids lisible (« 1,2 Mo »). */
export function formatSize(bytes: number, locale = 'fr'): string {
  const units = locale.startsWith('en') ? ['B', 'KB', 'MB'] : ['o', 'Ko', 'Mo'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const n = new Intl.NumberFormat(locale.startsWith('en') ? 'en-GB' : 'fr-FR', {
    maximumFractionDigits: i === 0 ? 0 : 1,
  }).format(v);
  return `${n}\u202f${units[i]}`;
}
