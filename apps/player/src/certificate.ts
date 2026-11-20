/**
 * L15-07 : attestation de suivi, créée dans le navigateur (PDF balisé, L35 ; chargé à la demande) à partir de la
 * réponse de issue_certificate. Rien n'est inventé : date de validation renvoyée par le serveur.
 */
import { fileName } from '@flowdsiml/exports/model';
import { planCertificate } from '@flowdsiml/exports/layout';
import type { CertificateInfo } from './api';

async function logoPng(url: string | null) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const img = new Image();
    const u = URL.createObjectURL(blob);
    img.src = u;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    const k = Math.min(256 / img.naturalWidth, 256 / img.naturalHeight);
    ctx.drawImage(
      img,
      (256 - img.naturalWidth * k) / 2,
      (256 - img.naturalHeight * k) / 2,
      img.naturalWidth * k,
      img.naturalHeight * k,
    );
    URL.revokeObjectURL(u);
    const out = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
    return out ? { data: new Uint8Array(await out.arrayBuffer()), format: 'PNG' as const } : null;
  } catch {
    return null;
  }
}

export async function downloadCertificate(
  info: Required<Omit<CertificateInfo, 'error'>>,
  lang: string,
  logoUrl: string | null,
) {
  const pdf = await import('@flowdsiml/exports/pdf-tagged');
  const fonts = await pdf.loadFonts();
  const measure = pdf.measureFor(fonts);
  const page = planCertificate(
    {
      workspace: info.workspace,
      learner: info.learner,
      path: info.path,
      modules: info.modules,
      validatedAt: info.validatedAt,
      generatedAt: new Date().toISOString(),
      certificateId: info.certificateId,
    },
    measure,
  );
  const buf = await pdf.renderPdf([page], {
    fonts,
    orientation: 'portrait',
    title: `Attestation de suivi · ${info.path}`,
    lang,
    author: info.workspace,
    logo: await logoPng(logoUrl),
  });
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `attestation-${fileName(info.path, 'pdf')}`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
