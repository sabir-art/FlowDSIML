import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pdfkitMeasure, renderTaggedPdf, type PdfKitCtor, type TaggedFontFiles } from './pdfTagged';
import { describe, expect, it } from 'vitest';
import { parseManifest } from '@flowdsiml/manifest';
import {
  DEFAULT_PDF,
  GifWriter,
  contrastRatio,
  fileName,
  formatSize,
  gifDuration,
  initialsOf,
  onColor,
  planCertificate,
  planDemoPdf,
  planGif,
  stepsFromManifest,
  type ExportDemo,
  type Page,
} from './index';

// L35 : moteur PDF balisé (PDFKit) pour la mesure et le rendu
const PDFDocument = createRequire(import.meta.url)('pdfkit') as PdfKitCtor;
const font = (f: string) => new Uint8Array(readFileSync(new URL(`../fonts/${f}`, import.meta.url)));
const fonts: TaggedFontFiles = {
  regular: font('PlusJakartaSans-Regular.ttf'),
  bold: font('PlusJakartaSans-Bold.ttf'),
  extrabold: font('PlusJakartaSans-ExtraBold.ttf'),
};
const measure = pdfkitMeasure(PDFDocument, fonts);

const demo = (n: number, o: Partial<ExportDemo> = {}): ExportDemo => ({
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
  ...o,
});
const texts = (p: Page) =>
  p.blocks
    .flatMap((b) =>
      b.t === 'text' ? b.lines : b.t === 'rich' ? b.lines.map((l) => l.map((s) => s.text).join('')) : [],
    )
    .join('\n');

describe('stepsFromManifest', () => {
  it('prend la première bulle, retire la mise en forme et applique les valeurs par défaut', () => {
    const m = parseManifest({
      schemaVersion: 1,
      demoId: 'd',
      versionId: 'v',
      workspaceId: 'w',
      publishedAt: 'x',
      theme: {},
      title: 'Démo',
      variables: [{ key: 'first_name', label: 'Prénom', default: 'Camille' }],
      steps: [
        {
          id: 's1',
          kind: 'image',
          image: { url: 'assets/a.webp', width: 1600, height: 900 },
          hotspots: [
            {
              id: 'h',
              x: 0.1,
              y: 0.2,
              w: 0.3,
              h: 0.1,
              title: 'Bonjour {{first_name}}',
              body: 'Cliquez sur **Créer**',
            },
          ],
        },
        { id: 's2', kind: 'text', title: 'Fin', body: 'Merci' },
      ],
    });
    const s = stepsFromManifest(m);
    expect(s[0]).toMatchObject({
      title: 'Bonjour Camille',
      text: 'Cliquez sur Créer',
      imageUrl: 'assets/a.webp',
      width: 1600,
    });
    expect(s[1]).toMatchObject({ title: 'Fin', text: 'Merci', imageUrl: null, target: null });
  });
});

describe('utilitaires', () => {
  it('nom de fichier, durée, poids, initiales', () => {
    expect(fileName('Créer une fiche usager !', 'pdf')).toBe('creer-une-fiche-usager.pdf');
    expect(fileName('***', 'gif')).toBe('tutoriel.gif');
    expect(gifDuration(8, 2.5)).toBe(20);
    expect(formatSize(1258291)).toMatch(/^1,2\s?Mo$/);
    expect(initialsOf('Mission Locale Exemple')).toBe('ML');
    expect(initialsOf('DSI ML')).toBe('DSI');
  });
  it('texte de couverture lisible sur la couleur du workspace', () => {
    expect(onColor('#A3195B')).toBe('#FFFFFF');
    expect(onColor('#95C11F')).toBe('#12161B');
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 0);
  });
});

