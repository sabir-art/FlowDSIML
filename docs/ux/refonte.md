# Spec « Refonte DSI » pour le développement

> Demande client du 17 nov. 2026 : refonte visuelle sur la charte DSI des Missions Locales, dans un style de tableau de bord moderne.
> Références :
> - identité : `identite-visuelle.md` ;
> - tokens : `packages/ui/src/tokens.ts` ;
> - composants CSS : `packages/ui/src/base.css` et `controls.css` ;
> - maquettes (à ouvrir dans un navigateur, bascule clair / sombre en bas à droite) : `maquettes/refonte/dashboard.html`, `analytics.html`, `editeur.html`.
> Les règles de finition (`composants.md` §15) et d'overlays (§15.7) restent valables.

## 0. Ce qui est déjà livré (rien à faire côté app pour en profiter)

- **Tokens** : toutes les variables `--fd-*` existantes gardent leur nom, avec de nouvelles valeurs DSI. `--fd-lagoon-*`, `--fd-ember-*` et `--fd-stone-*` deviennent des alias de prune, framboise et ardoise.
- **Police** : Plus Jakarta Sans est importée par `base.css`. Retirer tout import local de Bricolage Grotesque ou d'Instrument Sans s'il en reste.
- **Composants de base** :
  - `.fd-btn` en pilule ;
  - `.fd-card` avec un rayon de 24 px, sans bordure en clair ;
  - `.fd-badge` en pilule ;
  - `.fd-alert` avec un rayon de 20 px ;
  - interrupteur de 40 × 24 px, actif en noir ;
  - champs avec un rayon de 12 px.
- **Nouvelles classes prêtes à l'emploi** : `.fd-nav` / `.fd-nav__item` / `.fd-nav__section`, `.fd-card__head` / `.fd-card__title`, `.fd-icon-chip`, `.fd-kpi__label` / `__value` / `__foot`, `.fd-card--hero`, `.fd-trend--up` / `--down`, `.fd-bar` / `__fill` (`.fd-bar--h` pour l'horizontal), `.fd-btn--round` (+ `.fd-btn--inverse`), `.fd-segmented` (+ `--strong`), `.fd-tabs`.

## 1. Coquille de l'app (`components/Layout.tsx`, `app.css`)

| Élément | Avant | Après |
|---|---|---|
| Fond de page | Stone 50 | `--fd-color-bg` (`#EEF2F6`). La barre latérale est **posée sur le fond** : pas de fond blanc, pas de bordure droite |
| Logo | `BrandMark` (symbole + nom) | Garder `BrandMark`, en ajoutant la mention « DSI des Missions Locales » sous le nom (11 px, 600, `text-subtle`). Symbole de 36 × 40 px. `compact` = symbole seul |
| Navigation `.nav` | Liens avec fond `primary-soft` au survol et en actif | `<nav class="fd-nav">` + `<a class="fd-nav__item" aria-current="page">` : pilule de 44 px, icône de 20 px, gap de 12 px. Actif = pilule **noire** pleine (`--fd-color-nav-active`), texte et icône blancs. Survol = `--fd-color-nav-hover` |
| Titre de section « Workspace » | `.nav-section` | `.fd-nav__section` (12 px, 600, `text-subtle`, pas en capitales) |
| Sélecteur de workspace | Select en haut | Inchangé, mais en champ pilule (`border-radius: var(--fd-radius-full)`) |
| Bloc utilisateur (bas) | Ligne avec bordure supérieure | Carte compacte blanche (`radius-xl`, ombre `xs`) : avatar rond prune avec initiales, nom, rôle, menu ⋯ |
| Contenu | Padding de 24 px | Padding de **32 px** sur ordinateur (16 px sur mobile). Largeur maximale de 1 200 px conservée |
| En-tête de page | Titre `h1` + actions | `h1` en 32 px 800 (déjà appliqué par `base.css`) + sous-titre `text-muted`. À droite : recherche en pilule de 44 px sans bordure avec ombre `xs`, puis action principale en `fd-btn--primary fd-btn--lg`. **Pas de cloche de notifications** : aucune fonctionnalité derrière, elle a été retirée de la maquette |
| Mobile (< 1 024 px) | Barre du haut + tiroir | Inchangé. Le tiroir reprend `.fd-nav`. Corriger DB1 au passage (Échap ferme le tiroir) |

