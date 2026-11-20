# Deltas visuels L41 à L49 (reprise UI du 20 novembre)

> Retour du client : maquettes trop chargées. Les règles mesurables sont maintenant dans `composants.md` §17 :
> - une action principale ;
> - trois tailles de texte ;
> - cartes et badges sobres ;
> - lois de Hick, Fitts, Miller et Jakob.
>
> Chaque maquette `docs/ux/maquettes/refonte/l4x-*.html` s'ouvre sur l'**après**, dans le cadre de l'app, avec un sélecteur **Après / Avant** (capture de l'app actuelle ou de la maquette précédente).
> Les **specs fonctionnelles ne changent pas**, sauf mention. Ce document liste seulement ce qui change **visuellement** par rapport aux maquettes précédentes et à l'app.
> Pour les lots déjà livrés (L42, L44), ces deltas sont de petites corrections à faire au passage.

## Deltas transverses (toutes les pages touchées)

| # | Delta |
|---|---|
| T1 | **Une seule action principale** (`primary`) visible par écran ou par dialogue. Exemple : sur la page Démos vide, le bouton du haut disparaît et l'action passe au centre. |
| T2 | **Badges** retirés quand ils sont décoratifs : « Admins », « Recommandé », « Page sûre » en pastille, compteurs redondants. Les états s'écrivent en texte (`text-muted`, ou couleur d'état avec un point de 8 px). « Bientôt » reste, en texte discret aligné à droite. |
| T3 | **Pas de pastille de fond** derrière les icônes (KPI, listes, sources, formats). Une icône de 18 px au plus par élément, aucune devant chaque ligne de texte. |
| T4 | **Listes au lieu de cartes** : une carte par objet, jamais de carte dans une carte. Lignes séparées par un filet, hauteur 56 à 72 px, toute la ligne cliquable quand elle mène quelque part (chevron `chevron-right` à droite). |
| T5 | **Sélection** : fond `surface-sunken` (liste, options) ou contour `text` de 2 px (cartes de choix). Plus d'aplat `primary-soft`, plus de contour `primary` pour une simple sélection. Navigation secondaire (dossiers, paramètres) : fond `surface` et graisse 600. |
| T6 | **Onglets et indicateurs** : l'actif est souligné de 3 px `text`, comme un onglet. Plus d'aplat vert ni d'encoche. |
| T7 | **Textes** : une phrase sous le titre au plus. Les explications vont dans l'aide (F1) ou dans une infobulle. Pas de liste de points forts dans un choix. |
| T8 | **Réglages** : disposition libellé à gauche (avec une ligne d'aide) et contrôle à droite, dans une seule carte par page de réglages. Radios simples, sans carte par option. |
| T9 | **Barres de filtres** : boutons `surface` sans bordure (fond blanc sur fond gris), 40 px. |

## Par lot

### L41, Console propriétaire (`l41-console-ui2.html`)
- **En-tête** : symbole, « Console », onglets soulignés, compteur en texte gris à côté du libellé. On retire le badge « Admin » et les icônes des onglets.
- **Vue d'ensemble** : 4 chiffres dans **une seule bande**, séparés par des filets, sans icône. « Articles à surveiller » devient une liste de lignes cliquables (barre fine et pourcentage), sans les trois boutons « Voir les retours ».
- **Retours** : le commentaire d'abord, le contexte en gris dessous, « nouveau » marqué d'un point `primary` de 8 px, Oui ou Non en texte coloré. Une action secondaire par ligne.
- Les autres onglets du parcours (`l41-console.html`) appliquent T1 à T9.

### L42, Résultat du quiz (`l42-score-quiz.html`), livré (d6aa3e4) et conforme à la spec
- On retire le badge « Pas encore validé » (redondant avec le titre).
- Le paragraphe devient une ligne : « 1 bonne réponse sur 3 · il vous reste 2 tentatives ».
- Questions : icône `x` ou `check` de couleur, sans fond gris par ligne. « Revoir » sur **chaque** question ratée.
- L'anneau ne change pas.

### L43, Composeur (`l43-composeur.html`)
- Composeur inchangé (révision 2).
- **Arbitré dans L48-E** (`l48e-editeur.md` §5) : les commentaires de l'éditeur passent du tiroir du bas, qui écrasait le canevas, à un **panneau latéral** de 400 px ouvert depuis le rail, comme l'assistant. Aucun changement fonctionnel.

### L44, Infobulles (`l44-infobulles.html`), livré (f62c292) et conforme
- Aucun delta : rendu vérifié en clair et en sombre, e2e à 0 écart sur 849 boutons.

### L45, Exporter (`l45-exporter.html`)
- Formats en liste, **sans pastille d'icône ni cadre par ligne**. Sélection en fond `surface-sunken` ; radio et cases en `text`.
- L'encart d'information devient une ligne de pied. Le bouton principal dit « Exporter ».

### L46, Variables (`l46-variables.html`)
- **Catalogue** : nom à gauche et exemple en gris à droite, sur une ligne. La description passe dans l'infobulle de la ligne et dans l'aide. Les groupes ont un titre de 12 px (non en capitales).
- **Aide au premier usage** : une phrase grise, sans encadré.
- **Barre du champ** : icônes `bold` et `italic` (plus de lettres B et I), « + Variable » en lien `primary`.
- **Paramètres > Variables** : tableau sans clé technique, description en gris sous le nom, chiffres alignés à droite.

### L47, Indicateurs (`l47-kpi-vues.html`)
- **Analytics** : 4 indicateurs en onglets dans **la même carte que le graphique**, séparés par des filets. L'actif est souligné et a ses chiffres en `text`, les autres en `text-muted`. On retire l'aplat `hero`, l'encoche et le contour de 2 px.
- **Tableau** : colonne active en gras, sans fond.
- **Page Démos** : une bande de 4 raccourcis, au survol fond `surface-sunken` et « Analytics → » en haut à droite.
- **Graphique** : libellés d'axe hors du dessin (dates sous le graphique), courbe de 2,5 px, période précédente en pointillé gris.

### L48-A, Navigation et Paramètres (`l48a-navigation.html`, `l48a-utilisation.html`)
- **Colonne Dossiers** en texte : pas d'icône par dossier (seulement le cadenas d'accès restreint), compteur gris à droite, sélection en fond `surface`.
- **Paramètres** : « Bientôt » en texte gris à droite, sans pastille.
- **Équipe** : liste sans cadre par membre ; le rôle est un menu en texte avec chevron.
- **Barre de liste** : le Tri passe en bouton rond à icône. La recherche passe dans l'en-tête, en bouton à icône.
- **Utilisation** : une ligne par quota (nom et aide, barre de 6 px, chiffre à droite), état en texte seulement à partir de 80 %. Plus de cartes ni de pastilles.

