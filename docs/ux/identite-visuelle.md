# FlowDSIML : identité visuelle (refonte DSI des Missions Locales)

> Version du 17 nov. 2026. Elle remplace l'identité Lagoon / Ember / Stone, **abandonnée** à la demande du client.
> Charte source : `docs/ux/brand-dsi/` (logos officiels et couleurs extraites du Figma client).
> Tokens : `packages/ui/src/tokens.ts`, générés en `tokens.css` avec `node packages/ui/src/tokens.build.mjs`.
> Maquettes de référence : `docs/ux/maquettes/refonte/` (dashboard, analytics, éditeur, en clair et en sombre).
> Spec pour le développement : `docs/ux/refonte.md`.

## 1. Intention

FlowDSIML est l'outil de démos interactives de la **DSI des Missions Locales**. L'interface doit :
- reprendre sans ambiguïté la charte institutionnelle : prune, framboise, bleu, vert, orange ;
- avoir l'allure d'un tableau de bord moderne : fond gris-bleuté clair, grandes cartes blanches très arrondies, navigation en pilules, gros chiffres, beaucoup d'air ;
- rester sobre et accessible (WCAG 2.1 AA). Les couleurs vives servent à **signaler** (KPI héro, graphiques, hotspot), jamais à décorer.

## 2. Logo

| Fichier | Usage |
|---|---|
| `assets/logo-app.svg` | Logo de l'application sur fond clair : symbole DSI + « FlowDSIML » + mention « DSI des Missions Locales » |
| `assets/logo-app-sombre.svg` | Même logo sur fond sombre (texte clair) |
| `assets/symbole-dsi.svg` | Symbole « circuit » seul, nettoyé des fonds de l'export Figma : favicon, avatar, barre de l'éditeur, extension |
| `brand-dsi/logo-dsi-horizontal.svg` | Logo officiel complet de la DSI (pages institutionnelles, mentions) |
| `brand-dsi/logo-dsi-blanc.svg` | Logo officiel blanc, sur fond prune uniquement |

Règles :
- **Composition de l'app** : symbole de 36 × 40 px, gap de 12 px, « FlowDSIML » en Plus Jakarta Sans 800 (18 px, interlettrage −0,02 em), mention « DSI des Missions Locales » en dessous (11 px, 600, `text-subtle`).
- Dans l'interface, composer le logo **en HTML** (image du symbole + texte), pour que le texte utilise la vraie police. Les fichiers `logo-app*.svg` servent hors de l'app (documents, e-mails) : leur texte retombe sur une police système si Plus Jakarta Sans n'est pas installée.
- Zone de protection : la hauteur d'un rond du symbole tout autour. Taille minimale du symbole : 20 px de haut.
- Interdits :
  - recolorer le symbole (ses 4 couleurs sont celles de la charte) ;
  - le poser sur un fond prune, framboise ou vert, où les traits se perdent ;
  - l'étirer, lui ajouter une ombre ou un contour.
- Favicon : `symbole-dsi.svg`.

## 3. Couleurs

### 3.1 Couleurs de la charte

| Nom | Hex | Rôle dans l'app |
|---|---|---|
| **Prune** | `#A3195B` | Couleur institutionnelle : action primaire (boutons pleins, liens, sélection), avatar |
| **Framboise** | `#D60B52` | Signal : hotspot du player, erreurs et suppression, baisse dans les tendances |
| **Bleu** | `#2897D5` | Anneau de focus, informations, série de graphique |
| **Vert** | `#95C11F` | Carte KPI « héro » (**texte noir uniquement**), hausse dans les tendances, série de graphique |
| **Orange** | `#F39200` | Barres des graphiques et surfaces. **Jamais pour du texte** |
| **Noir** | `#080808` | Texte principal, pilule de navigation active, segment actif |

