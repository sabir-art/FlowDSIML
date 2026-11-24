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
2. **Titre et type**, sur une ligne à 1 440 (colonne sous 768) :
   - « Titre de la démo », champ obligatoire, prérempli « Capture du {date} » (ex. « Capture du 23 nov. 2026 »), modifiable ; vide à l’envoi : « Donnez un titre à la démo. » sous le champ, bord danger, focus rendu ;
   - « Type » : segmenté COMP-01 « Démo guidée » / « Sandbox », prérempli depuis le popup, modifiable ici. Si la capture complète un Sandbox existant (« Ajouter des pages » depuis l’app), le champ Titre disparaît (la démo existe) et le segmenté est remplacé par une ligne « Pages ajoutées au Sandbox « {nom} » » (icône Box), sans choix.
3. **Bilan** : Pages copiées, Scripts non copiés, Protégés (cadres, formulaires, données, liens externes), Gardés par vous.
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

4 bis. **Pages copiées** (entre l’encart et les groupes, repliée par défaut ; dépliée d’office si une page est trop lourde) : une ligne par page, colonnes vignette 64 × 40 (copie inerte) · numéro, titre, adresse et poids · statut (« Prête », ou « Trop lourde » en warning ; état du groupe « Prêtes à l’envoi » quand aucune n’est lourde, sinon « 1 page trop lourde ») · « Pourquoi ? » · « Retirer » (96 px). Retirer une page la sort de la démo et des compteurs ; annulable par la notification. Limite du serveur : 10 Mo par page. Une page trop lourde non retirée n’est pas envoyée ; son « Pourquoi ? » le dit : « « Agenda » pèse 12,4 Mo, au-delà des 10 Mo permis par page : elle ne sera pas envoyée. Retirez-la, ou recapturez-la avec moins de contenu affiché. »

Compteurs des groupes : calculés sur toutes les pages (un script présent sur 6 pages compte 6 fois) ; la colonne « source » de chaque ligne donne la page d’origine. « Pourquoi ? » d’une ligne déplie le même encart info sous la ligne. « Gardés par vous » compte données + liens + cadres gardés. L’encart sur les scripts disparaît s’il n’y en a aucun. La barre fixe reste en bas à toutes les largeurs. Les cadres de la liste blanche n’ont pas de « Garder » tant que le serveur et le lecteur ne les acceptent pas : ils restent « Retirés » avec leur « Pourquoi ? ».

5. Note : « Le serveur applique les mêmes règles à l’envoi. »
6. Barre fixe : « Supprimer la capture » (secondaire, danger), « Envoyer » (primaire prune).

### 2.2 Carte d’un groupe et liste

Colonnes fixes (ALIGN-01, SPLIT-01), identiques pour l’en-tête du groupe et chaque ligne : icône 36 px · nom et source (le reste) · statut 88 px · « Pourquoi ? » 104 px · action 96 px calée à droite. Écart de 12 px.
- En-tête du groupe : titre, état, nombre (aligné sur la colonne statut), « Pourquoi ? » (déplie l’explication, `info-soft`), « Voir » / « Masquer ».
- Liste : recherche « Filtrer par nom ou par source » en pleine largeur au-dessus (40 px, une ligne) ; une ligne par élément ; 20 à la fois avec « Afficher 20 de plus » ; liste virtualisée (1 800 éléments).
- Statuts : « Non copié », « Retiré », « Remplacé », « Désactivé » (gris) ; « Gardé » (warning, icône Check).
- **« Pourquoi ? » est présent sur chaque ligne et chaque groupe.** Quand l’élément ne peut pas être gardé, la colonne d’action reste vide : rien ne bouge d’une ligne à l’autre.
- Valeurs masquées au format de la vérification des captures, type devant : « E-mail · j••••@••••.fr ».
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

En Sandbox (pas d’étape suivante) : titre « Aucune zone cliquable sur cette page », texte « Aucun lien ne part de cette page : les visiteurs ne peuvent pas aller plus loin. Ajoutez une zone pour relier un élément de la page à une autre page. ». « Ajouter une zone » ferme l’aperçu sur l’étape, panneau Étape ouvert, avec la notification « Sélectionnez un élément de la page, puis « Lier à une étape ». » ; « Continuer sans zone » referme l’encart pour cette étape.

### 3.3 bis Lecteur public

La bascule « Zones cliquables » (et la touche H) et le message « Aucun lien à cet endroit » valent aussi dans le lecteur public. L’encart « Aucune zone cliquable » et « Ajouter une zone » n’y apparaissent pas : la bascule affiche 0, désactivée, et seul « Suivant » reste.

