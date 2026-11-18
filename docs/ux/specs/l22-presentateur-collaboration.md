# Spec L22 : mode présentateur et collaboration

> Ce lot réalise A6 (`a6-collaboration.md`) et le branchement d'A2 §5, dans les structures validées :
> - **éditeur** de `reference/editeur.html`, avec les gains L12 ;
> - **cadre de l'app** de la refonte ;
> - **lecteur** de la refonte.
>
> **Maquettes** (clair et sombre) :
> - `docs/ux/maquettes/reference/editeur-collab.html`, états `?etat=notes|presence|mention|regles` ;
> - `docs/ux/maquettes/refonte/l22-collab.html`, états `?view=notifs|notifs-vide|lancer|presentateur|public|noir`.

## 1. États (codes de l'outil de suivi)

| Code | État | Maquette |
|---|---|---|
| L22-01 | Éditeur : notes du présentateur (panneau Étape) | `editeur-collab.html?etat=notes` |
| L22-02 | Lancer la présentation (modale) | `l22-collab.html?view=lancer` |
| L22-03 | Vue présentateur | `?view=presentateur` |
| L22-04 | Écran public (et écran noir) | `?view=public`, `?view=noir` |
| L22-05 | Centre de notifications | `?view=notifs` |
| L22-06 | Centre de notifications vide | `?view=notifs-vide` |
| L22-07 | Mention @ dans un commentaire | `editeur-collab.html?etat=mention` |
| L22-08 | Présence sur une démo | `editeur-collab.html?etat=presence` |
| L22-09 | Branchement conditionnel : règles | `editeur-collab.html?etat=regles` |

## 2. Mode présentateur

### Notes du présentateur (L22-01)

- Nouvelle section en bas de l'onglet Étape, quel que soit le type d'étape : « Notes du présentateur ».
  - Icône `Presentation` et mention « Privées » (`Lock`) alignée à droite.
  - Zone de texte libre, 1 000 caractères au plus, avec retours à la ligne. Chaque ligne s'affiche comme une puce dans la vue présentateur.
  - Aide : « Visibles seulement en mode présentateur, sur votre écran. Jamais publiées, jamais exportées. »
- Les notes sont visibles par les membres qui peuvent éditer la démo. Elles ne sont jamais servies au lecteur public, au PDF ni au GIF (L15).

### Lancer (L22-02)

- Bouton « Présenter » (`Presentation`, secondaire) dans la barre de l'éditeur, avant « Partager ». La même action existe dans le menu « … » d'une carte de démo.
- Modale « Présenter « {{démo}} » » :
  - **Affichage**, cartes radio :
    - **Deux fenêtres** (par défaut) : la vue présentateur, plus un écran public ouvert dans une nouvelle fenêtre ;
    - **Un seul écran** : plein écran, notes affichées ou masquées avec N.
  - **Commencer à** : liste des étapes.
  - **Minuteur** : interrupteur et durée cible en minutes (1 à 180, 15 par défaut). Coupé, il affiche seulement le temps écoulé.
  - **Masquer les points chauds à l'écran public** : interrupteur, désactivé par défaut.
  - Alerte d'information : l'écran public s'ouvre dans une nouvelle fenêtre, à placer sur le vidéoprojecteur puis passer en plein écran ; les notes n'y apparaissent jamais.
  - « Annuler » et « Lancer la présentation » (primaire, `Play`).
- Si le navigateur bloque la nouvelle fenêtre : message « Autorisez les fenêtres pop-up pour ce site, ou choisissez Un seul écran », avec « Réessayer ».

### Vue présentateur (L22-03)

