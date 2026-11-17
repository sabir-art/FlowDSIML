# TutoClick : identité visuelle

> Version du 17 nov. 2026. Le produit s'appelle **TutoClick** (graphie exacte : T et C majuscules, avec un k). Il est porté par la **DSI des Missions Locales**.
> Logo : fourni par le client, vectorisé dans `docs/ux/brand-tutoclic/production/`.
> Charte institutionnelle de l'interface : `docs/ux/brand-dsi/` (couleurs DSI).
> Tokens : `packages/ui/src/tokens.ts`, générés en `tokens.css` avec `node packages/ui/src/tokens.build.mjs`.
> Maquettes de référence : `docs/ux/maquettes/refonte/`. Spec de la refonte : `docs/ux/refonte.md`.
> Cette identité remplace « FlowDSIML » (nom de projet) et la piste « Tutoclic » (abandonnée).

## 1. Intention

TutoClick est l'outil de tutoriels et de démos interactives de la DSI des Missions Locales, d'abord pour **former** les équipes à leurs outils. On distingue deux niveaux :
- **La marque**, c'est-à-dire le logo TutoClick. Elle est chaleureuse et reconnaissable : bulle bordeaux en dégradé, curseur blanc, éclat orange, « Tuto » en encre, « Click » en bleu, trait vert.
- **L'interface**, qui suit la charte institutionnelle DSI (prune, framboise, bleu, vert, orange). Elle a l'allure d'un tableau de bord moderne : fond gris-bleuté, grandes cartes blanches très arrondies, navigation en pilules, beaucoup d'air. Elle reste sobre et accessible (WCAG 2.1 AA, RGAA) : les couleurs vives **signalent**, elles ne décorent pas.

## 2. Logo TutoClick

### 2.1 Fichiers (`docs/ux/brand-tutoclic/production/`)

| Fichier | Usage |
|---|---|
| `logo-tutoclick.svg` | **Logo de référence du client**, texte vectorisé (Inter 750, interlettrage −5), sur fond clair. Dessin et cadrage inchangés (900 × 260) |
| `logo-tutoclick-sombre.svg` | Même logo sur fond sombre : « Tuto » en blanc |
| `logo-tutoclick-compact.svg` / `-compact-sombre.svg` | **Version horizontale compacte** : cadrage serré, sans ombre portée, pour la barre latérale (40 px de haut) et l'en-tête de l'extension |
| `logo-tutoclick-mono-noir.svg` / `-mono-blanc.svg` | Une couleur. Le curseur et l'éclat sont **évidés** dans la bulle. Pour l'impression, le tampon et les fonds photo |
| `symbole-tutoclick.svg` | Bulle, curseur et éclat seuls, sans ombre : avatar d'app, écran de chargement |
| `symbole-tutoclick-mono-noir.svg` / `-mono-blanc.svg` | Symbole en une couleur |
| `symbole-tutoclick-petit.svg` | **Adaptation optique pour 16 et 32 px** : curseur un peu plus grand, éclat réduit à un disque (les rayons disparaissent à cette taille) |
| `favicon.svg`, `favicon.ico` (16, 32, 48) | Onglet du navigateur. Le `.ico` utilise la version petite pour 16 et 32 |
| `icon-16/32/48/128.png` | Icônes de l'extension Chrome (`manifest.icons`) |
| `icon-180.png`, `icon-192.png`, `icon-512.png` | Apple touch icon, manifeste web (PWA) |
| `apercu.html` | Planche de contrôle de toutes les déclinaisons, sur fond clair et sombre |

### 2.2 Règles

- **Ne pas redessiner** le logo. Les seules adaptations admises sont celles listées ci-dessus : cadrage compact, mono, version petite.
- **Dans l'interface**, on utilise le fichier SVG compact (`<img>` avec `alt="TutoClick"`), et non une recomposition en texte HTML : le texte est vectorisé et ne dépend pas de la police.
- La mention « DSI des Missions Locales » peut accompagner le logo **à côté**, en texte HTML (11 px, 600, `text-subtle`). Elle ne doit jamais être intégrée au dessin.
- **Zone de protection** : la moitié de la hauteur de la bulle, tout autour.
- **Tailles minimales** : logo compact 28 px de haut ; symbole 16 px (avec la version petite).
- **Fonds** : clair (`bg`, `surface`) → version claire ; sombre (`#0B0D10`, `#15191F`) → version sombre. Sur une photo ou une couleur vive → mono.
- **Interdits** : recolorer les éléments ; poser la version couleur sur un fond bordeaux, prune ou framboise (la bulle disparaît) ; étirer ; ajouter un contour ; séparer « Tuto » et « Click » ; écrire le nom autrement que « TutoClick ».

