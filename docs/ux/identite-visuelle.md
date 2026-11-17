# FlowDSIML : identité visuelle

> Livrable 1 de la phase 2, design. Il définit l'identité de l'**application** (dashboard, éditeur), le **thème par défaut du player** et les règles de déclinaison.
> L'identité est originale : elle ne reprend ni la palette, ni le logo, ni la typographie de Guideflow ou d'un concurrent.
> Les valeurs font foi dans `packages/ui/src/tokens.ts`. `tokens.css` en est la traduction.

---

## 1. Intention

**FlowDSIML trace le chemin à travers un produit.** L'identité s'appuie sur deux idées :

1. **Le sentier**. Une démo est un parcours d'étapes reliées. Le logo, les connecteurs du rail d'étapes et les barres de progression reprennent ce motif : des points reliés par une courbe.
2. **Le signal**. Le hotspot est le seul élément qui doit attirer l'œil. Une couleur chaude (*Ember*) lui est réservée, ainsi qu'aux actions de conversion. Le reste de l'interface reste calme : neutres chauds et vert lagon.

Ton visuel : professionnel, chaleureux, net. Aplats, bordures fines, aucun ornement gratuit : pas de dégradés décoratifs, d'effets néon, de verre dépoli, d'emojis ni de barres d'accent (liste complète : `composants.md` §15.6). Beaucoup d'espace et une hiérarchie typographique forte.

## 2. Logo

![Logo FlowDSIML](assets/logo.svg)

- **Symbole** : carré arrondi (rayon 8/32) *Lagoon 600*, trois étapes blanches reliées par un sentier, la dernière en *Ember 400* (le hotspot).
- **Logotype** : « Flow » en *Bricolage Grotesque* 700, « DSIML » en 500. Le nom reste provisoire (décision D2).
- **Zone de protection** : ¼ de la hauteur du symbole. **Taille minimale** : 16 px pour le symbole, 80 px de large pour le logotype.
- **Interdits** : déformer le logo, changer les couleurs du hotspot, poser le symbole sur un fond lagon sans contour.
- **Filigrane du player** (plan Free) : symbole de 14 px et texte « Fait avec FlowDSIML » (anglais : « Made with FlowDSIML »), en bas à droite, opacité 0,9.

## 3. Couleurs

### 3.1 Palettes de base

| Échelle | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Lagoon** (marque) | `#EEFBF8` | `#D3F4EC` | `#A8E8DA` | `#70D4C2` | `#38B8A5` | `#16998A` | `#0E7C71` | `#0D635B` | `#0F4F4A` | `#0F413D` | `#052624` |
| **Ember** (signal) | `#FFF4EF` | `#FFE5D9` | `#FFC7AE` | `#FFA07A` | `#FF7447` | `#E8541F` | `#C93A0E` | `#A8300C` | `#872912` | `#6E2413` | `#3D0F06` |
| **Stone** (neutres chauds) | `#F7F6F4` | `#EFEDEA` | `#E2DFDA` | `#CBC6BF` | `#8C857B` | `#77716A` | `#5F5A52` | `#48443E` | `#302D29` | `#1F1D1A` | `#141311` |

Couleurs d'état. La valeur **texte** est la couleur foncée qui passe l'AA. Le **fond** est la teinte claire utilisée pour les badges et les alertes.

| État | Texte et icône (clair) | Fond (clair) | Texte et icône (sombre) | Fond (sombre) |
|---|---|---|---|---|
| Succès | `#15803D` | `#ECFDF3` | `#4ADE80` | `#0F2A1B` |
| Attention | `#B45309` | `#FFF7E6` | `#FBBF24` | `#2E2208` |
| Danger | `#C9302C` | `#FEF1F1` | `#F87171` | `#331312` |
| Info | `#2563EB` | `#EFF5FF` | `#60A5FA` | `#0F1E38` |

### 3.2 Rôles sémantiques (app)

