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
  // Couleurs officielles de la charte DSI des Missions Locales (docs/ux/brand-dsi/README.md).
  // La teinte officielle est signalée par « ← charte ».
  prune: {
    50: '#FBF0F5',
    100: '#F3D3E2',
    200: '#E3A9C4',
    300: '#CF86A9',
    400: '#C0628F',
    500: '#B23D75',
    600: '#A3195B' /* ← charte */,
    700: '#85164B',
    800: '#67123B',
    900: '#480F2A',
    950: '#2A0C1A',
  },
  framboise: {
    50: '#FDEFF3',
    100: '#F9D3E0',
    200: '#F0A6C0',
    300: '#E97FA4',
    400: '#E35889',
    500: '#DC326D',
    600: '#D60B52' /* ← charte */,
    700: '#AE0A44',
    800: '#860A35',
    900: '#5D0927',
    950: '#350918',
  },
  bleu: {
    50: '#EDF6FC',
    100: '#D3EAF7',
    200: '#A3D2ED',
    300: '#7ABFE5',
    400: '#51ABDD',
    500: '#2897D5' /* ← charte */,
    600: '#2381B5',
    700: '#1E6A95',
    800: '#195475',
    900: '#143E55',
    950: '#0F2735',
  },
  vert: {
    50: '#F5F9E8',
    100: '#E6F0C7',
    200: '#C7DE89',
    300: '#AED054',
    400: '#95C11F' /* ← charte */,
    500: '#83A91C',
    600: '#6B8A17',
    700: '#557014',
    800: '#435812',
    900: '#33430F',
    950: '#1F290A',
  },
  orange: {
    50: '#FFF6E8',
    100: '#FDE9CC',
    200: '#FAD091',
    300: '#F8BB61',
    400: '#F5A730',
    500: '#F39200' /* ← charte */,
    600: '#CE7C01',
    700: '#A86402',
    800: '#855104',
    900: '#603C05',
    950: '#3C2606',
  },
  // L52 : deux teintes de plus pour les étiquettes (50, 200, 400, 700)
  sarcelle: { 50: '#EAF6F5', 200: '#9ED9D3', 400: '#2BA79C', 700: '#0B6660' },
  violet: { 50: '#F3F0FB', 200: '#CDBDF0', 400: '#8A6AD6', 700: '#5A3A9C' },
  // L52 : texte de l'étiquette orange (5,76:1 sur orange-50 ; orange-700 ne donnait que 4,37:1)
  tag: { 'orange-text': '#8F5300' },
  // Neutres froids (gris-bleuté), accordés au fond #EEF2F6 de la référence de style.
  ardoise: {
    0: '#FFFFFF',
    50: '#F6F8FA',
    100: '#EEF2F6',
    200: '#E2E8EF',
    300: '#CBD3DD',
    400: '#8793A3',
    500: '#66727F',
    600: '#4F5966',
    700: '#3A424D',
    800: '#262C34',
    900: '#161A20',
    950: '#0B0D10',
  },
  noir: { 900: '#080808' /* ← charte */ },
  // Couleurs du LOGO TutoClick (fourni par le client). Réservées au logo, aux icônes d'app et aux
  // supports de marque : l'interface utilise les rôles DSI ci-dessous (voir identite-visuelle.md §3).
  // Logo officiel du 20 novembre 2026 (LOGO-01) : magenta, encre, nuit. L'ancien dégradé et le bleu
  // du logo précédent sont abandonnés.
  brand: {
    magenta: '#A3195B',
    encre: '#1A1A1A',
    nuit: '#123A49',
  },
  success: { fg: '#557014', bg: '#F5F9E8', fgDark: '#AED054', bgDark: '#1C2409' },
  warning: { fg: '#855104', bg: '#FFF6E8', fgDark: '#F8BB61', bgDark: '#2B1D05' },
  // FIELD-01 (comp-01-composants.md §11.5) : nouveau rouge d'erreur pour toute l'app
  danger: { fg: '#C42B1C', bg: '#FCEDEB', fgDark: '#F97066', bgDark: '#3A1411' },
  info: { fg: '#1E6A95', bg: '#EDF6FC', fgDark: '#7ABFE5', bgDark: '#0E2231' },
} as const;

