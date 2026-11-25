/**
 * Retours du 24/11 (2e série) §8 : démo hors ligne (v1, sans lead ni suivi). Archive `.zip` autonome,
 * assemblée dans le navigateur (fflate, MIT) : `index.html`, le lecteur hors ligne, le manifeste de la
 * version PUBLIÉE et toutes ses ressources (captures avec flous et images ajoutées déjà incrustés à la
 * publication, pages entières, voix, vidéos et leurs images). Elle s'ouvre par double-clic, sans réseau.
 * Aucune requête sortante, aucune donnée gardée : les formulaires de lead sont retirés du manifeste et le
 * lecteur ne reçoit aucune adresse de suivi.
 */
import { zipSync, strToU8, type Zippable } from 'fflate';
import { slugify } from '@flowdsiml/core';
import { parseManifest, type Manifest } from '@flowdsiml/manifest';
import { supabase } from '../../lib/supabase';

/** Plafond d'une archive (spec §8). */
export const MAX_OFFLINE_BYTES = 300 * 1024 * 1024;

export class OfflineBuildError extends Error {
  constructor(
    readonly code: 'UNPUBLISHED' | 'ASSET' | 'TOO_BIG' | 'SERVER',
    /** Ressource illisible : numéro de l'étape (à partir de 1) et identifiant. */
    readonly step: { n: number; id: string } | null = null,
  ) {
    super(code);
  }
}

/** Chemin relatif d'une ressource publiée (jamais une adresse externe ni un chemin qui remonte). */
const local = (u: string | null | undefined): u is string =>
  !!u && !/^(https?:|data:|blob:)/.test(u) && !u.includes('..') && !u.startsWith('/');

