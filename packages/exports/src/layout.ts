/**
 * L15-06 : mise en page des PDF en blocs positionnés (millimètres). Le même plan sert au rendu
 * jsPDF et à l'aperçu de la modale : le nombre de pages affiché est donc exact.
 */
import type { ExportDemo } from './model';

export type Weight = 'regular' | 'bold' | 'extrabold';
export type Block =
  | {
      t: 'rect';
      x: number;
      y: number;
      w: number;
      h: number;
      fill?: string;
      stroke?: string;
      lw?: number;
      r?: number;
    }
  | {
      t: 'text';
      x: number;
      y: number;
      lines: string[];
      size: number;
      weight: Weight;
      color: string;
      align?: 'left' | 'right' | 'center';
      lh: number;
      /** Rôle sémantique (titre du document et ordre de lecture). */
      role?: 'h1' | 'h2' | 'h3' | 'p';
    }
  | { t: 'image'; x: number; y: number; w: number; h: number; step: number; alt: string }
  | {
      t: 'circle';
      cx: number;
      cy: number;
      r: number;
      fill: string;
      label?: string;
      labelColor?: string;
      size?: number;
    }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; lw: number }
  | { t: 'logo'; x: number; y: number; size: number; initials: string; color: string }
  /** Paragraphe à graisses mêlées : chaque ligne est une suite de segments (x relatif en mm). */
  | {
      t: 'rich';
      x: number;
      y: number;
      lines: Array<Array<{ text: string; weight: Weight; dx: number }>>;
      size: number;
      color: string;
      lh: number;
      role?: 'p';
    };

/** Coupe un paragraphe à graisses mêlées en lignes de largeur maximale `maxWidth`. */
export function wrapRich(
  parts: Array<{ text: string; weight: Weight }>,
  size: number,
  maxWidth: number,
  m: Measure,
): Array<Array<{ text: string; weight: Weight; dx: number }>> {
  const words = parts.flatMap((p) =>
    p.text
      .split(/(?<= )/)
      .filter(Boolean)
      .map((w) => ({ text: w, weight: p.weight })),
  );
  const lines: Array<Array<{ text: string; weight: Weight; dx: number }>> = [];
  let cur: Array<{ text: string; weight: Weight; dx: number }> = [];
  let x = 0;
  for (const w of words) {
    const ww = m.width(w.text.trimEnd(), size, w.weight);
    if (x > 0 && x + ww > maxWidth) {
      lines.push(cur);
      cur = [];
      x = 0;
    }
    const last = cur[cur.length - 1];
    if (last && last.weight === w.weight) last.text += w.text;
    else cur.push({ text: w.text, weight: w.weight, dx: x });
    x += m.width(w.text, size, w.weight);
  }
  if (cur.length) lines.push(cur);
  return lines.map((l) =>
    l.map((seg, i) => (i === l.length - 1 ? { ...seg, text: seg.text.trimEnd() } : seg)),
  );
}

export interface Page {
  kind: 'cover' | 'steps' | 'list' | 'certificate';
  label: string;
  blocks: Block[];
}

export interface PdfOptions {
  layout: 'one' | 'two';
  images: boolean;
  text: boolean;
  numbering: boolean;
  cover: boolean;
  orientation: 'portrait' | 'landscape';
}

export const DEFAULT_PDF: PdfOptions = {
  layout: 'one',
  images: true,
  text: true,
  numbering: true,
  cover: true,
  orientation: 'portrait',
};

/** Mesure du texte (jsPDF en production ; approximation dans les tests). */
export interface Measure {
  split(text: string, size: number, weight: Weight, maxWidth: number): string[];
  width(text: string, size: number, weight: Weight): number;
}

export const INK = '#12161B';
export const MUTED = '#4A5562';
export const RULE = '#E3E8EE';
/** Repères sur les captures : framboise, vus sur toute image (jamais pour le texte courant). */
export const MARK = '#D60B52';
const M = 15;

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
};
export const contrastRatio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
};
/** Texte blanc ou encre sur une couleur de fond : celui qui contraste le plus. */
export const onColor = (hex: string) =>
  contrastRatio(hex, '#FFFFFF') >= contrastRatio(hex, INK) ? '#FFFFFF' : INK;
