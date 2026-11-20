# Revue d'usage : parcours de formation

> Demande du chef d'équipe : priorité à la formation (DSI des Missions Locales).
> Revue faite le 20 novembre 2026, sur `claude/dev-mvp` (696392b). Elle a été réalisée en local, avec le faux backend des tests e2e et uniquement des données fictives (espace « Acme Formation », domaines `.example`).
> Écrans testés en 1 440 × 900. Le parcours apprenant a été testé en 390 × 844, en mode tactile.

## Périmètre

| # | Parcours | Comment il a été testé |
|---|---|---|
| 1 | Créer une démo de formation depuis une capture | Nouvelle démo > Importer des images (3 captures). L'extension n'est pas testable en local : elle n'a pas été testée. |
| 2 | L'éditer : textes, voix off, quiz | Hotspot et bulle, section Voix off, page Quiz (menu ⋯ > Quiz). L'enregistrement au micro n'a pas été testé. |
| 3 | La publier et la partager à un groupe d'apprenants | Publier, Partager (Lien, Liens personnalisés, Accès), Apprenants > Inviter des apprenants, Centre de formation |
| 4 | Parcours de l'apprenant sur mobile, jusqu'à l'attestation | Lecteur et quiz en 390 px, centre de formation (accueil, formation, formation terminée avec attestation) |
| 5 | Suivi des résultats par le formateur | Apprenants : Tous les apprenants, Par formation, filtres |

Les tests e2e du dev sur ces écrans passent tous (onboarding-import, voix-off, quiz-editor, publish-player, distribute, learners, learners-manage, quiz-player, center, analytics, player-ux). Les frictions ci-dessous concernent l'usage, pas la conformité aux specs.

## Frictions, classées par impact

Impact :
- **Bloquant** : le parcours ne peut pas aller au bout sans contournement ;
- **Fort** : le parcours est long ou source d'erreurs pour un formateur ;
- **Moyen** : il gêne ou ralentit ;
- **Faible** : finition.

### 1. Bloquant : l'apprenant ne reçoit jamais le lien qui mène à l'attestation
- **Écran** : Apprenants > « Inviter des apprenants », puis Partager > Liens personnalisés.
- **Problème** :
  - « Inviter des apprenants » ouvre les liens personnalisés du **premier module** ; le lien copié ouvre cette démo seule ;
  - la progression, la reprise et l'attestation ne s'affichent qu'avec le lien personnel du **centre** (`#/c/<adresse>?l=<jeton>`) ;
  - or l'app ne produit nulle part ce lien : `centerUrl` sert seulement à l'adresse publique, dans Centre de formation ;
  - le centre dit pourtant à l'apprenant : « Ouvrez le centre depuis le lien personnel reçu de votre structure ».
- **Correction** :
  - quand la démo fait partie d'une formation publiée dans le centre, chaque lien personnalisé affiche en premier « Lien du centre (progression et attestation) », avec le bouton « Copier » ;
  - le lien de la démo seule passe en second ;
  - « Inviter des apprenants » mène à ce lien du centre, et l'export CSV des liens le contient.

### 2. Fort : pas d'invitation par lot
- **Écran** : Partager > Liens personnalisés > « Nouveau lien ».
- **Problème** :
  - une modale par apprenant (nom, variables, e-mail) : un groupe de 15 personnes demande 15 modales ;
  - l'invitation par e-mail est en « Bientôt », dans Accès comme dans Centre de formation.
- **Correction** :
  - ajouter « Importer une liste (CSV) » : colonnes prénom, nom, e-mail, avec un modèle à télécharger ;
  - avant de créer les liens, afficher un aperçu avec les erreurs par ligne (e-mail invalide, doublon) ;
  - après la création, proposer « Exporter les liens (CSV) » pour un publipostage depuis la messagerie du formateur. Aucun e-mail n'est envoyé par TutoClick.

