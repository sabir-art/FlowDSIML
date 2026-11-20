# L48-D, Analytics : 4 onglets, 4 indicateurs, grille de widgets

> Paquet L48-D du benchmark (`benchmark-structure.md`, rang 6). Il se livre **avec L47**.
> Maquette : `docs/ux/maquettes/refonte/l48d-analytics.html`. Règles visuelles : `composants.md` §17 et les deltas T1 à T9 de `ui-deltas-l41-l49.md`.
> Code de départ : `apps/web/src/pages/analytics/AnalyticsPage.tsx` (b0aa6cc). **Aucun changement de schéma** : toutes les données existent déjà (`workspace_analytics`, `workspace_overview`, `workspace_returning`, `demo_analytics`).
> Données fictives uniquement.

## 1. Onglets

- **4 onglets au premier niveau** : Vue d'ensemble, Démos, Sessions, Leads. Leads n'apparaît qu'avec `leads.view`, comme aujourd'hui.
- **5e entrée « Plus »** avec un chevron : un menu qui contient Temps réel, Sondages et tests, Segments et Alertes. Les routes ne changent pas (`?tab=live`, etc.).
- Quand un onglet du menu est ouvert, « Plus » prend son nom (« Segments » avec le chevron) et passe à l'état actif.
- Style (T6) :
  - onglets en texte de 15 px ;
  - actif : graisse 600, couleur `text`, souligné de 3 px `text` ;
  - inactifs : `text-muted` ;
  - un filet de 1 px `border` sous la rangée ;
  - aucune icône, aucun compteur.
- Clavier : flèches gauche et droite entre les onglets (déjà en place) ; « Plus » s'ouvre avec Entrée ou flèche bas (menu `role="menu"`).

## 2. Barre de filtres

- Une ligne sous les onglets, sur les onglets filtrés (`FILTERED`, inchangé).
- Boutons T9 (fond `surface`, sans bordure, 40 px) :
  - à gauche : **Démo** (« Toutes les démos ») et **Source** (« Toutes les sources ») ;
  - à droite : **période** en segmenté (7 j, 30 j, 90 j), puis **Exporter** (bouton secondaire, icône `download`).
- « Dates » (Bientôt) et « Mesure des visites » passent dans le menu de l'onglet « Plus ». « Dates » y reste avec la mention « Bientôt ».
- **Menu Démo** (écart L40 accepté, à faire ici) :
  - au-delà de 10 démos, un champ « Rechercher une démo » en haut du menu, avec le focus à l'ouverture ;
  - la liste est filtrée à la frappe (insensible à la casse et aux accents) ;
  - aucun résultat : « Aucune démo ne correspond » en `text-muted`.
  - « Toutes les démos » reste en premier, hors du filtre.

## 3. Vue d'ensemble

### 3.1 Indicateurs et graphique (L47, réduit à 4)
- **Une seule carte** : en haut, 4 indicateurs en onglets (L47 §2, aspect revu par le delta L47) ; en dessous, le graphique.
- Les 4 indicateurs : **Vues**, **Visiteurs**, **Taux de complétion**, **Leads**. Leads n'est montré qu'avec `leads.view` ; sinon 3 indicateurs.
- « Visiteurs récurrents » et « Clics sur le bouton d'action » quittent la rangée (§3.2). `?indicateur=returning` ou `cta` revient à Vues.
- Indicateur :
  - libellé en 13 px `text-muted` ;
  - valeur en 28 px 700 ;
  - variation en 13 px, selon `formatTrend` (L47 §9).
- Actif : valeur en `text`, souligné de 3 px `text` sous la cellule. Inactifs : valeur en `text-muted`.
- Les cellules sont séparées par des filets verticaux.

### 3.2 Grille de widgets
- Grille de 12 colonnes, 24 px d'écart. Les widgets sont des `u2-card`, avec un padding de 24 px.
- Au-dessus de 1100 px, 2 widgets par ligne. Dessous, 1 par ligne.

| Widget | Largeur | Contenu | Données |
|---|---|---|---|
| **Sources** | 6 | Les 4 sources enregistrées (Lien direct, Lien partagé, Intégration, Page publique), une par ligne : nom, barre de 6 px, nombre de vues et part. Triées par nombre décroissant. | `workspace_analytics.sources` |
| **Étape par étape** | 6 | Démo choisie (menu dans le titre) ; une ligne par étape ; la plus forte perte en texte `danger`. **Pied** : « Bouton de fin : 42 clics » | `demo_analytics.steps` et `demo_analytics.ctaClicks` (même démo) |
| **Nouveaux et récurrents** | 6 | 2 chiffres (nouveaux, récurrents) et une barre empilée en 2 tons de gris | `workspace_returning` |
| **Appareils et navigateurs** | 6 | « Bientôt » en texte à droite du titre ; une phrase : « Le type d'appareil n'est pas encore enregistré. » | aucune (jamais masqué) |