const LH = 1.35;
const PT = 0.3528; // 1 pt en mm

export const pageSize = (o: Pick<PdfOptions, 'orientation'>) =>
  o.orientation === 'landscape' ? { W: 297, H: 210 } : { W: 210, H: 297 };

/** Hauteur d'un bloc de texte (mm). */
const textH = (lines: number, size: number) => lines * size * PT * LH;

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const acronym = words.find((w) => /^[A-Z]{2,4}$/.test(w));
  if (acronym) return acronym;
  return (words.length > 1 ? words[0]![0]! + words[1]![0]! : (words[0]?.slice(0, 2) ?? '?')).toUpperCase();
}

function runningHeader(d: ExportDemo, W: number, m: Measure): Block[] {
  const title = m.split(d.title, 8.5, 'bold', W / 2 - M)[0] ?? '';
  const ws = m.split(d.workspace, 8.5, 'bold', W / 2 - M - 8)[0] ?? '';
  return [
    { t: 'text', x: M, y: 9, lines: [title], size: 8.5, weight: 'bold', color: MUTED, lh: LH },
    {
      t: 'logo',
      x: W - M - m.width(ws, 8.5, 'bold') - 7,
      y: 8.2,
      size: 5,
      initials: initialsOf(d.workspace),
      color: d.brand,
    },
    { t: 'text', x: W - M, y: 9, lines: [ws], size: 8.5, weight: 'bold', color: INK, align: 'right', lh: LH },
    { t: 'line', x1: M, y1: 16, x2: W - M, y2: 16, color: RULE, lw: 0.3 },
  ];
}

function footer(d: ExportDemo, W: number, H: number, n: number, total: number): Block[] {
  const out: Block[] = [
    {
      t: 'text',
      x: M,
      y: H - 10,
      lines: [`${d.workspace} · version ${d.version}`],
      size: 8,
      weight: 'regular',
      color: MUTED,
      lh: LH,
    },
    {
      t: 'text',
      x: W - M,
      y: H - 10,
      lines: [`Page ${n} / ${total}`],
      size: 8,
      weight: 'regular',
      color: MUTED,
      align: 'right',
      lh: LH,
    },
  ];
  if (d.showBranding)
    out.push({
      t: 'text',
      x: W / 2,
      y: H - 10,
      lines: ['Créé avec TutoClick'],
      size: 8,
      weight: 'regular',
      color: MUTED,
      align: 'center',
      lh: LH,
    });
  return out;
}

/** Bloc d'une étape (titre, texte, capture) dans une zone de hauteur donnée. */
function stepBlock(
  d: ExportDemo,
  i: number,
  o: PdfOptions,
  m: Measure,
  x: number,
  y: number,
  w: number,
  maxH: number,
  small: boolean,
): Block[] {
  const s = d.steps[i]!;
  const out: Block[] = [];
  const titleSize = small ? 12 : 14;
  const textSize = small ? 9.5 : 11;
  const indent = o.numbering ? 11 : 0;
  const title = o.numbering ? s.title || `Étape ${i + 1}` : `${i + 1}. ${s.title || `Étape ${i + 1}`}`;
  if (o.numbering)
    out.push({
      t: 'circle',
      cx: x + 4,
      cy: y + 4,
      r: 4,
      fill: '#080808',
      label: String(i + 1),
      labelColor: '#FFFFFF',
      size: 9,
    });
  const tl = m.split(title, titleSize, 'bold', w - indent);
  out.push({
    t: 'text',
    x: x + indent,
    y: y + 0.6,
    lines: tl,
    size: titleSize,
    weight: 'bold',
    color: INK,
    lh: LH,
    role: 'h3',
  });
  let cy = y + Math.max(8, textH(tl.length, titleSize) + 1.5);
  if (o.text && s.text) {
    const bl = m.split(s.text, textSize, 'regular', w - indent);
    out.push({
      t: 'text',
      x: x + indent,
      y: cy,
      lines: bl,
      size: textSize,
      weight: 'regular',
      color: MUTED,
      lh: LH,
      role: 'p',
    });
    cy += textH(bl.length, textSize) + 3;
  } else cy += 2;
  if (o.images && s.imageUrl) {
    const availH = y + maxH - cy;
    let iw = w;
    let ih = (iw * s.height) / s.width;
    if (ih > availH) {
      ih = Math.max(10, availH);
      iw = (ih * s.width) / s.height;
    }
    const ix = x + (w - iw) / 2;
    out.push({
      t: 'image',
      x: ix,
      y: cy,
      w: iw,
      h: ih,
      step: i,
      alt: `Capture de l'étape ${i + 1} : ${s.title}`,
    });
    out.push({ t: 'rect', x: ix, y: cy, w: iw, h: ih, stroke: RULE, lw: 0.3 });
    if (o.numbering && s.target) {
      const tx = ix + s.target.x * iw;
      const ty = cy + s.target.y * ih;
      out.push({
        t: 'rect',
        x: tx,
        y: ty,
        w: Math.max(2, s.target.w * iw),
        h: Math.max(2, s.target.h * ih),
        stroke: MARK,
        lw: 0.7,
        r: 1,
      });
      out.push({
        t: 'circle',
        cx: tx,
        cy: ty,
        r: 3,
        fill: MARK,
        label: String(i + 1),
        labelColor: '#FFFFFF',
        size: 7.5,
      });
    }
  }
  return out;
}