### 3. Fort : pas de notion de groupe ou de session
- **Écran** : Apprenants (filtres Formation, Statut, Structure) et création des liens.
- **Problème** :
  - un formateur suit une session, par exemple « Nouveaux agents, session du 12 novembre » ;
  - la seule façon de regrouper des apprenants est la structure, et elle est déduite du domaine de l'e-mail ;
  - le formateur ne peut donc ni filtrer, ni exporter, ni relancer « son » groupe.
- **Correction** :
  - ajouter un champ « Groupe » (texte libre, avec suggestion des groupes existants) à la création d'un lien et à l'import CSV (n° 2) ;
  - ajouter un filtre « Groupe » dans Apprenants, repris dans l'export et dans « Relancer » ;
  - le groupe est modifiable depuis la fiche de l'apprenant.

### 4. Fort : la fin d'un module ne mène nulle part
- **Écran** : lecteur, fin de démo et résultat du quiz (mobile et bureau).
- **Problème** :
  - après un quiz réussi, le seul choix est « Terminer » ; à la fin d'une démo sans quiz, c'est « Recommencer » ;
  - le libellé « Module suivant : {{module}} » existe dans `i18n.ts`, mais n'est pas utilisé ;
  - il n'y a pas de retour au centre : sur mobile, l'apprenant doit revenir en arrière dans le navigateur pour continuer sa formation.
- **Correction** :
  - quand le module est ouvert depuis le centre ou avec un lien d'apprenant, la fin affiche en bouton principal « Module suivant : … » et en secondaire « Retour au centre » ;
  - après le dernier module validé, le bouton devient « Voir mon attestation » et ouvre la page de la formation terminée.

### 5. Fort : on peut publier une démo vide
- **Écran** : éditeur > Publier (modale « Publier en accès public ? »).
- **Problème** :
  - une démo intitulée « Nouvelle démo », avec 3 étapes « Sans titre » sans bulle, se publie sans aucune remarque ;
  - la modale ne contrôle que les données personnelles ;
  - le titre par défaut se retrouve ensuite comme nom de module dans le centre.
- **Correction** :
  - ajouter à la modale un bloc « À compléter », non bloquant : titre par défaut, étapes sans titre, étapes sans bulle, quiz ouvert sans question ;
  - chaque ligne a un lien « Voir » qui ouvre l'étape ;
  - le bouton reste « Publier » : c'est un avertissement, pas un blocage.

### 6. Moyen : le quiz est caché dans le menu ⋯
- **Écran** : éditeur, menu « Plus d'options » > Quiz, puis la page Quiz séparée.
- **Problème** :
  - pour un module de formation, le quiz est la pièce centrale, mais on n'y accède que par le 5e élément d'un menu de débordement ;
  - le rail des étapes n'en dit rien (« Étapes · 3 »), alors que le quiz s'affiche après la dernière étape.
- **Correction** :
  - ajouter au bas du rail des étapes, après la dernière, une entrée « Quiz » : « + Ajouter un quiz », ou « Quiz · 3 questions · seuil 70 % » s'il existe ;
  - l'entrée ouvre la page Quiz. L'élément du menu ⋯ reste.

### 7. Moyen : après la publication, rien sur la formation
- **Écran** : Partager la démo (bandeau « Démo publiée ! »).
- **Problème** :
  - la page suivante parle de site, de LinkedIn, de X et d'aperçu sur les réseaux ;
  - rien n'indique comment ajouter la démo à une formation (Apprenants > Gérer les formations) ni comment la diffuser dans une plateforme de formation (menu ⋯ > Diffuser > SCORM).
- **Correction** :
  - ajouter dans la colonne de droite un bloc « Formation » : « Ajouter à une formation » (choix de la formation et de la position du module), ou « Module 2 de “Logiciel métier” » si c'est déjà fait ;
  - ajouter aussi un lien « Paquet SCORM pour votre plateforme de formation » qui ouvre Diffuser.

