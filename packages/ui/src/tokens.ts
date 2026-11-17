/**
 * FlowDSIML — Design tokens (SOURCE UNIQUE).
 *
 * Propriété : Lead UX. Toute modification passe par ce fichier, puis :
 *   node packages/ui/src/tokens.build.mjs      → régénère tokens.css
 * Ne jamais éditer tokens.css à la main.
 *
 * Conventions
 * - Variables CSS préfixées `--fd-` (FlowDSIML).
 * - Couleurs sémantiques déclinées en `light` / `dark` ; le mode sombre s'active
 *   avec `data-theme="dark"` sur <html> (ou automatiquement via prefers-color-scheme
 *   si `data-theme` est absent ou vaut "system").
 * - Une couche d'alias compatible shadcn/ui + Tailwind est générée (voir `aliases`).
 * - Documentation : docs/ux/identite-visuelle.md et docs/ux/composants.md.
 */

/* ------------------------------------------------------------------ */
/* 1. Palettes de base                                                 */
/* ------------------------------------------------------------------ */

export const palette = {
  lagoon: {
    50: '#EEFBF8', 100: '#D3F4EC', 200: '#A8E8DA', 300: '#70D4C2', 400: '#38B8A5',
    500: '#16998A', 600: '#0E7C71', 700: '#0D635B', 800: '#0F4F4A', 900: '#0F413D', 950: '#052624',
  },
  ember: {
    50: '#FFF4EF', 100: '#FFE5D9', 200: '#FFC7AE', 300: '#FFA07A', 400: '#FF7447',
    500: '#E8541F', 600: '#C93A0E', 700: '#A8300C', 800: '#872912', 900: '#6E2413', 950: '#3D0F06',
  },
  stone: {
    0: '#FFFFFF', 50: '#F7F6F4', 100: '#EFEDEA', 200: '#E2DFDA', 300: '#CBC6BF', 400: '#8C857B',
    500: '#77716A', 600: '#5F5A52', 700: '#48443E', 800: '#302D29', 900: '#1F1D1A', 950: '#141311',
  },
  success: { fg: '#15803D', bg: '#ECFDF3', fgDark: '#4ADE80', bgDark: '#0F2A1B' },
  warning: { fg: '#B45309', bg: '#FFF7E6', fgDark: '#FBBF24', bgDark: '#2E2208' },
  danger: { fg: '#C9302C', bg: '#FEF1F1', fgDark: '#F87171', bgDark: '#331312' },
  info: { fg: '#2563EB', bg: '#EFF5FF', fgDark: '#60A5FA', bgDark: '#0F1E38' },
} as const;

const { lagoon, ember, stone, success, warning, danger, info } = palette;

/* ------------------------------------------------------------------ */
/* 2. Couleurs sémantiques (clé = suffixe de --fd-color-*)             */
/* ------------------------------------------------------------------ */