## 2. Cartes KPI (`components/charts.tsx` → `StatTile`, `.stat-row`)

Structure cible (voir `maquettes/refonte/analytics.html`) :

```html
<article class="fd-card fd-kpi [fd-card--hero]">
  <div class="fd-card__head" style="margin:0">
    <span class="fd-icon-chip"><Eye/></span><span class="fd-kpi__label">Vues</span>
    <!-- facultatif, carte héro : <a class="fd-btn fd-btn--round fd-btn--inverse fd-btn--sm" aria-label="Voir le détail"><ArrowUpRight/></a> -->
  </div>
  <span class="fd-kpi__value">1 204</span>
  <span class="fd-kpi__foot"><span class="fd-trend fd-trend--up"><TrendingUp/>+22 %</span>vs 30 jours précédents</span>
</article>
```

Règles :
- **Une seule carte héro par rangée**, toujours la première, sur la mesure principale (Vues). Fond vert DSI, **tout le texte en noir**, badge de tendance inversé (pilule noire, texte vert). Ces styles sont déjà fournis par `.fd-card--hero`.
- Icônes Lucide par KPI : Vues `Eye`, Visiteurs `Users`, Complétion `Route`, Clics CTA `MousePointerClick`, Leads `Mail`.
- `stat-delta--up` devient `.fd-trend--up` (`TrendingUp`), `--down` devient `.fd-trend--down` (`TrendingDown`). Sans période de référence : `.fd-trend` neutre avec « — », plus le texte pour lecteur d'écran déjà en place.
- La rangée `.stat-row` passe en grille de 4 colonnes avec un gap de 20 px (2 colonnes sous 1 100 px, 1 sous 480 px). Pour 5 KPI : 5 colonnes au-dessus de 1 280 px.
- Valeur en `.fd-kpi__value` : 40 px, 800, chiffres tabulaires.

## 3. Graphiques (`components/charts.tsx` → `DailyBars`, entonnoir)

**Barres par jour** :
- Chaque jour est une **barre arrondie** (`rx` = largeur / 2, largeur de 28 px au maximum) remplie en `--fd-color-chart-1` (orange). Derrière, une barre pâle pleine hauteur en `--fd-color-chart-track`.
- **La valeur est écrite au-dessus de chaque barre** (11 px, 700, `text`). C'est obligatoire : l'orange ne fait que 2,35:1 sur blanc, l'information ne doit donc pas reposer sur la couleur. Au-delà de 31 barres (période de 90 jours), afficher la valeur au survol ou au focus, et garder la table `sr-only` existante.
- Le **pic** de la période s'affiche en `--fd-color-nav-active` (noir), et le jour survolé ou sélectionné aussi.
- Pas de lignes de grille horizontales. Graduations `0 / max` supprimées, puisque les valeurs sont écrites. Dates sous les barres en 11 px `text-subtle`.
- Le titre de la carte suit le motif `.fd-card__head` : `fd-icon-chip` (`BarChart3`) + `h2.fd-card__title` + segmenté `Vues | Visiteurs` à droite si utile.

**Donut « Origine des vues »** : **en V1** (révision du 17 nov.). Il s'appuie sur l'agrégation `demo_analytics.sources` (migration 130800), déduite de `link_id` et `embed_origin`. Trois sources, toujours dans cet ordre et avec ces couleurs :

| Source (`sources.*`) | Libellé FR / EN | Couleur |
|---|---|---|
| `direct` | Lien direct / Direct link | `chart-2` framboise |
| `embed` (intégration) | Intégration site / Website embed | `chart-3` bleu |
| `personal_link` (lien personnalisé) | Liens personnalisés / Personal links | `chart-4` vert |

- SVG avec un cercle de rayon 70, un trait de 22 px et `stroke-linecap: round`, un segment par `stroke-dasharray`, et un espace de 4 px entre segments. Pas de `conic-gradient`.
- Une source à 0 n'a pas de segment, mais **reste dans la légende** avec « 0 % ». S'il n'y a qu'une seule source non nulle : anneau complet, sans espace.
- Total des vues au centre (28 px, 800) avec « vues » en dessous. Légende sous l'anneau : pastille de 10 px, libellé, **pourcentage aligné à droite** et nombre de vues en `text-subtle`. C'est le texte qui porte l'information, pas la couleur seule.
- La table `sr-only` (Source / Vues / %) suit le même modèle que `DailyBars`, et l'anneau a `role="img"` avec un `aria-label` qui résume les 3 valeurs.
- État vide (0 vue sur la période) : anneau `chart-track` complet, « 0 » au centre et légende à 0 %.
- Les noms techniques des clés sont à confirmer avec la migration ; les libellés et l'ordre ci-dessus font foi.