const { prune, framboise, bleu, vert, orange, ardoise, noir, success, warning, danger, info } = palette;

/* ------------------------------------------------------------------ */
/* 2. Couleurs sémantiques (clé = suffixe de --fd-color-*)             */
/*    Tous les noms historiques sont conservés ; les clés marquées      */
/*    « refonte » sont nouvelles (nav en pilules, KPI héro, graphiques).*/
/* ------------------------------------------------------------------ */

export const colors = {
  light: {
    bg: ardoise[100],
    surface: ardoise[0],
    'surface-sunken': ardoise[50],
    'surface-raised': ardoise[0],
    'surface-hover': '#F1F4F8',
    'surface-selected': prune[50],
    'surface-inverse': noir[900],
    border: ardoise[200],
    'border-strong': '#768294' /* A11Y-12 : 3,46:1 sur bg (ardoise-400 = 2,77:1) */,
    'border-selected': prune[600],
    // FIELD-01 (§11.1) : bordure des champs au repos (3,07:1) et au survol (5,6:1)
    'border-field': '#8A94A2',
    'border-field-hover': '#5E6978',
    text: noir[900],
    'text-muted': ardoise[600],
    'text-subtle': '#5F6B78' /* A11Y-11 : 4,83:1 sur bg (ardoise-500 = 4,36:1) */,
    'text-inverse': ardoise[0],
    'text-disabled': ardoise[400],
    primary: prune[600],
    'primary-hover': prune[700],
    'primary-active': prune[800],
    'primary-soft': prune[50],
    'primary-soft-text': prune[700],
    'on-primary': ardoise[0],
    accent: framboise[600],
    'accent-hover': framboise[700],
    'accent-soft': framboise[50],
    'accent-soft-text': framboise[700],
    'on-accent': ardoise[0],
    hotspot: framboise[600],
    // FIELD-01 (§11.4, §11.5) : focus en prune ; fond assombri du bouton primaire et du destructif
    // au focus clavier ; teinte du remplissage automatique et du lien au focus
    focus: prune[600],
    'primary-focus': prune[800],
    'danger-focus': '#9A2216',
    tint: prune[50],
    success: success.fg,
    'success-soft': success.bg,
    warning: warning.fg,
    'warning-soft': warning.bg,
    danger: danger.fg,
    'danger-hover': '#9A2216',
    'danger-soft': danger.bg,
    'on-danger': ardoise[0],
    info: info.fg,
    'info-soft': info.bg,
    overlay: 'rgba(8, 8, 8, 0.48)',
    'canvas-editor': '#E6EBF1',
    skeleton: ardoise[200],
    'chart-1': orange[500],
    'chart-2': framboise[600],
    'chart-3': bleu[500],
    'chart-4': vert[400],
    'chart-5': prune[600],
    // refonte
    // Audit L50 X1 : fond des barres neutre (surface-sunken), plus orangé
    'chart-track': ardoise[50],
    // NAV-02 (retours client 21/11 §11.7.1) : surfaces de navigation et fond du contenu
    'nav-bg': '#F7F7F8',
    'nav-hover': '#F0F1F3',
    'nav-active': '#E9EBEE',
    'content-bg': ardoise[0],
    hero: vert[400],
    'on-hero': noir[900],
    'hero-muted': '#2E3A0A',
    'icon-chip': ardoise[100],
    'trend-up': '#3F5410',
    'trend-up-soft': vert[100],
    'trend-down': framboise[700],
    'trend-down-soft': framboise[50],
  },
  dark: {
    bg: ardoise[950],
    surface: '#15191F',
    'surface-sunken': '#0F1216',
    'surface-raised': '#1C2128',
    'surface-hover': '#222831',
    'surface-selected': '#35101F',
    'surface-inverse': '#F3F5F8',
    border: '#272E37',
    'border-strong': '#6B7787',
    'border-selected': prune[300],
    'border-field': '#5E6978',
    'border-field-hover': '#7A8494',
    text: '#F3F5F8',
    'text-muted': '#A9B3BF',
    'text-subtle': '#8A95A3',
    'text-inverse': noir[900],
    'text-disabled': '#4B5563',
    primary: prune[300],
    'primary-hover': prune[200],
    'primary-active': prune[100],
    'primary-soft': '#35101F',
    'primary-soft-text': prune[200],
    'on-primary': noir[900],
    accent: framboise[400],
    'accent-hover': framboise[300],
    'accent-soft': '#36101D',
    'accent-soft-text': framboise[300],
    'on-accent': noir[900],
    hotspot: framboise[500],
    focus: prune[300],
    'primary-focus': prune[200],
    'danger-focus': '#FBA29A',
    tint: '#2A1A23',
    success: success.fgDark,
    'success-soft': success.bgDark,
    warning: warning.fgDark,
    'warning-soft': warning.bgDark,
    danger: danger.fgDark,
    'danger-hover': '#FBA29A',
    'danger-soft': danger.bgDark,
    'on-danger': noir[900],
    info: info.fgDark,
    'info-soft': info.bgDark,
    overlay: 'rgba(0, 0, 0, 0.64)',
    'canvas-editor': '#0F1216',
    skeleton: '#222831',
    'chart-1': orange[400],
    'chart-2': framboise[400],
    'chart-3': bleu[400],
    'chart-4': vert[400],
    'chart-5': prune[300],
    // refonte
    'chart-track': '#0F1216',
    'nav-bg': '#101317',
    'nav-hover': '#1A1F26',
    'nav-active': '#252B33',
    'content-bg': '#15191F',
    hero: vert[400],
    'on-hero': noir[900],
    'hero-muted': '#2E3A0A',
    'icon-chip': '#222831',
    'trend-up': vert[300],
    'trend-up-soft': '#1C2409',
    'trend-down': framboise[300],
    'trend-down-soft': '#36101D',
  },
} as const;

