# Retours client du 24/11 : image, bulle, médiathèque, invitations, pastilles de type

Priorité : avant le point 4 de l'état des lieux (`etat-des-lieux-2026-11-24.md`).
Maquettes : `maquettes/refonte/retours-2411/` (index, captures en clair et en sombre ; 1440 px, et 390 px pour les écrans hors éditeur). Données fictives uniquement.

## 1. Panneau Image de l'éditeur : capture et images ajoutées

Aujourd'hui le panneau ne porte que « Remplacer l'image ». Il devient le lieu des images de l'étape : la capture et les images posées par-dessus (calques).
Maquettes : `image-calque-*` (une image sélectionnée) et `image-vide-*` (aucune image ajoutée).

### 1.1 Panneau (320 px), dans cet ordre
- **Capture de l'étape** : vignette 56 × 36, nom du fichier et taille (« 1 280 × 800 »), bouton « Remplacer… ». Ce bouton ouvre un menu avec trois entrées :
  - « Importer… » ;
  - « Choisir dans la médiathèque » (sélecteur §3.3) ;
  - « Recadrer », qui ouvre l'outil Recadrage.
- **Images ajoutées · n**, avec le bouton « Ajouter » à droite. Ce bouton ouvre un menu : « Importer… » ou « Choisir dans la médiathèque ».
  - **Liste** : une rangée de 44 px par image, du dessus vers le dessous. Elle contient une vignette de 32 × 24, le nom (texte alternatif court ou nom du fichier), l'œil « Masquer » / « Afficher » (`aria-pressed`) et ⋯. Le menu ⋯ propose Monter, Descendre, Dupliquer et Supprimer.
  - **Sélection** : cliquer sur une rangée sélectionne l'image dans le canevas, et inversement. La rangée choisie a un contour primary.
  - **Vide** : encart PanelEmpty, « Ajoutez un logo, une flèche ou une illustration par-dessus la capture. Elle se déplace et se redimensionne sur le canevas. », suivi du bouton « Ajouter une image ».
- **Réglages de l'image choisie** (titre : son nom ; « Supprimer l'image » en icône Trash2 dans l'en-tête de section, comme le Flou) :
  - **Position et taille** : Gauche, Haut, Largeur, Hauteur en %, même composant que la zone de flou (RectFields).
  - **Conserver les proportions** : interrupteur, activé par défaut.
  - **Opacité** : curseur de 10 à 100 %, par pas de 5, libellé « Opacité · 100 % ».
  - **Coins** : segmenté Droits / Arrondis. Arrondis vaut 12 px à l'échelle de la capture (1 280 px de large), comme le flou.
  - **Ombre** : interrupteur, désactivé par défaut (ombre `shadow-md`).
  - **Texte alternatif** : champ obligatoire. Il est remplacé par la case « Image décorative (le lecteur d'écran l'ignore) » si l'image n'apporte pas d'information. Tant que ni l'un ni l'autre n'est rempli, la publication le signale dans la liste de vérification, comme une étape sans texte.
  - **Appliquer à toutes les étapes** : interrupteur, même comportement que le flou (copie suivie sur les étapes capture).
  - **Aide** (info 12 px) : « Glissez sur le canevas pour déplacer ; poignées pour redimensionner ; flèches du clavier (Maj pour aller plus vite) ; Suppr pour retirer. »

### 1.2 Canevas
- Les images ajoutées passent au-dessus de la capture, mais sous les flous, les hotspots, la bulle et le projecteur. **Les flous masquent donc aussi une image ajoutée**, aucune donnée ne peut réapparaître par ce biais.
- Image choisie : contour primary de 2 px et 8 poignées de 12 px, comme le tracé de zone.
- Souris : glisser pour déplacer, poignées pour redimensionner. Les proportions sont gardées si l'interrupteur est activé ; Maj inverse ce réglage le temps du geste.
- Clavier, quand l'image a le focus :
  - flèches : 1 % ;
  - Maj + flèches : 10 % ;
  - Alt + flèches : redimensionne ;
  - Suppr : retire l'image, avec un toast « Image retirée » et « Annuler » ;
  - Échap : désélectionne.