describe('plan du PDF', () => {
  it('une étape par page : couverture, une page par étape, pied numéroté', () => {
    const pages = planDemoPdf(demo(5), DEFAULT_PDF, measure);
    expect(pages.map((p) => p.kind)).toEqual(['cover', 'steps', 'steps', 'steps', 'steps', 'steps']);
    expect(texts(pages[0]!)).toContain('TUTORIEL');
    expect(texts(pages[0]!)).toContain('tutos.example/d/fiche');
    expect(texts(pages[2]!)).toContain('Page 3 / 6');
    expect(texts(pages[2]!)).toContain('Mission Locale Exemple · version 3');
    expect(texts(pages[2]!)).not.toContain('Créé avec TutoClick');
    expect(
      pages[1]!.blocks.some(
        (b) => b.t === 'image' && b.alt === "Capture de l'étape 1 : Étape 1 : cliquer sur le bouton",
      ),
    ).toBe(true);
  });
  it('deux étapes par page, sans couverture, mention Free', () => {
    const pages = planDemoPdf(
      demo(5, { showBranding: true }),
      { ...DEFAULT_PDF, layout: 'two', cover: false },
      measure,
    );
    expect(pages).toHaveLength(3);
    expect(pages[0]!.label).toBe('Étapes 1 et 2');
    expect(texts(pages[0]!)).toContain('Créé avec TutoClick');
  });
  it('sans captures : liste ; sans numérotation : numéro écrit dans le titre', () => {
    const pages = planDemoPdf(demo(12), { ...DEFAULT_PDF, images: false, numbering: false }, measure);
    expect(pages.slice(1).every((p) => p.blocks.every((b) => b.t !== 'image' && b.t !== 'circle'))).toBe(
      true,
    );
    expect(pages[1]!.kind).toBe('list');
    expect(texts(pages[1]!)).toContain('1. Étape 1');
  });
  it('sommaire tronqué : « … n autres étapes »', () => {
    const pages = planDemoPdf(demo(40), DEFAULT_PDF, measure);
    expect(texts(pages[0]!)).toMatch(/… \d+ autres étapes/);
    expect(pages).toHaveLength(41);
  });
  it('bulles sur les captures : dessinées dans la capture, décor ignoré par les lecteurs d’écran', () => {
    const page = planDemoPdf(demo(1), DEFAULT_PDF, measure)[1]!;
    const img = page.blocks.find((b) => b.t === 'image')!;
    const decor = page.blocks.filter((b) => b.t === 'text' && b.decor);
    expect(decor.length).toBeGreaterThan(0);
    const box = page.blocks.find((b) => b.t === 'rect' && b.fill === '#FFFFFF')!;
    expect(img.t === 'image' && box.t === 'rect').toBe(true);
    if (img.t !== 'image' || box.t !== 'rect') return;
    expect(box.x).toBeGreaterThanOrEqual(img.x);
    expect(box.y).toBeGreaterThanOrEqual(img.y);
    expect(box.x + box.w).toBeLessThanOrEqual(img.x + img.w);
    expect(box.y + box.h).toBeLessThanOrEqual(img.y + img.h);
    const off = planDemoPdf(demo(1), { ...DEFAULT_PDF, bubbles: false }, measure)[1]!;
    expect(off.blocks.some((b) => b.t === 'text' && b.decor)).toBe(false);
  });
  it('paysage : pages A4 couchées', () => {
    const pages = planDemoPdf(demo(2), { ...DEFAULT_PDF, orientation: 'landscape' }, measure);
    const band = pages[0]!.blocks[0]!;
    expect(band.t === 'rect' && band.w).toBe(297);
  });
});