Chaque couleur est déclinée en échelle de 50 à 950 (`--fd-prune-50` … `--fd-orange-950`), avec la teinte officielle à sa place (prune et framboise en 600, bleu et orange en 500, vert en 400). Les neutres sont une échelle **ardoise** froide (`--fd-ardoise-0` … `950`) accordée au fond `#EEF2F6`.

Les anciennes variables `--fd-lagoon-*`, `--fd-ember-*` et `--fd-stone-*` restent définies comme alias vers prune, framboise et ardoise pour ne rien casser. Ne plus les utiliser dans du nouveau code.

### 3.2 Rôles sémantiques (extraits)

| Token `--fd-color-*` | Clair | Sombre |
|---|---|---|
| `bg` | ardoise 100 `#EEF2F6` | ardoise 950 `#0B0D10` |
| `surface` (cartes) | blanc | `#15191F` |
| `text` / `text-muted` | noir `#080808` / ardoise 600 | `#F3F5F8` / `#A9B3BF` |
| `primary` / `on-primary` | prune 600 / blanc | prune 300 / noir |
| `accent`, `hotspot` | framboise 600 | framboise 400 / 500 |
| `nav-active` / `on-nav-active` | noir / blanc | `#F3F5F8` / noir |
| `hero` / `on-hero` | vert 400 / noir | vert 400 / noir |
| `icon-chip` (rond derrière les icônes de titre) | ardoise 100 | `#222831` |
| `trend-up` / `trend-up-soft` | `#3F5410` / vert 100 | vert 300 / `#1C2409` |
| `trend-down` / `trend-down-soft` | framboise 700 / framboise 50 | framboise 300 / `#36101D` |
| `chart-1` … `chart-5` | orange, framboise, bleu, vert, prune | mêmes teintes, plus claires |
| `chart-track` (fond des barres) | orange 100 | `#33270F` |
| `focus` | bleu 500 | bleu 400 |

### 3.3 Contrastes vérifiés (WCAG 2.1, calcul automatique sur les tokens)

| Paire | Ratio | Seuil |
|---|---|---|
| Blanc sur prune (bouton primaire) | 7,38:1 | AA ✅ |
| Prune sur blanc (lien) | 7,38:1 | AA ✅ |
| Prune sur fond `#EEF2F6` | 6,56:1 | AA ✅ |
| Blanc sur framboise | 5,21:1 | AA ✅ |
| Noir sur vert (KPI héro) | 9,47:1 | AA ✅ |
| Blanc sur noir (navigation active) | 20:1 | AAA ✅ |
| Noir sur orange | 8,51:1 | AA ✅ (surfaces orange avec texte noir) |
| ~~Blanc sur vert~~ | 2,12:1 | ❌ interdit |
| ~~Blanc sur orange, orange sur blanc~~ | 2,35:1 | ❌ interdit pour du texte |
| ~~Blanc sur bleu~~ | 3,24:1 | ❌ texte normal ; ✅ anneau de focus (≥ 3:1) |

Les 27 paires sémantiques testées passent en sombre. En clair, une seule exception est assumée : les barres orange (`chart-1`) ont un contraste de 2,35:1 sur blanc. Comme l'information ne doit pas reposer sur la couleur seule, la **valeur est toujours écrite en texte** (étiquette au-dessus de la barre ou colonne de chiffres), et le pic est distingué par une barre noire.

## 4. Typographie

- **Plus Jakarta Sans** (Google Fonts, 400 à 800) pour toute l'interface : titres et texte. Géométrique et ronde, conforme à la référence de style.
- **JetBrains Mono** pour le code (iframe, URL, variables `{{…}}`).
- Chargement : `@import` en tête de `packages/ui/src/base.css`.