### 3.4 À 390 px

Capture centrée en colonne, pastilles de 20 px, contrôles sur deux lignes si besoin ; l’infobulle de la bascule devient un texte court sous le bouton.

## 4. Vidéo : catégorie et masquage

Maquettes : `video-revue-*`, `video-pourquoi-*`, `video-demasque-*`, `video-sans-*` (clair, sombre, 1440, 390) ; popup : variantes A et B, état « vidéo ».

### 4.1 Catégorie « Vidéo »
Même traitement que Captures, HTML et Sandbox (L48-G) : badge de type « Vidéo » (icône Video) sur la carte et la ligne de liste ; valeur « Vidéo » dans le filtre Type ; carte « Vidéo » dans l’étape 1 de « Nouvelle démo » (création en deux étapes), avec en étape 2 « Enregistrer avec l’extension » ou « Importer une vidéo » (zone large §18.1, MP4 ou WebM, 50 Mo au plus).

### 4.1 bis Nouvelle démo, étape 2 Vidéo (maquettes `lot2-demos/nouvelle-video[-envoi|-format|-lourd|-long|-quota]-*`)
- Fenêtre « Nouvelle démo vidéo », « Étape 2 sur 2 · Source ». En haut, la carte « Enregistrer avec l’extension » (« Lancez l’enregistrement depuis l’extension : la vidéo s’ouvre ensuite pour vérification, puis dans l’éditeur. ») ; un séparateur « ou » ; la zone large §18.1 « Importer une vidéo » : « Déposez le fichier ici ou choisissez-le. MP4 ou WebM, 50 Mo et 10 min au plus. », bouton « Choisir une vidéo… » ; « Dossier » ; pied « Retour » et « Annuler ».
- Envoi : nom du fichier, « Envoi… 42 % · 21 sur 48 Mo », barre de progression de 6 px (déterminée), « Arrêter l’envoi » dans la zone (et non « Annuler », qui est déjà le bouton du pied).
- Erreurs dans la zone (bord danger, `role="alert"`, bouton dessous) : format « « presentation.mov » n’est pas accepté. Choisissez une vidéo MP4 ou WebM. » ; poids « « atelier-complet.mp4 » pèse 212 Mo. La limite est de 50 Mo : raccourcissez ou découpez la vidéo. » ; durée « « reunion.webm » dure 24 min. La limite est de 10 min : découpez-la en plusieurs démos. » (bouton « Choisir une autre vidéo ») ; quota « Le stockage de l’espace est plein (5 sur 5 Go). Supprimez des vidéos ou demandez plus d’espace à la DSI. » (bouton « Voir l’utilisation »).
- Décision du chef : MP4 et WebM, 50 Mo, 10 min. Envoi avec reprise : si la connexion coupe, la zone affiche « Envoi interrompu · 42 % » avec la barre figée et « Reprendre » (reprise automatique au retour du réseau) ; fermer la fenêtre pendant l’envoi demande « Arrêter l’envoi ? ».
- Validé sur 337b782 : quota avec les vrais chiffres de l’espace (« Le stockage de l’espace est plein (500 Mo sur 500 Mo). ») ; fichier illisible (« « x.mp4 » ne peut pas être lu. Choisissez une vidéo MP4 ou WebM. ») et échec serveur (« « x.mp4 » n’a pas été importé. L’envoi a échoué. Réessayez. »), avec « Choisir une autre vidéo » (icône Upload) ; confirmation « Arrêter l’envoi ? » / « La vidéo ne sera pas importée. » avec « Continuer » et « Arrêter » (danger) ; « Dossier » désactivé pendant l’envoi ; type Vidéo disponible même si les captures HTML sont désactivées ; carte de l’extension selon §18.4.
- Après l’envoi : la démo est créée dans le dossier choisi, titre = nom du fichier sans extension, une seule étape vidéo ; l’éditeur s’ouvre dessus avec la notification « Démo vidéo créée ». Pas d’écran « Vérifier la vidéo » pour un import (aucun masque proposé) ; les masques se posent dans l’éditeur (outil Flou).

