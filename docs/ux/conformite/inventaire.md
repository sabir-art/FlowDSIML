# Inventaire des écrans et états

> Liste de référence pour la matrice de conformité (outil de suivi « Conformité TutoClick »). Un identifiant = un état distinct : écran, onglet, modale, menu, variante ou largeur qui change la structure.
>
> **Partie 1** : maquettes d’origine `docs/ux/maquettes/*.html`, référence de structure (décision client D13), sauf choix contraire du client dans l’onglet « Trier les écrans ».
> **Partie 2** : écrans des lots F1 à F7, A1 à A8 et vague B (`docs/ux/maquettes/refonte/`), à intégrer dans le cadre commun (CAD).
>
> Chaque état se contrôle en clair et en sombre, et aux largeurs 1 440, 1 024 et 390 px quand l’écran existe sur mobile. Ces variantes ne reçoivent pas d’identifiant propre.

## Partie 1 : maquettes d’origine


### Cadre

| ID | État | Fichier | Comment l’atteindre | Contenu |
|---|---|---|---|---|
| CAD-01 | Cadre commun : barre latérale et barre du haut | `dashboard.html` | ouvrir la page | Barre latérale (sélecteur de workspace, navigation avec compteurs, Démo centers V2, Dossiers, Workspace, carte d’usage, profil) et barre du haut (fil d’Ariane, recherche « / », aide, notifications). |
| CAD-02 | Menu du sélecteur de workspace | `dashboard.html` | clic sur « Acme Analytics · Plan Team · 6 membres » | Menu : Acme Analytics (coché), Bolt Agency, séparateur, « Nouveau workspace ». |
| CAD-03 | Navigation : compteurs et entrée Démo centers (V2) | `dashboard.html` | barre latérale | Démos (24), Démo centers avec badge V2, Analytics, Leads (128). |
| CAD-04 | Section Dossiers de la barre latérale | `dashboard.html` | barre latérale | Sales — Outbound, Site web, Onboarding, Archivées. |
| CAD-05 | Carte d’usage et profil | `dashboard.html` | pied de la barre latérale | Démos publiées 18 / ∞, Crédits IA 820 / 1 000 avec jauge orange, avatar, nom, e-mail, déconnexion. |
| CAD-06 | Barre du haut : recherche globale, aide, notifications | `dashboard.html` | barre du haut | Fil d’Ariane, champ « Rechercher… / » (raccourci /), bouton Aide, bouton Notifications. |
| CAD-07 | Navigation mobile (tiroir) | `dashboard.html` | largeur < 1 024 px, bouton menu | Barre latérale en tiroir, ouverte par le bouton menu de la barre du haut ; recherche masquée sous 768 px. |
| CAD-08 | Toast de confirmation | `dashboard.html` | toute action avec data-toast | Toast **en bas au milieu** (décision de l'utilisateur du 25/11) : centré horizontalement, 24 px du bas de la fenêtre (16 px sous 600 px) ; s'il y a une barre collée en bas (« Modifications non enregistrées », 64 px), 16 px au-dessus d'elle ; 420 px au plus (sous 600 px : pleine largeur moins 16 px de chaque côté) ; au-dessus du contenu, sous les fenêtres et les menus ouverts ; icône (succès, erreur, info), texte, bouton Fermer ; 4 s (erreurs 6 s), pause au survol et au focus ; pile de 3, le plus récent en bas. Mouvement : MOTION-01 (montée de 16 px + fondu 200 ms, sortie en fondu 160 ms). |

### Authentification

| ID | État | Fichier | Comment l’atteindre | Contenu |
|---|---|---|---|---|
| CNX-01 | Connexion | `connexion.html` | ouvrir la page | « Bon retour parmi nous », Continuer avec Google, séparateur « ou avec votre email », e-mail, mot de passe, « Mot de passe oublié ? », Se connecter, lien magique, « Créer un compte gratuit », langue, Confidentialité, Conditions ; panneau illustré à droite (carrousel 2 / 6). |
| CNX-02 | Connexion : erreur d’identifiants | `connexion.html` | message d’erreur sous le mot de passe | « Email ou mot de passe incorrect. Vérifiez vos informations et réessayez. » |
| CNX-03 | Connexion : panneau illustré | `connexion.html` | colonne de droite | Accroche, texte et carrousel d’exemples (« 2 / 6 Créez un rapport en un clic »). |
| CNX-04 | Connexion sur mobile | `connexion.html` | largeur < 900 px | Panneau illustré masqué, formulaire seul. |
| INS-01 | Inscription | `inscription.html` | ouvrir la page | « Créez votre compte », S’inscrire avec Google, nom, e-mail, mot de passe avec jauge de robustesse, case CGU et confidentialité, Créer mon compte, « Déjà inscrit ? Se connecter » ; panneau « Trois étapes » à droite. |
| INS-02 | Inscription : e-mail de confirmation envoyé | `inscription.html` | variante en bas de page | « Vérifiez votre boîte mail », adresse, expiration 24 h, « Renvoyer l’email ». |
| INS-03 | Inscription : panneau « Trois étapes » | `inscription.html` | colonne de droite | Capturez, Guidez, Partagez et mesurez. |
| INS-04 | Inscription sur mobile | `inscription.html` | largeur < 900 px | Panneau masqué, formulaire seul. |

### Onboarding

| ID | État | Fichier | Comment l’atteindre | Contenu |
|---|---|---|---|---|
| ONB-01 | Onboarding, étape 1 : configurer l’espace | `onboarding.html` | ouvrir la page | « Étape 1 sur 3 », Passer, « Bienvenue, Camille », nom du workspace, usages (Site web, Prospection, Avant-vente), Continuer. |
| ONB-02 | Onboarding, étape 2 : installer l’extension | `onboarding.html` | Continuer depuis l’étape 1 | 3 étapes numérotées, « Ajouter à Chrome », « Importer des captures à la place », aperçu de la popup de l’extension (Captures / HTML V2, Plusieurs onglets, Démarrer la capture), Retour, « J’ai installé l’extension ». |
| ONB-03 | Onboarding, étape 3 : checklist de la première démo | `onboarding.html` | Continuer depuis l’étape 2 | Checklist (compte, extension, capturer, partager, première vue) avec « Démarrer », Retour, « Explorer la démo d’exemple ». |
| ONB-04 | Onboarding : modale « Importer des captures » | `onboarding.html` | étape 2, « Importer des captures à la place » | Zone de dépôt (PNG, JPG, WebP, 10 Mo), Parcourir, Annuler, Créer la démo (désactivé). |

### Démos

| ID | État | Fichier | Comment l’atteindre | Contenu |
|---|---|---|---|---|
| DSH-01 | Tableau de bord des démos, grille | `dashboard.html` | ouvrir la page | Bandeau « Premiers pas · 3 sur 5 », titre « Démos 24 démos · 18 publiées », Importer, Nouvelle démo, filtres (statut, créateur, tri), bascule grille / liste, cartes de démo. |
| DSH-02 | Tableau de bord, vue liste | `dashboard.html` | bascule « liste » | Tableau : Nom, Statut, Dossier, Vues (30 j), Complétion, Modifiée, Actions. |
| DSH-03 | Bandeau « Premiers pas » | `dashboard.html` | haut de page | Progression 3 sur 5, prochaine étape, bouton Partager, fermeture. |
| DSH-04 | Filtres et tri | `dashboard.html` | barre de filtres | Statuts (Tous, Publiées, Brouillons, Modifiées), créateurs (Tous, Moi), tri (Modifiées récemment, Créées récemment, Nom A-Z, Plus vues). |
| DSH-05 | Menu d’actions d’une démo | `dashboard.html` | bouton « … » d’une carte | Ouvrir dans l’éditeur, Partager, Copier le lien, Dupliquer ⌘D, Déplacer vers…, Archiver, Supprimer. |
| DSH-06 | Modale « Nouvelle démo » | `dashboard.html` | Nouvelle démo | Capturer avec l’extension (recommandé), Importer des images, choix du dossier, Annuler. |
| DSH-07 | Modale « Importer des captures » en cours | `dashboard.html` | Importer | Progression « 12 images sur 18 », fichiers ignorés avec raison, Annuler, « Import en cours… ». |
| DSH-08 | Modale de suppression d’une démo | `dashboard.html` | menu d’actions, Supprimer | « Supprimer « Créer un rapport » ? », conséquences, Annuler, Supprimer la démo. |
| DSH-09 | État vide d’un dossier | `dashboard.html` | section « Exemple d’état vide » | « Ce dossier est vide », explication, Nouvelle démo. |
| DSH-10 | Carte de démo : statuts | `dashboard.html` | grille | Badges Publiée, Modifiée, Brouillon ; méta « n étapes · dossier · date » ; vues. |

### Workspace

| ID | État | Fichier | Comment l’atteindre | Contenu |
|---|---|---|---|---|
| PLN-01 | Plans et facturation | `plans.html` | ouvrir la page | Titre et sous-titre de facturation, bandeau « Paiement en ligne bientôt disponible », carte d’utilisation, choix du plan, factures, limite atteinte. |
| PLN-02 | Plans : carte « utilisation ce mois-ci » | `plans.html` | section du haut | Plan Team, renouvellement, Membres 6 / 10, Crédits IA 820 / 1 000 (82 %), rétention des analytics. |
| PLN-03 | Plans : choix du plan, mensuel | `plans.html` | segmenté « Mensuel » | 4 cartes (noms, prix, limites et boutons issus de la table plans), « Plan actuel », « Recommandé pour vous ». |
| PLN-04 | Plans : choix du plan, annuel (−20 %) | `plans.html` | segmenté « Annuel −20 % » | Mêmes cartes, prix annuels. |
| PLN-05 | Plans : factures | `plans.html` | section Factures | Tableau Date, Plan, Montant, Statut, Télécharger (PDF) ; à afficher en V2 / « Bientôt ». |
| PLN-06 | Plans : limite atteinte | `plans.html` | section « Limite atteinte » | Jauge 5 / 5, message, « Gérer mes démos », « Passer à … ». |
| PLN-07 | Modale « Passer au plan … » | `plans.html` | bouton de changement de plan | Texte d’activation manuelle, nombre de membres, message, total estimé, Annuler, Envoyer la demande. |
| PLN-08 | Plans : lien Enterprise | `plans.html` | sous les cartes | Mention des prix indicatifs et « Parlons Enterprise ». |

### Analytics

| ID | État | Fichier | Comment l’atteindre | Contenu |
|---|---|---|---|---|
| ANA-01 | Analytics : vue d’ensemble | `analytics.html` | ouvrir la page | Filtres (démo, source, 7 j / 30 j / 90 j / Dates), Exporter, onglets, 5 KPI, courbe, sources, entonnoir. |
| ANA-02 | Analytics : filtres et période | `analytics.html` | barre du haut de page | Select démo, select source, segmenté 7 j / 30 j / 90 j, bouton Dates, Exporter. |
| ANA-03 | Analytics : KPI | `analytics.html` | onglet Vue d’ensemble | Vues, Visiteurs uniques, Taux de complétion, Leads collectés, Clics sur le CTA final, avec tendance. |
| ANA-04 | Analytics : courbe vues et complétions | `analytics.html` | onglet Vue d’ensemble | Courbe à 2 séries avec légende et axe des dates. |
| ANA-05 | Analytics : sources et appareils | `analytics.html` | onglet Vue d’ensemble | Barres par source (aperçus internes exclus) et répartition par appareil. |
| ANA-06 | Analytics : parcours étape par étape | `analytics.html` | onglet Vue d’ensemble | Tableau des étapes (visiteurs, abandon), alerte sur la plus forte perte, « Ouvrir dans l’éditeur ». |
| ANA-07 | Analytics : onglet Sessions | `analytics.html` | onglet Sessions | Tableau Visiteur, Démo, Source, Durée, Progression, Date ; pagination. |
| ANA-08 | Analytics : onglet Leads | `analytics.html#leads` | onglet Leads (badge 128) | Tableau Email, Entreprise, Démo, Progression, Collecté. |
| ANA-09 | Analytics : état vide des leads | `analytics.html` | section « État vide » | « Aucun lead pour l’instant », explication, « Ajouter un formulaire ». |
| ANA-10 | Leads (entrée de navigation) | `analytics.html#leads` | barre latérale, Leads | Même écran que ANA-08, entrée « Leads » active. |

### Paramètres

| ID | État | Fichier | Comment l’atteindre | Contenu |
|---|---|---|---|---|
| PRM-01 | Paramètres : cadre et navigation interne | `parametres.html` | ouvrir la page (onglet Membres par défaut) | Titre, fil d’Ariane « Paramètres / … », navigation interne Workspace (Général, Membres, Marque, Variables) et Compte (Mon profil), lien Plans et facturation. |
| PRM-11 | Paramètres : Général | `parametres.html` | onglet Général | Identité (logo, nom, site web), langue et région, Annuler / Enregistrer, zone de danger. |
| PRM-02 | Paramètres : Membres | `parametres.html` | onglet Membres (par défaut) | « 6 membres sur 10 », Inviter des membres, filtre par rôle, tableau Membre / Rôle / Dernière activité / Actions, tableau des permissions par rôle. |
| PRM-03 | Paramètres : menu d’actions d’un membre | `parametres.html` | bouton « … » d’un membre | Renvoyer l’invitation, Transférer la propriété, Retirer du workspace. |
| PRM-04 | Modale « Inviter des membres » | `parametres.html` | Inviter des membres | Adresses, rôle (Éditeur, Lecteur, Admin), sièges restants, Annuler, Envoyer les invitations. |
| PRM-05 | Modale « Retirer un membre » | `parametres.html` | menu membre, Retirer | Conséquences (démos transférées), Annuler, Retirer. |
| PRM-06 | Modale « Supprimer le workspace » | `parametres.html` | Général, Supprimer le workspace | Conséquences, saisie de confirmation, bouton danger désactivé tant que la saisie est absente. |
| PRM-07 | Paramètres : Marque | `parametres.html` | onglet Marque | Thème des démos (couleur principale avec contraste, hotspot, police), page publique (boutons), masquer la mention (selon plan). |
| PRM-08 | Paramètres : Variables | `parametres.html` | onglet Variables | Nouvelle variable, tableau Variable / Type / Valeur par défaut / Utilisée dans. |
| PRM-09 | Paramètres : Mon profil | `parametres.html` | onglet Mon profil | Profil (nom, e-mail), préférences (langue, apparence Système / Clair / Sombre, notifications e-mail). |

### Partage

| ID | État | Fichier | Comment l’atteindre | Contenu |
|---|---|---|---|---|
| PRT-01 | Partager : onglet Lien | `partage.html` | ouvrir la page | Titre, version publiée et modifications non publiées, Aperçu, Publier les modifications ; accès public, lien, adresse personnalisée, paramètres d’URL, partager ailleurs (Email, LinkedIn, X, GIF / vidéo V2) ; colonne aperçu réseaux et « Cette semaine ». |
| PRT-02 | Partager : onglet Intégrer | `partage.html` | onglet Intégrer | Responsive / Taille fixe / Bouton + pop-up, code, Copier le code, guides, masquer le filigrane, démarrer au clic, aide CSP. |
| PRT-03 | Partager : onglet Liens personnalisés | `partage.html` | onglet Liens personnalisés | Nouveau lien, tableau Nom / Variables / Vues / Dernière vue / Actions. |
| PRT-04 | Partager : onglet Accès | `partage.html` | onglet Accès | Mot de passe, date d’expiration, domaines e-mail autorisés (V2), formulaire avant la démo. |
| PRT-05 | Modale « Nouveau lien personnalisé » | `partage.html` | Nouveau lien | Nom, variables, e-mail facultatif avec erreur, expiration, Annuler, Créer et copier le lien. |
| PRT-06 | Partager : colonne aperçu | `partage.html` | colonne de droite | Aperçu sur les réseaux (image générée), « Cette semaine » (vues, leads), Voir les analytics. |

### Éditeur

| ID | État | Fichier | Comment l’atteindre | Contenu |
|---|---|---|---|---|
| EDT-01 | Éditeur : vue générale, étape hotspot | `editeur.html` | ouvrir la page | Barre du haut (retour, titre, modifications non publiées, Enregistré, annuler / rétablir, Édition / Aperçu, Plus, Partager, Publier), rail des étapes, canevas, panneau Étape. |
| EDT-02 | Éditeur : menu « Plus d’options » | `editeur.html` | bouton « … » de la barre du haut | Historique des versions, Thème de la démo, Rédiger les textes (V2), Raccourcis clavier, Dupliquer la démo. |
| EDT-03 | Éditeur : menu « Ajouter une étape » | `editeur.html` | « + » du rail ou « Ajouter une étape » | Capturer de nouvelles étapes, Importer une image, Ajouter une pop-up, Ajouter un formulaire. |
| EDT-04 | Éditeur : rail des étapes | `editeur.html` | colonne de gauche | « Étapes · 8 », vignettes numérotées avec icônes (hotspot, flou, formulaire, fin), poignées, sélection au clavier. |
| EDT-05 | Éditeur : canevas et zoom | `editeur.html` | zone centrale | Titre de l’étape, Ajuster / 50 % / 100 %, capture avec barre de navigateur, hotspot, bulle, flou. |
| EDT-06 | Éditeur : panneau Étape, hotspot | `editeur.html` | onglet Étape, étape hotspot | Type de guidage (Hotspot, Zone, Libre), bulle (titre, texte, gras, italique, lien, variable, compteur, IA V2), position (grille 3×3), placement auto, boutons, avancer au clic, action au clic. |
| EDT-07 | Éditeur : zone de flou sélectionnée | `editeur.html` | clic sur une zone de flou | Flou / Pixels / Aplat, intensité, appliquer à cette étape ou à toutes, aide sur l’image publiée. |
| EDT-08 | Éditeur : étape formulaire de lead | `editeur.html` | étape 6 du rail | Canevas avec formulaire ; panneau : titre, description, champs (ajouter, obligatoire / facultatif), comportement, consentement, texte du bouton, webhook. |
| EDT-09 | Éditeur : étape de fin (CTA) | `editeur.html` | étape 8 du rail | Canevas avec écran de fin ; panneau : titre, texte, bouton principal (libellé, action, URL, nouvel onglet), bouton secondaire. |
| EDT-10 | Éditeur : onglet Design | `editeur.html` | onglet Design | Thème, couleurs avec alerte de contraste, forme du hotspot (Carré, Doux, Rond), cadre, barre de navigateur, fond. |
| EDT-11 | Éditeur : onglet Réglages | `editeur.html` | onglet Réglages | Lecture automatique, barre de progression, langue, variables utilisées. |
| EDT-12 | Éditeur : mode Aperçu | `editeur.html` | segmenté « Aperçu » | Lecture de la démo dans l’éditeur. |
| EDT-13 | Éditeur sur mobile | `editeur.html` | largeur < 1 024 px | « L’éditeur s’utilise sur ordinateur », explication, « Voir la démo ». |

### Player

| ID | État | Fichier | Comment l’atteindre | Contenu |
|---|---|---|---|---|
| PLY-01 | Player : introduction | `player.html` | ouvrir la page | En-tête (logo du workspace, « Voir les tarifs », « Essai gratuit »), cadre navigateur, popup d’intro (titre, texte avec variables, Lancer la démo, durée), barre (précédent, compteur, suivant, langue, plein écran), « Fait avec … ». |
| PLY-02 | Player : étape avec bulle | `player.html` | Lancer la démo | Hotspot pulsant, bulle « n / N », titre, texte avec variables, Précédent, Suivant. |
| PLY-03 | Player : formulaire de lead | `player.html` | étape 5 | « Recevez la démo complète », e-mail, consentement et lien Confidentialité, Recevoir l’accès, Passer. |
| PLY-04 | Player : écran de fin | `player.html` | étape 6 | « Prêt à essayer, {{first_name}} ? », texte, Réserver une démo, Recommencer la visite. |
| PLY-05 | Player : mot de passe | `player.html#password` | ancre #password | Écran système « Cette démo est protégée », champ mot de passe, bouton ; barre masquée. |
| PLY-06 | Player : lien expiré | `player.html#expired` | ancre #expired | Écran système « Cette démo n’est plus disponible », date d’expiration, contact. |
| PLY-07 | Player sur mobile | `player.html` | largeur < 640 px (index.html, cadres téléphone) | Bulle en feuille du bas, boutons de 44 px, balayage pour avancer. |
| PLY-08 | Player : variables par URL | `player.html?first_name=…&company=…` | paramètres d’URL | Textes personnalisés à partir de l’URL. |
## Partie 2 : lots F, A et vague B


### F1 Formation

| ID | État | Fichier | Comment l’atteindre | Contenu |
|---|---|---|---|---|
| F1-01 | Vérification des flous avant envoi (extension) | `refonte/f1-formation.html?view=flous` | vue de la maquette | Détections par capture, interrupteurs, aperçu du flou, envoi. |
| F1-02 | Publication publique : confirmation RGPD | `refonte/f1-formation.html?view=rgpd` | vue de la maquette | Résumé (zones floutées, détections non floutées, commentaires internes), 2 confirmations, restreindre l’accès. |
| F1-03 | Étape Avant / Après | `refonte/f1-formation.html?view=avap` | vue de la maquette | Comparaison de deux écrans dans une étape. |
| F1-04 | Glossaire | `refonte/f1-formation.html?view=gloss` | vue de la maquette | Termes du module (sous réserve de validation de la proposition). |

### F2 Quiz

| ID | État | Fichier | Comment l’atteindre | Contenu |
|---|---|---|---|---|
| F2-01 | Éditeur de quiz | `refonte/f2-quiz.html?view=build` | vue de la maquette | Liste des questions, question en édition, validation du module, réussite par question. |
| F2-02 | Quiz : question | `refonte/f2-quiz.html?view=q` | vue de la maquette | Question, progression et seuil, réponses, Précédente, Valider. |
| F2-03 | Quiz : bonne réponse | `refonte/f2-quiz.html?view=ok` | vue de la maquette | Correction positive et explication. |
| F2-04 | Quiz : mauvaise réponse | `refonte/f2-quiz.html?view=ko` | vue de la maquette | Correction, explication, revoir l’étape liée. |
| F2-05 | Quiz : module validé | `refonte/f2-quiz.html?view=pass` | vue de la maquette | Score, badge, récapitulatif, module suivant. |
| F2-06 | Quiz : module non validé | `refonte/f2-quiz.html?view=fail` | vue de la maquette | Score, tentatives restantes, revoir, réessayer. |

### F3 Suivi

| ID | État | Fichier | Comment l’atteindre | Contenu |
|---|---|---|---|---|
| F3-01 | Suivi des apprenants | `refonte/f3-suivi.html?view=learners` | vue de la maquette | Liste des apprenants et progression. |
| F3-02 | Pilotage par structure | `refonte/f3-suivi.html?view=structures` | vue de la maquette | Indicateurs par structure. |
| F3-03 | Reprise du module (player) | `refonte/f3-suivi.html?view=resume` | vue de la maquette | Reprendre là où l’apprenant s’était arrêté. |

### F4 Centre de formation

| ID | État | Fichier | Comment l’atteindre | Contenu |
|---|---|---|---|---|
| F4-01 | Centre de formation : accueil | `refonte/f4-centre.html?view=hub` | vue de la maquette | Parcours et modules. |
| F4-02 | Centre de formation : parcours | `refonte/f4-centre.html?view=path` | vue de la maquette | Page d’un parcours. |
| F4-03 | Centre de formation : configuration | `refonte/f4-centre.html?view=config` | vue de la maquette | Réglages du centre. |

### F5 Exports PDF

| ID | État | Fichier | Comment l’atteindre | Contenu |
|---|---|---|---|---|
| F5-01 | PDF « mode d’emploi » : pages | `refonte/f5-pdf.html?view=pages` | vue de la maquette | Couverture, sommaire, étapes, auto-évaluation. |
| F5-02 | PDF : options d’export | `refonte/f5-pdf.html?view=options` | vue de la maquette | Modèle, contenu, format, repères, aperçu. |

### F6 Diffusion

| ID | État | Fichier | Comment l’atteindre | Contenu |
|---|---|---|---|---|
| F6-01 | Diffuser : intranet | `refonte/f6-diffusion.html?view=intranet` | vue de la maquette | Code iframe, instructions, vérification du domaine. |
| F6-02 | Diffuser : LMS (SCORM) | `refonte/f6-diffusion.html?view=lms` | vue de la maquette | Version, type de paquet, données transmises, téléchargement. |
| F6-03 | Diffuser : e-mail | `refonte/f6-diffusion.html?view=mail` | vue de la maquette | Texte prêt à copier, joindre le PDF. |

### F7 Capture

| ID | État | Fichier | Comment l’atteindre | Contenu |
|---|---|---|---|---|
| F7-01 | Extension : choix du type de capture | `refonte/f7-capture.html?view=popup` | vue de la maquette | Captures, vidéo, mobile ; options. |
| F7-02 | Enregistrement vidéo en cours | `refonte/f7-capture.html?view=rec` | vue de la maquette | Barre flottante, chronomètre, marquer une étape. |
| F7-03 | Étape vidéo : montage | `refonte/f7-capture.html?view=video` | vue de la maquette | Lecteur, pistes, coupes, sous-titres, panneau Vidéo. |
| F7-04 | Démo mobile | `refonte/f7-capture.html?view=mobile` | vue de la maquette | Cadre téléphone, feuille du bas. |

### A1 Partage avancé

| ID | État | Fichier | Comment l’atteindre | Contenu |
|---|---|---|---|---|
| A1-01 | Partage avancé : Lien | `refonte/partage-avance.html?view=lien` | vue de la maquette | Adresse, variables d’URL, expiration, récapitulatif. |
| A1-02 | Partage avancé : Accès | `refonte/partage-avance.html?view=acces` | vue de la maquette | Modes d’accès. |
| A1-03 | Partage avancé : Intégrer | `refonte/partage-avance.html?view=integrer` | vue de la maquette | Iframe, pop-up, sites autorisés. |
| A1-04 | Partage avancé : Page publique | `refonte/partage-avance.html?view=page` | vue de la maquette | Page publique de la démo. |
| A1-05 | Partage : démo non publiée | `refonte/partage-avance.html?view=nonpubliee` | vue de la maquette | Alerte, adresse modifiable, onglets verrouillés. |
| A1-06 | Accès visiteur : mot de passe | `refonte/acces-visiteur.html?view=mdp` | vue de la maquette | Saisie du mot de passe. |
| A1-07 | Accès visiteur : mot de passe erroné | `refonte/acces-visiteur.html?view=mdp-err` | vue de la maquette | Erreur. |
| A1-08 | Accès visiteur : invitation par e-mail | `refonte/acces-visiteur.html?view=email` | vue de la maquette | Demande de lien. |
| A1-09 | Accès visiteur : lien envoyé | `refonte/acces-visiteur.html?view=email-sent` | vue de la maquette | Confirmation. |
| A1-10 | Accès visiteur : domaine e-mail | `refonte/acces-visiteur.html?view=domaine` | vue de la maquette | Adresse du domaine autorisé. |
| A1-11 | Accès visiteur : jeton expiré | `refonte/acces-visiteur.html?view=jeton` | vue de la maquette | Lien expiré. |
| A1-12 | Page publique de démo | `refonte/demo-page.html` | vue de la maquette | Page publique autour du player. |

### A2 Éditeur avancé

| ID | État | Fichier | Comment l’atteindre | Contenu |
|---|---|---|---|---|
| A2-01 | Éditeur avancé : Modes de lecture | `refonte/editeur-avance.html?view=modes` | vue de la maquette | — |
| A2-02 | Éditeur avancé : Étape pop-up | `refonte/editeur-avance.html?view=popup` | vue de la maquette | — |
| A2-03 | Éditeur avancé : Checklist | `refonte/editeur-avance.html?view=checklist` | vue de la maquette | — |
| A2-04 | Éditeur avancé : Sondage | `refonte/editeur-avance.html?view=survey` | vue de la maquette | — |
| A2-05 | Éditeur avancé : Menu de choix (branching) | `refonte/editeur-avance.html?view=choix` | vue de la maquette | — |
| A2-06 | Éditeur avancé : Test A/B | `refonte/editeur-avance.html?view=ab` | vue de la maquette | — |
| A2-07 | Éditeur avancé : Médiathèque | `refonte/editeur-avance.html?view=assets` | vue de la maquette | — |
| A2-08 | Éditeur avancé : Tags | `refonte/editeur-avance.html?view=tags` | vue de la maquette | — |
| A2-09 | Éditeur avancé : Rechercher et remplacer | `refonte/editeur-avance.html?view=find` | vue de la maquette | — |
| A2-10 | Éditeur avancé : Appliquer à plusieurs étapes | `refonte/editeur-avance.html?view=apply` | vue de la maquette | — |
| A2-11 | Styles prédéfinis | `refonte/styles-predefinis.html` | vue de la maquette | Styles de bulles et de thèmes. |

### A3 Export

| ID | État | Fichier | Comment l’atteindre | Contenu |
|---|---|---|---|---|
| A3-01 | Export : Choix du format | `refonte/export.html?view=choose` | vue de la maquette | — |
| A3-02 | Export : Progression | `refonte/export.html?view=progress` | vue de la maquette | — |
| A3-03 | Export : Terminé | `refonte/export.html?view=done` | vue de la maquette | — |
| A3-04 | Export : Erreur | `refonte/export.html?view=error` | vue de la maquette | — |

### A4 Analytics avancées

| ID | État | Fichier | Comment l’atteindre | Contenu |
|---|---|---|---|---|
| A4-01 | Analytics avancées : Alertes | `refonte/analytics-avance.html?view=alerts` | vue de la maquette | — |
| A4-02 | Analytics avancées : Temps réel | `refonte/analytics-avance.html?view=live` | vue de la maquette | — |
| A4-03 | Analytics avancées : Sessions détaillées | `refonte/analytics-avance.html?view=sessions` | vue de la maquette | — |
| A4-04 | Analytics avancées : Appareils | `refonte/analytics-avance.html?view=devices` | vue de la maquette | — |
| A4-05 | Analytics avancées : Sondages et tests | `refonte/analytics-avance.html?view=surveys` | vue de la maquette | — |
| A4-06 | Analytics avancées : Segments | `refonte/analytics-avance.html?view=segments` | vue de la maquette | — |

### A5 Intégrations

| ID | État | Fichier | Comment l’atteindre | Contenu |
|---|---|---|---|---|
| A5-01 | Intégrations : Vue d’ensemble | `refonte/integrations.html?view=hub` | vue de la maquette | — |
| A5-02 | Intégrations : Webhooks | `refonte/integrations.html?view=webhooks` | vue de la maquette | — |
| A5-03 | Intégrations : Slack | `refonte/integrations.html?view=slack` | vue de la maquette | — |
| A5-04 | Intégrations : Clés d’API | `refonte/integrations.html?view=keys` | vue de la maquette | — |
| A5-05 | Intégrations : Snippets | `refonte/integrations.html?view=snippets` | vue de la maquette | — |
| A5-06 | Intégrations : Pilotage du player | `refonte/integrations.html?view=remote` | vue de la maquette | — |

### A6 Collaboration

| ID | État | Fichier | Comment l’atteindre | Contenu |
|---|---|---|---|---|
| A6-01 | Collaboration : Notifications | `refonte/collaboration.html?view=notif` | vue de la maquette | — |
| A6-02 | Collaboration : Mentions | `refonte/collaboration.html?view=mention` | vue de la maquette | — |
| A6-03 | Collaboration : Présence | `refonte/collaboration.html?view=presence` | vue de la maquette | — |
| A6-04 | Collaboration : Mode présentateur | `refonte/collaboration.html?view=presenter` | vue de la maquette | — |
| A6-05 | Commentaires dans l’éditeur | `refonte/editeur.html` | vue de la maquette | Panneau Commentaires (liste, résolus, saisie, modification, vide, tout résolu, replié). |
| A6-06 | Commentaires sur mobile | `refonte/commentaires-mobile.html` | vue de la maquette | — |

### A8 HTML

| ID | État | Fichier | Comment l’atteindre | Contenu |
|---|---|---|---|---|
| A8-01 | Capture HTML : Éditeur HTML | `refonte/a8-html.html?view=html` | vue de la maquette | — |
| A8-02 | Capture HTML : Sandbox | `refonte/a8-html.html?view=sandbox` | vue de la maquette | — |
| A8-03 | Capture HTML : Catalogue de démos | `refonte/a8-html.html?view=center` | vue de la maquette | — |

### Vague B (Bientôt disponible)

| ID | État | Fichier | Comment l’atteindre | Contenu |
|---|---|---|---|---|
| VB-01 | Assistance IA (Bientôt disponible) | `refonte/vague-b.html?view=ia` | vue de la maquette | Jamais présenté comme actif. |
| VB-02 | CRM et e-mailing (Bientôt disponible) | `refonte/vague-b.html?view=crm` | vue de la maquette | Jamais présenté comme actif. |
| VB-03 | SSO (Bientôt disponible) | `refonte/vague-b.html?view=sso` | vue de la maquette | Jamais présenté comme actif. |

**Total : 161 états** (85 dans les maquettes d’origine, 76 dans les lots).
