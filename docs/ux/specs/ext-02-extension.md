# EXT-02 · Extension : popup, vérification, aperçu

Statut : lot 1 (popup, vérification après capture, aperçu) révisé le 23/11 après le retour du client : deux variantes du popup à choisir. Les points 4 (vidéo et masquage), 6 (idées de l’éditeur de référence, voix off) et 7 (mot de passe, étape Formulaire) suivent, voir « À venir ». Maquettes : `maquettes/refonte/ext02/` (index, captures clair/sombre ; popup en 360 px, variantes `popup-a-*` et `popup-b-*` ; écrans pleins à 1440 et 390 px). Données fictives (acme, example.com). Icônes Lucide, aucun emoji, aucun dégradé, aucune barre de couleur sur un bord.

Principe : le popup ne montre que ce qu’il faut pour lancer une capture, avec nos composants (COMP-01 : listes, lignes de réglage ALIGN-01, listes déroulantes, interrupteurs, bouton primaire prune). On ne reprend pas la forme de l’éditeur de référence : il a seulement servi à exprimer le besoin (moins de texte, mieux rangé). Le popup ne propose que ce que l’extension fait vraiment.

## 1. Popup de l’extension (révision du 23/11, deux variantes)

Contraintes communes :
- largeur 360 px, hauteur au plus 600 px (limite de Chrome) ; en-tête et pied fixes, le corps défile seulement si besoin ;
- **en-tête (NAV-04, PAGE-01)** : logo compact à gauche ; à droite, « ? » (aide dans un nouvel onglet) et ⋯ (Ouvrir TutoClick, Réglages de l’extension, Se déconnecter). Hauteur 56 px, filet dessous ;
- **types réels** : Captures, HTML guidée, Sandbox, Vidéo, et Format mobile en **Bientôt** (grisé, jamais masqué, `aria-disabled="true"`, pastille « Bientôt ») ;
- **titre de la démo** (champ facultatif, exemple en indication) et **espace** restent dans le popup ; le choix de l’espace n’apparaît que si la personne en a plusieurs (sinon le nom seul, sans chevron) ;
- **réglages réels** : pour Captures, HTML et Sandbox, « Taille de l’onglet » (Actuelle, 1 280 × 720, 1 440 × 900, 1 920 × 1 080, Personnalisée…) et « Suivre les nouveaux onglets » ; pour Vidéo, « Ma voix », « Webcam dans un coin » et « Masquer en direct » (nouveau, voir point 4) ;
- **aide** : le « ? » d’une ligne déplie une phrase sous la ligne (`aria-expanded`), dans le flux, sans rien recouvrir. Une seule aide ouverte à la fois ; en ouvrir une ferme l’autre. Plus d’infobulle flottante dans le popup ;
- **bouton** « Démarrer », primaire **prune** (`--fd-color-primary`, texte `on-primary`), 40 px, calé à droite dans le pied, icône Play en `currentColor` ;
- pas de « Copilote IA » : ce n’est pas une fonction du produit.

### 1.1 Variante A : liste

- Champ « Titre de la démo ».
- Types en **liste à choix unique** (une carte, lignes de 36 px séparées par un filet, icône 16 px, libellé, rond de sélection à droite). Ligne choisie sur `primary-soft`, texte `primary-soft-text`. Format mobile : fond `surface-sunken`, pastille « Bientôt » à la place du rond, même colonne.
- Réglages du type en **lignes ALIGN-01** dans une carte : libellé à gauche, « ? » puis contrôle calé à droite (liste de 120 px ou interrupteur).
- Pied : à gauche, l’espace en sélecteur discret (icône Building2, « Acme », chevron) ; à droite, « Démarrer ».
- Hauteurs mesurées : 521 px au repos, 560 px en vidéo, 599 px avec l’erreur.

### 1.2 Variante B : formulaire court

- Champ « Titre de la démo ».
- « Type de capture » en **liste déroulante décrite** : le bouton affiche l’icône, le nom et une ligne de description. Ouverte, chaque option a sa description ; Format mobile y figure, grisé, avec « Bientôt ».
- « Espace » en liste déroulante.
- « Options » en **section repliable** : repliée, une ligne résume les réglages (« Taille actuelle, nouveaux onglets suivis ») ; dépliée, les mêmes lignes ALIGN-01 que la variante A.
- Pied : « Données vérifiées » (ShieldCheck, 12 px) à gauche, « Démarrer » à droite.
- Hauteurs : 438 px au repos, 583 px avec les options ouvertes et l’aide.

### 1.3 États (les deux variantes)

