# L32 : squelettes de chargement (tableau de bord et éditeur)

> Contexte : le développeur passe le tableau de bord et l'éditeur à une seule requête de démarrage. Pendant cette requête, la page affiche un squelette, c'est-à-dire une silhouette de la page finale.
> Objectifs :
> - zéro décalage de mise en page (CLS = 0 au passage squelette → contenu) ;
> - un état d'erreur clair ;
> - le respect de la réduction des animations.
>
> Composants et jetons du design system uniquement : `--fd-*`, `fd-card`, `fd-btn`. Aucune nouvelle couleur.

## 1. Règles communes

1. **Même géométrie que la page finale.** Le squelette réutilise exactement les mêmes conteneurs (grille, cartes, barres, rail, panneaux), avec leurs dimensions finales. Seuls les contenus sont remplacés par des blocs.
   - Les hauteurs viennent des composants réels : hauteur de ligne × nombre de lignes, ou `min-height` des cartes.
   - Elles ne viennent jamais de valeurs devinées.
   - La barre latérale, l'en-tête de l'app et les titres de page fixes (« Démos ») sont affichés pour de vrai dès le départ : ils ne dépendent pas de la requête.
2. **Blocs** :
   - fond `--fd-surface-sunken` ;
   - arrondi `--fd-radius-sm` pour une ligne de texte, ou celui du composant remplacé ;
   - hauteur d'une ligne : 0,75 × la hauteur de ligne du texte remplacé, centrée verticalement.
   - Largeurs variées et fixes (pas aléatoires à chaque rendu) : 100 %, 80 %, 60 %, pour un rendu stable entre deux chargements.
3. **Animation** : un léger battement d'opacité de 0,6 à 1, sur 1,6 s, en boucle. Pas de reflet qui glisse.
   - Avec `prefers-reduced-motion: reduce`, il n'y a aucune animation et les blocs sont fixes à l'opacité 1.
4. **Délai d'apparition** :
   - si la requête répond en moins de 200 ms, le squelette ne s'affiche pas (la page reste vide sous l'en-tête, pour éviter un clignotement) ;
   - au-delà, le squelette s'affiche et reste au moins 300 ms, pour éviter un flash.
5. **Passage au contenu** : le contenu remplace le squelette en une fois, au même endroit, sans fondu ni glissement.
   - Si la réduction des animations n'est pas demandée, un fondu de 150 ms sur le contenu est permis.
6. **Accessibilité** :
   - la zone principale porte `aria-busy="true"` pendant le chargement ;
   - un texte visuellement masqué, en `role="status"`, annonce « Chargement des démos… » ou « Chargement de l'éditeur… » ;
   - les blocs du squelette sont `aria-hidden="true"` ;
   - à la fin : `aria-busy="false"`, sans nouvelle annonce si le chargement a duré moins de 2 s, sinon « Démos chargées. » ou « Éditeur prêt. » ;
   - le focus ne bouge pas pendant le chargement. Après le chargement, le focus reste là où l'utilisateur l'avait mis, en général sur le lien d'évitement ou dans la barre latérale.
7. **Pas de texte faux** :
   - aucun chiffre, titre ou nom n'est affiché avant la réponse ;
   - pas de « 0 » provisoire dans les indicateurs ;
   - pas de « Aucune démo » avant de savoir.

## 2. Tableau de bord (Démos)

Structure finale, de haut en bas, reprise telle quelle :

| Zone | Pendant le chargement |
|---|---|
| En-tête de page (« Démos », sous-titre, recherche, « Nouvelle démo ») | **Réel**. La recherche est désactivée (`aria-disabled`) jusqu'à la fin du chargement. « Nouvelle démo » reste actif. |
| Carte « Prise en main de votre espace » | **Réservée seulement si elle sera affichée** : la requête de démarrage doit dire si la carte est masquée avant de la dessiner. Si l'information arrive avec le reste, la carte n'a pas de squelette. Elle apparaît **après** les indicateurs, à sa place, sans pousser ce qui est au-dessus. Elle reste sous la ligne de flottaison en 1 440 × 900. |
| Indicateurs (4 cartes) | 4 cartes à leur taille finale. Dans chaque carte : un rond de 32 px pour l'icône, une ligne courte pour le libellé, un bloc de 40 px de haut sur 40 % de large pour le chiffre, une ligne pour la comparaison. La carte « héros » (verte) garde son fond, et ses blocs prennent la variante claire de `--fd-surface-sunken`. |
| Barre de filtres (Toutes / Publiées / Brouillons, Dossiers, Étiquettes, vue, tri) | **Réelle, désactivée.** Les compteurs (« · 2 ») sont absents, jamais à 0. |
| Grille des démos | 6 cartes squelette (2 rangées de 3 à 1 440 px, 2 colonnes à 1 024 px, 1 colonne à 390 px). Chaque carte contient une vignette au ratio final (16:10), une ligne de titre à 70 %, puis une ligne de méta à 50 %. |

