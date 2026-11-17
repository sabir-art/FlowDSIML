# Design tokens : guide d'intégration

| Fichier | Rôle |
|---|---|
| `packages/ui/src/tokens.ts` | **Source unique** des tokens (objets typés), importable en TS. |
| `packages/ui/src/tokens.css` | Version CSS, **générée** à partir de `tokens.ts`. Ne pas l'éditer à la main. |
| `packages/ui/src/tokens.build.mjs` | Générateur. Lancer `node packages/ui/src/tokens.build.mjs`. L'option `--check` fait échouer la commande si `tokens.css` n'est pas à jour (à mettre en CI). |

## Utilisation

```html
<!-- index.html -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..700&family=Instrument+Sans:wght@400..600&family=JetBrains+Mono:wght@400;500&display=swap">
<html data-theme="system"> <!-- "light" | "dark" | "system" -->
```

```ts
import '@flowdsiml/ui/src/tokens.css';
import { colors, cssVar } from '@flowdsiml/ui/src/tokens';
style={{ color: cssVar('color', 'text-muted') }}
```

**Règle** : le code applicatif n'utilise que les tokens **sémantiques** (`--fd-color-*`, `--fd-space-*`…). Les variables de palette (`--fd-lagoon-600`) servent à construire les thèmes, pas à styler l'app.

## Familles de variables

| Préfixe | Exemple | Source TS |
|---|---|---|
| `--fd-color-*` | `--fd-color-primary`, `--fd-color-surface-sunken` | `colors.light` / `colors.dark` |
| `--fd-shadow-*` | `--fd-shadow-md`, `--fd-shadow-focus` | `shadow.light` / `shadow.dark` |
| `--fd-font-*` | `--fd-font-display`, `--fd-font-sans`, `--fd-font-mono` | `fontFamily` |
| `--fd-text-<style>-{size,line,family,weight,tracking}` | `--fd-text-h1-size` | `textStyles` |
| `--fd-space-*` | `--fd-space-4` = 16 px (clé = multiple de 4 px) | `space` |
| `--fd-radius-*` | `--fd-radius-lg` = 12 px | `radius` |
| `--fd-motion-*` | `--fd-motion-duration-base`, `--fd-motion-ease-standard` | `motion` |
| `--fd-z-*` | `--fd-z-modal` | `zIndex` |
| `--fd-layout-*` | `--fd-layout-editor-panel-width` | `layout` |
| `--fd-player-*` | `--fd-player-hotspot` (thème du player, surchargé par `themes.tokens`) | `player` |
| `--fd-<palette>-<pas>` | `--fd-lagoon-600`, `--fd-ember-500`, `--fd-stone-200` | `palette` |

## Correspondance avec shadcn/ui et Tailwind

`tokens.css` déclare les variables attendues par shadcn/ui en **alias** des tokens FlowDSIML : `--background`, `--foreground`, `--card`, `--popover`, `--primary(-foreground)`, `--secondary`, `--muted(-foreground)`, `--accent(-foreground)`, `--destructive(-foreground)`, `--border`, `--input`, `--ring`, `--radius`, `--sidebar-*`, `--chart-1..5`. Leurs valeurs sont des `var(--fd-…)`. Les composants shadcn suivent donc automatiquement le mode sombre.

⚠️ Dans shadcn, `--accent` désigne le **fond de survol**. La couleur de conversion Ember s'appelle `--fd-color-accent`.

**Fichier provisoire du dev** : il n'existait pas sur la branche d'intégration au moment de la création de ces tokens. Si des noms différents étaient déjà utilisés, il suffit d'ajouter des alias dans l'objet `aliases` de `tokens.ts`. Aucune variable `--fd-*` n'a besoin d'être renommée.

### Tailwind v4 (`@theme`)

```css
@import "tailwindcss";
@import "@flowdsiml/ui/src/tokens.css";
@theme inline {
  --color-background: var(--fd-color-bg);
  --color-surface: var(--fd-color-surface);
  --color-foreground: var(--fd-color-text);
  --color-muted-foreground: var(--fd-color-text-muted);
  --color-primary: var(--fd-color-primary);
  --color-primary-foreground: var(--fd-color-on-primary);
  --color-accent-brand: var(--fd-color-accent);
  --color-border: var(--fd-color-border);
  --color-input: var(--fd-color-border-strong);
  --color-ring: var(--fd-color-focus);
  --color-danger: var(--fd-color-danger);
  --font-sans: var(--fd-font-sans);
  --font-display: var(--fd-font-display);
  --font-mono: var(--fd-font-mono);
  --radius-sm: var(--fd-radius-sm);
  --radius-md: var(--fd-radius-md);
  --radius-lg: var(--fd-radius-lg);
  --radius-xl: var(--fd-radius-xl);
}
```

### Tailwind v3 (`tailwind.config`)

```js
theme: { extend: {
  colors: { background: 'var(--background)', foreground: 'var(--foreground)',
    primary: { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)' },
    brand: { accent: 'var(--fd-color-accent)', hotspot: 'var(--fd-color-hotspot)' },
    border: 'var(--border)', input: 'var(--input)', ring: 'var(--ring)' },
  fontFamily: { sans: 'var(--fd-font-sans)', display: 'var(--fd-font-display)', mono: 'var(--fd-font-mono)' },
  borderRadius: { sm: 'var(--fd-radius-sm)', md: 'var(--fd-radius-md)', lg: 'var(--fd-radius-lg)', xl: 'var(--fd-radius-xl)' },
}}
```

## Player

Le conteneur du player (et chaque aperçu du player dans l'éditeur) porte la classe `fd-player-scope`, qui force les couleurs claires, et reçoit les surcharges du thème de démo en style inline :

```html
<div class="fd-player-scope" style="--fd-player-primary:#1D4ED8; --fd-player-radius:8px">…</div>
```