| État | Ce qu’on voit |
|---|---|
| Repos | Captures choisi, titre vide, espace Acme. |
| Type sélectionné | Vidéo : les réglages deviennent Ma voix, Webcam dans un coin, Masquer en direct. |
| Bientôt | A : ligne Format mobile au focus (anneau intérieur prune), non sélectionnable, pastille lisible. B : liste ouverte, option grisée avec « Bientôt ». Aucune infobulle. |
| Aide ouverte | Phrase sous la ligne « Taille de l’onglet », bouton « ? » actif. |
| Menu ⋯ | Trois entrées, sous les actions de l’en-tête. |
| Erreur | Bandeau sous l’en-tête : icône, « Cette page ne peut pas être capturée », « Ouvrez la page à capturer. Réessayer ». « Démarrer » désactivé, pas masqué. |

Erreurs à prévoir avec la même forme : autorisation refusée, session expirée (« Se connecter »), hors ligne, espace sans droit d’écriture.

### 1.4 Revue faite avant envoi

**Icônes de bouton** : toujours `currentColor`, la couleur du texte du bouton. Le « + » bleu sur « Ajouter une zone » venait de la maquette d’aperçu (règle `.empty svg` qui colorait aussi l’icône du bouton) ; corrigé en ne colorant que l’icône de l’encart (`.empty > svg`). Dans l’app, aucun bouton concerné sur les 29 pages parcourues (clair et sombre), mais la même règle latente existe : `apps/web/src/styles/maquette.css`, `.mk .alert svg { color: info }` colorerait l’icône d’un bouton placé dans une alerte ; à restreindre à `.mk .alert > svg`.

Sur les 24 captures du popup et les écrans de vérification et d’aperçu : contraste AA (axe, aucune violation), icône de chaque bouton de la couleur de son texte, aucun texte qui déborde, au plus une aide ouverte, popup ≤ 600 px.

## 2. Vérification après capture, avant l’envoi (décision du chef du 23/11)

Le blocage du client venait de la capture des applis à page unique (corrigé par le dev), pas du retrait des scripts. Les pages restent des **copies fixes**, et la navigation est rejouée à partir des clics enregistrés. L’écran rassure : ce qui n’est pas copié n’est pas une perte.

### 2.1 Structure (page pleine, pas dans le shell)

1. En-tête : logo, titre « Vérifier avant l’envoi », une phrase : « Votre démo est une copie fixe des pages, et la navigation est rejouée à partir de vos clics. Voici ce que TutoClick n’a pas copié ou a protégé. Vous n’avez rien à faire, sauf si vous voulez garder un élément. »
2. **Bilan** : Pages copiées, Scripts non copiés, Protégés (cadres, formulaires, données, liens externes), Gardés par vous.
3. **Encart d’information** (`info-soft`) : « 155 scripts ne sont pas copiés (140 de la page, 15 de suivi) : la démo n’en a pas besoin, la navigation est rejouée à partir de vos clics. »
4. **Six groupes**, dans cet ordre ; un groupe vide n’apparaît pas :

| Groupe | État affiché | « Garder » |
|---|---|---|
| Scripts de la page | Non copiés : la démo n’en a pas besoin | non |
| Scripts de suivi | Non copiés : ils mesurent l’audience du site | non |
| Cadres intégrés | « 1 vidéo gardée, 3 retirés » | seulement les fournisseurs de la liste blanche en https : YouTube, Vimeo, Loom, OpenStreetMap, Google Maps (iframe sandbox) |
| Formulaires | Affichés, sans envoi | non |
| Données personnelles remplacées | Remplacées par des valeurs fictives | oui, élément par élément ; le texte d’origine est rétabli ; l’écran ne montre que la valeur masquée |
| Liens externes | Désactivés | oui ; le lien gardé ouvre d’abord « Vous quittez la démo » |

Les liens vers une autre page de la même démo ne figurent pas ici : ils sont reliés automatiquement (zones cliquables du Sandbox), rien à faire.

5. Note : « Le serveur applique les mêmes règles à l’envoi. »
6. Barre fixe : « Supprimer la capture » (secondaire, danger), « Envoyer » (primaire prune).

### 2.2 Carte d’un groupe et liste

Colonnes fixes (ALIGN-01, SPLIT-01), identiques pour l’en-tête du groupe et chaque ligne : icône 36 px · nom et source (le reste) · statut 88 px · « Pourquoi ? » 104 px · action 96 px calée à droite. Écart de 12 px.
- En-tête du groupe : titre, état, nombre (aligné sur la colonne statut), « Pourquoi ? » (déplie l’explication, `info-soft`), « Voir » / « Masquer ».
- Liste : recherche « Filtrer par nom ou par source » en pleine largeur au-dessus (40 px, une ligne) ; une ligne par élément ; 20 à la fois avec « Afficher 20 de plus » ; liste virtualisée (1 800 éléments).
- Statuts : « Non copié », « Retiré », « Remplacé », « Désactivé » (gris) ; « Gardé » (warning, icône Check).
- **« Pourquoi ? » est présent sur chaque ligne et chaque groupe.** Quand l’élément ne peut pas être gardé, la colonne d’action reste vide : rien ne bouge d’une ligne à l’autre.
- Noms : fichier en monospace (`app.bundle.js`), autre élément en texte (« Vidéo YouTube », « E-mail · « j***@a***.fr » »). Le dev fournit la sous-raison de chaque élément (`classify(élément) → raison`) ; elle sert de libellé de la ligne et de texte du « Pourquoi ? ».
- À 390 px : ligne 1 icône · nom · statut (96 px) ; ligne 2 « Pourquoi ? » à gauche, action de 96 px à droite.

