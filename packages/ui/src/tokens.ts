/**
 * DESIGN TOKENS PROVISOIRES — propriété de la Lead UX, qui les remplacera.
 * Garder les mêmes noms de variables CSS (--fd-*) pour que le remplacement soit transparent.
 */
export const tokens = {
  color: {
    primary: '#5b4cf0',
    primaryHover: '#4a3bd9',
    primaryContrast: '#ffffff',
    bg: '#f7f7fb',
    surface: '#ffffff',
    surfaceMuted: '#f0f0f6',
    border: '#e2e2ec',
    text: '#1b1b24',
    textMuted: '#5d5d70',
    danger: '#d93f4c',
    success: '#1f9d63',
    warning: '#c98a00',
  },
  radius: { sm: '6px', md: '10px', lg: '16px', full: '999px' },
  space: { 1: '4px', 2: '8px', 3: '12px', 4: '16px', 5: '24px', 6: '32px', 7: '48px' },
  font: {
    family: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    size: { xs: '12px', sm: '14px', md: '16px', lg: '20px', xl: '28px' },
  },
  shadow: { sm: '0 1px 2px rgb(16 16 40 / 6%)', md: '0 6px 24px rgb(16 16 40 / 10%)' },
} as const;
export type Tokens = typeof tokens;
