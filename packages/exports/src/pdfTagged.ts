/**
 * L35 : rendu PDF balisé (PDFKit, MIT) du même plan de pages que pdf.ts (layout.ts).
 * - Arbre de structure : Document > Sect (une par page) > H1 / H2 / H3 / P / Figure, dans l'ordre du plan,
 *   qui est l'ordre de lecture.
 * - Captures : élément Figure avec texte alternatif (« Capture de l'écran, étape n : titre »).
 * - Fonds, filets, pastilles numérotées et logo : marqués « Artifact » (décor ignoré par les lecteurs
 *   d'écran ; le numéro d'étape figure déjà dans le titre).
 * - Langue du document, titre affiché par le lecteur PDF, métadonnées PDF/UA (identifiant pdfuaid).
 * La classe PDFKit est fournie par l'appelant : version autonome dans le navigateur (chargée à la demande),
 * version Node dans les tests.
 */
import { onColor, type Block, type Measure, type Page, type Weight } from './layout';

/** Polices TTF en octets, par graisse. */
export type TaggedFontFiles = Record<Weight, ArrayBuffer | Uint8Array>;

export interface TaggedImage {
  data: Uint8Array;
  format: 'JPEG' | 'PNG';
}

export interface TaggedRenderOptions {
  fonts: TaggedFontFiles;
  orientation: 'portrait' | 'landscape';
  title: string;
  lang: string;
  author: string;
  image?: (step: number) => Promise<TaggedImage | null>;
  logo?: TaggedImage | null;
  onProgress?: (page: number, total: number) => void;
  signal?: AbortSignal;
  /** Contenu des pages compressé (par défaut) ; désactivé dans les tests pour lire les marquages. */
  compress?: boolean;
}

/* Sous-ensemble de l'API PDFKit utilisé ici (typage local : le paquet n'a pas de types). */
type StructElem = { add(child: StructElem | (() => void)): StructElem; end(): void };
export interface PdfKitDoc {
  registerFont(name: string, src: ArrayBuffer | Uint8Array): PdfKitDoc;
  font(name: string): PdfKitDoc;
  fontSize(size: number): PdfKitDoc;
  fillColor(c: string): PdfKitDoc;
  strokeColor(c: string): PdfKitDoc;
  lineWidth(w: number): PdfKitDoc;
  rect(x: number, y: number, w: number, h: number): PdfKitDoc;
  roundedRect(x: number, y: number, w: number, h: number, r: number): PdfKitDoc;
  circle(x: number, y: number, r: number): PdfKitDoc;
  moveTo(x: number, y: number): PdfKitDoc;
  lineTo(x: number, y: number): PdfKitDoc;
  fill(c?: string): PdfKitDoc;
  stroke(c?: string): PdfKitDoc;
  fillAndStroke(f?: string, s?: string): PdfKitDoc;
  text(s: string, x: number, y: number, o?: Record<string, unknown>): PdfKitDoc;
  widthOfString(s: string): number;
  currentLineHeight(includeGap?: boolean): number;
  image(src: ArrayBuffer | Uint8Array, x: number, y: number, o?: Record<string, unknown>): PdfKitDoc;
  addPage(o?: Record<string, unknown>): PdfKitDoc;
  struct(type: string, options?: Record<string, unknown>, children?: () => void): StructElem;
  struct(type: string, children?: () => void): StructElem;
  addStructure(e: StructElem): PdfKitDoc;
  markContent(tag: string, options?: Record<string, unknown>): PdfKitDoc;
  endMarkedContent(): PdfKitDoc;
  on(ev: 'data', cb: (chunk: Uint8Array) => void): void;
  on(ev: 'end', cb: () => void): void;
  end(): void;
}
export type PdfKitCtor = new (options: Record<string, unknown>) => PdfKitDoc;

const MM = 72 / 25.4;
const PT_TO_MM = 25.4 / 72;
const FONT: Record<Weight, string> = { regular: 'J400', bold: 'J700', extrabold: 'J800' };
const ROLE: Record<string, string> = { h1: 'H1', h2: 'H2', h3: 'H3', p: 'P' };