- **En-tête de widget** :
  - titre en 15 px 600 ;
  - à droite, un bouton à icône `dots` (« Plus d'actions pour Sources »), qui ouvre un menu avec **Exporter en CSV**.
  - Pas de menu sur « Appareils et navigateurs ».
- **État vide par widget** (`fd-empty`, petite variante de L48-B) :
  - icône Lucide de 32 px `text-muted`, sans pastille ;
  - « Pas encore de données sur cette période » ;
  - lien « Élargir à 90 jours » si la période est plus courte.
  - Le widget garde sa hauteur minimale (220 px), pour que la grille ne saute pas.
- **Localisation : non retenue** (minimisation des données, benchmark §6).

## 4. Onglet Démos

- Tableau d'une ligne par démo, avec les données de `workspace_overview(p_ws, days)`, filtrées par la source et la période de la barre.
- Colonnes : **Démo** (nom, puis dossier en 13 px `text-muted` dessous), Vues, Visiteurs, Complétion (en %, `completions / visitors`) et Leads (avec `leads.view`).
- Chiffres alignés à droite, en `tabular-nums`.
- Tri :
  - par clic sur l'en-tête ; tri par défaut : Vues, décroissant ;
  - colonne triée en graisse 600, avec une flèche `sort` de 14 px ; `aria-sort` sur l'en-tête.
- Ligne :
  - hauteur 64 px, entièrement cliquable vers l'Analytics de la démo (`/demos/:id/analytics`) ;
  - chevron à droite ; fond `surface-sunken` au survol.
- Démo sans vue sur la période : ligne affichée, avec des tirets en `text-muted`.
- 25 lignes par page ; « Afficher plus » en bas.
- Pas de barre de recherche : le menu Démo de la barre sert de filtre.

## 5. Mobile (moins de 768 px)

- Onglets en défilement horizontal, sans barre de défilement visible ; « Plus » reste à la fin.
- Filtres : Démo et Source sur une ligne ; période et Exporter sur la ligne suivante.
- Indicateurs en grille de 2 × 2 ; le soulignement de l'actif reste sous la cellule.
- Widgets sur une colonne.
- Tableau Démos : la colonne Démo, puis la valeur de la colonne triée ; les autres colonnes sont masquées. Le tri se change par un menu « Trier par ».

## 6. Textes (i18n, nouvelles clés)

| Clé | Texte |
|---|---|
| `analytics.tabs.demos` | Démos |
| `analytics.more` | Plus |
| `analytics.searchDemo` | Rechercher une démo |
| `analytics.noDemoMatch` | Aucune démo ne correspond |
| `analytics.widgetMenu` | Plus d'actions pour {{name}} |
| `analytics.exportCsv` | Exporter en CSV |
| `analytics.emptyPeriod` | Pas encore de données sur cette période |
| `analytics.widen` | Élargir à 90 jours |
| `analytics.newReturning` | Nouveaux et récurrents |
| `analytics.devicesBrowsers` | Appareils et navigateurs |
| `analytics.devicesSoon` | Le type d'appareil n'est pas encore enregistré. |
| `analytics.ctaFooter` | Bouton de fin : {{n}} clics |
| `analytics.sortBy` | Trier par |

## 7. Recette

1. Rôle avec `leads.view` : 4 onglets et « Plus », 4 indicateurs. Sans ce droit : 3 onglets et 3 indicateurs.
2. `?tab=segments` : « Plus » affiche « Segments » et passe à l'état actif.
3. 12 démos : le menu Démo a une recherche ; la saisie de « fiche » filtre la liste ; avec « zzz », « Aucune démo ne correspond » s'affiche.
4. Espace sans visites sur 7 j : chaque widget montre son état vide à la même hauteur, avec « Élargir à 90 jours ».
5. Widget Sources › Exporter en CSV : le fichier contient les lignes du widget pour la période et les filtres.
6. Onglet Démos : clic sur « Complétion » : tri décroissant, en-tête en gras, `aria-sort="descending"` ; un second clic inverse le tri. Clic sur une ligne : Analytics de la démo.
7. `?indicateur=cta` : Vues est actif.
8. 390 px : pas de défilement horizontal de la page ; les onglets défilent seuls.
9. Sombre : textes à 4,5:1 au moins ; filets et barres à 3:1 au moins.