- Fond ardoise très foncé (#0B0D10), fixe quel que soit le thème. Deux colonnes : la scène à gauche, un panneau de 400 px à droite.
- **En haut** : pastille « Écran public ouvert » (verte), ou « Écran public fermé » avec « Rouvrir », puis le titre de la démo.
- **Scène** : l'étape exactement comme sur l'écran public, avec le point chaud et la bulle.
- **Barre de progression du minuteur** sous la scène : verte jusqu'à 80 % de la durée cible, puis orange.
- **Barre de commandes** (`role="toolbar"`) :
  - minuteur `06:42 / 15:00` (`role="timer"`, annoncé seulement à la demande ; jamais d'annonce chaque seconde). Au-delà de la cible, il passe en orange et affiche « + 01:12 » ;
  - « Étape n sur N » ;
  - Précédente, Suivante (primaire), Écran noir (bouton bascule `aria-pressed`), Terminer.
- **Panneau** :
  - **Notes · étape n** : en puces, en 18 px, avec un bouton « Masquer » (N) ;
  - **Étape suivante** : vignette et titre ;
  - **Raccourcis** : → et ← pour changer d'étape, N pour les notes, B pour l'écran noir, T pour remettre le minuteur à zéro, Échap pour terminer.
- **Terminer** : retour à l'éditeur, avec un toast « Présentation terminée · 14 min 05 ».
- **Statistiques** : une présentation n'est pas comptée comme une vue de la démo (Analytics).

### Écran public (L22-04)

- Fenêtre dédiée, fond noir. On y voit :
  - la scène, centrée et à la plus grande taille possible ;
  - la bulle et le point chaud, sauf si l'option les masque ;
  - en pied, le titre de la démo et « n / N ».
- Aucune commande, aucune note. La fenêtre suit la vue présentateur en direct, dans le même navigateur.
- **Écran noir** (B) : la scène est remplacée par un noir complet, avec « Présentation en pause » en petit (`role="status"`).
- Fermer cette fenêtre ne coupe pas la présentation : la vue présentateur affiche « Écran public fermé · Rouvrir ».

## 3. Centre de notifications (L22-05, L22-06)

- **Cloche** (`Bell`) dans la barre du haut de l'app, à gauche des actions.
  - Pastille framboise avec le nombre de non lues ; « 9+ » au-delà de 9.
  - `aria-label` « Notifications, n non lues ».
  - Le bouton a `aria-haspopup="dialog"` et `aria-expanded`.
- **Panneau** (440 px, `role="dialog"`) :
  - en-tête « Notifications », « Tout marquer comme lu » et Fermer ;
  - filtres : Toutes, Mentions · n, Non lues · n ;
  - groupes « Aujourd'hui », « Cette semaine », « Plus ancien ».
- **Périmètre de ce lot : commentaires et mentions uniquement**, sans leads, webhooks ni alertes :
  - on vous mentionne (@) ;
  - on répond à un fil où vous avez écrit ;
  - on commente une démo que vous avez créée ;
  - on résout votre commentaire.
- **Ligne de notification** :
  - avatar de l'auteur, puis la phrase : « **Marie Durand** vous a mentionnée dans « {{démo}} » · étape n » ;
  - l'extrait du message en citation (bord prune, la mention en pastille) et l'heure relative ;
  - les non lues ont un fond prune pâle, un point et le texte « Non lue » pour les lecteurs d'écran ;
  - toute la ligne est un lien qui ouvre l'éditeur sur l'étape, avec le fil de commentaire ouvert. L'ouvrir la marque comme lue.
- **Pied** : « Notifications des 30 derniers jours » et « Préférences ».
  - Les préférences proposent un interrupteur par type, en notification dans l'app.
  - L'envoi par e-mail est en « Bientôt », tant que l'envoi d'e-mails n'est pas branché.
- **Vide** (L22-06) : icône cloche, « Rien de nouveau », et « Vous serez prévenue ici quand on vous mentionne ou qu'on répond à vos commentaires. » L'accord suit le genre du profil ; sinon on écrit « prévenu·e ».
- **Mise à jour** en direct : la pastille se met à jour sans recharger. Rien n'est annoncé à chaque nouvelle notification. Seul le nombre de la cloche change.

## 4. Mentions (L22-07)

- Dans le champ de réponse d'un fil de commentaire, « @ » ouvre une liste de membres :
  - le champ est en `aria-autocomplete="list"`, la liste en `role="listbox"`, l'option active en `aria-activedescendant` ;
  - la liste est filtrée à chaque lettre et limitée aux membres qui ont accès à la démo ;
  - chaque option affiche l'avatar, le nom, puis le rôle et « sur cette démo » si la personne y est ;
  - flèches pour choisir, Entrée ou Tab pour insérer, Échap pour fermer.
- La mention insérée est une pastille prune « @Prénom Nom », supprimée d'un seul retour arrière.
- Envoyer le commentaire notifie chaque personne mentionnée (L22-05). On ne peut pas mentionner une personne hors du workspace.

## 5. Présence (L22-08)

- **Barre de l'éditeur** : pile d'avatars des **autres** personnes présentes, sans vous, avant Annuler et Rétablir.
  - 3 avatars au plus, puis « +n ».
  - Point vert : actif ; point gris : inactif depuis plus de 2 minutes.
  - Le bouton a pour nom « n autres personnes sur cette démo : … » et ouvre un panneau « Sur cette démo » : vous, puis chaque personne avec son étape et ce qu'elle fait (« modifie le texte de la bulle », « inactif depuis 3 min »).
  - Un clic sur une personne affiche son étape.
- **Rail** : avatar de 20 px en haut à droite de la vignette de l'étape où se trouve chaque personne (`title` et texte masqué).
- **Même étape** : un bandeau d'information au-dessus du canevas, « **Marie Durand** modifie aussi cette étape (texte de la bulle). Vos changements sont fusionnés champ par champ. » (`role="status"`, une seule annonce).
- **Curseur distant** : flèche et étiquette au prénom, de la couleur de l'avatar, masquables dans les Réglages (« Afficher les curseurs »).
- **Conflit sur un même champ** : la dernière modification enregistrée l'emporte. L'autre personne voit un toast « Marie Durand a modifié ce champ · Voir la version précédente », qui ouvre l'historique.

## 6. Branchement conditionnel (L22-09)

- Il s'applique aux étapes **Question à choix** (menu de choix A2 §5) et **Sondage à choix** (unique ou multiple).
- **Panneau Étape** :
  - **Question à choix** : la question et les réponses, une par ligne, 6 au plus ;
  - **Règles de suite** : une carte par règle, avec « Si la réponse est » (liste des réponses ; pour un choix multiple, « contient »), « Alors aller à » (étape « n · titre », chapitre, Fin de la démo ou Ouvrir un lien) et une corbeille ;
  - une carte « Sinon, aller à », en pointillés et toujours présente, réglée par défaut sur « Étape suivante » ;
  - « Ajouter une règle ». Aide : les règles sont lues dans l'ordre et la première qui correspond s'applique.
- **Contrôles** (alerte d'avertissement, `role="status"`) :
  - une étape qu'aucun chemin n'atteint : « L'étape n n'est atteinte par aucun chemin » ;
  - une règle vers une étape supprimée : la liste affiche « Étape supprimée », en erreur ;
  - une boucle sans sortie (retour à une étape antérieure sans autre issue) : avertissement, non bloquant.
  - La publication reste possible, mais la modale de publication rappelle les avertissements.
- **Rail** : badge info « n règles » (`GitBranch`) sur la vignette.
- **Lecteur** : le visiteur ne voit rien des règles. L'entonnoir des Analytics suit le chemin réel, et la répartition des réponses est donnée par réponse.

## 7. Règles communes

- Données fictives uniquement (`*.example`). Icônes Lucide, aucun caractère utilisé comme icône. Les flèches des raccourcis sont des libellés de touches.
- Tout reste utilisable au clavier :
  - focus visible sur le fond sombre du présentateur (double anneau #0B0D10 et #51ABDD) ;
  - aucun piège hors des modales ;
  - les raccourcis à une lettre sont inactifs pendant une saisie.
- Les avatars ne portent jamais seuls l'information : nom en `title` et texte masqué.
- L'envoi d'e-mails (notifications, mentions) reste en « Bientôt » tant qu'il n'est pas branché.