/** Copie exacte en ArrayBuffer (PDFKit refuse un Uint8Array qui n'est pas un Buffer Node). */
const ab = (b: ArrayBuffer | Uint8Array): ArrayBuffer =>
  b instanceof Uint8Array ? (b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer) : b;

/** Espace fine insécable (absente de la police) remplacée par une espace insécable. */
const pdfText = (s: string) => s.replace(/\u202f/g, '\u00a0');

function newDoc(
  PDFDocument: PdfKitCtor,
  o: Pick<TaggedRenderOptions, 'fonts' | 'title' | 'lang' | 'author' | 'compress'>,
) {
  const doc = new PDFDocument({
    autoFirstPage: false,
    compress: o.compress ?? true,
    tagged: true,
    lang: o.lang,
    displayTitle: true,
    pdfVersion: '1.7',
    subset: 'PDF/UA',
    info: { Title: o.title, Author: o.author, Subject: o.title, Creator: 'TutoClick' },
  });
  for (const w of ['regular', 'bold', 'extrabold'] as Weight[]) doc.registerFont(FONT[w], ab(o.fonts[w]));
  return doc;
}

/** Mesure du texte avec les métriques PDFKit (millimètres), pour que les coupures suivent le rendu. */
export function pdfkitMeasure(PDFDocument: PdfKitCtor, fonts: TaggedFontFiles): Measure {
  const doc = newDoc(PDFDocument, { fonts, title: '', lang: 'fr', author: '' });
  const style = (size: number, weight: Weight) => doc.font(FONT[weight]).fontSize(size);
  const width = (text: string, size: number, weight: Weight) =>
    style(size, weight).widthOfString(pdfText(text)) * PT_TO_MM;
  return {
    width,
    split(text, size, weight, maxWidth) {
      const out: string[] = [];
      for (const para of pdfText(text).split('\n')) {
        const words = para.split(/(?<= )/);
        let line = '';
        for (const w of words) {
          if (line && width((line + w).trimEnd(), size, weight) > maxWidth) {
            out.push(line.trimEnd());
            line = w;
          } else line += w;
        }
        out.push(line.trimEnd());
      }
      return out;
    },
  };
}

const aborted = (s?: AbortSignal) => {
  if (s?.aborted) throw new DOMException('Export annulé', 'AbortError');
};

/** Hauteur de ligne PDFKit pour aligner le haut du texte sur celui de jsPDF (baseline « top »). */
function textTop(doc: PdfKitDoc, yMm: number) {
  return yMm * MM;
}

function artifact(doc: PdfKitDoc, draw: () => void) {
  doc.markContent('Artifact', { type: 'Layout' });
  draw();
  doc.endMarkedContent();
}

