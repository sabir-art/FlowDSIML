/**
 * Aperçu d'une page PDF : le plan de blocs (millimètres) dessiné en SVG. Mêmes positions, mêmes
 * retours à la ligne que le fichier (mesurés avec la police embarquée par jsPDF).
 */
import { onColor, type Page } from '@flowdsiml/exports/layout';
import type { ExportDemo } from '@flowdsiml/exports/model';

const PT = 0.3528;
const W8: Record<string, number> = { regular: 400, bold: 700, extrabold: 800 };
const ANCHOR = { left: 'start', center: 'middle', right: 'end' } as const;

export function PdfPagePreview({
  page,
  size,
  demo,
}: {
  page: Page;
  size: { W: number; H: number };
  demo: ExportDemo;
}) {
  return (
    <svg
      className="x15-svg"
      viewBox={`0 0 ${size.W} ${size.H}`}
      xmlns="http://www.w3.org/2000/svg"
      fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
      role="presentation"
    >
      <rect width={size.W} height={size.H} fill="#FFFFFF" />
      {page.blocks.map((b, i) => {
        switch (b.t) {
          case 'rect':
            return (
              <rect
                key={i}
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                rx={b.r ?? 0}
                fill={b.fill ?? 'none'}
                stroke={b.stroke ?? 'none'}
                strokeWidth={b.lw ?? 0.3}
              />
            );
          case 'line':
            return (
              <line key={i} x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} stroke={b.color} strokeWidth={b.lw} />
            );
          case 'circle':
            return (
              <g key={i}>
                <circle cx={b.cx} cy={b.cy} r={b.r} fill={b.fill} />
                {b.label && (
                  <text
                    x={b.cx}
                    y={b.cy}
                    fontSize={(b.size ?? 8) * PT}
                    fontWeight={700}
                    fill={b.labelColor ?? '#FFFFFF'}
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {b.label}
                  </text>
                )}
              </g>
            );
          case 'logo':
            return (
              <g key={i}>
                <rect x={b.x} y={b.y} width={b.size} height={b.size} rx={b.size * 0.22} fill={b.color} />
                <text
                  x={b.x + b.size / 2}
                  y={b.y + b.size / 2}
                  fontSize={b.size * (b.initials.length > 2 ? 1.05 : 1.35) * PT}
                  fontWeight={800}
                  fill={onColor(b.color)}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {b.initials}
                </text>
              </g>
            );
          case 'image': {
            const url = demo.steps[b.step]?.imageUrl;
            return url ? (
              <image key={i} href={url} x={b.x} y={b.y} width={b.w} height={b.h} preserveAspectRatio="none" />
            ) : (
              <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill="#F1F3F6" />
            );
          }
          case 'rich':
            return (
              <text key={i} fontSize={b.size * PT} fill={b.color} dominantBaseline="text-before-edge">
                {b.lines.flatMap((l, k) =>
                  l.map((seg, j) => (
                    <tspan
                      key={`${k}-${j}`}
                      x={b.x + seg.dx}
                      y={b.y + k * b.size * PT * b.lh}
                      fontWeight={W8[seg.weight]}
                    >
                      {seg.text}
                    </tspan>
                  )),
                )}
              </text>
            );
          case 'text':
            return (
              <text
                key={i}
                fontSize={b.size * PT}
                fontWeight={W8[b.weight]}
                fill={b.color}
                textAnchor={ANCHOR[b.align ?? 'left']}
                dominantBaseline="text-before-edge"
              >
                {b.lines.map((l, k) => (
                  <tspan key={k} x={b.x} y={b.y + k * b.size * PT * b.lh}>
                    {l}
                  </tspan>
                ))}
              </text>
            );
        }
      })}
    </svg>
  );
}