export type ColorToken = keyof typeof colors.light;

/* ------------------------------------------------------------------ */
/* 3. Typographie                                                      */
/* ------------------------------------------------------------------ */

export const fontFamily = {
  display: '"Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  sans: '"Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
} as const;

export const googleFontsUrl =
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400..800&family=JetBrains+Mono:wght@400;500&display=swap';

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;

/** taille / interligne / famille / graisse / interlettrage */
export const textStyles = {
  display: { size: '2.5rem', line: '1.1', family: 'display', weight: '800', tracking: '-0.025em' },
  h1: { size: '2rem', line: '1.15', family: 'display', weight: '800', tracking: '-0.02em' },
  h2: { size: '1.25rem', line: '1.3', family: 'display', weight: '700', tracking: '-0.01em' },
  h3: { size: '1rem', line: '1.35', family: 'sans', weight: '700', tracking: '0' },
  'body-lg': { size: '1rem', line: '1.55', family: 'sans', weight: '400', tracking: '0' },
  body: { size: '0.875rem', line: '1.5', family: 'sans', weight: '400', tracking: '0' },
  label: { size: '0.8125rem', line: '1.3', family: 'sans', weight: '600', tracking: '0' },
  caption: { size: '0.75rem', line: '1.35', family: 'sans', weight: '500', tracking: '0.005em' },
  mono: { size: '0.8125rem', line: '1.5', family: 'mono', weight: '400', tracking: '0' },
  // refonte : gros chiffres des cartes KPI
  kpi: { size: '2.5rem', line: '1', family: 'display', weight: '800', tracking: '-0.03em' },
} as const;

/* ------------------------------------------------------------------ */
/* 4. Espacements, rayons, ombres, bordures                            */
/* ------------------------------------------------------------------ */

/** clé = multiple de 4 px (space-6 = 24 px). `0-5` = 2 px. */
export const space = {
  '0': '0',
  '0-5': '0.125rem',
  '1': '0.25rem',
  '2': '0.5rem',
  '3': '0.75rem',
  '4': '1rem',
  '5': '1.25rem',
  '6': '1.5rem',
  '8': '2rem',
  '10': '2.5rem',
  '12': '3rem',
  '16': '4rem',
  '20': '5rem',
} as const;

