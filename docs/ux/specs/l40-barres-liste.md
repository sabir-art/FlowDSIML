# L40 : barres de liste (filtres, tri, affichage)

> Retour client sur la barre « Toutes les démos » :
> - les onglets Toutes / Publiées / Brouillons, Étiquettes et la bascule grille / liste lui plaisent ;
> - Dossiers (plus petit qu'Étiquettes) et « Modifiées récemment » sont mal placés et déstructurent la ligne.
>
> Il demande une composition cohérente : mêmes hauteurs, filtres groupés d'un côté, tri et affichage de l'autre.
> Maquette avant/après : `docs/ux/maquettes/refonte/l40-barres-liste.html` (clair et sombre, 1 440, 1 024 et 390 px). Les captures « Avant » viennent de l'app (dev-mvp 1b2c82d), avec des données fictives.
> Cette spec s'applique à **toute barre posée au-dessus d'une liste ou d'un tableau** : Démos, Apprenants, Analytics (tous les onglets, dont Leads), Médiathèque, Membres, et toute nouvelle liste.

## 1. Constat (mesuré dans l'app, 1 440 × 900)

| Page | Écarts |
|---|---|
| **Démos** | Hauteurs mélangées : Statut 42 px, Dossiers 32 px, Étiquettes 40 px, grille ou liste 42 px, tri 32 px. Dossiers et le tri sont `fd-btn--sm`, Étiquettes est `fd-btn`. Le titre « Toutes les démos » est sur la même ligne et prend la place des filtres. L'affichage (grille ou liste) est placé entre deux contrôles, puis vient le tri ; les filtres et l'affichage s'entremêlent. |
| **Apprenants** | Deux systèmes de filtre : puces `fchip` de 36 px et recherche de 40 px, poussée à l'autre bout. La bascule « Tous les apprenants / Par formation » occupe à elle seule une ligne de 508 px. |
| **Analytics** | L'aide et la cloche sont tombées dans la ligne des filtres, à gauche. Listes natives de 32 px, période de 30 px, boutons d'action de 32 px. « Ajouter un filtre » est isolé sous les onglets. Les actions de page (Mesure des visites, Exporter) sont mêlées aux filtres. |

## 2. Règles de composition

1. **Une seule hauteur** : tous les contrôles de la barre font **40 px**.
   - C'est le cas des boutons, des déclencheurs de filtre, de la recherche et des contrôles segmentés (conteneur de 40 px, segments de 32 px).
   - Aucun `fd-btn--sm` dans une barre de liste.
2. **Deux groupes, dans cet ordre** :
   - **à gauche, « Filtres »** : recherche (si elle est propre à la liste), filtre principal en segmenté (Statut), menus de filtre, puis « Réinitialiser » ;
   - **à droite, « Tri et affichage »** : tri, puis bascule d'affichage (grille ou liste, ou période pour Analytics).
   - Entre les contrôles d'un groupe : 8 px. Entre les deux groupes : au moins 24 px, le groupe de droite est poussé au bord (`margin-left: auto`).
3. **Ce qui n'est pas dans la barre** :
   - le **titre de section** (« Toutes les démos ») est sur sa propre ligne, au-dessus, à 16 px ;
   - les **actions de page** (Nouvelle démo, Exporter, Mesure des visites, Inviter, Gérer…) restent dans l'en-tête de page, à droite, avec l'aide et la cloche ;
   - un changement de **vue** qui remplace le contenu (« Tous les apprenants / Par formation », onglets d'Analytics) se présente en **onglets** au-dessus de la barre, pas comme un contrôle de la barre.
4. **Un seul composant de filtre** : le déclencheur « Libellé : valeur » (§3). Les puces `fchip`, les `<select>` natifs et les boutons à libellé seul (« Dossiers ») sont remplacés.
5. **Une ligne à 1 440 px** : la barre tient sur une seule ligne dans la largeur de contenu de l'app (1 120 px), même avec des filtres actifs :
   - les valeurs sont tronquées à 140 px, avec des points de suspension ;
   - le libellé d'un filtre actif est masqué visuellement (§3) ;
   - « Réinitialiser » est un bouton icône.
6. **Espacements verticaux** : 16 px entre le titre de section (ou les onglets) et la barre, 16 px entre la barre et la liste.

## 3. Composants

### 3.1 `fd-toolbar` (à ajouter à `packages/ui/src/controls.css`)

Le CSS est dans la maquette (bloc « Composant proposé »). En résumé :

```css
.fd-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--fd-space-2) var(--fd-space-6); }
.fd-toolbar__group { display: flex; flex-wrap: wrap; align-items: center; gap: var(--fd-space-2); min-width: 0; }
.fd-toolbar__group--end { margin-left: auto; }
.fd-toolbar .fd-btn, .fd-toolbar .fd-input { height: 40px; }
.fd-toolbar .fd-segmented { padding: 3px; }                 /* 40 px avec la bordure */
.fd-toolbar .fd-segmented > button { height: 32px; padding: 0 var(--fd-space-3); }
.fd-toolbar .fd-segmented--icons > button { width: 36px; padding: 0; }
```

Structure : `<div class="fd-toolbar">`, puis deux `<div class="fd-toolbar__group" role="group" aria-label="Filtres">` et `<div class="fd-toolbar__group fd-toolbar__group--end" role="group" aria-label="Tri et affichage">`.

### 3.2 Déclencheur de filtre `fd-filter`

- `fd-btn fd-filter` de 40 px. Contenu : icône Lucide de 16 px, `Libellé :` (500, `text-muted`), valeur (600, `text`), puis `chevron-down` de 16 px.
- **Icônes** : Dossier `folder`, Étiquettes `tag`, Tri `arrow-up-down`, Formation `graduation-cap`, Statut `circle-dot`, Structure `building-2`, Groupe `users`, Démo `monitor`, Source `link`, Ajouter un filtre `plus`.
- **Valeurs par défaut** : « Dossier : Tous », « Étiquettes : Toutes », « Tri : Modifiées récemment », « Formation : Toutes », « Statut : Tous », « Structure : Toutes », « Groupe : Tous », « Démo : Toutes », « Source : Toutes ».
- **Filtre actif** (valeur différente de la valeur par défaut) :
  - fond `primary-soft`, bordure `primary` à 35 %, valeur en `primary-soft-text` ;
  - le libellé est masqué visuellement, l'icône indique le type de filtre ;
  - le **nom accessible** reste complet : « Dossier : Onboarding » ;
  - plusieurs valeurs : « Formation, CRM », puis « 3 étiquettes » au-delà de 2.
- **Le tri** utilise le même composant, mais n'est jamais « actif » (pas de fond coloré) : il n'y a pas de tri neutre.
- **Menus** : le composant `Menu` existant (portail, §15.7) ; `aria-haspopup="menu"`, ou `listbox` pour un choix unique dans une longue liste (Démo dans Analytics, avec recherche au-delà de 10 éléments). Le choix « Tous / Toutes » est toujours en tête du menu.
- **Réinitialiser** :
  - bouton icône `rotate-ccw`, `fd-btn--ghost fd-btn--icon`, 40 px ;
  - nom « Réinitialiser les filtres », avec une infobulle ;
  - affiché seulement si au moins un filtre est actif (le segmenté Statut compte).
  - Il remet les filtres à leur valeur par défaut, sans toucher au tri ni à l'affichage.

### 3.3 Segmentés

- **Statut (Démos)** : il garde ses compteurs (« Publiées · 12 ») ; c'est le filtre principal, toujours en première position.
- **Affichage** : grille ou liste en icônes (`layout-grid`, `list`), `role="radiogroup"`, noms « Grille » et « Liste ».
- **Période (Analytics)** : 7 j, 30 j, 90 j, puis « Dates » avec le badge « Bientôt » (`aria-disabled`, jamais masqué).

## 4. Application page par page

| Page | Titre ou onglets au-dessus | Groupe gauche « Filtres » | Groupe droit |
|---|---|---|---|
| **Démos** | h2 « Toutes les démos » | Statut (segmenté), Dossier, Étiquettes, Réinitialiser | Tri, Affichage (grille ou liste) |
| **Apprenants** | Onglets « Tous les apprenants », « Par formation » (soulignés, comme ceux d'Analytics) | Recherche (220 px), Formation, Statut, Structure, Groupe (s'il existe des groupes), Réinitialiser | Tri, s'il est ajouté plus tard ; sinon vide |
| **Apprenants > Par formation** | mêmes onglets | Formation, Structure, Groupe, Réinitialiser | — |
| **Analytics** (tous les onglets) | En-tête : Analytics, puis à droite aide, cloche, « Mesure des visites », « Exporter » (40 px). La barre est **au-dessus** des onglets, car elle s'applique à tous. | Démo, Source, « Ajouter un filtre » (s'il s'applique à tous les onglets ; sinon il reste dans l'onglet, dans sa propre barre, à gauche) | Période (segmenté) |
| **Onglets d'Analytics avec leur propre liste** (Leads, Sessions…) | — | Les filtres propres à l'onglet, s'il en a, avec les mêmes composants | Le tri, s'il existe |
| **Autres listes** (Médiathèque, Membres, et toute nouvelle liste) | h2 de la page | Recherche, puis les menus de filtre, s'ils existent | Tri et affichage, s'ils existent |

- La recherche d'en-tête de Démos (« Rechercher une démo ») reste dans l'en-tête : elle porte sur tout l'espace.
- Une liste sans filtre n'a pas de barre vide : le groupe de droite seul est aligné à droite.

## 5. Petites largeurs

- **De 768 à 1 279 px** :
  - si tout ne tient pas, le groupe de droite passe sur la ligne suivante, aligné à droite ;
  - à l'intérieur d'un groupe, les contrôles passent à la ligne dans le même ordre ;
  - on ne mélange jamais les deux groupes sur une même ligne coupée.
- **Sous 768 px** (maquette, §4) :
  1. ligne 1 : le segmenté Statut en pleine largeur (segments égaux) ;
  2. ligne 2, à gauche : « Filtres · n », avec l'icône `sliders-horizontal` et le nombre de filtres actifs ;
  3. ligne 2, à droite : le tri en icône seule (nom accessible « Tri : Modifiées récemment »), puis l'affichage.
  - « Filtres · n » ouvre une feuille du bas, avec les mêmes menus en liste et « Réinitialiser les filtres ».
  - Apprenants : la recherche passe en pleine largeur sur la ligne 1.

## 6. Accessibilité

- Les deux groupes portent `role="group"` et un `aria-label` (« Filtres », « Tri et affichage »).
- Les déclencheurs portent `aria-haspopup` et `aria-expanded`. Leur nom accessible contient le libellé et la valeur.
- Après un changement de filtre, une zone `role="status"` (visuellement masquée) annonce le nombre de résultats : « 12 démos », « 2 apprenants ». Le focus reste sur le déclencheur.
- L'ordre de tabulation suit l'ordre visuel : groupe gauche, puis groupe droit.
- **Contraste** : la valeur active en `primary-soft-text` sur `primary-soft` respecte celui du design system existant (badges). Le libellé `text-muted` garde au moins 4,5:1.

## 7. Recette

- À 1 440 × 900, sur Démos, Apprenants et Analytics :
  - tous les contrôles de la barre font 40 px (mesure de `getBoundingClientRect().height`) ;
  - la barre tient sur une ligne, avec 0 filtre actif comme avec 2 filtres actifs à valeur longue.
- À 1 024 et 390 px : aucun défilement horizontal, ordre des groupes respecté, feuille « Filtres » sous 768 px.
- En clair et en sombre : filtre actif lisible, aucune barre de couleur sur un bord (§15.6).
- Clavier : tabulation dans l'ordre, ouverture des menus avec Entrée ou Espace, fermeture avec Échap et retour du focus sur le déclencheur.
- Lecteur d'écran : noms « Dossier : Onboarding », « Réinitialiser les filtres », annonce du nombre de résultats.
