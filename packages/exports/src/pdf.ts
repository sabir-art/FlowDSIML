/**
 * Rendu jsPDF (MIT) d'un plan de pages (layout.ts). Police Plus Jakarta Sans embarquée (OFL).
 * jsPDF ne produit pas de PDF balisé : titre du document, langue et texte réel sont renseignés,
 * mais pas la structure H1/H2/H3 ni les textes alternatifs (écart signalé à la Lead UX).
 */
import { jsPDF } from 'jspdf';
import { onColor, type Block, type Measure, type Page, type Weight } from './layout';

/** Fichiers TTF en chaîne binaire, par graisse. */
export type FontFiles = Record<Weight, string>;

const FAMILY: Record<Weight, [string, string]> = {
  regular: ['PlusJakartaSans', 'normal'],
  bold: ['PlusJakartaSans', 'bold'],
  extrabold: ['PlusJakartaSansExtraBold', 'normal'],
};
const FILES: Record<Weight, string> = {
  regular: 'PlusJakartaSans-Regular.ttf',
  bold: 'PlusJakartaSans-Bold.ttf',
  extrabold: 'PlusJakartaSans-ExtraBold.ttf',
};

/** Espace fine insécable (absente de la police) remplacée par une espace insécable. */
export const pdfText = (s: string) => s.replace(/\u202f/g, '\u00a0');

export const bytesToBinary = (b: Uint8Array) => {
  let out = '';
  for (let i = 0; i < b.length; i += 0x8000) out += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return out;
};

/** Charge les polices du paquet (navigateur). */
export async function loadFonts(): Promise<FontFiles> {
  const get = async (w: Weight) => {
    const res = await fetch(new URL(`../fonts/${FILES[w]}`, import.meta.url));
    if (!res.ok) throw new Error('FONT_LOAD');
    return bytesToBinary(new Uint8Array(await res.arrayBuffer()));
  };
  const [regular, bold, extrabold] = await Promise.all([get('regular'), get('bold'), get('extrabold')]);
  return { regular, bold, extrabold };
}

export function createDoc(fonts: FontFiles, orientation: 'portrait' | 'landscape' = 'portrait'): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation, compress: true });
  for (const w of ['regular', 'bold', 'extrabold'] as Weight[]) {
    doc.addFileToVFS(FILES[w], fonts[w]);
    doc.addFont(FILES[w], FAMILY[w][0], FAMILY[w][1]);
  }
  doc.setFont(FAMILY.regular[0], FAMILY.regular[1]);
  return doc;
}

const PT = 0.3528;

/** Mesure exacte avec les métriques de la police embarquée. */
export function jsMeasure(doc: jsPDF): Measure {
  const setStyle = (size: number, weight: Weight) => {
    doc.setFont(FAMILY[weight][0], FAMILY[weight][1]);
    doc.setFontSize(size);
  };
  return {
    split(text, size, weight, maxWidth) {
      setStyle(size, weight);
      const out: string[] = [];
      for (const para of pdfText(text).split('\n')) {
        const lines = doc.splitTextToSize(para, maxWidth) as string[];
        out.push(...(lines.length ? lines : ['']));
      }
      return out;
    },
    width(text, size, weight) {
      setStyle(size, weight);
      return doc.getTextWidth(pdfText(text));
    },
  };
}

export interface PdfImage {
  /** Données JPEG ou PNG. */
  data: Uint8Array;
  format: 'JPEG' | 'PNG';
}

export interface RenderOptions {
  fonts: FontFiles;
  orientation: 'portrait' | 'landscape';
  /** Titre du document (affiché par le lecteur PDF). */
  title: string;
  lang: string;
  author: string;
  /** Capture d'une étape (déjà floutée), ou null. */
  image?: (step: number) => Promise<PdfImage | null>;
  /** Logo du workspace (PNG ou JPEG), sinon initiales. */
  logo?: PdfImage | null;
  onProgress?: (page: number, total: number) => void;
  signal?: AbortSignal;
}

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

