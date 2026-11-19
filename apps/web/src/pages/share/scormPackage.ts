/**
 * L16 : paquet SCORM d'un module, assemblé dans le navigateur (fflate, MIT). Il contient le lecteur
 * hors ligne, le manifeste et les captures de la version PUBLIÉE (flous déjà incrustés à la
 * publication). Aucun appel à TutoClick depuis le paquet, sauf option « statistiques » cochée.
 */
import { zipSync, strToU8, type Zippable } from 'fflate';
import { slugify } from '@flowdsiml/core';
import { parseManifest, type Manifest } from '@flowdsiml/manifest';
import { supabase } from '../../lib/supabase';
import { SUPABASE_URL } from '../../lib/env';

export type ScormVersion = '1.2' | '2004';
/** Critère de réussite : toutes les étapes vues (par défaut) ou quiz réussi avec un score minimum. */
export type PassCriterion = { kind: 'steps' } | { kind: 'quiz'; min: number };

export interface ScormOptions {
  version: ScormVersion;
  pass: PassCriterion;
  /** Envoyer aussi les statistiques à TutoClick (désactivé par défaut). */
  stats: boolean;
}

/** Plafond du paquet (spec L16 §4). */
export const MAX_PACKAGE_BYTES = 500 * 1024 * 1024;

/** Échec de génération, avec la cause affichée (capture illisible : numéro d'étape). */
export class ScormBuildError extends Error {
  constructor(
    readonly code: 'UNPUBLISHED' | 'IMAGE' | 'TOO_BIG' | 'SERVER',
    /** Capture illisible : numéro de l'étape (à partir de 1) et identifiant (lien vers l'éditeur). */
    readonly step: { n: number; id: string } | null = null,
  ) {
    super(code);
  }
}

const xml = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!,
  );

/** Nom du fichier : {slug}-scorm12.zip ou {slug}-scorm2004.zip. */
export const scormFileName = (title: string, version: ScormVersion) =>
  `${slugify(title, 60)}-scorm${version === '1.2' ? '12' : '2004'}.zip`;

/** imsmanifest.xml (SCORM 1.2 ou 2004 4e édition), un seul SCO. */
export function imsManifest(
  version: ScormVersion,
  args: { id: string; title: string; files: string[]; mastery: number | null },
): string {
  const title = xml(args.title || 'Module');
  const files = args.files.map((f) => `      <file href="${xml(f)}"/>`).join('\n');
  if (version === '1.2')
    return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="tutoclick-${xml(args.id)}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="org">
    <organization identifier="org">
      <title>${title}</title>
      <item identifier="item" identifierref="res" isvisible="true">
        <title>${title}</title>${args.mastery !== null ? `\n        <adlcp:masteryscore>${args.mastery}</adlcp:masteryscore>` : ''}
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res" type="webcontent" adlcp:scormtype="sco" href="index.html">
${files}
    </resource>
  </resources>
</manifest>
`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="tutoclick-${xml(args.id)}" version="1"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
  xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"
  xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd http://www.adlnet.org/xsd/adlseq_v1p3 adlseq_v1p3.xsd http://www.adlnet.org/xsd/adlnav_v1p3 adlnav_v1p3.xsd http://www.imsglobal.org/xsd/imsss imsss_v1p0.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
  </metadata>
  <organizations default="org">
    <organization identifier="org">
      <title>${title}</title>
      <item identifier="item" identifierref="res">
        <title>${title}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res" type="webcontent" adlcp:scormType="sco" href="index.html">
${files}
    </resource>
  </resources>
</manifest>
`;
}