export const colors = {
  light: {
    'bg': stone[50],
    'surface': stone[0],
    'surface-sunken': stone[100],
    'surface-raised': stone[0],
    'surface-hover': stone[100],
    'surface-selected': lagoon[50],
    'surface-inverse': stone[900],
    'border': stone[200],
    'border-strong': stone[400],
    'border-selected': lagoon[600],
    'text': stone[900],
    'text-muted': stone[600],
    'text-subtle': stone[500],
    'text-inverse': stone[0],
    'text-disabled': stone[400],
    'primary': lagoon[600],
    'primary-hover': lagoon[700],
    'primary-active': lagoon[800],
    'primary-soft': lagoon[50],
    'primary-soft-text': lagoon[700],
    'on-primary': stone[0],
    'accent': ember[600],
    'accent-hover': ember[700],
    'accent-soft': ember[50],
    'accent-soft-text': ember[700],
    'on-accent': stone[0],
    'hotspot': ember[500],
    'focus': lagoon[500],
    'success': success.fg,
    'success-soft': success.bg,
    'warning': warning.fg,
    'warning-soft': warning.bg,
    'danger': danger.fg,
    'danger-hover': '#A92622',
    'danger-soft': danger.bg,
    'on-danger': stone[0],
    'info': info.fg,
    'info-soft': info.bg,
    'overlay': 'rgba(20, 19, 17, 0.48)',
    'canvas-editor': stone[100],
    'skeleton': stone[200],
    'chart-1': lagoon[600],
    'chart-2': ember[500],
    'chart-3': '#6B7FD7',
    'chart-4': '#D4A017',
    'chart-5': stone[500],
  },
  dark: {
    'bg': stone[950],
    'surface': '#1C1A18',
    'surface-sunken': '#100F0E',
    'surface-raised': '#24221F',
    'surface-hover': '#2A2824',
    'surface-selected': '#0F2D2A',
    'surface-inverse': '#F2F0EC',
    'border': '#34312D',
    'border-strong': '#7A746B',
    'border-selected': lagoon[400],
    'text': '#F2F0EC',
    'text-muted': '#B3ADA4',
    'text-subtle': '#8F897F',
    'text-inverse': stone[900],
    'text-disabled': '#5E5952',
    'primary': lagoon[400],
    'primary-hover': lagoon[300],
    'primary-active': lagoon[200],
    'primary-soft': '#0F2D2A',
    'primary-soft-text': lagoon[300],
    'on-primary': lagoon[950],
    'accent': ember[400],
    'accent-hover': ember[300],
    'accent-soft': '#3A1A10',
    'accent-soft-text': ember[300],
    'on-accent': ember[950],
    'hotspot': ember[400],
    'focus': lagoon[400],
    'success': success.fgDark,
    'success-soft': success.bgDark,
    'warning': warning.fgDark,
    'warning-soft': warning.bgDark,
    'danger': danger.fgDark,
    'danger-hover': '#FCA5A5',
    'danger-soft': danger.bgDark,
    'on-danger': '#2A0A09',
    'info': info.fgDark,
    'info-soft': info.bgDark,
    'overlay': 'rgba(0, 0, 0, 0.62)',
    'canvas-editor': '#100F0E',
    'skeleton': '#2A2824',
    'chart-1': lagoon[400],
    'chart-2': ember[400],
    'chart-3': '#8D9DEB',
    'chart-4': '#E8B931',
    'chart-5': '#8F897F',
  },
} as const;

export type ColorToken = keyof typeof colors.light;

/* ------------------------------------------------------------------ */
/* 3. Typographie                                                      */
/* ------------------------------------------------------------------ */

export const fontFamily = {
  display: '"Bricolage Grotesque", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  sans: '"Instrument Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
} as const;

export const googleFontsUrl =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..700&family=Instrument+Sans:wght@400..600&family=JetBrains+Mono:wght@400;500&display=swap';

export const fontWeight = { regular: '400', medium: '500', semibold: '600', bold: '700' } as const;

/** taille / interligne / famille / graisse / interlettrage */
export const textStyles = {
  'display': { size: '2.25rem', line: '1.1', family: 'display', weight: '700', tracking: '-0.02em' },
  'h1': { size: '1.75rem', line: '1.2', family: 'display', weight: '700', tracking: '-0.015em' },
  'h2': { size: '1.375rem', line: '1.25', family: 'display', weight: '600', tracking: '-0.01em' },
  'h3': { size: '1.125rem', line: '1.3', family: 'sans', weight: '600', tracking: '0' },
  'body-lg': { size: '1rem', line: '1.5', family: 'sans', weight: '400', tracking: '0' },
  'body': { size: '0.875rem', line: '1.45', family: 'sans', weight: '400', tracking: '0' },
  'label': { size: '0.8125rem', line: '1.3', family: 'sans', weight: '500', tracking: '0' },
  'caption': { size: '0.75rem', line: '1.35', family: 'sans', weight: '500', tracking: '0.01em' },
  'mono': { size: '0.8125rem', line: '1.5', family: 'mono', weight: '400', tracking: '0' },
} as const;

/* ------------------------------------------------------------------ */
/* 4. Espacements, rayons, ombres, bordures                            */
/* ------------------------------------------------------------------ */

/** clé = multiple de 4 px (space-6 = 24 px). `0-5` = 2 px. */
export const space = {
  '0': '0', '0-5': '0.125rem', '1': '0.25rem', '2': '0.5rem', '3': '0.75rem', '4': '1rem',
  '5': '1.25rem', '6': '1.5rem', '8': '2rem', '10': '2.5rem', '12': '3rem', '16': '4rem', '20': '5rem',
} as const;