**Entonnoir « Parcours étape par étape »** :
- Barres horizontales `.fd-bar.fd-bar--h` de 12 px de haut, avec la piste pâle et le remplissage orange.
- Colonnes : `n · titre de l'étape` | barre | nombre en gras | perte en `--fd-color-trend-down`.

## 4. Tableau de bord des démos (`pages/demos`)

Voir `maquettes/refonte/dashboard.html`.
- **En haut** : rangée de 4 KPI du workspace sur 30 jours (vues en héro, visiteurs, complétion, leads). Ils remplacent le bandeau « Démos publiées : 1 / 25 », qui passe en `fd-help` sous le titre ou dans Plans.
- **Barre de filtres** : titre `h2` « Toutes les démos », puis un segmenté `Toutes · n | Publiées · n | Brouillons · n` (remplace le select de statut), puis à droite des boutons pilules « Dossiers » et « Modifiées récemment ».
- Les **dossiers** quittent la colonne de gauche : ils passent dans le menu « Dossiers », ou en pilules de filtre sous la barre s'il y a 5 dossiers ou moins.
- **Cartes de démo** :
  - padding de 12 px ;
  - vignette arrondie à 16 px dans un fond `surface-sunken`, en `.fd-player-scope` (elle reste claire en sombre) ;
  - titre en `h3` 16 px 700 ;
  - badge en pilule : Publiée = `trend-up-soft` / `trend-up`, Brouillon = `icon-chip` / `text-muted` ;
  - métadonnées en 12 px ;
  - menu ⋯ (inchangé, en portail).
- **Carte « Nouvelle démo »** : en fin de grille, bordure pointillée de 2 px en `border-strong`, `.fd-btn--round` « + » au centre, titre et aide.

## 5. Analytics d'une démo (`pages/analytics/DemoAnalyticsPage.tsx`)

Voir `maquettes/refonte/analytics.html`.
- **En-tête** : bouton rond de retour, titre de la démo en `h1`, sous-titre « Publiée · version n · n étapes ». À droite : segmenté de période `7 j | 30 j | 90 j` (remplace les 3 boutons), puis « Partager » et « Exporter » en pilules.
- Rangée de KPI (§2), puis une grille en 2/3 + 1/3 : « Vues par jour » à gauche, **« Origine des vues »** (donut, §3) à droite. Entonnoir sur toute la largeur, puis tableau des leads dans une carte.
- Pas de carte « Leads récents » séparée : le tableau des leads de la page la rend redondante. Sur le **dashboard**, elle n'a pas sa place non plus, car la grille des démos doit rester visible sans défiler sous les KPI. Les leads du workspace restent dans l'entrée « Leads » de la navigation.
- **Tableaux** (`.fd-table`) :
  - en-têtes en 12 px 600 `text-muted`, sans fond ;
  - lignes de 52 px ;
  - séparateurs `border` ;
  - survol `surface-hover` ;
  - première et dernière cellule avec un padding de 24 px pour s'aligner sur la carte.

## 6. Éditeur (`pages/editor`)

Voir `maquettes/refonte/editeur.html`. L'éditeur n'a pas de barre latérale d'app. Le fond `bg` est visible entre trois cartes.