### 4.2 Masquer en direct : un choix, désactivé par défaut (décision du chef, voie A)
Dans le popup (type Vidéo) : interrupteur « Masquer en direct », **désactivé par défaut**, mémorisé ; aide dans le flux : « Floute les données pendant l’enregistrement. Ces masques ne pourront plus être retirés. Désactivé, vous décidez de chaque zone avant l’envoi. »
- Désactivé : l’image brute reste dans le navigateur ; les données sont repérées et proposées masquées à la revue ; les masques sont incrustés à l’envoi. Aucune donnée non masquée ne quitte le poste.
- Activé : masques posés pendant l’enregistrement (utile quand on partage son écran) ; ils sont définitifs.

### 4.3 Rendu du masque (validé sur a4b809d)
Masque porté par le contenu de la page : il défile avec elle à toute vitesse et passe sous un panneau ouvert par-dessus. Un élément entier : flou de 8 px. Une portion de texte (un nom dans une phrase) : aplat gris neutre #8f8f8f, texte transparent. Aucune couleur de marque. Un mot d’interface suivi d’un sigle (« Assistant IA », « Export PDF ») n’est pas un nom.

### 4.4 Revue après l’enregistrement « Vérifier la vidéo »
Maquettes : `video-revue-*`, `video-pourquoi-*`, `video-demasque-*` (direct désactivé), `video-direct-*` (direct activé), `video-prepa-*` (préparation avant l’envoi).
- En-tête de 56 px, titre, phrase. Direct désactivé : « TutoClick a repéré 5 données et les masque. Vérifiez chaque zone : démasquez une erreur, masquez un oubli. Les masques sont appliqués à l’envoi, rien ne part sans eux. » Direct activé : « Les données repérées ont été masquées pendant l’enregistrement : ces masques sont définitifs. Vous pouvez en ajouter avant l’envoi. »
- Deux colonnes (SPLIT-01) : lecteur à gauche (`minmax(0,1fr)`), liste de 440 px à droite ; une colonne sous 1 024 px de contenu.
- Lecteur : la vidéo avec les masques ; la zone choisie est entourée d’un pointillé primary de 2 px ; chronologie des passages (gris : masqué ; pointillé warning : non masqué), tête de lecture primary, « 0:07 / 1:02 ».
- Liste « Zones masquées » (compteur, « Ajouter un masque ») : une ligne par zone, type et valeur masquée (« Nom · « J*** D*** » ») avec le passage · statut 100 px · action 96 px · « Pourquoi masqué ? » dessous, qui déplie la raison de la détection.
  - Direct désactivé : statut « Masqué » / « Non masqué » (warning), action « Démasquer » / « Masquer ».
  - Direct activé : statut « En direct », pas d’action (colonne vide) ; le « Pourquoi masqué ? » ajoute « Masqué pendant l’enregistrement : ce masque ne peut plus être retiré. »
- Cliquer une ligne amène la lecture au passage ; glisser sur l’image crée un masque (flèches, Maj + flèches, Suppr).
- Masque ajouté à la main (validé sur 504299d) : ligne « Masque ajouté 1 », statut « Masqué », action « Retirer ». Zone fixe sur l’image (elle ne suit pas le défilement : le dire dans son « Pourquoi masqué ? » : « Masque ajouté par vous, à cet endroit de l’image. »). Durée par défaut : 5 s à partir de l’instant affiché ; deux poignées sur son segment de la chronologie règlent le début et la fin (au clavier : segment choisi, ← → déplacent la fin d’une seconde, Maj + ← → le début).
- Ligne démasquée : son « Pourquoi masqué ? » finit par « Vous l’avez démasqué : cette donnée sera visible dans la démo. « Masquer » la couvre de nouveau. »
- Aucune donnée repérée : « Aucune donnée personnelle n’a été repérée. Regardez la vidéo : vous pouvez masquer un oubli avant l’envoi. » ; liste « Aucune zone pour l’instant. ».
- Chevauchements : les segments de deux données se superposent sur une seule rangée de la chronologie.
- Pendant la préparation et l’envoi, « Supprimer l’enregistrement » disparaît de la barre. À 390, les deux boutons de la barre sont l’un sous l’autre, en pleine largeur.
- Barre fixe : « Supprimer l’enregistrement » (danger), « Envoyer ». À l’envoi avec des masques à incruster : la barre affiche « Préparation de la vidéo… 40 % » et une barre de 6 px (`role="status"`), « Envoyer » désactivé, puis « Envoi… ». Ne pas fermer l’onglet : l’avertissement du navigateur s’affiche si on tente de le fermer.
- À 390 : lecteur puis liste ; « Ajouter un masque » en pleine largeur.

## 6. Idées de l’éditeur de référence, à notre façon