### L48-B, États vides (`l48b-etats-vides.html`)
- **Page Démos vide** :
  - on retire les 3 tuiles de départ (Hick) et le bouton du haut ;
  - une seule action au centre, « Nouvelle démo », et un lien « Voir un exemple » ;
  - checklist sur une ligne.
- **Icône d'état vide** : 32 à 40 px `text-muted`, sans pastille de fond.

### L48-G, Types de contenu (`l48g-types.html`)
- **Choix du type** : 3 cartes égales avec une image simple, un nom et une phrase. On retire les points forts. Sélection par contour `text` de 2 px.
- **Étape 2** : sources en liste (une ligne et un chevron), « Bientôt » en texte.
- **Plan du Sandbox** : pages en cartes blanches sur fond gris, départ cerclé, page manquante en pointillé. Pour chaque lien : « Capturer cette page », plus un menu `ellipsis` pour les autres actions.

### L49, Sécurité HTML (`l49-securite-html.html`)
- **Réglage** : une ligne de réglage (libellé à gauche, 3 radios simples à droite), domaines en pastilles grises. La mention d'autorisation en texte gris, sans encadré.
- **Extension** : le compte rendu tient en une phrase (« 3 pages nettoyées : 18 éléments actifs retirés, 1 lien dangereux bloqué »). Le détail se déplie en tableau de chiffres. Chaque page porte un point et un texte, sans badge.
- **Éditeur** : « Sécurité de la page » en une ligne, avec le lien « Détail ». Les liens externes forment une liste avec interrupteurs ; un lien signalé affiche son état en texte rouge, à la place de l'interrupteur.