### 2.3 Exception de marque : le dégradé

Le **dégradé de la bulle** (`#A52B60` → `#7D204C`) et sa **légère ombre portée** font partie du dessin du client. Ils sont **acceptés dans le logo seulement**. C'est une exception de marque : l'interface reste **sans dégradé ni ombre colorée** (§10). Les versions compactes, mono et petites n'ont pas d'ombre, car elle salit le rendu aux petites tailles.

### 2.4 Logos institutionnels DSI (inchangés)

- `brand-dsi/logo-dsi-horizontal.svg` et `logo-dsi-blanc.svg` : mentions institutionnelles, page « À propos », documents officiels.
- `assets/symbole-dsi.svg` n'est plus le favicon. Il reste le symbole de la DSI, à ne pas confondre avec celui de TutoClick.

## 3. Couleurs

### 3.0 Deux palettes, deux rôles

| Palette | Où | Tokens |
|---|---|---|
| **Marque TutoClick** : bordeaux `#A52B60` → `#7D204C`, orange `#E49A32`, bleu `#4A9BCB`, vert `#91B83E`, encre `#25232A` | Logo, icônes d'app, favicon, supports de marque (page d'accueil publique, documents, e-mails) | `--fd-brand-bordeaux`, `-bordeaux-fonce`, `-orange`, `-bleu`, `-vert`, `-encre` |
| **Charte DSI** : prune, framboise, bleu, vert, orange, noir | **Toute l'interface** : boutons, liens, états, graphiques, player par défaut | `--fd-prune-*` … et rôles `--fd-color-*` |

**Cohabitation :**
- Les deux palettes sont **de la même famille**. Le bordeaux `#A52B60` du logo est presque identique au prune `#A3195B` de la DSI, et les bleus, verts et oranges sont proches. Le logo s'intègre donc naturellement à côté de l'interface, sans qu'il soit nécessaire de les aligner.
- On **ne crée pas** de rôle d'interface à partir des couleurs de la marque. Les tokens `--fd-brand-*` sont réservés au logo et aux supports de marque. Dans l'interface, on utilise toujours `--fd-color-*`.
- **Contrastes de la marque** (en usage graphique, pas comme texte d'interface) :

  | Paire | Ratio | Usage |
  |---|---|---|
  | Blanc sur bordeaux `#A52B60` | 6,74:1 | Curseur sur la bulle ✅ |
  | Encre `#25232A` sur fond `#EEF2F6` | 13,8:1 | ✅ |
  | Bleu `#4A9BCB` sur blanc | 3,07:1 | Partie « Click » du logo : élément graphique d'un logo, ce qui est admis par les WCAG (exception logotype). **Ne pas utiliser ce bleu pour du texte d'interface** |
  | Bleu `#4A9BCB` sur `#0B0D10` | 6,34:1 | Logo sombre ✅ |
  | Vert `#91B83E` sur blanc | 2,30:1 | Trait décoratif seulement |

### 3.1 Couleurs de la charte DSI (interface)

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

Le player n'affiche pas le logo TutoClick, sauf la mention « Créé avec TutoClick » en plan Free (texte, sans logo).

- Primaire prune `#A3195B` et pastille du hotspot framboise `#D60B52`.
- Bulle blanche avec un rayon de 20 px, police Plus Jakarta Sans.
- Fond du player ardoise 100 `#EEF2F6`, uni (sans dégradé).

Les workspaces peuvent toujours surcharger ces couleurs dans l'onglet Design.

## 10. Motifs proscrits (rappel, `composants.md` §15.6)

Restent interdits :
- emojis (dont 👋), dégradés décoratifs (**seule exception : la bulle du logo, §2.3**), verre dépoli, ombres colorées, barres d'accent latérales ;
- étincelles et icônes « IA » ;
- texte blanc sur vert ou sur orange ;
- orange pour du texte.

Le donut est dessiné en SVG (`stroke-dasharray`), pas en `conic-gradient`.