/**
 * L45 (composants §15.4 bis) : écart selon la relation entre deux blocs voisins (loi de proximité).
 * Valeurs des pages, cartes et modales ; la classe `.fd-dense` (panneau de l'éditeur, tiroirs) applique
 * les valeurs compactes (`gapDense`).
 */
export const gap = {
  label: '6px',
  help: '6px',
  option: '8px',
  action: '12px',
  field: '20px',
  group: '24px',
  title: '16px',
  section: '24px',
} as const;
export const gapDense = {
  help: '4px',
  field: '16px',
  group: '20px',
  title: '12px',
  section: '16px',
} as const;

export const radius = {
  none: '0',
  xs: '6px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '32px',
  full: '9999px',
  // RADIUS-01 : un rayon par famille. Le code n'utilise que ces alias (garde e2e rayons-regles).
  /** Contrôles de 36 à 48 px : boutons, champs, listes, conteneur d'un segmenté, composeur. */
  control: '10px',
  /** Petits contrôles de 24 à 34 px : boutons sm et à icône, options d'un segmenté, pastilles de filtre. */
  'control-sm': '8px',
  /** Marques non interactives : badges de statut, étiquettes, compteurs. */
  tag: '6px',
  /** Détails : kbd, code en ligne, case à cocher. */
  detail: '4px',
  /** Surfaces : cartes, menus, popovers, toasts, encadrés. */
  surface: '12px',
  /** Surfaces superposées : fenêtres, tiroirs, feuilles (coins libres). */
  overlay: '16px',
  /** Ronds : avatars, interrupteurs, points d'état, barres de progression. */
  round: '9999px',
} as const;

export const shadow = {
  // Ombres très douces et neutres (jamais colorées, §15.6) : les cartes n'ont pas de bordure dure.
  light: {
    xs: '0 1px 2px rgba(16, 24, 40, 0.05)',
    sm: '0 1px 2px rgba(16, 24, 40, 0.04), 0 4px 12px rgba(16, 24, 40, 0.04)',
    md: '0 2px 4px rgba(16, 24, 40, 0.04), 0 12px 32px rgba(16, 24, 40, 0.07)',
    lg: '0 4px 8px rgba(16, 24, 40, 0.05), 0 24px 56px rgba(16, 24, 40, 0.14)',
  },
  dark: {
    xs: '0 1px 2px rgba(0, 0, 0, 0.40)',
    sm: '0 1px 2px rgba(0, 0, 0, 0.40), 0 4px 12px rgba(0, 0, 0, 0.30)',
    md: '0 2px 4px rgba(0, 0, 0, 0.40), 0 12px 32px rgba(0, 0, 0, 0.45)',
    lg: '0 4px 8px rgba(0, 0, 0, 0.45), 0 24px 56px rgba(0, 0, 0, 0.60)',
  },
} as const;

export const borderWidth = { default: '1px', strong: '2px' } as const;

/* ------------------------------------------------------------------ */
/* 5. Mouvement, z-index, layout, breakpoints                          */
/* ------------------------------------------------------------------ */

export const motion = {
  'duration-fast': '120ms',
  'duration-base': '200ms',
  /** Sortie d'une fenêtre (MOTION-01 §3) */
  'duration-exit': '160ms',
  /** Sortie d'un tiroir (MOTION-01 §3) */
  'duration-exit-slow': '240ms',
  'duration-slow': '320ms',
  'duration-pulse': '1800ms',
  /** Rotation d'un indicateur de chargement (MOTION-01 §6) */
  'duration-spin': '800ms',
  /** Boucle d'attente : barre indéterminée, clignotement, reflet (MOTION-01 §6) */
  'duration-loop': '1200ms',
  'ease-standard': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  'ease-emphasized': 'cubic-bezier(0.3, 0, 0, 1.3)',
  'ease-exit': 'cubic-bezier(0.4, 0, 1, 1)',
} as const;

export const zIndex = {
  base: '0',
  raised: '10',
  sticky: '100',
  dropdown: '1000',
  overlay: '1100',
  modal: '1200',
  popover: '1300',
  toast: '1400',
  tooltip: '1500',
} as const;