| Rôle | Clair | Sombre | Usage |
|---|---|---|---|
| `bg` (canvas) | Stone 50 `#F7F6F4` | `#141311` | Fond de l'app, derrière les cartes |
| `surface` | `#FFFFFF` | `#1C1A18` | Cartes, panneaux, modales |
| `surface-sunken` | Stone 100 | `#100F0E` | Zones de travail : canevas de l'éditeur, champs désactivés |
| `surface-raised` | `#FFFFFF` + ombre | `#24221F` | Menus, popovers |
| `border` | Stone 200 | `#34312D` | Séparateurs décoratifs |
| `border-strong` | Stone 400 `#8C857B` | `#7A746B` | Contour des champs et des contrôles (≥ 3:1) |
| `text` | Stone 900 | `#F2F0EC` | Texte principal |
| `text-muted` | Stone 600 | `#B3ADA4` | Texte secondaire |
| `text-subtle` | Stone 500 `#77716A` | `#8F897F` | Méta-infos, placeholders (≥ 4,5:1) |
| `primary` | Lagoon 600 | Lagoon 400 | Action principale, liens, sélection |
| `on-primary` | `#FFFFFF` | Lagoon 950 | Texte sur `primary` |
| `accent` | Ember 600 | Ember 400 | Conversion (CTA « Publier », « Passer au plan supérieur »), hotspot |
| `focus` | Lagoon 500 | Lagoon 400 | Anneau de focus |

**Règle d'usage** : *Lagoon* sert à **naviguer et agir**, *Ember* à **attirer et convertir**. Un écran ne doit avoir qu'un seul bouton *accent* visible.

### 3.3 Contrastes vérifiés (WCAG 2.1)

