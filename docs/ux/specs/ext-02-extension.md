# EXT-02 · Extension : popup, vérification, aperçu

Statut : lot 1 (popup, vérification après capture, aperçu) révisé le 23/11 après le retour du client : deux variantes du popup à choisir. Les points 4 (vidéo et masquage), 6 (idées de l’éditeur de référence, voix off) et 7 (mot de passe, étape Formulaire) suivent, voir « À venir ». Maquettes : `maquettes/refonte/ext02/` (index, captures clair/sombre ; popup en 360 px, variantes `popup-a-*` et `popup-b-*` ; écrans pleins à 1440 et 390 px). Données fictives (acme, example.com). Icônes Lucide, aucun emoji, aucun dégradé, aucune barre de couleur sur un bord.

Principe : le popup ne montre que ce qu’il faut pour lancer une capture, avec nos composants (COMP-01 : listes, lignes de réglage ALIGN-01, listes déroulantes, interrupteurs, bouton primaire prune). On ne reprend pas la forme de l’éditeur de référence : il a seulement servi à exprimer le besoin (moins de texte, mieux rangé). Le popup ne propose que ce que l’extension fait vraiment.

## 1. Popup de l’extension (révision du 23/11, deux variantes)

Contraintes communes :
- largeur 360 px, hauteur au plus 600 px (limite de Chrome) ; en-tête et pied fixes, le corps défile seulement si besoin ;
- **en-tête (NAV-04, PAGE-01)** : logo compact à gauche ; à droite, « ? » (aide dans un nouvel onglet) et ⋯ (Ouvrir TutoClick, Réglages de l’extension, Se déconnecter). Hauteur 56 px, filet dessous ;
- **types réels** : Captures, HTML guidée, Sandbox, Vidéo, et Format mobile en **Bientôt** (grisé, jamais masqué, `aria-disabled="true"`, pastille « Bientôt ») ;
- **titre de la démo** (champ, exemple en indication) et **espace** restent dans le popup ;
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

## 2. Vérification après capture, avant l’envoi

But : la personne comprend ce qui a été retiré ou remplacé, et garde la main. Les chiffres bruts (« 155 scripts retirés », « 1 800 ») ne s’affichent plus seuls.

### 2.1 Structure (page pleine, pas dans le shell)

1. En-tête : logo, titre « Vérifier avant l’envoi », une phrase.
2. **Bilan** : quatre cases : Éléments modifiés, Retirés ou remplacés, Gardés par vous, Étapes. Les nombres s’actualisent quand on garde ou retire.
3. **Groupes par raison**, une carte chacun, dans cet ordre : Scripts retirés, Cadres intégrés retirés, Données personnelles remplacées, Liens et formulaires désactivés. Un groupe vide n’apparaît pas.
4. Note : « Le serveur applique en plus ses propres contrôles à l’envoi. Un élément gardé reste soumis à ces contrôles. » (reprend la note serveur actuelle)
5. Barre fixe : « Supprimer la capture » (secondaire, danger), « Envoyer » (primaire).

### 2.2 Carte d’un groupe

Icône, titre, état en dessous (« Retirés », « Remplacées par des valeurs fictives », « Navigation désactivée »), **nombre** à droite, « Pourquoi ? » et « Voir ». « Pourquoi ? » déplie un encart d’explication en langage simple (fond `info-soft`, icône Info), sans quitter la page. « Voir » déplie la liste.

Liste d’un groupe, en **colonnes fixes** (ALIGN-01, SPLIT-01), les mêmes pour l’en-tête du groupe et pour chaque ligne : icône 36 px · nom et source (le reste) · statut 88 px · « Pourquoi ? » 104 px · action 96 px calée à droite. Écart de 12 px entre colonnes.
- au-dessus de la liste, la recherche « Filtrer par nom ou par source » en pleine largeur (40 px, sur une ligne) ;
- une ligne par élément : nom (monospace, coupé par « … »), source (domaine ou « dans la page »), statut « Retiré » ou « Gardé » (warning) dans une pastille de largeur fixe, « Pourquoi ? », puis « Garder » ou « Retirer » dans un bouton de 96 px ;
- l’en-tête du groupe aligne son nombre sur la colonne statut, et « Pourquoi ? » et « Voir » sur les deux dernières colonnes ;
- 20 lignes à la fois ; pied de liste : « 5 sur 155 », « Tout garder » (avec confirmation et le nombre), « Afficher 20 de plus » ; la liste est virtualisée (1 800 éléments sans ralentir).
- À 390 px : première ligne icône · nom · statut (96 px) ; deuxième ligne « Pourquoi ? » à gauche et l’action de 96 px à droite.