- Quand l'outil Image est ouvert, déposer un fichier sur la capture ajoute l'image au centre, à 30 % de la largeur. Le texte sous le canevas l'indique : « Déposez une image sur la capture pour l'ajouter. ».
- Limites : PNG, JPEG, WebP ou SVG, 5 Mo au plus (règles de la médiathèque, le SVG est nettoyé) ; 10 images par étape. Au-delà, « Ajouter » est désactivé et l'aide dit pourquoi.
- Toute image importée ici entre aussi dans la médiathèque, catégorie Image (§3.2).

### 1.3 Lecteur et publication
- Les images sont rendues par-dessus la capture, à leurs positions relatives au cadre (après recadrage). Elles sont incrustées à la publication comme les flous, et l'ordre de lecture pour un lecteur d'écran suit la liste.
- Sur mobile, elles suivent la mise à l'échelle de la capture.

## 2. Bulle : « Afficher « Précédent » »

Comportement actuel (vérifié dans le code) : l'option vaut pour l'étape en cours, et le bouton n'apparaît pas à l'étape 1 (il n'y a pas d'étape avant). C'est sans doute ce qu'a vu le client en cochant l'option sur l'étape 1.
- **Espacement** : la ligne est collée au filet du dessus. Mettre 16 px entre le filet et la ligne, comme pour toutes les lignes de réglage (ALIGN-01).
- **Aide** sous l'interrupteur, 12 px, text-muted : « Bouton à gauche de « Suivant », dans la bulle de cette étape. ».
- **Étape 1** : l'interrupteur est désactivé (`aria-disabled`, gris, jamais masqué), avec l'aide « Pas d'étape avant celle-ci : le bouton apparaît à partir de l'étape 2. ».
- **Aperçu** : dès que l'option est activée, le bouton est montré dans la bulle du canevas (c'est déjà le cas à partir de l'étape 2, à garder).
- **Toutes les étapes** : sous l'interrupteur, le lien « Afficher sur toutes les étapes » applique l'option aux étapes 2 et suivantes. Il passe par le dialogue « Appliquer le style » existant, avec la confirmation « Option appliquée à n étapes. ».
- Si le dev trouve un vrai défaut (bouton absent même à l'étape 2 dans le lecteur), il le corrige avant ces retouches.

## 3. Médiathèque : un seul parcours

Maquettes : `media-page-*`, `media-menu-*`, `media-import-*` et `media-choisir-*` (1440 et 390, clair et sombre).

### 3.1 Points d'accès
- **Navigation principale** : une nouvelle entrée « Médiathèque » (icône Images), entre « Parcours de formation » et « Analytics ». Elle mène à la page `/media`, qui gère les fichiers de l'espace.
- **Partout où l'on choisit un fichier**, la même fenêtre de sélection (§3.3) s'ouvre par « Choisir dans la médiathèque » :
  - logo de la démo (panneau Design) ;
  - logo de l'espace et de la marque (Paramètres › Marque) ;
  - logo du centre de formation ;
  - image de fond (Design) ;
  - « Remplacer… » de la capture d'une étape ;
  - images ajoutées (§1) ;
  - police (Design, catégorie Polices).

  Le bouton « Médiathèque » seul, qui ouvrait la gestion sans pouvoir rien appliquer, disparaît de ces endroits.
- La photo de profil n'est pas concernée : elle est personnelle.

### 3.2 Catégorie déduite à l'import, modifiable ensuite
- **WOFF2** : Police.
- **SVG**, ou **PNG / WebP avec transparence et à peu près carré** (rapport entre 1:2 et 2:1, côté de 1 024 px au plus) : Logo.
- **Sinon** : Image.
- **Import depuis un filtre** (Logos, Images) : la catégorie du filtre l'emporte. Depuis « Tout », elle est déduite, il n'y a plus de fichier non classé.
- **Après l'import** : un toast le dit, « « logo-acme-blanc.png » importé dans Logos » avec la raison (« Fond transparent et format carré : rangé avec les logos. ») et un bouton « Changer », qui ouvre le menu de la carte sur « Catégorie ».
- **Menu ⋯ d'une carte** : Renommer ; Catégorie (Logo / Image, `menuitemradio` ; une police reste une police) ; Télécharger ; « Voir les démos qui l'utilisent » ; Supprimer (avec la confirmation existante qui annonce les emplacements vidés).
- **Fichiers existants sans catégorie** : à la migration, ils reçoivent la catégorie déduite.

### 3.3 Fenêtre de sélection (mode « choisir »)
- **Titre** selon l'appel : « Choisir un logo », « Choisir une image », « Choisir une police ». Sous-titre : la destination (« Logo de la démo « Démo CRM » »).
- **Zone d'import réduite en tête** : « Importer un nouveau logo » et ses formats. Le fichier importé est choisi d'office, c'est-à-dire sélectionné et prêt pour « Utiliser ».
- **Recherche, et filtres réglés sur la catégorie demandée.** Ils restent modifiables, mais un logo ne peut pas recevoir une police : les catégories incompatibles sont désactivées.
- **Grille de cartes à choix unique** (`radiogroup`) : rond radio en haut à gauche, carte choisie avec un contour primary de 2 px. Le double-clic utilise directement.
- **Pied** : « Double-clic pour utiliser directement. » (masqué à 390), « Annuler » et le bouton primaire « Utiliser ce logo », ou « Utiliser cette image », « Utiliser cette police ». Ce bouton reste désactivé tant que rien n'est choisi.
- **À 390** : la fenêtre passe en plein écran, la grille sur 2 colonnes.

### 3.4 Page `/media`
- **PageHeader** : « Médiathèque ».
- **Zone d'import de 120 px** (COMP-01 §18.1), avec « Glissez des fichiers ici » et l'aide « La catégorie est déduite, vous pouvez la changer. ».
- **Barre** : recherche, filtres Tout / Logos / Images / Polices avec leurs compteurs, quota « 18 Mo sur 500 Mo » à droite.
- **Grille de cartes** : aperçu de 112 px, nom, « Catégorie · Utilisé dans n démos » ou « Non utilisé », ⋯.
- **Médiathèque vide** : seulement la zone, avec « Importer votre premier fichier » (règle 02c49d5).
- **Rôle lecteur** : consultation seule, sans import ni ⋯.

## 4. « Invitations envoyées »
Maquette : `invitations-*`.
- **Rangée par adresse** : l'adresse en gras, et « Invitation envoyée » à droite (CircleCheck, success).
- **Champ de lien dessous**, en lecture seule, 40 px, sur surface-sunken, police de l'interface, coupé par « … » s'il est trop long. Il garde un libellé masqué, « Lien d'invitation pour {adresse} ».
- **Copie** : bouton icône Copy de 32 px, **dans le champ, à droite**, nom « Copier le lien de {adresse} ». Il remplace le bouton « Copier le lien ».
  - Après la copie : l'icône devient Check (success) pendant 2 s, et « Lien copié » est annoncé (`role="status"`, 12 px sous le champ).
  - Le clic dans le champ sélectionne tout le lien.
- **Composant** : CopyField (FIELD-01 §11.3, bouton intégré). Il est réutilisable ailleurs, mais rien d'autre ne change dans ce lot.

## 5. Pastilles de type sur les cartes Démos
Maquette : `pastilles-*`.
- **Forme** : hauteur 24 px, rayon 12 px, icône 16 px, libellé 12 px en 600, bordure de 1 px.
- **Couleurs**, fond / texte et icône / bordure :

| Type | Icône | Clair | Sombre | Contraste |
|---|---|---|---|---|
| Captures | Images | prune-50 #fbf0f5 / prune-700 #85164b / prune-100 | prune-950 #2a0c1a / prune-300 #cf86a9 / prune-900 | 8,5 et 6,6 |
| Vidéo | Video | bleu-50 #edf6fc / bleu-700 #1e6a95 / bleu-100 | #0e2231 / bleu-300 #7abfe5 / bleu-800 | 5,4 et 8,1 |
| HTML guidée | Code | vert-50 #f5f9e8 / vert-700 #557014 / vert-100 | #1c2409 / vert-300 #aed054 / vert-800 | 5,3 et 9,2 |
| Sandbox | Box | orange-50 #fff6e8 / #8f5300 / orange-100 | #2b1a03 / orange-300 #f8bb61 / orange-800 | 5,8 et 9,8 |

- **Jetons** : à ajouter en `--fd-type-{captures,video,html,sandbox}-{bg,fg,border}`, clair et sombre, dans tokens.ts.
- **Couleurs sémantiques** : elles restent réservées aux statuts (success pour « Publiée », info pour les messages). Les pastilles de type ne s'en servent pas, d'où leurs jetons à part, même si les teintes de base sont proches.
- **Où** : cartes de la grille et colonne Type de la vue liste. La liste déroulante du filtre Type n'est pas concernée.
- **Sur la vignette**, la pastille garde son fond opaque, pour rester lisible sur n'importe quelle capture.

## 6. Paramètres : les rubriques « Bientôt » deviennent actives

Maquettes : `maquettes/refonte/lot1-parametres/` (`page-publique-*`, `cles-*`, `notifs-*`, en 1440 et 390, clair et sombre). Le libellé « Bientôt » disparaît de la navigation des Paramètres pour ces trois rubriques.

### 6.1 Marque › Page publique : le catalogue public de l'espace
- **En-tête** : « Voir la page » (ExternalLink, nouvel onglet), « Annuler », « Enregistrer ».
- **Page publique** :
  - interrupteur ; désactivée, l'adresse affiche « Cette page n'est pas disponible » (l'écran L19b-05) ;
  - **Adresse** : préfixe `tutoclick.example/c/`, lettres minuscules, chiffres et tirets, avec la copie dans le champ (CopyField, §4).
- **En-tête de la page** :
  - **Logo** : par défaut celui de l'espace, sinon « Choisir dans la médiathèque » (sélecteur §3.3) ;
  - **Titre** ;
  - **Phrase d'accueil** : facultative, compteur sur 160 caractères.
- **Démos affichées** :
  - radios « Toutes les démos publiées » (une démo publiée apparaît d'elle-même) ou « Démos choisies » ;
  - avec « Démos choisies », la liste des démos publiées : poignée, case, nom, pastille de type (§5), flèches Monter / Descendre ;
  - sous la liste : « 3 démos affichées, dans cet ordre. Glissez la poignée ou utilisez les flèches. »
- **Pied** :
  - **Lien de contact** : facultatif, e-mail ou https ;
  - **Afficher « Fait avec TutoClick »** : interrupteur, activé par défaut.
- **Moteur** : c'est le catalogue de démos déjà servi par le lecteur (`/c/{adresse}`, type « Catalogue de démos » du centre). Cette page en est le réglage, pas un deuxième catalogue.

### 6.2 Connexions › Clés d'accès
- **Qui** : propriétaires et administrateurs ; la rubrique est masquée pour les autres rôles.
- **Phrase d'en-tête** : « Pour relier un outil de l'espace à TutoClick (API). Chaque clé donne les droits d'un administrateur : gardez-la comme un mot de passe. »
- **Tableau** :
  - **Nom**, avec « par {auteur} » dessous ;
  - **Clé** : `tc_` puis des points et les 4 derniers caractères, jamais la clé entière ;
  - **Créée** ;
  - **Dernière utilisation** : « il y a 2 h », « Jamais utilisée », ou la pastille « Révoquée ».
  - Le menu ⋯ propose Renommer et Révoquer.
- **Liste vide** : « Aucune clé », avec le texte de la maquette et « Créer une clé ».
- **Créer une clé** : fenêtre avec Nom (obligatoire) et Expiration (Jamais, 30 jours, 90 jours, 1 an ; 90 jours par défaut).
- **Après la création** : fenêtre « Clé « {nom} » créée ».
  - Encart d'avertissement : « Copiez-la maintenant : elle ne sera plus jamais affichée. »
  - La clé entière s'affiche dans un CopyField. Après la copie, Check et « Clé copiée ».
  - Case « J'ai copié la clé et l'ai rangée en lieu sûr ». « Terminé » reste désactivé tant qu'elle n'est pas cochée.
  - Fermer la fenêtre (Échap, croix) demande la même case.
- **Révoquer** : `alertdialog` « Révoquer « {nom} » ? » : « L'outil qui utilise cette clé perdra l'accès tout de suite. Cette action est définitive. », bouton danger « Révoquer la clé ».
- **Côté serveur** : seul un condensé de la clé est stocké, elle ne peut pas être réaffichée. Chaque appel met à jour « Dernière utilisation ».

### 6.3 Mon compte › Notifications
- Les deux interrupteurs « Bientôt » du Profil partent ici.
- **Tableau par événement**, avec les colonnes « Dans l'app » et « Par e-mail » :
  - Mentions ;
  - Réponses ;
  - Commentaires sur mes démos ;
  - Commentaires résolus ;
  - Alertes d'Analytics ;
  - Nouveaux leads.

  Chaque ligne a un titre et une phrase d'aide ; à 390, l'aide est masquée et les deux colonnes restent.
- **Lien entre les colonnes** : un événement coupé dans l'app ne part pas par e-mail. Son interrupteur e-mail est alors désactivé, gris.
- **Aide sous le tableau** : « E-mail : un résumé au plus par heure, qui regroupe vos notifications non lues. Lien de désinscription dans chaque e-mail. »
- **Sans la clé d'envoi d'e-mails** (emails §3.5) : la colonne « Par e-mail » reste visible, désactivée, avec « Bientôt » dans son en-tête. On ne la masque pas.
- **Démos coupées** : la liste des démos dont la personne a coupé les notifications, avec « Réactiver ».

## 7. Fenêtre « Nouvelle démo »

Maquette : `lot2-demos/nouvelle-source-*`.
- **« Partir d'une démo vide »** : il quitte le pied, où il ressemblait à un texte désactivé, et devient la **dernière ligne de la liste des sources**, comme les autres choix :
  - icône FilePlus2, « Partir d'une démo vide », « Une démo sans étape, à remplir dans l'éditeur. » et un chevron ;
  - même survol, même focus et même clic que les autres lignes.
- **Pied** : il ne garde que « Retour » et « Annuler », ou « Créer la démo » quand des images sont choisies (§18.3).
- **Tuile « + » de l'en-tête** : elle devient décorative.
  - `aria-hidden`, sans bordure, sur fond prune-50 (prune-950 en sombre), icône prune ;
  - aucun survol, curseur normal ;
  - même tuile pour toutes les fenêtres à tuile (MODAL-01).

## 8. Partage : « Sur invitation » et « Par domaine e-mail »

- **Écrans** : ceux du propriétaire et du visiteur sont déjà spécifiés et maquettés (L11, `specs/l11-partage-securise.md`) :
  - côté propriétaire : `reference/partage-securise.html?etat=invitation|modale|domaine`, à reprendre dans la page Partager actuelle (cartes radio de l'onglet Accès) ;
  - côté visiteur : `refonte/l11-acces-visiteur.html?view=invitation|envoye|domaine|lien-perime`.
- **Ajouté ici, l'e-mail reçu** (maquette `retours-2411/email-acces-*`) :
  - de « {Espace} via TutoClick », objet « Votre lien d'accès à « {démo} » » ;
  - logo et nom de l'espace en tête, titre, phrase (« Ce lien vous est personnel : ne le transférez pas. »), bouton « Ouvrir la démo » ;
  - validité « Le lien est valable 1 heure et ne sert qu'une fois. » : **la durée affichée doit être celle du serveur** ;
  - « Vous n'avez rien demandé ? Ignorez cet e-mail… » ;
  - pied « Envoyé par TutoClick pour {Espace}… » ;
  - 600 px, une colonne, sans pixel de suivi, mode sombre (charte des e-mails).
- **Activation** : la clé d’envoi (Brevo) et l’adresse d’expéditeur sont déjà configurées en production avec la fonction `access-email` (précision du chef, 24/11). Les deux modes passent donc de « Bientôt » à actifs, sans attente côté client.

## 9. Prise en main terminée

Maquette : `lot2-demos/onb-fin-*`, variante B en place dans l'app.
- **Bouton de l'en-tête** : « Prise en main 7/7 », anneau plein.
- **Panneau** :
  - barre pleine ;
  - carte de succès (fond success-soft, tuile CircleCheck) : « Prise en main terminée », « Les 7 étapes sont faites. Votre espace est prêt : bonne création ! » ;
  - bouton « Masquer la prise en main », et dessous « Vous la retrouverez dans le Centre d'aide. » ;
  - « Terminées · 7 », dépliée, avec la liste cochée.
- **Après « Masquer »** : le bouton quitte l'en-tête, et l'entrée « Prise en main » reste dans le Centre d'aide.
- **Défaut transmis par le chef** : « Inviter » doit se cocher dès qu'une invitation est envoyée. Une invitation en attente suffit, sans attendre qu'elle soit acceptée.

## 10. Déclaration d'accessibilité : projet personnel en développement (réponse du client, 24/11)

Le client développe TutoClick seul, sans entreprise ni organisme. La page `/legal/accessibility` (et sa copie statique `legal/accessibilite.html`) est réécrite pour ce cas, **sans aucune donnée personnelle** : pas de nom, pas d'adresse, pas d'e-mail.
- **Retirer** :
  - l'encart « en attente de validation par la personne référente accessibilité » ;
  - tous les champs entre crochets ;
  - le schéma pluriannuel et le plan d'action ;
  - la phrase d'engagement qui cite l'article 47 de la loi de 2005 (elle vise les organismes) ;
  - la section « Voies de recours ».
- **Introduction** : « TutoClick est un projet personnel, en cours de développement. Il suit le référentiel général d'amélioration de l'accessibilité (RGAA 4.1) comme référence. »
- **État de conformité** : inchangé, **non conforme** (aucun audit complet), et aucun taux publié. Le lien du pied reste « Accessibilité : non conforme ».
- **Vérifications réalisées, Contenus non accessibles, Technologies, Outils, Pages vérifiées** : inchangés.
- **Établissement de la déclaration** : « Cette déclaration a été établie le 24 novembre 2026. »
- **Retour d'information** (pas de nom, pas d'adresse) :
  - avec un compte : « Signalez un défaut d'accessibilité depuis l'aide de l'application : Centre d'aide, article « Accessibilité de TutoClick », puis « Cet article vous a aidé ? » et « Non ». Votre message est lu par l'équipe du projet. » C'est le retour anonyme qui existe déjà (L41), et l'article d'aide est à ajouter avec ce titre ;
  - sans compte, pour un visiteur d'une démo : « Un moyen de contact pour les visiteurs est à venir. »
- **Date de mise à jour de la page** : celle de la réécriture.

## Recette
- **Tests attendus** : `image-calques.e2e` (ajout, déplacement à la souris et au clavier, proportions, opacité, texte alternatif obligatoire, flou au-dessus, incrustation à la publication) ; `media.e2e`, à étendre (navigation, catégorie déduite et changée, sélecteur sur chaque point d'accès, « Utiliser ») ; `members.e2e` (CopyField) ; un contrôle de contraste des pastilles.
- **Conditions** : clair et sombre, 1440 et 390 (hors éditeur), axe sans violation.
