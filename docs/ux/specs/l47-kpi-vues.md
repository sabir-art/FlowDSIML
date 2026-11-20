# L47 : cartes KPI sélectionnables dans Analytics

> Demande du client, validée par le chef de projet : dans Analytics (espace et démo), les cartes d'indicateurs deviennent des **sélecteurs de vue**. Un clic sur une carte la rend active, et le graphique et le tableau dessous passent sur cet indicateur.
> Modèle d'interaction : les tableaux de bord de paiement ou de suivi de recherche, où la carte choisie pilote la courbe.
> Cohérent avec L40-03 : en-tête, barre de filtres (Démo, Source) et période à droite, puis les cartes.
> Maquette : `docs/ux/maquettes/refonte/l47-kpi-vues.html`. Captures : `img/l47-espace.png`, `img/l47-leads.png`, `img/l47-demo-sombre.png`, `img/l47-mobile.png`, `img/l47-page-demos.png` et `img/l47-evolutions.png`.
> Données fictives. À réaliser après L46.

## 1. État actuel (code de `claude/dev-mvp`, 2deaae8)

- **Analytics de l'espace** (`AnalyticsPage.tsx`, onglet Vue d'ensemble) : 6 cartes `card kpi` passives (Vues, Visiteurs, Visiteurs récurrents, Taux de complétion, Leads collectés, Clics sur le bouton d'action), puis un graphique fixe « Vues et complétions », puis Sources.
- **Analytics d'une démo** (`DemoAnalyticsPage.tsx`) : 5 `StatTile`, dont la première en `hero` (fond vert, fixe), puis un graphique avec un segmenté Vues / Visiteurs.
- Données quotidiennes : `daily` ne contient que `views` et `completions` (espace) ou `views` et `visitors` (démo).

## 2. Cartes = onglets

- **Liste** : les cartes forment un `role="tablist"` avec le nom « Indicateur affiché ». Chaque carte est un `button role="tab"`, avec `aria-selected`, `aria-controls` vers le panneau et un `id`.
- **Panneau** : un `role="tabpanel"`, relié à la carte active par `aria-labelledby`, contient le graphique et le tableau. Les autres blocs de la page (Sources, Étape par étape, Visiteurs récurrents) restent en dehors du panneau et ne changent pas.
- **Par défaut** : la première carte (Vues) est active.
- **Adresse** : l'indicateur est gardé dans l'URL (`?indicateur=leads`), comme l'onglet et la période ; un indicateur inconnu revient à Vues.
- **Indicateurs** :

| Clé | Libellé de la carte | Titre du graphique | Colonne du tableau | Espace | Démo |
|---|---|---|---|---|---|
| `views` | Vues | Vues par jour | Vues | oui | oui |
| `visitors` | Visiteurs | Visiteurs par jour | Visiteurs | oui | oui |
| `returning` | Visiteurs récurrents | Visiteurs récurrents par jour | Récurrents | oui | non |
| `completion` | Taux de complétion | Taux de complétion par jour | Complétion | oui | oui |
| `leads` | Leads | Leads par jour | Leads | oui | oui |
| `cta` | Clics sur le bouton d'action | Clics sur le bouton d'action par jour | Clics | oui | oui |

- Le contenu des cartes ne change pas : libellé avec icône, valeur, variation par rapport à la période précédente.

## 3. Aspect

- **Carte inactive** : `fd-card` (fond `surface`, bordure 1 px `border`, arrondi 16 px), hauteur 112 px au moins. Curseur `pointer`. Au survol : bordure `border-strong`.
- **Carte active** :
  - fond `hero`, texte et icônes `on-hero` (le style « hero » d'aujourd'hui, qui suit désormais la sélection au lieu d'être fixe sur la première carte) ;
  - **contour de 2 px** `on-hero` (bordure de 1 px, plus 1 px en `inset`) ;
  - **encoche** de 14 px sous la carte, centrée, pointant vers le graphique (carré tourné de 45°, fond `hero`, bords droit et bas de 2 px `on-hero`).
  - Le contour et l'encoche portent l'état sans la couleur (WCAG 1.4.1). **Jamais de barre sur le bord gauche** (règle §15.6).
- **Focus clavier** : anneau `shadow-focus` autour de la carte, en plus de l'état actif.
- **Variations dans la carte active** : texte `on-hero` (le vert et le rouge ne sont pas lisibles sur le fond hero) ; le signe + ou − porte le sens.
- La grille garde les colonnes actuelles (6 pour l'espace, 5 pour la démo), avec 12 px d'écart. L'encoche dépasse dans l'écart de 20 px qui sépare les cartes du graphique.

## 4. Graphique et tableau

- **Graphique** :
  - titre « {Indicateur} par jour » ;
  - courbe de la période (`primary`, 3 px, aire dégradée), et courbe de la période précédente en pointillé `text-muted` ;
  - légende à droite : « 14 derniers jours » (selon la période choisie) et « Période précédente » ;
  - pour le taux de complétion, l'axe va de 0 à 100 % ;
  - le segmenté Vues / Visiteurs de la page démo est **retiré** : ce sont les cartes qui choisissent ;
  - nom accessible du graphique : « {Indicateur} par jour sur {n} jours, comparé à la période précédente ». Les valeurs restent lisibles au clavier, comme aujourd'hui.
- **Tableau** :
  - espace : « Par démo » (Démo, puis une colonne par indicateur) ; démo : « Par source » (Intégration, Lien, Page publique, Direct) ;
  - **trié par l'indicateur actif**, en ordre décroissant, avec `aria-sort="descending"` sur l'en-tête ;
  - la colonne active est en gras, sur fond `surface-sunken`, avec une flèche `arrow-down` de 12 px dans l'en-tête ;
  - 10 lignes, puis « Voir toutes les démos » (espace).
- **Changement d'indicateur** : le graphique et le tableau changent sans recharger la page ni déplacer le défilement. Pendant le chargement d'une série, le graphique garde sa hauteur et affiche le squelette existant.
- **Données** (dev) : il faut une série quotidienne par indicateur (`visitors`, `returning`, `leads`, `cta` en plus de `views` et `completions`) et le détail par démo ou par source pour chaque indicateur, sur la période et la période précédente. Si une série n'est pas encore disponible, la carte reste sélectionnable et le graphique affiche « Pas encore de données jour par jour pour cet indicateur », sans valeur inventée.

## 5. Clavier et lecteur d'écran

- Une seule carte dans l'ordre de tabulation (`tabindex="0"` sur la carte active, `-1` sur les autres).
- Flèches gauche et droite : carte précédente ou suivante, **activée aussitôt** (le changement est léger) ; Début et Fin : première et dernière carte. Le parcours boucle.
- Entrée et Espace activent aussi la carte (comportement natif du bouton).
- Le lecteur d'écran lit : « Leads, 186, moins 4 % par rapport à la période précédente, onglet, sélectionné, 5 sur 6 ». La variation garde son texte complet (pas seulement le signe et la couleur).

## 6. Mobile (moins de 768 px)

- Les cartes passent en **carrousel horizontal** : 148 px de large chacune, défilement avec accroche (`scroll-snap`), la carte suivante dépasse à droite pour montrer qu'il y en a d'autres. Pas de barre de défilement visible.
- La carte active est ramenée dans la vue (`scrollIntoView({ inline: 'nearest' })`) au chargement et à chaque changement.
- La période (segmenté) passe sous le titre. Les filtres Démo et Source passent dans la feuille « Filtres » (L40).
- Le tableau devient une liste à deux colonnes : nom, puis la valeur de l'indicateur actif, triée.
- Aucun défilement horizontal de la page à 390 px.

## 8. Page Démos : 4 cartes, raccourcis vers Analytics

Aujourd'hui (`DemosPage.tsx`) : 4 `StatTile` (Vues, Visiteurs uniques, Taux de complétion, Leads). La première est en `hero` (verte) avec un bouton rond `arrow-up-right` vers `/analytics`, sans raison visible : le client ne comprend pas à quoi servent ces cartes.

- **Rôle** : ce sont des raccourcis vers Analytics. Les 4 cartes sont **identiques** : aucune en `hero`, aucun bouton rond. Le prop `action` et le bouton `kpi-action` sont retirés.
- **Lien** : chaque carte entière est un `<a>` vers `#/analytics?indicateur={clé}` (`views`, `visitors`, `completion`, `leads`), qui ouvre Analytics de l'espace avec la carte correspondante active (§2) et la période de 30 jours.
- **Indicateur « Voir dans Analytics »** :
  - ligne réservée en bas de la carte (18 px), texte 12,5 px graisse 600 `primary` et icône `arrow-right` de 14 px ;
  - invisible au repos, affiché au survol et au focus clavier (fondu de 150 ms, aucun avec `prefers-reduced-motion`) ;
  - sur un écran tactile (`hover: none`) : seule la flèche, toujours visible, en bas à droite.
- **Survol** : bordure `border-strong` et ombre `shadow-md`. **Focus** : anneau `shadow-focus`.
- **Nom accessible** : le contenu de la carte, puis « , voir dans Analytics » (texte masqué visuellement). Exemple : « Leads, 14, plus 11 par rapport à 3 sur les 30 jours précédents, voir dans Analytics ».
- La carte garde son contenu (icône, libellé, valeur, évolution). Les évolutions suivent §9.
- Sous 768 px : grille de 2 × 2 (inchangé).

## 9. Évolutions : jamais de pourcentage aberrant

Aujourd'hui, `variation()` renvoie un pourcentage dès que la période précédente est supérieure à 0 : « +1 326 % » quand elle est presque vide. Règle commune à la page Démos, à Analytics de l'espace et à celui d'une démo (une seule fonction, par exemple `formatTrend` dans `packages/core`) :

| Cas | Affichage | Exemple |
|---|---|---|
| Période précédente ≥ 10 | Pourcentage arrondi à l'unité | « +12 % » |
| Hausse au-delà de +999 % (période précédente ≥ 10) | Multiplicateur | « ×112 » |
| Période précédente entre 1 et 9 | Écart en valeur absolue, suivi de la valeur précédente | « +11 vs 3 les 30 jours précédents » |
| Période précédente à 0, période actuelle > 0 | Pastille « Nouveau » (`primary-soft`) | « Nouveau » |
| Les deux périodes à 0 | « — » `text-muted` ; lecteur d'écran : « Pas d'activité sur les deux périodes » | « — » |
| Taux (complétion) | Toujours en points, si la période précédente compte au moins 10 visiteurs ; sinon « — » | « +5 pts » |

- Le seuil de 10 est une constante unique (`TREND_MIN_BASE = 10`).
- Le signe (« + » ou « − ») porte le sens ; la couleur (succès ou danger) n'est qu'un complément. Dans une carte active (fond hero), le texte est `on-hero`.
- Pas d'icône de tendance quand l'affichage est « Nouveau » ou « — ».
- Tests unitaires sur chaque ligne du tableau, et sur les bornes (9 et 10, +999 % et +1 000 %).

## 7. Recette

- Espace et démo, en clair et en sombre, à 1 440 px, 1 024 px et 390 px.
- Clic sur chaque carte : titre du graphique, courbe et tri du tableau suivent ; l'adresse contient `?indicateur=` ; un rechargement garde l'indicateur.
- Clavier : flèches, Début, Fin, Tab (une seule carte dans l'ordre de tabulation).
- Lecteur d'écran : « onglet, sélectionné, n sur N » ; le panneau est annoncé par le nom de la carte.
- Contrôle visuel : l'état actif reste reconnaissable en niveaux de gris (contour et encoche).
- Aucune barre sur le bord gauche (contrôle CI de §15.6).
- Page Démos : les 4 cartes sont identiques ; chacune ouvre Analytics avec la bonne carte active ; « Voir dans Analytics » au survol et au focus, flèche sur tactile.
- Évolutions : cas du §9 vérifiés sur des données de test (période précédente à 0, à 3, à 10, à 12 avec une forte hausse).
- e2e : `analytics`, `demo-analytics` et `dashboard` (page Démos) mis à jour (sélecteurs des cartes, segmenté Vues / Visiteurs retiré).