| Style | Taille | Graisse | Usage |
|---|---|---|---|
| `display` | 40 px | 800 | Écrans d'accueil |
| `h1` | 32 px | 800, −0,02 em | Titre de page (« grand et gras ») |
| `kpi` | 40 px | 800, −0,03 em, chiffres tabulaires | Valeur des cartes KPI |
| `h2` | 20 px | 700 | Titre de section |
| `h3` | 16 px | 700 | Titre de carte (à côté de la puce d'icône) |
| `body` / `body-lg` | 14 / 16 px | 400 | Texte |
| `label` | 13 px | 600 | Libellés, boutons |
| `caption` | 12 px | 500 | Métadonnées, aides |

## 5. Formes, espacements, ombres

- **Rayons** : `xs` 6 · `sm` 8 · `md` 12 (champs) · `lg` 16 (vignettes) · `xl` 20 (bulles, alertes) · `2xl` 24 (**cartes**) · `3xl` 32 · `full` (**boutons, badges, navigation, segmentés**).
- **Cartes** : fond `surface`, sans bordure en clair (bordure 1 px en sombre), ombre `sm` très douce, padding de 24 px, gap de 20 px entre cartes.
- **Ombres** : neutres et diffuses, jamais colorées (motif proscrit §15.6).
- **Espacements** : échelle inchangée, en multiples de 4 px (`composants.md` §15.4). Padding de page porté à 32 px, et beaucoup d'air autour des titres.
- **Hauteurs** : contrôles de 40 px (32 en `sm`, 48 en `lg`), éléments de navigation de 44 px.

## 6. Composants signature

Détail et règles d'usage dans `refonte.md` :
1. **Navigation en pilules** : élément actif en pilule noire pleine, texte et icône blancs ; les autres en texte gris avec icône.
2. **Carte KPI héro** remplie de vert DSI, avec texte noir. Une seule par rangée. Les autres KPI sont blancs.
3. **Puce d'icône** : rond gris clair de 36 px devant le titre de chaque carte.
4. **Badge de tendance** en pilule : vert si hausse, framboise si baisse, avec les icônes `TrendingUp` / `TrendingDown`.
5. **Boutons** : pilules blanches pour les actions secondaires, pilule prune pour l'action principale, rond plein pour les actions iconiques (`+`, flèche).
6. **Graphiques** :
   - barres verticales arrondies orange sur des barres pâles, valeur affichée au-dessus, pic en noir ;
   - donut SVG aux 4 couleurs DSI (framboise, bleu, vert, orange), avec légende et pourcentages.

## 7. Iconographie

Inchangée : uniquement **Lucide** (`lucide-react` / `lucide-preact`), en 16, 18 ou 20 px avec un trait de 1,75 (`composants.md` §15.1). Dans un titre de carte, l'icône est posée dans la puce ronde `icon-chip`. Pas d'emoji ni de glyphe utilisé comme icône.

## 8. Mode sombre

Le sélecteur Clair / Sombre / Système reste disponible, en clair par défaut.
- Fond `#0B0D10` et cartes `#15191F` avec bordure de 1 px, car les ombres ne suffisent plus à séparer les surfaces.
- Navigation active et segment actif en pilule claire avec texte noir.
- Primaire prune 300 avec texte noir.
- La carte héro garde le vert DSI avec texte noir.
- Les captures (canevas de l'éditeur, vignettes, aperçu de partage, player) restent **claires** grâce à `.fd-player-scope`.

## 9. Thème du player (valeurs par défaut)

- Primaire prune `#A3195B` et pastille du hotspot framboise `#D60B52`.
- Bulle blanche avec un rayon de 20 px, police Plus Jakarta Sans.
- Fond du player ardoise 100 `#EEF2F6`, uni (sans dégradé).

Les workspaces peuvent toujours surcharger ces couleurs dans l'onglet Design.

## 10. Motifs proscrits (rappel, `composants.md` §15.6)

Restent interdits :
- emojis (dont 👋), dégradés décoratifs, verre dépoli, ombres colorées, barres d'accent latérales ;
- étincelles et icônes « IA » ;
- texte blanc sur vert ou sur orange ;
- orange pour du texte.

Le donut est dessiné en SVG (`stroke-dasharray`), pas en `conic-gradient`.