Maquettes : `lecteur-fenetre-*`, `lecteur-projecteur-*` (lecteur, 1440 et 390) ; `popup-voix-{generer,enregistrer,importer}-*`, `popup-flou-*`, `popup-projecteur-*` (panneaux de 320 px de l’éditeur).

### 6.1 Fenêtre image + texte (type d’étape « Fenêtre »)
Dans le lecteur, fenêtre centrée sur la capture voilée (noir à 45 %), 680 px au plus, rayon 16 : image à gauche (280 px, ou en haut sous 640 px), à droite « Étape 2 sur 6 », titre 22 px, texte, puis « Échap pour fermer », « Précédent » (secondaire) et « Suivant » (primaire). Focus piégé, Échap ferme, `role="dialog"` avec titre. Dans l’éditeur : choix « Fenêtre » parmi les types d’étape ; panneau Étape avec image (zone §18.2), titre, texte, libellé du bouton.

Précisions (réponses au dev, 24/11) :
- **Échap** ferme la fenêtre : la capture n’est plus voilée, et une pilule « Rouvrir la fenêtre » (icône AppWindow, 36 px) apparaît sur la ligne sous la page, à gauche de « Suivant » ; « Suivant » reste disponible. Le texte du pied reste « Échap pour fermer ».
- **Éditeur** : entrée « Fenêtre » (icône AppWindow) dans le menu « Ajouter une étape » ; dans le panneau Étape, le segmenté « Affichage » a trois valeurs : Écran, Pop-up, Fenêtre. Pour Fenêtre : « Image » en zone étroite §18.2 (PNG, JPEG ou WebP, 5 Mo au plus ; puis vignette, « Remplacer… » et « Retirer » dans ⋯), « Texte alternatif » (facultatif ; vide = image décorative, `alt=""`, avec l’aide « Laissez vide si l’image est décorative. »), « Titre », « Texte », « Libellé du bouton » (« Suivant » par défaut).
- **Sans image** : pas de colonne image ni de fond teinté ; la fenêtre fait 480 px au plus, texte sur toute la largeur. (L’icône sur fond teinté de la maquette tient lieu d’image d’exemple.)
- **Image** : cadrée en « cover » dans la colonne de 280 px (hauteur 240 px au moins, celle du texte au-delà), centrée ; en mobile, 160 px de haut au-dessus du texte.
- **Première étape sans capture** : fond uni comme la pop-up actuelle (couleur de fond du thème de la démo), pas de voile.
- **Pied** (recette e68c0b8) : les boutons restent sur une ligne, calés à droite, « Suivant » en dernier. Sous 640 px : pas de « Échap pour fermer », « Précédent » et « Suivant » à largeur égale. Colonne étroite au-dessus de 640 px (canevas de l’éditeur) : « Échap pour fermer » passe sous les boutons, en 12 px. La pilule « Rouvrir la fenêtre » se place dans la barre du lecteur, à gauche de « Suivant ».
- Validé : section « Question à choix » masquée pour une fenêtre ; une fenêtre en dernière étape n’est pas un écran de fin (« Suivant » termine la démo) ; « Titre » et « Texte » sont les champs du haut du panneau ; libellé d’affichage « Plein écran / Pop-up / Fenêtre ».

### 6.2 Flou stylé
Panneau « Flou » : Forme (Rectangle, Arrondi, Ellipse), Effet (Flou, Pixels, Aplat), Intensité (2 à 24 px, curseur avec valeur), Teinte (Aucune, Gris, Encre, Prune, Bleu, Blanc ; à 30 % par-dessus) et « Appliquer à toutes les étapes ». Aide : « Le texte masqué n’est jamais lisible, quelle que soit la teinte. » (intensité minimale garantie côté rendu).