function draw(doc: jsPDF, b: Block, img: Map<number, PdfImage | null>, logo: PdfImage | null | undefined) {
  switch (b.t) {
    case 'rect': {
      const mode = b.fill && b.stroke ? 'FD' : b.fill ? 'F' : 'S';
      if (b.fill) doc.setFillColor(...rgb(b.fill));
      if (b.stroke) {
        doc.setDrawColor(...rgb(b.stroke));
        doc.setLineWidth(b.lw ?? 0.3);
      }
      if (b.r) doc.roundedRect(b.x, b.y, b.w, b.h, b.r, b.r, mode);
      else doc.rect(b.x, b.y, b.w, b.h, mode);
      break;
    }
    case 'line':
      doc.setDrawColor(...rgb(b.color));
      doc.setLineWidth(b.lw);
      doc.line(b.x1, b.y1, b.x2, b.y2);
      break;
    case 'circle':
      doc.setFillColor(...rgb(b.fill));
      doc.circle(b.cx, b.cy, b.r, 'F');
      if (b.label) {
        doc.setFont(FAMILY.bold[0], FAMILY.bold[1]);
        doc.setFontSize(b.size ?? 8);
        doc.setTextColor(...rgb(b.labelColor ?? '#FFFFFF'));
        doc.text(b.label, b.cx, b.cy, { align: 'center', baseline: 'middle' });
      }
      break;
    case 'logo':
      if (logo) doc.addImage(logo.data, logo.format, b.x, b.y, b.size, b.size);
      else {
        doc.setFillColor(...rgb(b.color));
        doc.roundedRect(b.x, b.y, b.size, b.size, b.size * 0.22, b.size * 0.22, 'F');
        doc.setFont(FAMILY.extrabold[0], FAMILY.extrabold[1]);
        doc.setFontSize(b.size * (b.initials.length > 2 ? 1.05 : 1.35));
        doc.setTextColor(...rgb(onColor(b.color)));
        doc.text(b.initials, b.x + b.size / 2, b.y + b.size / 2, { align: 'center', baseline: 'middle' });
      }
      break;
    case 'image': {
      const im = img.get(b.step);
      if (im) doc.addImage(im.data, im.format, b.x, b.y, b.w, b.h, `step-${b.step}`, 'FAST');
      else {
        doc.setFillColor(241, 243, 246);
        doc.rect(b.x, b.y, b.w, b.h, 'F');
      }
      break;
    }
    case 'rich': {
      doc.setFontSize(b.size);
      doc.setTextColor(...rgb(b.color));
      const step = b.size * PT * b.lh;
      b.lines.forEach((line, i) => {
        for (const seg of line) {
          doc.setFont(FAMILY[seg.weight][0], FAMILY[seg.weight][1]);
          doc.text(pdfText(seg.text), b.x + seg.dx, b.y + i * step, { baseline: 'top' });
        }
      });
      break;
    }
    case 'text': {
      doc.setFont(FAMILY[b.weight][0], FAMILY[b.weight][1]);
      doc.setFontSize(b.size);
      doc.setTextColor(...rgb(b.color));
      const step = b.size * PT * b.lh;
      b.lines.forEach((line, i) => {
        doc.text(pdfText(line), b.x, b.y + i * step, { align: b.align ?? 'left', baseline: 'top' });
      });
      break;
    }
  }
}

const aborted = (s?: AbortSignal) => {
  if (s?.aborted) throw new DOMException('Export annulé', 'AbortError');
};

/** Dessine les pages et renvoie le PDF (ArrayBuffer). */
export async function renderPdf(pages: Page[], o: RenderOptions): Promise<ArrayBuffer> {
  const doc = createDoc(o.fonts, o.orientation);
  doc.setProperties({ title: o.title, author: o.author, creator: 'TutoClick', subject: o.title });
  doc.setLanguage(o.lang as Parameters<jsPDF['setLanguage']>[0]);
  doc.viewerPreferences({ DisplayDocTitle: true });
  const imgs = new Map<number, PdfImage | null>();
  for (let i = 0; i < pages.length; i++) {
    aborted(o.signal);
    if (i > 0) doc.addPage('a4', o.orientation);
    for (const b of pages[i]!.blocks) {
      if (b.t === 'image' && !imgs.has(b.step)) imgs.set(b.step, o.image ? await o.image(b.step) : null);
      aborted(o.signal);
    }
    for (const b of pages[i]!.blocks) draw(doc, b, imgs, o.logo);
    o.onProgress?.(i + 1, pages.length);
    // Laisse respirer l'interface (barre de progression) entre deux pages
    await new Promise((r) => setTimeout(r, 0));
  }
  return doc.output('arraybuffer');
}