| Zone | Spécification |
|---|---|
| Barre du haut | Sans fond, posée sur `bg` (padding de 16 px). Dans l'ordre : bouton rond de retour, symbole DSI de 28 px, titre en champ pilule de 44 px (ombre `xs`, sans bordure, 700), badge d'état, puis à droite les outils en `.fd-segmented.fd-segmented--strong` (Sélection / Hotspot / Flou, icône + libellé, actif en noir), « Aperçu » et « Partager » en pilules, « Publier » en `fd-btn--primary`. **Une seule ligne de 56 px dès 1 024 px** (DB3) : en dessous de 1 280 px, outils en icônes seules avec info-bulle, et champ de titre en `flex: 1; min-width: 160px` |
| Rail des étapes | `fd-card` avec un padding de 16 px, sur toute la hauteur. Chaque étape est une carte `surface-sunken` de rayon `xl` : numéro en pastille noire en haut à gauche, vignette claire (`.fd-player-scope`), titre en 13 px 600 et icône d'état (`Target` pour un hotspot, `EyeOff` pour un flou, `Mail` pour un formulaire). Étape courante : bordure de 2 px `primary` + fond `primary-soft`. « Ajouter une étape » en pilule pleine largeur |
| Canevas | Zone de rayon 24 px en `--fd-color-canvas-editor`. La capture est en `.fd-player-scope`, avec un rayon `--fd-player-radius` (20 px) et une ombre `md`. Hotspot : zone en pointillés de 1,5 px framboise, pastille framboise de 18 px avec halo, bulle blanche de rayon 20 px et ombre `lg` (rendue par player-core, inchangé) |
| Panneau de droite | `fd-card` de 340 px. Onglets en `.fd-tabs` pilules (Étape / Design / Réglages). En-tête de section : `fd-icon-chip` + `h2`. Champs espacés de 20 px, séparateurs `hr` en `border`, interrupteurs `.fd-switch` alignés à droite, « Supprimer » en `ghost` rouge centré en bas |

## 7. Autres écrans (même grammaire, sans maquette dédiée)

- **Partage** :
  - cartes de 24 px ;
  - URL publique en champ pilule `readonly` avec un « Copier » pilule accolé ;
  - aperçu (P12) dans une carte, vignette de rayon 16 px ;
  - versions en liste sans bordures.
- **Leads, Membres, Paramètres, Plans** :
  - un tableau ou un formulaire par carte ;
  - titres de carte avec `fd-icon-chip` ;
  - actions secondaires en pilules ;
  - zone dangereuse : carte avec un en-tête `fd-icon-chip` sur fond `danger-soft` et une icône `TriangleAlert` framboise, bouton plein `danger`.
- **Plans** : le plan courant en carte **héro** verte avec texte noir, les autres en blanc, et le bouton « Choisir » en pilule.
- **Authentification** :
  - panneau gauche en fond prune `#A3195B` avec le **logo DSI blanc officiel** (`brand-dsi/logo-dsi-blanc.svg`, après avoir retiré le rectangle blanc de l'export Figma), le titre en blanc 800 et les 3 arguments en blanc, avec des icônes Lucide blanches ;
  - formulaire à droite sur `surface`, champs pilules de 48 px, bouton primaire prune pleine largeur.
- **Player** :
  - fond ardoise 100 et bulle de rayon 20 px, tous deux par défaut (tokens `--fd-player-*`) ;
  - boutons « Suivant » et CTA en pilules, barre de progression orange sur piste pâle, contrôles ronds de 44 px.
- **Extension (popup)** : même grammaire (pilules, prune). Le point d'enregistrement passe en framboise.
- **Toasts et menus** : rayon `xl`, ombre `lg`, éléments de menu de 40 px avec rayon `md` au survol.

## 8. Accessibilité : garde-fous propres à la refonte

1. **Vert DSI** : texte **noir** uniquement (9,5:1). Jamais de texte blanc sur vert (2,1:1).
2. **Orange** : réservé aux barres et aux surfaces. Jamais pour du texte, et jamais sans valeur écrite à côté.
3. **Bleu** : uniquement pour le focus et les icônes ; le texte d'info utilise `--fd-color-info` (bleu 700).
4. **Pilule de navigation active** : l'état est aussi porté par `aria-current="page"`, pas seulement par la couleur.
5. **Badges de tendance** : icône + signe (+ / −) + valeur, pas seulement la couleur.
6. **Cartes sans bordure en clair** : garder `border: 1px solid transparent` pour le mode contraste élevé (`forced-colors`), déjà dans `.fd-card`.
7. **Focus** : anneau bleu de 2 + 2 px (`--fd-shadow-focus`), visible sur prune, noir et vert.

## 9. Ordre de livraison conseillé

1. Coquille + navigation en pilules + logo (§1) : effet visible immédiat sur tous les écrans.
2. `StatTile` → KPI et `DailyBars` → barres arrondies (§2, §3), puis tableau de bord et analytics (§4, §5).
3. Éditeur (§6), en corrigeant DB3 au passage.
4. Autres écrans et player (§7).
5. Captures `docs/tech/captures/finition/` régénérées en clair **et** en sombre. Je ferai la recette « Refonte » sur ces captures et le build intégré.