export const layout = {
  'sidebar-width': '256px',
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
  primary: prune[600],
  'on-primary': ardoise[0],
  hotspot: framboise[600],
  'tooltip-bg': ardoise[0],
  'tooltip-text': noir[900],
  'tooltip-muted': ardoise[600],
  overlay: 'rgba(8, 8, 8, 0.55)',
  radius: '20px',
  font: fontFamily.sans,
  // Fond uni : pas de dégradé décoratif (motif proscrit, composants.md §15.6).
  backdrop: ardoise[100],
  'browser-bar': ardoise[200],
  'browser-bar-dark': '#1C2128',
  shadow: shadow.light.lg,
} as const;

/** Clés que l'utilisateur peut surcharger dans un thème de démo (stockées en JSONB). */
export const playerThemeKeys = [
  'primary',
  'hotspot',
  'tooltip-bg',
  'overlay',
  'radius',
  'font',
  'backdrop',
] as const;
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
// conversion). Pour la couleur framboise, utiliser `--fd-color-accent`.

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
  // Refonte DSI (17 nov.) : les anciennes palettes Lagoon / Ember / Stone sont abandonnées.
  // Leurs variables restent définies pour ne rien casser et pointent vers la palette DSI
  // la plus proche (lagoon → prune, ember → framboise, stone → ardoise).
  ...Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].flatMap((n) => [
      [`--fd-lagoon-${n}`, `var(--fd-prune-${n})`],
      [`--fd-ember-${n}`, `var(--fd-framboise-${n})`],
      [`--fd-stone-${n}`, `var(--fd-ardoise-${n})`],
    ]),
  ),
  '--fd-stone-0': 'var(--fd-ardoise-0)',
} as const;
// Valeurs qui changent volontairement (même nom, nouvelle échelle) :
//   --fd-space-5 : 24px → 20px · --fd-space-6 : 32px → 24px (échelle en multiples de 4 px)
//   --fd-radius-* : rayons agrandis à la refonte DSI (md 12px, lg 16px, 2xl 24px pour les cartes)

/* ------------------------------------------------------------------ */
/* 7 bis. Pastilles de type de contenu (retours client du 24/11 §5)    */
/* ------------------------------------------------------------------ */

/**
 * Couleurs des pastilles de type sur les cartes Démos : fond, texte et icône, bordure. Jetons à part
 * (`--fd-type-*`) : les couleurs sémantiques restent réservées aux statuts, même si les teintes de base
 * sont proches. Contrastes texte sur fond : 5,3:1 au moins en clair, 6,6:1 au moins en sombre.
 */
export const type = {
  light: {
    'captures-bg': '#fbf0f5',
    'captures-fg': '#85164b',
    'captures-border': '#f3d3e2',
    'video-bg': '#edf6fc',
    'video-fg': '#1e6a95',
    'video-border': '#d3eaf7',
    'html-bg': '#f5f9e8',
    'html-fg': '#557014',
    'html-border': '#e6f0c7',
    'sandbox-bg': '#fff6e8',
    'sandbox-fg': '#8f5300',
    'sandbox-border': '#fde9cc',
  },
  dark: {
    'captures-bg': '#2a0c1a',
    'captures-fg': '#cf86a9',
    'captures-border': '#480f2a',
    'video-bg': '#0e2231',
    'video-fg': '#7abfe5',
    'video-border': '#195475',
    'html-bg': '#1c2409',
    'html-fg': '#aed054',
    'html-border': '#435812',
    'sandbox-bg': '#2b1a03',
    'sandbox-fg': '#f8bb61',
    'sandbox-border': '#855104',
  },
} as const;

/* ------------------------------------------------------------------ */
/* 8. Helpers                                                          */
/* ------------------------------------------------------------------ */

/** `cssVar('color', 'primary')` → `var(--fd-color-primary)` */
export const cssVar = (group: string, name: string): string => `var(--fd-${group}-${name})`;

export const tokens = {
  palette,
  colors,
  type,
  fontFamily,
  fontWeight,
  textStyles,
  space,
  gap,
  gapDense,
  radius,
  shadow,
  borderWidth,
  motion,
  zIndex,
  layout,
  breakpoints,
  player,
  aliases,
  legacyAliases,
  googleFontsUrl,
} as const;

export type Tokens = typeof tokens;

export default tokens;