### 8. Moyen : après l'import des captures, rien ne guide
- **Écran** : éditeur, juste après « Importer des images ».
- **Problème** :
  - les étapes arrivent « Sans titre », sans point ni bulle ;
  - la consigne n'est pas dans l'onglet Étape : il faut d'abord trouver l'outil Hotspot, dans la barre d'outils sous le canevas, qui n'a que des icônes.
- **Correction** :
  - après un import, ouvrir l'étape 1 avec l'outil Hotspot actif et une ligne d'aide : « Cliquez sur l'écran à l'endroit où l'apprenant doit cliquer, puis écrivez la consigne. » ;
  - une fois la bulle remplie, proposer « Étape suivante sans bulle » ;
  - dans l'onglet Étape, quand il n'y a pas de hotspot, remplacer « Aucun hotspot. Utilisez l'outil “Hotspot”. » par un bouton « Ajouter un hotspot ».

### 9. Moyen : « Cliquez ici » est enregistré comme vrai titre
- **Écran** : éditeur > Hotspot et bulle > Titre.
- **Problème** :
  - à la pose d'un hotspot, le champ Titre est rempli avec « Cliquez ici » : c'est une vraie valeur, pas un texte d'exemple ;
  - les formateurs pressés publient des bulles « Cliquez ici » ;
  - la liste des étapes reste « Sans titre ».
- **Correction** :
  - laisser le champ vide, avec « Cliquez ici » en placeholder ;
  - le titre de l'étape reprend le titre de la bulle tant qu'il n'a pas été saisi ;
  - le contrôle n° 5 signale les bulles vides.

### 10. Moyen : la voix off est loin de la consigne qu'elle lit
- **Écran** : éditeur > onglet Étape > Voix off.
- **Problème** :
  - la section Voix off est la 6e du panneau, après Accessibilité, Zoom et Animation ;
  - quand la bulle est sélectionnée, le panneau passe en « Hotspot et bulle » et la voix off n'est plus visible ;
  - enregistrer 10 étapes demande, pour chacune, de revenir à « Étape » et de faire défiler le panneau.
- **Correction** :
  - montrer la section Voix off juste sous « Texte de la bulle » dans la vue Hotspot et bulle, avec la même piste ;
  - après un enregistrement, proposer « Étape suivante » dans la section, pour enregistrer à la suite.

### 11. Moyen : sur mobile, l'écran capturé est illisible
- **Écran** : lecteur en 390 px, étape sans zoom.
- **Problème** :
  - la capture de 1 100 px est réduite à environ 360 px ;
  - les libellés du logiciel (menus, boutons) font environ 4 px : l'apprenant voit le point, mais ne lit pas ce qu'il doit chercher ;
  - le zoom existe, mais seulement si l'auteur l'a réglé pour chaque étape.
- **Correction** :
  - sous 640 px, quand l'étape n'a pas de zoom, cadrer automatiquement la zone autour du hotspot (agrandie 2 fois), avec un bouton « Voir tout l'écran » ;
  - pas de cadrage avec reduced-motion : pas d'animation, seulement le cadrage fixe.

### 12. Moyen : un échec au quiz s'affiche comme un oubli
- **Écran** : Apprenants > Tous les apprenants.
- **Problème** :
  - la ligne « Camille Exemple » affiche une progression de 100 %, un score de 55 % pour un seuil de 70 % et le statut « À relancer » ;
  - le formateur ne voit pas que la personne a tout suivi mais a échoué au quiz : la relance qu'il enverra (« reprenez votre formation ») ne convient pas.
