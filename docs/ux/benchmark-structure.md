# L48 : benchmark de structure produit

> **Objet.** Le client a montré 22 captures d'un outil de démos interactives du marché. Le chef de projet en a fait l'analyse (20 novembre). Ce document compare **la structure et la logique produit** de cet outil avec TutoClick, zone par zone, et en tire des recommandations adaptées à un outil interne de formation de la DSI. Le but n'est **pas** de copier le design.
> **Cadre.** Outil interne : pas de paiement en ligne, pas de démo en direct avec un commercial. Publics : formateurs, conseillers, jeunes accompagnés, équipes DSI.
> **Source TutoClick.** App locale sur `claude/dev-mvp` (2deaae8), données fictives, à 1 440 px. Les captures de comparaison sont restées hors du dépôt.
> **Aucune capture de l'outil étudié** n'est dans ce dépôt (public) : seule la description du chef de projet sert de référence. Pas de nom de produit tiers dans les maquettes.

## Synthèse classée par impact

| Rang | Zone | Impact | Effort | Décision | Paquet |
|---|---|---|---|---|---|
| 1 | Navigation (barre latérale, colonne Dossiers) | Fort | Moyen | Retenu | L48-A |
| 2 | Paramètres (navigation groupée, fil d'Ariane, doublons) | Fort | Faible | Retenu | L48-A |
| 3 | États vides | Fort | Faible | Retenu | L48-B |
| 4 | Accueil (assistant de démarrage) | Fort | Moyen | Retenu | L48-C |
| 5 | Éditeur (rail d'outils, un panneau à la fois) | Fort | Élevé | Retenu, en dernier | L48-E |
| 6 | Analytics (onglets, widgets, états vides par widget) | Moyen | Moyen | Retenu, avec L47 | L48-D |
| 7 | Intégrations (catégories, demande d'intégration) | Moyen | Faible | Retenu | L48-F |
| 8 | Support (bouton et centre d'aide) | Faible | Faible | Retenu, dans L48-A | L48-A |
| 9 | Barres de liste | Faible | Faible | L40 maintenu, deux ajouts | L48-A |

Ordre de livraison au dev, **après L41** : L48-A, L48-B, L48-C, L48-D (avec L47), L48-F, puis L48-E.

---

## 1. Navigation (rang 1)

**Ce qu'ils font.**
- Barre latérale **groupée par types de contenu**. En bas, les utilitaires (extension, intégrations, hors ligne, centre d'aide, paramètres) et le profil.
- Une **2e colonne « Dossiers »** persistante : Tous, Espace, Partagés, Privés, Archivés, avec compteurs et bouton +.

**Ce qu'on a.**
- **Barre latérale** :
  - en haut : Démos, Analytics, Leads ;
  - section « Formation » : Apprenants, Centre de formation ;
  - section « Workspace » (en anglais) : Membres, Paramètres, Plans ;
  - le profil en bas.
- **Leads** ouvre Analytics sur l'onglet Leads : deux entrées pour la même page.
- **Membres** et **Plans** sont aussi dans la navigation des Paramètres : doublons.
- **Dossiers** : un filtre « Dossier : Tous » dans la barre de la liste (L40), sans vue d'ensemble, sans compteurs et sans archives.
- **Aide** : icône dans l'en-tête de chaque page ; pas d'accès au centre d'aide dans la navigation.

**Écart.**
- La navigation mélange contenus, administration et compte.
- Les dossiers sont cachés dans un menu.
- Les doublons font hésiter (« Paramètres » de la barre ou des Paramètres ?).
- Le mot anglais « Workspace » détonne.

**Recommandation (L48-A).**
- **Barre latérale en trois zones** :
  1. **Contenus** : Démos, Parcours de formation (aujourd'hui « Centre de formation »), Analytics ;
  2. **Formation** : Apprenants ;
  3. **En bas, utilitaires** : Extension (installer ou ouvrir), Centre d'aide, Paramètres. Puis le bloc profil (Mon profil, Changer d'espace, Se déconnecter).
- **Retirés de la barre** :
  - Leads devient un onglet d'Analytics, comme aujourd'hui ;
  - Membres et Plans restent seulement dans les Paramètres.
- « Workspace » devient **« Espace »** partout.
- **Colonne Dossiers** (page Démos, 240 px, repliable) :
  - entrées : Toutes les démos, Mes démos, Partagées avec moi, puis les dossiers de l'espace (arborescence à un niveau), puis Archivées ;
  - un compteur par entrée, et « + Nouveau dossier » ;
  - glisser une démo sur un dossier pour l'y ranger ;
  - le filtre « Dossier » de la barre L40 est retiré, puisque la colonne le remplace ;
  - sous 1 024 px, la colonne devient un menu « Dossier » dans la barre (comportement L40 actuel).
- **Archivées** : à vérifier côté données. Aujourd'hui, `deleted_at` sert à la corbeille. Si l'archivage n'existe pas, l'entrée porte le badge « Bientôt ».

## 2. Paramètres (rang 2)

**Ce qu'ils font.**
- **Navigation gauche groupée** :
  - Espace : Général, Équipe, Offre, Clés API, Confidentialité ;
  - Marque : Thème, Polices, Filigrane, Page publique, Domaine ;
  - Personnalisation : Variables, Widget, Étiquettes ;
  - Utilisateur : Mon compte, Notifications.
- **Fil d'Ariane** « Espace > Offre ».
- Page **Variables** en tableau (nom, champ, exemple, valeur par défaut, type, statut).

**Ce qu'on a.**
- **Groupe « WORKSPACE »** (11 entrées à plat) : Général, Membres, Marque, Variables, Glossaire, Intégrations, Sécurité, Confidentialité, Assistance IA, Fonctions à venir.
- **Groupe « COMPTE »** : Mon profil, Plans et facturation.
- **Pas de fil d'Ariane.**
- **Variables** : un tableau qui montre `{{company}}` en brut. L46 le corrige déjà (nom, description, exemple, si inconnu, utilisée dans).
- **Plans et facturation** : prix mensuels et annuels, « Paiement en ligne bientôt disponible ». Cela ne correspond pas à un outil interne sans paiement.

**Écart.**
- Une liste longue sans regroupement logique.
- La facturation est rangée dans « Compte », alors qu'elle concerne l'espace.
- « Fonctions à venir » est une page fourre-tout.

**Recommandation (L48-A).**
- **Quatre groupes** :
  - **Espace** : Général, Équipe (aujourd'hui Membres), Offre et limites, Sécurité, Confidentialité ;
  - **Marque** : Thème et couleurs, Page publique, Domaine (Bientôt) ;
  - **Contenu** : Variables (L46), Glossaire, Étiquettes, Assistance IA ;
  - **Connexions** : Intégrations, Clés d'accès (Bientôt) ;
  - **Mon compte** : Profil, Notifications.
- **Fil d'Ariane** au-dessus du titre de page : « Paramètres > Espace > Équipe ».
- **« Plans et facturation »** devient **« Offre et limites »** :
  - offre actuelle et utilisation (démos, membres, stockage) ;
  - « Demander plus » vers la DSI ;
  - **aucun prix ni paiement**.
  - **Décision client à confirmer** : retrait des prix (ligne `bloque_client`).
- **« Fonctions à venir »** est supprimée : chaque fonction à venir apparaît **à sa place** avec le badge « Bientôt » (règle existante), par exemple Domaine dans Marque.
- **Notifications** : la cloche existe, mais il n'y a pas de page de préférences. La page est créée avec le badge « Bientôt » si les préférences ne sont pas encore stockées.

## 3. États vides (rang 3)

**Ce qu'ils font.** Illustration de l'objet, « Créez votre premier … », une ligne d'explication, un bouton. Fonction non incluse dans l'offre : badge d'offre sur le bouton.

**Ce qu'on a.**
- **Démos sans démo** : une grande carte blanche avec « Les statistiques apparaîtront après la première publication. » à la place des KPI, puis la prise en main, puis une liste vide.
- **Intégrations** : un bon état vide (« Aucun webhook », une explication, un bouton).
- **Analytics** : « Pas encore de données sur la période. » en texte seul.
- Pas de composant commun.

**Écart.** Les états vides sont inégaux, et la page Démos vide affiche un grand bloc qui n'aide pas à démarrer.

**Recommandation (L48-B).**
- **Composant `fd-empty`** :
  - pictogramme de l'objet (icône Lucide de 32 px dans une pastille de 64 px, sans illustration externe) ;
  - titre « Créez votre première démo » ;
  - une phrase d'explication, une action principale et une action secondaire facultative (« Voir un exemple ») ;
  - variante compacte pour un widget ou un panneau.
- **Inventaire** : Démos, dossier vide, recherche sans résultat, Apprenants, Parcours, Analytics (page et chaque widget, L48-D), Leads, Sessions, Variables, Glossaire, Étiquettes, Intégrations, Commentaires, Notifications.
- **Page Démos vide** :
  - les KPI sont masqués, et non remplacés par une carte (ils reviennent dès la première publication) ;
  - l'état vide se place au centre de la liste.
- **Offre et Bientôt** :
  - **« Bientôt »** : la fonction n'existe pas encore (règle inchangée) ;
  - **badge d'offre** (« Offre Business ») : la fonction existe, mais l'offre de l'espace ne l'inclut pas. Le bouton reste visible, et un clic ouvre « Offre et limites » avec « Demander l'accès à la DSI » ;
  - jamais l'un pour l'autre.

## 4. Accueil, assistant de démarrage (rang 4)

**Ce qu'ils font.**
- **Assistant modal en 6 étapes** (compteur « n/6 ») : formulaire à gauche, aperçu contextuel à droite.
- **Étapes** :
  - profil ;
  - espace (nom, structure, taille) ;
  - usage, en cartes qui personnalisent la suite ;
  - installer l'extension, puis l'épingler ;
  - première capture, puis « Ouvrir le tableau de bord ».

**Ce qu'on a.**
- **Page `/onboarding` en 3 étapes**, formulaire seul, sans aperçu :
  1. nom de l'espace et usage (Former les équipes, Documenter une procédure, Annoncer un changement de version) ;
  2. installer l'extension ;
  3. une liste d'étapes.
- **Checklist « Prise en main »** sur la page Démos : 7 étapes, qui se cochent seules.

**Écart.**
- Pas d'aperçu qui montre à quoi servent les choix.
- L'usage choisi ne change pas visiblement la suite.
- Les usages ne parlent pas du terrain des Missions Locales.

**Recommandation (L48-C).**
- **Assistant plein écran en 6 étapes**, avec « Étape n sur 6 » : formulaire à gauche (480 px), aperçu à droite.
  1. **Profil** : prénom, fonction (Formateur, Conseiller, Chargé de communication, DSI, Autre). Aperçu : la carte de profil.
  2. **Espace** : nom, structure, nombre de personnes. Aperçu : la barre latérale avec le nom.
  3. **Usage** (choix multiple), en cartes. Aperçu : les modèles de démo proposés.
     - Former les conseillers ;
     - Accompagner les jeunes ;
     - Documenter un logiciel métier ;
     - Communication interne.
  4. **Installer l'extension**. Aperçu : la barre du navigateur avec l'extension.
  5. **L'épingler**. Aperçu animé du menu des extensions, sans mouvement avec `prefers-reduced-motion`.
  6. **Première capture** : « Lancer une capture » ou « Ouvrir l'espace ».
- **Effet de l'usage** :
  - modèles proposés dans « Nouvelle démo » ;
  - ordre de la checklist ;
  - exemples de textes.
- « Passer » reste disponible à chaque étape.
- La checklist « Prise en main » est conservée, repliée par défaut une fois l'assistant terminé.

## 5. Éditeur (rang 5)

**Ce qu'ils font.**
- **Rail vertical d'outils à droite** : thème, mise en page, point d'intérêt, texte, actions, embranchements, audio, vidéo, intégration, document, IA, commentaires, réglages, annuler et rétablir. Chaque outil ouvre **un seul panneau latéral**.
- **En-tête** : Plus, Traduire, Aperçu, « Améliorer avec l'IA », Partager (principal).
- **Panneau « Informations de l'étape »** : titre, description riche, « Ajouter des variables ».
- **Flou** : modale plein écran avec zoom, annuler et « Appliquer le flou ».

**Ce qu'on a.**
- **Colonne des étapes** à gauche.
- **Canevas** avec une barre d'outils flottante en bas (point d'intérêt, flou, zoom, recadrage, image).
- **Panneau droit** à 3 onglets (Étape, Design, Réglages), en longue colonne : bouton d'action, points d'intérêt, accessibilité, zoom, animation…
- **Commentaires** en tiroir en bas.
- **En-tête** :
  - le titre et les états d'enregistrement ;
  - Annuler, Rétablir ;
  - Édition et Aperçu ;
  - 4 icônes : commentaires, idées, aide, plus ;
  - Présenter, Partager, Publier.

**Écart.**
- Le panneau droit est long et mélange des sujets.
- Les outils sont répartis entre la barre flottante, le panneau et l'en-tête.
- Trop de boutons au même niveau dans l'en-tête.

**Recommandation (L48-E, en dernier : refonte lourde, à faire après les lots de l'éditeur en cours).**
- **Rail d'outils vertical** à droite du canevas (48 px), groupé :
  - **Contenu** : Étape (titre, texte avec variables L46), Bouton d'action, Points d'intérêt, Voix off ;
  - **Écran** : Flou, Zoom, Recadrage, Image ;
  - **Apparence** : Design ;
  - **Collaborer** : Commentaires, Notes du présentateur ;
  - **Réglages** de la démo.
- **Un seul panneau** (360 px) ouvert à la fois. L'outil actif porte le style « pressé » ; infobulles L44.
- **En-tête** :
  - à gauche : titre et état ;
  - au centre : Annuler, Rétablir, Édition et Aperçu ;
  - à droite : Plus (Traduire, Présenter, Exporter, Aide), Partager (secondaire) et Publier (principal).
  - « Améliorer avec l'IA » entre dans le menu Plus, avec le badge « Bientôt » si la fonction n'est pas branchée.
- **Flou** : modale plein écran avec zoom, liste des zones, Annuler et « Appliquer le flou ». La modale reprend le flou automatique existant.
- **Embranchements, vidéo, document** : présents dans le rail avec le badge « Bientôt » s'ils n'existent pas. On ne les invente pas.

## 6. Analytics (rang 6)

**Ce qu'ils font.**
- **Onglets** : Général, Démos, Sessions.
- **Barre** : filtres sources, visiteurs, période, Imprimer, Télécharger.
- **Contenu** : 4 KPI, puis une grille de widgets (graphique, localisation, OS, navigateurs, appareils, étapes), chacun avec l'état vide « Rien à analyser pour l'instant ».

**Ce qu'on a.**
- **7 onglets** : Vue d'ensemble, Sessions, Leads, Temps réel, Sondages et tests, Segments, Alertes.
- **6 KPI**, puis Vues et complétions, Sources, Nouveaux et récurrents, Étape par étape.
- **Barre** : Démo, Source, période, Dates (Bientôt), Mesure des visites, Exporter. Elle passe sur 2 lignes (corrigé par L40-03).
- L47 rend les KPI sélectionnables.

**Écart.**
- Trop d'onglets au même niveau.
- Les blocs ne suivent pas une grille commune.
- Pas d'état vide par bloc.
- « Appareils » est seulement un badge dans Sources.

**Recommandation (L48-D, avec L47).**
- **4 onglets** : Vue d'ensemble, Démos (tableau par démo, L47), Sessions, Leads. Le menu « Plus » regroupe Temps réel, Sondages et tests, Segments, Alertes, avec les mêmes routes.
- **4 KPI principaux**, sélectionnables (L47) : Vues, Visiteurs, Taux de complétion, Leads. Visiteurs récurrents et Clics sur le bouton d'action passent dans des widgets.
- **Grille de widgets** de 12 colonnes : Courbe (L47, 12 colonnes), Sources (6), Étape par étape (6), Nouveaux et récurrents (6), Appareils et navigateurs (6, Bientôt).
  - Chaque widget a son titre, son action « … » (Exporter en CSV) et son état vide compact (`fd-empty`, L48-B) : « Pas encore de données sur cette période ».
- **Localisation : non retenue.** Elle demanderait une géolocalisation des visiteurs, à proscrire pour des jeunes accompagnés (minimisation des données).
- **Barre (L40-03)** : Démo, Source, période à droite. « Imprimer » est **non retenu**, puisque l'export PDF existe ; « Télécharger » devient « Exporter » (existant).

## 7. Intégrations (rang 7)

**Ce qu'ils font.** Navigation par catégories à gauche (Vos apps, CRM, Analytics, Automatisation, Communication), bannière « Besoin d'une intégration ? Faites une demande », cartes avec logo, description et Connecter.

**Ce qu'on a.** Webhooks en premier, avec un bon état vide, puis « Autres intégrations » en grille (Slack, Zapier, Google Analytics, Matomo, Microsoft Teams, CRM…), toutes « Bientôt ». Pas de catégories ni de demande.

**Recommandation (L48-F).**
- **Filtre par catégories** en segmenté au-dessus de la grille, et non en colonne, puisque la page est déjà dans les Paramètres avec leur propre navigation : Toutes, Connectées, Communication, Mesure d'audience, Automatisation, Relation usagers.
- **Bannière** en bas de grille : « Besoin d'une autre connexion ? Faites une demande à la DSI », qui ouvre un formulaire interne (Bientôt si aucun canal n'existe).
- **Cartes** : logo, nom, une ligne, puis l'état (Connecter, Connectée, ou Bientôt).
- Webhooks devient une carte « Webhooks » de la catégorie Automatisation, qui mène à sa page.

## 8. Support (rang 8)

**Ce qu'ils font.** Bouton « Support » en haut à droite, centre d'aide dans la navigation.

**Ce qu'on a.**
- Icône d'aide (tiroir d'aide et Académie) et cloche dans l'en-tête de chaque page.
- Pas de « Centre d'aide » dans la navigation.
- Pas de contact du support.

**Recommandation (dans L48-A).**
- **« Centre d'aide »** dans les utilitaires du bas de la barre latérale. Il ouvre le tiroir d'aide existant, sur l'accueil.
- Dans le tiroir, **« Contacter la DSI »** : lien vers le canal de support interne, configurable dans Paramètres > Espace > Général, et masqué tant qu'il n'est pas configuré.
- L'icône d'aide de l'en-tête reste (aide contextuelle de la page).

## 9. Barres de liste (rang 9)

**Ce qu'ils font.**
- **À gauche** : un bouton « Filtres » qui regroupe tout.
- **À droite** : Créé par, Étiquettes, Date de création, puis grille ou liste.

**Ce qu'on a (L40, validé sur Démos).**
- **À gauche** : Statut (segmenté), Dossier, Étiquettes, Réinitialiser.
- **À droite** : Tri, puis grille ou liste.
- **Sous 768 px** : un bouton « Filtres · n ».

**Recommandation.**
- **L40 est maintenu** : sur grand écran, des filtres visibles demandent moins de clics qu'un bouton « Filtres ».
- **Deux ajouts (dans L48-A)** :
  - filtre **« Créé par »** (Moi, ou un membre) ;
  - tri **« Date de création »** à côté de « Modifiées récemment ».
- Le filtre Dossier quitte la barre au profit de la colonne Dossiers (§1).

---

## Hors périmètre (non retenu)

- Paiement, prix et facturation en ligne : outil interne (§2).
- Démo en direct avec un commercial, prise de rendez-vous : pas d'usage commercial.
- Localisation des visiteurs : données personnelles non nécessaires (§6).
- Polices personnalisées et filigrane : la charte de la DSI est imposée. Le thème reste dans Marque.

## Suite

1. **L48-A** (navigation, Paramètres, support, barres) : spec et maquette, puis envoi au dev **après L41**.
2. Puis L48-B, L48-C, L48-D (avec L47), L48-F et L48-E, dans cet ordre, une spec et une maquette par paquet.
3. **Décision client** : retrait des prix de « Plans et facturation » (`bloque_client` dans le tracker).
