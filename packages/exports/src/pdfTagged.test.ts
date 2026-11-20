import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PDF, planDemoPdf } from './layout';
import type { ExportDemo } from './model';
import { pdfkitMeasure, renderTaggedPdf, type PdfKitCtor, type TaggedFontFiles } from './pdfTagged';

const PDFDocument = createRequire(import.meta.url)('pdfkit') as PdfKitCtor;
const font = (f: string) => new Uint8Array(readFileSync(new URL(`../fonts/${f}`, import.meta.url)));
const fonts: TaggedFontFiles = {
  regular: font('PlusJakartaSans-Regular.ttf'),
  bold: font('PlusJakartaSans-Bold.ttf'),
  extrabold: font('PlusJakartaSans-ExtraBold.ttf'),
};
// PNG 1 × 1 transparent
const png = new Uint8Array(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64',
  ),
);
const demo = (n: number): ExportDemo => ({
  title: 'Créer une fiche usager',
  workspace: 'Mission Locale Exemple',
  brand: '#A3195B',
  logo: null,
  version: 3,
  url: 'https://tutos.example/d/fiche',
  context: 'Formation « Logiciel métier »',
  showBranding: false,
  steps: Array.from({ length: n }, (_, i) => ({
    title: `Étape ${i + 1} : cliquer sur le bouton`,
    text: 'Le formulaire s’ouvre dans un panneau à droite.',
    imageUrl: 'assets/s.webp',
    width: 1280,
    height: 800,
    target: { x: 0.4, y: 0.3, w: 0.1, h: 0.05 },
  })),
});

describe('renderTaggedPdf (L35)', () => {
  it('produit un PDF balisé : structure, titres, figures avec texte alternatif, langue', async () => {
    const m = pdfkitMeasure(PDFDocument, fonts);
    const pages = planDemoPdf(demo(5), DEFAULT_PDF, m);
    const buf = await renderTaggedPdf(PDFDocument, pages, {
      fonts,
      orientation: 'portrait',
      title: 'Créer une fiche usager',
      lang: 'fr-FR',
      author: 'Mission Locale Exemple',
      compress: false,
      image: async () => ({ data: png, format: 'PNG' }),
    });
    const raw = Buffer.from(buf).toString('latin1');
    // Fichier d'exemple pour une inspection manuelle (outil de validation externe)
    if (process.env.PDF_SAMPLE)
      (await import('node:fs')).writeFileSync(process.env.PDF_SAMPLE, Buffer.from(buf));
    expect(raw.startsWith('%PDF-1.7')).toBe(true);
    expect(raw).toMatch(/\/StructTreeRoot/);
    expect(raw).toMatch(/\/MarkInfo/);
    expect(raw).toMatch(/\/Lang \(fr-FR\)/);
    expect(raw).toMatch(/\/DisplayDocTitle true/);
    expect(raw).toMatch(/\/S \/H1/);
    expect(raw).toMatch(/\/S \/Figure/);
    expect(raw).toMatch(/\/Artifact/);
    expect(raw).toMatch(/pdfuaid:part/);
    expect((raw.match(/\/S \/Figure/g) ?? []).length).toBe(5);
  });
});