- **Indicateurs masqués avant la première publication** (REV-05) : la requête de démarrage le dit. Si les indicateurs ne seront pas affichés, ils n'ont pas de squelette.
  - Si l'information n'est pas connue avant la réponse, la règle à respecter est la suivante : le squelette des indicateurs s'affiche, puis il est remplacé par un bloc de **même hauteur** (« Les statistiques apparaîtront après la première publication. »), pour ne rien décaler.
- **Liste vide après chargement** : l'état vide existant (« Aucune démo pour l'instant ») prend la place de la grille. La hauteur peut changer à ce moment-là, et c'est admis, parce que rien n'est placé en dessous.

## 3. Éditeur

| Zone | Pendant le chargement |
|---|---|
| Barre du haut | **Réelle**, avec Retour, Édition / Aperçu, aide, Présenter, Partager et Publier. Le titre de la démo est remplacé par une ligne de 200 px, et le statut par une pastille vide de 72 px. Présenter, Partager et Publier sont désactivés jusqu'à la fin du chargement. |
| Rail des étapes (gauche) | En-tête « Étapes » réel, sans compteur. 5 étapes squelette à la hauteur finale d'une étape (vignette 96 × 60 et deux lignes de titre). Le bouton « Ajouter une étape » est réel et désactivé. |
| Canevas | Le cadre du navigateur est réel (trois points et barre d'adresse vide). La zone d'image est un bloc au ratio de la première étape s'il est connu par la requête, sinon 16:10. Aucun repère ni aucune bulle. La barre d'outils du canevas est réelle et désactivée. |
| Panneau de droite | Onglets réels (Étape, Design, Réglages), désactivés. 3 sections squelette, chacune avec un titre court et 2 champs à la hauteur d'un champ réel (40 px). |
| Commentaires (bas) | Réel et replié. |

- Le canevas ne doit pas changer de taille à l'arrivée de l'image : la requête de démarrage renvoie la largeur et la hauteur de la première étape, et le cadre est dimensionné avant le chargement de l'image.
- L'image de la première étape se charge en priorité haute (`fetchpriority="high"`). Les vignettes du rail viennent ensuite, en chargement différé.

## 4. Erreur

- **Où** : à la place du contenu de la page (grille ou éditeur), dans une carte centrée. La barre latérale et l'en-tête restent utilisables.
- **Contenu** :
  - icône Lucide `cloud-off` ;
  - titre « Impossible de charger les démos » ou « Impossible de charger l'éditeur » ;
  - texte « Vérifiez votre connexion, puis réessayez. Vos modifications enregistrées ne sont pas perdues. » ;
  - bouton principal « Réessayer », qui relance seulement la requête de démarrage ;
  - lien « Retour aux démos » (éditeur seulement).
- **Démo introuvable ou accès retiré** (éditeur) :
  - titre « Cette démo n'est pas disponible » ;
  - texte « Elle a peut-être été supprimée, ou vous n'y avez plus accès. » ;
  - bouton « Retour aux démos ».
  - Ne jamais révéler si la démo existe.
- **Session expirée** : redirection vers la connexion, puis retour sur la page demandée, comme aujourd'hui. Pas de carte d'erreur.
- **Délai** :
  - au-delà de 10 s sans réponse, le squelette reste et une ligne s'ajoute dessous : « Le chargement prend plus de temps que prévu. », avec un lien « Réessayer » ;
  - au-delà de 30 s, la carte d'erreur s'affiche.
- **Accessibilité** :
  - la carte est en `role="alert"` ;
  - le focus va sur le titre de la carte (`tabindex="-1"`, sans anneau au focus programmatique) ;
  - « Réessayer » repasse en squelette avec `aria-busy="true"`.

## 5. Recette

- Réseau ralenti (Lighthouse mobile et « Slow 4G » de Chrome) : CLS = 0 sur les deux pages, mesuré du premier affichage à la fin du chargement.
- Avec un délai simulé de 100 ms, aucun squelette ne doit apparaître. Avec 1 s, il s'affiche et la transition se fait sans saut.
- Avec `prefers-reduced-motion: reduce` émulé, aucune animation.
- Erreur réseau, réponse 403 ou 404 sur l'éditeur, délai de 10 s puis de 30 s.
- Lecteur d'écran (NVDA) : l'annonce de chargement, la fin et l'erreur.
- Contrôles : 1 440, 1 024 et 390 px, en clair et en sombre (contraste des blocs : visibles mais discrets, rapport d'au moins 1,3:1 avec le fond de la carte).
