// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- typage de PDFKit visible aussi quand web et player compilent ce paquet
/// <reference path="./pdfkit.d.ts" />
/**
 * L35 : PDF balisé dans le navigateur. PDFKit (MIT) en version autonome, chargé seulement à l'export.
 * Même forme que pdf.ts (polices, mesure, rendu) : l'aperçu et le fichier coupent les lignes pareil.
 */
import PDFKitStandalone from 'pdfkit/js/pdfkit.standalone.js';
import type { Measure, Page } from './layout';
import {
  pdfkitMeasure,
  renderTaggedPdf,
  type PdfKitCtor,
  type TaggedFontFiles,
  type TaggedRenderOptions,
} from './pdfTagged';

export type { TaggedFontFiles as FontFiles, TaggedImage as PdfImage } from './pdfTagged';

const PDFDocument = PDFKitStandalone as unknown as PdfKitCtor;

const FILES = {
  regular: 'PlusJakartaSans-Regular.ttf',
  bold: 'PlusJakartaSans-Bold.ttf',
  extrabold: 'PlusJakartaSans-ExtraBold.ttf',
} as const;

/** Polices du paquet, en octets. */
export async function loadFonts(): Promise<TaggedFontFiles> {
  const get = async (f: string) => {
    const res = await fetch(new URL(`../fonts/${f}`, import.meta.url));
    if (!res.ok) throw new Error('FONT_LOAD');
    return new Uint8Array(await res.arrayBuffer());
  };
  const [regular, bold, extrabold] = await Promise.all([
    get(FILES.regular),
    get(FILES.bold),
    get(FILES.extrabold),
  ]);
  return { regular, bold, extrabold };
}

export const measureFor = (fonts: TaggedFontFiles): Measure => pdfkitMeasure(PDFDocument, fonts);

export const renderPdf = (pages: Page[], o: TaggedRenderOptions): Promise<ArrayBuffer> =>
  renderTaggedPdf(PDFDocument, pages, o);