### 2.3 Garder

- **Données personnelles** : « Garder » direct, réversible par « Retirer » ; pas de fenêtre (l’écran ne montre jamais la valeur réelle).
- **Liens externes** : fenêtre « Garder ce lien externe ? » : « « Conditions générales » mène à legal.example.com. Dans la démo, le visiteur verra d’abord « Vous quittez la démo » et choisira de continuer ou non. » Boutons « Annuler », « Garder le lien ».
- **Cadres de la liste blanche** : « Garder » direct. Les autres cadres n’ont pas de bouton.
- Scripts et formulaires : jamais de « Garder ».
- « Tout garder » n’existe plus.

### 2.4 Après l’envoi

Si le serveur retire un élément gardé (il renvoie ses compteurs), un bandeau warning en tête de l’écran de fin d’envoi : « Démo envoyée. 1 élément gardé a été retiré par le serveur. » puis la raison par élément (« Cadre « Widget de discussion » (widget.example.com) : fournisseur non autorisé. »), et « Ouvrir la démo ». Annoncé (`role="status"`).

## 3. Aperçu : zones cliquables

### 3.1 Illumination

Dans l’aperçu, un bouton à bascule « Zones cliquables » (icône MousePointerClick, compteur) en bas, à côté de Précédent et Suivant. Raccourci : touche H. Activé, chaque zone cliquable est entourée d’un cadre bleu de 2 px (rayon 8 px), rempli bleu à 16 % (`--blue` #2F6FED en clair, #7FA8FF en sombre), avec une pastille numérotée en haut à gauche. Au clavier, Tab parcourt les zones dans l’ordre des pastilles. Désactivé par défaut ; mémorisé par personne. L’état actif est annoncé (`aria-pressed`).

Les zones s’illuminent aussi 1,2 s au moment d’un clic à côté (aide au bon endroit).

Placement dans le lecteur (validé sur 8c24679) : le lecteur garde sa propre barre de progression. La bascule, en pilule de 36 px, se place sur la ligne sous la page : à droite du titre de l’étape et avant « Suivant » en démo guidée ; à droite de « Pages clés vues » en Sandbox. La barre « Précédent / Zones / Suivant » de la maquette d’aperçu ne vaut que pour l’aperçu de l’éditeur.

### 3.2 Clic à côté d’une zone

Le message « Cette partie n’est pas disponible dans la démo » est supprimé. À la place, un message au pied de la capture : titre « Aucun lien à cet endroit », phrase « Cette étape a 3 zones cliquables. », bouton « Voir les zones » qui active l’illumination. Il disparaît après 5 secondes ou au clic suivant, et il est annoncé (`role="status"`).

### 3.3 Étape sans zone

Si l’étape n’a aucune zone : le compteur affiche 0, la bascule est désactivée, et un encart explique « Aucune zone cliquable sur cette étape. Les visiteurs ne peuvent que passer à l’étape suivante. » avec « Ajouter une zone » (dans l’éditeur) et « Continuer sans zone ».

### 3.3 bis Lecteur public

La bascule « Zones cliquables » (et la touche H) et le message « Aucun lien à cet endroit » valent aussi dans le lecteur public. L’encart « Aucune zone cliquable » et « Ajouter une zone » n’y apparaissent pas : la bascule affiche 0, désactivée, et seul « Suivant » reste.

### 3.4 À 390 px

Capture centrée en colonne, pastilles de 20 px, contrôles sur deux lignes si besoin ; l’infobulle de la bascule devient un texte court sous le bouton.

## À venir (même document)

- **4. Vidéo et masquage** : catégorie « Vidéo » (badge, filtre Type, création en deux étapes) ; « Masquer en direct : Oui / Non » ; revue après enregistrement avec démasquage ; suivi du défilement à toute vitesse ; masque qui ne couvre pas un panneau ouvert au-dessus ; « Pourquoi masqué ? » par zone ; faux positif « Assistant IA ».
- **5. Captures** : étude de l’option à chaque clic (page, zone, élément).
- **6. Idées de l’éditeur de référence, à adapter** : fenêtre modale image + texte, flou personnalisable, spotlight libre, bloc Voix off dans le panneau de 320 px (réponse au dev sur « Voix » et « Sous-titres » du §18.2).
- **7. Corrections** : œil afficher/masquer et règles de mot de passe en direct, menu ⋯ et fenêtre « Supprimer ce formulaire ? » de l’étape Formulaire.
