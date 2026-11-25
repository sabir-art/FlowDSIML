/**
 * L15-01 à L15-05 : modale d'export d'une démo (PDF ou GIF animé), créés dans le navigateur à partir
 * de la version publiée. L25-11/12 : vidéo MP4 (WebCodecs). Hors-ligne : visible avec « Bientôt ».
 */
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Accessibility,
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  CircleAlert,
  CircleCheck,
  Download,
  FileText,
  Film,
  Image as ImageIcon,
  Info,
  Lock,
  Pause,
  Play,
  RefreshCw,
  X,
} from 'lucide-react';
import { fileName, formatSize, gifDuration, type ExportDemo } from '@flowdsiml/exports/model';
import {
  DEFAULT_PDF,
  pageSize,
  planDemoPdf,
  type Measure,
  type Page,
  type PdfOptions,
} from '@flowdsiml/exports/layout';
import {
  DEFAULT_GIF,
  GIF_SPEEDS,
  GIF_WIDTHS,
  GifWriter,
  drawGifFrame,
  gifHeight,
  planGif,
  type GifOptions,
} from '@flowdsiml/exports/gif';
import type { FontFiles } from '@flowdsiml/exports/pdf-tagged';
import {
  MP4_FORMATS,
  MP4_MAX_SECONDS,
  audioTimeline,
  AUDIO_RATE,
  buildVtt,
  canEncodeVideo,
  defaultMp4,
  drawVideoFrame,
  encodeMp4,
  mp4Duration,
  mp4Format,
  planVideo,
  type Mp4Format,
  type Mp4Options,
  type StepImages,
  type Subtitles,
} from '@flowdsiml/exports/mp4';
import {
  bitmapToDataUrl,
  download,
  fetchBitmap,
  loadExportSource,
  toPdfImage,
  videoPoster,
  type ExportSource,
} from './exportData';
import { PdfPagePreview } from './PdfPagePreview';
import './export.css';
import { Select } from '@flowdsiml/ui';

type Fmt = 'pdf' | 'gif' | 'mp4' | 'html';
/** L25-12 : fichiers prêts (vidéo et sous-titres). */
interface ReadyFile {
  name: string;
  meta: string;
  kind: 'video' | 'text';
  bytes: ArrayBuffer | Uint8Array;
  type: string;
}
type Phase =
  | { kind: 'options' }
  | { kind: 'running'; fmt: Fmt; stage: 0 | 1 | 2 | 3; pct: number; n: number; total: number }
  | { kind: 'done'; fmt: Fmt; name: string; meta: string; files?: ReadyFile[] }
  | { kind: 'error'; fmt: Fmt; message: string; detail: string; fallback: boolean };