export const radius = {
  'none': '0', 'xs': '4px', 'sm': '6px', 'md': '8px', 'lg': '12px', 'xl': '16px', '2xl': '24px', 'full': '9999px',
} as const;

export const shadow = {
  light: {
    'xs': '0 1px 2px rgba(31, 29, 26, 0.06)',
    'sm': '0 1px 2px rgba(31, 29, 26, 0.06), 0 2px 6px rgba(31, 29, 26, 0.06)',
    'md': '0 2px 4px rgba(31, 29, 26, 0.06), 0 8px 20px rgba(31, 29, 26, 0.10)',
    'lg': '0 4px 8px rgba(31, 29, 26, 0.06), 0 18px 40px rgba(31, 29, 26, 0.16)',
    'focus': '0 0 0 1px #FFFFFF, 0 0 0 4px rgba(22, 153, 138, 0.45)',
    'focus-danger': '0 0 0 1px #FFFFFF, 0 0 0 4px rgba(201, 48, 44, 0.40)',
  },
  dark: {
    'xs': '0 1px 2px rgba(0, 0, 0, 0.40)',
    'sm': '0 1px 2px rgba(0, 0, 0, 0.40), 0 2px 6px rgba(0, 0, 0, 0.30)',
    'md': '0 2px 4px rgba(0, 0, 0, 0.40), 0 8px 20px rgba(0, 0, 0, 0.45)',
    'lg': '0 4px 8px rgba(0, 0, 0, 0.45), 0 18px 40px rgba(0, 0, 0, 0.55)',
    'focus': '0 0 0 1px #141311, 0 0 0 4px rgba(56, 184, 165, 0.55)',
    'focus-danger': '0 0 0 1px #141311, 0 0 0 4px rgba(248, 113, 113, 0.50)',
  },
} as const;

export const borderWidth = { 'default': '1px', 'strong': '2px' } as const;

/* ------------------------------------------------------------------ */
/* 5. Mouvement, z-index, layout, breakpoints                          */
/* ------------------------------------------------------------------ */

export const motion = {
  'duration-fast': '120ms',
  'duration-base': '200ms',
  'duration-slow': '320ms',
  'duration-pulse': '1800ms',
  'ease-standard': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  'ease-emphasized': 'cubic-bezier(0.3, 0, 0, 1.3)',
  'ease-exit': 'cubic-bezier(0.4, 0, 1, 1)',
} as const;

export const zIndex = {
  'base': '0', 'raised': '10', 'sticky': '100', 'dropdown': '1000', 'overlay': '1100',
  'modal': '1200', 'popover': '1300', 'toast': '1400', 'tooltip': '1500',
} as const;

export const layout = {
  'sidebar-width': '240px',
  'sidebar-width-collapsed': '64px',
  'topbar-height': '56px',
  'content-max': '1200px',
  'editor-rail-width': '248px',
  'editor-panel-width': '320px',
  'editor-toolbar-height': '52px',
  'control-height-sm': '32px',
  'control-height-md': '40px',
  'control-height-lg': '48px',
} as const;

/** Points de rupture (px) — à utiliser en JS ; en CSS, écrire les media queries en dur. */
export const breakpoints = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 } as const;

/* ------------------------------------------------------------------ */
/* 6. Thème du player (valeurs par défaut, surchargées par themes.tokens) */
/* ------------------------------------------------------------------ */

export const player = {
  'primary': lagoon[600],
  'on-primary': stone[0],
  'hotspot': ember[500],
  'tooltip-bg': stone[0],
  'tooltip-text': stone[900],
  'tooltip-muted': stone[600],
  'overlay': 'rgba(20, 19, 17, 0.55)',
  'radius': '16px',
  'font': fontFamily.sans,
  'backdrop': `linear-gradient(160deg, ${lagoon[50]} 0%, ${stone[50]} 60%, ${ember[50]} 100%)`,
  'browser-bar': stone[100],
  'browser-bar-dark': '#26241F',
  'shadow': shadow.light.lg,
} as const;

/** Clés que l'utilisateur peut surcharger dans un thème de démo (stockées en JSONB). */
export const playerThemeKeys = ['primary', 'hotspot', 'tooltip-bg', 'overlay', 'radius', 'font', 'backdrop'] as const;
export type PlayerThemeKey = (typeof playerThemeKeys)[number];

