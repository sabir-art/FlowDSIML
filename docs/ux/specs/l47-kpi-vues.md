# L47 : cartes KPI sélectionnables dans Analytics

> Demande du client, validée par le chef de projet : dans Analytics (espace et démo), les cartes d'indicateurs deviennent des **sélecteurs de vue**. Un clic sur une carte la rend active, et le graphique et le tableau dessous passent sur cet indicateur.
> Modèle d'interaction : les tableaux de bord de paiement ou de suivi de recherche, où la carte choisie pilote la courbe.
> Cohérent avec L40-03 : en-tête, barre de filtres (Démo, Source) et période à droite, puis les cartes.
> Maquette : `docs/ux/maquettes/refonte/l47-kpi-vues.html`. Captures : `img/l47-espace.png`, `img/l47-leads.png`, `img/l47-demo-sombre.png` et `img/l47-mobile.png`.
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

## 7. Recette

- Espace et démo, en clair et en sombre, à 1 440 px, 1 024 px et 390 px.
- Clic sur chaque carte : titre du graphique, courbe et tri du tableau suivent ; l'adresse contient `?indicateur=` ; un rechargement garde l'indicateur.
- Clavier : flèches, Début, Fin, Tab (une seule carte dans l'ordre de tabulation).
- Lecteur d'écran : « onglet, sélectionné, n sur N » ; le panneau est annoncé par le nom de la carte.
- Contrôle visuel : l'état actif reste reconnaissable en niveaux de gris (contour et encoche).
- Aucune barre sur le bord gauche (contrôle CI de §15.6).
- e2e : `analytics` et `demo-analytics` mis à jour (sélecteurs des cartes, segmenté Vues / Visiteurs retiré).