/** Page d'entrée du SCO. */
export function indexHtml(title: string, lang: string): string {
  const t = title.replace(/[<>&"]/g, '');
  return `<!doctype html>
<html lang="${lang === 'en' ? 'en' : 'fr'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
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

/** Configuration lue par le lecteur hors ligne (window.TUTOCLICK_PACKAGE). */
export function packageJs(manifest: Manifest, opts: ScormOptions, trackUrl: string): string {
  const cfg = { manifest, scorm: opts.version, pass: opts.pass, stats: opts.stats ? { trackUrl } : null };
  return `window.TUTOCLICK_PACKAGE = ${JSON.stringify(cfg)};\n`;
}

export interface ScormBuild {
  bytes: Uint8Array;
  name: string;
  versionId: string;
  versionNumber: number;
}

/**
 * Assemble le paquet de la version publiée. `onProgress` : captures traitées / total (avancement réel).
 * `signal` : « Annuler la génération ».
 */
export async function buildScormPackage(
  demoId: string,
  opts: ScormOptions,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<ScormBuild> {
  const stop = () => {
    if (signal?.aborted) throw new DOMException('Annulé', 'AbortError');
  };
  const { data: d, error } = await supabase
    .from('demos')
    .select('id, title, status, current_version_id')
    .eq('id', demoId)
    .single();
  if (error || !d) throw new ScormBuildError('SERVER');
  if (d.status !== 'published' || !d.current_version_id) throw new ScormBuildError('UNPUBLISHED');
  const v = await supabase.from('demo_versions').select('number').eq('id', d.current_version_id).single();
  if (v.error || !v.data) throw new ScormBuildError('SERVER');
  const number = v.data.number ?? 1;
  stop();

  // Manifeste tel que publié (flous déjà incrustés dans les captures, variables par défaut)
  const jsonPath = `${demoId}/v${number}.json`;
  const sig = await supabase.storage.from('published').createSignedUrls([jsonPath], 600);
  const jsonUrl = sig.data?.[0]?.signedUrl;
  if (!jsonUrl) throw new ScormBuildError('SERVER');
  const res = await fetch(jsonUrl, { signal }).catch((e: unknown) => {
    stop();
    throw e instanceof ScormBuildError ? e : new ScormBuildError('SERVER');
  });
  if (!res.ok) throw new ScormBuildError('SERVER');
  const manifest = parseManifest(await res.json());
  // Première étape qui utilise chaque capture (cause affichée si elle est illisible)
  const firstStep = new Map<string, { n: number; id: string }>();
  manifest.steps.forEach((s, i) => {
    // L17 : la capture « Avant » d'une étape Avant / Après est embarquée comme les autres
    for (const u of [s.image?.url, s.beforeAfter?.before.url])
      if (u && !/^(https?:|data:|blob:)/.test(u) && !u.includes('..') && !firstStep.has(u))
        firstStep.set(u, { n: i + 1, id: s.id });
  });
  const images = [...firstStep.keys()];
  const files: Zippable = {};
  let total = 0;
  onProgress?.(0, images.length);
  if (images.length) {
    const { data } = await supabase.storage.from('published').createSignedUrls(
      images.map((p) => `${demoId}/${p}`),
      600,
    );
    const urls = new Map((data ?? []).map((s) => [s.path?.slice(demoId.length + 1), s.signedUrl]));
    let done = 0;
    for (const p of images) {
      stop();
      const u = urls.get(p);
      if (!u) throw new ScormBuildError('IMAGE', firstStep.get(p));
      const r = await fetch(u, { signal }).catch(() => null);
      stop();
      if (!r || !r.ok) throw new ScormBuildError(r && r.status >= 500 ? 'SERVER' : 'IMAGE', firstStep.get(p));
      const blob = await r.blob();
      // Capture illisible : vide, autre chose qu'une image, ou impossible à décoder
      const readable =
        blob.size > 0 &&
        (await createImageBitmap(blob).then(
          (b) => (b.close(), true),
          () => false,
        ));
      if (!readable) throw new ScormBuildError('IMAGE', firstStep.get(p));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      total += bytes.length;
      if (total > MAX_PACKAGE_BYTES) throw new ScormBuildError('TOO_BIG');
      // Images déjà compressées : stockées telles quelles
      files[p] = [bytes, { level: 0 }];
      onProgress?.(++done, images.length);
    }
  }

  const { js, css } = await import('virtual:tutoclick-offline');
  stop();
  const mastery = opts.pass.kind === 'quiz' ? opts.pass.min : null;
  files['index.html'] = strToU8(indexHtml(manifest.title || d.title, manifest.locale));
  files['package.js'] = strToU8(
    packageJs(manifest, opts, `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/track`),
  );
  files['tutoclick.js'] = strToU8(js);
  files['tutoclick.css'] = strToU8(css);
  files['imsmanifest.xml'] = strToU8(
    imsManifest(opts.version, {
      id: demoId,
      title: manifest.title || d.title,
      files: ['index.html', 'package.js', 'tutoclick.js', 'tutoclick.css', ...images],
      mastery,
    }),
  );
  const bytes = zipSync(files, { level: 6 });
  if (bytes.length > MAX_PACKAGE_BYTES) throw new ScormBuildError('TOO_BIG');
  return {
    bytes,
    name: scormFileName(manifest.title || d.title, opts.version),
    versionId: d.current_version_id,
    versionNumber: number,
  };
}