- **Correction** :
  - ajouter le statut « Quiz non validé », avec les tentatives restantes (« 1 tentative restante », ou « Tentatives épuisées » et l'action « Accorder une tentative ») ;
  - « À relancer » reste réservé à l'inactivité ;
  - la barre de progression n'est pas verte tant que le module n'est pas validé.

### 13. Faible : texte superposé dans « Nouvelle démo »
- **Écran** : modale Nouvelle démo, quand l'Assistance IA est désactivée.
- **Problème** : le lien « Ouvrir le réglage » de la carte « Générer avec l'IA » s'affiche par-dessus la ligne d'aide de l'extension (« … puis cliquez sur l'icône TutoClick… »). Les deux textes sont illisibles.
- **Correction** : placer le lien dans la carte, sous sa description, dans le flux normal, sans positionnement absolu.

### 14. Faible : écran de résultat du quiz sur mobile
- **Écran** : lecteur 390 px, quiz réussi.
- **Problème** :
  - après un score de 100 %, « Repasser le quiz » a le même poids visuel que « Terminer » ;
  - les coupures de ligne tombent mal : « soit 100 » puis « % » à la ligne, et « « » seul en fin de ligne dans « Bravo, vous avez validé « Créer un rendez-vous » ».
- **Correction** :
  - après une réussite, « Repasser le quiz » devient un lien secondaire ;
  - mettre des espaces insécables avant « % » et à l'intérieur des guillemets, dans `i18n.ts`.

### 15. Faible : bouton d'action coupé dans l'en-tête du lecteur mobile
- **Écran** : lecteur 390 px, démo avec un titre long et un bouton d'action dans l'en-tête.
- **Problème** : le bouton (« Réserver une démo » dans le jeu de test) dépasse à droite et son icône est coupée.
- **Correction** :
  - sous 480 px, le bouton passe sous le titre, sur toute la largeur ;
  - ou bien il se réduit à son icône, avec un nom accessible.

## Ce qui fonctionne bien

- **Publication** : le contrôle des données personnelles est clair (deux cases, bilan des images importées non vérifiées).
- **Centre de formation en 390 px** : pas de défilement horizontal. La carte « Ma formation en cours » permet de reprendre en un geste. La formation terminée affiche l'attestation en évidence.
- **Quiz sur mobile** : la question, les réponses et le seuil sont lisibles, et les zones tactiles sont grandes.
- **Apprenants, vue Par formation** : l'entonnoir par module et la phrase sur le plus gros décrochage sont directement utiles au formateur.

## Ordre de traitement proposé

1. Les n° 1 et 4 ensemble : ils forment le chemin de l'apprenant jusqu'à l'attestation.
2. Les n° 2 et 3 ensemble : import CSV et champ Groupe.
3. Les n° 5, 8 et 9 : qualité du contenu publié.
4. Les n° 6, 7, 10, 11 et 12.
5. Les n° 13 à 15, au passage.

## Suivi des corrections (20 novembre 2026)

Les 15 frictions ont été traitées par le dev en 5 paquets. J'ai validé chacune en local (tests e2e du dev et captures au bureau et à 390 px). Elles sont toutes en « à valider par le client » dans l'outil de suivi (FOR-01 à FOR-15).

| Paquet | Commit (`claude/dev-mvp`) | Frictions | Points mineurs relevés |
|---|---|---|---|
| 1 | 3c5fd90 | n° 1, 4 | Texte souligné dans les boutons-liens de la carte de fin ; « Recommencer » trop visible |
| 2 | a10c790 | n° 2, 3 | Indicateurs d'Apprenants insensibles au filtre Groupe (prioritaire) ; champ fichier natif non traduit ; colonnes étroites ; groupe mêlé aux variables ; boutons d'en-tête empilés |
| 3 | 1b2c82d | n° 5, 8, 9 | Pas d'action « Renommer » sur le titre par défaut ; phrase manquante dans la barre d'aide après la bulle |
| 4 | 7af2f2b | n° 6, 7, 10, 11, 12 | Sélecteurs natifs du bloc Formation ; bouton « Supprimer » de la voix off isolé |
| 5 | ca3d0c4 | n° 13, 14, 15 | Aucun |

Pour la n° 15, le dev a choisi le bouton en icône seule (nom accessible et infobulle) plutôt que le bouton en pleine largeur sous le titre, pour ne pas ajouter de ligne à l'en-tête mobile. Ce choix est conforme à la correction proposée.

Les points mineurs sont à corriger au passage. Ils figurent dans les lignes FOR du tracker.