### 2.3 Garder

« Garder » est possible pour chaque élément, avec ces règles :
- **Scripts et cadres intégrés** : une fenêtre de confirmation dit ce que cela permet (« pourra s’exécuter dans la démo et lire ce que voit l’apprenant ») et propose « Annuler » / « Garder ce script ».
- **Données personnelles** : confirmation qui montre la valeur masquée (jamais la valeur réelle) et le risque. Aucune donnée réelle dans l’écran ni dans les captures de documentation.
- **Liens et formulaires** : « Garder » ne s’applique qu’aux liens vers une autre page de la démo. Un lien qui quitte la démo ne peut pas être gardé : le bouton est remplacé par « Navigation désactivée » avec un « Pourquoi ? ».
- Un élément gardé passe en jaune (« Gardé »), le bilan monte d’un, « Retirer » le remet.
- Le serveur garde ses contrôles : un élément gardé reste filtré s’il est refusé côté serveur, et un message le dit après l’envoi (point à fixer avec le dev, voir 2.5).

### 2.4 À 390 px

Bilan sur deux colonnes. Colonnes comme en 2.2. Barre fixe : les deux boutons sur une ligne, à largeur égale.

### 2.5 Avec le dev (point A : le filtre bloque la navigation)

Aujourd’hui le filtre neutralise tous les liens. Règle proposée : un lien vers une autre page capturée de la même démo est conservé et devient une zone cliquable (voir 3) ; tout autre lien est neutralisé et listé dans « Liens et formulaires désactivés ». À confirmer par le dev : comment le serveur répond à un élément gardé, et si le nombre de groupes est fixe (4).

## 3. Aperçu : zones cliquables

### 3.1 Illumination

Dans l’aperçu, un bouton à bascule « Zones cliquables » (icône MousePointerClick, compteur) en bas, à côté de Précédent et Suivant. Raccourci : touche H. Activé, chaque zone cliquable est entourée d’un cadre bleu de 2 px (rayon 8 px), rempli bleu à 16 % (`--blue` #2F6FED en clair, #7FA8FF en sombre), avec une pastille numérotée en haut à gauche. Au clavier, Tab parcourt les zones dans l’ordre des pastilles. Désactivé par défaut ; mémorisé par personne. L’état actif est annoncé (`aria-pressed`).

Les zones apparaissent aussi 1,2 s à l’arrivée sur une étape si la personne a cliqué à côté (aide au bon endroit).

### 3.2 Clic à côté d’une zone

Le message « Cette partie n’est pas disponible dans la démo » est supprimé. À la place, un message au pied de la capture : titre « Aucun lien à cet endroit », phrase « Cette étape a 3 zones cliquables. », bouton « Voir les zones » qui active l’illumination. Il disparaît après 5 secondes ou au clic suivant, et il est annoncé (`role="status"`).

### 3.3 Étape sans zone

Si l’étape n’a aucune zone : le compteur affiche 0, la bascule est désactivée, et un encart explique « Aucune zone cliquable sur cette étape. Les visiteurs ne peuvent que passer à l’étape suivante. » avec « Ajouter une zone » (dans l’éditeur) et « Continuer sans zone ». Dans le lecteur public, l’encart n’apparaît pas : seul Suivant reste.

### 3.4 À 390 px

Capture centrée en colonne, pastilles de 20 px, contrôles sur deux lignes si besoin ; l’infobulle de la bascule devient un texte court sous le bouton.

## À venir (même document)

- **4. Vidéo et masquage** : catégorie « Vidéo » (badge, filtre Type, création en deux étapes) ; « Masquer en direct : Oui / Non » ; revue après enregistrement avec démasquage ; suivi du défilement à toute vitesse ; masque qui ne couvre pas un panneau ouvert au-dessus ; « Pourquoi masqué ? » par zone ; faux positif « Assistant IA ».
- **5. Captures** : étude de l’option à chaque clic (page, zone, élément).
- **6. Idées de l’éditeur de référence, à adapter** : fenêtre modale image + texte, flou personnalisable, spotlight libre, bloc Voix off dans le panneau de 320 px (réponse au dev sur « Voix » et « Sous-titres » du §18.2).
- **7. Corrections** : œil afficher/masquer et règles de mot de passe en direct, menu ⋯ et fenêtre « Supprimer ce formulaire ? » de l’étape Formulaire.