Précisions (réponses au dev, 24/11) :
- Ordre du panneau : Forme, Effet, Intensité, Teinte ; pour Aplat, Couleur (3 pastilles, couleur détectée, hexadécimal) et Texte sur l’aplat à la place d’Intensité et Teinte (masquées, pas grisées) ; Position (X, Y, largeur, hauteur) ; interrupteur « Appliquer à toutes les étapes » (remplace les deux boutons radio) ; info « incrusté à la publication ». « Supprimer la zone » reste en icône dans l’en-tête de section.
- Pixels : Intensité = taille des pavés (2 à 24 px), même libellé.
- Intensité par défaut 12 px pour une nouvelle zone. Une zone existante garde son rendu et le panneau affiche sa valeur réelle (environ 6 px), jamais une valeur qui ne correspond pas au rendu.
- La réduction d’image avant le flou est toujours appliquée : le curseur règle la douceur, pas la lisibilité.
- Teintes (couleurs de la capture, identiques en thème sombre) : Aucune, Gris #8f8f8f, Encre #1a1f26, Prune #a3195b, Bleu #2f6fed, Blanc #ffffff, à 30 % par-dessus Flou et Pixels.
- Arrondi : rayon de 12 px à l’échelle de la capture (1 280 px de large) ; Ellipse inscrite dans le rectangle ; poignées toujours sur le rectangle, aperçu du canevas selon la forme.
- Avant / Après : même panneau pour les zones de la capture « Avant ».
- **Recette 2a1cb69 (conforme, clair et sombre, 1440)** : aide sous Effet conservée (une phrase par effet) ; Forme, Effet et Teinte sont des groupes radio (`radiogroup`), les flèches déplacent le choix et le focus, un seul arrêt de tabulation par groupe ; pastille choisie : anneau intérieur de 2 px `primary` (#a3195b clair, #cf86a9 sombre), contour de focus en plus au clavier ; les flèches du curseur ne changent plus d’étape. Éditeur réservé à l’ordinateur : à 390 px, l’écran « L’éditeur s’utilise sur ordinateur », pas de panneau à recetter.

### 6.3 Projecteur libre (aujourd’hui « Bientôt »)
Panneau « Projecteur » : interrupteur « Projecteur libre », taille du halo (120 à 400 px), assombrissement (20 à 80 %), « Désactivé si le visiteur préfère moins d’animations ». Dans le lecteur : halo net autour du pointeur, bord adouci de 12 px, reste assombri ; au clavier et au toucher, le halo se place sur l’élément de l’étape. C’est le seul dégradé permis, parce qu’il est la fonction elle-même. Tant qu’il n’est pas livré, l’entrée reste « Bientôt », grise, jamais masquée.

Précisions (réponses au dev, 24/11) :
- **Entrée** : un outil du rail de l’éditeur, groupe « Écran », après Zoom, icône Flashlight, libellé « Projecteur ». Il ouvre le panneau de 320 px.
- **Portée** : un réglage pour toute la démo, sans « Appliquer à toutes les étapes ».
- **Étapes concernées** : les étapes capture (image) seulement. Pas de projecteur sur Avant / Après (le curseur de comparaison suit déjà le pointeur), ni sur les étapes HTML, vidéo ou texte. Le texte d’aide du panneau le dit : « Sur les étapes capture. »
- **Superposition** : la pastille et la bulle restent au-dessus du voile. Projecteur libre activé : le style « Spotlight » des hotspots est ignoré, et le panneau du hotspot l’annonce sous le choix du style (info, 13 px) : « Ignoré tant que le projecteur libre est activé. »
- **Clavier, toucher et avant le premier mouvement du pointeur** : halo centré sur le premier hotspot de l’étape, à la taille réglée. Étape sans hotspot : pas de voile.
- **Pointeur hors de la capture** : le halo revient sur l’élément de l’étape (sans hotspot, le voile disparaît). Transition de 200 ms, aucune avec la préférence moins d’animations.
- **Moins d’animations** : interrupteur « Halo fixe si le visiteur préfère moins d’animations », activé par défaut. Nom accessible identique au libellé visible. Avec la préférence : le voile reste, le halo est fixe sur l’élément de l’étape, sans suivi ni transition. Interrupteur éteint : le halo suit le pointeur même avec la préférence.
- **Taille** : en px à l’échelle d’une capture de 1 280 px de large, le halo rétrécit avec la capture, au moins 64 px à l’écran. Défauts : 220 px et 55 %.
- **Panneau de 320 px** : un libellé long passe sur deux lignes, l’interrupteur reste à droite, centré verticalement (maquette `popup-projecteur-*` mise à jour).
- **Bouton du visiteur** : dans la barre du lecteur, bouton icône 36 px (44 px au toucher), Flashlight, nom « Projecteur », `aria-pressed`, à gauche du bouton des sous-titres. Il n’existe que si le projecteur est activé. Le choix du visiteur vaut pour la session de lecture.
- **Aperçu dans l’éditeur** : quand l’outil Projecteur est ouvert, halo fixe sur le premier hotspot de l’étape affichée, avec la taille et l’assombrissement réglés. Outil fermé : pas de voile dans le canevas. Le suivi du pointeur se voit dans « Aperçu ».
- **Recette a55e0ea (conforme, clair et sombre, éditeur 1440, lecteur 1280 et 390)**. Bouton de la barre du lecteur à 40 px (44 au toucher), comme ses voisins de la pilule : validé, il remplace les 36 px. Un hotspot au style Spotlight retrouve son rendu quand le visiteur coupe le projecteur. Deux retouches : l’aide garde la virgule de la maquette (« sur la capture, le reste est assombri »), sans « ; » ; l’outil Projecteur n’a pas de raccourci Alt + chiffre, les raccourcis existants ne bougent pas (Recadrage et Image gardent les leurs).

### 6.4 Voix off dans le panneau de 320 px (réponse au §18.2 « Voix » et « Sous-titres »)
Maquettes : `popup-voix-{generer,enregistrer,ecoute,importer,place}-*`, lecteur `lecteur-voix-*`.
- **Sans voix** : segmenté « Générer », « Enregistrer », « Importer ».
  - Générer : « Texte lu (sert aussi de transcription) », compteur ; « Voix » seule (la langue est celle de la démo, rappelée dessous ; pas de choix par étape) ; « Aperçu » ; « Régénérer » et « Utiliser ». États repris de l’existant, dans le panneau : Assistance IA désactivée pour l’espace (segment « Générer » grisé avec « Désactivé par l’espace »), quota atteint (message et date de remise à zéro), génération en cours (barre indéterminée de 6 px).
  - Enregistrer : bouton rond d’arrêt (danger), onde, durée, « Pause » en icône à droite ; temps annoncé toutes les 30 s. Aide « Votre micro. 2 minutes au plus. » (le nom du micro n’est connu qu’après l’autorisation) ; bouton au repos « Démarrer l’enregistrement » (Mic, primary) ; lecteur « Écouter » / « Pause ». Après l’arrêt : « Écoutez avant de garder », lecteur, « Recommencer » et « Garder ».
  - Importer : zone étroite §18.2.
- **Voix en place** : la carte « Voix enregistrée » (ou « générée · Claire », « importée ») avec la durée seule (pas de date, validé sur d72480e), lecteur et « Remplacer… » (rouvre le segmenté) ; menu ⋯ avec « Télécharger » et « Supprimer la voix » (danger, avec confirmation). Dessous, « Transcription (obligatoire pour publier) » pour une voix enregistrée ou importée ; pour une voix générée, le texte lu tient lieu de transcription.
- **Pour toute la démo** (titre de section) : « Lecture automatique » ; « Sous-titres affichés » (état par défaut ; le visiteur garde son bouton et la touche C, la transcription reste toujours disponible) ; « Lecteur audio » : « Bulle » (par défaut) ou « Barre du lecteur » (les boutons actuels « Activer le son » et « Écouter »). Pas d’option « Masqué ».
- Encart info permanent sur le blocage du son avant le premier clic.
- **Lecteur, option Bulle** : sous le texte de la bulle, une ligne de 36 px sur fond gris clair : lecture / pause de 28 px (primary), onde, temps, bouton sous-titres (`aria-pressed`). Au clavier : Espace sur le bouton, touche C pour les sous-titres. Bouton Sous-titres enfoncé : fond #e3e6eb, icône primary, sans trait. Sur mobile, ligne de 44 px et boutons de 36 px. Dans une carte de texte large, la ligne garde 320 px, centrée. Étape sans bulle ni carte : boutons de voix dans la barre du lecteur (validé sur f0dfad3).

## À venir

- **5. Captures** : étude ci-dessous (§5), à valider par le client avant maquette.

## 5. Choisir ce qu’on capture à chaque clic (étude du 24/11)

Besoin du client : à chaque clic, pouvoir garder la page, une zone ou seulement l’élément cliqué, pour des captures plus lisibles et moins de données à l’écran.

Ce que fait l’extension aujourd’hui : à chaque clic, une capture de la partie visible de l’onglet (plus la page entière en Format mobile). Elle relève déjà le rectangle de l’élément cliqué (`element`), la taille de la fenêtre et la position du clic. L’éditeur sait déjà recadrer sans rien perdre (L25-02, `crop` relatif à l’image d’origine, hotspots et flous suivent le cadre).

Principe retenu : **on capture toujours toute la partie visible, et le choix devient un recadrage non destructif posé par l’extension**. La personne peut élargir ou resserrer plus tard avec l’outil Recadrage ; la vérification avant envoi porte sur l’image entière ; l’image publiée ne montre que le cadre, donc moins de données exposées.

Options étudiées :
1. **Demander à chaque clic** (petite fenêtre Page / Zone / Élément) : écarté, cela casse le geste et double le nombre de clics.
2. **Un choix dans le popup avant de démarrer** : simple, mais on ne peut plus changer en cours de route, alors qu’un même parcours mélange souvent des vues d’ensemble et des détails.
3. **Un sélecteur dans la barre d’enregistrement, valable pour les clics suivants** : retenu. On change quand on veut, sans interrompre.

Proposition :
- **Barre d’enregistrement** : segmenté de trois icônes avec nom et infobulle : « Page » (Monitor, par défaut), « Élément » (SquareMousePointer), « Zone » (Crop). Le choix vaut pour les clics suivants et reste affiché ; il est annoncé à l’écran (« Cadre : élément »). Pas de raccourci clavier ajouté (Chrome limite les raccourcis déclarés, les trois existants restent).
- **Page** : comportement actuel, pas de recadrage.
- **Élément** : cadre = rectangle de l’élément cliqué, plus une marge de 48 px, élargi au minimum à 480 × 300 px (rapport conservé autour de l’élément), borné à l’image. Si l’élément couvre plus de 80 % de la vue, pas de recadrage (inutile).
- **Zone** : en choisissant « Zone », un voile s’affiche sur la page et on trace un rectangle (souris ; au clavier, flèches pour déplacer, Maj + flèches pour redimensionner, Entrée pour valider, Échap pour annuler). La zone est gardée pour tous les clics suivants, relative à la fenêtre ; « Redessiner la zone » dans la barre. Un clic hors de la zone garde la page entière pour cette étape et le signale à la vérification (« Clic hors de la zone : page entière gardée »).
- **Vérification avant envoi (§2)** : chaque capture porte une petite pastille de cadre (Page, Élément, Zone) et le cadre se change pour une capture donnée avant l’envoi (même segmenté), puisque l’image entière est gardée.
- **Popup** : rien de plus (il reste minimal). Le cadre par défaut se règle dans « Réglages de l’extension » (Page par défaut).
- **Éditeur et lecteur** : rien de nouveau ; l’étape arrive avec son recadrage, modifiable par l’outil Recadrage ; le lecteur affiche le cadre agrandi à la largeur disponible.

Hors périmètre : la capture d’un élément qui dépasse de la vue (il faudrait défiler et assembler) ; la vidéo (§4) garde l’onglet entier.

Maquettes (24/11, valeurs par défaut retenues en attendant le client : 48 px, 480 × 300, réglage par personne) : `cadre-element-*`, `cadre-trace-*`, `cadre-zone-*` (1440, clair et sombre : la page capturée garde ses couleurs, la barre est celle de l’extension) et `verification-cadre-*` (1440 et 390).
- **Barre** : même pilule que la barre vidéo (#141311, 999 px de rayon, centrée en bas, déplaçable) : point rouge immobile, « Capture · n », filet, segmenté « Page / Élément / Zone » (`role="radiogroup"`, nom « Cadre des prochaines captures », choix sur fond blanc), « Redessiner » en mode Zone, « Terminer ». Elle remplace la pastille « ● REC » actuelle, qui ne reçoit pas les clics. **La barre et les repères sont masqués pendant la prise de vue** (aucune trace dans l’image) ; les clics sur la barre ne créent pas d’étape.
- **Élément** : au survol, un cadre pointillé primary de 2 px montre ce qui sera gardé, avec l’étiquette « Cadre gardé · élément » dans le coin ; le changement de cadre est annoncé (« Cadre des prochaines captures : élément »).
- **Zone, tracé** : voile à 50 % hors de la zone, contour blanc de 2 px, 8 poignées de 12 px, taille en px sous l’angle bas droit, encart sombre au-dessus de la barre « Tracez la zone à garder », « Annuler » et « Valider la zone ». Au clavier : la zone est un élément focalisable (`role="application"`, nom qui donne la taille et les touches).
- **Zone gardée** : contour pointillé primary et étiquette « Cadre gardé · zone » tant que le mode Zone est actif.
- **Vérification** : section « Captures · n » : numéro, vignette avec le cadre en primary, titre de l’étape, nature du cadre (« Page entière », « Élément cliqué et sa marge », « Zone tracée ») ou l’info « Clic hors de la zone : page entière gardée. », segmenté du cadre à droite (icônes seules à 390, nom accessible conservé).

Questions pour le client : la marge et la taille minimale de l’élément conviennent-elles ? Le cadre par défaut doit-il être réglable par l’espace (règle de l’administrateur) ou seulement par la personne ?

## 7. Mot de passe et étape Formulaire

Maquettes : `mdp-saisie-*` et `mdp-erreur-*` (clair, sombre, 1440, 390). Écrans concernés : Inscription, Nouveau mot de passe, Profil (avec « Mot de passe actuel »). Règles réelles (politique choisie par le client, 772acab), dans cet ordre : « Au moins 8 caractères », « Au moins une minuscule », « Au moins une majuscule », « Au moins un chiffre », « Au moins un caractère spécial (par ex. ! ? # @) ». Toujours une seule colonne, à toutes les largeurs (ordre de lecture identique pour tous, rien à aligner) ; annonce « 3 règles sur 5 respectées ». Écrans réels (validés sur e53476d) : « Nouveau mot de passe » garde la mise en page d’authentification et son bouton « Mettre à jour le mot de passe » ; au Profil, « Nouveau mot de passe » et « Confirmer le mot de passe » ont chacun leur ligne de réglage ; « Mot de passe actuel » (décision du chef) : affiché au Profil seulement si le compte a déjà un mot de passe, en premier, avec son œil ; sinon la section s’intitule « Définir un mot de passe » et n’a que le nouveau mot de passe et sa confirmation.

### 7.1 Œil afficher / masquer
Bouton intégré au champ (FIELD-01 §11.3), 32 px, icône 16 px en `currentColor`, à droite. Masqué : Eye ; affiché : EyeOff. Nom accessible fixe « Afficher le mot de passe » + `aria-pressed`. Un œil par champ, indépendant. Le clic garde le focus et le curseur ; à l’envoi, tous les champs repassent en masqué.

### 7.2 Règles en direct
Liste sous le champ, visible dès le focus, une ligne par règle du serveur, 13 px, écart 4 px, icône 16 px. Non respectée : Circle, `text-muted`. Respectée : CircleCheck `success`, texte `text`. Après un envoi refusé : CircleX `danger`. `aria-describedby` du champ vers la liste ; texte masqué « respectée » / « non respectée » par ligne ; région polie « 2 règles sur 3 respectées », 1 s après la dernière frappe, seulement si le nombre change. Confirmation : règle unique « Les deux mots de passe sont identiques ».

### 7.3 Force
Jauge à 4 segments (maquette auth) entre le champ et la liste, libellé à droite (12 px, 600) : Faible (1, danger), Moyen (2, warning), Bon (3, success), Fort (4, success). Indicative : le bouton d’envoi n’est jamais désactivé pour la force. La jauge apparaît au premier caractère (vide, elle ne dit rien). Tant qu’une règle de la politique manque, elle s’arrête à « Faible » : elle ne dit jamais « Moyen » d’un mot de passe que le serveur refuse.

### 7.4 Erreurs du serveur
Sous le champ : CircleAlert 16 px `danger` et une phrase d’action. « Utilisez au moins {n} caractères. », « Ajoutez au moins un chiffre. », « Ajoutez au moins une majuscule. », « Ajoutez au moins un caractère spécial (par ex. ! ? # @). », « Ce mot de passe est trop courant. Choisissez-en un autre. », « Les deux mots de passe ne sont pas identiques. », « Le mot de passe actuel est incorrect. », « Choisissez un mot de passe différent de l’actuel. » Plusieurs règles : la longueur a sa phrase, les caractères manquants sont regroupés (« Utilisez au moins 8 caractères. Ajoutez au moins une lettre et un chiffre. »). Bord `danger`, `aria-invalid`, focus sur le premier champ en erreur. Le message « 8 caractères minimum » seul est supprimé.

### 7.5 Étape « Formulaire » de l’éditeur
- Menu ⋯ avec les seules entrées qui ont un sens (un formulaire par démo) et les mêmes libellés que les autres étapes : Modifier, Monter, Descendre, séparateur, Supprimer (danger).
- Fenêtre MODAL-01 : « Supprimer ce formulaire ? » ; corps « Le formulaire et ses {n} champs sont retirés de la démo. Les réponses déjà reçues restent dans Leads. » (si les réponses sont supprimées : « Les {n} réponses déjà reçues sont aussi supprimées. ») ; puis « Vous pourrez annuler juste après, depuis la notification. » (annulation par la notification de 6 s ; Ctrl + Z ne la fait pas) ; « son champ » au singulier. Boutons « Annuler » (focus par défaut) et « Supprimer le formulaire » (danger).