class StepImageError extends Error {
  constructor(readonly step: number) {
    super('STEP_IMAGE');
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

export function ExportDialog({
  demoId,
  onClose,
  initialFormat,
  onBack,
}: {
  demoId: string;
  onClose: () => void;
  /**
   * Ouverte depuis Partager › Exporter : elle remplace la fenêtre Partager (jamais deux fenêtres l'une sur
   * l'autre) ; « ← Partager » y revient et le titre prend le focus.
   */
  onBack?: () => void;
  /** REV-10 : « GIF / vidéo » de Partager ouvre l'export sur le GIF. */
  initialFormat?: Fmt;
}) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const [src, setSrc] = useState<ExportSource | null>(null);
  const [failed, setFailed] = useState(false);
  const [fonts, setFonts] = useState<FontFiles | null>(null);
  const [measure, setMeasure] = useState<Measure | null>(null);
  const [fmt, setFmt] = useState<Fmt>(initialFormat ?? 'pdf');
  const [pdf, setPdf] = useState<PdfOptions>(DEFAULT_PDF);
  const [gif, setGif] = useState<
    Omit<GifOptions, 'from' | 'to'> & { range: 'all' | 'range'; from: number; to: number }
  >({
    ...DEFAULT_GIF,
    range: 'all',
    from: 0,
    to: 0,
  });
  // L25-11 : options propres à la vidéo (vitesse, étapes, bulle et curseur : celles du GIF)
  const [mp4x, setMp4x] = useState<{
    format: Mp4Format;
    zoom: boolean;
    title: boolean;
    subtitles: Subtitles;
  }>(() => {
    const d = defaultMp4();
    return { format: d.format, zoom: d.zoom, title: d.title, subtitles: d.subtitles };
  });
  const [page, setPage] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: 'options' });
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  // Venue de Partager : le titre prend le focus dès qu'il est rendu (les lecteurs d'écran l'annoncent)
  // (le titre change avec l'état : options, erreur, export en cours ; on ne reprend jamais le focus
  // d'un contrôle que la personne utilise)
  const titled = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!onBack) return;
    const d = ref.current;
    const h = d?.querySelector<HTMLElement>('h2');
    if (!d || !h || h === titled.current) return;
    const active = document.activeElement;
    const free = !active || active === document.body || active === d || active === titled.current;
    const first = titled.current === null;
    titled.current = h;
    if (!first && !free) return;
    h.tabIndex = -1;
    h.focus();
  });

  useEffect(() => {
    let alive = true;
    loadExportSource(demoId)
      .then((s) => {
        if (!alive) return;
        setSrc(s);
        if (s.kind === 'ok') {
          setGif((g) => ({ ...g, to: Math.max(0, s.demo.steps.length - 1) }));
          // Démo mobile : 9:16 proposé par défaut
          setMp4x((x) => ({ ...x, format: defaultMp4(s.demo.device).format }));
        }
      })
      .catch(() => alive && setFailed(true));
    // L35 : polices et mesure du moteur PDF balisé (PDFKit) : le même sert à l'aperçu et au fichier
    void import('@flowdsiml/exports/pdf-tagged')
      .then(async (m) => {
        const f = await m.loadFonts();
        if (!alive) return;
        setFonts(f);
        setMeasure(m.measureFor(f));
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      abort.current?.abort();
    };
  }, [demoId]);

  const demo = src?.kind === 'ok' ? src.demo : null;
  const pages = useMemo<Page[]>(
    () => (demo && measure ? planDemoPdf(demo, pdf, measure) : []),
    [demo, measure, pdf],
  );
  useEffect(() => setPage((p) => Math.min(p, Math.max(0, pages.length - 1))), [pages.length]);

  const gifOpts = (d: ExportDemo): GifOptions => ({
    seconds: gif.seconds,
    width: gif.width,
    bubble: gif.bubble,
    cursor: gif.cursor,
    loop: gif.loop,
    from: gif.range === 'all' ? 0 : gif.from,
    to: gif.range === 'all' ? d.steps.length - 1 : gif.to,
  });

  const mp4Opts = (d: ExportDemo): Mp4Options => ({
    ...gifOpts(d),
    format: mp4x.format,
    zoom: mp4x.zoom,
    title: mp4x.title,
    subtitles: mp4x.subtitles,
  });

  const close = () => {
    abort.current?.abort();
    ref.current?.close();
  };

  // ---------------------------------------------------------------------------------------------
  // Exports
  // ---------------------------------------------------------------------------------------------
  async function runPdf(opts: PdfOptions) {
    if (!demo || !fonts || !measure) return;
    const ac = new AbortController();
    abort.current = ac;
    const layout = planDemoPdf(demo, opts, measure);
    const used = opts.images ? demo.steps.map((s, i) => (s.imageUrl ? i : -1)).filter((i) => i >= 0) : [];
    setPhase({ kind: 'running', fmt: 'pdf', stage: 0, pct: 0, n: 0, total: layout.length });
    try {
      const { renderPdf } = await import('@flowdsiml/exports/pdf-tagged');
      const imgs = new Map<number, Awaited<ReturnType<typeof toPdfImage>>>();
      for (const [k, i] of used.entries()) {
        try {
          imgs.set(
            i,
            await toPdfImage(
              await fetchBitmap(demo.steps[i]!.imageUrl!, ac.signal, demo.steps[i]!.crop),
              1600,
              'JPEG',
            ),
          );
        } catch (e) {
          if (isAbort(e)) throw e;
          throw new StepImageError(i);
        }
        setPhase({
          kind: 'running',
          fmt: 'pdf',
          stage: 0,
          pct: Math.round(((k + 1) / used.length) * 40),
          n: 0,
          total: layout.length,
        });
      }
      let logo = null;
      if (src?.kind === 'ok' && src.logoUrl)
        logo = await fetchBitmap(src.logoUrl, ac.signal)
          .then((b) => toPdfImage(b, 256, 'PNG'))
          .catch(() => null);
      const buf = await renderPdf(layout, {
        fonts,
        orientation: opts.orientation,
        title: demo.title,
        lang: demo.lang ?? (i18n.language.startsWith('en') ? 'en-GB' : 'fr-FR'),
        author: demo.workspace,
        image: async (i) => imgs.get(i) ?? null,
        logo,
        signal: ac.signal,
        onProgress: (n, total) =>
          setPhase({
            kind: 'running',
            fmt: 'pdf',
            stage: 1,
            pct: 40 + Math.round((n / total) * 55),
            n,
            total,
          }),
      });
      setPhase({ kind: 'running', fmt: 'pdf', stage: 2, pct: 100, n: layout.length, total: layout.length });
      await tick();
      const name = fileName(demo.title, 'pdf');
      download(buf, name, 'application/pdf');
      setPhase({
        kind: 'done',
        fmt: 'pdf',
        name,
        meta: [
          t('export.pages', { count: layout.length }),
          formatSize(buf.byteLength, i18n.language),
          t(opts.orientation === 'portrait' ? 'export.a4portrait' : 'export.a4landscape'),
        ].join(' · '),
      });
    } catch (e) {
      if (isAbort(e)) return setPhase({ kind: 'options' });
      failWith('pdf', e);
    }
  }

  /** L29-03 : version accessible (HTML autonome, images intégrées). */
  async function runHtml(opts: PdfOptions) {
    if (!demo) return;
    const ac = new AbortController();
    abort.current = ac;
    const total = demo.steps.length;
    setPhase({ kind: 'running', fmt: 'html', stage: 0, pct: 0, n: 0, total });
    try {
      const { renderAccessibleHtml } = await import('@flowdsiml/exports/accessible');
      const imgs = new Map<number, string | null>();
      if (opts.images)
        for (const [i, st] of demo.steps.entries()) {
          try {
            const b = st.imageUrl
              ? await fetchBitmap(st.imageUrl, ac.signal, st.crop)
              : st.video
                ? await videoPoster(st.video.url, ac.signal)
                : null;
            imgs.set(i, b ? bitmapToDataUrl(b) : null);
          } catch (e) {
            if (isAbort(e)) throw e;
            if (st.imageUrl) throw new StepImageError(i);
            imgs.set(i, null);
          }
          setPhase({
            kind: 'running',
            fmt: 'html',
            stage: 0,
            pct: Math.round(((i + 1) / total) * 80),
            n: i + 1,
            total,
          });
        }
      setPhase({ kind: 'running', fmt: 'html', stage: 1, pct: 90, n: total, total });
      await tick();
      const lt = (k: string, o?: Record<string, unknown>) => t(k, { lng: demo.lang?.slice(0, 2), ...o });
      const html = renderAccessibleHtml(
        demo,
        imgs,
        { images: opts.images, text: opts.text },
        {
          skip: lt('export.a11y.skip'),
          toc: lt('export.a11y.toc'),
          stepHeading: (n, title) => lt('export.a11y.step', { n, title }),
          altCapture: (title) => lt('export.a11y.altCapture', { title }),
          altTarget: lt('export.a11y.altTarget'),
          altVideo: (title) => lt('export.a11y.altVideo', { title }),
          transcript: lt('export.a11y.transcript'),
          quiz: lt('export.a11y.quiz'),
          noChapter: lt('export.a11y.noChapter'),
          allSteps: lt('export.a11y.allSteps'),
          generated: lt('export.a11y.generated', { version: demo.version }),
        },
      );
      const bytes = new TextEncoder().encode(html);
      const name = fileName(demo.title, 'accessible.html');
      setPhase({ kind: 'running', fmt: 'html', stage: 2, pct: 100, n: total, total });
      await tick();
      download(bytes, name, 'text/html;charset=utf-8');
      setPhase({
        kind: 'done',
        fmt: 'html',
        name,
        meta: [t('export.stepsCount', { count: total }), formatSize(bytes.byteLength, i18n.language)].join(
          ' · ',
        ),
      });
    } catch (e) {
      if (isAbort(e)) return setPhase({ kind: 'options' });
      failWith('html', e);
    }
  }

  async function runGif() {
    if (!demo) return;
    const o = gifOpts(demo);
    const frames = planGif(demo.steps, o);
    const first = demo.steps[o.from]!;
    const w = o.width;
    const h = gifHeight(first, w);
    const total = o.to - o.from + 1;
    const ac = new AbortController();
    abort.current = ac;
    setPhase({ kind: 'running', fmt: 'gif', stage: 0, pct: 0, n: 0, total });
    try {
      const bmps = new Map<number, ImageBitmap | null>();
      for (let i = o.from; i <= o.to; i++) {
        const url = demo.steps[i]!.imageUrl;
        try {
          bmps.set(i, url ? await fetchBitmap(url, ac.signal, demo.steps[i]!.crop) : null);
        } catch (e) {
          if (isAbort(e)) throw e;
          throw new StepImageError(i);
        }
        setPhase({
          kind: 'running',
          fmt: 'gif',
          stage: 0,
          pct: Math.round(((i - o.from + 1) / total) * 30),
          n: 0,
          total,
        });
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      await document.fonts?.load(`700 15px "Plus Jakarta Sans"`).catch(() => undefined);
      const writer = new GifWriter(w, h, o.loop);
      for (const [k, f] of frames.entries()) {
        if (ac.signal.aborted) throw new DOMException('Export annulé', 'AbortError');
        drawGifFrame(ctx, bmps.get(f.step) ?? null, demo.steps, f, w, h);
        writer.add(ctx.getImageData(0, 0, w, h).data, f.delay);
        const n = f.step - o.from + 1;
        setPhase({
          kind: 'running',
          fmt: 'gif',
          stage: 1,
          pct: 30 + Math.round(((k + 1) / frames.length) * 65),
          n,
          total,
        });
        await tick();
      }
      setPhase({ kind: 'running', fmt: 'gif', stage: 2, pct: 100, n: total, total });
      await tick();
      const bytes = writer.finish();
      const name = fileName(demo.title, 'gif');
      download(bytes, name, 'image/gif');
      setPhase({
        kind: 'done',
        fmt: 'gif',
        name,
        meta: [
          t('export.seconds', { n: gifDuration(total, o.seconds).toLocaleString(i18n.language) }),
          formatSize(bytes.byteLength, i18n.language),
          `${w} × ${h} px`,
        ].join(' · '),
      });
    } catch (e) {
      if (isAbort(e)) return setPhase({ kind: 'options' });
      failWith('gif', e);
    }
  }

  /** L25-11 / L25-12 : vidéo MP4 (et sous-titres .vtt), créée dans le navigateur. */
  async function runMp4() {
    if (!demo) return;
    const o = mp4Opts(demo);
    const total = o.to - o.from + 1;
    if (mp4Duration(o, demo.steps) > MP4_MAX_SECONDS) {
      setPhase({
        kind: 'error',
        fmt: 'mp4',
        message: t('export.errTooLong', { max: MP4_MAX_SECONDS / 60 }),
        detail: t('export.errTooLongDetail', { n: mp4Duration(o, demo.steps).toLocaleString(i18n.language) }),
        fallback: false,
      });
      return;
    }
    const ac = new AbortController();
    abort.current = ac;
    const run = (stage: 0 | 1 | 2 | 3, pct: number, n = 0) =>
      setPhase({ kind: 'running', fmt: 'mp4', stage, pct, n, total });
    run(0, 0);
    try {
      const images = new Map<number, StepImages>();
      // L25-11 : étapes vidéo (L21) : lecture image par image et son décodé (48 kHz)
      const steps = demo.steps.slice();
      const videos = new Map<number, HTMLVideoElement>();
      const sound = new Map<number, Float32Array[]>();
      for (let i = o.from; i <= o.to; i++) {
        const st = steps[i]!;
        if (!st.video) continue;
        try {
          const v = await loadVideo(st.video.url, ac.signal);
          videos.set(i, v);
          steps[i] = { ...st, width: v.videoWidth || 1280, height: v.videoHeight || 720 };
          sound.set(i, await decodeSound(st.video.url, ac.signal));
        } catch (e) {
          if (isAbort(e)) throw e;
          throw new StepImageError(i);
        }
      }
      for (let i = o.from; i <= o.to; i++) {
        const st = demo.steps[i]!;
        if (st.video) continue;
        try {
          images.set(i, {
            img: st.imageUrl ? await fetchBitmap(st.imageUrl, ac.signal, st.crop) : null,
            full: st.fullPage ? await fetchBitmap(st.fullPage.url, ac.signal).catch(() => null) : null,
          });
        } catch (e) {
          if (isAbort(e)) throw e;
          throw new StepImageError(i);
        }
        run(0, Math.round(((i - o.from + 1) / total) * 15));
      }
      const logo =
        src?.kind === 'ok' && src.logoUrl && o.title
          ? await fetchBitmap(src.logoUrl, ac.signal).catch(() => null)
          : null;
      await document.fonts?.load(`700 15px "Plus Jakarta Sans"`).catch(() => undefined);
      const fmtx = mp4Format(o.format);
      const canvas = document.createElement('canvas');
      canvas.width = fmtx.w;
      canvas.height = fmtx.h;
      const ctx = canvas.getContext('2d')!;
      const stageCanvas = new OffscreenCanvas(1, 1);
      const stage = { canvas: stageCanvas, ctx: stageCanvas.getContext('2d')! };
      const vdemo = { ...demo, steps };
      const frames = planVideo(steps, o);
      const bytes = await encodeMp4({
        canvas,
        frames,
        signal: ac.signal,
        audio: audioTimeline(steps, o, sound),
        draw: async (k) => {
          const f = frames[k]!;
          const v = f.src !== undefined ? videos.get(f.step) : undefined;
          if (v) {
            await seekVideo(v, f.src! / 1000);
            images.set(f.step, { img: v });
          }
          drawVideoFrame(ctx, vdemo, images, f, fmtx.w, fmtx.h, o, logo, stage);
        },
        progress: (k) => {
          if (k % 10 === 0 || k === frames.length - 1)
            run(1, 15 + Math.round(((k + 1) / frames.length) * 75), frames[k]!.step - o.from + 1);
        },
      });
      run(2, 92, total);
      await tick();
      const name = fileName(demo.title, 'mp4');
      const files: ReadyFile[] = [
        {
          name,
          kind: 'video',
          type: 'video/mp4',
          bytes,
          meta: [
            t('export.seconds', { n: mp4Duration(o, steps).toLocaleString(i18n.language) }),
            `${fmtx.w.toLocaleString(i18n.language)} × ${fmtx.h.toLocaleString(i18n.language)}`,
            formatSize(bytes.byteLength, i18n.language),
          ].join(' · '),
        },
      ];
      if (o.subtitles === 'vtt') {
        run(3, 96, total);
        await tick();
        const vtt = buildVtt(steps, o);
        files.push({
          name: fileName(demo.title, i18n.language.startsWith('en') ? 'en.vtt' : 'fr.vtt'),
          kind: 'text',
          type: 'text/vtt',
          bytes: new TextEncoder().encode(vtt.text),
          meta: t('export.cues', { count: vtt.cues }),
        });
      }
      for (const f of files) download(f.bytes, f.name, f.type);
      setPhase({ kind: 'done', fmt: 'mp4', name, meta: files[0]!.meta, files });
    } catch (e) {
      if (isAbort(e)) return setPhase({ kind: 'options' });
      failWith('mp4', e);
    }
  }

  function failWith(f: Fmt, e: unknown) {
    if (e instanceof StepImageError && demo) {
      const s = demo.steps[e.step]!;
      setPhase({
        kind: 'error',
        fmt: f,
        message: t(
          f === 'pdf' || f === 'html'
            ? 'export.errImage'
            : f === 'mp4'
              ? 'export.errImageMp4'
              : 'export.errImageGif',
          { n: e.step + 1 },
        ),
        detail: t('export.errImageDetail', { n: e.step + 1, title: s.title }),
        fallback: f === 'pdf',
      });
    } else
      setPhase({
        kind: 'error',
        fmt: f,
        message: t('export.errGeneric'),
        detail: t(
          f === 'pdf'
            ? 'export.errStagePdf'
            : f === 'html'
              ? 'export.errStageHtml'
              : f === 'mp4'
                ? 'export.errStageMp4'
                : 'export.errStageGif',
        ),
        fallback: false,
      });
  }

  const start = () =>
    fmt === 'pdf'
      ? void runPdf(pdf)
      : fmt === 'html'
        ? void runHtml(pdf)
        : fmt === 'mp4'
          ? void runMp4()
          : void runGif();

  // ---------------------------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------------------------
  const small = phase.kind !== 'options' || src?.kind === 'unpublished' || failed;
  let body: ReactNode;
  if (failed)
    body = (
      <>
        <div className="x15-head">
          <span className="fd-icon-chip x15-chip--danger">
            <CircleAlert aria-hidden="true" />
          </span>
          <h2 id={`${id}-t`}>{t('export.errTitle')}</h2>
        </div>
        <p className="x15-p">{t('export.errLoad')}</p>
        <div className="x15-foot">
          <button type="button" className="fd-btn" onClick={close}>
            {t('common.close')}
          </button>
        </div>
      </>
    );
  else if (src?.kind === 'unpublished')
    body = (
      <>
        <div className="x15-head">
          <span className="fd-icon-chip">
            <Info aria-hidden="true" />
          </span>
          <h2 id={`${id}-t`}>{t('export.title', { title: src.title })}</h2>
        </div>
        <p className="x15-p">{t('export.unpublished')}</p>
        <div className="x15-foot">
          <button type="button" className="fd-btn fd-btn--primary" onClick={close}>
            {t('common.close')}
          </button>
        </div>
      </>
    );
  else if (phase.kind === 'running') {
    const labels =
      phase.fmt === 'pdf'
        ? [t('export.stagePrepare'), t('export.stageLayout'), t('export.stagePdf')]
        : phase.fmt === 'html'
          ? [t('export.stageImages'), t('export.stageHtml'), t('export.stageDone')]
          : phase.fmt === 'mp4'
            ? [
                t('export.stagePrepare'),
                t('export.stageRender', { n: phase.n, total: phase.total }),
                t('export.stageEncode'),
                ...(mp4x.subtitles === 'vtt' ? [t('export.stageVtt')] : []),
              ]
            : [t('export.stagePrepare'), t('export.stageFrames'), t('export.stageGif')];
    const runTitle =
      phase.fmt === 'pdf'
        ? 'export.runningPdf'
        : phase.fmt === 'html'
          ? 'export.runningHtml'
          : phase.fmt === 'mp4'
            ? 'export.runningMp4'
            : 'export.runningGif';
    body = (
      <>
        <div className="x15-head">
          <span className="fd-icon-chip">
            {phase.fmt === 'pdf' ? (
              <FileText aria-hidden="true" />
            ) : phase.fmt === 'html' ? (
              <Accessibility aria-hidden="true" />
            ) : phase.fmt === 'mp4' ? (
              <Film aria-hidden="true" />
            ) : (
              <ImageIcon aria-hidden="true" />
            )}
          </span>
          <h2 id={`${id}-t`}>{t(runTitle)}</h2>
        </div>
        <div className="exp-progress">
          <div
            className="exp-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={phase.pct}
            aria-label={t('export.progress')}
          >
            <span style={{ width: `${phase.pct}%` }} />
          </div>
          <p className="fd-label x15-live" aria-live="polite">
            {phase.stage === 0 || phase.fmt === 'mp4' || phase.fmt === 'html'
              ? `${phase.pct}\u202f%`
              : t(phase.fmt === 'pdf' ? 'export.livePdf' : 'export.liveGif', {
                  pct: phase.pct,
                  n: phase.n,
                  total: phase.total,
                })}
          </p>
          <ol className="exp-steps">
            {labels.map((l, i) => (
              <li key={l} className={i < phase.stage ? 'done' : i === phase.stage ? 'cur' : ''}>
                {i < phase.stage ? (
                  <CircleCheck aria-hidden="true" />
                ) : i === phase.stage ? (
                  <span className="spin" aria-hidden="true" />
                ) : (
                  <span className="todo" aria-hidden="true" />
                )}
                {i === 1 && phase.stage === 1 && phase.fmt === 'pdf'
                  ? `${l} (${phase.n} / ${phase.total})`
                  : l}
              </li>
            ))}
          </ol>
        </div>
        <p className="fd-help x15-p">{t(phase.fmt === 'mp4' ? 'export.keepTabVideo' : 'export.keepTab')}</p>
        <div className="x15-foot">
          <button type="button" className="fd-btn" onClick={() => abort.current?.abort()}>
            {t('export.cancelRun')}
          </button>
        </div>
      </>
    );
  } else if (phase.kind === 'done')
    body = (
      <>
        <div className="x15-head">
          <span className="fd-icon-chip x15-chip--success">
            <CircleCheck aria-hidden="true" />
          </span>
          <h2 id={`${id}-t`}>
            {t(
              phase.fmt === 'pdf'
                ? 'export.donePdf'
                : phase.fmt === 'html'
                  ? 'export.doneHtml'
                  : phase.fmt === 'mp4'
                    ? 'export.doneMp4'
                    : 'export.doneGif',
            )}
          </h2>
          <button
            type="button"
            className="fd-btn fd-btn--ghost fd-btn--icon"
            aria-label={t('common.close')}
            onClick={close}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        {phase.files ? (
          // L25-12 : vidéo et sous-titres, chacun avec son bouton
          phase.files.map((f) => (
            <div className="exp-file" key={f.name}>
              <span className="fd-icon-chip">
                {f.kind === 'video' ? <Film aria-hidden="true" /> : <FileText aria-hidden="true" />}
              </span>
              <span>
                <b>{f.name}</b>
                <small>{f.meta}</small>
              </span>
              <button
                type="button"
                className="fd-btn fd-btn--primary"
                aria-label={t('export.downloadFile', { name: f.name })}
                onClick={() => download(f.bytes, f.name, f.type)}
              >
                <Download aria-hidden="true" />
                {t('export.download')}
              </button>
            </div>
          ))
        ) : (
          <div className="exp-file">
            <span className="fd-icon-chip">
              {phase.fmt === 'pdf' ? (
                <FileText aria-hidden="true" />
              ) : phase.fmt === 'html' ? (
                <Accessibility aria-hidden="true" />
              ) : (
                <ImageIcon aria-hidden="true" />
              )}
            </span>
            <span>
              <b>{phase.name}</b>
              <small>{phase.meta}</small>
            </span>
            <button type="button" className="fd-btn fd-btn--primary" onClick={start}>
              <Download aria-hidden="true" />
              {t('export.download')}
            </button>
          </div>
        )}
        {phase.files?.some((f) => f.kind === 'text') && (
          <p className="fd-help x15-p">{t('export.vttHelp')}</p>
        )}
        {!phase.files && <p className="fd-help x15-p">{t('export.notKept')}</p>}
        {phase.fmt === 'pdf' && (
          // L29-03 : la version accessible est proposée après chaque PDF
          <p className="x15-p">
            <button type="button" className="mk-link-inline" onClick={() => void runHtml(pdf)}>
              <Accessibility aria-hidden="true" className="exp-inline-ico" />
              {t('export.alsoHtml')}
            </button>
          </p>
        )}
        <div className="x15-foot">
          <button type="button" className="fd-btn" onClick={() => setPhase({ kind: 'options' })}>
            {t('export.other')}
          </button>
        </div>
      </>
    );
  else if (phase.kind === 'error')
    body = (
      <>
        <div className="x15-head">
          <span className="fd-icon-chip x15-chip--danger">
            <CircleAlert aria-hidden="true" />
          </span>
          <h2 id={`${id}-t`}>{t('export.errTitle')}</h2>
        </div>
        <p className="x15-p" id={`${id}-d`}>
          {phase.message}
        </p>
        <div className="err-box">
          <b>{t('export.detail')}</b> {phase.detail}
        </div>
        <div className="x15-foot">
          <button type="button" className="fd-btn" onClick={close}>
            {t('common.close')}
          </button>
          {phase.fallback && (
            <button
              type="button"
              className="fd-btn"
              onClick={() => {
                const o = { ...pdf, images: false, text: true };
                setPdf(o);
                void runPdf(o);
              }}
            >
              {t('export.withoutImages')}
            </button>
          )}
          <button type="button" className="fd-btn fd-btn--primary" onClick={start}>
            <RefreshCw aria-hidden="true" />
            {t('export.retry')}
          </button>
        </div>
      </>
    );
  else
    body = (
      <Options
        id={id}
        demo={demo}
        title={demo?.title ?? ''}
        fmt={fmt}
        setFmt={setFmt}
        pdf={pdf}
        setPdf={setPdf}
        gif={gif}
        setGif={setGif}
        pages={pages}
        page={page}
        setPage={setPage}
        ready={!!demo && !!measure}
        onClose={close}
        onStart={start}
        gifOpts={demo ? gifOpts(demo) : null}
        mp4x={mp4x}
        setMp4x={setMp4x}
        mp4Opts={demo ? mp4Opts(demo) : null}
      />
    );

  return (
    <dialog
      ref={ref}
      className={small ? 'x15-dialog x15-small' : 'x15-dialog x15-dlg'}
      /* §18.6 : deux volets accolés (options, aperçu sur fond) */ data-gap-exempt=""
      role={phase.kind === 'error' ? 'alertdialog' : undefined}
      aria-labelledby={`${id}-t`}
      aria-describedby={phase.kind === 'error' ? `${id}-d` : undefined}
      onCancel={(e) => {
        if (phase.kind === 'running') {
          e.preventDefault();
          abort.current?.abort();
        }
      }}
      onClose={onClose}
    >
      {/* Venue de Partager : « ← Partager » y revient (sauf pendant un export, qu'on annule d'abord) */}
      {onBack && phase.kind !== 'running' && (
        <button
          type="button"
          className="fd-back x15-back"
          onClick={() => {
            abort.current?.abort();
            onBack();
          }}
        >
          <ChevronLeft size={16} aria-hidden="true" />
          <span>{t('export.backToShare')}</span>
        </button>
      )}
      {body}
    </dialog>
  );
}

// -------------------------------------------------------------------------------------------------
// L15-01 / L15-02 : options et aperçu
// -------------------------------------------------------------------------------------------------
type GifState = Omit<GifOptions, 'from' | 'to'> & { range: 'all' | 'range'; from: number; to: number };

function Options(p: {
  id: string;
  demo: ExportDemo | null;
  title: string;
  fmt: Fmt;
  setFmt: (f: Fmt) => void;
  pdf: PdfOptions;
  setPdf: (o: PdfOptions) => void;
  gif: GifState;
  setGif: (g: GifState) => void;
  pages: Page[];
  page: number;
  setPage: (n: number) => void;
  ready: boolean;
  onClose: () => void;
  onStart: () => void;
  gifOpts: GifOptions | null;
  mp4x: { format: Mp4Format; zoom: boolean; title: boolean; subtitles: Subtitles };
  setMp4x: (x: { format: Mp4Format; zoom: boolean; title: boolean; subtitles: Subtitles }) => void;
  mp4Opts: Mp4Options | null;
}) {
  const { t, i18n } = useTranslation();
  const { pdf, setPdf, gif, setGif, demo } = p;
  const n = demo?.steps.length ?? 0;
  // L25-11 : MP4 actif si le navigateur sait encoder (WebCodecs), sinon visible et désactivé
  const videoOk = canEncodeVideo();
  const formats: Array<{ key: string; icon: ReactNode; soon?: boolean; off?: boolean }> = [
    { key: 'pdf', icon: <FileText aria-hidden="true" /> },
    { key: 'gif', icon: <ImageIcon aria-hidden="true" /> },
    { key: 'html', icon: <Accessibility aria-hidden="true" /> },
    { key: 'mp4', icon: <Film aria-hidden="true" />, off: !videoOk },
  ];
  const { mp4x, setMp4x } = p;
  const sw = (
    label: string,
    help: string | null,
    checked: boolean,
    on: (v: boolean) => void,
    disabled = false,
  ) => (
    <label className="fd-switch">
      <span>
        {label}
        {help && <small>{help}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => on(e.target.checked)}
      />
      <span className="fd-switch__track" aria-hidden="true" />
    </label>
  );
  const seg = <T extends string | number>(
    label: string,
    value: T,
    opts: Array<{ v: T; label: string }>,
    on: (v: T) => void,
  ) => (
    <div className="fd-segmented" role="radiogroup" aria-label={label}>
      {opts.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          role="radio"
          aria-checked={o.v === value}
          onClick={() => on(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
  const range = p.gifOpts ? p.gifOpts.to - p.gifOpts.from + 1 : 0;
  return (
    <>
      <div className="x15-main">
        <div className="x15-head">
          <span className="fd-icon-chip">
            <Download aria-hidden="true" />
          </span>
          <h2 id={`${p.id}-t`}>{t('export.title', { title: p.title })}</h2>
          <button
            type="button"
            className="fd-btn fd-btn--ghost fd-btn--icon"
            aria-label={t('common.close')}
            onClick={p.onClose}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        {/* L45 : formats en liste verticale (une ligne par format), vrais boutons radio */}
        <fieldset className="exp-formats">
          <legend className="fd-label">{t('export.format')}</legend>
          {formats.map((f) => {
            const on = f.key === p.fmt;
            const off = f.soon || f.off;
            return (
              <label key={f.key} className={`exp-format${on ? ' is-on' : ''}${off ? ' is-off' : ''}`}>
                <input
                  type="radio"
                  name={`${p.id}-fmt`}
                  value={f.key}
                  checked={on}
                  disabled={off}
                  onChange={() => p.setFmt(f.key as Fmt)}
                />
                <span className="fd-icon-chip">{f.icon}</span>
                <span className="exp-format__text">
                  <b>{t(`export.fmt_${f.key}`)}</b>
                  <small>{f.off ? t('export.mp4Unsupported') : t(`export.fmt_${f.key}_help`)}</small>
                </span>
                {f.soon && <span className="soon">{t('shell.soon')}</span>}
              </label>
            );
          })}
        </fieldset>

        {p.fmt === 'pdf' || p.fmt === 'html' ? (
          <>
            {/* L29-03 : la version accessible garde les options de contenu, pas la mise en page */}
            {p.fmt === 'pdf' && (
              <fieldset>
                <legend className="fd-label">{t('export.layout')}</legend>
                {seg(
                  t('export.layout'),
                  pdf.layout,
                  [
                    { v: 'one', label: t('export.layoutOne') },
                    { v: 'two', label: t('export.layoutTwo') },
                  ],
                  (v) => setPdf({ ...pdf, layout: v }),
                )}
              </fieldset>
            )}
            <fieldset>
              <legend className="fd-label">{t('export.content')}</legend>
              <div className="opts">
                {sw(t('export.images'), t('export.imagesHelp'), pdf.images, (v) =>
                  setPdf({ ...pdf, images: v, text: v ? pdf.text : true }),
                )}
                {sw(
                  t('export.text'),
                  pdf.images ? t('export.textHelp') : t('export.textLocked'),
                  pdf.text,
                  (v) => setPdf({ ...pdf, text: v }),
                  !pdf.images,
                )}
                {p.fmt === 'pdf' && (
                  <>
                    {sw(t('export.numbering'), t('export.numberingHelp'), pdf.numbering, (v) =>
                      setPdf({ ...pdf, numbering: v }),
                    )}
                    {sw(
                      t('export.bubbles'),
                      pdf.images ? t('export.bubblesHelp') : t('export.bubblesLocked'),
                      pdf.images && pdf.bubbles,
                      (v) => setPdf({ ...pdf, bubbles: v }),
                      !pdf.images,
                    )}
                    {sw(t('export.cover'), t('export.coverHelp'), pdf.cover, (v) =>
                      setPdf({ ...pdf, cover: v }),
                    )}
                  </>
                )}
              </div>
            </fieldset>
            {p.fmt === 'pdf' && (
              <div className="row-2">
                <div className="fd-field">
                  <label className="fd-label" htmlFor={`${p.id}-fmt`}>
                    {t('export.paper')}
                  </label>
                  <Select
                    id={`${p.id}-fmt`}
                    value={pdf.orientation}
                    onChange={(e) =>
                      setPdf({ ...pdf, orientation: e.target.value as PdfOptions['orientation'] })
                    }
                  >
                    <option value="portrait">{t('export.a4portrait')}</option>
                    <option value="landscape">{t('export.a4landscape')}</option>
                  </Select>
                </div>
                <div className="fd-field">
                  <label className="fd-label" htmlFor={`${p.id}-lng`}>
                    {t('export.lang')}
                  </label>
                  <Select id={`${p.id}-lng`} defaultValue="demo">
                    <option value="demo">
                      {t(i18n.language.startsWith('en') ? 'export.langEn' : 'export.langFr')}
                    </option>
                  </Select>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <fieldset>
              <legend className="fd-label">{t('export.speed')}</legend>
              {seg(
                t('export.speed'),
                gif.seconds,
                GIF_SPEEDS.map((s) => ({ v: s.seconds as number, label: t(`export.speed_${s.key}`) })),
                (v) => setGif({ ...gif, seconds: v }),
              )}
            </fieldset>
            <div className="row-2">
              {p.fmt === 'mp4' ? (
                <div className="fd-field">
                  <label className="fd-label" htmlFor={`${p.id}-vfmt`}>
                    {t('export.frameFormat')}
                  </label>
                  <Select
                    id={`${p.id}-vfmt`}
                    value={mp4x.format}
                    onChange={(e) => setMp4x({ ...mp4x, format: e.target.value as Mp4Format })}
                  >
                    {MP4_FORMATS.map((f) => (
                      <option key={f.key} value={f.key}>
                        {t(`export.vfmt_${f.key}`)}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : (
                <div className="fd-field">
                  <label className="fd-label" htmlFor={`${p.id}-gsz`}>
                    {t('export.size')}
                  </label>
                  <Select
                    id={`${p.id}-gsz`}
                    value={gif.width}
                    onChange={(e) => setGif({ ...gif, width: Number(e.target.value) as GifOptions['width'] })}
                  >
                    {GIF_WIDTHS.map((w) => (
                      <option key={w} value={w}>
                        {t(`export.size_${w}`)}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <div className="fd-field">
                <label className="fd-label" htmlFor={`${p.id}-grg`}>
                  {t('export.steps')}
                </label>
                <Select
                  id={`${p.id}-grg`}
                  value={gif.range}
                  onChange={(e) => setGif({ ...gif, range: e.target.value as 'all' | 'range' })}
                >
                  <option value="all">{t('export.allSteps', { count: n })}</option>
                  <option value="range">{t('export.someSteps')}</option>
                </Select>
              </div>
            </div>
            {gif.range === 'range' && (
              <div className="row-2">
                {(['from', 'to'] as const).map((k) => (
                  <div className="fd-field" key={k}>
                    <label className="fd-label" htmlFor={`${p.id}-${k}`}>
                      {t(`export.range_${k}`)}
                    </label>
                    <Select
                      id={`${p.id}-${k}`}
                      value={gif[k]}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setGif(
                          k === 'from'
                            ? { ...gif, from: v, to: Math.max(v, gif.to) }
                            : { ...gif, to: v, from: Math.min(v, gif.from) },
                        );
                      }}
                    >
                      {demo?.steps.map((s, i) => (
                        <option key={i} value={i}>
                          {`${i + 1}. ${s.title || t('export.stepN', { n: i + 1 })}`}
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>
            )}
            <fieldset>
              <legend className="fd-label">{t('export.content')}</legend>
              <div className="opts">
                {sw(t('export.bubble'), null, gif.bubble, (v) => setGif({ ...gif, bubble: v }))}
                {sw(t('export.cursor'), null, gif.cursor, (v) => setGif({ ...gif, cursor: v }))}
                {p.fmt === 'mp4' ? (
                  <>
                    {sw(t('export.zooms'), null, mp4x.zoom, (v) => setMp4x({ ...mp4x, zoom: v }))}
                    {sw(t('export.titleScreen'), t('export.titleScreenHelp'), mp4x.title, (v) =>
                      setMp4x({ ...mp4x, title: v }),
                    )}
                  </>
                ) : (
                  sw(t('export.loop'), null, gif.loop, (v) => setGif({ ...gif, loop: v }))
                )}
              </div>
            </fieldset>
            {p.fmt === 'mp4' && (
              <fieldset>
                <legend className="fd-label">{t('export.subtitles')}</legend>
                {seg(
                  t('export.subtitles'),
                  mp4x.subtitles,
                  [
                    { v: 'vtt' as Subtitles, label: t('export.sub_vtt') },
                    { v: 'burn' as Subtitles, label: t('export.sub_burn') },
                    { v: 'none' as Subtitles, label: t('export.sub_none') },
                  ],
                  (v) => setMp4x({ ...mp4x, subtitles: v }),
                )}
                <p className="fd-help">{t('export.subtitlesHelp')}</p>
              </fieldset>
            )}
          </>
        )}

        <div className="fd-alert x15-alert">
          <Lock aria-hidden="true" />
          <div>{t('export.privacy')}</div>
        </div>
        <div className="x15-foot">
          <p className="fd-help">
            {!p.ready
              ? t('export.preparing')
              : p.fmt === 'pdf'
                ? t('export.helpPdf', { count: p.pages.length })
                : p.fmt === 'html'
                  ? t('export.helpHtml', { count: n })
                  : p.fmt === 'mp4' && p.mp4Opts
                    ? t(p.mp4x.title ? 'export.helpMp4' : 'export.helpMp4NoTitle', {
                        n: mp4Duration(p.mp4Opts, demo?.steps).toLocaleString(i18n.language),
                      })
                    : `${t(gif.loop ? 'export.helpGifLoop' : 'export.helpGifOnce', {
                        n: gifDuration(range, gif.seconds).toLocaleString(i18n.language),
                      })} ${t('export.helpGifLong')}`}
          </p>
          <button type="button" className="fd-btn" onClick={p.onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="fd-btn fd-btn--primary" disabled={!p.ready} onClick={p.onStart}>
            <Download aria-hidden="true" />
            {t(
              p.fmt === 'pdf'
                ? 'export.goPdf'
                : p.fmt === 'html'
                  ? 'export.goHtml'
                  : p.fmt === 'mp4'
                    ? 'export.goMp4'
                    : 'export.goGif',
            )}
          </button>
        </div>
      </div>
      {p.fmt === 'html' ? (
        // L29-03 : aperçu du plan de la page (titres dans l'ordre de lecture)
        <aside className="x15-side" aria-label={t('export.preview')}>
          <div className="cap">
            <span>{t('export.preview')}</span>
          </div>
          <div className="exp-outline">
            <b>{demo?.title}</b>
            <ol>
              {demo?.steps.map((s, i) => (
                <li key={i}>{t('export.a11y.step', { n: i + 1, title: s.title })}</li>
              ))}
            </ol>
          </div>
        </aside>
      ) : p.fmt === 'pdf' ? (
        <aside className="x15-side" aria-label={t('export.preview')}>
          <div className="cap">
            <span>{t('export.preview')}</span>
            <span>{t('export.previewLive')}</span>
          </div>
          <div className="x15-page" aria-hidden="true">
            {p.pages[p.page] && demo ? (
              <PdfPagePreview page={p.pages[p.page]!} size={pageSize(pdf)} demo={demo} />
            ) : (
              <div
                className="x15-page-wait"
                style={{ aspectRatio: pdf.orientation === 'portrait' ? '210 / 297' : '297 / 210' }}
              />
            )}
          </div>
          <div className="pager">
            <button
              type="button"
              aria-label={t('export.prevPage')}
              disabled={p.page === 0}
              onClick={() => p.setPage(p.page - 1)}
            >
              <ArrowLeft aria-hidden="true" />
            </button>
            <span>{t('export.pageOf', { n: p.pages.length ? p.page + 1 : 0, total: p.pages.length })}</span>
            <button
              type="button"
              aria-label={t('export.nextPage')}
              disabled={p.page >= p.pages.length - 1}
              onClick={() => p.setPage(p.page + 1)}
            >
              <ArrowRight aria-hidden="true" />
            </button>
          </div>
        </aside>
      ) : (
        <GifPreview
          demo={demo}
          opts={p.gifOpts}
          timing={
            p.fmt === 'mp4' && p.mp4Opts
              ? {
                  offset: p.mp4Opts.title ? 3000 : 0,
                  total: mp4Duration(p.mp4Opts, demo?.steps) * 1000,
                }
              : undefined
          }
          caption={
            p.fmt === 'mp4'
              ? `${mp4Format(mp4x.format).w.toLocaleString(i18n.language)} × ${mp4Format(mp4x.format).h.toLocaleString(i18n.language)}`
              : undefined
          }
        />
      )}
    </>
  );
}

/** L15-02 : aperçu du GIF dessiné par le même moteur que le fichier. */
function GifPreview({
  demo,
  opts,
  caption,
  timing,
}: {
  demo: ExportDemo | null;
  opts: GifOptions | null;
  /** L25-11 : taille de la vidéo à la place de celle du GIF. */
  caption?: string;
  /** L25-11 : minutage de la vidéo (écran de titre avant les étapes, durée totale), en ms. */
  timing?: { offset: number; total: number };
}) {
  const { t } = useTranslation();
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [paused, setPaused] = useState(reduced);
  const [frame, setFrame] = useState(0);
  const [bmps, setBmps] = useState<Map<number, ImageBitmap | null>>(new Map());
  const frames = useMemo(() => (demo && opts ? planGif(demo.steps, opts) : []), [demo, opts]);
  const W = 640;
  const H = demo && opts ? gifHeight(demo.steps[opts.from]!, W) : 400;

  useEffect(() => setFrame(0), [frames]);
  useEffect(() => {
    if (!demo || !opts) return;
    let alive = true;
    for (let i = opts.from; i <= opts.to; i++) {
      const url = demo.steps[i]!.imageUrl;
      if (bmps.has(i)) continue;
      void (url ? fetchBitmap(url, undefined, demo.steps[i]!.crop) : Promise.resolve(null))
        .catch(() => null)
        .then((b) => alive && setBmps((m) => new Map(m).set(i, b)));
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, opts?.from, opts?.to]);
  useEffect(() => {
    const f = frames[frame];
    const ctx = canvas.current?.getContext('2d');
    if (!f || !ctx || !demo) return;
    drawGifFrame(ctx, bmps.get(f.step) ?? null, demo.steps, f, W, H);
    if (paused) return;
    const id = setTimeout(() => setFrame((frame + 1) % frames.length), f.delay);
    return () => clearTimeout(id);
  }, [frame, frames, paused, bmps, demo, H]);

  const cur = frames[frame];
  const total = opts ? opts.to - opts.from + 1 : 0;
  const n = cur && opts ? cur.step - opts.from + 1 : 0;
  return (
    <aside className="x15-side" aria-label={t('export.previewGif')}>
      <div className="cap">
        <span>{t('export.preview')}</span>
        <span>
          {caption ??
            (opts ? `${opts.width} × ${demo ? gifHeight(demo.steps[opts.from]!, opts.width) : 0} px` : '')}
        </span>
      </div>
      <div className="gif-frame" aria-hidden="true">
        <canvas ref={canvas} width={W} height={H} />
      </div>
      <div className="gif-dots" aria-hidden="true">
        {Array.from({ length: Math.min(total, 40) }, (_, i) => (
          <span key={i} className={i < n ? 'on' : ''} />
        ))}
      </div>
      <div className="gif-meta">
        <span>
          {t('export.stepOf', { n, total })}
          {timing && (
            <span className="gif-time">
              {' · '}
              {clock(timing.offset + frames.slice(0, frame).reduce((a, f) => a + f.delay, 0))} /{' '}
              {clock(timing.total)}
            </span>
          )}
        </span>
        <button type="button" className="fd-btn fd-btn--sm" onClick={() => setPaused(!paused)}>
          {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
          {t(paused ? 'export.play' : 'export.pause')}
        </button>
      </div>
    </aside>
  );
}

/** L25-11 : vidéo d'une étape, prête à être lue image par image. */
function loadVideo(url: string, signal: AbortSignal): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.muted = true;
    v.preload = 'auto';
    v.playsInline = true;
    const done = () => resolve(v);
    v.addEventListener('loadeddata', done, { once: true });
    v.addEventListener('error', () => reject(new Error('VIDEO_LOAD')), { once: true });
    signal.addEventListener('abort', () => reject(new DOMException('Export annulé', 'AbortError')), {
      once: true,
    });
    v.src = url;
  });
}

/** Position exacte dans la vidéo (attend l'image). */
function seekVideo(v: HTMLVideoElement, s: number): Promise<void> {
  const target = Math.min(Math.max(0, s), Math.max(0, (v.duration || s) - 0.001));
  if (Math.abs(v.currentTime - target) < 0.0005 && v.readyState >= 2) return Promise.resolve();
  return new Promise((resolve) => {
    v.addEventListener('seeked', () => resolve(), { once: true });
    v.currentTime = target;
  });
}

/** Son de la vidéo décodé (48 kHz) ; vide si le fichier n'a pas de son. */
async function decodeSound(url: string, signal: AbortSignal): Promise<Float32Array[]> {
  const buf = await (await fetch(url, { signal })).arrayBuffer();
  const ctx = new OfflineAudioContext(2, 1, AUDIO_RATE);
  try {
    const a = await ctx.decodeAudioData(buf);
    return Array.from({ length: a.numberOfChannels }, (_, c) => a.getChannelData(c));
  } catch {
    return [];
  }
}

/** 00:04 (minutage de l'aperçu vidéo). */
const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
