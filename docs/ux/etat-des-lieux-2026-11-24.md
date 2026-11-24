# État des lieux UX du 24/11 : lots 4 à 8 et transverses

App comparée : `claude/dev-mvp` 02c49d5. Méthode : chaque écran de maquette (`maquettes/refonte/lot4…lot8`) rapproché de sa capture dans l'app (Playwright, faux Supabase), en clair à 1440 px ; à 390 px pour l'authentification et le lecteur ; en sombre pour le lecteur. Données fictives uniquement.
Gravité : **P1** bloquant (texte faux, retour client non tenu, fonction absente), **P2** visible, **P3** finition. Effort : S (moins d'une demi-journée), M (une à deux journées), L (plus).

## Ordre proposé au dev

1. **Textes faux et retours client non tenus (S, une passe)** : Centre « Demo Center » → « Catalogue de démos » ; invitation « invité·e » et « en tant que Éditeur » ; retrait de LinkedIn dans Partager (P1-5) ; Temps réel (sélecteur de démo en double, orange et noir hors palette, « Clics CTA » → « Clics sur le bouton de fin ») ; mention « gratuit » et « sans carte bancaire » à retirer (outil interne).
2. **AUTH-ILL (M)** : la fenêtre de la page de connexion est toujours l'ancienne, avec la barre marine et les barres bleues refusées par le client le 21/11. Avec elle, les retouches du lot 7 en S : fond blanc à gauche, œil sur le mot de passe, saisie gardée après erreur, lien « Accessibilité : non évaluée » au pied.
3. **MOTION-01 §2, FLIP de la scène (L)** : retour client de priorité haute, rien n'est codé ; puis panneau, menus et `mouvement.e2e`.
4. **Éditeur P1 restants** : `PanelEmpty` (M), « Depuis une autre démo… » (M), puis la fenêtre Partager à navigation verticale (L, c'est aussi l'écart majeur du lot 4).
5. **Données en couleur de la marque (S, une passe transverse)** : barres en primary dans Analytics (Sources, Étape par étape, Appareils, Parcours) et Formation (progression, modules), légende Nouveaux / Récurrents ; onglets en pilule dans Analytics et Apprenants.
6. **Invitation complète et « Vérifiez votre boîte de réception » (M)**.
7. **ICON-01, passe de conformité (M)** : tailles 16/20/24 seulement, trait 2,25 / 2,1, retrait de `Settings2`, `WandSparkles` et `BellRing`, et `icones.e2e`.
8. **Formation** : fiche avec le détail des modules (P1, M), pagination, légende des statuts, page Par formation.
9. **Lecteur** : menu des chapitres (et accès sur mobile), cartes système en sombre, page Mot de passe.
10. Le reste des P3.

## Décisions à prendre (avis UX)

- **Accès d'une démo** : l'app propose un choix unique « Qui peut voir la démo ? » (lien, mot de passe, invitation, domaine), la maquette des interrupteurs indépendants. Avis : garder le modèle de l'app (exclusif, plus juste) et mettre la maquette à jour.
- **Lecteur en sombre** : bulle, formulaire, quiz et fin restent clairs (choix documenté dans `player.css`), la maquette les veut sombres. Avis : les surfaces de la démo suivent le thème de la démo (claires), mais les cartes système (lien expiré, mot de passe) suivent le thème de la page.
- **« Précédent » dans la bulle** : la décision PY-4 l'a retiré, la maquette du lot 8 l'a. Avis : garder PY-4 (la barre porte déjà Précédent) et corriger la maquette.
- **SCORM** : présent dans Diffuser et prévu dans Partager. Avis : une seule entrée, Diffuser ; Partager garde le lien vers Diffuser.

## Lot 4 · Partager et Diffuser

Conforme ou plus complet que la maquette : Diffuser, onglets SCORM et Intranet ; fenêtre Exporter (MP4 et Hors ligne en Bientôt gris) ; liens personnalisés.

| # | Écran | Écart | Gravité | Effort |
|---|---|---|---|---|
| 1 | Partager | page à onglets au lieu de la fenêtre à navigation verticale (Lien public, Intégrer, Liens personnalisés, Accès et sécurité, GIF et vidéo, PDF, HTML, Formation, Page publique en Bientôt), « Accès public » et « Publiée · version du… » dans l'en-tête | P1 | L |
| 2 | Lien | champs empilés au lieu des rangées ALIGN-01 ; adresse personnalisée en trois morceaux et bouton « Enregistrer l'adresse » ; paramètres d'URL toujours dépliés ; LinkedIn et X | P2 | M |
| 3 | Accès | voir « Décisions » | P2 | M |
| 4 | Intégrer | code toujours déplié, bouton primaire au milieu, page longue ; libellés « Responsive / Taille fixe / Bouton + pop-up » au lieu de « Dans la page / Fenêtre / Bouton » | P2 | M |
| 5 | GIF et vidéo | dans Exporter et non dans Partager ; résolution et images par seconde non vérifiées | P2 | M |
| 6 | Diffuser | après défilement, les onglets passent à moitié sous l'en-tête | P2 | S |
| 7 | SCORM | double entrée, voir « Décisions » | P3 | S |
| 8 | Diffuser, pied | « Fermer » seul et un bandeau « Publier » | P3 | S |

## Lot 5 · Analytics

Conforme : vue d'ensemble (tuiles, courbe avec la période précédente, Sources, Étape par étape, Nouveaux et récurrents, Appareils), Sessions, Leads, Segments, menu Plus (Dates en Bientôt gris).

| # | Écran | Écart | Gravité | Effort |
|---|---|---|---|---|
| 1 | Temps réel | sélecteur de démo en double ; première tuile en aplat prune ; progression orange et noir ; « Clics CTA » | P1 | M |
| 2 | Toutes | onglets soulignés au lieu de la pilule ; « Exporter » dans les filtres au lieu de l'en-tête ; tuile active soulignée d'un trait de 2 px (proche de la « barre en bord » interdite) ; « Ajouter un filtre » sans pointillé | P2 | S |
| 3 | Graphiques | barres grises ou noires au lieu de primary ; Nouveaux / Récurrents sans légende colorée | P2 | S |
| 4 | Courbe | pas d'axe Y gradué, deux dates seulement | P2 | M |
| 5 | Démos | ni vignette ni colonne « 7 derniers jours » ; démos sans données absentes au lieu de « — » | P2 | M |
| 6 | Analytics d'une démo | pas de bouton Éditeur ; ordre des blocs ; tuiles à 120 vues et 1 lead avec une courbe plate et une liste vide (à vérifier : faux Supabase ou app) | P2 | M |
| 7 | Alertes | filtres affichés sans effet ; carte vide dans une carte | P2 | S |
| 8 | Sondages et tests | barres orange ; sélecteur de démo en double | P2 | S |
| 9 | Étape par étape | pourcentage sans le nombre ; ligne entière en rouge | P3 | S |
| 10 | Sessions, Leads, Segments, mesure | rangées sur trois lignes ; corbeille au lieu de ⋯ ; sélecteurs de 32 px ; « Mesure des visites » au lieu de la bulle « Comment c'est mesuré » | P3 | S |

## Lot 6 · Formation

Conforme : « Préparer la relance » (la capture de maquette déborde, l'app fait référence), « Formations et structures », état vide.

| # | Écran | Écart | Gravité | Effort |
|---|---|---|---|---|
| 1 | Centre | « Demo Center » au lieu de « Catalogue de démos » | P1 | S |
| 2 | Fiche apprenant | une ligne par formation, sans les modules (validé le…, en cours étape n sur N, verrouillé), barre noire | P1 | M |
| 3 | Liste | indicateurs après les filtres, plus hauts, avec icônes ; tableau dans une carte en plus ; pas de pastille d'initiale ; barre noire ; statut en point de couleur et texte « Tentatives épuisées » dans la cellule ; en-tête « Score au quiz » sur trois lignes | P2 | S à M |
| 4 | Liste | pas de pagination (« 1 à 6 sur 48 ») | P2 | M |
| 5 | Statuts | pas de légende des quatre statuts | P2 | S |
| 6 | Fiche | actions en pied au lieu de sous le nom | P2 | S |
| 7 | Par formation | cartes en haut au lieu de liste et détail ; barres des modules en quatre couleurs et sans écart en points ; alerte de décrochage sans « Voir les 12 apprenants » | P2 | M |
| 8 | Centre | une carte par section au lieu de sections à plat en deux colonnes ; titre tronqué à 1440 | P2 | M |
| 9 | 390 px | « Gérer les formations » coupé | P2 | S |
| 10 | Divers | onglets soulignés, filtre Groupe absent, formations en pastilles, sélection en rose, score du quiz, encart RGPD, adresse en monospace, cases au lieu d'interrupteurs | P3 | S |

## Lot 7 · Accès et AUTH-ILL

Conforme : connexion et inscription (textes, Google, conditions), mot de passe oublié, contenu des pages légales, accroches d'AUTH-ILL.

| # | Écran | Écart | Gravité | Effort |
|---|---|---|---|---|
| 1 | AUTH-ILL | non livré : ancienne fenêtre, barre marine, barres bleues ; fond #2A0C1A au lieu de prune-900 en clair ; bulle « 2 / 6 » sans bouton ; pastille sans contour blanc ; pas de signature DSIML ; pas de fenêtre sur l'inscription | P1 | M |
| 2 | Invitation | « Invitation » au lieu de « Rejoindre l'espace Acme » et de qui invite ; pas de récapitulatif (pour, rôle, valable jusqu'au) ; pas d'acceptation sur place ni « Ignorer » ; « invité·e » et « en tant que Éditeur » | P1 | M |
| 3 | Lien envoyé | alerte au-dessus du formulaire au lieu de l'écran « Vérifiez votre boîte de réception » (adresse, validité, « Rien reçu ? », renvoi après 45 s) | P2 | M |
| 4 | Toutes | fond gauche gris au lieu de blanc ; pas de lien « Accessibilité : non évaluée » | P2 | S |
| 5 | Connexion | pas d'œil sur le mot de passe ; après une erreur, champ vidé et pas d'encadré en haut | P2 | S |
| 6 | Désinscription | gabarit d'authentification avec illustration au lieu de la carte centrée (cloche barrée, adresse, « Annuler la désinscription », « Gérer mes notifications ») | P2 | M |
| 7 | Pages légales | une colonne sans sommaire collant, sans version ni encart « En attente de validation par le DPO » | P2 | M |
| 8 | Divers | « Recevoir un lien » en lien texte, titres et bouton de « Nouveau mot de passe », pastilles d'étapes, logo à 390 | P3 | S |

## Lot 8 · Lecteur

Conforme : étape à 1440 (en-tête, bulle, pilule, mention), formulaire lead, fin, quiz, reprise par lien personnalisé (spec L13), mot de passe et lien expiré (structure), 390 px (bulle en feuille du bas).

| # | Écran | Écart | Gravité | Effort |
|---|---|---|---|---|
| 1 | Chapitres | liste simple collée au bord, sans état ni plage d'étapes ; `aria-haspopup="menu"` sans `menuitem` ; bouton masqué à 390, donc pas de chapitres sur mobile | P2 | M |
| 2 | Sombre | voir « Décisions » ; cartes système blanches sur un bloc gris | P2 | S à M |
| 3 | Mot de passe | `KeyRound` au lieu de `Lock` ; œil hors du champ ; pas d'état d'erreur rouge ; « Accéder à la démo » au lieu de « Ouvrir la démo » | P2 | S |
| 4 | Fin | sans tuiles Étapes / Quiz, « Module suivant », « Attestation (PDF) » (peut dépendre des données) | P2 | M |
| 5 | Reprise anonyme | « Reprendre où vous en étiez ? » absent (seule la reprise par lien personnalisé existe) | P2 | M |
| 6 | Divers | lien expiré sans action ; compteur de la bulle ; pastille pleine au lieu de l'anneau ; en-tête du lead ; quiz sans capture voilée ; mention sans logo ; icônes `Globe` et `ListChecks` | P3 | S |

## ICON-01

Conforme : trait 2,25 sur les icônes de 16 px des boutons, icône « panneau » maison, Paramètres et Équipe.
Écarts (P2) : tailles hors règle (12, 14, 18, 40 px ; 45 `size=` dans le code, surtout `Gate.tsx`, `Player.tsx`, `Resume.tsx`, `Menu.tsx`) ; trait à 1,75 sur une trentaine d'icônes (Démos, barre et rail de l'éditeur, Analytics, Partager) ; icônes interdites `Settings2` (Apprenants), `WandSparkles` (IA), `BellRing` (cloche) ; pas d'`icones.e2e` pour garder la règle.

## MOTION-01

Conforme : jetons de durée et de courbe, mouvement réduit à 0 ms, pas d'animation au premier affichage.
Écarts : pas de FLIP de la scène à l'ouverture d'un panneau (P1, L) ; pas d'entrée ni de sortie du panneau, pas d'animation des menus (P2) ; 7 transitions sur `width` ou `height` et 21 durées écrites en dur (P2, P3) ; jeton `--fd-motion-duration-fade-reduced` absent ; pas de `mouvement.e2e`.

## Éditeur P1

Fait : P1-1, menu d'une étape (raccourcis, toasts, annonces, CI), sauf « Télécharger la capture » et `aria-keyshortcuts` (P3).
À faire : P1-2 « Depuis une autre démo… » (M) ; P1-3 fenêtre Partager (L, voir le lot 4) ; P1-4 `PanelEmpty` et les textes des six panneaux (M) ; P1-5 retrait de LinkedIn (S).

## Limites

Pas de passe en sombre ni à 390 px pour les lots 4, 5 et 6. L'incohérence des chiffres de l'Analytics d'une démo reste à reproduire sur de vraies données de test. `/#/settings/general` mène à la page Démos : vu au passage, non vérifié.