function coverPage(
  d: ExportDemo,
  W: number,
  H: number,
  m: Measure,
  toc: Array<{ n: number; title: string; page: number }>,
): Page {
  const band = H * 0.46;
  const on = onColor(d.brand);
  const blocks: Block[] = [{ t: 'rect', x: 0, y: 0, w: W, h: band, fill: d.brand }];
  blocks.push({
    t: 'text',
    x: M + 5,
    y: band - 70,
    lines: ['TUTORIEL'],
    size: 9,
    weight: 'extrabold',
    color: on,
    lh: LH,
  });
  const tl = m.split(d.title, 26, 'extrabold', W - 2 * M - 10);
  blocks.push({
    t: 'text',
    x: M + 5,
    y: band - 62,
    lines: tl,
    size: 26,
    weight: 'extrabold',
    color: on,
    lh: 1.15,
    role: 'h1',
  });
  if (d.context)
    blocks.push({
      t: 'text',
      x: M + 5,
      y: band - 62 + tl.length * 26 * PT * 1.15 + 4,
      lines: m.split(d.context, 11, 'regular', W - 2 * M - 10),
      size: 11,
      weight: 'regular',
      color: on,
      lh: LH,
    });
  let y = band + 12;
  const rows: Array<[string, string]> = [
    ['Étapes', String(d.steps.length)],
    ['Version', String(d.version)],
  ];
  if (d.url) rows.push(['Tutoriel en ligne', d.url.replace(/^https?:\/\//, '')]);
  for (const [k, v] of rows) {
    blocks.push({ t: 'text', x: M + 5, y, lines: [k], size: 9, weight: 'regular', color: MUTED, lh: LH });
    const vl = m.split(v, 10.5, 'bold', W - 2 * M - 55);
    blocks.push({ t: 'text', x: M + 50, y, lines: vl, size: 10.5, weight: 'bold', color: INK, lh: LH });
    y += Math.max(6.5, textH(vl.length, 10.5) + 2.5);
  }
  y += 4;
  blocks.push({
    t: 'text',
    x: M + 5,
    y,
    lines: ['Sommaire'],
    size: 11,
    weight: 'bold',
    color: INK,
    lh: LH,
    role: 'h2',
  });
  y += 8;
  const maxY = H - 32;
  const fit = Math.max(0, Math.floor((maxY - y) / 8.5));
  const shown = toc.length > fit ? Math.max(0, fit - 1) : toc.length;
  for (const e of toc.slice(0, shown)) {
    blocks.push({
      t: 'circle',
      cx: M + 8,
      cy: y + 2.2,
      r: 3,
      fill: d.brand,
      label: String(e.n),
      labelColor: on,
      size: 7.5,
    });
    blocks.push({
      t: 'text',
      x: M + 14,
      y,
      lines: [m.split(e.title || `Étape ${e.n}`, 10, 'regular', W - 2 * M - 34)[0] ?? ''],
      size: 10,
      weight: 'regular',
      color: INK,
      lh: LH,
    });
    blocks.push({
      t: 'text',
      x: W - M - 5,
      y,
      lines: [String(e.page)],
      size: 10,
      weight: 'bold',
      color: INK,
      align: 'right',
      lh: LH,
    });
    blocks.push({ t: 'line', x1: M + 5, y1: y + 6.2, x2: W - M - 5, y2: y + 6.2, color: RULE, lw: 0.25 });
    y += 8.5;
  }
  if (toc.length > shown) {
    const rest = toc.length - shown;
    blocks.push({
      t: 'text',
      x: M + 14,
      y,
      lines: [`… ${rest} autre${rest > 1 ? 's' : ''} étape${rest > 1 ? 's' : ''}`],
      size: 10,
      weight: 'regular',
      color: MUTED,
      lh: LH,
    });
  }
  blocks.push({ t: 'logo', x: M + 5, y: H - 20, size: 7, initials: initialsOf(d.workspace), color: d.brand });
  blocks.push({
    t: 'text',
    x: M + 14.5,
    y: H - 18.6,
    lines: [`${d.workspace} · document interne`],
    size: 9.5,
    weight: 'bold',
    color: INK,
    lh: LH,
  });
  return { kind: 'cover', label: 'Couverture et sommaire', blocks };
}

/** Plan complet du PDF d'une démo. */
export function planDemoPdf(d: ExportDemo, o: PdfOptions, m: Measure): Page[] {
  const { W, H } = pageSize(o);
  const top = 22;
  const bottom = H - 16;
  const body: Page[] = [];
  const stepPage: number[] = [];
  const offset = o.cover ? 1 : 0;
  if (o.images) {
    const per = o.layout === 'two' ? 2 : 1;
    for (let i = 0; i < d.steps.length; i += per) {
      const blocks: Block[] = [];
      const slot = (bottom - top) / per;
      for (let k = 0; k < per && i + k < d.steps.length; k++) {
        stepPage[i + k] = body.length + 1 + offset;
        blocks.push(
          ...stepBlock(d, i + k, o, m, M, top + k * slot + (k ? 4 : 0), W - 2 * M, slot - 6, per === 2),
        );
        if (per === 2 && k === 0 && i + 1 < d.steps.length)
          blocks.push({ t: 'line', x1: M, y1: top + slot, x2: W - M, y2: top + slot, color: RULE, lw: 0.3 });
      }
      body.push({
        kind: 'steps',
        label: per === 2 ? `Étapes ${i + 1} et ${Math.min(i + 2, d.steps.length)}` : `Étape ${i + 1}`,
        blocks,
      });
    }
  } else {
    // Sans captures : liste numérotée (titre et texte), séparée par un filet
    let blocks: Block[] = [
      {
        t: 'text',
        x: M,
        y: top,
        lines: ['Étapes'],
        size: 16,
        weight: 'extrabold',
        color: INK,
        lh: LH,
        role: 'h2',
      },
    ];
    let y = top + 11;
    const flush = () => {
      body.push({ kind: 'list', label: 'Étapes sans captures', blocks });
      blocks = [];
      y = top;
    };
    d.steps.forEach((s, i) => {
      const indent = o.numbering ? 10 : 0;
      const title = o.numbering ? s.title || `Étape ${i + 1}` : `${i + 1}. ${s.title || `Étape ${i + 1}`}`;
      const tl = m.split(title, 11, 'bold', W - 2 * M - indent);
      const bl = o.text && s.text ? m.split(s.text, 10, 'regular', W - 2 * M - indent) : [];
      const h = textH(tl.length, 11) + (bl.length ? textH(bl.length, 10) + 1 : 0) + 5;
      if (y + h > bottom) flush();
      stepPage[i] = body.length + 1 + offset;
      if (o.numbering)
        blocks.push({
          t: 'circle',
          cx: M + 3.5,
          cy: y + 2.4,
          r: 3.5,
          fill: '#080808',
          label: String(i + 1),
          labelColor: '#FFFFFF',
          size: 8,
        });
      blocks.push({
        t: 'text',
        x: M + indent,
        y,
        lines: tl,
        size: 11,
        weight: 'bold',
        color: INK,
        lh: LH,
        role: 'h3',
      });
      if (bl.length)
        blocks.push({
          t: 'text',
          x: M + indent,
          y: y + textH(tl.length, 11) + 1,
          lines: bl,
          size: 10,
          weight: 'regular',
          color: MUTED,
          lh: LH,
          role: 'p',
        });
      y += h;
      blocks.push({ t: 'line', x1: M, y1: y - 2.5, x2: W - M, y2: y - 2.5, color: RULE, lw: 0.25 });
    });
    if (blocks.length) flush();
  }
  const pages: Page[] = [];
  if (o.cover)
    pages.push(
      coverPage(
        d,
        W,
        H,
        m,
        d.steps.map((s, i) => ({ n: i + 1, title: s.title, page: stepPage[i] ?? 0 })),
      ),
    );
  pages.push(...body);
  const total = pages.length;
  return pages.map((p, i) =>
    p.kind === 'cover'
      ? p
      : { ...p, blocks: [...runningHeader(d, W, m), ...p.blocks, ...footer(d, W, H, i + 1, total)] },
  );
}

// ---------------------------------------------------------------------------
// L15-07 : attestation de suivi (A4 portrait, noir et blanc imprimable)
// ---------------------------------------------------------------------------
export interface CertificateData {
  workspace: string;
  /** Prénom et nom (jamais l'e-mail). */
  learner: string;
  path: string;
  modules: Array<{ title: string; best: number | null }>;
  /** Date de validation de la formation (horodatée côté serveur), ou null. */
  validatedAt: string | null;
  generatedAt: string;
  certificateId: string;
}

const frDate = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  }).format(new Date(iso));

export function planCertificate(c: CertificateData, m: Measure): Page {
  const W = 210;
  const H = 297;
  const x = 22;
  const w = W - 2 * x;
  const b: Block[] = [];
  b.push({ t: 'logo', x, y: 22, size: 10, initials: initialsOf(c.workspace), color: '#12161B' });
  b.push({
    t: 'text',
    x: x + 13,
    y: 22.4,
    lines: [c.workspace],
    size: 11,
    weight: 'bold',
    color: INK,
    lh: LH,
  });
  b.push({
    t: 'text',
    x: x + 13,
    y: 27.6,
    lines: ['Centre de formation'],
    size: 8.5,
    weight: 'regular',
    color: MUTED,
    lh: LH,
  });
  b.push({ t: 'line', x1: x, y1: 36, x2: W - x, y2: 36, color: '#12161B', lw: 0.7 });
  const kind = 'ATTESTATION DE SUIVI · NON CERTIFIANTE';
  const kw = m.width(kind, 8, 'bold') + 8;
  b.push({ t: 'rect', x, y: 43, w: kw, h: 6.5, stroke: '#12161B', lw: 0.3, r: 3.2 });
  b.push({ t: 'text', x: x + 4, y: 44.5, lines: [kind], size: 8, weight: 'bold', color: INK, lh: LH });
  b.push({
    t: 'text',
    x,
    y: 56,
    lines: ['Attestation de suivi'],
    size: 24,
    weight: 'extrabold',
    color: INK,
    lh: 1.15,
    role: 'h1',
  });
  const R = 'regular' as const;
  const B = 'bold' as const;
  const parts = [
    { text: `${c.workspace} atteste que `, weight: R },
    { text: c.learner, weight: B },
    { text: ' a suivi en ligne la formation ', weight: R },
    { text: `«\u00a0${c.path}\u00a0»`, weight: B },
    { text: ' et validé l’ensemble de ses modules.', weight: R },
    ...(c.validatedAt
      ? [
          { text: ' Formation validée le ', weight: R },
          { text: frDate(c.validatedAt), weight: B },
          { text: '.', weight: R },
        ]
      : []),
  ];
  const sl = wrapRich(parts, 11, w, m);
  b.push({ t: 'rich', x, y: 70, lines: sl, size: 11, color: INK, lh: 1.6, role: 'p' });
  let y = 70 + sl.length * 11 * PT * 1.6 + 8;
  b.push({ t: 'text', x, y, lines: ['Module'], size: 8.5, weight: 'bold', color: MUTED, lh: LH });
  b.push({
    t: 'text',
    x: x + w * 0.62,
    y,
    lines: ['Statut'],
    size: 8.5,
    weight: 'bold',
    color: MUTED,
    lh: LH,
  });
  b.push({
    t: 'text',
    x: W - x,
    y,
    lines: ['Quiz'],
    size: 8.5,
    weight: 'bold',
    color: MUTED,
    align: 'right',
    lh: LH,
  });
  y += 5.5;
  b.push({ t: 'line', x1: x, y1: y, x2: W - x, y2: y, color: '#12161B', lw: 0.35 });
  y += 2.5;
  c.modules.forEach((mod, i) => {
    const ml = m.split(`${i + 1} · ${mod.title}`, 10, 'regular', w * 0.58);
    b.push({ t: 'text', x, y, lines: ml, size: 10, weight: 'regular', color: INK, lh: LH });
    b.push({
      t: 'text',
      x: x + w * 0.62,
      y,
      lines: ['Validé'],
      size: 10,
      weight: 'regular',
      color: INK,
      lh: LH,
    });
    b.push({
      t: 'text',
      x: W - x,
      y,
      lines: [mod.best === null ? '—' : `${mod.best}\u00a0%`],
      size: 10,
      weight: 'regular',
      color: INK,
      align: 'right',
      lh: LH,
    });
    y += textH(ml.length, 10) + 3;
    b.push({ t: 'line', x1: x, y1: y - 1.5, x2: W - x, y2: y - 1.5, color: RULE, lw: 0.25 });
  });
  y += 12;
  b.push({
    t: 'text',
    x,
    y,
    lines: [`Pour ${c.workspace}`],
    size: 9,
    weight: 'regular',
    color: MUTED,
    lh: LH,
  });
  b.push({ t: 'line', x1: x, y1: y + 16, x2: x + w / 2 - 8, y2: y + 16, color: '#9AA5B1', lw: 0.3 });
  b.push({
    t: 'text',
    x: x + w / 2 + 8,
    y,
    lines: [`Document généré le ${frDate(c.generatedAt)}`],
    size: 9,
    weight: 'regular',
    color: MUTED,
    lh: LH,
  });
  b.push({
    t: 'text',
    x: x + w / 2 + 8,
    y: y + 5,
    lines: [`Attestation n° ${c.certificateId}`],
    size: 9,
    weight: 'regular',
    color: MUTED,
    lh: LH,
  });
  const note =
    'Attestation de suivi, non certifiante. Elle indique que les modules ont été suivis et validés en ligne ; elle ne vaut ni diplôme, ni certification, ni habilitation.';
  const nl = m.split(note, 9, 'regular', w - 8);
  const nh = textH(nl.length, 9) + 6;
  b.push({ t: 'rect', x, y: H - 30 - nh, w, h: nh, stroke: '#12161B', lw: 0.3, r: 1.5 });
  b.push({
    t: 'text',
    x: x + 4,
    y: H - 30 - nh + 3,
    lines: nl,
    size: 9,
    weight: 'regular',
    color: INK,
    lh: LH,
  });
  b.push({
    t: 'text',
    x,
    y: H - 16,
    lines: [`${c.workspace} · centre de formation`],
    size: 8,
    weight: 'regular',
    color: MUTED,
    lh: LH,
  });
  b.push({
    t: 'text',
    x: W - x,
    y: H - 16,
    lines: ['Page 1 / 1'],
    size: 8,
    weight: 'regular',
    color: MUTED,
    align: 'right',
    lh: LH,
  });
  return { kind: 'certificate', label: 'Attestation de suivi', blocks: b };
}
