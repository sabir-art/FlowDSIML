# EXT-02 · Extension : popup, vérification, aperçu

Statut : lot 1 (popup, vérification après capture, aperçu) prêt pour recette. Les points 4 (vidéo et masquage), 6 (idées de l’éditeur de référence, voix off) et 7 (mot de passe, étape Formulaire) suivent, voir « À venir ». Maquettes : `maquettes/refonte/ext02/` (index, captures clair/sombre ; popup en 360 px, écrans pleins à 1440 et 390 px). Données fictives (acme, example.com). Icônes Lucide, aucun emoji, aucun dégradé, aucune barre de couleur sur un bord.

Principe : le popup ne montre que ce qu’il faut pour lancer une capture. Toute explication passe dans une infobulle « ? ». Aucune phrase d’aide permanente.

## 1. Popup de l’extension

Largeur 360 px, marge intérieure 16 px, écart vertical 16 px. Jetons du dépôt (surface, bordure, primary). Un seul bouton plein.

### 1.1 Composition, de haut en bas

| Zone | Contenu | Règle |
|---|---|---|
| En-tête | Logo compact (clair ou sombre selon le thème), puis à droite « ? » (Aide) et ⋯ (Plus d’options) | Boutons 32 px, icône 20 px, trait 2,1. « ? » ouvre l’aide de l’extension dans un nouvel onglet. |
| Type de capture | Quatre onglets compacts : **Captures**, **HTML**, **Vidéo**, **Mobile** | Un seul actif. Fond de la barre `surface-sunken`, onglet actif `surface` avec bordure et texte primary. Hauteur 60 px, icône 20 px au-dessus du libellé 13 px/600. |
| Copilote IA | Ligne : icône Sparkles, libellé, « ? », bascule | Bascule 40×24, éteinte par défaut, mémorisée. |
| Dossier | Libellé « Dossier », sélecteur avec icône FolderOpen | Une seule liste : « Espace · Dossier », groupée par espace. Remplace le sélecteur d’espace et le champ Titre. |
| Taille de la page | Libellé + « ? », cinq icônes d’appareil, puis largeur × hauteur | Voir 1.3. Masquée pour Vidéo. |
| Bouton | « Démarrer la capture », 48 px, plein, couleur accent, icône du type | Pleine largeur. Un seul bouton plein dans le popup. |

Ce qui disparaît du popup, et où cela va :
- Titre de la démo : saisi sur l’écran de vérification (valeur par défaut « Capture du {date} »).
- « Suivre les changements d’onglet » : entrée à cocher du menu ⋯.
- « Vérifier les données personnelles » (toujours actif) : plus de ligne. L’explication est dans l’aide « ? » de l’en-tête et le résultat sur l’écran de vérification.
- Phrases sous « Capture HTML », paragraphe sur les scripts, explication du format mobile : supprimés. Le texte utile passe en infobulle.
- Déconnexion et changement d’espace : menu ⋯.

### 1.2 Types de capture

| Onglet | Icône | Comportement |
|---|---|---|
| Captures | MousePointerClick | Une image par clic. |
| HTML | Code | Capture de la page. « Guidée » ou « Bac à sable » se choisit à la vérification, pas ici. |
| Vidéo | Video | Enregistrement. Affiche à la place de la taille : Micro (bascule) et « Masquer en direct » (Oui / Non), voir « À venir ». |
| Mobile | Smartphone | **Bientôt** : onglet grisé, jamais masqué, `aria-disabled="true"`, mention « Bientôt » sous le libellé (12 px). Au survol et au focus : infobulle « Format mobile · Bientôt ». Il ne prend pas le focus de sélection et n’a pas d’action. |

Navigation au clavier : flèches gauche/droite entre les onglets (rôle `tablist`), Tab entre les lignes. Le focus est visible (anneau `--fd-shadow-focus`).

### 1.3 Taille de la page

Cinq boutons radio, icônes Lucide, 40 px de haut, dans l’ordre : Ordinateur (Monitor), Tablette (Tablet), Mobile (Smartphone), Plein écran (Maximize), Personnalisé (SlidersHorizontal). Libellé en `aria-label` et en infobulle.

| Choix | Largeur × hauteur | État |
|---|---|---|
| Ordinateur | 1 440 × 900 | actif |
| Tablette | 1 024 × 768 | actif |
| Mobile | 390 × 844 | **Bientôt** : grisé, `aria-disabled`, infobulle « Mobile · Bientôt » (le navigateur ne peut pas réduire une fenêtre sous environ 500 px ; l’émulation viendra avec le format mobile) |
| Plein écran | « Fenêtre actuelle » | actif, champs en lecture seule |
| Personnalisé | champs modifiables | actif ; bornes 800 à 2 560 (limite actuelle), message d’erreur sous les champs si hors bornes |

