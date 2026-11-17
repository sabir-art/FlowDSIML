/** Contraste WCAG entre deux couleurs #RRGGBB (1 à 21). */
export function contrastRatio(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function channels(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string): number {
  const c = channels(hex);
  if (!c) return 0;
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Même teinte assombrie par pas de 5 % jusqu'à atteindre `target` contre le blanc ; null si impossible. */
export function darkenToContrast(hex: string, target = 4.5): string | null {
  const c = channels(hex);
  if (!c) return null;
  for (let k = 1; k >= 0; k -= 0.05) {
    const out =
      '#' +
      c
        .map((v) =>
          Math.round(v * k)
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')
        .toUpperCase();
    if (contrastRatio(out, '#FFFFFF') >= target) return out;
  }
  return null;
}