function drawBlock(
  doc: PdfKitDoc,
  sect: StructElem,
  pageH: number,
  b: Block,
  imgs: Map<number, TaggedImage | null>,
  logo: TaggedImage | null | undefined,
) {
  switch (b.t) {
    case 'rect':
      artifact(doc, () => {
        const shape = b.r
          ? doc.roundedRect(b.x * MM, b.y * MM, b.w * MM, b.h * MM, b.r * MM)
          : doc.rect(b.x * MM, b.y * MM, b.w * MM, b.h * MM);
        if (b.stroke) doc.lineWidth((b.lw ?? 0.3) * MM);
        if (b.fill && b.stroke) shape.fillAndStroke(b.fill, b.stroke);
        else if (b.fill) shape.fill(b.fill);
        else shape.stroke(b.stroke);
      });
      break;
    case 'line':
      artifact(doc, () => {
        doc
          .lineWidth(b.lw * MM)
          .moveTo(b.x1 * MM, b.y1 * MM)
          .lineTo(b.x2 * MM, b.y2 * MM)
          .stroke(b.color);
      });
      break;
    case 'circle':
      artifact(doc, () => {
        doc.circle(b.cx * MM, b.cy * MM, b.r * MM).fill(b.fill);
        if (b.label) {
          const size = b.size ?? 8;
          doc
            .font(FONT.bold)
            .fontSize(size)
            .fillColor(b.labelColor ?? '#FFFFFF');
          const w = doc.widthOfString(b.label);
          doc.text(b.label, b.cx * MM - w / 2, b.cy * MM - doc.currentLineHeight() / 2, { lineBreak: false });
        }
      });
      break;
    case 'logo':
      artifact(doc, () => {
        const s = b.size * MM;
        if (logo) doc.image(ab(logo.data), b.x * MM, b.y * MM, { width: s, height: s });
        else {
          doc.roundedRect(b.x * MM, b.y * MM, s, s, s * 0.22).fill(b.color);
          doc
            .font(FONT.extrabold)
            .fontSize(b.size * (b.initials.length > 2 ? 1.05 : 1.35))
            .fillColor(onColor(b.color));
          const w = doc.widthOfString(b.initials);
          doc.text(b.initials, b.x * MM + s / 2 - w / 2, b.y * MM + s / 2 - doc.currentLineHeight() / 2, {
            lineBreak: false,
          });
        }
      });
      break;
    case 'image': {
      const im = imgs.get(b.step);
      if (im)
        sect.add(
          doc.struct('Figure', { alt: b.alt }, () => {
            doc.image(ab(im.data), b.x * MM, b.y * MM, { width: b.w * MM, height: b.h * MM });
          }),
        );
      else artifact(doc, () => doc.rect(b.x * MM, b.y * MM, b.w * MM, b.h * MM).fill('#F1F3F6'));
      break;
    }
    case 'rich': {
      const step = b.size * PT_TO_MM * b.lh;
      sect.add(
        doc.struct('P', () => {
          doc.fontSize(b.size).fillColor(b.color);
          b.lines.forEach((line, i) => {
            for (const seg of line)
              doc
                .font(FONT[seg.weight])
                .text(pdfText(seg.text), (b.x + seg.dx) * MM, textTop(doc, b.y + i * step), {
                  lineBreak: false,
                });
          });
        }),
      );
      break;
    }
    case 'text': {
      const step = b.size * PT_TO_MM * b.lh;
      const draw = () => {
        doc.font(FONT[b.weight]).fontSize(b.size).fillColor(b.color);
        b.lines.forEach((line, i) => {
          const s = pdfText(line);
          const w = doc.widthOfString(s);
          const x = b.align === 'center' ? b.x * MM - w / 2 : b.align === 'right' ? b.x * MM - w : b.x * MM;
          doc.text(s, x, textTop(doc, b.y + i * step), { lineBreak: false });
        });
      };
      // Sans rôle : paragraphe, sauf l'en-tête courant et le pied de page (titre répété, numéro de page),
      // marqués comme décor de pagination
      const running = !b.role && (b.y < 14 || b.y > pageH - 12);
      if (running) artifact(doc, draw);
      else sect.add(doc.struct(ROLE[b.role ?? 'p']!, draw));
      break;
    }
  }
}

/** Dessine les pages balisées et renvoie le PDF (ArrayBuffer). */
export async function renderTaggedPdf(
  PDFDocument: PdfKitCtor,
  pages: Page[],
  o: TaggedRenderOptions,
): Promise<ArrayBuffer> {
  const doc = newDoc(PDFDocument, o);
  const chunks: Uint8Array[] = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise<void>((resolve) => doc.on('end', resolve));
  const root = doc.struct('Document');
  doc.addStructure(root);
  const imgs = new Map<number, TaggedImage | null>();
  for (let i = 0; i < pages.length; i++) {
    aborted(o.signal);
    const page = pages[i]!;
    for (const b of page.blocks) {
      if (b.t === 'image' && !imgs.has(b.step)) imgs.set(b.step, o.image ? await o.image(b.step) : null);
      aborted(o.signal);
    }
    doc.addPage({ size: 'A4', layout: o.orientation, margin: 0 });
    const sect = doc.struct('Sect', { title: page.label });
    root.add(sect);
    const pageH = o.orientation === 'landscape' ? 210 : 297;
    for (const b of page.blocks) drawBlock(doc, sect, pageH, b, imgs, o.logo);
    sect.end();
    o.onProgress?.(i + 1, pages.length);
    await new Promise((r) => setTimeout(r, 0));
  }
  root.end();
  doc.end();
  await done;
  const size = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out.buffer;
}