/** Nom du fichier : `demo-crm-hors-ligne-2026-11-24.zip`. */
export function offlineFileName(title: string, day: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${slugify(title, 60)}-hors-ligne-${day.getFullYear()}-${p(day.getMonth() + 1)}-${p(day.getDate())}.zip`;
}

/**
 * Ressources de la démo à embarquer, dans l'ordre des étapes, sans doublon : captures, capture « Avant »,
 * page entière, voix, vidéo et images de ses pauses. Chaque chemin garde la première étape qui l'utilise
 * (cause affichée s'il est illisible).
 */
export function offlineAssets(m: Manifest): Array<{ path: string; step: { n: number; id: string } }> {
  const out = new Map<string, { n: number; id: string }>();
  m.steps.forEach((s, i) => {
    const paths = [
      s.image?.url,
      s.beforeAfter?.before.url,
      s.options.fullPage?.url,
      s.voice?.src,
      s.video?.url,
      ...Object.values(s.video?.frames ?? {}),
    ];
    for (const u of paths) if (local(u) && !out.has(u)) out.set(u, { n: i + 1, id: s.id });
  });
  return [...out].map(([path, step]) => ({ path, step }));
}

/** v1 sans lead : les formulaires disparaissent du manifeste embarqué, aucune étape n'en dépend. */
export function stripForOffline(m: Manifest): Manifest {
  return { ...m, forms: [], steps: m.steps.map((s) => ({ ...s, gateFormId: null })) };
}

/** Page d'entrée de l'archive (scripts classiques : elle s'ouvre depuis le disque, sans serveur). */
export function offlineIndexHtml(title: string, lang: string): string {
  const t = title.replace(/[<>&"]/g, '');
  return `<!doctype html>
<html lang="${lang === 'en' ? 'en' : 'fr'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>${t}</title>
<link rel="stylesheet" href="tutoclick.css">
</head>
<body>
<div id="root"></div>
<script src="package.js"></script>
<script src="tutoclick.js"></script>
</body>
</html>
`;
}

/** Configuration lue par le lecteur hors ligne : ni LMS, ni suivi. */
export function offlinePackageJs(manifest: Manifest): string {
  const cfg = { manifest, scorm: null, offline: true, stats: null };
  // « </script> » ne peut pas fermer la balise depuis un texte de la démo
  return `window.TUTOCLICK_PACKAGE = ${JSON.stringify(cfg).replace(/</g, '\\u003c')};\n`;
}

/** LISEZ-MOI.txt : comment ouvrir l'archive, ce qu'elle ne fait pas. */
export function offlineReadme(title: string, lang: string): string {
  const lines =
    lang === 'en'
      ? [
          `${title} — offline demo`,
          '',
          'How to open it',
          '1. Unzip the whole archive into a folder (do not open it from inside the .zip).',
          '2. Double-click index.html. It opens in Chrome, Edge, Firefox or Safari, with no network.',
          '',
          'Good to know',
          '- Anyone who has this file can see the demo, without a password.',
          '- Nothing is sent or stored: no statistics, no lead form.',
          '- External links are shown but only work online.',
          '- This copy does not update itself: generate a new archive after republishing the demo.',
        ]
      : [
          `${title} — démo hors ligne`,
          '',
          'Comment l’ouvrir',
          '1. Décompressez toute l’archive dans un dossier (ne l’ouvrez pas depuis l’intérieur du .zip).',
          '2. Double-cliquez sur index.html. Il s’ouvre dans Chrome, Edge, Firefox ou Safari, sans réseau.',
          '',
          'À savoir',
          '- Toute personne qui a ce fichier voit la démo, sans mot de passe.',
          '- Rien n’est envoyé ni gardé : pas de statistiques, pas de formulaire de lead.',
          '- Les liens externes restent visibles mais ne s’ouvrent qu’en ligne.',
          '- Cette copie ne se met pas à jour : refaites l’archive après une republication de la démo.',
        ];
  return `${lines.join('\r\n')}\r\n`;
}

interface Published {
  title: string;
  number: number;
  manifest: Manifest;
}

/** Manifeste de la version en ligne (tel que publié). */
async function loadPublished(demoId: string, signal?: AbortSignal): Promise<Published> {
  const { data: d, error } = await supabase
    .from('demos')
    .select('id, title, status, current_version_id')
    .eq('id', demoId)
    .single();
  if (error || !d) throw new OfflineBuildError('SERVER');
  if (d.status !== 'published' || !d.current_version_id) throw new OfflineBuildError('UNPUBLISHED');
  const v = await supabase.from('demo_versions').select('number').eq('id', d.current_version_id).single();
  if (v.error || !v.data) throw new OfflineBuildError('SERVER');
  const number = v.data.number ?? 1;
  const sig = await supabase.storage.from('published').createSignedUrls([`${demoId}/v${number}.json`], 600);
  const url = sig.data?.[0]?.signedUrl;
  if (!url) throw new OfflineBuildError('SERVER');
  const res = await fetch(url, { signal }).catch(() => null);
  if (signal?.aborted) throw new DOMException('Annulé', 'AbortError');
  if (!res?.ok) throw new OfflineBuildError('SERVER');
  return { title: d.title, number, manifest: parseManifest(await res.json()) };
}

/** Adresses signées des ressources (10 min), par chemin relatif. */
async function signedUrls(demoId: string, paths: string[]): Promise<Map<string, string>> {
  if (!paths.length) return new Map();
  const { data } = await supabase.storage.from('published').createSignedUrls(
    paths.map((p) => `${demoId}/${p}`),
    600,
  );
  return new Map(
    (data ?? []).flatMap((s) =>
      s.path && s.signedUrl ? [[s.path.slice(demoId.length + 1), s.signedUrl]] : [],
    ),
  );
}

/**
 * Taille estimée de l'archive avant de la générer : le lecteur, plus le poids annoncé de chaque ressource
 * (requête d'en-tête seulement, rien n'est téléchargé). `null` si le serveur ne l'annonce pas.
 */
export async function estimateOfflineSize(
  demoId: string,
  signal?: AbortSignal,
): Promise<{ bytes: number | null; files: number }> {
  const { manifest } = await loadPublished(demoId, signal);
  const assets = offlineAssets(manifest);
  const urls = await signedUrls(
    demoId,
    assets.map((a) => a.path),
  );
  const { js, css } = await import('virtual:tutoclick-offline');
  let bytes: number | null = js.length + css.length + JSON.stringify(manifest).length;
  const sizes = await Promise.all(
    assets.map(async (a) => {
      const u = urls.get(a.path);
      if (!u) return null;
      const r = await fetch(u, { method: 'HEAD', signal }).catch(() => null);
      const n = Number(r?.ok ? r.headers.get('content-length') : NaN);
      return Number.isFinite(n) && n > 0 ? n : null;
    }),
  );
  for (const n of sizes) bytes = bytes === null || n === null ? null : bytes + n;
  return { bytes, files: assets.length };
}

export interface OfflineBuild {
  bytes: Uint8Array;
  name: string;
  versionNumber: number;
  files: number;
}

/**
 * Assemble l'archive de la version publiée. `onProgress` : ressources traitées / total (avancement réel).
 * `signal` : « Annuler ».
 */
export async function buildOfflinePackage(
  demoId: string,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<OfflineBuild> {
  const stop = () => {
    if (signal?.aborted) throw new DOMException('Annulé', 'AbortError');
  };
  const { title, number, manifest: published } = await loadPublished(demoId, signal);
  stop();
  const manifest = stripForOffline(published);
  const assets = offlineAssets(manifest);
  const urls = await signedUrls(
    demoId,
    assets.map((a) => a.path),
  );
  const files: Zippable = {};
  let total = 0;
  let done = 0;
  onProgress?.(0, assets.length);
  for (const a of assets) {
    stop();
    const u = urls.get(a.path);
    if (!u) throw new OfflineBuildError('ASSET', a.step);
    const r = await fetch(u, { signal }).catch(() => null);
    stop();
    if (!r?.ok) throw new OfflineBuildError(r && r.status >= 500 ? 'SERVER' : 'ASSET', a.step);
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (!bytes.length) throw new OfflineBuildError('ASSET', a.step);
    total += bytes.length;
    if (total > MAX_OFFLINE_BYTES) throw new OfflineBuildError('TOO_BIG');
    // Images, sons et vidéos déjà compressés : stockés tels quels
    files[a.path] = [bytes, { level: 0 }];
    onProgress?.(++done, assets.length);
  }
  const { js, css } = await import('virtual:tutoclick-offline');
  stop();
  const name = manifest.title || title;
  files['index.html'] = strToU8(offlineIndexHtml(name, manifest.locale));
  files['package.js'] = strToU8(offlinePackageJs(manifest));
  files['tutoclick.js'] = strToU8(js);
  files['tutoclick.css'] = strToU8(css);
  files['LISEZ-MOI.txt'] = strToU8(offlineReadme(name, manifest.locale));
  const bytes = zipSync(files, { level: 6 });
  if (bytes.length > MAX_OFFLINE_BYTES) throw new OfflineBuildError('TOO_BIG');
  return { bytes, name: offlineFileName(name), versionNumber: number, files: assets.length };
}