describe('attestation', () => {
  const cert = {
    workspace: 'Mission Locale Exemple',
    learner: 'Alex Martin',
    path: 'Logiciel métier',
    modules: [
      { title: 'Prise en main', best: null },
      { title: 'Fiches usagers', best: 100 },
    ],
    validatedAt: '2026-11-04T11:00:00Z',
    generatedAt: '2026-11-18T09:00:00Z',
    certificateId: '000042',
  };
  it('phrase, date de validation, tableau, mention non certifiante', () => {
    const t = texts(planCertificate(cert, measure)).replace(/\n/g, ' ');
    expect(t).toMatch(/Alex Martin a suivi en ligne la formation «\u00a0Logiciel\s?métier\u00a0»/);
    const rich = planCertificate(cert, measure).blocks.find((b) => b.t === 'rich');
    const bold =
      rich && rich.t === 'rich'
        ? rich.lines
            .flat()
            .filter((s) => s.weight === 'bold')
            .map((s) => s.text.trim())
        : [];
    expect(bold.join(' ')).toBe('Alex Martin «\u00a0Logiciel métier\u00a0» 04/11/2026');
    expect(t).toContain('Formation validée le 04/11/2026.');
    expect(t).toContain('Document généré le 18/11/2026');
    expect(t).toContain('100 %');
    expect(t).toContain('—');
    expect(t).toContain('non certifiante');
  });
  it('sans date de validation, la phrase s’arrête après « modules »', () => {
    const t = texts(planCertificate({ ...cert, validatedAt: null }, measure)).replace(/\n/g, ' ');
    expect(t).toMatch(/validé l’ensemble de ses modules\.\s/);
    expect(t).not.toContain('Formation validée le');
  });
});

describe('rendu', () => {
  it('PDF valide avec le titre et la langue du document', async () => {
    const pages = planDemoPdf(demo(2), DEFAULT_PDF, measure);
    const seen: number[] = [];
    const buf = await renderTaggedPdf(PDFDocument, pages, {
      fonts,
      orientation: 'portrait',
      title: 'Créer une fiche usager',
      lang: 'fr-FR',
      author: 'Mission Locale Exemple',
      compress: false,
      onProgress: (p) => seen.push(p),
    });
    const head = new TextDecoder('latin1').decode(new Uint8Array(buf));
    expect(head.startsWith('%PDF-')).toBe(true);
    expect(head).toContain('/Lang (fr-FR)');
    expect(head).toMatch(/\/Count 3/);
    expect(seen).toEqual([1, 2, 3]);
  });
  it('export annulé', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(
      renderTaggedPdf(PDFDocument, planDemoPdf(demo(1), DEFAULT_PDF, measure), {
        fonts,
        orientation: 'portrait',
        title: 't',
        lang: 'fr-FR',
        author: 'a',
        signal: ac.signal,
      }),
    ).rejects.toThrow(/annulé/);
  });
});

describe('GIF', () => {
  it('durée par étape respectée, plage et curseur', () => {
    const steps = demo(4).steps;
    const f = planGif(steps, {
      seconds: 2.5,
      width: 960,
      from: 1,
      to: 2,
      bubble: true,
      cursor: true,
      loop: true,
    });
    expect(new Set(f.map((x) => x.step))).toEqual(new Set([1, 2]));
    expect(f.filter((x) => x.step === 1).reduce((a, x) => a + x.delay, 0)).toBe(2500);
    const plain = planGif(steps, {
      seconds: 4,
      width: 640,
      from: 0,
      to: 3,
      bubble: false,
      cursor: false,
      loop: false,
    });
    expect(plain).toHaveLength(4);
    expect(plain.every((x) => x.delay === 4000 && !x.bubble)).toBe(true);
  });
  it('encode un GIF animé, en boucle ou non', () => {
    const make = (loop: boolean) => {
      const g = new GifWriter(4, 2, loop);
      const red = new Uint8Array(4 * 2 * 4).map((_, i) => (i % 4 === 0 || i % 4 === 3 ? 255 : 0));
      const blue = new Uint8Array(4 * 2 * 4).map((_, i) => (i % 4 === 2 || i % 4 === 3 ? 255 : 0));
      g.add(red, 500);
      g.add(blue, 500);
      return new TextDecoder('latin1').decode(g.finish());
    };
    expect(make(true).startsWith('GIF89a')).toBe(true);
    expect(make(true)).toContain('NETSCAPE2.0');
    expect(make(false)).not.toContain('NETSCAPE2.0');
  });
});