| Paire | Ratio | Niveau |
|---|---|---|
| Texte `#1F1D1A` / blanc | 16,8:1 | AAA |
| Texte secondaire `#5F5A52` / blanc | 6,8:1 | AA |
| Texte discret `#77716A` / blanc | 4,8:1 | AA |
| Blanc / primary `#0E7C71` | 5,1:1 | AA |
| Blanc / accent `#C93A0E` | 5,1:1 | AA |
| Contour de champ `#8C857B` / blanc | 3,7:1 | AA (composant d'interface ≥ 3:1) |
| Sombre : texte `#F2F0EC` / `#141311` | 16,3:1 | AAA |
| Sombre : texte discret `#8F897F` / `#1C1A18` | 5,0:1 | AA |
| Sombre : Lagoon 950 / primary `#38B8A5` | 6,5:1 | AA |
| Hotspot Ember 500 `#E8541F` / blanc | 3,8:1 | ≥ 3:1 (objet graphique) |

Le script de vérification est décrit dans `docs/ux/composants.md`, § Accessibilité.

## 4. Typographie

Trois familles **Google Fonts**, toutes sous licence **SIL OFL**.

| Rôle | Famille | Graisses | Usage |
|---|---|---|---|
| Display | **Bricolage Grotesque** | 600, 700 | Titres H1-H3, chiffres clés des analytics, logotype |
| Texte et UI | **Instrument Sans** | 400, 500, 600 | Tout le reste : corps, libellés, boutons, tableaux |
| Mono | **JetBrains Mono** | 400, 500 | Code d'embed, URL, variables `{{first_name}}` |

Chargement : `https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..700&family=Instrument+Sans:wght@400..600&family=JetBrains+Mono:wght@400;500&display=swap`.
Polices de secours : `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`. Le **player** utilise par défaut *Instrument Sans*, remplaçable par la police du workspace.

### Échelle typographique (rem, base 16 px)

| Token | Taille / interligne | Famille, graisse | Usage |
|---|---|---|---|
| `display` | 2,25 rem / 1,1 | Bricolage 700 | Titre d'onboarding, chiffres clés |
| `h1` | 1,75 rem / 1,2 | Bricolage 700 | Titre de page |
| `h2` | 1,375 rem / 1,25 | Bricolage 600 | Titre de section, titre de modale |
| `h3` | 1,125 rem / 1,3 | Instrument 600 | Titre de carte, de panneau |
| `body-lg` | 1 rem / 1,5 | Instrument 400 | Texte courant du player, descriptions |
| `body` | 0,875 rem / 1,45 | Instrument 400 | **Taille par défaut de l'app** |
| `label` | 0,8125 rem / 1,3 | Instrument 500 | Libellés de champs, onglets, boutons sm |
| `caption` | 0,75 rem / 1,35 | Instrument 500 | Méta-infos, badges, aide |
| `mono` | 0,8125 rem / 1,5 | JetBrains 400 | Code |

Chiffres tabulaires (`font-variant-numeric: tabular-nums`) dans les tableaux et les KPI.

## 5. Espacements, grille, rayons, ombres

- **Espacements** : base 4 px. Échelle `0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80` (tokens `space-0` à `space-20`, nommés en unités de 4 px).
- **Grille de l'app** : barre latérale de 240 px (64 px repliée), contenu fluide avec un maximum de 1 200 px pour les pages de liste. L'éditeur est en **plein écran** : rail de 248 px, canevas fluide, panneau de propriétés de 320 px.
- **Points de rupture** : `sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`. L'éditeur exige au moins `lg`. En dessous, un écran invite à ouvrir l'éditeur sur ordinateur, alors que le player et le dashboard sont responsives.
- **Rayons** : `xs 4` (badges), `sm 6` (champs, boutons sm), `md 8` (boutons, champs), `lg 12` (cartes, menus), `xl 16` (modales, tooltips du player), `2xl 24` (bulles d'onboarding), `full` (pastilles, hotspots, avatars).
- **Ombres** : teintées de brun chaud (`rgba(31,29,26,…)`), jamais noir pur.
  - `xs` : séparation subtile (boutons secondaires)
  - `sm` : cartes
  - `md` : menus, popovers
  - `lg` : modales, tooltip du player
  - `focus` : anneau de focus de 3 px *Lagoon 500* à 45 %, plus 1 px blanc
- **Bordures** : 1 px par défaut, 2 px pour une sélection (étape active, élément sélectionné sur le canevas).

## 6. Mouvement

| Token | Valeur | Usage |
|---|---|---|
| `duration-fast` | 120 ms | Survol, pression |
| `duration-base` | 200 ms | Ouverture d'un menu, d'un onglet ou d'un tooltip |
| `duration-slow` | 320 ms | Modale, transition d'étape du player |
| `ease-standard` | `cubic-bezier(.2,.8,.2,1)` | Défaut |
| `ease-emphasized` | `cubic-bezier(.3,0,0,1.3)` | Apparition du hotspot (léger rebond) |
| Pulsation du hotspot | 1,8 s, infinie | Anneau qui s'étend de 1× à 2,4×, opacité de 0,55 à 0 |

`prefers-reduced-motion: reduce` : transitions de 0 ms, pulsation **remplacée par un anneau statique** (le hotspot reste repérable).

## 7. Iconographie et illustration

- **Icônes** : [Lucide](https://lucide.dev) (licence ISC). Trait de 1,75 px, tailles de 16, 20 et 24 px, couleur `currentColor`. Pas d'icônes pleines, sauf pour l'état actif d'une navigation.
- **Illustrations d'états vides** : compositions géométriques simples (sentier, points, cadres de fenêtre) en Lagoon 100-300 et Stone 200, avec une touche Ember. Pas de personnages.
- **Captures dans le dashboard** : vignettes 16:10, rayon `md`, bordure `border`.

## 8. Mode sombre

- Disponible pour l'**application** (dashboard, éditeur, paramètres). Choix dans le profil : Système (par défaut), Clair, Sombre. Il est appliqué par `data-theme="dark"` sur `<html>`.
- Principe : élévation par la **luminosité de la surface** (canvas, surface, raised), pas par l'ombre. Les ombres sont plus denses mais peu visibles.
- Le **canevas de l'éditeur** reste neutre en mode sombre, pour ne pas fausser la perception des captures : fond `#100F0E` et fine bordure.
- Le **player** n'hérite pas du mode sombre de l'app. Il suit le thème de la démo, dont le cadre navigateur a sa propre option clair ou sombre.

## 9. Thème du player (personnalisable)

Le player expose des tokens `--fd-player-*`, surchargés par le thème de démo du workspace (table `themes.tokens`). Valeurs par défaut :

| Token | Défaut | Personnalisable |
|---|---|---|
| `player-primary` | Lagoon 600 | oui (couleur principale) |
| `player-on-primary` | `#FFFFFF` | calculé automatiquement (noir ou blanc selon le contraste) |
| `player-hotspot` | Ember 500 | oui |
| `player-tooltip-bg` | `#FFFFFF` | oui |
| `player-tooltip-text` | Stone 900 | calculé |
| `player-overlay` | `rgba(20,19,17,.55)` | couleur et opacité |
| `player-radius` | 16 px | 0, 8, 16 ou 24 (« Carré », « Doux », « Rond », « Très rond ») |
| `player-font` | Instrument Sans | police du workspace |
| `player-backdrop` | Stone 50 `#F7F6F4` (aplat) | couleur unie ou image |

**Règle produit** : quand l'utilisateur choisit une couleur principale de contraste insuffisant (moins de 4,5:1 avec le texte du bouton), l'éditeur l'avertit (« Contraste faible : le texte sera difficile à lire ») et propose la variante accessible la plus proche.