Largeur × hauteur : deux champs de 40 px avec « × » entre. Lecture seule (fond `surface-sunken`) sauf pour Personnalisé. Nombres avec espace insécable fine (NUM-01).

### 1.4 États

| État | Ce qu’on voit |
|---|---|
| Repos | Captures sélectionné, Copilote éteint, Dossier « Acme · Aucun dossier », Ordinateur sélectionné. |
| Type sélectionné | HTML : mêmes lignes, bouton avec l’icône Code. Vidéo : taille remplacée par Micro et « Masquer en direct ». |
| Désactivé (Bientôt) | Onglet Mobile et icône Mobile grisés avec infobulle. Le bouton Démarrer reste actif pour les autres choix. |
| Aide ouverte | Infobulle d’une ligne, 224 px de large, fond `text`, ouverte au survol et au focus, fermée par Échap (WCAG 1.4.13). |
| Menu ⋯ | Suivre les changements d’onglet (case à cocher), Changer d’espace…, Ouvrir TutoClick, Se déconnecter. |
| Erreur | Bandeau en haut, sous l’en-tête : icône TriangleAlert, titre en gras, une phrase, lien « Réessayer ». Fond `danger-soft`, bordure `danger`. Bouton Démarrer désactivé (grisé, pas masqué). |

Erreurs à prévoir : page non capturable (chrome://, magasin d’extensions), autorisation refusée, session expirée (bouton « Se connecter »), hors ligne, espace sans droit d’écriture. Chaque erreur dit ce qui s’est passé et ce qu’on peut faire, en une phrase.

Textes des infobulles :
- Copilote IA : « Rédige un titre et une description pour chaque étape. Vous relisez tout avant l’envoi. »
- Taille de la page : « Taille de la fenêtre pendant la capture. Elle fixe le rendu de la démo. »
- Masquer en direct : « Floute les données personnelles pendant l’enregistrement. Vous pourrez les démasquer ensuite. »

Question au dev : le Copilote IA doit exister côté produit. S’il n’est pas prêt, la ligne s’affiche grisée avec « Bientôt », comme Mobile.

### 1.5 Mesures de recette (e2e)

Largeur du popup 360 px ; aucune phrase d’aide visible hors infobulle ; un seul bouton plein ; hauteur du bouton 48 px ; onglet Mobile `aria-disabled="true"` et visible ; contraste des textes grisés au moins 4,5:1 (pour les composants désactivés, la règle des contrôles inactifs s’applique, mais le libellé « Bientôt » reste lisible).

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

Liste d’un groupe :
- recherche « Filtrer… » et « Tout garder » ;
- une ligne par élément : nom (monospace), source (domaine ou « dans la page »), « Pourquoi ? », état (« Retiré » / « Gardé » en warning), bouton « Garder » ou « Retirer » ;
- 20 lignes à la fois, « Afficher 20 de plus » ; compteur « 5 sur 155 » ; la liste est virtualisée (1 800 éléments sans ralentir) ;
- « Tout garder » demande confirmation avec le nombre.

### 2.3 Garder

« Garder » est possible pour chaque élément, avec ces règles :
- **Scripts et cadres intégrés** : une fenêtre de confirmation dit ce que cela permet (« pourra s’exécuter dans la démo et lire ce que voit l’apprenant ») et propose « Annuler » / « Garder ce script ».
- **Données personnelles** : confirmation qui montre la valeur masquée (jamais la valeur réelle) et le risque. Aucune donnée réelle dans l’écran ni dans les captures de documentation.
- **Liens et formulaires** : « Garder » ne s’applique qu’aux liens vers une autre page de la démo. Un lien qui quitte la démo ne peut pas être gardé : le bouton est remplacé par « Navigation désactivée » avec un « Pourquoi ? ».
- Un élément gardé passe en jaune (« Gardé »), le bilan monte d’un, « Retirer » le remet.
- Le serveur garde ses contrôles : un élément gardé reste filtré s’il est refusé côté serveur, et un message le dit après l’envoi (point à fixer avec le dev, voir 2.5).

### 2.4 À 390 px

Bilan sur deux colonnes. Dans une carte, l’icône, le titre et le nombre sur la première ligne, « Pourquoi ? » et « Voir » dessous, décalés de 48 px. Barre fixe : les deux boutons sur une ligne, à largeur égale.

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