/* ------------------------------------------------------------------ */
/* 7. Alias de compatibilité shadcn/ui + Tailwind                      */
/*    nom de variable alias → token FlowDSIML                          */
/* ------------------------------------------------------------------ */

export const aliases = {
  '--background': 'var(--fd-color-bg)',
  '--foreground': 'var(--fd-color-text)',
  '--card': 'var(--fd-color-surface)',
  '--card-foreground': 'var(--fd-color-text)',
  '--popover': 'var(--fd-color-surface-raised)',
  '--popover-foreground': 'var(--fd-color-text)',
  '--primary': 'var(--fd-color-primary)',
  '--primary-foreground': 'var(--fd-color-on-primary)',
  '--secondary': 'var(--fd-color-surface-sunken)',
  '--secondary-foreground': 'var(--fd-color-text)',
  '--muted': 'var(--fd-color-surface-sunken)',
  '--muted-foreground': 'var(--fd-color-text-muted)',
  '--accent': 'var(--fd-color-surface-hover)',
  '--accent-foreground': 'var(--fd-color-text)',
  '--destructive': 'var(--fd-color-danger)',
  '--destructive-foreground': 'var(--fd-color-on-danger)',
  '--border': 'var(--fd-color-border)',
  '--input': 'var(--fd-color-border-strong)',
  '--ring': 'var(--fd-color-focus)',
  '--radius': 'var(--fd-radius-md)',
  '--sidebar': 'var(--fd-color-surface)',
  '--sidebar-foreground': 'var(--fd-color-text)',
  '--sidebar-primary': 'var(--fd-color-primary)',
  '--sidebar-primary-foreground': 'var(--fd-color-on-primary)',
  '--sidebar-accent': 'var(--fd-color-surface-hover)',
  '--sidebar-accent-foreground': 'var(--fd-color-text)',
  '--sidebar-border': 'var(--fd-color-border)',
  '--sidebar-ring': 'var(--fd-color-focus)',
  '--chart-1': 'var(--fd-color-chart-1)',
  '--chart-2': 'var(--fd-color-chart-2)',
  '--chart-3': 'var(--fd-color-chart-3)',
  '--chart-4': 'var(--fd-color-chart-4)',
  '--chart-5': 'var(--fd-color-chart-5)',
} as const;
// Note : dans shadcn, `--accent` désigne le fond de survol (pas notre couleur de
// conversion). Pour la couleur Ember, utiliser `--fd-color-accent`.

/* ------------------------------------------------------------------ */
/* 7 bis. Alias de compatibilité avec les tokens provisoires du MVP     */
/*    (variables utilisées dans apps/web avant l'arrivée du design      */
/*    system). Nouveau code : utiliser les tokens sémantiques ci-dessus. */
/* ------------------------------------------------------------------ */

export const legacyAliases = {
  '--fd-color-primary-contrast': 'var(--fd-color-on-primary)',
  '--fd-color-surface-muted': 'var(--fd-color-surface-sunken)',
  '--fd-font-family': 'var(--fd-font-sans)',
  '--fd-font-xs': 'var(--fd-text-caption-size)',
  '--fd-font-sm': 'var(--fd-text-body-size)',
  '--fd-font-md': 'var(--fd-text-body-lg-size)',
  '--fd-font-lg': '1.25rem',
  '--fd-font-xl': 'var(--fd-text-h1-size)',
  '--fd-space-7': 'var(--fd-space-12)',
} as const;
// Valeurs qui changent volontairement (même nom, nouvelle échelle) :
//   --fd-space-5 : 24px → 20px · --fd-space-6 : 32px → 24px (échelle en multiples de 4 px)
//   --fd-radius-md : 10px → 8px · --fd-radius-lg : 16px → 12px

/* ------------------------------------------------------------------ */
/* 8. Helpers                                                          */
/* ------------------------------------------------------------------ */

/** `cssVar('color', 'primary')` → `var(--fd-color-primary)` */
export const cssVar = (group: string, name: string): string => `var(--fd-${group}-${name})`;

export const tokens = {
  palette, colors, fontFamily, fontWeight, textStyles, space, radius, shadow, borderWidth,
  motion, zIndex, layout, breakpoints, player, aliases, legacyAliases, googleFontsUrl,
} as const;

export type Tokens = typeof tokens;

export default tokens;
