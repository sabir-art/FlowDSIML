import type { ExportDemo } from './model';

/**
 * L29-03 / L29-04 : version accessible d'une démo, en un seul fichier HTML autonome (images
 * intégrées en data URL, styles intégrés, aucun script). Spec docs/ux/specs/l29-snippets-version-accessible.md §3.3 :
 * lang et title, h1 démo, h2 chapitres, h3 « Étape n · titre », texte alternatif de chaque capture,
 * consigne en texte réel, sommaire en tête et lien d'évitement, ordre de lecture = ordre des étapes.
 */
export interface AccessibleStrings {
  skip: string;
  toc: string;
  /** « Étape {{n}} · {{title}} » (n et title déjà remplacés par l'appelant via stepHeading). */
  stepHeading: (n: number, title: string) => string;
  /** « Capture d'écran : {{title}}. » */
  altCapture: (title: string) => string;
  /** Phrase ajoutée quand un repère est posé (« La zone à cliquer est entourée. »). */
  altTarget: string;
  /** Étape vidéo : « Première image de la vidéo : {{title}}. » */
  altVideo: (title: string) => string;
  transcript: string;
  quiz: string;
  /** h2 des étapes sans chapitre (« Autres étapes ») et de toutes les étapes s'il n'y a pas de chapitre (« Étapes »). */
  noChapter: string;
  allSteps: string;
  generated: string;
}

export interface AccessibleOptions {
  /** Captures incluses (data URL par index d'étape ; null si l'étape n'a pas d'image). */
  images: boolean;
  /** Consigne de la bulle sous chaque capture. */
  text: boolean;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Texte alternatif : saisi sur l'étape s'il existe (pas encore dans le modèle), sinon construit. */
export function altText(
  step: { title: string; kind?: string; target: unknown; alt?: string },
  n: number,
  s: AccessibleStrings,
): string {
  if (step.alt?.trim()) return step.alt.trim();
  const title = step.title || s.stepHeading(n, '').replace(/\s*·\s*$/, '');
  if (step.kind === 'video') return s.altVideo(title);
  return [s.altCapture(title), step.target ? s.altTarget : ''].filter(Boolean).join(' ');
}

const CSS = `
:root{color-scheme:light;--ink:#12161B;--muted:#4A5562;--rule:#D5DCE4;--bg:#FFFFFF;--accent:#8C1048}
*{box-sizing:border-box}
html{font-size:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:1rem/1.6 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
.skip{position:absolute;left:-999em;top:0;background:var(--ink);color:#fff;padding:.5em 1em;z-index:1}
.skip:focus{left:1em;top:1em}
main,header,nav,footer{max-width:48rem;margin:0 auto;padding:0 1.25rem}
header{padding-top:2rem}
h1{font-size:2rem;line-height:1.2;margin:0 0 .5rem}
h2{font-size:1.5rem;line-height:1.25;margin:2.5rem 0 1rem;padding-top:1rem;border-top:2px solid var(--rule)}
h3{font-size:1.2rem;line-height:1.3;margin:2rem 0 .75rem}
p{margin:0 0 1rem}
.meta{color:var(--muted)}
nav ol{padding-left:1.5rem}
nav li{margin:.25rem 0}
a{color:var(--accent);text-decoration:underline;text-underline-offset:2px}
a:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
figure{margin:0 0 1rem}
img{display:block;max-width:100%;height:auto;border:1px solid var(--rule);border-radius:6px}
.transcript{border-left:4px solid var(--rule);padding-left:1rem;color:var(--ink)}
footer{color:var(--muted);font-size:.875rem;padding-bottom:2rem;margin-top:3rem}
@media print{.skip,nav{display:none}h2{break-before:page}section.step{break-inside:avoid}a{color:inherit}}
`.trim();

export function renderAccessibleHtml(
  d: ExportDemo,
  images: Map<number, string | null>,
  o: AccessibleOptions,
  s: AccessibleStrings,
): string {
  const lang = d.lang || 'fr-FR';
  const chapters = d.chapters ?? [];
  const known = new Set(chapters.map((c) => c.id));
  const steps = d.steps.map((st, i) => ({ st, n: i + 1, id: `etape-${i + 1}` }));
  // Ordre de lecture = ordre des étapes ; un h2 à chaque changement de chapitre
  const groups: Array<{ title: string; items: typeof steps }> = [];
  for (const x of steps) {
    const cid = x.st.chapterId && known.has(x.st.chapterId) ? x.st.chapterId : null;
    const title = cid
      ? chapters.find((c) => c.id === cid)!.title
      : chapters.length
        ? s.noChapter
        : s.allSteps;
    const last = groups[groups.length - 1];
    if (last && last.title === title) last.items.push(x);
    else groups.push({ title, items: [x] });
  }
  const toc = steps
    .map((x) => `<li><a href="#${x.id}">${esc(s.stepHeading(x.n, x.st.title))}</a></li>`)
    .join('');
  const stepHtml = (x: (typeof steps)[number]) => {
    const img = o.images ? images.get(x.n - 1) : null;
    const parts = [`<section class="step" aria-labelledby="${x.id}">`];
    parts.push(`<h3 id="${x.id}">${esc(s.stepHeading(x.n, x.st.title))}</h3>`);
    if (img) parts.push(`<figure><img src="${img}" alt="${esc(altText(x.st, x.n, s))}"></figure>`);
    if ((o.text || !img) && x.st.text) parts.push(`<p>${esc(x.st.text)}</p>`);
    if (x.st.transcript)
      parts.push(
        `<div class="transcript"><p><strong>${esc(s.transcript)}</strong></p><p>${esc(x.st.transcript)}</p></div>`,
      );
    parts.push('</section>');
    return parts.join('');
  };
  const body = groups.map((g) => `<h2>${esc(g.title)}</h2>` + g.items.map(stepHtml).join('')).join('');
  const quiz =
    d.questions && d.questions.length
      ? `<h2>${esc(s.quiz)}</h2><ol>${d.questions.map((q) => `<li>${esc(q)}</li>`).join('')}</ol>`
      : '';
  return [
    '<!doctype html>',
    `<html lang="${esc(lang)}">`,
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(d.title)}</title>`,
    `<style>${CSS}</style></head>`,
    '<body>',
    `<a class="skip" href="#contenu">${esc(s.skip)}</a>`,
    `<header><h1>${esc(d.title)}</h1>${d.workspace ? `<p class="meta">${esc(d.workspace)}</p>` : ''}</header>`,
    `<nav aria-labelledby="sommaire"><h2 id="sommaire">${esc(s.toc)}</h2><ol>${toc}</ol></nav>`,
    `<main id="contenu" tabindex="-1">${body}${quiz}</main>`,
    `<footer><p>${esc(s.generated)}</p></footer>`,
    '</body></html>',
  ].join('\n');
}
